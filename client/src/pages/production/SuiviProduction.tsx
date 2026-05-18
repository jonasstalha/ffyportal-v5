import React, { useState, useEffect, useCallback } from 'react';
import { Save, FilePlus, RefreshCw, Check, Calendar, Package, User, Thermometer, Plus, Copy, X, Trash2, Edit, Archive, Import, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { firestore } from '../../lib/firebase';
import { saveQualityControlLot, getQualityControlLots } from '../../lib/qualityControlService';
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
import { useSharedLots } from '../../hooks/useSharedLots';
import { SharedLot } from '../../lib/sharedLotService';
import LOGO from '../../../assets/icon.png';

// Production Lot Interface
interface ProductionLot {
  id: string;
  lotNumber: string;
  status: 'brouillon' | 'en_cours' | 'termine' | 'archived';
  formData: {
    headerData: {
      date: string;
      produit: string;
      numeroLotClient: string;
      typeProduction: string;
      variete: string;
    };
    calibreData: { [key: string]: number };
    nombrePalettes: string;
    productionRows: Array<{
      numero: number;
      date: string;
      heure: string;
      calibre: string;
      poidsBrut: string;
      poidsNet: string;
      numeroLotInterne: string;
      nbrCP: string;
      chambreFroide: string;
      decision: string;
      temperature?: string;
      humidity?: string;
      weatherCondition?: string;
    }>;
    visas: {
      controleurQualite: string;
      responsableQualite: string;
      directeurOperationnel: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

// Enhanced caisse options with 108 caisse
const CAISSE_OPTIONS = [
  { value: '90', reduction: 51, label: '90 Caisses (-51kg)' },
  { value: '100', reduction: 60, label: '100 Caisses (-60kg)' },
  { value: '108', reduction: 65, label: '108 Caisses (-65kg)' },
  { value: '220', reduction: 80, label: '220 Caisses (-80kg)' },
  { value: '264', reduction: 94, label: '264 Caisses (-94kg)' }
];

const varietesAvocat = [
  'Hass', 'Fuerte', 'Pinkerton', 'Reed', 'Zutano', 'Bacon', 'Gwen', 'Lamb Hass'
];

const chambresFreides = [
  'CF-01', 'CF-02', 'CF-03', 'CF-04', 'CF-05', 'CF-06'
];

const decisions = [
  'ACCEPTÉ', 'REFUSÉ', 'EN ATTENTE', 'CONDITIONNEL'
];

const SuiviProduction = () => {
  // Use shared lot management
  const {
    lots: sharedLots,
    loading: sharedLoading,
    error: sharedError,
    addLot: addSharedLot,
    updateLot: updateSharedLot,
    deleteLot: deleteSharedLot,
    getProductionLots
  } = useSharedLots();

  // Get only production lots (separate active vs archived)
  const allProductionSharedLots = getProductionLots();
  const lots = allProductionSharedLots.filter(l => l.status !== 'archived');
  const [currentLotId, setCurrentLotId] = useState<string>('');
  const [filteredRapports, setFilteredRapports] = useState<any[]>([]);
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);

  // Legacy states for compatibility
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showLotManagement, setShowLotManagement] = useState(false);
  const [showArchivePanel, setShowArchivePanel] = useState(false);
  const [renamingLotId, setRenamingLotId] = useState<string | null>(null);
  const [newLotName, setNewLotName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const loading = sharedLoading;
  const error = sharedError;

  // Helper functions to convert between SharedLot and ProductionLot
  const sharedLotToProductionLot = (sharedLot: SharedLot): ProductionLot => {
    return {
      id: sharedLot.id,
      lotNumber: sharedLot.lotNumber,
      status: sharedLot.status as 'brouillon' | 'en_cours' | 'termine',
      formData: sharedLot.productionData || {
        headerData: {
          date: format(new Date(), 'yyyy-MM-dd'),
          produit: 'AVOCAT',
          numeroLotClient: '',
          typeProduction: 'CONVENTIONNEL',
          variete: ''
        },
        calibreData: {
          12: 0, 14: 0, 16: 0, 18: 0, 20: 0, 22: 0, 24: 0, 26: 0, 28: 0, 30: 0, 32: 0
        },
        nombrePalettes: '',
        productionRows: Array.from({ length: 26 }, (_, index) => ({
          numero: index + 1,
          date: '',
          heure: '',
          calibre: '',
          poidsBrut: '',
          poidsNet: '',
          numeroLotInterne: '',
          nbrCP: '',
          chambreFroide: '',
          decision: '',
          temperature: '',
          humidity: '',
          weatherCondition: ''
        })),
        visas: {
          controleurQualite: '',
          responsableQualite: '',
          directeurOperationnel: ''
        }
      },
      createdAt: sharedLot.createdAt,
      updatedAt: sharedLot.updatedAt
    };
  };

  const productionLotToSharedLot = (productionLot: ProductionLot): Omit<SharedLot, 'id' | 'createdAt' | 'updatedAt'> => {
    return {
      lotNumber: productionLot.lotNumber,
      status: productionLot.status,
      type: 'production',
      productionData: productionLot.formData
    };
  };

  // Convert shared lots to production lots
  const productionLots = lots.map(sharedLotToProductionLot);

  // Archived lots helper
  const archivedLots = allProductionSharedLots.filter(l => l.type === 'production' && l.status === 'archived');

  // Helper functions for multi-lot management
  const getCurrentLot = (): ProductionLot | undefined => {
    return productionLots.find(lot => lot.id === currentLotId);
  };

  const getCurrentFormData = () => {
    const currentLot = getCurrentLot();
    const defaultData = {
      headerData: {
        date: format(new Date(), 'yyyy-MM-dd'),
        produit: 'AVOCAT',
        numeroLotClient: '',
        typeProduction: 'CONVENTIONNEL',
        variete: ''
      },
      calibreData: {
        12: 0, 14: 0, 16: 0, 18: 0, 20: 0, 22: 0, 24: 0, 26: 0, 28: 0, 30: 0, 32: 0
      },
      nombrePalettes: '',
      productionRows: Array.from({ length: 26 }, (_, index) => ({
        numero: index + 1,
        date: '',
        heure: '',
        calibre: '',
        poidsBrut: '',
        poidsNet: '',
        numeroLotInterne: '',
        nbrCP: '',
        chambreFroide: '',
        decision: '',
        temperature: '',
        humidity: '',
        weatherCondition: ''
      })),
      visas: {
        controleurQualite: '',
        responsableQualite: '',
        directeurOperationnel: ''
      }
    };

    if (!currentLot?.formData) {
      return defaultData;
    }

    return {
      headerData: { ...defaultData.headerData, ...currentLot.formData.headerData },
      calibreData: { ...defaultData.calibreData, ...currentLot.formData.calibreData },
      nombrePalettes: currentLot.formData.nombrePalettes || defaultData.nombrePalettes,
      productionRows: currentLot.formData.productionRows || defaultData.productionRows,
      visas: { ...defaultData.visas, ...currentLot.formData.visas }
    };
  };

  // Calculate poids net based on nbrCP and poids brut
  const calculatePoidsNet = (poidsBrut: string, nbrCP: string): string => {
    const poidsBrutNum = parseFloat(poidsBrut) || 0;
    const nbrCPNum = parseInt(nbrCP) || 0;

    if (poidsBrutNum === 0 || nbrCPNum === 0) return '';

    // Find the reduction amount for the selected number of caisses
    const selectedOption = CAISSE_OPTIONS.find(option => option.value === nbrCP);
    const reduction = selectedOption ? selectedOption.reduction : 0;

    const poidsNet = Math.max(0, poidsBrutNum - reduction);

    return poidsNet.toFixed(2);
  };

  const updateCurrentLotData = async (updates: Partial<ProductionLot['formData']>) => {
    if (!currentLotId) return;

    const currentLot = getCurrentLot();
    if (!currentLot) return;

    const updatedFormData = { ...currentLot.formData, ...updates };

    try {
      await updateSharedLot(currentLotId, {
        productionData: updatedFormData,
        status: currentLot.status
      });
    } catch (error) {
      console.error('Error updating lot data:', error);
    }
  };

// Enhanced row change handler with automatic date/time, calibre matching, and archive title editing
const handleRowChange = async (rowIndex: number, field: string, value: string) => {
  const currentData = getCurrentFormData();
  const currentRows = currentData.productionRows || [];
  const newRows = [...currentRows];

  // Update the field
  newRows[rowIndex] = {
    ...newRows[rowIndex],
    [field]: value,
  };

  // === AUTO-FILL DATE WHEN CLICKING IN ROW ===
  // Auto-fill date with today's date when clicking in any date cell
  if (field === 'date' && !value) {
    newRows[rowIndex].date = format(new Date(), 'yyyy-MM-dd');
  }

  // === AUTO-FILL TIME WHEN CLICKING IN TIME CELL ===
  // Auto-fill time with current time when clicking in any time cell
  if (field === 'heure' && !value) {
    newRows[rowIndex].heure = format(new Date(), 'HH:mm');
  }

  // === AUTO-FILL DATE AND TIME FOR FIRST ROW ===
  if (rowIndex === 0) {
    if (field === 'date' && !newRows[0].date) {
      newRows[0].date = format(new Date(), 'yyyy-MM-dd');
    }
    if (field === 'heure' && !newRows[0].heure) {
      newRows[0].heure = format(new Date(), 'HH:mm');
    }
  }

  // === AUTO-FILL CHAMBRE FROIDE FROM FIRST ROW ===
  if (field === 'chambreFroide' && rowIndex === 0 && value) {
    for (let i = 1; i < newRows.length; i++) {
      newRows[i] = {
        ...newRows[i],
        chambreFroide: value
      };
    }
  }

  // === AUTO-DETECT CALIBRE FROM TEXT INPUT ===
  // When user types in calibre field, try to match with known calibre values
  if (field === 'calibre' && value.trim()) {
    // Check if the input matches any known calibre patterns
    const calibreInput = value.trim();
    const calibreKeys = Object.keys(currentData.calibreData || {});
    
    // Check for single calibre numbers (e.g., "14", "16")
    const singleCalibreMatch = calibreKeys.find(cal => 
      calibreInput === cal || calibreInput === `calibre ${cal}`
    );
    
    // Check for calibre ranges (e.g., "14-16", "16-18")
    const rangeMatch = calibreInput.match(/(\d+)\s*[-à]\s*(\d+)/);
    
    if (singleCalibreMatch) {
      // Single calibre detected
      newRows[rowIndex].calibre = singleCalibreMatch;
    } else if (rangeMatch) {
      // Calibre range detected - store as entered
      newRows[rowIndex].calibre = calibreInput;
    } else {
      // Try to extract numbers from input
      const numbers = calibreInput.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        // Check if numbers match any known calibre
        const matchedCalibres = numbers.filter(num => 
          calibreKeys.includes(num)
        );
        if (matchedCalibres.length > 0) {
          // Create calibre string from matched numbers
          if (matchedCalibres.length === 1) {
            newRows[rowIndex].calibre = matchedCalibres[0];
          } else {
            // Sort numbers and create range
            const sorted = matchedCalibres.map(Number).sort((a, b) => a - b);
            newRows[rowIndex].calibre = `${sorted[0]}-${sorted[sorted.length - 1]}`;
          }
        }
      }
    }
  }

  // === AUTO-CALCULATE POIDS NET ===
  if (field === 'poidsBrut' || field === 'nbrCP') {
    const poidsBrut = field === 'poidsBrut' ? value : newRows[rowIndex].poidsBrut;
    const nbrCP = field === 'nbrCP' ? value : newRows[rowIndex].nbrCP;

    if (poidsBrut && nbrCP) {
      newRows[rowIndex].poidsNet = calculatePoidsNet(poidsBrut, nbrCP);
    } else {
      newRows[rowIndex].poidsNet = '';
    }
  }

  // Update calibre counts when calibre changes
  try {
    const calibreKeys = Object.keys(currentData.calibreData || {});
    const newCalibreData: any = {};
    calibreKeys.forEach(k => { newCalibreData[k] = 0; });

    for (const r of newRows) {
      if (!r || !r.calibre) continue;
      const calibreValue = String(r.calibre || '').trim();
      if (!calibreValue) continue;

      // Handle single calibre
      if (calibreKeys.includes(calibreValue)) {
        newCalibreData[calibreValue] = (newCalibreData[calibreValue] || 0) + 1;
        continue;
      }

      // Handle calibre ranges (e.g., "14-16")
      const rangeMatch = calibreValue.match(/(\d+)\s*[-à]\s*(\d+)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        
        // Find all calibres in the range
        for (const k of calibreKeys) {
          const calNum = parseInt(k);
          if (calNum >= start && calNum <= end) {
            newCalibreData[k] = (newCalibreData[k] || 0) + 1;
          }
        }
        continue;
      }

      // Handle comma-separated calibres (e.g., "14, 16, 18")
      const commaSeparated = calibreValue.split(/[,;\s]+/);
      if (commaSeparated.length > 1) {
        commaSeparated.forEach(cal => {
          const trimmedCal = cal.trim();
          if (calibreKeys.includes(trimmedCal)) {
            newCalibreData[trimmedCal] = (newCalibreData[trimmedCal] || 0) + 1;
          }
        });
        continue;
      }

      // Fallback: try regex matching
      for (const k of calibreKeys) {
        try {
          const re = new RegExp(`\\b${k}\\b`);
          if (re.test(calibreValue)) {
            newCalibreData[k] = (newCalibreData[k] || 0) + 1;
          }
        } catch (e) {
          // If regex fails, do simple equality check
          if (calibreValue === k) {
            newCalibreData[k] = (newCalibreData[k] || 0) + 1;
          }
        }
      }
    }

    updateCurrentLotData({ productionRows: newRows, calibreData: newCalibreData });
  } catch (err) {
    console.error('Error updating rows/calibre counts:', err);
    updateCurrentLotData({ productionRows: newRows });
  }
};

  // Keyboard navigation for table cells
  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const totalRows = 26;
    const totalCols = 9;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (rowIndex > 0) {
          setFocusedCell({ row: rowIndex - 1, col: colIndex });
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (rowIndex < totalRows - 1) {
          setFocusedCell({ row: rowIndex + 1, col: colIndex });
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (colIndex > 0) {
          setFocusedCell({ row: rowIndex, col: colIndex - 1 });
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (colIndex < totalCols - 1) {
          setFocusedCell({ row: rowIndex, col: colIndex + 1 });
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (rowIndex < totalRows - 1) {
          setFocusedCell({ row: rowIndex + 1, col: colIndex });
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab - move left/up
          if (colIndex > 0) {
            setFocusedCell({ row: rowIndex, col: colIndex - 1 });
          } else if (rowIndex > 0) {
            setFocusedCell({ row: rowIndex - 1, col: totalCols - 1 });
          }
        } else {
          // Tab - move right/down
          if (colIndex < totalCols - 1) {
            setFocusedCell({ row: rowIndex, col: colIndex + 1 });
          } else if (rowIndex < totalRows - 1) {
            setFocusedCell({ row: rowIndex + 1, col: 0 });
          }
        }
        break;
    }
  };

  // Create new lot
  const createNewLot = async () => {
    const formData = {
      headerData: {
        date: format(new Date(), 'yyyy-MM-dd'),
        produit: 'AVOCAT',
        numeroLotClient: '',
        typeProduction: 'CONVENTIONNEL',
        variete: ''
      },
      calibreData: {
        12: 0, 14: 0, 16: 0, 18: 0, 20: 0, 22: 0, 24: 0, 26: 0, 28: 0, 30: 0, 32: 0
      },
      nombrePalettes: '',
      productionRows: Array.from({ length: 26 }, (_, index) => ({
        numero: index + 1,
        date: index === 0 ? format(new Date(), 'yyyy-MM-dd') : '',
        heure: index === 0 ? format(new Date(), 'HH:mm') : '',
        calibre: '',
        poidsBrut: '',
        poidsNet: '',
        numeroLotInterne: '',
        nbrCP: '',
        chambreFroide: '',
        decision: '',
        temperature: '',
        humidity: '',
        weatherCondition: ''
      })),
      visas: {
        controleurQualite: '',
        responsableQualite: '',
        directeurOperationnel: ''
      }
    };

    try {
      const lotNumber = `Lot ${productionLots.length + 1}`;
      const lotId = await addSharedLot({
        lotNumber,
        status: 'brouillon',
        type: 'production',
        productionData: formData
      });
      setCurrentLotId(lotId);

      // Create matching Quality Control lot
      try {
        const today = new Date();
        const qcFormData = {
          date: today.toISOString().slice(0, 10),
          product: 'AVOCAT',
          variety: '',
          campaign: `${today.getFullYear()}-${today.getFullYear() + 1}`,
          clientLot: lotNumber,
          shipmentNumber: '',
          packagingType: '',
          category: 'I',
          exporterNumber: '106040',
          frequency: '1 Carton/palette',
          palettes: Array.from({ length: 5 }, () => ({}))
        } as any;

        await saveQualityControlLot({
          id: `lot-${Date.now()}`,
          lotNumber,
          formData: qcFormData,
          images: [],
          status: 'draft',
          phase: 'controller',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any);
      } catch (qcErr) {
        console.warn('QC lot creation skipped:', qcErr);
      }
    } catch (e) {
      console.error('Erreur lors de la création du lot:', e);
    }
  };

  // Rename lot
  const renameLot = async (lotId: string, newName: string) => {
    if (!newName.trim()) return;
    
    setIsRenaming(true);
    try {
      await updateSharedLot(lotId, { lotNumber: newName.trim() });
      setRenamingLotId(null);
      setNewLotName('');
    } catch (error) {
      console.error('Error renaming lot:', error);
      alert('Erreur lors du renommage du lot');
    } finally {
      setIsRenaming(false);
    }
  };

  // Duplicate lot
  const duplicateLot = async (lotId: string) => {
    const lotToDuplicate = productionLots.find(lot => lot.id === lotId);
    if (!lotToDuplicate) return;

    try {
      const newLotId = await addSharedLot({
        lotNumber: `${lotToDuplicate.lotNumber} (Copie)`,
        status: 'brouillon',
        type: 'production',
        productionData: lotToDuplicate.formData
      });
      setCurrentLotId(newLotId);
    } catch (error) {
      console.error('Error duplicating lot:', error);
    }
  };

  // Delete lot
  const deleteLot = async (lotId: string) => {
    if (productionLots.length <= 1) {
      alert('Vous ne pouvez pas supprimer le dernier lot');
      return;
    }

    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce lot ?')) {
      try {
        if (currentLotId === lotId) {
          const remainingLots = productionLots.filter(lot => lot.id !== lotId);
          if (remainingLots.length > 0) {
            setCurrentLotId(remainingLots[0].id);
          } else {
            setCurrentLotId('');
          }
        }

        await deleteSharedLot(lotId);

      } catch (error) {
        console.error('Error deleting lot:', error);
        alert('Erreur lors de la suppression du lot');
      }
    }
  };

  // Update lot status
  const updateLotStatus = async (lotId: string, status: ProductionLot['status']) => {
    try {
      await updateSharedLot(lotId, { status });
    } catch (error) {
      console.error('Error updating lot status:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  // Archive a production lot
  const archiveLot = async (lotId: string) => {
    if (!window.confirm('Archiver ce lot ? Il restera disponible dans la section Archivage.')) return;
    try {
      await updateSharedLot(lotId, { status: 'archived' });
      if (currentLotId === lotId) {
        const remaining = productionLots.filter(l => l.id !== lotId);
        setCurrentLotId(remaining.length ? remaining[0].id : '');
      }
    } catch (e) {
      console.error('Erreur lors de l archivage:', e);
      alert('Erreur lors de l archivage');
    }
  };

  // Restore an archived lot
  const restoreLot = async (lotId: string) => {
    try {
      await updateSharedLot(lotId, { status: 'brouillon' });
      alert('Lot restauré depuis l archivage');
    } catch (e) {
      console.error('Erreur lors de la restauration:', e);
      alert('Erreur lors de la restauration');
    }
  };

  const handleHeaderChange = (field: string, value: string) => {
    updateCurrentLotData({
      headerData: {
        ...getCurrentFormData().headerData,
        [field]: value
      }
    });
  };

  const handleCalibreChange = (calibre: string, value: string) => {
    updateCurrentLotData({
      calibreData: {
        ...getCurrentFormData().calibreData,
        [calibre]: parseInt(value) || 0
      }
    });
  };

  const handleNombrePalettesChange = (value: string) => {
    updateCurrentLotData({
      nombrePalettes: value
    });
  };

  const handleVisaChange = (field: string, value: string) => {
    updateCurrentLotData({
      visas: {
        ...getCurrentFormData().visas,
        [field]: value
      }
    });
  };

  const calculateTotals = () => {
    const currentData = getCurrentFormData();

    if (!currentData || !currentData.productionRows || !Array.isArray(currentData.productionRows)) {
      return { poidsBrut: 0, poidsNet: 0, nbrCP: 0 };
    }

    const totals = currentData.productionRows.reduce((acc, row) => {
      return {
        poidsBrut: acc.poidsBrut + (parseFloat(row.poidsBrut) || 0),
        poidsNet: acc.poidsNet + (parseFloat(row.poidsNet) || 0),
        nbrCP: acc.nbrCP + (parseInt(row.nbrCP) || 0)
      };
    }, { poidsBrut: 0, poidsNet: 0, nbrCP: 0 });

    return totals;
  };

  // PROFESSIONAL PDF GENERATION - UPDATED VERSION
  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const currentData = getCurrentFormData();
      const currentLot = getCurrentLot();

      if (!currentData || !currentData.productionRows || !Array.isArray(currentData.productionRows)) {
        console.error('Invalid production data - cannot generate PDF');
        setIsGeneratingPDF(false);
        return;
      }

      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF('p', 'mm', 'a4');

      // Professional color scheme
      const colors = {
        primary: [31, 42, 56],     // #1f2a38
        secondary: [42, 56, 74],   // #2a384a
        accent: [76, 175, 80],     // Material Green
        darkText: [33, 33, 33],    // Dark Gray
        lightText: [117, 117, 117],// Medium Gray
        border: [189, 189, 189],   // Light Border
        headerBg: [232, 245, 233], // Light Green Header
        tableHeader: [200, 230, 201], // Table Header Green
        white: [255, 255, 255]     // White
      };

      // Helper functions
      const setColor = (color: number[]) => {
        doc.setFillColor(color[0], color[1], color[2]);
        doc.setTextColor(color[0], color[1], color[2]);
      };

      const drawRect = (x: number, y: number, w: number, h: number, fill?: boolean, stroke: boolean = true) => {
        if (fill) doc.rect(x, y, w, h, 'F');
        if (stroke) doc.rect(x, y, w, h, 'S');
      };

      const drawText = (text: string, x: number, y: number, size: number, align: 'left' | 'center' | 'right' = 'left', bold: boolean = false, color?: number[]) => {
        doc.setFontSize(size);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        if (color) doc.setTextColor(color[0], color[1], color[2]);
        doc.text(text, x, y, { align });
        // Reset to default color
        if (color) setColor(colors.darkText);
      };

      const drawLine = (x1: number, y1: number, x2: number, y2: number, width: number = 0.3, color?: number[]) => {
        if (color) doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(width);
        doc.line(x1, y1, x2, y2);
        doc.setLineWidth(0.3);
        if (color) doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
      };

      // Page setup
      const pageWidth = 210;
      const margin = 5;
      const contentWidth = pageWidth - (margin * 2);
      let yPos = margin;
      let pageNumber = 1;

      // === PROFESSIONAL HEADER ===
      setColor(colors.primary);
      drawRect(margin, yPos, contentWidth, 28, true);

      try {
        const logoUrl = LOGO;
        doc.addImage(logoUrl, 'PNG', margin + 5, yPos + 4, 20, 20);
      } catch (error) {
        setColor(colors.white);
        drawRect(margin + 5, yPos + 4, 20, 20, false);
        drawText('LOGO', margin + 15, yPos + 14, 8, 'center', true, colors.white);
      }

      setColor(colors.white);
      drawText('SUIVI DE PRODUCTION', pageWidth / 2, yPos + 8, 14, 'center', true, colors.white);
      drawText('AVOCAT', pageWidth / 2, yPos + 16, 14, 'center', true, colors.white);

      const smallTableWidth = 60;
      const smallTableHeight = 26;
      const smallTableX = pageWidth - margin - smallTableWidth;
      const smallTableY = 6;

      drawRect(smallTableX, smallTableY, smallTableWidth, smallTableHeight, false);
      const rowHeight = smallTableHeight / 3;
      drawLine(smallTableX, smallTableY + rowHeight, smallTableX + smallTableWidth, smallTableY + rowHeight, 0.3);
      drawLine(smallTableX, smallTableY + rowHeight * 2, smallTableX + smallTableWidth, smallTableY + rowHeight * 2, 0.3);

      setColor(colors.white);
      drawText('SMQ.ENR23', smallTableX + 5, smallTableY + rowHeight - 3, 9, 'left', true);
      drawText('Version : 01', smallTableX + 5, smallTableY + rowHeight * 2 - 3, 9, 'left', false);
      drawText('Date : 19/05/2023', smallTableX + 5, smallTableY + smallTableHeight - 3, 9, 'left', false);

      yPos += 42;
      setColor(colors.darkText);
      
      const infoData = [
        { label: 'N° Lot Client:', value: currentData.headerData?.numeroLotClient || 'N/A' },
        { label: 'Date Production:', value: currentData.headerData?.date || 'N/A' },
        { label: 'Type Production:', value: currentData.headerData?.typeProduction || 'N/A' },
        { label: 'Variété:', value: currentData.headerData?.variete || 'N/A' },
        { label: 'Nombre Palettes:', value: currentData.nombrePalettes || '0' }
      ];

      infoData.forEach((info, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = margin + (col * (contentWidth / 2));
        const y = yPos + (row * 6);

        drawText(info.label, x, y, 9, 'left', true);
        drawText(info.value, x + 45, y, 9, 'left', false);
      });

      yPos += 18;

      // === PRODUCTION TABLE ===
      const tableHeaders = ['N°', 'Date', 'Heure', 'Calibre', 'Poids Brut (kg)', 'Poids Net (kg)', 'Lot Interne', 'Nbr C/P', 'Chambre', 'Décision'];
      const colWidths = [8, 18, 16, 15, 22, 22, 25, 14, 18, 22];

      setColor(colors.tableHeader);
      drawRect(margin, yPos, contentWidth, 10, true);
      setColor(colors.primary);
      let xStart = margin;
      tableHeaders.forEach((header, index) => {
        drawText(header, xStart + colWidths[index] / 2, yPos + 6, 8, 'center', true, colors.primary);
        xStart += colWidths[index];
      });
      yPos += 10;

      let rowCount = 0;
      const rowHeightPDF = 6;

      for (let i = 0; i < currentData.productionRows.length; i++) {
        const row = currentData.productionRows[i];

        if (!row.date && !row.poidsBrut && !row.poidsNet && !row.numeroLotInterne) continue;

        if (yPos + rowHeightPDF > 270) {
          doc.addPage();
          pageNumber++;
          yPos = margin;

          setColor(colors.tableHeader);
          drawRect(margin, yPos, contentWidth, 10, true);
          setColor(colors.primary);
          xStart = margin;
          tableHeaders.forEach((header, index) => {
            drawText(header, xStart + colWidths[index] / 2, yPos + 6, 8, 'center', true, colors.primary);
            xStart += colWidths[index];
          });
          yPos += 10;
        }

        const rowY = yPos + (rowCount * rowHeightPDF);

        if (rowCount % 2 === 0) {
          setColor([248, 248, 248]);
          drawRect(margin, rowY, contentWidth, rowHeightPDF, true, false);
        }

        setColor(colors.darkText);
        xStart = margin;
        const rowData = [
          (rowCount + 1).toString(),
          row.date || '-',
          row.heure || '-',
          row.calibre || '-',
          row.poidsBrut ? `${parseFloat(row.poidsBrut).toFixed(1)}` : '-',
          row.poidsNet ? `${parseFloat(row.poidsNet).toFixed(1)}` : '-',
          row.numeroLotInterne || '-',
          row.nbrCP || '-',
          row.chambreFroide || '-',
          row.decision || '-'
        ];

        rowData.forEach((data, colIndex) => {
          const textColor = (colIndex === 4 || colIndex === 5) && data !== '-' ? colors.primary : colors.darkText;
          drawText(data, xStart + colWidths[colIndex] / 2, rowY + (rowHeightPDF / 2) + 1, 7, 'center', false, textColor);
          xStart += colWidths[colIndex];
        });

        drawLine(margin, rowY + rowHeightPDF, margin + contentWidth, rowY + rowHeightPDF, 0.1);

        rowCount++;
      }

      yPos += (rowCount * rowHeightPDF) + 5;

      // === TOTALS SECTION ===
      const totals = calculateTotals();
      setColor(colors.tableHeader);
      drawRect(margin, yPos, contentWidth, 12, true);
      setColor(colors.primary);

      drawText('TOTAUX GÉNÉRAUX', margin + 5, yPos + 4, 10, 'left', true, colors.primary);
      drawText(`Poids Brut Total: ${totals.poidsBrut.toFixed(2)} kg`, margin + 45, yPos + 4, 9, 'left', true);
      drawText(`Poids Net Total: ${totals.poidsNet.toFixed(2)} kg`, margin + 100, yPos + 4, 9, 'left', true);
      drawText(`Nombre Total C/P: ${totals.nbrCP}`, margin + 155, yPos + 4, 9, 'left', true);

      yPos += 10;

      // === CALIBRE DISTRIBUTION ===
      setColor(colors.darkText);
      yPos += 6;

      const calibres = Object.keys(currentData.calibreData || {});
      const calibreWidth = 14;
      xStart = margin;

      setColor(colors.tableHeader);
      drawRect(margin, yPos, contentWidth, 6, true);
      setColor(colors.primary);
      calibres.forEach(calibre => {
        drawText(calibre, xStart + calibreWidth / 2, yPos + 4, 8, 'center', true, colors.primary);
        xStart += calibreWidth;
      });

      yPos += 6;

      xStart = margin;
      calibres.forEach(calibre => {
        const value = currentData.calibreData?.[parseInt(calibre) as keyof typeof currentData.calibreData] || 0;
        const hasValue = value > 0;

        if (hasValue) {
          setColor(colors.white);
          drawRect(xStart, yPos, calibreWidth, 6, true, false);
          setColor(colors.primary);
        }

        drawText(value.toString(), xStart + calibreWidth / 2, yPos + 4, 8, 'center', true, hasValue ? colors.primary : colors.lightText);
        xStart += calibreWidth;
      });

      yPos += 12;

      // === SIGNATURES SECTION ===
      const signatures = [
        {
          label: 'CONTROLEUR QUALITÉ',
          value: currentData.visas?.controleurQualite,
          sublabel: ''
        },
        {
          label: 'RESPONSABLE QUALITÉ',
          value: currentData.visas?.responsableQualite,
          sublabel: ''
        },
        {
          label: 'DIRECTEUR OPÉRATIONNEL',
          value: currentData.visas?.directeurOperationnel,
          sublabel: ''
        }
      ];

      const sigWidth = (contentWidth - 10) / 3;
      xStart = margin;

      signatures.forEach((sig, index) => {
        setColor(colors.headerBg);
        drawRect(xStart, yPos, sigWidth, 15, true);
        setColor(colors.darkText);

        drawText(sig.label, xStart + sigWidth / 2, yPos + 6, 8, 'center', true);
        drawText(sig.sublabel, xStart + sigWidth / 2, yPos + 10, 7, 'center', false, colors.lightText);

        xStart += sigWidth + 5;
      });

      yPos += 32;

      // === FOOTER ===
      drawLine(margin, yPos, pageWidth - margin, yPos, 0.5, colors.primary);
      yPos += 3;

      setColor(colors.lightText);
      drawText(`FRUITS FOR YOU - Système de Gestion de la Qualité - Page ${pageNumber}`, pageWidth / 2, yPos, 8, 'center', false);
      drawText(`Document: Rapport Production Avocat - Lot: ${currentLot?.lotNumber || 'N/A'}`, pageWidth / 2, yPos + 4, 7, 'center', false);

      const fileName = `suivi_Production_${currentLot?.lotNumber?.replace(/\s+/g, '_') || 'Lot'}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(fileName);

      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const resetForm = () => {
    if (window.confirm("Êtes-vous sûr de vouloir réinitialiser ce lot? Toutes les données seront perdues.")) {
      const currentLot = getCurrentLot();
      if (!currentLot) return;

      const resetData = {
        headerData: {
          date: format(new Date(), 'yyyy-MM-dd'),
          produit: 'AVOCAT',
          numeroLotClient: '',
          typeProduction: 'CONVENTIONNEL',
          variete: ''
        },
        calibreData: {
          12: 0, 14: 0, 16: 0, 18: 0, 20: 0, 22: 0, 24: 0, 26: 0, 28: 0, 30: 0, 32: 0
        },
        nombrePalettes: '',
        productionRows: Array.from({ length: 26 }, (_, index) => ({
          numero: index + 1,
          date: index === 0 ? format(new Date(), 'yyyy-MM-dd') : '',
          heure: index === 0 ? format(new Date(), 'HH:mm') : '',
          calibre: '',
          poidsBrut: '',
          poidsNet: '',
          numeroLotInterne: '',
          nbrCP: '',
          chambreFroide: '',
          decision: ''
        })),
        visas: {
          controleurQualite: '',
          responsableQualite: '',
          directeurOperationnel: ''
        }
      };

      updateCurrentLotData(resetData);
    }
  };

  // Save current lot data
  const handleSave = async () => {
    const currentLot = getCurrentLot();
    if (!currentLot) return;

    try {
      await updateLotStatus(currentLot.id, 'termine');
    } catch (err) {
      console.warn('Could not mark as termine before archiving:', err);
    }

    // Save to localStorage for rapport section
    const rapportData = {
      ...currentLot.formData,
      lotNumber: currentLot.lotNumber,
      savedAt: new Date().toISOString()
    };

    const existingRapports = JSON.parse(localStorage.getItem('production_rapports') || '[]');
    existingRapports.push(rapportData);
    localStorage.setItem('production_rapports', JSON.stringify(existingRapports));

    localStorage.setItem('production_lots', JSON.stringify(lots));

    // Sync production data to quality control
    try {
      await syncProductionToQuality(currentLot, getCurrentFormData());
      alert('Lot sauvegardé avec succès et envoyé vers la section rapport! Données synchronisées avec le contrôle qualité.');
    } catch (error) {
      console.error('Error syncing to quality control:', error);
      alert('Lot sauvegardé avec succès mais erreur lors de la synchronisation avec le contrôle qualité.');
    }

    setFilteredRapports([rapportData]);

    // Archive the lot
    try {
      await updateLotStatus(currentLot.id, 'archived');
      const remaining = (allProductionSharedLots || []).filter(l => l.id !== currentLot.id && l.status !== 'archived');
      if (remaining.length) {
        setCurrentLotId(remaining[0].id);
      } else {
        setCurrentLotId('');
      }
    } catch (err) {
      console.error('Erreur lors de l archivage automatique:', err);
    }
  };

  // Save production data for public viewing
  const handleSavePublic = async () => {
    setIsSaving(true);
    try {
      const currentData = getCurrentFormData();
      const currentLot = getCurrentLot();

      const data = {
        lotData: currentLot,
        formData: currentData,
        savedAt: new Date().toISOString(),
      };
      await setDoc(doc(firestore, 'production_suivi', currentLot?.id || 'current'), data);

      if (currentLot) {
        await syncProductionToQuality(currentLot, currentData);
      }

      alert('Production enregistrée et visible publiquement !');
    } catch (e: any) {
      console.error('Erreur lors de la sauvegarde Firestore:', e);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // Sync production data to quality control system
  const syncProductionToQuality = async (currentLot: ProductionLot | null, currentData: any) => {
    if (!currentLot || !currentData) return;

    try {
      const totals = (currentData.productionRows || []).reduce((acc: any, row: any) => {
        return {
          poidsBrut: acc.poidsBrut + (parseFloat(row.poidsBrut) || 0),
          poidsNet: acc.poidsNet + (parseFloat(row.poidsNet) || 0),
          nbrCP: acc.nbrCP + (parseInt(row.nbrCP) || 0),
        };
      }, { poidsBrut: 0, poidsNet: 0, nbrCP: 0 });

      const lotNumbers = (currentData.productionRows || [])
        .map((row: any) => row.numeroLotInterne)
        .filter((num: string) => num && num.trim() !== '');

      const existingLots = await getQualityControlLots('controller');
      const existingLot = existingLots.find(lot =>
        lot.lotNumber === currentLot.lotNumber ||
        lot.formData.clientLot === currentData.headerData?.numeroLotClient
      );

      const productionConstants = {
        poidsBrut: totals.poidsBrut,
        poidsNet: totals.poidsNet,
        nombreCP: totals.nbrCP,
        numeroLotsInternes: lotNumbers,
        nombrePalettes: currentData.nombrePalettes || '',
        typeProduction: currentData.headerData?.typeProduction || '',
        variete: currentData.headerData?.variete || ''
      };

      if (existingLot) {
        const updatedFormData = {
          ...existingLot.formData,
          productionConstants,
          date: existingLot.formData.date || currentData.headerData?.date || new Date().toISOString().split('T')[0],
          product: existingLot.formData.product || currentData.headerData?.produit || '',
          clientLot: existingLot.formData.clientLot || currentData.headerData?.numeroLotClient || '',
        };

        const updatedLot = {
          ...existingLot,
          formData: updatedFormData,
          updatedAt: new Date().toISOString(),
          productionSynced: true,
          productionLotId: currentLot.id
        };

        await saveQualityControlLot(updatedLot);
      } else {
        const qualityControlData = {
          id: `prod_${currentLot.id}_${Date.now()}`,
          lotNumber: currentLot.lotNumber,
          formData: {
            date: currentData.headerData?.date || new Date().toISOString().split('T')[0],
            product: currentData.headerData?.produit || '',
            variety: currentData.headerData?.variete || 'Avocado',
            campaign: new Date().getFullYear().toString(),
            clientLot: currentData.headerData?.numeroLotClient || '',
            shipmentNumber: '',
            packagingType: '',
            category: '',
            exporterNumber: '',
            frequency: '',
            productionConstants,
            palettes: []
          },
          images: [],
          status: 'draft' as const,
          phase: 'controller' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          controller: 'Production Team',
          productionSynced: true,
          productionLotId: currentLot.id
        };

        await saveQualityControlLot(qualityControlData);
      }

    } catch (error) {
      console.error('Error syncing production data to quality control:', error);
    }
  };

  // Auto-select first lot if none selected
  useEffect(() => {
    if (!currentLotId && productionLots.length > 0) {
      setCurrentLotId(productionLots[0].id);
    } else if (currentLotId && !productionLots.find(lot => lot.id === currentLotId)) {
      if (productionLots.length > 0) {
        setCurrentLotId(productionLots[0].id);
      } else {
        setCurrentLotId('');
      }
    }
  }, [productionLots, currentLotId]);

  // Save lots to localStorage
  useEffect(() => {
    if (productionLots.length > 0) {
      localStorage.setItem('production_lots', JSON.stringify(productionLots));
    } else {
      localStorage.removeItem('production_lots');
    }
  }, [productionLots]);

  // Cleanup effect
  useEffect(() => {
    if (currentLotId && productionLots.length === 0) {
      setCurrentLotId('');
    }
  }, [currentLotId, productionLots]);

  // Auto-sync production data to quality control
  useEffect(() => {
    const currentLot = getCurrentLot();
    const currentData = getCurrentFormData();

    if (currentLot && currentData && currentData.productionRows) {
      const hasRelevantData = currentData.productionRows.some((row: any) =>
        row.poidsBrut || row.poidsNet || row.numeroLotInterne
      );

      if (hasRelevantData) {
        const timeoutId = setTimeout(async () => {
          try {
            await syncProductionToQuality(currentLot, currentData);
          } catch (error) {
            console.error('Auto-sync error:', error);
          }
        }, 2000);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [productionLots, currentLotId]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showLotManagement && event.target &&
        !(event.target as Element).closest('.lot-management-dropdown')) {
        setShowLotManagement(false);
      }
    };

    if (showLotManagement) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showLotManagement]);

  const totals = calculateTotals();
  const currentData = getCurrentFormData();
  const currentLot = getCurrentLot();

  if (loading) {
    return <div className="p-8 text-center text-lg text-gray-600">Chargement des données...</div>;
  }
  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  if (productionLots.length === 0) {
    return (
      <div className="bg-gray-100 min-h-screen p-4 md:p-6">
        <div className="max-w-7xl mx-auto bg-white border border-gray-400 p-6">
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Aucun lot de production</h2>
            <p className="text-gray-500 mb-6">Créez votre premier lot de production pour commencer</p>
            <button
              onClick={createNewLot}
              className="flex items-center gap-2 bg-[#1f2a38] text-white px-6 py-3 hover:bg-[#2a384a] transition-all mx-auto font-semibold"
            >
              <Plus size={20} />
              Créer le premier lot
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white border border-gray-400 p-4 md:p-6">

        {/* Lot Management Header */}
        <div className="bg-white border-b border-gray-400 p-4 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-800">Suivi de la production - Multi-lots</h1>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                <div className="bg-[#1f2a38] text-white px-2 py-1 font-semibold">AVOCAT</div>
                <div className="bg-gray-200 text-gray-700 px-2 py-1">SMQ.ENR23</div>
                <div className="bg-gray-200 text-gray-700 px-2 py-1">Version: 01</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={createNewLot}
                className="flex items-center gap-2 bg-[#1f2a38] text-white px-4 py-2 hover:bg-[#2a384a] transition-all font-semibold"
              >
                <Plus size={20} />
                Nouveau Lot
              </button>
              <button
                onClick={() => setShowArchivePanel(!showArchivePanel)}
                className="flex items-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 hover:bg-gray-300 transition-all border border-gray-400 font-semibold"
              >
                <Archive size={18} />
                {showArchivePanel ? 'Masquer Archive' : 'Afficher Archive'}
                <ChevronDown size={16} className={`transform transition ${showArchivePanel ? 'rotate-180' : ''}`} />
              </button>
              <div className="relative">
                {lots.length > 3 && (
                  <>
                    <button
                      onClick={() => setShowLotManagement(!showLotManagement)}
                      className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 hover:bg-gray-700 transition-all font-semibold"
                    >
                      <Edit size={20} />
                      Gérer les Lots
                    </button>
                    {showLotManagement && (
                      <div className="lot-management-dropdown absolute right-0 top-full mt-2 bg-white border border-gray-400 z-10 min-w-64 shadow-lg">
                        <div className="p-3 border-b border-gray-400 bg-gray-50">
                          <div className="text-sm font-semibold text-gray-700">Gestion des lots</div>
                        </div>
                        <div className="p-2 max-h-60 overflow-y-auto">
                          {lots.map((lot) => (
                            <div key={lot.id} className="flex items-center justify-between p-2 hover:bg-gray-50">
                              <div className="flex items-center gap-2 min-w-0">
                                <Package size={14} className="text-gray-500 flex-shrink-0" />
                                {renamingLotId === lot.id ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <input
                                      type="text"
                                      value={newLotName}
                                      onChange={(e) => setNewLotName(e.target.value)}
                                      className="flex-1 px-2 py-1 text-sm border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none"
                                      placeholder="Nouveau nom"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          renameLot(lot.id, newLotName);
                                        } else if (e.key === 'Escape') {
                                          setRenamingLotId(null);
                                          setNewLotName('');
                                        }
                                      }}
                                    />
                                    <button
                                      onClick={() => renameLot(lot.id, newLotName)}
                                      disabled={isRenaming}
                                      className="px-2 py-1 bg-[#1f2a38] text-white text-xs hover:bg-[#2a384a] disabled:opacity-50"
                                    >
                                      {isRenaming ? '...' : '✓'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRenamingLotId(null);
                                        setNewLotName('');
                                      }}
                                      className="px-2 py-1 bg-gray-200 text-gray-700 text-xs hover:bg-gray-300"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-sm truncate">{lot.lotNumber}</span>
                                    <button
                                      onClick={() => {
                                        setRenamingLotId(lot.id);
                                        setNewLotName(lot.lotNumber);
                                      }}
                                      className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                      title="Renommer"
                                    >
                                      <Tag size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => duplicateLot(lot.id)}
                                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                  title="Dupliquer"
                                >
                                  <Copy size={14} />
                                </button>
                                {lots.length > 1 && (
                                  <button
                                    onClick={() => deleteLot(lot.id)}
                                    className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Lot Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
            {lots.map((lot) => (
              <div key={lot.id} className="flex items-center bg-gray-100 border border-gray-400 min-w-fit">
                <button
                  onClick={() => setCurrentLotId(lot.id)}
                  className={`px-4 py-2 flex items-center gap-2 transition-all min-w-0 ${currentLotId === lot.id
                      ? 'bg-[#1f2a38] text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <Package size={16} />
                  <span className="whitespace-nowrap">{lot.lotNumber}</span>
                  <span className={`px-2 py-1 text-xs border ${lot.status === 'termine' ? 'bg-green-100 text-green-800 border-green-300' :
                      lot.status === 'en_cours' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                        'bg-gray-100 text-gray-600 border-gray-300'
                    }`}>
                    {lot.status}
                  </span>
                </button>

                <div className="flex bg-gray-50 border-l border-gray-400">
                  <button
                    onClick={() => duplicateLot(lot.id)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors border-r border-gray-400"
                    title="Dupliquer ce lot"
                  >
                    <Copy size={16} />
                  </button>
                  {lots.length > 1 && (
                    <button
                      onClick={() => deleteLot(lot.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Supprimer ce lot"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

{showArchivePanel && archivedLots.length > 0 && (
  <div className="mb-8 p-4 bg-gray-50 border border-gray-400">
    <h2 className="text-lg font-semibold mb-4 text-gray-700 border-b border-gray-400 pb-2 flex items-center gap-2">
      <Archive className="h-5 w-5 text-gray-600" />
      Archivage - Anciens lots
    </h2>
    <div className="grid md:grid-cols-2 gap-4">
      {archivedLots.map((lot) => (
        <div key={lot.id} className="p-4 border border-gray-400 bg-white">
          <div className="flex justify-between items-start mb-3">
            {renamingLotId === lot.id ? (
              <div className="flex-1 mr-3">
                <input
                  type="text"
                  value={newLotName}
                  onChange={(e) => setNewLotName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none"
                  placeholder="Nouveau nom du lot"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameLot(lot.id, newLotName);
                    } else if (e.key === 'Escape') {
                      setRenamingLotId(null);
                      setNewLotName('');
                    }
                  }}
                />
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate text-lg">{lot.lotNumber}</div>
                <div className="text-sm text-gray-500 mt-1">
                  Archivé le: {lot.updatedAt ? new Date(lot.updatedAt).toLocaleDateString('fr-FR') : 'N/A'}
                </div>
                {lot.productionData?.headerData?.date && (
                  <div className="text-sm text-gray-500">
                    Date production: {lot.productionData.headerData.date}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {renamingLotId === lot.id ? (
                <>
                  <button
                    onClick={() => renameLot(lot.id, newLotName)}
                    disabled={isRenaming}
                    className="px-3 py-1 bg-green-600 text-white text-sm hover:bg-green-700 font-semibold flex items-center gap-1"
                  >
                    {isRenaming ? (
                      <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                    ) : (
                      '✓'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setRenamingLotId(null);
                      setNewLotName('');
                    }}
                    className="px-3 py-1 bg-gray-200 text-gray-700 text-sm hover:bg-gray-300 font-semibold"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setRenamingLotId(lot.id);
                      setNewLotName(lot.lotNumber);
                    }}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                    title="Modifier le titre"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => restoreLot(lot.id)}
                    className="px-3 py-1 bg-green-600 text-white text-sm hover:bg-green-700 font-semibold"
                    title="Restaurer"
                  >
                    Restaurer
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Supprimer définitivement ce lot archivé ?')) deleteLot(lot.id);
                    }}
                    className="px-3 py-1 bg-red-600 text-white text-sm hover:bg-red-700 font-semibold"
                    title="Supprimer définitivement"
                  >
                    Supprimer
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Show production summary for archived lots */}
          {lot.productionData && (
            <div className="mt-3 pt-3 border-t border-gray-300 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-medium">Produit:</span> {lot.productionData.headerData?.produit || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Variété:</span> {lot.productionData.headerData?.variete || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Palettes:</span> {lot.productionData.nombrePalettes || '0'}
                </div>
                <div>
                  <span className="font-medium">Type:</span> {lot.productionData.headerData?.typeProduction || 'N/A'}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)}

        {/* Display saved rapports */}
        {filteredRapports.length > 0 && (
          <div className="mb-8 p-4 bg-blue-50 border border-blue-400">
            <h2 className="text-lg font-semibold mb-4 text-gray-700 border-b border-blue-400 pb-2">
              Rapports de production sauvegardés
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {filteredRapports.map((rapport, idx) => (
                <div key={idx} className="p-4 border border-gray-400 bg-white">
                  <div className="font-medium mb-2">
                    Date: {rapport.headerData?.date} | Produit: {rapport.headerData?.produit}
                  </div>
                  <div className="mb-2">Lot Client: {rapport.headerData?.numeroLotClient}</div>
                  <div className="text-sm text-gray-600">
                    Palettes: {rapport.nombrePalettes}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-6 border-b border-gray-400">
          <div className="space-y-4 w-full md:w-auto">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-gray-100 border border-gray-400">
                <Package className="h-6 w-6 text-gray-700" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">Suivi de la production</h1>
                <p className="text-lg font-semibold text-gray-700">AVOCAT</p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl mt-6">
              <div className="p-4 bg-gray-50 border border-gray-400 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={currentData.headerData?.date || ''}
                    onChange={(e) => handleHeaderChange('date', e.target.value)}
                    className="w-full p-2.5 border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Produit</label>
                  <input
                    type="text"
                    value={currentData.headerData?.produit || ''}
                    onChange={(e) => handleHeaderChange('produit', e.target.value)}
                    className="w-full p-2.5 border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-400 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">N° LOT CLIENT</label>
                  <input
                    type="text"
                    value={currentData.headerData?.numeroLotClient || ''}
                    onChange={(e) => handleHeaderChange('numeroLotClient', e.target.value)}
                    placeholder="Entrer le numéro de lot client"
                    className="w-full p-2.5 border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Variété</label>
                  <select
                    value={currentData.headerData?.variete || ''}
                    onChange={(e) => handleHeaderChange('variete', e.target.value)}
                    className="w-full p-2.5 border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                  >
                    <option value="">Sélectionner une variété</option>
                    {varietesAvocat.map((variete) => (
                      <option key={variete} value={variete}>{variete}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-400 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre des palettes</label>
                  <input
                    type="number"
                    value={currentData.nombrePalettes || ''}
                    onChange={(e) => handleNombrePalettesChange(e.target.value)}
                    placeholder="Nombre de palettes"
                    className="w-full p-2.5 border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                  />
                </div>
                <div className="p-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Type de production</label>
                  <div className="space-y-2">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="CONVENTIONNEL"
                        checked={currentData.headerData?.typeProduction === 'CONVENTIONNEL'}
                        onChange={(e) => handleHeaderChange('typeProduction', e.target.value)}
                        className="form-radio border-gray-400 focus:border-[#1f2a38] focus:ring-[#1f2a38] h-4 w-4"
                      />
                      <span className="ml-2">CONVENTIONNEL</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="BIOLOGIQUE"
                        checked={currentData.headerData?.typeProduction === 'BIOLOGIQUE'}
                        onChange={(e) => handleHeaderChange('typeProduction', e.target.value)}
                        className="form-radio border-gray-400 focus:border-[#1f2a38] focus:ring-[#1f2a38] h-4 w-4"
                      />
                      <span className="ml-2">BIOLOGIQUE</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Calibre Section */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-400">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Calibres</h3>
              <div className="grid grid-cols-6 md:grid-cols-11 gap-3">
                {Object.keys(currentData.calibreData || {}).map(calibre => (
                  <div key={calibre} className="text-center">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      {calibre}
                    </label>
                    <input
                      type="number"
                      value={currentData.calibreData?.[parseInt(calibre) as keyof typeof currentData.calibreData] || 0}
                      onChange={(e) => handleCalibreChange(calibre, e.target.value)}
                      className="w-full p-2 text-center border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                      min="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 mt-6 md:mt-0 w-full md:w-auto">
            <button
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              className="flex items-center justify-center gap-2 bg-[#1f2a38] text-white px-4 md:px-6 py-3 hover:bg-[#2a384a] transition-all disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              {isGeneratingPDF ? (
                <>
                  <div className="animate-spin h-5 w-5 border-3 border-white border-t-transparent"></div>
                  Génération PDF...
                </>
              ) : (
                <>
                  <FilePlus size={20} />
                  Générer Rapport PDF
                </>
              )}
            </button>

            <button
              onClick={resetForm}
              className="flex items-center justify-center gap-2 bg-gray-600 text-white px-4 md:px-6 py-3 hover:bg-gray-700 transition-all font-semibold"
            >
              <RefreshCw size={20} />
              Réinitialiser
            </button>
            <button
              onClick={handleSave}
              className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 md:px-6 py-3 hover:bg-green-700 transition-all font-semibold"
            >
              <Save size={20} />
              Sauvegarder vers Rapport
            </button>
            <button
              onClick={handleSavePublic}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 md:px-6 py-3 hover:bg-blue-700 transition-all font-semibold"
            >
              <Save size={20} />
              Sauvegarder & Rendre Public
            </button>
          </div>
        </div>

        {showSuccessMessage && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-600 text-green-700 p-4 flex items-center">
            <div className="bg-green-100 p-1 mr-3">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <span className="font-semibold">Rapport PDF généré avec succès!</span>
          </div>
        )}

        {/* Production Table */}
        <div className="bg-white border border-gray-400 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-400">
              <thead className="bg-[#1f2a38] text-white">
                <tr>
                  <th className="px-3 py-4 text-left text-xs font-semibold uppercase tracking-wider border-r border-gray-600">N° P</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold uppercase tracking-wider border-r border-gray-600">Date</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold uppercase tracking-wider border-r border-gray-600">Heure</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold uppercase tracking-wider border-r border-gray-600">Calibre</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold uppercase tracking-wider border-r border-gray-600">Poids brut (Kg)</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold uppercase tracking-wider border-r border-gray-600">Poids net (Kg)</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold uppercase tracking-wider border-r border-gray-600">N° lot Interne</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold uppercase tracking-wider border-r border-gray-600">Nbr C/P</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold uppercase tracking-wider border-r border-gray-600">Chambre froide</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold uppercase tracking-wider border-r border-gray-600">Décision</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-400">
                {(currentData.productionRows || []).map((row: any, rowIndex: number) => (
                  <tr key={rowIndex}
                    className={`group hover:bg-gray-50 transition-colors ${rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      } ${focusedCell?.row === rowIndex ? 'ring-2 ring-[#1f2a38] ring-inset' : ''
                      }`}>
                    <td className="px-3 py-2 border-r border-gray-400 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.numero}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-400">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => handleRowChange(rowIndex, 'date', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
                        onFocus={() => setFocusedCell({ row: rowIndex, col: 0 })}
                        className={`w-full p-1.5 text-sm border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none ${focusedCell?.row === rowIndex && focusedCell?.col === 0 ? 'bg-blue-50' : 'bg-white'
                          }`}
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-gray-400">
                      <input
                        type="time"
                        value={row.heure}
                        onChange={(e) => handleRowChange(rowIndex, 'heure', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
                        onFocus={() => setFocusedCell({ row: rowIndex, col: 1 })}
                        className={`w-full p-1.5 text-sm border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none ${focusedCell?.row === rowIndex && focusedCell?.col === 1 ? 'bg-blue-50' : 'bg-white'
                          }`}
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-gray-400">
                      <input
                        type="text"
                        value={row.calibre}
                        onChange={(e) => handleRowChange(rowIndex, 'calibre', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 2)}
                        onFocus={() => setFocusedCell({ row: rowIndex, col: 2 })}
                        placeholder="ex: 14-16"
                        className={`w-full p-1.5 text-sm border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none ${focusedCell?.row === rowIndex && focusedCell?.col === 2 ? 'bg-blue-50' : 'bg-white'
                          }`}
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-gray-400">
                      <input
                        type="number"
                        value={row.poidsBrut}
                        onChange={(e) => handleRowChange(rowIndex, 'poidsBrut', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 3)}
                        onFocus={() => setFocusedCell({ row: rowIndex, col: 3 })}
                        step="0.1"
                        className={`w-full p-1.5 text-sm border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none ${focusedCell?.row === rowIndex && focusedCell?.col === 3 ? 'bg-blue-50' : 'bg-white'
                          }`}
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-gray-400">
                      <input
                        type="number"
                        value={row.poidsNet}
                        readOnly
                        className="w-full p-1.5 text-sm border border-gray-400 bg-green-50 text-green-700 font-medium"
                        title="Calculé automatiquement: Poids Brut - Réduction"
                        placeholder="Calculé auto"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-gray-400">
                      <input
                        type="text"
                        value={row.numeroLotInterne}
                        onChange={(e) => handleRowChange(rowIndex, 'numeroLotInterne', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 4)}
                        onFocus={() => setFocusedCell({ row: rowIndex, col: 4 })}
                        className={`w-full p-1.5 text-sm border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none ${focusedCell?.row === rowIndex && focusedCell?.col === 4 ? 'bg-blue-50' : 'bg-white'
                          }`}
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-gray-400">
                      <select
                        value={row.nbrCP}
                        onChange={(e) => handleRowChange(rowIndex, 'nbrCP', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 5)}
                        onFocus={() => setFocusedCell({ row: rowIndex, col: 5 })}
                        className={`w-full p-1.5 text-sm border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white ${focusedCell?.row === rowIndex && focusedCell?.col === 5 ? 'bg-blue-50' : ''
                          }`}
                      >
                        <option value="">Sélectionner</option>
                        {CAISSE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-400">
                      <select
                        value={row.chambreFroide}
                        onChange={(e) => handleRowChange(rowIndex, 'chambreFroide', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 6)}
                        onFocus={() => setFocusedCell({ row: rowIndex, col: 6 })}
                        className={`w-full p-1.5 text-sm border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white ${focusedCell?.row === rowIndex && focusedCell?.col === 6 ? 'bg-blue-50' : ''
                          }`}
                      >
                        <option value="">Sélectionner</option>
                        {chambresFreides.map((chambre) => (
                          <option key={chambre} value={chambre}>{chambre}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-400">
                      <input
                        type="text"
                        value={row.decision}
                        onChange={(e) => handleRowChange(rowIndex, 'decision', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 7)}
                        onFocus={() => setFocusedCell({ row: rowIndex, col: 7 })}
                        placeholder="Décision"
                        className={`w-full p-1.5 text-sm border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none ${focusedCell?.row === rowIndex && focusedCell?.col === 7 ? 'bg-blue-50' : 'bg-white'
                          }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-400">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">Raccourcis clavier:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-blue-700">
            <div>↑↓←→ : Navigation</div>
            <div>Tab : Cellule suivante</div>
            <div>Shift+Tab : Cellule précédente</div>
            <div>Enter : Ligne suivante</div>
          </div>
        </div>

        {/* Totals and Visas */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Totals */}
          <div className="p-6 bg-blue-50 border border-blue-400">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Totaux</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">TOTAL POIDS BRUT:</span>
                <span className="text-lg font-bold text-blue-600">{totals.poidsBrut.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold">POIDS NET:</span>
                <span className="text-lg font-bold text-blue-600">{totals.poidsNet.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold">NBR DE C/P:</span>
                <span className="text-lg font-bold text-blue-600">{totals.nbrCP}</span>
              </div>
            </div>
          </div>

          {/* Visas */}
          <div className="p-6 bg-gray-50 border border-gray-400">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Visas</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Visa Directeur opérationnel
                </label>
                <input
                  type="text"
                  value={currentData.visas?.directeurOperationnel || ''}
                  onChange={(e) => handleVisaChange('directeurOperationnel', e.target.value)}
                  className="w-full p-2 border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Visa contrôleur de Qualité
                </label>
                <input
                  type="text"
                  value={currentData.visas?.controleurQualite || ''}
                  onChange={(e) => handleVisaChange('controleurQualite', e.target.value)}
                  className="w-full p-2 border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  VISA Responsable Qualité
                </label>
                <input
                  type="text"
                  value={currentData.visas?.responsableQualite || ''}
                  onChange={(e) => handleVisaChange('responsableQualite', e.target.value)}
                  className="w-full p-2 border border-gray-400 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-500">
            <Package className="h-4 w-4" />
            <span className="text-sm">Suivi de production automatique</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1 bg-green-100 text-green-800 border border-green-300 text-sm font-semibold">
              {(currentData.productionRows || []).filter((r: any) => r.date || r.poidsBrut || r.poidsNet).length} entrées
            </div>
            <span className="text-sm text-gray-500">avec données</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuiviProduction;