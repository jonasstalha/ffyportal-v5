import React, { useState, useEffect, useCallback } from 'react';
import { Save, FilePlus, RefreshCw, Check, Calendar, Package, User, Thermometer, Plus, Copy, X, Trash2, Edit, Archive } from 'lucide-react';
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
      variete: string;
      nbrCP: string;
      chambreFroide: string;
      decision: string;
      temperature?: string; // °C, e.g. "15.5"
      humidity?: string; // %, e.g. "70.5"
      weatherCondition?: string; // human readable condition
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
  // active shared lots (exclude archived)
  const lots = allProductionSharedLots.filter(l => l.status !== 'archived');
  const [currentLotId, setCurrentLotId] = useState<string>('');
  const [filteredRapports, setFilteredRapports] = useState<any[]>([]);

  // Legacy states for compatibility (now managed per lot)
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showLotManagement, setShowLotManagement] = useState(false);
  const [showArchivePanel, setShowArchivePanel] = useState(false);
  const loading = sharedLoading;
  const error = sharedError;

  const varietesAvocat = [
    'Hass', 'Fuerte', 'Pinkerton', 'Reed', 'Zutano', 'Bacon', 'Gwen', 'Lamb Hass'
  ];

  const chambresFreides = [
    'CF-01', 'CF-02', 'CF-03', 'CF-04', 'CF-05', 'CF-06'
  ];

  const decisions = [
    'ACCEPTÉ', 'REFUSÉ', 'EN ATTENTE', 'CONDITIONNEL'
  ];

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
          typeProduction: 'CONVENTIONNEL'
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
          variete: '',
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

  // Archived lots helper (from the complete set)
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
        typeProduction: 'CONVENTIONNEL'
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
        variete: '',
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

    // Merge with defaults to ensure all properties exist
    return {
      headerData: { ...defaultData.headerData, ...currentLot.formData.headerData },
      calibreData: { ...defaultData.calibreData, ...currentLot.formData.calibreData },
      nombrePalettes: currentLot.formData.nombrePalettes || defaultData.nombrePalettes,
      productionRows: currentLot.formData.productionRows || defaultData.productionRows,
      visas: { ...defaultData.visas, ...currentLot.formData.visas }
    };
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

  // Create new lot (Shared Service)
  const createNewLot = async () => {
    const formData = {
      headerData: {
        date: format(new Date(), 'yyyy-MM-dd'),
        produit: 'AVOCAT',
        numeroLotClient: '',
        typeProduction: 'CONVENTIONNEL'
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
        variete: '',
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

      // Also create a matching Quality Control lot so it appears in QC page
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
        console.warn('QC lot creation skipped (likely unauthenticated):', qcErr);
      }
    } catch (e) {
      console.error('Erreur lors de la création du lot:', e);
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
        // If current lot is being deleted, switch to another lot first
        if (currentLotId === lotId) {
          const remainingLots = productionLots.filter(lot => lot.id !== lotId);
          if (remainingLots.length > 0) {
            setCurrentLotId(remainingLots[0].id);
          } else {
            setCurrentLotId('');
          }
        }
        
        // Delete from shared service (this will trigger real-time updates)
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

  // Archive a production lot (soft-delete)
  const archiveLot = async (lotId: string) => {
    if (!window.confirm('Archiver ce lot ? Il restera disponible dans la section Archivage.')) return;
    try {
      await updateSharedLot(lotId, { status: 'archived' });
      // If current lot was archived, switch selection
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

const handleRowChange = async (rowIndex: number, field: string, value: string) => {
  const currentData = getCurrentFormData();
  const currentRows = currentData.productionRows || [];
  const newRows = [...currentRows];
  newRows[rowIndex] = {
    ...newRows[rowIndex],
    [field]: value,
  };

  // Update the shared lot service
  // Recalculate calibre counts when a calibre value changes
  try {
    const calibreKeys = Object.keys(currentData.calibreData || {});
    const newCalibreData: any = {};
    // Initialize counts to 0
    calibreKeys.forEach(k => { newCalibreData[k] = 0; });

    // Count occurrences of each calibre in the production rows
    for (const r of newRows) {
      if (!r || !r.calibre) continue;
      const calibreValue = String(r.calibre || '').trim();
      if (!calibreValue) continue;

      for (const k of calibreKeys) {
        // Match as a standalone token (e.g., '12' in '12' or '12-14')
        try {
          const re = new RegExp(`\\b${k}\\b`);
          if (re.test(calibreValue)) {
            newCalibreData[k] = (newCalibreData[k] || 0) + 1;
          }
        } catch (e) {
          // fallback exact match
          if (calibreValue === k) {
            newCalibreData[k] = (newCalibreData[k] || 0) + 1;
          }
        }
      }
    }

    // Persist both updated rows and calibreData
    updateCurrentLotData({ productionRows: newRows, calibreData: newCalibreData });
  } catch (err) {
    console.error('Error updating rows/calibre counts:', err);
    updateCurrentLotData({ productionRows: newRows });
  }

  // Try to update Firestore if available (non-blocking)
  try {
    const lot = getCurrentLot();
    if (lot) {
      await updateDoc(doc(firestore, 'lots', lot.id), { productionRows: newRows });
    }
  } catch (e) {
    // ignore firestore update errors in this context
    console.debug('Firestore update skipped:', e);
  }
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
    
    // Check if productionRows exists and is an array
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

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const currentData = getCurrentFormData();
      const currentLot = getCurrentLot();
      
      // Safety check for productionRows
      if (!currentData || !currentData.productionRows || !Array.isArray(currentData.productionRows)) {
        console.error('Invalid production data - cannot generate PDF');
        setIsGeneratingPDF(false);
        return;
      }
      
      // Import jsPDF dynamically
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF('p', 'mm', 'a4');
      
      // Page dimensions and margins
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const contentWidth = pageWidth - (margin * 2);
      
      // Enhanced layout proportions with better spacing
      const headerHeight = 70;  // Enhanced header space
      const tableHeight = 150;  // Optimized table height
      const footerHeight = 60;  // Enhanced footer space
      
      // Professional color palette
      const colors = {
        primary: [46, 125, 50],      // Professional Green
        secondary: [129, 199, 132],   // Light Green
        accent: [27, 94, 32],        // Dark Green
        text: [33, 33, 33],          // Dark Gray
        lightText: [97, 97, 97],     // Medium Gray
        background: [248, 249, 250], // Light Background
        white: [255, 255, 255],      // White
        border: [224, 224, 224],     // Light Border
        headerBg: [200, 230, 201],   // Header Background
        tableBg: [232, 245, 233]     // Table Background
      };
      
      // Enhanced helper functions
      const drawRect = (x: number, y: number, w: number, h: number, fillColor?: number[], strokeColor?: number[], strokeWidth: number = 0.5) => {
        doc.setLineWidth(strokeWidth);
        if (fillColor) {
          doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
        }
        if (strokeColor) {
          doc.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
        }
        doc.rect(x, y, w, h, fillColor ? 'FD' : 'S');
      };
      
      const drawText = (text: string, x: number, y: number, fontSize: number, color: number[] = colors.text, align: 'left' | 'center' | 'right' = 'left', fontStyle: 'normal' | 'bold' = 'normal') => {
        doc.setFontSize(fontSize);
        doc.setTextColor(color[0], color[1], color[2]);
        if (fontStyle === 'bold') {
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFont('helvetica', 'normal');
        }
        doc.text(text, x, y, { align });
      };
      
      const drawBorder = (x: number, y: number, w: number, h: number, color: number[] = colors.border) => {
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(0.5);
        doc.rect(x, y, w, h, 'S');
      };
      
      // === ENHANCED HEADER SECTION ===
      let yPos = margin;
      
      // Main header with gradient effect simulation
      drawRect(margin, yPos, contentWidth, 35, colors.headerBg, colors.primary, 1);
      
      // Logo area with enhanced styling
      drawRect(margin + 5, yPos + 5, 25, 25, colors.white, colors.primary, 1);
      drawText('FRUITS', margin + 17.5, yPos + 15, 9, colors.primary, 'center', 'bold');
      drawText('FOR YOU', margin + 17.5, yPos + 22, 8, colors.primary, 'center', 'bold');
      
      // Main title with enhanced typography
      drawText('Suivi de la production', pageWidth / 2, yPos + 18, 18, colors.text, 'center', 'bold');
      drawText('AVOCAT', pageWidth / 2, yPos + 28, 16, colors.accent, 'center', 'bold');
      
      // Document info with better positioning
      const infoX = margin + contentWidth - 50;
      drawRect(infoX - 5, yPos + 3, 48, 29, colors.white, colors.border, 0.5);
      drawText('SMQ.ENR 23', infoX, yPos + 10, 9, colors.text, 'left', 'bold');
      drawText('Version : 01', infoX, yPos + 16, 8, colors.lightText);
      drawText('Date : 19/05/2023', infoX, yPos + 22, 8, colors.lightText);
      drawText(`Lot: ${currentLot?.lotNumber || 'N/A'}`, infoX, yPos + 28, 8, colors.primary, 'left', 'bold');
      
      yPos += 42;
      
      // Form information with enhanced layout
      drawRect(margin, yPos, contentWidth, 22, colors.background, colors.border, 0.5);
      
      // Three-column layout with better spacing
      const col1X = margin + 5;
      const col2X = margin + 68;
      const col3X = margin + 136;
      
      // Column 1 - Basic Info
      drawText('DATE :', col1X, yPos + 8, 10, colors.text, 'left', 'bold');
      drawText(currentData.headerData.date || 'N/A', col1X, yPos + 15, 10, colors.primary);
      
      // Column 2 - Product Info
      drawText('PRODUIT :', col2X, yPos + 8, 10, colors.text, 'left', 'bold');
      drawText(currentData.headerData.produit || 'N/A', col2X, yPos + 15, 10, colors.primary);
      
      // Column 3 - Lot Info
      drawText('N° LOT CLIENT :', col3X, yPos + 8, 10, colors.text, 'left', 'bold');
      drawText(currentData.headerData.numeroLotClient || 'N/A', col3X, yPos + 15, 10, colors.primary);
      
      // Production type with enhanced checkboxes
      const checkboxY = yPos + 8;
      drawText('☐', col1X, checkboxY + 12, 12, colors.primary);
      drawText('CONVENTIONNEL', col1X + 8, checkboxY + 12, 9, colors.text);
      drawText('☐', col2X, checkboxY + 12, 12, colors.primary);
      drawText('BIOLOGIQUE', col2X + 8, checkboxY + 12, 9, colors.text);
      
      const isConventionnel = currentData.headerData?.typeProduction === 'CONVENTIONNEL';
      if (isConventionnel) {
        drawText('☑', col1X, checkboxY + 12, 12, colors.primary);
      } else {
        drawText('☑', col2X, checkboxY + 12, 12, colors.primary);
      }
      
      // === ENHANCED MAIN TABLE SECTION ===
      yPos += 30;
      
      // Table headers with enhanced styling
      const headers = ['N° P', 'La date', 'Heure', 'Calibre', 'Poids brut (Kg)', 'Poids net (Kg)', 'N° de lot Interne', 'Variété', 'Nbr De C/P', 'Chambre froide (DISTIN)', 'DÉCISION'];
      const colWidths = [14, 18, 14, 16, 20, 18, 24, 16, 16, 26, 20];
      
      // Enhanced table header
      drawRect(margin, yPos, contentWidth, 12, colors.tableBg, colors.primary, 1);
      
      let xStart = margin;
      headers.forEach((header, index) => {
        // Draw column separators
        if (index > 0) {
          doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
          doc.setLineWidth(0.5);
          doc.line(xStart, yPos, xStart, yPos + 12);
        }
        
        // Center text in column
        const textX = xStart + (colWidths[index] / 2);
        drawText(header, textX, yPos + 7, 8, colors.text, 'center', 'bold');
        xStart += colWidths[index];
      });
      
      // Right border for header
      doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + 12);
      
      yPos += 12;
      
      // Enhanced table rows (26 rows)
      const rowHeight = (tableHeight - 20) / 26; // Optimized row height
      
      for (let i = 0; i < 26; i++) {
        const rowY = yPos + (i * rowHeight);
        const row = currentData.productionRows[i];
        
        // Enhanced alternating row colors
        if (i % 2 === 0) {
          drawRect(margin, rowY, contentWidth, rowHeight, colors.background);
        } else {
          drawRect(margin, rowY, contentWidth, rowHeight, colors.white);
        }
        
        // Row data with better formatting
        xStart = margin;
        const rowData = [
          (i + 1).toString(),
          row?.date || '',
          row?.heure || '',
          row?.calibre || '',
          row?.poidsBrut || '',
          row?.poidsNet || '',
          row?.numeroLotInterne || '',
          row?.variete || '',
          row?.nbrCP || '',
          row?.chambreFroide || '',
          row?.decision || ''
        ];
        
        rowData.forEach((data, colIndex) => {
          // Draw column separators
          if (colIndex > 0) {
            doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
            doc.setLineWidth(0.3);
            doc.line(xStart, rowY, xStart, rowY + rowHeight);
          }
          
          // Center text in column with proper spacing
          const textX = xStart + (colWidths[colIndex] / 2);
          const textY = rowY + (rowHeight / 2) + 1.5;
          
          // Special formatting for decision column
          if (colIndex === 10 && data) {
            const decisionColor = data === 'ACCEPTÉ' ? colors.primary : 
                                data === 'REFUSÉ' ? [211, 47, 47] : colors.text;
            drawText(data, textX, textY, 7, decisionColor, 'center', 'bold');
          } else {
            drawText(data, textX, textY, 7, colors.text, 'center');
          }
          
          xStart += colWidths[colIndex];
        });
        
        // Right border for row
        doc.line(margin + contentWidth, rowY, margin + contentWidth, rowY + rowHeight);
        
        // Bottom border for row
        doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, rowY + rowHeight, margin + contentWidth, rowY + rowHeight);
      }
      
      // Enhanced TOTAL row
      const totalY = yPos + (26 * rowHeight);
      drawRect(margin, totalY, contentWidth, rowHeight + 2, colors.tableBg, colors.primary, 1);
      
      const totals = calculateTotals();
      
      // Total labels and values with better positioning
      xStart = margin;
      const totalData = [
        'TOTAL',
        '',
        '',
        '',
        `${totals.poidsBrut.toFixed(2)}`,
        `${totals.poidsNet.toFixed(2)}`,
        '',
        '',
        `${totals.nbrCP}`,
        '',
        ''
      ];
      
      totalData.forEach((data, colIndex) => {
        if (colIndex > 0) {
          doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          doc.setLineWidth(0.5);
          doc.line(xStart, totalY, xStart, totalY + rowHeight + 2);
        }
        
        if (data) {
          const textX = xStart + (colWidths[colIndex] / 2);
          const textY = totalY + (rowHeight / 2) + 2;
          drawText(data, textX, textY, 9, colors.text, 'center', 'bold');
        }
        
        xStart += colWidths[colIndex];
      });
      
      // Right border for total
      doc.line(margin + contentWidth, totalY, margin + contentWidth, totalY + rowHeight + 2);
      
      // === ENHANCED FOOTER SECTION ===
      yPos = headerHeight + tableHeight + 15;
      
      // Enhanced calibre table
      drawRect(margin, yPos, contentWidth, 22, colors.background, colors.border, 0.5);
      
      drawText('Calibre', margin + 5, yPos + 8, 10, colors.text, 'left', 'bold');
      drawText('Nombre des palettes', margin + 5, yPos + 16, 10, colors.text, 'left', 'bold');
      
      const calibres = ['12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32'];
      const calibreWidth = 16;
      let calibreX = margin + 45;
      
      // Enhanced calibre grid
      calibres.forEach((calibre, index) => {
        // Calibre number cell
        drawRect(calibreX, yPos + 2, calibreWidth, 8, colors.white, colors.border, 0.5);
        drawText(calibre, calibreX + (calibreWidth / 2), yPos + 7, 8, colors.text, 'center', 'bold');
        
        // Calibre value cell
        drawRect(calibreX, yPos + 10, calibreWidth, 8, colors.white, colors.border, 0.5);
        const calibreValue = currentData.calibreData?.[parseInt(calibre) as keyof typeof currentData.calibreData] || 0;
        drawText(calibreValue.toString(), calibreX + (calibreWidth / 2), yPos + 15, 8, colors.primary, 'center', 'bold');
        
        calibreX += calibreWidth;
      });
      
      // Enhanced signatures section
      yPos += 30;
      
      const sigWidth = 62;
      const sigHeight = 22;
      const sigSpacing = 5;
      
      // Signature boxes with enhanced styling
      const signatures = [
        { label: 'Visa contrôleur de Qualité :', value: currentData.visas.controleurQualite || '' },
        { label: 'VISA Responsable Qualité :', value: currentData.visas.responsableQualite || '' },
        { label: 'Visa Directeur opérationnel :', value: currentData.visas.directeurOperationnel || '' }
      ];
      
      signatures.forEach((sig, index) => {
        const sigX = margin + (index * (sigWidth + sigSpacing));
        
        // Signature box with shadow effect
        drawRect(sigX + 1, yPos + 1, sigWidth, sigHeight, [240, 240, 240]); // Shadow
        drawRect(sigX, yPos, sigWidth, sigHeight, colors.white, colors.border, 0.8);
        
        // Signature label
        drawText(sig.label, sigX + 2, yPos + 6, 8, colors.text, 'left', 'bold');
        
        // Signature value or line
        if (sig.value) {
          drawText(sig.value, sigX + 2, yPos + 16, 9, colors.primary, 'left', 'bold');
        } else {
          // Draw signature line
          doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
          doc.setLineWidth(0.5);
          doc.line(sigX + 2, yPos + 16, sigX + sigWidth - 2, yPos + 16);
        }
      });
      
      // Enhanced footer with generation info
      yPos += 30;
      drawRect(margin, yPos, contentWidth, 8, colors.background, colors.border, 0.3);
      const footerText = `Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm')} - Système de Gestion Qualité FRUITS FOR YOU`;
      drawText(footerText, pageWidth / 2, yPos + 5, 8, colors.lightText, 'center');
      
      // Save PDF with enhanced filename
      const fileName = `Suivi_Production_${currentLot?.lotNumber?.replace(/\s+/g, '_') || 'Lot'}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
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
          typeProduction: 'CONVENTIONNEL'
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
          variete: '',
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

  // Save current lot data and send to rapport section
  const handleSave = async () => {
    const currentLot = getCurrentLot();
    if (!currentLot) return;

    // Update lot status to complete
    // First mark as complete then archive it so it moves out of active tabs
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

    // Save lots to localStorage
    localStorage.setItem('production_lots', JSON.stringify(lots));

    // Sync production data to quality control
    try {
      await syncProductionToQuality(currentLot, getCurrentFormData());
      alert('Lot sauvegardé avec succès et envoyé vers la section rapport! Données synchronisées avec le contrôle qualité.');
    } catch (error) {
      console.error('Error syncing to quality control:', error);
      alert('Lot sauvegardé avec succès mais erreur lors de la synchronisation avec le contrôle qualité.');
    }
    
    // Update filtered rapports to show current lot
    setFilteredRapports([rapportData]);

    // Archive the lot so it is moved to the archives section and removed from active tabs
    try {
      await updateLotStatus(currentLot.id, 'archived');
      // If the current lot is archived, switch to another active lot if available
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

  // Save production data for public viewing (now to Firestore)
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
      // Use current lot ID as document ID
      await setDoc(doc(firestore, 'production_suivi', currentLot?.id || 'current'), data);
      
      // Sync production data to quality control
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
      // Calculate totals from production rows
      const totals = (currentData.productionRows || []).reduce((acc: any, row: any) => {
        return {
          poidsBrut: acc.poidsBrut + (parseFloat(row.poidsBrut) || 0),
          poidsNet: acc.poidsNet + (parseFloat(row.poidsNet) || 0),
          nbrCP: acc.nbrCP + (parseInt(row.nbrCP) || 0),
        };
      }, { poidsBrut: 0, poidsNet: 0, nbrCP: 0 });

      // Extract lot numbers from production rows
      const lotNumbers = (currentData.productionRows || [])
        .map((row: any) => row.numeroLotInterne)
        .filter((num: string) => num && num.trim() !== '');

      // First, check if there's already a quality control lot with this lot number
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
        typeProduction: currentData.headerData?.typeProduction || ''
      };

      if (existingLot) {
        // Update existing quality control lot with production constants
        const updatedFormData = {
          ...existingLot.formData,
          productionConstants,
          // Update basic info if not already set
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
        console.log('✅ Updated existing quality control lot with production data');
      } else {
        // Create new quality control lot with production constants
        const qualityControlData = {
          id: `prod_${currentLot.id}_${Date.now()}`,
          lotNumber: currentLot.lotNumber,
          formData: {
            date: currentData.headerData?.date || new Date().toISOString().split('T')[0],
            product: currentData.headerData?.produit || '',
            variety: 'Avocado',
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
        console.log('✅ Created new quality control lot with production data');
      }
      
    } catch (error) {
      console.error('❌ Error syncing production data to quality control:', error);
    }
  };

  // Auto-select first lot if none selected or current lot no longer exists
  useEffect(() => {
    if (!currentLotId && productionLots.length > 0) {
      setCurrentLotId(productionLots[0].id);
    } else if (currentLotId && !productionLots.find(lot => lot.id === currentLotId)) {
      // Current lot was deleted, switch to first available lot or clear selection
      if (productionLots.length > 0) {
        setCurrentLotId(productionLots[0].id);
      } else {
        setCurrentLotId('');
      }
    }
  }, [productionLots, currentLotId]);

  // Save lots to localStorage whenever lots change (legacy compatibility)
  useEffect(() => {
    if (productionLots.length > 0) {
      localStorage.setItem('production_lots', JSON.stringify(productionLots));
    } else {
      // Clear localStorage if no lots exist
      localStorage.removeItem('production_lots');
    }
  }, [productionLots]);

  // Cleanup effect to handle edge cases when lots are deleted externally
  useEffect(() => {
    // If we have a currentLotId but no lots exist, clear the current selection
    if (currentLotId && productionLots.length === 0) {
      setCurrentLotId('');
    }
  }, [currentLotId, productionLots]);

  // Auto-sync production data to quality control when key fields change
  useEffect(() => {
    const currentLot = getCurrentLot();
    const currentData = getCurrentFormData();
    
    if (currentLot && currentData && currentData.productionRows) {
      // Check if any production rows have weight or lot number data
      const hasRelevantData = currentData.productionRows.some((row: any) => 
        row.poidsBrut || row.poidsNet || row.numeroLotInterne
      );
      
      if (hasRelevantData) {
        // Debounce the sync to avoid too many calls
        const timeoutId = setTimeout(async () => {
          try {
            await syncProductionToQuality(currentLot, currentData);
            console.log('🔄 Auto-synced production data to quality control');
          } catch (error) {
            console.error('Auto-sync error:', error);
          }
        }, 2000); // 2 second delay

        return () => clearTimeout(timeoutId);
      }
    }
  }, [productionLots, currentLotId]); // Re-run when lots or current lot changes

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

  // Handle case when no production lots exist
  if (productionLots.length === 0) {
    return (
      <div className="bg-gradient-to-b from-green-50 to-white min-h-screen p-4 md:p-6">
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl p-6">
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Aucun lot de production</h2>
            <p className="text-gray-500 mb-6">Créez votre premier lot de production pour commencer</p>
            <button
              onClick={createNewLot}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all mx-auto"
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
    <div className="bg-gradient-to-b from-green-50 to-white min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl p-6">
        
        {/* Lot Management Header */}
        <div className="bg-white border-b p-4 shadow-sm mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Suivi de la production - Multi-lots</h1>
            <div className="flex gap-3">
              <button
                onClick={createNewLot}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all"
              >
                <Plus size={20} />
                Nouveau Lot
              </button>
              <button
                onClick={() => setShowArchivePanel(!showArchivePanel)}
                className="flex items-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-all"
              >
                <Archive size={18} />
                Archivage
              </button>
              {/* Lot Management Dropdown for when there are many lots */}
              <div className="relative">
                {lots.length > 3 && (
                  <>
                    <button
                      onClick={() => setShowLotManagement(!showLotManagement)}
                      className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all"
                    >
                      <Edit size={20} />
                      Gérer les Lots
                    </button>
                    {showLotManagement && (
                      <div className="lot-management-dropdown absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-64">
                        <div className="p-2">
                          <div className="text-sm font-medium text-gray-700 mb-2 px-2 py-1">Supprimer des lots:</div>
                          {lots.map((lot) => (
                            <div key={lot.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                              <div className="flex items-center gap-2">
                                <Package size={14} />
                                <span className="text-sm">{lot.lotNumber}</span>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  lot.status === 'termine' ? 'bg-green-200 text-green-800' :
                                  lot.status === 'en_cours' ? 'bg-yellow-200 text-yellow-800' :
                                  'bg-gray-200 text-gray-600'
                                }`}>
                                  {lot.status}
                                </span>
                              </div>
                              {lots.length > 1 && (
                                <button
                                  onClick={() => {
                                    deleteLot(lot.id);
                                    setShowLotManagement(false);
                                  }}
                                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                  title="Supprimer ce lot"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Archive panel - accessible area (always possible to show) */}
                {showArchivePanel && (
                  <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-96 p-4">
                    <h3 className="text-sm font-semibold mb-2">Archivage - Anciens lots</h3>
                    {archivedLots.length === 0 ? (
                      <div className="text-sm text-gray-500">Aucun lot archivé pour le moment.</div>
                    ) : (
                      <div className="space-y-2">
                        {archivedLots.map(lot => (
                          <div key={lot.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                            <div>
                              <div className="font-medium text-sm">{lot.lotNumber}</div>
                              <div className="text-xs text-gray-500">Archivé: {lot.updatedAt ? new Date(lot.updatedAt).toLocaleString() : 'N/A'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => restoreLot(lot.id)} className="text-sm text-green-600">Restaurer</button>
                              <button onClick={() => { if (confirm('Supprimer définitivement ?')) deleteLot(lot.id); }} className="text-sm text-red-600">Suppr.</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lot Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
            {lots.map((lot) => (
              <div key={lot.id} className="flex items-center bg-gray-100 rounded-lg overflow-hidden min-w-fit">
                <button
                  onClick={() => setCurrentLotId(lot.id)}
                  className={`px-4 py-2 flex items-center gap-2 transition-all min-w-0 ${
                    currentLotId === lot.id
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Package size={16} />
                  <span className="whitespace-nowrap">{lot.lotNumber}</span>
                  <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                    lot.status === 'termine' ? 'bg-green-200 text-green-800' :
                    lot.status === 'en_cours' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {lot.status}
                  </span>
                </button>
                
                {/* Lot Actions - Always Visible */}
                <div className="flex bg-gray-50 border-l border-gray-200">
                  <button
                    onClick={() => duplicateLot(lot.id)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Dupliquer ce lot"
                  >
                    <Copy size={16} />
                  </button>
                  {lots.length > 1 && (
                    <button
                      onClick={() => deleteLot(lot.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors border-l border-gray-200"
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

        {/* Archivage - anciens lots */}
        {archivedLots.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2 flex items-center gap-2">
              <Archive className="h-5 w-5 text-gray-600" />
              Archivage - Anciens lots
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {archivedLots.map((lot) => (
                <div key={lot.id} className="p-4 border rounded-lg bg-gray-50 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{lot.lotNumber}</div>
                    <div className="text-sm text-gray-500">Archivé le: {lot.updatedAt ? new Date(lot.updatedAt).toLocaleString() : 'N/A'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => restoreLot(lot.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      title="Restaurer"
                    >
                      Restaurer
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Supprimer définitivement ce lot archivé ?')) deleteLot(lot.id);
                      }}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                      title="Supprimer définitivement"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Display saved rapports for the current lot */}
        {filteredRapports.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-green-700 border-b pb-2">
              Rapports de production sauvegardés
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {filteredRapports.map((rapport, idx) => (
                <div key={idx} className="mb-4 p-4 border rounded-lg bg-gray-50 shadow-sm">
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
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-6 border-b border-gray-200">
          <div className="space-y-4 w-full md:w-auto">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Suivi de la production</h1>
                <p className="text-lg font-semibold text-green-600">AVOCAT</p>
                <p className="text-sm text-gray-500 mt-1">
                  SMQ.ENR 23 - Version: 01 - Date: 19/05/2023
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl mt-6">
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={currentData.headerData?.date || ''}
                    onChange={(e) => handleHeaderChange('date', e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produit
                  </label>
                  <input
                    type="text"
                    value={currentData.headerData?.produit || ''}
                    onChange={(e) => handleHeaderChange('produit', e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    N° LOT CLIENT
                  </label>
                  <input
                    type="text"
                    value={currentData.headerData?.numeroLotClient || ''}
                    onChange={(e) => handleHeaderChange('numeroLotClient', e.target.value)}
                    placeholder="Entrer le numéro de lot client"
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre des palettes
                  </label>
                  <input
                    type="number"
                    value={currentData.nombrePalettes || ''}
                    onChange={(e) => handleNombrePalettesChange(e.target.value)}
                    placeholder="Nombre de palettes"
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Type de production
                </label>
                <div className="space-y-2">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="CONVENTIONNEL"
                      checked={currentData.headerData?.typeProduction === 'CONVENTIONNEL'}
                      onChange={(e) => handleHeaderChange('typeProduction', e.target.value)}
                      className="form-radio text-green-600 focus:ring-green-500 h-4 w-4"
                    />
                    <span className="ml-2">CONVENTIONNEL</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="BIOLOGIQUE"
                      checked={currentData.headerData?.typeProduction === 'BIOLOGIQUE'}
                      onChange={(e) => handleHeaderChange('typeProduction', e.target.value)}
                      className="form-radio text-green-600 focus:ring-green-500 h-4 w-4"
                    />
                    <span className="ml-2">BIOLOGIQUE</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Calibre Section */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Calibres</h3>
              <div className="grid grid-cols-6 md:grid-cols-11 gap-3">
                {Object.keys(currentData.calibreData || {}).map(calibre => (
                  <div key={calibre} className="text-center">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {calibre}
                    </label>
                    <input
                      type="number"
                      value={currentData.calibreData?.[parseInt(calibre) as keyof typeof currentData.calibreData] || 0}
                      onChange={(e) => handleCalibreChange(calibre, e.target.value)}
                      className="w-full p-2 text-center rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      min="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col gap-3 mt-6 md:mt-0">
            <button
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 disabled:bg-gray-400 disabled:transform-none shadow-lg hover:shadow-xl"
            >
              {isGeneratingPDF ? (
                <>
                  <div className="animate-spin h-5 w-5 border-3 border-white border-t-transparent rounded-full"></div>
                  Génération PDF...
                </>
              ) : (
                <>
                  <FilePlus size={20} />
                  Générer PDF
                </>
              )}
            </button>
            
            <button
              onClick={resetForm}
              className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <RefreshCw size={20} />
              Réinitialiser
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <Save size={20} />
              Sauvegarder vers Rapport
            </button>
            <button
              onClick={handleSavePublic}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <Save size={20} />
              Sauvegarder & Rendre Public
            </button>
          </div>
        </div>
        
        {showSuccessMessage && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-r-lg animate-fade-in flex items-center">
            <div className="bg-green-100 rounded-full p-1 mr-3">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <span>PDF généré avec succès!</span>
          </div>
        )}
        
        {/* Production Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">N° P</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Date</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Heure</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Calibre</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Poids brut (Kg)</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Poids net (Kg)</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">N° lot Interne</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Variété</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Nbr C/P</th>
                  <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Chambre froide</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(currentData.productionRows || []).map((row: any, rowIndex: number) => (
                  <tr key={rowIndex} 
                      className={`group hover:bg-green-50 transition-colors ${
                        rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      }`}>
                    <td className="px-3 py-2 border-r whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.numero}
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => handleRowChange(rowIndex, 'date', e.target.value)}
                        className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input
                        type="time"
                        value={row.heure}
                        onChange={(e) => handleRowChange(rowIndex, 'heure', e.target.value)}
                        className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input
                        type="text"
                        value={row.calibre}
                        onChange={(e) => handleRowChange(rowIndex, 'calibre', e.target.value)}
                        placeholder="ex: 14-16"
                        className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input
                        type="number"
                        value={row.poidsBrut}
                        onChange={(e) => handleRowChange(rowIndex, 'poidsBrut', e.target.value)}
                        step="0.1"
                        className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input
                        type="number"
                        value={row.poidsNet}
                        onChange={(e) => handleRowChange(rowIndex, 'poidsNet', e.target.value)}
                        step="0.1"
                        className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input
                        type="text"
                        value={row.numeroLotInterne}
                        onChange={(e) => handleRowChange(rowIndex, 'numeroLotInterne', e.target.value)}
                        className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <select
                        value={row.variete}
                        onChange={(e) => handleRowChange(rowIndex, 'variete', e.target.value)}
                        className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="">Sélectionner</option>
                        {varietesAvocat.map((variete) => (
                          <option key={variete} value={variete}>{variete}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 border-r">
                      <input
                        type="number"
                        value={row.nbrCP}
                        onChange={(e) => handleRowChange(rowIndex, 'nbrCP', e.target.value)}
                        className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </td>
                    <td className="px-3 py-2 border-r">
                      <select
                        value={row.chambreFroide}
                        onChange={(e) => handleRowChange(rowIndex, 'chambreFroide', e.target.value)}
                        className="w-full p-1.5 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="">Sélectionner</option>
                        {chambresFreides.map((chambre) => (
                          <option key={chambre} value={chambre}>{chambre}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Totals and Visas */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Totals */}
          <div className="p-6 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Totaux</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">TOTAL POIDS BRUT:</span>
                <span className="text-lg font-bold text-blue-600">{totals.poidsBrut.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">POIDS NET:</span>
                <span className="text-lg font-bold text-blue-600">{totals.poidsNet.toFixed(2)} Kg</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">NBR DE C/P:</span>
                <span className="text-lg font-bold text-blue-600">{totals.nbrCP}</span>
              </div>
            </div>
          </div>
          
          {/* Visas */}
          <div className="p-6 bg-green-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Visas</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visa Directeur opérationnel
                </label>
                <input
                  type="text"
                  value={currentData.visas?.directeurOperationnel || ''}
                  onChange={(e) => handleVisaChange('directeurOperationnel', e.target.value)}
                  className="w-full p-2 rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visa contrôleur de Qualité
                </label>
                <input
                  type="text"
                  value={currentData.visas?.controleurQualite || ''}
                  onChange={(e) => handleVisaChange('controleurQualite', e.target.value)}
                  className="w-full p-2 rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VISA Responsable Qualité
                </label>
                <input
                  type="text"
                  value={currentData.visas?.responsableQualite || ''}
                  onChange={(e) => handleVisaChange('responsableQualite', e.target.value)}
                  className="w-full p-2 rounded border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500"
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
            <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
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