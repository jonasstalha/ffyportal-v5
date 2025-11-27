import React, { useState, useEffect } from 'react';
import { Save, FileText, AlertTriangle, Check, X, Plus, Trash2, Copy, SplitSquareHorizontal, Upload, Cloud, CloudOff } from 'lucide-react';
import { jsPDF } from "jspdf"; // Import jsPDF for PDF generation
// Extend PaletteData to support dynamic keys for columns
import logo from '../../../assets/icon.png';
import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { 
  saveQualityControlLot, 
  uploadQualityControlImage, 
  getQualityControlLots,
  QualityControlLot as FirebaseLot,
  QualityControlFormData 
} from '../../lib/qualityControlService';
import { useSharedLots } from '../../hooks/useSharedLots';
import { SharedLot, sharedLotService } from '../../lib/sharedLotService';
import { firestore, storage } from '../../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { ref, deleteObject, listAll } from 'firebase/storage';

interface PaletteData {
  // Allow dynamic numeric/boolean metadata fields (e.g., paletteIndex) in addition to strings
  [key: string]: string | number | boolean | undefined;
  firmness: string;
  rotting: string;
  foreignMatter: string;
  withered: string;
  hardenedEndoderm: string;
  parasitePresence: string;
  parasiteAttack: string;
  temperature: string;
  odorOrTaste: string;
  packageWeight: string;
  shapeDefect: string;
  colorDefect: string;
  epidermisDefect: string;
  homogeneity: string;
  missingBrokenGrains: string;
  size: string;
  packageCount: string;
  packagingState: string;
  labelingPresence: string;
  corners: string;
  horizontalStraps: string;
  paletteSheet: string;
  woodenPaletteState: string;
  grossWeight: string;
  netWeight: string;
  internalLotNumber: string;
  paletteConformity: string;
  requiredNetWeight: string;
  // Optional metadata added at save time
  paletteIndex?: number;
  timestamp?: string;
}

interface FormData {
  date: string;
  product: string;
  variety: string;
  campaign: string;
  clientLot: string;
  shipmentNumber: string;
  packagingType: string;
  category: string;
  exporterNumber: string;
  frequency: string;
  palettes: PaletteData[];
  tolerance?: {
    minCharacteristic?: string;
    category1Defects?: string;
    category2Defects?: string;
    category3Defects?: string;
    category4Defects?: string;
    minCharacteristicConform?: boolean;
    category1DefectsConform?: boolean;
    category2DefectsConform?: boolean;
    category3DefectsConform?: boolean;
  };
}

interface QualityControlLot {
  id: string;
  lotNumber: string;
  formData: FormData;
  images: File[];
  imageUrls?: string[]; // Firebase Storage URLs
  status: 'draft' | 'completed' | 'submitted' | 'chief_approved' | 'chief_rejected';
  phase: 'controller' | 'chief';
  createdAt: string;
  updatedAt: string;
  controller?: string;
  chief?: string;
  chiefComments?: string;
  chiefApprovalDate?: string;
  syncedToFirebase?: boolean;
}

const emptyPaletteData = (): PaletteData => ({
  firmness: '0',
  rotting: '0',
  foreignMatter: '0',
  withered: 'C',
  hardenedEndoderm: '0',
  parasitePresence: '0',
  parasiteAttack: '0',
  temperature: 'C',
  odorOrTaste: 'C',
  packageWeight: '0',
  shapeDefect: '0',
  colorDefect: '0',
  epidermisDefect: '0',
  homogeneity: 'C',
  missingBrokenGrains: '0',
  size: '0',
  packageCount: '',
  packagingState: 'C',
  labelingPresence: 'C',
  corners: 'C',
  horizontalStraps: 'C',
  paletteSheet: 'C',
  woodenPaletteState: 'C',
  grossWeight: '',
  netWeight: '',
  internalLotNumber: '',
  paletteConformity: 'C',
  requiredNetWeight: ''
});

const initializeFormData = (): FormData => ({
  date: new Date().toISOString().split('T')[0],
  product: '',
  variety: '',
  campaign: '2024-2025',
  clientLot: '',
  shipmentNumber: '',
  packagingType: '',
  category: 'I',
  exporterNumber: '106040',
  frequency: '1 Carton/palette',
  palettes: Array(5).fill(null).map(() => emptyPaletteData())
});

export default function EnhancedPDFGenerator() {
  // --- PDF value and coordinate sanitization helpers ---
  const safeText = (value: any) => (typeof value === 'string' ? value : '');
  const safeNumber = (value: any) => (typeof value === 'number' && !isNaN(value) ? value : 0);
  const sanitizeText = (text: string) =>
    text
      .replace(/✓/g, 'v')
      .replace(/≤/g, '<=')
      .replace(/≥/g, '>=')
      .replace(/✗/g, 'x')
      .replace(/[^ -\x7F]/g, ''); // Remove all non-ASCII
  const [lots, setLots] = useState<QualityControlLot[]>([]);
  const [activeLotId, setActiveLotId] = useState<string | null>(null);
  const [paletteCount, setPaletteCount] = useState<number>(5);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [results, setResults] = useState({
    minCharacteristics: 0,
    totalDefects: 0,
    missingBrokenGrains: 0,
    weightConformity: 0,
    isConform: false
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [filteredRapports, setFilteredRapports] = useState<FormData[]>([]);
  const [validation, setValidation] = useState<{[key:string]: string}>({});
  const [lotImages, setLotImages] = useState<{[lotId: string]: File[]}>({});
  const [uploadingImages, setUploadingImages] = useState<{[lotId: string]: boolean}>({});
  const [syncStatus, setSyncStatus] = useState<{[lotId: string]: 'synced' | 'pending' | 'error'}>({});
  const [currentUser] = useState('Quality Controller'); // This should come from auth context
  // --- Search and Filter State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilters, setStatusFilters] = useState({ completed: true, pending: true, submitted: true });
  // --- Search Filter State ---
  const [searchFilters, setSearchFilters] = useState({
    product: {}, // e.g. { 'Avocat': true, 'Citrus': false }
    conformity: { conform: true, nonConform: true }
  });

  // --- Multi-lots (Qualité) using shared_lots backend ---
  const { lots: sharedLots, loading: sharedLotsLoading, addLot: addSharedLot, getQualityLots } = useSharedLots();
  const qualitySharedLots = getQualityLots();
  const [newQualityLotNumber, setNewQualityLotNumber] = useState<string>('');
  const [creatingQualityLot, setCreatingQualityLot] = useState<boolean>(false);
  const [activeQualitySharedLotId, setActiveQualitySharedLotId] = useState<string | null>(null);
  const [renamingLotId, setRenamingLotId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const handleCreateQualitySharedLot = async () => {
    try {
      setCreatingQualityLot(true);
      const lotNumber = (newQualityLotNumber || `LOT-${Math.random().toString(36).slice(2, 7).toUpperCase()}`).trim();
      await addSharedLot({
        lotNumber,
        status: 'brouillon',
        type: 'quality',
        qualityData: {
          headerData: {
            date: new Date().toISOString().slice(0, 10),
            produit: 'AVOCAT',
            numeroLotClient: lotNumber
          }
        }
      } as any);
      setNewQualityLotNumber('');
    } catch (err) {
      console.error('Failed to create quality shared lot:', err);
      alert('Impossible de créer le lot multi (Qualité). Assurez-vous d\'être connecté.');
    } finally {
      setCreatingQualityLot(false);
    }
  };

  // Select a quality shared lot and open it in the QC form area
  const selectQualitySharedLot = async (sl: SharedLot) => {
    try {
      setActiveQualitySharedLotId(sl.id);
      // Try to find an existing QC lot by lotNumber
      const found = lots.find(l => l.lotNumber === sl.lotNumber);
      const qcForm = sl.qualityData?.qcFormData as FormData | undefined;
      const header = sl.qualityData?.headerData || {};
      const seededForm: FormData = {
        ...initializeFormData(),
        date: header.date || new Date().toISOString().slice(0, 10),
        product: header.produit || 'AVOCAT',
        clientLot: header.numeroLotClient || sl.lotNumber,
      } as FormData;
      if (found) {
        // Do NOT overwrite existing form data on reopen; just activate it
        setActiveLotId(found.id);
        return;
      }
      // Create a new QC lot document seeded from the shared lot data (prefer qcForm if exists)
      const newLot = {
        lotNumber: sl.lotNumber,
        formData: qcForm || seededForm,
        images: [],
        imageUrls: [],
        status: 'draft' as const,
        phase: 'controller' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        controller: currentUser,
        syncedToFirebase: false
      };

      const docRef = await addDoc(collection(firestore, 'lots'), {
        ...newLot,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setActiveLotId(docRef.id);
      setLotImages(prev => ({ ...prev, [docRef.id]: [] }));
      setSyncStatus(prev => ({ ...prev, [docRef.id]: 'pending' }));
    } catch (e) {
      console.error('Failed to select quality shared lot:', e);
      alert('Impossible d\'ouvrir ce lot. Assurez-vous d\'être connecté.');
    }
  };

  // Save current QC form back into the selected shared lot (qualityData.qcFormData)
  const saveCurrentToSharedLot = async (formDataOverride?: FormData) => {
    const current = getCurrentLot();
    if (!current || !activeQualitySharedLotId) return;
    try {
      const headerData = {
        date: current.formData.date,
        produit: current.formData.product,
        numeroLotClient: current.formData.clientLot
      };
      const qcFormData = (formDataOverride || current.formData) as any;
      const existing = sharedLots.find(l => l.id === activeQualitySharedLotId)?.qualityData || {};
      await sharedLotService.updateLot(activeQualitySharedLotId, {
        qualityData: {
          ...existing,
          headerData,
          qcFormData,
          lastSavedAt: new Date().toISOString()
        }
      } as any);
      return true;
    } catch (err) {
      console.error('Save to shared_lots failed', err);
      alert('Échec de la sauvegarde vers shared_lots.');
      return false;
    }
  };

  // Open a shared lot and focus the form for editing
  const handleOpenSharedLot = async (sl: SharedLot) => {
    await selectQualitySharedLot(sl);
    setActiveTab(0);
    // Smooth scroll to the form area
    try {
      document.getElementById('qc-form-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {}
  };

  // Open a shared lot and immediately generate its PDF
  const handleOpenAndDownload = async (sl: SharedLot) => {
    await selectQualitySharedLot(sl);
    // Wait a microtask to ensure active lot state is applied before generating
    setTimeout(() => {
      try { handleGenerateReport(); } catch (e) { console.error('PDF generation failed:', e); }
    }, 50);
  };

  // Rename a shared lot and propagate to QC docs
  const handleRenameSharedLot = async (sl: SharedLot, newLotNumber: string) => {
    const oldNumber = sl.lotNumber;
    if (!newLotNumber || newLotNumber === oldNumber) return;
    try {
      await sharedLotService.updateLot(sl.id, { lotNumber: newLotNumber } as any);
      // Propagate to local QC 'lots' collection docs
      const affected = lots.filter(l => l.lotNumber === oldNumber);
      await Promise.all(
        affected.map(l => updateDoc(doc(firestore, 'lots', l.id), {
          lotNumber: newLotNumber,
          'formData.clientLot': newLotNumber,
          updatedAt: serverTimestamp()
        }))
      );
      if (activeQualitySharedLotId === sl.id) {
        // If current active, also adjust current QC selection if needed
        const current = getCurrentLot();
        if (current) {
          updateLotData(current.id, { lotNumber: newLotNumber, formData: { ...current.formData, clientLot: newLotNumber } as any });
        }
      }
    } catch (err) {
      console.error('Rename failed', err);
      alert('Échec du renommage du lot.');
    } finally {
      setRenamingLotId(null);
      setRenameValue('');
    }
  };

  // Delete a shared lot and its associated QC doc if exists
  const handleDeleteSharedLot = async (sl: SharedLot) => {
    if (!confirm(`Supprimer le lot ${sl.lotNumber} ?`)) return;
    try {
      await sharedLotService.deleteLot(sl.id);
      // Delete matching QC docs from 'lots'
      const affected = lots.filter(l => l.lotNumber === sl.lotNumber);
      await Promise.all(affected.map(l => deleteDoc(doc(firestore, 'lots', l.id))));
      if (activeQualitySharedLotId === sl.id) {
        setActiveQualitySharedLotId(null);
        setActiveLotId(null);
      }
    } catch (err) {
      console.error('Delete shared lot failed', err);
      alert('Échec de la suppression du lot.');
    }
  };

  // Get current lot data
  const getCurrentLot = (): QualityControlLot | null => {
    return lots.find(lot => lot.id === activeLotId) || null;
  };

  // Get current form data
  const getCurrentFormData = (): FormData => {
    const currentLot = getCurrentLot();
    return currentLot?.formData || initializeFormData();
  };

  // Create a new lot (Firestore)
  const createNewLot = async () => {
    const newLot = {
      lotNumber: `LOT-${String(lots.length + 1).padStart(3, '0')}`,
      formData: initializeFormData(),
      images: [],
      imageUrls: [],
      status: 'draft',
      phase: 'controller',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      controller: currentUser,
      syncedToFirebase: false
    };
    try {
      const docRef = await addDoc(collection(firestore, 'lots'), {
        ...newLot,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setActiveLotId(docRef.id);
      setLotImages(prev => ({ ...prev, [docRef.id]: [] }));
      setSyncStatus(prev => ({ ...prev, [docRef.id]: 'pending' }));
    } catch (e) {
      alert('Erreur lors de la création du lot: ' + (e as any)?.message);
    }
  };

  // Real-time Firestore lots sync
  useEffect(() => {
    const lotsCol = collection(firestore, 'lots');
    const unsubscribe = onSnapshot(lotsCol, (snapshot) => {
      const lotsData: QualityControlLot[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as QualityControlLot[];
      setLots(lotsData);
      // If no current lot selected, select the first
      if (!activeLotId && lotsData.length > 0) {
        setActiveLotId(lotsData[0].id);
      }
    });
    return () => unsubscribe();
  }, []);

  // Duplicate a lot
  const duplicateLot = (lotId: string) => {
    const sourceLot = lots.find(lot => lot.id === lotId);
    if (!sourceLot) return;

    const newLot: QualityControlLot = {
      id: `lot-${Date.now()}`,
      lotNumber: `LOT-${String(lots.length + 1).padStart(3, '0')}`,
      formData: { ...sourceLot.formData },
      images: [...sourceLot.images],
      status: 'draft',
      phase: 'controller',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setLots(prev => [...prev, newLot]);
    setActiveLotId(newLot.id);
    setLotImages(prev => ({ ...prev, [newLot.id]: [...(lotImages[lotId] || [])] }));
  };

  // Delete a lot from both Firestore and Firebase Storage
  const deleteLot = async (lotId: string) => {
    // Confirmation dialog
    const confirmDelete = window.confirm(
      'Êtes-vous sûr de vouloir supprimer ce lot ?\n\n' +
      'Cette action supprimera définitivement :\n' +
      '• Le lot et toutes ses données\n' +
      '• Toutes les images associées\n' +
      '• Toutes les données stockées dans Firebase\n\n' +
      'Cette action est irréversible.'
    );
    
    if (!confirmDelete) return;

    try {
      // Show loading state
      console.log(`Suppression du lot ${lotId}...`);
      
      // 1. First, try to delete specific files if we have URLs
      const lotToDelete = lots.find(lot => lot.id === lotId);
      let deletedStorageFiles = 0;
      
      if (lotToDelete?.imageUrls && lotToDelete.imageUrls.length > 0) {
        try {
          // Delete files based on known URLs
          const deletePromises = lotToDelete.imageUrls.map(async (url) => {
            try {
              const fileRef = ref(storage, url);
              await deleteObject(fileRef);
              deletedStorageFiles++;
            } catch (err) {
              console.warn(`Impossible de supprimer le fichier: ${url}`, err);
            }
          });
          
          await Promise.all(deletePromises);
          console.log(`${deletedStorageFiles} fichiers supprimés du Storage pour le lot ${lotId}`);
        } catch (storageError) {
          console.warn('Erreur lors de la suppression des fichiers Storage via URLs:', storageError);
        }
      }
      
      // 2. Try to delete using listAll only in production (skip in development due to CORS)
      const isProduction = window.location.hostname !== 'localhost';
      
      if (isProduction) {
        try {
          const lotStorageRef = ref(storage, `quality_control/${lotId}/`);
          const listResult = await listAll(lotStorageRef);
          
          if (listResult.items.length > 0) {
            // Delete all files in the lot's folder
            const deletePromises = listResult.items.map(itemRef => deleteObject(itemRef));
            await Promise.all(deletePromises);
            deletedStorageFiles += listResult.items.length;
            console.log(`${listResult.items.length} fichiers supprimés via listAll pour le lot ${lotId}`);
          }
        } catch (storageError) {
          console.warn('Erreur lors de la suppression via listAll:', storageError);
        }
      } else {
        console.log('Mode développement: listAll ignoré pour éviter les erreurs CORS');
      }

      // 3. Delete the document from Firestore
      await deleteDoc(doc(firestore, 'lots', lotId));
      console.log(`Document Firestore supprimé pour le lot ${lotId}`);

      // 4. Update local state
      setLots(prev => prev.filter(lot => lot.id !== lotId));
      setLotImages(prev => {
        const newImages = { ...prev };
        delete newImages[lotId];
        return newImages;
      });
      setSyncStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[lotId];
        return newStatus;
      });

      // 5. If the deleted lot was active, select another lot
      if (activeLotId === lotId) {
        const remainingLots = lots.filter(lot => lot.id !== lotId);
        setActiveLotId(remainingLots[0]?.id || null);
      }

      // Success message
      const storageMessage = deletedStorageFiles > 0 
        ? `📷 Images Storage: ${deletedStorageFiles} fichiers supprimés`
        : '📷 Images Storage: Aucun fichier à supprimer';
        
      alert(`✅ Lot "${lotId}" supprimé avec succès!\n\n` +
            `📋 Données Firestore: Supprimées\n` +
            `${storageMessage}\n` +
            `💾 Cache local: Nettoyé\n\n` +
            `Note: Certains fichiers Storage peuvent nécessiter une suppression manuelle en production.`);

    } catch (error) {
      console.error('Erreur lors de la suppression du lot:', error);
      alert(`❌ Erreur lors de la suppression du lot:\n${(error as Error).message}\n\nLe lot a peut-être été partiellement supprimé. Vérifiez votre connexion et réessayez.`);
    }
  };

  // Update lot data
  const updateLotData = (lotId: string, updates: Partial<QualityControlLot>) => {
    setLots(prev => prev.map(lot => 
      lot.id === lotId 
        ? { ...lot, ...updates, updatedAt: new Date().toISOString() }
        : lot
    ));
  };

  const tabTitles = [
    "Basic Info",
    "Controle poids",
    "Controle des Caracteristiques minimales",
    "Controle des parametres categorie I",
    "Controle produit fini",
    "Tolerance",
  ];

  // Update current lot's form data
  const updateCurrentLotFormData = (updates: Partial<FormData>) => {
    if (!activeLotId) return;
    
    const currentLot = getCurrentLot();
    if (!currentLot) return;

    const updatedFormData = { ...currentLot.formData, ...updates };
    updateLotData(activeLotId, { formData: updatedFormData });
  };

  useEffect(() => {
    const currentLot = getCurrentLot();
    if (!currentLot || !currentLot.formData || !Array.isArray(currentLot.formData.palettes)) return;

    const currentFormData = currentLot.formData;
    if (paletteCount > currentFormData.palettes.length) {
      const newPalettes = [...currentFormData.palettes];
      for (let i = currentFormData.palettes.length; i < paletteCount; i++) {
        newPalettes.push(emptyPaletteData());
      }
      updateCurrentLotFormData({ palettes: newPalettes });
    } else if (paletteCount < currentFormData.palettes.length) {
      updateCurrentLotFormData({ 
        palettes: currentFormData.palettes.slice(0, paletteCount) 
      });
    }
  }, [paletteCount, activeLotId]);

  useEffect(() => {
    calculateResults();
  }, [lots, activeLotId]);

  const handleInputChange = (field: string, value: string | boolean) => {
    const currentFormData = getCurrentFormData();
    const keys = field.split('.');
    
    if (keys.length === 2) {
      updateCurrentLotFormData({
        tolerance: {
          ...currentFormData.tolerance,
          [keys[1]]: value
        }
      });
    } else {
      updateCurrentLotFormData({ [field]: value });
    }
  };

  const handlePaletteChange = (rowIndex: number, field: string, value: string) => {
    const currentFormData = getCurrentFormData();
    const updatedPalettes = [...currentFormData.palettes];
    if (!updatedPalettes[rowIndex]) {
      updatedPalettes[rowIndex] = {} as PaletteData;
    }
    updatedPalettes[rowIndex][field] = value;
    updateCurrentLotFormData({ palettes: updatedPalettes });
  };

  const calculateResults = () => {
    const currentFormData = getCurrentFormData();
    let totalMinCharacteristics = 0;
    let totalCategoryDefects = 0;
    let totalMissingGrains = 0;
    let totalWeightConformity = 0;
    let validPalettes = 0;

    if (Array.isArray(currentFormData.palettes)) {
      currentFormData.palettes.forEach(palette => {
        if (palette.rotting || palette.foreignMatter || palette.parasitePresence) {
          validPalettes++;
          const minCharacteristics = sum([
            parseFloat(palette.rotting || '0'),
            parseFloat(palette.foreignMatter || '0'),
            parseFloat(palette.withered || '0'),
            parseFloat(palette.hardenedEndoderm || '0'),
            parseFloat(palette.parasitePresence || '0'),
            parseFloat(palette.parasiteAttack || '0')
          ]);
          totalMinCharacteristics += minCharacteristics;
          const categoryDefects = sum([
            parseFloat(palette.shapeDefect || '0'),
            parseFloat(palette.colorDefect || '0'),
            parseFloat(palette.epidermisDefect || '0')
          ]);
          totalCategoryDefects += categoryDefects;
          totalMissingGrains += parseFloat(palette.missingBrokenGrains || '0');
          if (palette.packageWeight && palette.requiredNetWeight) {
            const requiredWeight = parseFloat(palette.requiredNetWeight);
            const actualWeight = parseFloat(palette.packageWeight);
            const weightConformity = (actualWeight - requiredWeight) / requiredWeight * 100;
            totalWeightConformity += weightConformity;
          }
        }
      });
    }
    
    if (validPalettes > 0) {
      const avgMinCharacteristics = totalMinCharacteristics / validPalettes;
      const avgCategoryDefects = totalCategoryDefects / validPalettes;
      const avgTotalDefects = avgMinCharacteristics + avgCategoryDefects;
      const avgMissingGrains = totalMissingGrains / validPalettes;
      const avgWeightConformity = totalWeightConformity / validPalettes;
      
      const isConform = 
        avgMinCharacteristics <= 10 && 
        avgTotalDefects <= 10 && 
        avgMissingGrains <= 10 && 
        avgWeightConformity >= 1;
      
      setResults({
        minCharacteristics: avgMinCharacteristics,
        totalDefects: avgTotalDefects,
        missingBrokenGrains: avgMissingGrains,
        weightConformity: avgWeightConformity,
        isConform
      });
    }
  };

  const sum = (values: number[]): number => {
    return values.reduce((acc, val) => acc + (isNaN(val) ? 0 : val), 0);
  };

  const calculateAverages = (field: string): string => {
    const currentFormData = getCurrentFormData();
    const allValues = currentFormData.palettes
      .slice(0, paletteCount) // Only consider the selected number of palettes
      .map((palette: PaletteData) => parseFloat(palette[field] as string))
      .map((val: number) => isNaN(val) ? 0 : val); // Convert NaN to 0
    
    if (allValues.length === 0) return '';
    
    const sum = allValues.reduce((sum: number, val: number) => sum + val, 0);
    const average = sum / paletteCount; // Divide by total palette count, not just valid values
    return average.toFixed(2);
  };

  // Enhanced text wrapping function
  const wrapText = (doc: jsPDF, text: string, maxWidth: number, fontSize: number = 7): string[] => {
    doc.setFontSize(fontSize);
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = doc.getTextWidth(testLine);
      
      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      }
      else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };

  // Enhanced table drawing function
  const drawEnhancedTable = (
    doc: jsPDF,
    startY: number,
    headers: string[],
    data: (string | number)[][],
    hasAverageColumn: boolean = true,
    solidGreen: boolean = false,
    customTableWidth: number | null = null
  ) => {
    let currentY = startY;
    const rowHeight = 8; // Restored original height for first page
    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = customTableWidth ?? (pageWidth - 20);
    // Color scheme
    const headerBg: [number, number, number] = [230, 230, 230];
    const lightCol: [number, number, number] = [245, 245, 245];
    const alternateRow: [number, number, number] = [248, 248, 248];
    const borderColor: [number, number, number] = [64, 64, 64];
    const moyenneGreen: [number, number, number] = [144, 238, 144]; // light green
    // Calculate responsive column widths
    let columnWidths;
    if (hasAverageColumn) {
      const firstColWidth = 60; // Decreased from 80 to 60 to make it smaller
      const avgColWidth = 25;
      const remainingWidth = tableWidth - firstColWidth - avgColWidth;
      const dataColWidth = remainingWidth / (headers.length - 2);
      columnWidths = [firstColWidth, ...Array(headers.length - 2).fill(dataColWidth), avgColWidth];
    } else {
      const equalWidth = tableWidth / headers.length;
      columnWidths = Array(headers.length).fill(equalWidth);
    }
    // Draw header
    doc.setFillColor(...headerBg);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.rect(10, currentY, tableWidth, rowHeight, 'FD');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    let currentX = 10;
    headers.forEach((header, index) => {
      doc.setTextColor(0, 0, 0);
      const textWidth = doc.getTextWidth(header);
      doc.text(header, currentX + (columnWidths[index] / 2) - (textWidth / 2), currentY + 5.5);
      doc.line(currentX, currentY, currentX, currentY + rowHeight);
      currentX += columnWidths[index];
    });
    doc.line(currentX, currentY, currentX, currentY + rowHeight);
    currentY += rowHeight;
    // Draw data rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    data.forEach((row: (string | number)[], rowIndex: number) => {
      // Highlight 'Moyenne' row green
      const isMoyenne = typeof row[0] === 'string' && row[0].toLowerCase().includes('moyenne');
      const shouldFill = isMoyenne ? true : rowIndex % 2 === 1;
      if (shouldFill) {
        doc.setFillColor(...(isMoyenne ? moyenneGreen : alternateRow));
        doc.rect(10, currentY, tableWidth, rowHeight, 'F');
      }
      let currentX = 10;
      row.forEach((cell: string | number, cellIndex: number) => {
        doc.setTextColor(0, 0, 0);
        // Always fill Moyenne column green
        if (cellIndex === row.length - 1 && hasAverageColumn) {
          doc.setFillColor(...moyenneGreen);
          doc.rect(currentX, currentY, columnWidths[cellIndex], rowHeight, 'F');
          doc.setFont('helvetica', isMoyenne ? 'bold' : 'normal');
        } else {
          doc.setFont('helvetica', isMoyenne ? 'bold' : 'normal');
        }
        let cellText = '';
        if (typeof cell === 'string' || typeof cell === 'number') {
          cellText = String(cell);
        }
        cellText = sanitizeText(safeText(cellText));
        if (cellIndex === 0) {
          const wrappedText = wrapText(doc, cellText, columnWidths[cellIndex] - 4);
          if (Array.isArray(wrappedText) && wrappedText.length > 0) {
            wrappedText.forEach((line, i) => {
              doc.text(line, currentX + 2, currentY + 5.5 + i * 3.5);
            });
          } else if (typeof cellText === 'string' && cellText.trim() !== '') {
            doc.text(cellText, currentX + 2, currentY + 5.5);
          }
        } else {
          if (typeof cellText === 'string' && cellText.trim() !== '') {
            doc.text(cellText, currentX + (columnWidths[cellIndex] / 2) - (doc.getTextWidth(cellText) / 2), currentY + 5.5);
          }
        }
        doc.setDrawColor(...borderColor);
        const x1 = safeNumber(currentX);
        const y1 = safeNumber(currentY);
        const x2 = safeNumber(currentX);
        const y2 = safeNumber(currentY + rowHeight);
        doc.line(x1, y1, x2, y2);
        currentX += columnWidths[cellIndex];
      });
      // Draw borders
      const x1 = safeNumber(currentX);
      const y1 = safeNumber(currentY);
      const x2 = safeNumber(currentX);
      const y2 = safeNumber(currentY + rowHeight);
      doc.line(x1, y1, x2, y2);
      const bx1 = safeNumber(10);
      const by1 = safeNumber(currentY + rowHeight);
      const bx2 = safeNumber(10 + tableWidth);
      const by2 = safeNumber(currentY + rowHeight);
      doc.line(bx1, by1, bx2, by2);
      currentY += rowHeight;
    });
    return currentY + 5;
  };

  // Patch drawEnhancedTable to allow custom tableWidth (50% for this table)
  const drawEnhancedTable50 = (
    doc: jsPDF,
    startY: number,
    headers: string[],
    data: (string | number)[][],
    hasAverageColumn: boolean = true,
    solidGreen: boolean = false
  ) => {
    let currentY = startY;
    const rowHeight = 5;
    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = (pageWidth - 20) * 0.5; // 50% width
    const headerBg: [number, number, number] = [230, 230, 230];
    const lightCol: [number, number, number] = [245, 245, 245];
    const alternateRow: [number, number, number] = [248, 248, 248];
    const borderColor: [number, number, number] = [64, 64, 64];
    const moyenneGreen: [number, number, number] = [144, 238, 144];
    let columnWidths;
    if (hasAverageColumn) {
      const firstColWidth = 60 * 0.5;
      const avgColWidth = 25 * 0.5;
      const remainingWidth = tableWidth - firstColWidth - avgColWidth;
      const dataColWidth = remainingWidth / (headers.length - 2);
      columnWidths = [firstColWidth, ...Array(headers.length - 2).fill(dataColWidth), avgColWidth];
    } else {
      const equalWidth = tableWidth / headers.length;
      columnWidths = Array(headers.length).fill(equalWidth);
    }
    // Draw header
    doc.setFillColor(...headerBg);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.rect(10, currentY, tableWidth, rowHeight, 'FD');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    let currentX = 10;
    headers.forEach((header, index) => {
      if (index === headers.length - 1 && hasAverageColumn) {
        doc.setFillColor(...moyenneGreen); // Always green for Moyenne column
        doc.rect(currentX, currentY, columnWidths[index], rowHeight, 'F');
        doc.setTextColor(0, 0, 0);
        const textWidth = doc.getTextWidth(header);
        doc.text(header, currentX + (columnWidths[index] / 2) - (textWidth / 2), currentY + 5.5);
        doc.setTextColor(0, 0, 0);
      } else {
        const textWidth = doc.getTextWidth(header);
        doc.text(header, currentX + (columnWidths[index] / 2) - (textWidth / 2), currentY + 5.5);
      }
      doc.line(currentX, currentY, currentX, currentY + rowHeight);
      currentX += columnWidths[index];
    });
    doc.line(currentX, currentY, currentX, currentY + rowHeight);
    currentY += rowHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    data.forEach((row: (string | number)[], rowIndex: number) => {
      const isMoyenne = typeof row[0] === 'string' && row[0].toLowerCase().includes('moyenne');
      const shouldFill = isMoyenne ? true : rowIndex % 2 === 1;
      if (shouldFill) {
        doc.setFillColor(...(isMoyenne ? moyenneGreen : alternateRow));
        doc.rect(10, currentY, tableWidth, rowHeight, 'F');
      }
      let currentX = 10;
      row.forEach((cell: string | number, cellIndex: number) => {
        doc.setTextColor(0, 0, 0);
        // Always fill Moyenne column green
        if (cellIndex === row.length - 1 && hasAverageColumn) {
          doc.setFillColor(...moyenneGreen);
          doc.rect(currentX, currentY, columnWidths[cellIndex], rowHeight, 'F');
          doc.setFont('helvetica', isMoyenne ? 'bold' : 'normal');
        } else {
          doc.setFont('helvetica', isMoyenne ? 'bold' : 'normal');
        }
        let cellText = '';
        if (typeof cell === 'string' || typeof cell === 'number') {
          cellText = String(cell);
        }
        cellText = sanitizeText(safeText(cellText));
        if (cellIndex === 0) {
          const wrappedText = wrapText(doc, cellText, columnWidths[cellIndex] - 4);
          if (Array.isArray(wrappedText) && wrappedText.length > 0) {
            wrappedText.forEach((line, i) => {
              doc.text(line, currentX + 2, currentY + 5.5 + i * 3.5);
            });
          } else if (typeof cellText === 'string' && cellText.trim() !== '') {
            doc.text(cellText, currentX + 2, currentY + 5.5);
          }
        } else {
          if (typeof cellText === 'string' && cellText.trim() !== '') {
            doc.text(cellText, currentX + (columnWidths[cellIndex] / 2) - (doc.getTextWidth(cellText) / 2), currentY + 5.5);
          }
        }
        doc.setDrawColor(...borderColor);
        const x1 = safeNumber(currentX);
        const y1 = safeNumber(currentY);
        const x2 = safeNumber(currentX);
        const y2 = safeNumber(currentY + rowHeight);
        doc.line(x1, y1, x2, y2);
        currentX += columnWidths[cellIndex];
      });
      // Draw borders
      const x1 = safeNumber(currentX);
      const y1 = safeNumber(currentY);
      const x2 = safeNumber(currentX);
      const y2 = safeNumber(currentY + rowHeight);
      doc.line(x1, y1, x2, y2);
      const bx1 = safeNumber(10);
      const by1 = safeNumber(currentY + rowHeight);
      const bx2 = safeNumber(10 + tableWidth);
      const by2 = safeNumber(currentY + rowHeight);
      doc.line(bx1, by1, bx2, by2);
      currentY += rowHeight;
    });
    return currentY + 5;
  };

  // Tolerance table: green for moyenne column
  const drawToleranceTable = (
    doc: jsPDF,
    startY: number,
    headers: string[],
    data: (string | number)[][],
    customTableWidth: number | null = null
  ) => {
    let currentY = startY;
    const rowHeight = 8; // Reduced from 12 to 8 to fit within A4 page
    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = customTableWidth ?? (pageWidth - 20) * 0.5;
    const headerBg: [number, number, number] = [230, 230, 230];
    const alternateRow: [number, number, number] = [248, 248, 248];
    const borderColor: [number, number, number] = [64, 64, 64];
    const moyenneGreen: [number, number, number] = [144, 238, 144];
    
    // Custom column widths: Better balanced for content
    const toleranceColWidth = tableWidth * 0.50; // 50% for Tolérance column (longer text)
    const otherColWidth = tableWidth * 0.167; // ~16.7% for each other column (3 × 16.7% = 50%)
    const columnWidths = [toleranceColWidth, otherColWidth, otherColWidth, otherColWidth];
    
    doc.setFillColor(...headerBg);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.rect(10, currentY, tableWidth, rowHeight, 'FD');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    let currentX = 10;
    headers.forEach((header, index) => {
      const textWidth = doc.getTextWidth(header);
      doc.text(header, currentX + (columnWidths[index] / 2) - (textWidth / 2), currentY + rowHeight / 2 + 1.5);
      doc.line(currentX, currentY, currentX, currentY + rowHeight);
      currentX += columnWidths[index];
    });
    doc.line(currentX, currentY, currentX, currentY + rowHeight);
    currentY += rowHeight;
    // Draw data rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6); // Reduced from 7 to 6 for better fit in smaller rows
    data.forEach((row: (string | number)[], rowIndex: number) => {
      // Always make the 'Résultat moyen' cell green
      let currentX = 10;
      row.forEach((cell: string | number, cellIndex: number) => {
        if (cellIndex === 1) {
          doc.setFillColor(...moyenneGreen);
          doc.rect(currentX, currentY, columnWidths[cellIndex], rowHeight, 'F');
          doc.setFont('helvetica', 'bold');
        } else if (rowIndex % 2 === 1) {
          doc.setFillColor(...alternateRow);
          doc.rect(currentX, currentY, columnWidths[cellIndex], rowHeight, 'F');
          doc.setFont('helvetica', 'normal');
        } else {
          doc.setFont('helvetica', 'normal');
        }
        doc.setTextColor(0, 0, 0);
        let cellText = '';
        if (typeof cell === 'string' || typeof cell === 'number') {
          cellText = String(cell);
        }
        cellText = sanitizeText(safeText(cellText));
        if (cellIndex === 0) {
          const wrappedText = wrapText(doc, cellText, columnWidths[cellIndex] - 4);
          if (Array.isArray(wrappedText) && wrappedText.length > 0) {
            wrappedText.forEach((line, i) => {
              doc.text(line, currentX + 2, currentY + 2.5 + i * 2.5);
            });
          } else if (typeof cellText === 'string' && cellText.trim() !== '') {
            doc.text(cellText, currentX + 2, currentY + rowHeight / 2 + 1.5);
          }
        } else {
          if (typeof cellText === 'string' && cellText.trim() !== '') {
            const textWidth = doc.getTextWidth(cellText);
            doc.text(cellText, currentX + (columnWidths[cellIndex] / 2) - (textWidth / 2), currentY + rowHeight / 2 + 1.5);
          }
        }
        doc.setDrawColor(...borderColor);
        const x1 = safeNumber(currentX);
        const y1 = safeNumber(currentY);
        const x2 = safeNumber(currentX);
        const y2 = safeNumber(currentY + rowHeight);
        doc.line(x1, y1, x2, y2);
        currentX += columnWidths[cellIndex];
      });
      // Draw borders
      const x1 = safeNumber(currentX);
      const y1 = safeNumber(currentY);
      const x2 = safeNumber(currentX);
      const y2 = safeNumber(currentY + rowHeight);
      doc.line(x1, y1, x2, y2);
      const bx1 = safeNumber(10);
      const by1 = safeNumber(currentY + rowHeight);
      const bx2 = safeNumber(10 + tableWidth);
      const by2 = safeNumber(currentY + rowHeight);
      doc.line(bx1, by1, bx2, by2);
      currentY += rowHeight;
    });
    return currentY + 5;
  };

  const handleGenerateReport = async () => {
    if (!validateForm()) {
      alert('Veuillez remplir tous les champs obligatoires avant de générer le PDF.');
      return;
    }
    setIsGenerating(true);
    
    try {
      const currentFormData = getCurrentFormData();
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Enhanced header with text-based branding block (no image)
      doc.setFillColor(34, 139, 34);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.8);
      doc.rect(10, 10, pageWidth - 20, 20, 'FD');

      try {
        doc.addImage(logo, 'PNG', 14, 13, 14, 14);
      } catch (e) {
        /* If logo fails, skip image */
      }

      // Main title (enhanced)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('RAPPORT QUALITÉ', (pageWidth / 2) - 35, 18);
      doc.setFontSize(12);
      doc.text('CONTRÔLE DU PRODUIT', (pageWidth / 2) - 38, 25);
      
      // Document info
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Version 2.0', pageWidth - 60, 16);
      doc.text(new Date().toLocaleDateString('fr-FR'), pageWidth - 60, 20);
      doc.text('Page 1/2', pageWidth - 60, 28);
      
      // Product information with enhanced layout
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const infoY = 38;
      const infoFields = [
        ['Date:', currentFormData.date],
        ['Produit:', currentFormData.product],
        ['Variété:', currentFormData.variety],
        ['Campagne:', currentFormData.campaign]
      ];
      
      infoFields.forEach(([label, value], index) => {
        const x = 10 + (index * 65);
        doc.text(label, x, infoY);
        doc.setFont('helvetica', 'bold');
        doc.text(value || '', x + 20, infoY);
        doc.setFont('helvetica', 'normal');
      });
      
      // Second row of info
      const infoY2 = infoY + 8;
      const infoFields2 = [
        ['N° Expédition:', currentFormData.shipmentNumber],
        ['Type emballage:', currentFormData.packagingType],
        ['Catégorie:', currentFormData.category],
        ['N° Exportateur:', currentFormData.exporterNumber]
      ];
      
      infoFields2.forEach(([label, value], index) => {
        const x = 10 + (index * 65);
        doc.text(label, x, infoY2);
        doc.setFont('helvetica', 'bold');
        doc.text(value || '', x + 25, infoY2);
        doc.setFont('helvetica', 'normal');
      });
      
      // Generate palette headers (ensuring 27 columns total - 26 palettes + average)
      const maxPalettes = 26;
      const paletteHeaders = ['', ...Array.from({length: maxPalettes}, (_, i) => (i + 1).toString()), 'Moyenne'];
      let currentY = 55;

      // --- Move all data array definitions here ---
      // I) Contrôle Poids with REAL data
      const generateWeightRow = (field: string, label: string) => {
        const row = [label];
        for (let i = 0; i < maxPalettes; i++) {
          if (i < currentFormData.palettes.length && currentFormData.palettes[i][field]) {
            row.push(String(currentFormData.palettes[i][field] ?? ''));
          } else {
            row.push('');
          }
        }
        const average = calculateAverages(field);
        row.push(average);
        return row;
      };
      const weightData = [
        generateWeightRow('packageWeight', 'Poids du colis (kg)'),
        generateWeightRow('requiredNetWeight', 'Poids net requis (kg)'),
        (() => {
          const row = ['Poids net (%)'];
          for (let i = 0; i < maxPalettes; i++) {
            if (i < currentFormData.palettes.length) {
              const palette = getCurrentFormData().palettes[i];
              if (palette.packageWeight && palette.requiredNetWeight) {
                const weight = parseFloat(palette.packageWeight);
                const required = parseFloat(palette.requiredNetWeight);
                const percentage = ((weight - required) / required * 100).toFixed(2);
                row.push(percentage);
              } else {
                row.push('');
              }
            } else {
              row.push('');
            }
          }
          const validPercentages = currentFormData.palettes
            .filter((p: PaletteData) => p.packageWeight && p.requiredNetWeight)
            .map((p: PaletteData) => {
              const weight = parseFloat(p.packageWeight);
              const required = parseFloat(p.requiredNetWeight);
              return (weight - required) / required * 100;
            });
          const avgPercentage = validPercentages.length > 0 
            ? (validPercentages.reduce((a: number, b: number) => a + b, 0) / validPercentages.length).toFixed(2)
            : '';
          row.push(avgPercentage);
          return row;
        })()
      ];
      // II) Contrôle des caractéristiques minimales
      const generateDataRow = (field: string, label: string) => {
        const row = [label];
    for (let i = 0; i < maxPalettes; i++) {            if (i < currentFormData.palettes.length) {
      row.push(String(getCurrentFormData().palettes[i][field] ?? ''));
          } else {
            row.push('');
          }
        }
        
        // Fields that should have empty moyenne columns (like UI)
        const fieldsWithoutAverage = [
          'withered', 'temperature', 'odorOrTaste', 'homogeneity', 'size', 
          'packageCount', 'packagingState', 'labelingPresence', 'corners', 
          'horizontalStraps', 'paletteSheet', 'woodenPaletteState', 
          'internalLotNumber', 'paletteConformity'
        ];
        
        if (fieldsWithoutAverage.includes(field)) {
          row.push(''); // Empty moyenne column
        } else {
          row.push(calculateAverages(field)); // Calculate moyenne
        }
        
        return row;
      };
      const minCharData = [
        generateDataRow('firmness', 'Fermeté (kgf) [13-14]'),
        generateDataRow('rotting', 'Pourriture (anthracnose) (%)'),
        generateDataRow('foreignMatter', 'Matière étrangère visible (%)'),
        generateDataRow('withered', 'Flétri (C/NC)'),
        generateDataRow('hardenedEndoderm', 'Endoderme durci (%)'),
        generateDataRow('parasitePresence', 'Présence de parasite (%)'),
        generateDataRow('parasiteAttack', 'Attaque de parasite (%)'),
        generateDataRow('temperature', 'Température (C/NC)'),
        generateDataRow('odorOrTaste', 'Odeur ou saveur étrangère (C/NC)')
      ];
      // III) Contrôle des caractéristiques spécifiques
      const specCharData = [
        generateDataRow('shapeDefect', 'Défaut de forme (%)'),
        generateDataRow('colorDefect', 'Défaut de coloration (%)'),
        generateDataRow('epidermisDefect', 'Défaut d\'épiderme (%)'),
        generateDataRow('homogeneity', 'Homogénéité'),
        generateDataRow('missingBrokenGrains', 'Extrémité des grains (%)'),
        generateDataRow('size', 'Calibre')
      ];
      // IV) Contrôle du produit fini
      // Use only half the page width for this table
      const finalProductData = [
        generateDataRow('size', 'Calibre'),
        generateDataRow('packageCount', 'Nombre colis/palette'),
        generateDataRow('packagingState', 'État d\'emballage'),
        generateDataRow('labelingPresence', 'Présence d\'étiquetage'),
        generateDataRow('corners', 'Cornières'),
        generateDataRow('horizontalStraps', 'Feuillards horizontal'),
        generateDataRow('paletteSheet', 'Fiche palette'),
        generateDataRow('woodenPaletteState', 'État de la palette en bois'),
        generateDataRow('grossWeight', 'Poids Brut'),
        generateDataRow('netWeight', 'Poids Net'),
        generateDataRow('internalLotNumber', 'N° Lot Interne'),
        generateDataRow('paletteConformity', 'Conformité de la palette')
      ];

      // Patch drawEnhancedTable to allow custom tableWidth (50% for this table)
      const drawEnhancedTable50 = (
        doc: jsPDF,
        startY: number,
        headers: string[],
        data: (string | number)[][],
        hasAverageColumn: boolean = true,
        solidGreen: boolean = false
      ) => {
        let currentY = startY;
        const rowHeight = 5;
        const pageWidth = doc.internal.pageSize.getWidth();
        const tableWidth = (pageWidth - 20) * 0.5; // 50% width
        const headerBg: [number, number, number] = [230, 230, 230];
        const lightCol: [number, number, number] = [245, 245, 245];
        const alternateRow: [number, number, number] = [248, 248, 248];
        const borderColor: [number, number, number] = [64, 64, 64];
        const moyenneGreen: [number, number, number] = [144, 238, 144];
        let columnWidths;
        if (hasAverageColumn) {
          const firstColWidth = 60 * 0.5; // Decreased from 80 to 60, then halved for 50% table
          const avgColWidth = 25 * 0.5;
          const remainingWidth = tableWidth - firstColWidth - avgColWidth;
          const dataColWidth = remainingWidth / (headers.length - 2);
          columnWidths = [firstColWidth, ...Array(headers.length - 2).fill(dataColWidth), avgColWidth];
        } else {
          const equalWidth = tableWidth / headers.length;
          columnWidths = Array(headers.length).fill(equalWidth);
        }
        // Draw header
        doc.setFillColor(...headerBg);
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.5);
        doc.rect(10, currentY, tableWidth, rowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        let currentX = 10;
        headers.forEach((header, index) => {
          if (index === headers.length - 1 && hasAverageColumn) {
            doc.setFillColor(...moyenneGreen); // Always green for Moyenne column
            doc.rect(currentX, currentY, columnWidths[index], rowHeight, 'F');
            doc.setTextColor(0, 0, 0);
            const textWidth = doc.getTextWidth(header);
            doc.text(header, currentX + (columnWidths[index] / 2) - (textWidth / 2), currentY + 5.5);
            doc.setTextColor(0, 0, 0);
          } else {
            const textWidth = doc.getTextWidth(header);
            doc.text(header, currentX + (columnWidths[index] / 2) - (textWidth / 2), currentY + 5.5);
          }
          doc.line(currentX, currentY, currentX, currentY + rowHeight);
          currentX += columnWidths[index];
        });
        doc.line(currentX, currentY, currentX, currentY + rowHeight);
        currentY += rowHeight;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        data.forEach((row: (string | number)[], rowIndex: number) => {
          const isMoyenne = typeof row[0] === 'string' && row[0].toLowerCase().includes('moyenne');
          const shouldFill = isMoyenne ? true : rowIndex % 2 === 1;
          if (shouldFill) {
            doc.setFillColor(...(isMoyenne ? moyenneGreen : alternateRow));
            doc.rect(10, currentY, tableWidth, rowHeight, 'F');
          }
          let currentX = 10;
          row.forEach((cell: string | number, cellIndex: number) => {
            doc.setTextColor(0, 0, 0);
            // Always fill Moyenne column green
            if (cellIndex === row.length - 1 && hasAverageColumn) {
              doc.setFillColor(...moyenneGreen);
              doc.rect(currentX, currentY, columnWidths[cellIndex], rowHeight, 'F');
              doc.setFont('helvetica', isMoyenne ? 'bold' : 'normal');
            } else {
              doc.setFont('helvetica', isMoyenne ? 'bold' : 'normal');
            }
            let cellText = '';
            if (typeof cell === 'string' || typeof cell === 'number') {
              cellText = String(cell);
            }
            cellText = sanitizeText(safeText(cellText));
            if (cellIndex === 0) {
              const wrappedText = wrapText(doc, cellText, columnWidths[cellIndex] - 4);
              if (Array.isArray(wrappedText) && wrappedText.length > 0) {
                wrappedText.forEach((line, i) => {
                  doc.text(line, currentX + 2, currentY + 5.5 + i * 3.5);
                });
              } else if (typeof cellText === 'string' && cellText.trim() !== '') {
                doc.text(cellText, currentX + 2, currentY + 5.5);
              }
            } else {
              if (typeof cellText === 'string' && cellText.trim() !== '') {
                doc.text(cellText, currentX + (columnWidths[cellIndex] / 2) - (doc.getTextWidth(cellText) / 2), currentY + 5.5);
              }
            }
            doc.setDrawColor(...borderColor);
            const x1 = safeNumber(currentX);
            const y1 = safeNumber(currentY);
            const x2 = safeNumber(currentX);
            const y2 = safeNumber(currentY + rowHeight);
            doc.line(x1, y1, x2, y2);
            currentX += columnWidths[cellIndex];
          });
          // Draw borders
          const x1 = safeNumber(currentX);
          const y1 = safeNumber(currentY);
          const x2 = safeNumber(currentX);
          const y2 = safeNumber(currentY + rowHeight);
          doc.line(x1, y1, x2, y2);
          const bx1 = safeNumber(10);
          const by1 = safeNumber(currentY + rowHeight);
          const bx2 = safeNumber(10 + tableWidth);
          const by2 = safeNumber(currentY + rowHeight);
          doc.line(bx1, by1, bx2, by2);
          currentY += rowHeight;
        });
        return currentY + 5;
      };

      // V) Tolérance
      // Move these to the top of the function to avoid redeclaration
      const halfTableWidth = doc.internal.pageSize.getWidth() * 0.5;
      const drawToleranceTable = (
        doc: jsPDF,
        startY: number,
        headers: string[],
        data: (string | number)[][],
        customTableWidth: number | null = null
      ) => {
        let currentY = startY;
        const rowHeight = 8; // Reduced from 12 to 8 to fit within A4 page
        const pageWidth = doc.internal.pageSize.getWidth();
        const tableWidth = customTableWidth ?? (pageWidth - 20) * 0.5;
        const headerBg: [number, number, number] = [230, 230, 230];
        const alternateRow: [number, number, number] = [248, 248, 248];
        const borderColor: [number, number, number] = [64, 64, 64];
        const moyenneGreen: [number, number, number] = [144, 238, 144];
        
        // Custom column widths: Better balanced for content
        const toleranceColWidth = tableWidth * 0.50; // 50% for Tolérance column (longer text)
        const otherColWidth = tableWidth * 0.167; // ~16.7% for each other column (3 × 16.7% = 50%)
        const columnWidths = [toleranceColWidth, otherColWidth, otherColWidth, otherColWidth];
        
        // Draw header
        doc.setFillColor(...headerBg);
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.5);
        doc.rect(10, currentY, tableWidth, rowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        let currentX = 10;
        headers.forEach((header, index) => {
          const textWidth = doc.getTextWidth(header);
          doc.text(header, currentX + (columnWidths[index] / 2) - (textWidth / 2), currentY + rowHeight / 2 + 1.5);
          doc.line(currentX, currentY, currentX, currentY + rowHeight);
          currentX += columnWidths[index];
        });
        doc.line(currentX, currentY, currentX, currentY + rowHeight);
        currentY += rowHeight;
        // Draw data rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6); // Reduced from 7 to 6 for better fit in smaller rows
        data.forEach((row: (string | number)[], rowIndex: number) => {
          // Always make the 'Résultat moyen' cell green
          let currentX = 10;
          row.forEach((cell: string | number, cellIndex: number) => {
            if (cellIndex === 1) {
              doc.setFillColor(...moyenneGreen);
              doc.rect(currentX, currentY, columnWidths[cellIndex], rowHeight, 'F');
              doc.setFont('helvetica', 'bold');
            } else if (rowIndex % 2 === 1) {
              doc.setFillColor(...alternateRow);
              doc.rect(currentX, currentY, columnWidths[cellIndex], rowHeight, 'F');
              doc.setFont('helvetica', 'normal');
            } else {
              doc.setFont('helvetica', 'normal');
            }
            doc.setTextColor(0, 0, 0);
            let cellText = '';
            if (typeof cell === 'string' || typeof cell === 'number') {
              cellText = String(cell);
            }
            cellText = sanitizeText(safeText(cellText));
            if (cellIndex === 0) {
              const wrappedText = wrapText(doc, cellText, columnWidths[cellIndex] - 4);
              if (Array.isArray(wrappedText) && wrappedText.length > 0) {
                wrappedText.forEach((line, i) => {
                  doc.text(line, currentX + 2, currentY + 2.5 + i * 2.5);
                });
              } else if (typeof cellText === 'string' && cellText.trim() !== '') {
                doc.text(cellText, currentX + 2, currentY + rowHeight / 2 + 1.5);
              }
            } else {
              if (typeof cellText === 'string' && cellText.trim() !== '') {
                const textWidth = doc.getTextWidth(cellText);
                doc.text(cellText, currentX + (columnWidths[cellIndex] / 2) - (textWidth / 2), currentY + rowHeight / 2 + 1.5);
              }
            }
            doc.setDrawColor(...borderColor);
            const x1 = safeNumber(currentX);
            const y1 = safeNumber(currentY);
            const x2 = safeNumber(currentX);
            const y2 = safeNumber(currentY + rowHeight);
            doc.line(x1, y1, x2, y2);
            currentX += columnWidths[cellIndex];
          });
          // Draw borders
          const x1 = safeNumber(currentX);
          const y1 = safeNumber(currentY);
          const x2 = safeNumber(currentX);
          const y2 = safeNumber(currentY + rowHeight);
          doc.line(x1, y1, x2, y2);
          const bx1 = safeNumber(10);
          const by1 = safeNumber(currentY + rowHeight);
          const bx2 = safeNumber(10 + tableWidth);
          const by2 = safeNumber(currentY + rowHeight);
          doc.line(bx1, by1, bx2, by2);
          currentY += rowHeight;
        });
        return currentY + 5;
      };

      // --- Draw PDF tables for each section using the same data as the UI ---
      // I) Contrôle Poids (Page 1)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 139, 34);
      doc.text('I) Contrôle du poids du colis', 10, currentY);
      currentY += 8;
      currentY = drawEnhancedTable(doc, currentY, paletteHeaders, weightData);

      // II) Contrôle des caractéristiques minimales (Page 1)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 139, 34);
      doc.text('II) Contrôle des caractéristiques minimales', 10, currentY);
      currentY += 8;
      currentY = drawEnhancedTable(doc, currentY, paletteHeaders, minCharData);

      // --- New Page for the rest ---
      doc.addPage('landscape');
      let page2Y = 20;

      // Compact version of drawEnhancedTable for page 2
      const drawEnhancedTableCompact = (
        doc: jsPDF,
        startY: number,
        headers: string[],
        data: (string | number)[][],
        hasAverageColumn: boolean = true,
        solidGreen: boolean = false,
        customTableWidth: number | null = null
      ) => {
        let currentY = startY;
        const rowHeight = 6; // Reduced from 7 to 6 (+1px from original 5px)
        const pageWidth = doc.internal.pageSize.getWidth();
        const tableWidth = customTableWidth ?? (pageWidth - 20);
        const headerBg: [number, number, number] = [230, 230, 230];
        const lightCol: [number, number, number] = [245, 245, 245];
        const alternateRow: [number, number, number] = [248, 248, 248];
        const borderColor: [number, number, number] = [64, 64, 64];
        const moyenneGreen: [number, number, number] = [144, 238, 144];
        let columnWidths;
        if (hasAverageColumn) {
          const firstColWidth = 60; // Decreased from 80 to 60 to make it smaller
          const avgColWidth = 25;
          const remainingWidth = tableWidth - firstColWidth - avgColWidth;
          const dataColWidth = remainingWidth / (headers.length - 2);
          columnWidths = [firstColWidth, ...Array(headers.length - 2).fill(dataColWidth), avgColWidth];
        } else {
          const equalWidth = tableWidth / headers.length;
          columnWidths = Array(headers.length).fill(equalWidth);
        }

        // Draw header
        doc.setFillColor(...headerBg);
        doc.rect(10, currentY, tableWidth, rowHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        let currentX = 10;
        headers.forEach((header, index) => {
          if (index === headers.length - 1 && hasAverageColumn) {
            doc.setFillColor(...moyenneGreen);
            doc.rect(currentX, currentY, columnWidths[index], rowHeight, 'F');
          }
          const textY = currentY + rowHeight / 2 + 1;
          doc.text(header, currentX + columnWidths[index] / 2, textY, { align: 'center' });
          doc.line(currentX, currentY, currentX, currentY + rowHeight);
          currentX += columnWidths[index];
        });
        doc.line(currentX, currentY, currentX, currentY + rowHeight);
        currentY += rowHeight;

        // Draw data rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        data.forEach((row, rowIndex) => {
          if (rowIndex % 2 === 0) {
            doc.setFillColor(...alternateRow);
            doc.rect(10, currentY, tableWidth, rowHeight, 'F');
          }
          let currentX = 10;
          row.forEach((cell, cellIndex) => {
            if (cellIndex === row.length - 1 && hasAverageColumn) {
              doc.setFillColor(...moyenneGreen);
              doc.rect(currentX, currentY, columnWidths[cellIndex], rowHeight, 'F');
            }
            const textY = currentY + rowHeight / 2 + 1;
            doc.setTextColor(0, 0, 0);
            
            // Left-align first column text, center-align all others
            if (cellIndex === 0) {
              doc.text(String(cell), currentX + 2, textY);
            } else {
              doc.text(String(cell), currentX + columnWidths[cellIndex] / 2, textY, { align: 'center' });
            }
            
            doc.line(currentX, currentY, currentX, currentY + rowHeight);
            currentX += columnWidths[cellIndex];
          });
          doc.line(currentX, currentY, currentX, currentY + rowHeight);
          doc.line(10, currentY + rowHeight, 10 + tableWidth, currentY + rowHeight);
          currentY += rowHeight;
        });
        return currentY + 5;
      };

      // Move tolerance headers/data here for use on page 2
      const toleranceHeaders = ['Tolérance', 'Résultat moyen', 'Conforme', 'Non conforme'];
      // Calculate results as in the UI
      const minCharAvg = (() => {
        let sum = 0, count = 0;
        getCurrentFormData().palettes.forEach((p: PaletteData) => {
          const val =
            (parseFloat(p.rotting || '0') || 0) +
            (parseFloat(p.foreignMatter || '0') || 0) +
            (parseFloat(p.withered || '0') || 0) +
            (parseFloat(p.hardenedEndoderm || '0') || 0) +
            (parseFloat(p.parasitePresence || '0') || 0) +
            (parseFloat(p.parasiteAttack || '0') || 0);
          sum += val;
          count++;
        });
        return count ? (sum / count).toFixed(2) : '';
      })();
      const totalDefectsAvg = (() => {
        let sum = 0, count = 0;
        getCurrentFormData().palettes.forEach((p: PaletteData) => {
          const minChar =
            (parseFloat(p.rotting || '0') || 0) +
            (parseFloat(p.foreignMatter || '0') || 0) +
            (parseFloat(p.withered || '0') || 0) +
            (parseFloat(p.hardenedEndoderm || '0') || 0) +
            (parseFloat(p.parasitePresence || '0') || 0) +
            (parseFloat(p.parasiteAttack || '0') || 0);
          const catIDef =
            (parseFloat(p.shapeDefect || '0') || 0) +
            (parseFloat(p.colorDefect || '0') || 0) +
            (parseFloat(p.epidermisDefect || '0') || 0);
          sum += minChar + catIDef;
          count++;
        });
        return count ? (sum / count).toFixed(2) : '';
      })();
      const missingBrokenAvg = (() => {
        let sum = 0, count = 0;
        getCurrentFormData().palettes.forEach((p: PaletteData) => {
          sum += parseFloat(p.missingBrokenGrains || '0') || 0;
          count++;
        });
        return count ? (sum / count).toFixed(2) : '';
      })();
      const weightAvg = (() => {
        let sum = 0, count = 0;
        getCurrentFormData().palettes.forEach((p: PaletteData) => {
          const pw = Number(p.packageWeight || 0);
          const rw = Number(p.requiredNetWeight || 0);
          if (pw && rw) {
            sum += ((pw - rw) * 100) / pw;
            count++;
          }
        });
        return count ? (sum / count).toFixed(2) : '';
      })();
      const toleranceData = [
        ['Caractéristiques minimales (≤ 10%)', minCharAvg, '', ''],
        ['Total des défauts : catégorie I + caractéristiques minimales (≤ 10%)', totalDefectsAvg, '', ''],
        ['Extrémité des grains manques et cassées (≤ 10%)', missingBrokenAvg, '', ''],
        ['Poids selon le type d’emballage (poids net +1%)', weightAvg, '', '']
      ];

      // III) Contrôle des caractéristiques spécifiques (Page 2)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 139, 34);
      doc.text('III) Contrôle des caractéristiques spécifiques', 10, page2Y);
      page2Y += 6;
      page2Y = drawEnhancedTableCompact(doc, page2Y, paletteHeaders, specCharData);

      // IV) Contrôle du produit fini (Page 2)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 139, 34);
      doc.text('IV) Contrôle du produit fini', 10, page2Y);
      page2Y += 6;
      // Use full page width for the table
      page2Y = drawEnhancedTableCompact(doc, page2Y, [
        '',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '15',
        '16',
        '17',
        '18',
        '19',
        '20',
        '21',
        '22',
        '23',
        '24',
        '25',
        '26',
      "Moyenne"
      ], finalProductData, true);

      // V) Tolérance (Page 2)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 139, 34);
      doc.text('V) Tolérance et Conformité', 10, page2Y);
      page2Y += 6;
      page2Y = drawToleranceTable(doc, page2Y, toleranceHeaders, toleranceData, halfTableWidth);

      // Enhanced signature section (Page 2)
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const sigX = 15 + halfTableWidth + 20; // 20mm padding after table
      const sigY = page2Y - (toleranceData.length * 9 + 9); // align with table top (updated for row height 8)
      doc.text('Contrôleur:', sigX, sigY + 2);
      doc.text('Signature:', sigX, sigY + 20);
     
      
      // Save with enhanced filename
      const fileName = `Rapport_Qualite_${currentFormData.product || 'Produit'}_${currentFormData.date || new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setIsGenerating(false);
    }
  };

  // UI/UX: Helper for required fields
  const requiredFields = [
    'date', 'product', 'variety', 'campaign', 'clientLot',
    'shipmentNumber', 'packagingType', 'category', 'exporterNumber'
  ];

  // UI/UX: Validate required fields
  const validateForm = () => {
    const currentFormData = getCurrentFormData();
    const errors: {[key:string]: string} = {};
    
    requiredFields.forEach(field => {
      if (!currentFormData[field as keyof FormData]) {
        errors[field] = 'Ce champ est requis';
      }
    });
    
    setValidation(errors);
    return Object.keys(errors).length === 0;
  };

  // Upload images to Firebase Storage
  const uploadLotImages = async (lotId: string, images: File[]): Promise<string[]> => {
    if (images.length === 0) return [];
    
    setUploadingImages(prev => ({ ...prev, [lotId]: true }));
    
    try {
      const uploadPromises = images.map(image => 
        uploadQualityControlImage(image, lotId, 'lot')
      );
      
      const urls = await Promise.all(uploadPromises);
      return urls;
    } catch (error) {
      console.error('Error uploading images:', error);
      throw error;
    } finally {
      setUploadingImages(prev => ({ ...prev, [lotId]: false }));
    }
  };

  // Sync lot to Firebase
  const syncLotToFirebase = async (lot: QualityControlLot) => {
    try {
      setSyncStatus(prev => ({ ...prev, [lot.id]: 'pending' }));
      
      // Upload images first
      const currentLotImages = lotImages[lot.id] || [];
      const imageUrls = await uploadLotImages(lot.id, currentLotImages);
      
      // Prepare Firebase lot data
      const firebaseLot: FirebaseLot = {
        id: lot.id,
        lotNumber: lot.lotNumber,
        formData: lot.formData as QualityControlFormData,
        images: imageUrls,
        status: lot.status,
        phase: lot.phase,
        createdAt: lot.createdAt,
        updatedAt: new Date().toISOString(),
        controller: lot.controller,
        chief: lot.chief,
        chiefComments: lot.chiefComments,
        chiefApprovalDate: lot.chiefApprovalDate
      };
      
      // Save to Firebase
      const savedId = await saveQualityControlLot(firebaseLot);
      
      // Update local state
      setLots(prev => prev.map(l => 
        l.id === lot.id 
          ? { ...l, imageUrls, syncedToFirebase: true, id: savedId }
          : l
      ));
      
      setSyncStatus(prev => ({ ...prev, [lot.id]: 'synced' }));
      
      return savedId;
    } catch (error) {
      console.error('Error syncing lot to Firebase:', error);
      setSyncStatus(prev => ({ ...prev, [lot.id]: 'error' }));
      throw error;
    }
  };

  // Load lots from Firebase on mount
  useEffect(() => {
    const loadFirebaseLots = async () => {
      try {
        console.log('Loading lots from Firebase...');
        const firebaseLots = await getQualityControlLots('controller');
        console.log('Loaded', firebaseLots.length, 'lots from Firebase');
        
        const convertedLots: QualityControlLot[] = firebaseLots.map(lot => ({
          id: lot.id,
          lotNumber: lot.lotNumber,
          formData: lot.formData as FormData,
          images: [], // Local files are empty for Firebase lots
          imageUrls: lot.images,
          status: lot.status,
          phase: lot.phase,
          createdAt: lot.createdAt,
          updatedAt: lot.updatedAt,
          controller: lot.controller,
          chief: lot.chief,
          chiefComments: lot.chiefComments,
          chiefApprovalDate: lot.chiefApprovalDate,
          syncedToFirebase: true
        }));
        
        if (convertedLots.length > 0) {
          setLots(convertedLots);
          setActiveLotId(convertedLots[0].id);
          
          // Set sync status for all loaded lots
          const statusMap: {[key: string]: 'synced'} = {};
          convertedLots.forEach(lot => {
            statusMap[lot.id] = 'synced';
          });
          setSyncStatus(statusMap);
          
          console.log('Successfully loaded and set', convertedLots.length, 'lots');
        } else {
          console.log('No lots found in Firebase, creating first lot');
          // Only create new lot if no Firebase lots exist
          createNewLot();
        }
      } catch (error) {
        console.error('Error loading Firebase lots:', error);
        // If Firebase fails, still create a new lot for offline use
        if (lots.length === 0) {
          createNewLot();
        }
      }
    };
    
    // Only load from Firebase if no lots exist locally
    if (lots.length === 0) {
      loadFirebaseLots();
    }
  }, []);

  // Manual sync function to pull latest data from Firebase
  const handleSyncFromFirebase = async () => {
    try {
      console.log('Manually syncing from Firebase...');
      const firebaseLots = await getQualityControlLots('controller');
      
      const convertedLots: QualityControlLot[] = firebaseLots.map(lot => ({
        id: lot.id,
        lotNumber: lot.lotNumber,
        formData: lot.formData as FormData,
        images: [],
        imageUrls: lot.images,
        status: lot.status,
        phase: lot.phase,
        createdAt: lot.createdAt,
        updatedAt: lot.updatedAt,
        controller: lot.controller,
        chief: lot.chief,
        chiefComments: lot.chiefComments,
        chiefApprovalDate: lot.chiefApprovalDate,
        syncedToFirebase: true
      }));

      // Merge with existing local lots that might not be synced yet
      const localOnlyLots = lots.filter(lot => !lot.syncedToFirebase);
      const allLots = [...convertedLots, ...localOnlyLots];
      
      setLots(allLots);
      
      // Update sync status
      const statusMap: {[key: string]: 'synced' | 'pending' | 'error'} = {};
      convertedLots.forEach(lot => {
        statusMap[lot.id] = 'synced';
      });
      localOnlyLots.forEach(lot => {
        statusMap[lot.id] = syncStatus[lot.id] || 'pending';
      });
      setSyncStatus(statusMap);
      
      alert(`✅ Synchronisation réussie!\n\n📥 ${convertedLots.length} lots chargés depuis Firebase\n📱 ${localOnlyLots.length} lots locaux conservés\n📊 Total: ${allLots.length} lots`);
      
    } catch (error) {
      console.error('Error syncing from Firebase:', error);
      alert(`❌ Erreur de synchronisation:\n${(error as Error).message}\n\nVérifiez votre connexion et réessayez.`);
    }
  };

  // Initialize with first lot if none exist
  useEffect(() => {
    if (lots.length === 0) {
      createNewLot();
    }
  }, [lots.length]);

  // Save lot data and send to rapport section
  const handleSave = async () => {
    const currentLot = getCurrentLot();
    if (!currentLot) {
      alert('Aucun lot sélectionné.');
      return;
    }

    // Validate form data
    if (!validateForm()) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    try {
      // Show loading state
      setSyncStatus(prev => ({ ...prev, [currentLot.id]: 'pending' }));

      // Prepare comprehensive lot data with all details
      const comprehensiveFormData = {
        ...currentLot.formData,
        // Ensure all palette data is included
        palettes: currentLot.formData.palettes.map((palette, index) => ({
          ...palette,
          paletteIndex: index + 1,
          timestamp: new Date().toISOString()
        })),
        // Add calculated results
        calculatedResults: {
          minCharacteristics: results.minCharacteristics,
          totalDefects: results.totalDefects,
          missingBrokenGrains: results.missingBrokenGrains,
          weightConformity: results.weightConformity,
          isConform: results.isConform
        },
        // Add averages for all numeric fields
        averages: {
          firmness: calculateAverages('firmness'),
          rotting: calculateAverages('rotting'),
          foreignMatter: calculateAverages('foreignMatter'),
          hardenedEndoderm: calculateAverages('hardenedEndoderm'),
          parasitePresence: calculateAverages('parasitePresence'),
          parasiteAttack: calculateAverages('parasiteAttack'),
          packageWeight: calculateAverages('packageWeight'),
          shapeDefect: calculateAverages('shapeDefect'),
          colorDefect: calculateAverages('colorDefect'),
          epidermisDefect: calculateAverages('epidermisDefect'),
          missingBrokenGrains: calculateAverages('missingBrokenGrains'),
          grossWeight: calculateAverages('grossWeight'),
          netWeight: calculateAverages('netWeight'),
          requiredNetWeight: calculateAverages('requiredNetWeight')
        },
        // Add submission metadata
        submissionMetadata: {
          submittedBy: currentUser,
          submittedAt: new Date().toISOString(),
          paletteCount: paletteCount,
          activeTab: activeTab,
          browserInfo: navigator.userAgent,
          version: "2.0"
        }
      };

      // Update lot with comprehensive data and completed status
      const updatedLot = { 
        ...currentLot, 
        formData: comprehensiveFormData,
        status: 'completed' as const,
        controller: currentUser,
        updatedAt: new Date().toISOString()
      };

      // Update local state first
      updateLotData(activeLotId!, { 
        formData: comprehensiveFormData,
        status: 'completed',
        controller: currentUser,
        updatedAt: new Date().toISOString()
      });

      // Upload images and sync to Firebase
      const currentLotImages = lotImages[activeLotId!] || [];
      let imageUrls: string[] = [];
      
      if (currentLotImages.length > 0) {
        setUploadingImages(prev => ({ ...prev, [activeLotId!]: true }));
        try {
          imageUrls = await uploadLotImages(activeLotId!, currentLotImages);
          console.log('Images uploaded successfully:', imageUrls);
        } catch (imageError) {
          console.error('Error uploading images:', imageError);
          alert('Avertissement: Erreur lors du téléchargement des images, mais les données ont été sauvegardées.');
        } finally {
          setUploadingImages(prev => ({ ...prev, [activeLotId!]: false }));
        }
      }

      // Prepare Firebase lot data with all details
      const firebaseLot: FirebaseLot = {
        id: currentLot.id,
        lotNumber: currentLot.lotNumber,
        formData: comprehensiveFormData as QualityControlFormData,
        images: imageUrls,
        status: 'completed',
        phase: currentLot.phase || 'controller',
        createdAt: currentLot.createdAt,
        updatedAt: new Date().toISOString(),
        controller: currentUser,
        chief: currentLot.chief,
        chiefComments: currentLot.chiefComments,
        chiefApprovalDate: currentLot.chiefApprovalDate
      };
      
      // Save to Firebase with detailed error handling
      try {
        const savedId = await saveQualityControlLot(firebaseLot);
  console.log('Lot saved to Firebase with ID:', savedId);
  // Mirror form data into the selected shared lot so it persists per-lot
  await saveCurrentToSharedLot(comprehensiveFormData as FormData);
        
        // Update local state with Firebase ID and sync status
        setLots(prev => prev.map(l => 
          l.id === currentLot.id 
            ? { ...l, imageUrls, syncedToFirebase: true, id: savedId }
            : l
        ));
        
        setSyncStatus(prev => ({ ...prev, [currentLot.id]: 'synced' }));

        // Save to localStorage for backward compatibility
        const rapportData = {
          ...updatedLot,
          images: currentLotImages,
          imageUrls: imageUrls,
          submittedAt: new Date().toISOString(),
          firebaseId: savedId
        };

        const existingRapports = JSON.parse(localStorage.getItem('quality_rapports') || '[]');
        // Remove any existing report with the same lot ID to avoid duplicates
        const filteredRapports = existingRapports.filter((r: any) => r.id !== currentLot.id);
        filteredRapports.push(rapportData);
        localStorage.setItem('quality_rapports', JSON.stringify(filteredRapports));

        // Show success message with details
        alert(`✅ Lot "${currentLot.lotNumber}" sauvegardé avec succès!\n\n` +
              `📋 Données: ${Object.keys(comprehensiveFormData).length} champs\n` +
              `🎯 Palettes: ${paletteCount} palettes analysées\n` +
              `📷 Images: ${imageUrls.length} images téléchargées\n` +
              `☁️ Firebase: Synchronisé avec ID ${savedId}\n` +
              `📊 Conformité: ${results.isConform ? 'Conforme' : 'Non conforme'}`);

        // Update filtered rapports to show current lot
        setFilteredRapports([comprehensiveFormData]);

      } catch (firebaseError) {
        console.error('Error saving to Firebase:', firebaseError);
        setSyncStatus(prev => ({ ...prev, [currentLot.id]: 'error' }));
        
        // Still save to localStorage as backup
        const rapportData = {
          ...updatedLot,
          images: currentLotImages,
          submittedAt: new Date().toISOString(),
          firebaseError: (firebaseError as Error).message
        };

        const existingRapports = JSON.parse(localStorage.getItem('quality_rapports') || '[]');
        const filteredRapports = existingRapports.filter((r: any) => r.id !== currentLot.id);
        filteredRapports.push(rapportData);
        localStorage.setItem('quality_rapports', JSON.stringify(filteredRapports));

        alert(`⚠️ Données sauvegardées localement mais erreur Firebase:\n${(firebaseError as Error).message}\n\nUtilisez le bouton de resynchronisation pour réessayer.`);
      }

    } catch (error) {
      console.error('Error saving lot:', error);
      setSyncStatus(prev => ({ ...prev, [currentLot.id]: 'error' }));
      alert(`❌ Erreur lors de la sauvegarde:\n${(error as Error).message}\n\nVérifiez votre connexion et réessayez.`);
    }
  };

  // Submit all lots to archive
  const handleSubmitAllLots = () => {
    const completedLots = lots.filter((lot: QualityControlLot) => lot.status === 'completed');
    
    if (completedLots.length === 0) {
      alert('Aucun lot complété à soumettre.');
      return;
    }

    // Prepare data for archive
    const archiveData = completedLots.map((lot: QualityControlLot) => ({
      id: lot.id,
      lotId: lot.lotNumber,
      date: lot.formData.date,
      controller: 'Quality Controller', // You might want to get this from user context
      chief: 'Quality Chief',
      calibres: lot.formData.palettes.map((p: PaletteData) => p.size || 'N/A'),
      images: lotImages[lot.id] || [],
      testResults: lot.formData,
      pdfController: null,
      pdfChief: null,
      status: 'completed',
      submittedAt: new Date().toISOString()
    }));

    // Save to archive
    const existingArchives = JSON.parse(localStorage.getItem('archived_reports') || '[]');
    existingArchives.push(...archiveData);
    localStorage.setItem('archived_reports', JSON.stringify(existingArchives));

    // Update lot status to submitted
    completedLots.forEach((lot: QualityControlLot) => {
      updateLotData(lot.id, { status: 'submitted' });
    });

    alert(`${completedLots.length} lot(s) soumis avec succès vers l'archive!`);
  };

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && activeLotId) {
      const newImages = Array.from(files);
      setLotImages(prev => ({
        ...prev,
        [activeLotId]: [...(prev[activeLotId] || []), ...newImages]
      }));
    }
  };

  // Remove image
  const removeImage = (imageIndex: number) => {
    if (!activeLotId) return;
    setLotImages(prev => ({
      ...prev,
      [activeLotId]: (prev[activeLotId] || []).filter((_, index) => index !== imageIndex)
    }));
  };

  // Show conformity summary bar
  const conformityColor = results.isConform ? 'bg-green-100 border-green-400 text-green-800' : 'bg-red-100 border-red-400 text-red-800';
  const conformityText = results.isConform ? 'Conforme' : 'Non conforme';

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100">

      {/* Main content area */}
      <div className="flex-1 p-6 overflow-auto transition-all duration-300">
        <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-md p-6">
          {/* Multi-lots (Qualité) - persisted in shared_lots */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-gray-800">Suivi de la production - Multi-lots (Qualité)</h2>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={handleCreateQualitySharedLot}
                disabled={creatingQualityLot}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Nouveau Lot
              </button>
              <input
                value={newQualityLotNumber}
                onChange={(e) => setNewQualityLotNumber(e.target.value)}
                placeholder="Saisir numéro de lot (optionnel)"
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {/* Prev/Next navigation */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!activeQualitySharedLotId || qualitySharedLots.length === 0) return;
                    const idx = qualitySharedLots.findIndex(l => l.id === activeQualitySharedLotId);
                    const prev = idx > 0 ? qualitySharedLots[idx - 1] : null;
                    if (prev) selectQualitySharedLot(prev);
                  }}
                  className="px-3 py-2 border rounded hover:bg-gray-50"
                >
                  ◀ Précédent
                </button>
                <button
                  onClick={() => {
                    if (!activeQualitySharedLotId || qualitySharedLots.length === 0) return;
                    const idx = qualitySharedLots.findIndex(l => l.id === activeQualitySharedLotId);
                    const next = idx >= 0 && idx < qualitySharedLots.length - 1 ? qualitySharedLots[idx + 1] : null;
                    if (next) selectQualitySharedLot(next);
                  }}
                  className="px-3 py-2 border rounded hover:bg-gray-50"
                >
                  Suivant ▶
                </button>
              </div>
              {activeQualitySharedLotId && (
                <button
                  onClick={async () => {
                    const current = getCurrentLot();
                    if (!current || !activeQualitySharedLotId) return;
                    try {
                      // Save/merge current QC header back to shared_lots qualityData
                      const headerData = {
                        date: current.formData.date,
                        produit: current.formData.product,
                        numeroLotClient: current.formData.clientLot
                      };
                      await sharedLotService.updateLot(activeQualitySharedLotId, {
                        qualityData: {
                          ...(sharedLots.find(l => l.id === activeQualitySharedLotId)?.qualityData || {}),
                          headerData
                        }
                      } as any);
                      alert('Données lot qualité sauvegardées.');
                    } catch (err) {
                      console.error('Save to shared_lots failed', err);
                      alert('Échec de la sauvegarde vers shared_lots.');
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                >
                  Sauvegarder ce lot (Qualité)
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {qualitySharedLots.map((sl) => (
                <div
                  key={sl.id}
                  className={`text-left border rounded-lg p-4 bg-gray-50 transition shadow-sm ${activeQualitySharedLotId === sl.id ? 'ring-2 ring-blue-500 bg-white' : 'hover:bg-white'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500">Lot</div>
                      {renamingLotId === sl.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            className="border rounded px-2 py-1 text-sm"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                          />
                          <button
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded"
                            onClick={() => handleRenameSharedLot(sl, renameValue.trim())}
                          >
                            Enregistrer
                          </button>
                          <button
                            className="text-xs bg-gray-200 px-2 py-1 rounded"
                            onClick={() => { setRenamingLotId(null); setRenameValue(''); }}
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <div className="text-lg font-semibold">{sl.lotNumber}</div>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                      {sl.status || 'brouillon'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleOpenSharedLot(sl)}
                      className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
                    >
                      Ouvrir
                    </button>
                    <button
                      onClick={() => handleOpenAndDownload(sl)}
                      className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
                      title="Ouvrir et télécharger le PDF"
                    >
                      Télécharger
                    </button>
                    <button
                      onClick={() => { setRenamingLotId(sl.id); setRenameValue(sl.lotNumber); }}
                      className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
                    >
                      Renommer
                    </button>
                    <button
                      onClick={() => handleDeleteSharedLot(sl)}
                      className="text-sm px-3 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
              {qualitySharedLots.length === 0 && (
                <div className="text-gray-500 text-sm">Aucun lot qualité pour le moment.</div>
              )}
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            CONTROLE DE LA QUALITE DU PRODUIT FINAL
            <Tooltip title="Ce formulaire permet de contrôler la qualité des produits avant expédition.">
              <InfoOutlinedIcon className="text-blue-400" fontSize="small" />
            </Tooltip>
          </h1>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={handleGenerateReport}
              className="px-5 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 font-semibold transition"
              disabled={isGenerating}
              title="Générer un rapport PDF"
            >
              {isGenerating ? (
                <>
                  <Upload className="w-4 h-4 inline mr-2 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 inline mr-2" />
                  Générer PDF
                </>
              )}
            </button>
            
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 focus:ring-2 focus:ring-green-400 font-semibold transition"
              title="Sauvegarder et synchroniser avec Firebase"
            >
              <Save className="w-4 h-4 inline mr-2" />
              Sauvegarder
            </button>
            {activeQualitySharedLotId && (
              <button
                onClick={async () => {
                  // Persist current working form back into the selected shared lot
                  try {
                    await saveCurrentToSharedLot();
                    alert('Données du lot synchronisées avec Multi-lots (Qualité).');
                  } catch {}
                }}
                className="px-5 py-2 bg-emerald-600 text-white rounded shadow hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-400 font-semibold transition"
                title="Sauvegarder ce lot vers Multi-lots"
              >
                <Save className="w-4 h-4 inline mr-2" />
                Sync ce lot
              </button>
            )}
            
            <button
              onClick={handleSyncFromFirebase}
              className="px-5 py-2 bg-cyan-600 text-white rounded shadow hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-400 font-semibold transition"
              title="Synchroniser depuis Firebase"
            >
              <Cloud className="w-4 h-4 inline mr-2" />
              Sync Firebase
            </button>
            
            <button
              onClick={handleSubmitAllLots}
              className="px-5 py-2 bg-purple-600 text-white rounded shadow hover:bg-purple-700 focus:ring-2 focus:ring-purple-400 font-semibold transition"
              title="Soumettre tous les lots complétés"
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Soumettre lots
            </button>
            
            <button
              onClick={() => {
                // Clear all cached data
                setLots([]);
                setActiveLotId(null);
                setActiveTab(0);
                setPaletteCount(1);
                setSyncStatus({});
                setUploadingImages({});
                setValidation({});
                setFilteredRapports([]);
                setLotImages({});
                setResults({
                  minCharacteristics: 0,
                  totalDefects: 0,
                  missingBrokenGrains: 0,
                  weightConformity: 0,
                  isConform: false
                });
                
                // Clear localStorage cache if any
                localStorage.removeItem('qualityControlCache');
                localStorage.removeItem('qualityControlLots');
                
                // Show success message
                alert('Cache vidé avec succès!');
              }}
              className="px-5 py-2 bg-red-600 text-white rounded shadow hover:bg-red-700 focus:ring-2 focus:ring-red-400 font-semibold transition"
              title="Vider le cache de la page"
            >
              <Trash2 className="w-4 h-4 inline mr-2" />
              Vider Cache
            </button>
            
            {/* Manual sync button */}
            {getCurrentLot() && syncStatus[getCurrentLot()!.id] === 'error' && (
              <button
                onClick={() => getCurrentLot() && syncLotToFirebase(getCurrentLot()!)}
                className="px-5 py-2 bg-orange-600 text-white rounded shadow hover:bg-orange-700 focus:ring-2 focus:ring-orange-400 font-semibold transition"
                disabled={uploadingImages[getCurrentLot()!.id]}
                title="Resynchroniser avec Firebase"
              >
                {uploadingImages[getCurrentLot()!.id] ? (
                  <>
                    <Upload className="w-4 h-4 inline mr-2 animate-spin" />
                    Sync...
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4 inline mr-2" />
                    Sync Firebase
                  </>
                )}
              </button>
            )}
          </div>

          {/* Display exact rapports for the current lot after save */}
          {filteredRapports.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4 text-green-700 border-b pb-2">Rapports pour le lot : {getCurrentFormData().clientLot}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {filteredRapports.map((rapport, idx) => (
                  <div key={idx} className="mb-4 p-4 border rounded-lg bg-gray-50 shadow-sm">
                    <div className="font-medium mb-2">Date: {rapport.date} | Produit: {rapport.product} | Variété: {rapport.variety}</div>
                    <div className="mb-2">Calibres dans ce rapport :</div>
                    <div className="flex flex-wrap gap-2">
                      {rapport.palettes.map((p, i) => (
                        <span key={i} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {p.size || 'N/A'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab navigation */}
          <div className="border-b border-gray-200 mb-6">
            <div className="flex flex-wrap -mb-px">
              {tabTitles.map((title, index) => (
                <button
                  key={index}
                  className={`inline-block py-2 px-4 font-medium text-sm rounded-t-lg transition-all duration-200 ${
                    activeTab === index 
                      ? 'text-blue-600 border-b-2 border-blue-600 active bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab(index)}
                >
                  {title}
                </button>
              ))}
            </div>
          </div>
          {/* Tab content */}
          <div className="py-4 transition-all duration-300">
            {/* Basic Information Tab */}
            {activeTab === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      Date
                      <Tooltip title="Date du contrôle."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                    </label>
                    <input
                      type="date"
                      value={getCurrentFormData().date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md ${validation.date ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {validation.date && <span className="text-xs text-red-500">{validation.date}</span>}
                  </div>
                  {/* Product */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      Produit
                      <Tooltip title="Nom du produit contrôlé."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                    </label>
                    <input
                      type="text"
                      value={getCurrentFormData().product}
                      onChange={(e) => handleInputChange('product', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md ${validation.product ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {validation.product && <span className="text-xs text-red-500">{validation.product}</span>}
                  </div>
                  {/* Variety */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      Variété
                      <Tooltip title="Variété du produit."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                    </label>
                    <input
                      type="text"
                      value={getCurrentFormData().variety}
                      onChange={(e) => handleInputChange('variety', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md ${validation.variety ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {validation.variety && <span className="text-xs text-red-500">{validation.variety}</span>}
                  </div>
                  {/* Campaign */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      Campagne
                      <Tooltip title="Campagne de production."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                    </label>
                    <input
                      type="text"
                      value={getCurrentFormData().campaign}
                      onChange={(e) => handleInputChange('campaign', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md ${validation.campaign ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {validation.campaign && <span className="text-xs text-red-500">{validation.campaign}</span>}
                  </div>
                  {/* Client Lot */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      Lot client
                      <Tooltip title="Identifiant du lot client."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                    </label>
                    <input
                      type="text"
                      value={getCurrentFormData().clientLot}
                      onChange={(e) => handleInputChange('clientLot', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md ${validation.clientLot ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {validation.clientLot && <span className="text-xs text-red-500">{validation.clientLot}</span>}
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Shipment Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      N° Expédition
                      <Tooltip title="Numéro d'expédition."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                    </label>
                    <input
                      type="text"
                      value={getCurrentFormData().shipmentNumber}
                      onChange={(e) => handleInputChange('shipmentNumber', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md ${validation.shipmentNumber ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {validation.shipmentNumber && <span className="text-xs text-red-500">{validation.shipmentNumber}</span>}
                  </div>
                  {/* Packaging Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      Type emballage
                      <Tooltip title="Type d'emballage utilisé."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                    </label>
                    <input
                      type="text"
                      value={getCurrentFormData().packagingType}
                      onChange={(e) => handleInputChange('packagingType', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md ${validation.packagingType ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {validation.packagingType && <span className="text-xs text-red-500">{validation.packagingType}</span>}
                  </div>
                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      Catégorie
                      <Tooltip title="Catégorie du produit."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                    </label>
                    <input
                      type="text"
                      value={getCurrentFormData().category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md ${validation.category ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {validation.category && <span className="text-xs text-red-500">{validation.category}</span>}
                  </div>
                  {/* Exporter Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      N° Exportateur
                      <Tooltip title="Numéro d'exportateur."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                    </label>
                    <input
                      type="text"
                      value={getCurrentFormData().exporterNumber}
                      onChange={(e) => handleInputChange('exporterNumber', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md ${validation.exporterNumber ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {validation.exporterNumber && <span className="text-xs text-red-500">{validation.exporterNumber}</span>}
                  </div>
                  {/* Frequency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      Fréquence
                      <Tooltip title="Fréquence de contrôle."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                    </label>
                    <input
                      type="text"
                      value={getCurrentFormData().frequency}
                      onChange={(e) => handleInputChange('frequency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      Nombre de palettes
                      <Tooltip title="Nombre de palettes à contrôler (max 26)."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="number"
                        min="1"
                        max="26"
                        value={paletteCount}
                        onChange={(e) => setPaletteCount(parseInt(e.target.value) || 1)}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <span className="text-sm text-gray-500">(Max: 26)</span>
                    </div>
                  </div>
                </div>
                
  
              </div>
            )}
            
            {/* Controle poids Tab */}
            {activeTab === 1 && (
              <div className="mb-10">
                <h2 className="text-xl font-bold text-green-700 mb-4 border-b pb-2 flex items-center gap-2">
                  I) Contrôle du poids du colis
                  <Tooltip title="Vérification du poids de chaque palette."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                </h2>
                <div className="overflow-x-auto border rounded-lg shadow-md">
                  <table className="bg-white border-collapse" style={{ minWidth: `${Math.max(800, 64 + (paletteCount * 80) + 80)}px` }}>
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-green-100">
                      <th className="py-2 px-3 border sticky left-0 bg-green-100 z-30 w-64 min-w-64">Paramètre</th>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <th key={i} className="py-2 px-3 border bg-white text-center w-20 min-w-20">{i+1}</th>
                      ))}
                      <th className="py-2 px-3 border bg-green-200 w-20 min-w-20">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Poids du colis (kg) */}
                    <tr className="even:bg-gray-50 transition-all">
                      <td className="py-2 px-3 border sticky left-0 bg-white z-20 font-medium w-64 min-w-64">Poids du colis (kg)</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border w-20 min-w-20">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.packageWeight || ''}
                            onChange={(e) => handlePaletteChange(i, 'packageWeight', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                            placeholder="0.0"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium bg-green-50 text-center w-20 min-w-20">{calculateAverages('packageWeight')}</td>
                    </tr>
                    {/* Poids net requis (kg) */}
                    <tr className="even:bg-gray-50 transition-all">
                      <td className="py-2 px-3 border sticky left-0 bg-white z-20 font-medium w-64 min-w-64">Poids net requis (kg)</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border w-20 min-w-20">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.requiredNetWeight || ''}
                            onChange={(e) => handlePaletteChange(i, 'requiredNetWeight', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                            placeholder=""
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium bg-green-50 text-center w-20 min-w-20">{calculateAverages('requiredNetWeight')}</td>
                    </tr>
                    {/* Poids net (%) - Calculated field */}
                    <tr className="even:bg-gray-50 transition-all">
                      <td className="py-2 px-3 border sticky left-0 bg-white z-20 font-medium w-64 min-w-64">Poids net (%)</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-2 px-3 border text-center bg-gray-100 w-20 min-w-20">
                          {(() => {
                            const weight = parseFloat(getCurrentFormData().palettes[i]?.packageWeight || '0');
                            const required = parseFloat(getCurrentFormData().palettes[i]?.requiredNetWeight || '0');
                            if (weight && required) {
                              return ((weight - required) / required * 100).toFixed(2);
                            }
                            return '';
                        })()}
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium w-20 min-w-20">
                        
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
            )}
            

            {/* Controle des Caracteristiques minimales Tab */}
            {activeTab === 2 && (
              <div className="mb-10">
                <h2 className="text-xl font-bold text-green-700 mb-4 border-b pb-2 flex items-center gap-2">
                  II) Contrôle des caractéristiques minimales
                  <Tooltip title="Vérification des caractéristiques minimales de chaque palette."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                </h2>
                <div className="overflow-x-auto border rounded-lg shadow-md">
                  <table className="bg-white border-collapse" style={{ minWidth: `${Math.max(800, 64 + (paletteCount * 80) + 80)}px` }}>
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-green-100">
                      <th className="py-2 px-3 border sticky left-0 bg-green-100 z-30 w-64 min-w-64">Paramètre</th>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <th key={i} className="py-2 px-3 border bg-white text-center w-20 min-w-20">{i+1}</th>
                      ))}
                      <th className="py-2 px-3 border bg-green-200 w-20 min-w-20">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Firmness (kgf) [13-14] (string input with Moyenne) */}
                    <tr>
                      <td className="py-2 px-3 border sticky left-0 bg-white z-20 font-medium w-64 min-w-64">Firmness (kgf) [13-14]</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border w-20 min-w-20">
                          <input
                            type="text"
                            value={getCurrentFormData().palettes[i]?.firmness || ''}
                            onChange={(e) => handlePaletteChange(i, 'firmness', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium w-20 min-w-20">
                        {calculateAverages('firmness')}
                      </td>
                    </tr>
                    {/* Pourriture (anthracnose) (%) */}
                    <tr>
                      <td className="py-2 px-3 border sticky left-0 bg-white z-20 font-medium w-64 min-w-64">Pourriture (anthracnose) (%)</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border w-20 min-w-20">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.rotting || ''}
                            onChange={(e) => handlePaletteChange(i, 'rotting', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium w-20 min-w-20">
                        {calculateAverages('rotting')}
                      </td>
                    </tr>
                    {/* Matière étrangère visible (sable, les cheveux, ...) (%) */}
                    <tr>
                      <td className="py-2 px-3 border sticky left-0 bg-white z-10 font-medium w-64 min-w-64">Matière étrangère visible (sable, les cheveux, ...) (%)</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.foreignMatter || ''}
                            onChange={(e) => handlePaletteChange(i, 'foreignMatter', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium w-20 min-w-20">
                        {calculateAverages('foreignMatter')}
                      </td>
                    </tr>
                    {/* Flétri (C/NC) */}
                    <tr>
                      <td className="py-2 px-3 border sticky left-0 bg-white z-10 font-medium w-64 min-w-64">Flétri</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <select
                            value={getCurrentFormData().palettes[i]?.withered || ''}
                            onChange={(e) => handlePaletteChange(i, 'withered', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          >
                            <option value="">--</option>
                            <option value="C">Conforme</option>
                            <option value="NC">Non Conforme</option>
                          </select>
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                    {/* Endoderme durci (%) */}
                    <tr>
                      <td className="py-2 px-3 border sticky left-0 bg-white z-10 font-medium w-64 min-w-64">Endoderme durci (%)</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.hardenedEndoderm || ''}
                            onChange={(e) => handlePaletteChange(i, 'hardenedEndoderm', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium w-20 min-w-20">
                        {calculateAverages('hardenedEndoderm')}
                      </td>
                    </tr>
                    {/* Présence de parasite (%) */}
                    <tr>
                      <td className="py-2 px-3 border sticky left-0 bg-white z-10 font-medium w-64 min-w-64">Présence de parasite (%)</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.parasitePresence || ''}
                            onChange={(e) => handlePaletteChange(i, 'parasitePresence', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium w-20 min-w-20">
                        {calculateAverages('parasitePresence')}
                      </td>
                    </tr>
                    {/* Présence d’attaque de parasite (%) */}
                    <tr>
                      <td className="py-2 px-3 border sticky left-0 bg-white z-10 font-medium">Présence d’attaque de parasite (%)</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.parasiteAttack || ''}
                            onChange={(e) => handlePaletteChange(i, 'parasiteAttack', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium w-20 min-w-20">
                        {calculateAverages('parasiteAttack')}
                      </td>
                    </tr>
                    {/* Température (C/NC) */}
                    <tr>
                      <td className="py-2 px-3 border sticky left-0 bg-white z-10 font-medium w-64 min-w-64">Température</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <select
                            value={getCurrentFormData().palettes[i]?.temperature || ''}
                            onChange={(e) => handlePaletteChange(i, 'temperature', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          >
                            <option value="">--</option>
                            <option value="C">Conforme</option>
                            <option value="NC">Non Conforme</option>
                          </select>
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                    {/* Odeur ou saveur d’étranger (C/NC) */}
                    <tr>
                      <td className="py-2 px-3 border sticky left-0 bg-white z-10 font-medium">Odeur ou saveur d’étranger</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <select
                            value={getCurrentFormData().palettes[i]?.odorOrTaste || ''}
                            onChange={(e) => handlePaletteChange(i, 'odorOrTaste', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          >
                            <option value="">--</option>
                            <option value="C">Conforme</option>
                            <option value="NC">Non Conforme</option>
                          </select>
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium w-20 min-w-20"></td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
            )}
            
            {/* Controle des Parametres Categorie I Tab */}
            {activeTab === 3 && (
              <div className="overflow-x-auto mb-10">
                <h2 className="text-xl font-bold text-green-700 mb-4 border-b pb-2 flex items-center gap-2">
                  III) Contrôle des caractéristiques spécifiques
                  <Tooltip title="Vérification des caractéristiques spécifiques de chaque palette."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                </h2>
                <table className="min-w-full bg-white border-collapse rounded-lg shadow-md">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-green-100">
                      <th className="py-2 px-3 border w-64 min-w-64">Paramètre</th>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <th key={i} className="py-2 px-3 border">Palette {i + 1}</th>
                      ))}
                      <th className="py-2 px-3 border bg-green-200">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Défaut de forme (Moyenne) */}
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Défaut de forme</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.shapeDefect || ''}
                            onChange={(e) => handlePaletteChange(i, 'shapeDefect', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium">{calculateAverages('shapeDefect')}</td>
                    </tr>
                    {/* Défaut de coloration (Moyenne) */}
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Défaut de coloration</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.colorDefect || ''}
                            onChange={(e) => handlePaletteChange(i, 'colorDefect', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium">{calculateAverages('colorDefect')}</td>
                    </tr>
                    {/* Défaut d'épiderme (Moyenne) */}
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Défaut d'épiderme</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.epidermisDefect || ''}
                            onChange={(e) => handlePaletteChange(i, 'epidermisDefect', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium">{calculateAverages('epidermisDefect')}</td>
                    </tr>
                    {/* Homogénéité (C/NC) */}
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Homogénéité (C/NC)</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="text"
                            value={getCurrentFormData().palettes[i]?.homogeneity || ''}
                            onChange={(e) => handlePaletteChange(i, 'homogeneity', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                    {/* Extrémité des grains (Moyenne) */}
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Extrémité des grains</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.corners || ''}
                            onChange={(e) => handlePaletteChange(i, 'corners', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium">{calculateAverages('corners')}</td>
                    </tr>
                    {/* Manque et cassés */}
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Manque et cassés</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.missingBrokenGrains || ''}
                            onChange={(e) => handlePaletteChange(i, 'missingBrokenGrains', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium">{calculateAverages('missingBrokenGrains')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Calibre</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.size || ''}
                            onChange={(e) => handlePaletteChange(i, 'size', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Controle Produit Fini Tab */}
            {activeTab === 4 && (
              <div className="overflow-x-auto mb-10">
                <h2 className="text-xl font-bold text-green-700 mb-4 border-b pb-2 flex items-center gap-2">
                  IV) Contrôle du produit fini
                  <Tooltip title="Vérification des informations du produit fini."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                </h2>
                <table className="min-w-full bg-white border-collapse rounded-lg shadow-md">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-green-100">
                      <th className="py-2 px-3 border w-64 min-w-64">Paramètre</th>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <th key={i} className="py-2 px-3 border">Palette {i + 1}</th>
                      ))}
                      <th className="py-2 px-3 border bg-green-200">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Calibre</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.size || ''}
                            onChange={(e) => handlePaletteChange(i, 'size', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Nombre colis/palette</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.packageCount || ''}
                            onChange={(e) => handlePaletteChange(i, 'packageCount', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                            placeholder=""
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">État d'emballage</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="text"
                            value={getCurrentFormData().palettes[i]?.packagingState || ''}
                            onChange={(e) => handlePaletteChange(i, 'packagingState', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Présence d'étiquetage</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="text"
                            value={getCurrentFormData().palettes[i]?.labelingPresence || ''}
                            onChange={(e) => handlePaletteChange(i, 'labelingPresence', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Cornières</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="text"
                            value={getCurrentFormData().palettes[i]?.corners || ''}
                            onChange={(e) => handlePaletteChange(i, 'corners', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Feuillards horizontal</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="text"
                            value={getCurrentFormData().palettes[i]?.horizontalStraps || ''}
                            onChange={(e) => handlePaletteChange(i, 'horizontalStraps', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Fiche palette</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="text"
                            value={getCurrentFormData().palettes[i]?.paletteSheet || ''}
                            onChange={(e) => handlePaletteChange(i, 'paletteSheet', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium bg-gray-100"></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">État de la palette en bois</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="text"
                            value={getCurrentFormData().palettes[i]?.woodenPaletteState || ''}
                            onChange={(e) => handlePaletteChange(i, 'woodenPaletteState', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Poids Brut</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.grossWeight || ''}
                            onChange={(e) => handlePaletteChange(i, 'grossWeight', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                            placeholder=""
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium">{calculateAverages('grossWeight')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Poids Net</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="number"
                            min="0"
                            value={getCurrentFormData().palettes[i]?.netWeight || ''}
                            onChange={(e) => handlePaletteChange(i, 'netWeight', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                            placeholder=""
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium">{calculateAverages('netWeight')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">N° Lot Interne</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="text"
                            value={getCurrentFormData().palettes[i]?.internalLotNumber || ''}
                            onChange={(e) => handlePaletteChange(i, 'internalLotNumber', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium bg-gray-100"></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 border w-64 min-w-64">Conformité de la palette</td>
                      {Array.from({ length: paletteCount }).map((_, i) => (
                        <td key={i} className="py-1 px-2 border">
                          <input
                            type="text"
                            value={getCurrentFormData().palettes[i]?.paletteConformity || ''}
                            onChange={(e) => handlePaletteChange(i, 'paletteConformity', e.target.value)}
                            className="w-full p-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border font-medium"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Tolérance Tab */}
            {activeTab === 5 && (
              <div className="overflow-x-auto mb-10">
                <h2 className="text-xl font-bold text-green-700 mb-4 border-b pb-2 flex items-center gap-2">
                  V) Tolérance
                  <Tooltip title="Vérification des tolérances appliquées."><InfoOutlinedIcon fontSize="inherit" /></Tooltip>
                </h2>
                <table className="min-w-full bg-white border-collapse rounded-lg shadow-md">
                  <thead>
                    <tr className="bg-green-100">
                      <th className="py-2 px-3 border">Tolérance</th>
                      <th className="py-2 px-3 border">Résultat moyen</th>
                      <th className="py-2 px-3 border">Conforme</th>
                      <th className="py-2 px-3 border">Non conforme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Caractéristiques minimales (≤ 10%) */}
                    <tr>
                      <td className="py-2 px-3 border">Caractéristiques minimales (≤ 10%)</td>
                      <td className="py-1 px-2 border text-center">
                        {(() => {
                          // Sum of relevant fields for each palette, then average
                          let sum = 0, count = 0;
                          getCurrentFormData().palettes.forEach((p: PaletteData) => {
                            const val =
                              (parseFloat(p.rotting || '0') || 0) +
                              (parseFloat(p.foreignMatter || '0') || 0) +
                              (parseFloat(p.withered || '0') || 0) +
                              (parseFloat(p.hardenedEndoderm || '0') || 0) +
                              (parseFloat(p.parasitePresence || '0') || 0) +
                              (parseFloat(p.parasiteAttack || '0') || 0);
                            sum += val;
                            count++;
                          });
                          return count ? (sum / count).toFixed(2) : '';
                        })()}
                      </td>
                      <td className="py-1 px-2 border"><input type="checkbox" className="mx-auto" /></td>
                      <td className="py-1 px-2 border"><input type="checkbox" className="mx-auto" /></td>
                    </tr>
                    {/* Total des défauts : catégorie I + caractéristiques minimales (≤ 10%) */}
                    <tr>
                      <td className="py-2 px-3 border">Total des défauts : catégorie I + caractéristiques minimales (≤ 10%)</td>
                      <td className="py-1 px-2 border text-center">
                        {(() => {
                          let sum = 0, count = 0;
                          getCurrentFormData().palettes.forEach((p: PaletteData) => {
                            const minChar =
                              (parseFloat(p.rotting || '0') || 0) +
                              (parseFloat(p.foreignMatter || '0') || 0) +
                              (parseFloat(p.withered || '0') || 0) +
                              (parseFloat(p.hardenedEndoderm || '0') || 0) +
                              (parseFloat(p.parasitePresence || '0') || 0) +
                              (parseFloat(p.parasiteAttack || '0') || 0);
                            const catIDef =
                              (parseFloat(p.shapeDefect || '0') || 0) +
                              (parseFloat(p.colorDefect || '0') || 0) +
                              (parseFloat(p.epidermisDefect || '0') || 0);
                            sum += minChar + catIDef;
                            count++;
                          });
                          return count ? (sum / count).toFixed(2) : '';
                        })()}
                      </td>
                      <td className="py-1 px-2 border"><input type="checkbox" className="mx-auto" /></td>
                      <td className="py-1 px-2 border"><input type="checkbox" className="mx-auto" /></td>
                    </tr>
                    {/* Extrémité des grains manques et cassées (≤ 10%) */}
                    <tr>
                      <td className="py-2 px-3 border">Extrémité des grains manques et cassées (≤ 10%)</td>
                      <td className="py-1 px-2 border text-center">
                        {(() => {
                          let sum = 0, count = 0;
                          getCurrentFormData().palettes.forEach((p: PaletteData) => {
                            sum += parseFloat(p.missingBrokenGrains || '0') || 0;
                            count++;
                          });
                          return count ? (sum / count).toFixed(2) : '';
                        })()}
                      </td>
                      <td className="py-1 px-2 border"><input type="checkbox" className="mx-auto" /></td>
                      <td className="py-1 px-2 border"><input type="checkbox" className="mx-auto" /></td>
                    </tr>
                    {/* Poids selon le type d’emballage (poids net +1%) */}
                    <tr>
                      <td className="py-2 px-3 border">Poids selon le type d’emballage (poids net +1%)</td>
                      <td className="py-1 px-2 border text-center">
                        {(() => {
                          let sum = 0, count = 0;
                          getCurrentFormData().palettes.forEach((p: PaletteData) => {
                            const pw = Number(p.packageWeight || 0);
                            const rw = Number(p.requiredNetWeight || 0);
                            if (pw && rw) {
                              sum += ((pw - rw) * 100) / pw;
                              count++;
                            }
                          });
                          return count ? (sum / count).toFixed(2) : '';
                        })()}
                      </td>
                      <td className="py-1 px-2 border"><input type="checkbox" className="mx-auto" /></td>
                      <td className="py-1 px-2 border"><input type="checkbox" className="mx-auto" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- PDF value and coordinate sanitization helpers ---
const safeText = (value: any) => (typeof value === 'string' ? value : '');
const safeNumber = (value: any) => (typeof value === 'number' && !isNaN(value) ? value : 0);
const sanitizeText = (text: string) =>
  text
    .replace(/✓/g, 'v')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/✗/g, 'x')
    .replace(/[^a-zA-Z0-9 .,;:!?'"()\-_/\\@#&+=<>%$€£\n\r]/g, '');