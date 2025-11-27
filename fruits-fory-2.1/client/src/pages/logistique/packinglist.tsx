import React, { useState, useEffect, useRef } from 'react';
import { Save, FilePlus, RefreshCw, Check, Package, Truck, Plus, Copy, X, Trash2, Download, FileSpreadsheet, AlertCircle, Calendar, Weight, Box, MapPin, User, Shield, History, Eye, Calculator, Archive, ChevronDown, Search, Filter, Link2 } from 'lucide-react';

interface PalletRow {
  numero: number;
  produit: string;
  calibre: string;
  paletteNr: string;
  caissesPerPalette: string;
}

interface PackingListFormData {
  origin: {
    companyName: string;
    address: string;
    city: string;
  };
  destination: {
    companyName: string;
    address: string;
    city: string;
  };
  transport: {
    truckNumber: string;
    chauffeurNumber: string;
    transporteur: string;
    scelle: string;
  };
  technicalDetails: {
    dateProduction: string;
    dateDeparture: string;
    lotNumbers: string;
    ggn: string;
    orderNumber: string;
    poidsNetTotal: string;
    poidsBrutTotal: string;
  };
  palletRows: PalletRow[];
  calibreSummary: Record<string, { palettes: number; caisses: number }>;
  palletTypes: {
    type220: number;
    type264: number;
    type90: number;
    type210: number;
  };
}

interface PackingListLot {
  id: string;
  lotNumber: string;
  status: 'brouillon' | 'en_cours' | 'termine';
  linkedOrderId?: string;
  formData: PackingListFormData;
  createdAt: string;
  updatedAt: string;
}

const PackingListManager = () => {
  // Main state
  const [lots, setLots] = useState<PackingListLot[]>([]);
  const [currentLotId, setCurrentLotId] = useState<string>('');
  
  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCell, setSelectedCell] = useState<null | { row: number; field: string }>(null);
  const [showCalculations, setShowCalculations] = useState(true);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [showPriceConfig, setShowPriceConfig] = useState(false);
  
  // Invoice state
  const [invoicePrices, setInvoicePrices] = useState<Record<string, number>>({});
  const [invoiceQuantities, setInvoiceQuantities] = useState<Record<string, number>>({}); 
  
  const produits = ['AVOCAT HASS BIO', 'AVOCAT HASS CONV','AVOCAT ZUTANO BIO', 'AVOCAT ZUTANO CONV'];
  const calibres = ['12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32'];
  const caissepallete = ['90', '210', '220', '264'];

  // Weight constants per box (kg)
  const WEIGHT_PER_BOX = {
    net: 4.8,
    brut: 5.3
  };

  // Generate a styled invoice (facture) PDF matching the provided template
  const generateInvoice = async () => {
    if (!currentData || !currentLot) return;
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = 210;
    const margin = 10;
    let y = margin;

    // Colors
    const yellow = [255, 204, 0];
    const darkText: [number, number, number] = [30, 30, 30];

    // Top yellow header band
    doc.setFillColor(...yellow);
    doc.rect(0, 0, pageWidth, 30, 'F');

    // Logo area (left)
    try {
      // try loading a local logo if available
      const logoUrl = '/assets/logo.png';
      const res = await fetch(logoUrl).then(r => r.blob()).then(b => new Promise((res2, rej) => {
        const fr = new FileReader(); fr.onload = () => res2(fr.result); fr.onerror = rej; fr.readAsDataURL(b);
      }));
      if (res) {
        // small inset logo
        doc.addImage(String(res), 'PNG', margin + 4, 4, 36, 22);
      }
    } catch (e) {
      // fallback: draw company name in header
      doc.setFontSize(14);
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      doc.text('FRUITS FOR YOU', margin + 6, 18);
    }

    // Invoice title (right side)
    doc.setFontSize(18);
    doc.setTextColor(...darkText);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', pageWidth - margin - 60, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice Date: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin - 60, 18);
    doc.text(`Invoice #: ${currentLot.lotNumber}`, pageWidth - margin - 60, 23);

    y = 36;

    // From / To blocks
    const leftX = margin;
    const midX = pageWidth / 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('FROM:', leftX, y);
    doc.text('TO:', midX, y);
    doc.setFont('helvetica', 'normal');
    let fromY = y + 5;
    const fromLines = [
      'FRUITS FOR YOU S.A.R.L AU',
      currentData.origin.address || '',
      currentData.origin.city || ''
    ];
    fromLines.forEach(line => { doc.text(line, leftX, fromY); fromY += 5; });

    let toY = y + 5;
    const toLines = [
      currentData.destination.companyName || '',
      currentData.destination.address || '',
      currentData.destination.city || ''
    ];
    toLines.forEach(line => { doc.text(line, midX, toY); toY += 5; });

    y = Math.max(fromY, toY) + 6;

    // Table header - yellow
    const tableX = margin;
    const tableW = pageWidth - margin * 2;
    const colW = [tableW * 0.48, tableW * 0.12, tableW * 0.13, tableW * 0.12, tableW * 0.15];
    const colX = [tableX, tableX + colW[0], tableX + colW[0] + colW[1], tableX + colW[0] + colW[1] + colW[2], tableX + colW[0] + colW[1] + colW[2] + colW[3]];

    doc.setFillColor(...yellow);
    doc.rect(tableX, y, tableW, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkText);
    doc.setFontSize(10);
    doc.text('DESCRIPTION', colX[0] + 3, y + 7);
    doc.text('ORIGIN', colX[1] + 3, y + 7);
    doc.text('PRICE', colX[2] + 3, y + 7);
    doc.text('QUANTITIES', colX[3] + 3, y + 7);
    doc.text('AMOUNT', colX[4] + 3, y + 7);

    y += 12;

    // Aggregate rows by product+calibre+price
    const agg: Record<string, { produit: string; calibre: string; origin: string; price: number; qty: number; amount: number }> = {};
    // Build a map of aggregated quantities based on palletRows
    const rowQtyMap: Record<string, number> = {};
    (currentData.palletRows || []).forEach(r => {
      const produit = r.produit || '';
      const calibre = r.calibre || '';
      const caisses = parseInt(r.caissesPerPalette || '0') || 0;
      const key = `${produit}||${calibre}`;
      rowQtyMap[key] = (rowQtyMap[key] || 0) + caisses;
    });

    // For each product+calibre, prefer invoiceQuantities override if present, otherwise use aggregated row qtys
    const keys = Array.from(new Set([...
      Object.keys(rowQtyMap),
      ...Object.keys(invoiceQuantities || {})
    ]));

    keys.forEach(kpc => {
      const [produit, calibre] = kpc.split('||');
      const keyPriceOnly = `${produit}||${calibre}`;
      const manualPrice = invoicePrices[keyPriceOnly];
      const fallbackPrice = parseFloat(String(currentData.technicalDetails?.unitPrice ?? '33.5')) || 33.5;
      const price = typeof manualPrice === 'number' ? manualPrice : fallbackPrice;
      const qtyFromRows = rowQtyMap[keyPriceOnly] || 0;
      const qtyOverride = invoiceQuantities[keyPriceOnly];
      const qty = typeof qtyOverride === 'number' ? qtyOverride : qtyFromRows;
      const key = `${produit}||${calibre}||${price}`;
      if (!agg[key]) agg[key] = { produit, calibre, origin: 'MOROCCO', price, qty: 0, amount: 0 };
      agg[key].qty += qty;
      agg[key].amount += price * qty;
    });

    // Draw rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let rowIndex = 0;
    let totalQty = 0;
    let totalAmount = 0;
    for (const k of Object.keys(agg)) {
      const it = agg[k];
      const rowH = 8;
      // alternate row background
      if (rowIndex % 2 === 1) {
        doc.setFillColor(248, 248, 248);
        doc.rect(tableX, y - 1, tableW, rowH + 1, 'F');
      }

      // Description (wrap if necessary)
      const desc = `${it.produit} - ${it.calibre}`;
      doc.setTextColor(...darkText);
      doc.text(desc, colX[0] + 3, y + 6);
      doc.text(it.origin, colX[1] + 3, y + 6);
      doc.text(it.price.toFixed(2) + ' â‚¬', colX[2] + colW[2] / 2, y + 6, { align: 'center' });
      doc.text(String(it.qty), colX[3] + colW[3] / 2, y + 6, { align: 'center' });
      doc.text(it.amount.toFixed(2) + ' â‚¬', colX[4] + colW[4] - 3, y + 6, { align: 'right' });

      y += rowH + 2;
      rowIndex++;
      totalQty += it.qty;
      totalAmount += it.amount;

      if (y > 250) {
        doc.addPage();
        y = margin + 10;
      }
    }

    // Totals block
    y += 6;
    const totalsX = tableX + tableW - 80;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', totalsX, y);
    doc.text(String(totalQty), totalsX + 30, y, { align: 'center' });
    doc.text(totalAmount.toFixed(2) + ' â‚¬', totalsX + 70, y, { align: 'right' });

    // Transport fee (placeholder or from technicalDetails)
  const transportFee = parseFloat(String(currentData.technicalDetails?.transportFee ?? '5800')) || 5800;
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text('Transport Fee', totalsX, y);
    doc.text(transportFee.toFixed(2) + ' â‚¬', totalsX + 70, y, { align: 'right' });

    // Final total invoice
    const invoiceTotal = totalAmount + transportFee;
    y += 9;
    doc.setFillColor(...yellow);
    doc.rect(totalsX - 2, y - 6, 84, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkText);
    doc.text('TOTAL INVOICE', totalsX, y);
    doc.text(invoiceTotal.toFixed(2) + ' â‚¬', totalsX + 70, y, { align: 'right' });

    // Footer with bank details
    const footerY = 275;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Bank Name: BMCE', margin, footerY);
    doc.text('Account Number: 011 330 000012100007968 70', margin, footerY + 4);
    doc.text('IBAN: MA64 0113 3300 0012 1000 7968 70', margin, footerY + 8);
    doc.text('SWIFT: BMCEMAMC', margin, footerY + 12);

    const fileName = `Facture_${currentLot.lotNumber}_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(fileName);
  };

  const getCurrentLot = () => lots.find(lot => lot.id === currentLotId);
  const currentLot = getCurrentLot();
  const currentData = currentLot?.formData;

  // Real calculation function
  const calculateRealSummary = (rows) => {
    const calibreSummary = {};
    const palletTypes = { type220: 0, type264: 0, type90: 0, type210: 0 };
    let totalNet = 0;
    let totalBrut = 0;
    let totalPallets = 0;
    let totalBoxes = 0;

    rows.forEach(row => {
      if (row.calibre && row.caissesPerPalette) {
        const caisses = parseInt(row.caissesPerPalette) || 0;
        
        // Calibre summary
        if (!calibreSummary[row.calibre]) {
          calibreSummary[row.calibre] = { palettes: 0, caisses: 0 };
        }
        calibreSummary[row.calibre].palettes += 1;
        calibreSummary[row.calibre].caisses += caisses;

        // Pallet types count
        if (caisses === 220) palletTypes.type220++;
        else if (caisses === 264) palletTypes.type264++;
        else if (caisses === 90) palletTypes.type90++;
        else if (caisses === 210) palletTypes.type210++;

        // Weight calculations
        totalNet += caisses * WEIGHT_PER_BOX.net;
        totalBrut += caisses * WEIGHT_PER_BOX.brut;
        totalPallets++;
        totalBoxes += caisses;
      }
    });

    return {
      calibreSummary,
      palletTypes,
      poidsNetTotal: Math.round(totalNet).toString(),
      poidsBrutTotal: Math.round(totalBrut).toString(),
      totalPallets,
      totalBoxes
    };
  };

  // Update calculations when rows change
  useEffect(() => {
    if (currentData?.palletRows) {
      const calculations = calculateRealSummary(currentData.palletRows);
      setLots(prevLots => prevLots.map(lot => {
        if (lot.id === currentLotId) {
          return {
            ...lot,
            formData: {
              ...lot.formData,
              calibreSummary: calculations.calibreSummary,
              palletTypes: calculations.palletTypes,
              technicalDetails: {
                ...lot.formData.technicalDetails,
                poidsNetTotal: calculations.poidsNetTotal,
                poidsBrutTotal: calculations.poidsBrutTotal
              }
            },
            updatedAt: new Date().toISOString()
          };
        }
        return lot;
      }));
    }
  }, [currentData?.palletRows, currentLotId]);

  const updateField = (section, field, value) => {
    setLots(prevLots => prevLots.map(lot => {
      if (lot.id === currentLotId) {
        return {
          ...lot,
          formData: {
            ...lot.formData,
            [section]: {
              ...lot.formData[section],
              [field]: value
            }
          },
          updatedAt: new Date().toISOString()
        };
      }
      return lot;
    }));
  };

  const updateRow = (rowIndex, field, value) => {
    setLots(prevLots => prevLots.map(lot => {
      if (lot.id === currentLotId) {
        const newRows = [...lot.formData.palletRows];
        newRows[rowIndex] = { ...newRows[rowIndex], [field]: value };
        
        // Recalculate
        const calculations = calculateRealSummary(newRows);
        
        return {
          ...lot,
          formData: {
            ...lot.formData,
            palletRows: newRows,
            calibreSummary: calculations.calibreSummary,
            palletTypes: calculations.palletTypes,
            technicalDetails: {
              ...lot.formData.technicalDetails,
              poidsNetTotal: calculations.poidsNetTotal,
              poidsBrutTotal: calculations.poidsBrutTotal
            }
          },
          updatedAt: new Date().toISOString()
        };
      }
      return lot;
    }));
  };

  const addRow = () => {
    setLots(prevLots => prevLots.map(lot => {
      if (lot.id === currentLotId) {
        const newRows = [...lot.formData.palletRows, {
          numero: lot.formData.palletRows.length + 1,
          produit: 'AVOCAT HASS BIO',
          calibre: '16',
          paletteNr: (lot.formData.palletRows.length + 1).toString(),
          caissesPerPalette: '264'
        }];
        
        const calculations = calculateRealSummary(newRows);
        
        return {
          ...lot,
          formData: {
            ...lot.formData,
            palletRows: newRows,
            calibreSummary: calculations.calibreSummary,
            palletTypes: calculations.palletTypes,
            technicalDetails: {
              ...lot.formData.technicalDetails,
              poidsNetTotal: calculations.poidsNetTotal,
              poidsBrutTotal: calculations.poidsBrutTotal
            }
          }
        };
      }
      return lot;
    }));
  };

  const deleteRow = (rowIndex) => {
    setLots(prevLots => prevLots.map(lot => {
      if (lot.id === currentLotId) {
        const newRows = lot.formData.palletRows.filter((_, idx) => idx !== rowIndex);
        newRows.forEach((row, idx) => row.numero = idx + 1);
        
        const calculations = calculateRealSummary(newRows);
        
        return {
          ...lot,
          formData: {
            ...lot.formData,
            palletRows: newRows,
            calibreSummary: calculations.calibreSummary,
            palletTypes: calculations.palletTypes,
            technicalDetails: {
              ...lot.formData.technicalDetails,
              poidsNetTotal: calculations.poidsNetTotal,
              poidsBrutTotal: calculations.poidsBrutTotal
            }
          }
        };
      }
      return lot;
    }));
  };

  const createNewLot = () => {
    const newLot = {
      id: `lot-${Date.now()}`,
      lotNumber: `PL-2025-${String(lots.length + 1).padStart(3, '0')}`,
      status: 'brouillon',
      formData: {
        origin: { companyName: 'FRUITS FOR YOU', address: 'Lot NÂ°14 Rez De ChaussÃ©e Zone Industrielle', city: 'KÃ©nitra â€“ Maroc' },
        destination: { companyName: 'AZ FRANCE', address: '18 Rue du Puits Dixme, 94320 Thiais', city: 'France' },
        transport: { truckNumber: '', chauffeurNumber: '', transporteur: 'CAP MED', scelle: '' },
        technicalDetails: {
          dateProduction: new Date().toISOString().split('T')[0],
          dateDeparture: new Date().toISOString().split('T')[0],
          lotNumbers: '', ggn: '4063651496413', orderNumber: '',
          poidsNetTotal: '0', poidsBrutTotal: '0'
        },
        palletRows: Array.from({ length: 10 }, (_, i) => ({
          numero: i + 1, produit: 'AVOCAT HASS BIO', calibre: '16',
          paletteNr: (i + 1).toString(), caissesPerPalette: '264'
        })),
        calibreSummary: {}, palletTypes: { type220: 0, type264: 0, type90: 0, type210: 0 }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setLots([...lots, newLot]);
    setCurrentLotId(newLot.id);
    showSuccess('Nouveau lot crÃ©Ã© avec succÃ¨s!');
  };

  const duplicateLot = (lotId) => {
    const lotToDuplicate = lots.find(lot => lot.id === lotId);
    if (!lotToDuplicate) return;
    const newLot = {
      ...lotToDuplicate,
      id: `lot-${Date.now()}`,
      lotNumber: `${lotToDuplicate.lotNumber} (Copie)`,
      status: 'brouillon',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setLots([...lots, newLot]);
    setCurrentLotId(newLot.id);
    showSuccess('Lot dupliquÃ© avec succÃ¨s!');
  };

  const deleteLot = (lotId) => {
    if (lots.length <= 1) {
      alert('Vous ne pouvez pas supprimer le dernier lot');
      return;
    }
    if (window.confirm('ÃŠtes-vous sÃ»r de vouloir supprimer ce lot ?')) {
      const newLots = lots.filter(lot => lot.id !== lotId);
      setLots(newLots);
      if (currentLotId === lotId) {
        setCurrentLotId(newLots[0]?.id || '');
      }
      showSuccess('Lot supprimÃ© avec succÃ¨s!');
    }
  };

  const archiveLot = () => {
    setLots(prevLots => prevLots.map(lot => {
      if (lot.id === currentLotId) {
        return { ...lot, status: 'termine' };
      }
      return lot;
    }));
    showSuccess('Lot archivÃ© avec succÃ¨s!');
  };

  const resetForm = () => {
    if (window.confirm("ÃŠtes-vous sÃ»r de vouloir rÃ©initialiser ce lot?")) {
      setLots(prevLots => prevLots.map(lot => {
        if (lot.id === currentLotId) {
          return {
            ...lot,
            formData: {
              ...lot.formData,
              palletRows: Array.from({ length: 10 }, (_, i) => ({
                numero: i + 1, produit: 'AVOCAT HASS BIO', calibre: '16',
                paletteNr: (i + 1).toString(), caissesPerPalette: '264'
              }))
            }
          };
        }
        return lot;
      }));
      showSuccess('Lot rÃ©initialisÃ©!');
    }
  };

  // Generate PDF
  const generatePDF = async () => {
    if (!currentData || !currentLot) return;
    
    setIsGeneratingPDF(true);
    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF('p', 'mm', 'a4');
      
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      let yPos = margin;

      // Colors - Emerald theme
      const colors = {
        primary: [16, 185, 129],      // Emerald-500
        accent: [245, 158, 11],        // Amber-500
        text: [31, 41, 55],            // Gray-800
        lightText: [107, 114, 128],    // Gray-500
        border: [229, 231, 235]        // Gray-200
      };

      // Header
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('PACKING LIST', margin, 20);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('FRUITS FOR YOU - Plateforme Industrielle', margin, 30);
      
      // Lot number badge
      doc.setFillColor(...colors.accent);
      doc.roundedRect(pageWidth - margin - 50, 10, 50, 12, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(currentLot.lotNumber, pageWidth - margin - 25, 18, { align: 'center' });
      
      yPos = 50;

      // Info sections
      const drawSection = (title, x, y, width, data) => {
        doc.setFillColor(...colors.primary);
        doc.rect(x, y, width, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(title, x + width / 2, y + 5.5, { align: 'center' });
        
        doc.setFillColor(250, 250, 250);
        doc.rect(x, y + 8, width, 30, 'F');
        doc.setDrawColor(...colors.border);
        doc.rect(x, y, width, 38, 'S');
        
        doc.setTextColor(...colors.text);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        let textY = y + 15;
        data.forEach(line => {
          doc.text(line, x + 3, textY);
          textY += 6;
        });
      };

      const sectionWidth = (pageWidth - (3 * margin)) / 3;
      
      drawSection('ORIGINE', margin, yPos, sectionWidth, [
        currentData.origin.companyName,
        currentData.origin.address,
        currentData.origin.city
      ]);

      drawSection('DESTINATION', margin + sectionWidth + 5, yPos, sectionWidth, [
        currentData.destination.companyName,
        currentData.destination.address,
        currentData.destination.city
      ]);

      drawSection('TRANSPORT', margin + (sectionWidth + 5) * 2, yPos, sectionWidth, [
        `Camion: ${currentData.transport.truckNumber}`,
        `Chauffeur: ${currentData.transport.chauffeurNumber}`,
        `Transporteur: ${currentData.transport.transporteur}`,
        `ScellÃ©: ${currentData.transport.scelle}`
      ]);

      yPos += 45;

      // Technical details
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 35, 'F');
      doc.setDrawColor(...colors.border);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 35, 'S');
      
      doc.setTextColor(...colors.text);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('DÃ‰TAILS TECHNIQUES', margin + 5, yPos + 7);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const techY = yPos + 15;
      doc.text(`Production: ${currentData.technicalDetails.dateProduction}`, margin + 5, techY);
      doc.text(`DÃ©part: ${currentData.technicalDetails.dateDeparture}`, margin + 60, techY);
      doc.text(`Lot NÂ°: ${currentData.technicalDetails.lotNumbers}`, margin + 5, techY + 6);
      doc.text(`GGN: ${currentData.technicalDetails.ggn}`, margin + 60, techY + 6);
      doc.text(`Commande: ${currentData.technicalDetails.orderNumber}`, margin + 120, techY + 6);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.primary);
      doc.text(`Poids Net: ${currentData.technicalDetails.poidsNetTotal} KG`, margin + 5, techY + 12);
      doc.text(`Poids Brut: ${currentData.technicalDetails.poidsBrutTotal} KG`, margin + 60, techY + 12);

      yPos += 42;

      // Pallet table
      doc.setFillColor(...colors.primary);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('DÃ‰TAILS DES PALETTES', pageWidth / 2, yPos + 5.5, { align: 'center' });
      
      yPos += 8;

      // Table header
      const colWidths = [15, 70, 30, 30, 35];
      const headers = ['NÂ°', 'Produit', 'Calibre', 'Palette', 'Caisses'];
      
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
      doc.setTextColor(...colors.text);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      let xPos = margin;
      headers.forEach((header, i) => {
        doc.text(header, xPos + colWidths[i] / 2, yPos + 5, { align: 'center' });
        xPos += colWidths[i];
      });
      
      yPos += 7;

      // Table rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      currentData.palletRows.forEach((row, idx) => {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = margin;
        }

        const rowColor = idx % 2 === 0 ? [255, 255, 255] : [249, 250, 251];
        doc.setFillColor(...rowColor);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 6, 'F');
        doc.setDrawColor(...colors.border);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 6, 'S');
        
        doc.setTextColor(...colors.text);
        xPos = margin;
        const rowData = [row.numero, row.produit, row.calibre, row.paletteNr, row.caissesPerPalette];
        
        rowData.forEach((data, i) => {
          doc.text(String(data), xPos + colWidths[i] / 2, yPos + 4, { align: 'center' });
          xPos += colWidths[i];
        });
        
        yPos += 6;
      });

      yPos += 5;

      // Summary
      const calculations = calculateRealSummary(currentData.palletRows);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.text);
      doc.text('RÃ‰SUMÃ‰', margin, yPos + 5);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      yPos += 10;
      
      Object.entries(calculations.calibreSummary).forEach(([cal, data]) => {
        if (data.palettes > 0) {
          doc.text(`Calibre ${cal}: ${data.palettes} palettes, ${data.caisses} caisses`, margin + 5, yPos);
          yPos += 5;
        }
      });

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(...colors.lightText);
      doc.text(`GÃ©nÃ©rÃ© le ${new Date().toLocaleString('fr-FR')}`, margin, pageHeight - 10);
      doc.text('FRUITS FOR YOU Â© 2025', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Download
      doc.save(`PackingList_${currentLot.lotNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
      showSuccess('PDF gÃ©nÃ©rÃ© avec succÃ¨s!');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erreur lors de la gÃ©nÃ©ration du PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Generate Excel/CSV
  const generateExcel = () => {
    if (!currentData || !currentLot) return;
    
    setIsGeneratingExcel(true);
    try {
      let csv = 'PACKING LIST - FRUITS FOR YOU\n';
      csv += `Lot: ${currentLot.lotNumber}\n`;
      csv += `Date: ${new Date().toLocaleDateString('fr-FR')}\n\n`;
      
      csv += 'ORIGINE\n';
      csv += `${currentData.origin.companyName}\n`;
      csv += `${currentData.origin.address}\n`;
      csv += `${currentData.origin.city}\n\n`;
      
      csv += 'DESTINATION\n';
      csv += `${currentData.destination.companyName}\n`;
      csv += `${currentData.destination.address}\n`;
      csv += `${currentData.destination.city}\n\n`;
      
      csv += 'TRANSPORT\n';
      csv += `Truck NÂ°,${currentData.transport.truckNumber}\n`;
      csv += `Chauffeur NÂ°,${currentData.transport.chauffeurNumber}\n`;
      csv += `Transporteur,${currentData.transport.transporteur}\n`;
      csv += `ScellÃ©,${currentData.transport.scelle}\n\n`;
      
      csv += 'DETAILS TECHNIQUES\n';
      csv += `Date Production,${currentData.technicalDetails.dateProduction}\n`;
      csv += `Date Departure,${currentData.technicalDetails.dateDeparture}\n`;
      csv += `Lot Numbers,${currentData.technicalDetails.lotNumbers}\n`;
      csv += `GGN,${currentData.technicalDetails.ggn}\n`;
      csv += `Order NÂ°,${currentData.technicalDetails.orderNumber}\n`;
      csv += `Poids Net Total,${currentData.technicalDetails.poidsNetTotal} KG\n`;
      csv += `Poids Brut Total,${currentData.technicalDetails.poidsBrutTotal} KG\n\n`;
      
      csv += 'PALETTES\n';
      csv += 'NÂ°,Produit,Calibre,Palette Nr,Caisses/Palette\n';
      currentData.palletRows.forEach(row => {
        csv += `${row.numero},${row.produit},${row.calibre},${row.paletteNr},${row.caissesPerPalette}\n`;
      });
      
      csv += '\nCALIBRE SUMMARY\n';
      csv += 'Calibre,Palettes,Caisses\n';
      const calculations = calculateRealSummary(currentData.palletRows);
      Object.entries(calculations.calibreSummary).forEach(([cal, data]) => {
        if (data.palettes > 0) {
          csv += `${cal},${data.palettes},${data.caisses}\n`;
        }
      });
      
      csv += '\nPALLET TYPES\n';
      csv += `Type 90,${calculations.palletTypes.type90}\n`;
      csv += `Type 210,${calculations.palletTypes.type210}\n`;
      csv += `Type 220,${calculations.palletTypes.type220}\n`;
      csv += `Type 264,${calculations.palletTypes.type264}\n`;
      csv += `Total,${calculations.totalPallets}\n`;
      
      // Create download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `PackingList_${currentLot.lotNumber}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showSuccess('Fichier Excel gÃ©nÃ©rÃ© avec succÃ¨s!');
      
    } catch (error) {
      console.error('Error generating Excel:', error);
      alert('Erreur lors de la gÃ©nÃ©ration du fichier Excel');
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const getStatusConfig = (status) => {
    const configs = {
      brouillon: { label: 'Brouillon', bg: 'bg-gray-100', text: 'text-gray-700', ring: 'ring-gray-300' },
      en_cours: { label: 'En cours', bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-300' },
      termine: { label: 'TerminÃ©', bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-300' }
    };
    return configs[status] || configs.brouillon;
  };

  const saveData = () => {
    setIsSaving(true);
    // Simulate save to localStorage
    localStorage.setItem('packing_lists', JSON.stringify(lots));
    setTimeout(() => {
      setIsSaving(false);
      showSuccess('DonnÃ©es sauvegardÃ©es avec succÃ¨s!');
    }, 1000);
  };

  // Load from localStorage and set up real-time listener for changes
  useEffect(() => {
    // Initial load from localStorage
    const loadSavedLots = () => {
      const saved = localStorage.getItem('packing_lists');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0) {
            setLots(parsed);
            setCurrentLotId(parsed[0].id);
          }
        } catch (e) {
          console.error('Error loading saved data:', e);
        }
      }
    };

    // Load initial data
    loadSavedLots();

    // Set up storage event listener for real-time updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'packing_lists') {
        loadSavedLots();
      }
    };

    // Listen for changes from other components
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Load invoice prices from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('invoice_prices');
      if (raw) setInvoicePrices(JSON.parse(raw));
    } catch (e) {
      console.error('Failed to load invoice prices', e);
    }
  }, []);

  // Load invoice quantities from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('invoice_quantities');
      if (raw) setInvoiceQuantities(JSON.parse(raw));
    } catch (e) {
      console.error('Failed to load invoice quantities', e);
    }
  }, []);

  // Persist invoice prices when changed
  useEffect(() => {
    try {
      localStorage.setItem('invoice_prices', JSON.stringify(invoicePrices || {}));
    } catch (e) {
      console.error('Failed to save invoice prices', e);
    }
  }, [invoicePrices]);

  // Persist invoice quantities when changed
  useEffect(() => {
    try {
      localStorage.setItem('invoice_quantities', JSON.stringify(invoiceQuantities || {}));
    } catch (e) {
      console.error('Failed to save invoice quantities', e);
    }
  }, [invoiceQuantities]);

  // Helper function to map order status to packing list status
  const mapOrderStatusToPackingStatus = (orderStatus: string): PackingListLot['status'] => {
    switch (orderStatus) {
      case 'pending': return 'brouillon';
      case 'processing': return 'en_cours';
      case 'shipped':
      case 'delivered': return 'termine';
      default: return 'brouillon';
    }
  };

  // Function to sync with order status
  const syncWithOrder = (lot: PackingListLot) => {
    if (!lot.linkedOrderId) return lot;

    try {
      const orders = JSON.parse(localStorage.getItem('client-orders') || '[]');
      const linkedOrder = orders.find((o: any) => o.id === lot.linkedOrderId);
      
      if (linkedOrder) {
        return {
          ...lot,
          status: mapOrderStatusToPackingStatus(linkedOrder.status),
          formData: {
            ...lot.formData,
            destination: {
              ...lot.formData.destination,
              companyName: linkedOrder.clientName || lot.formData.destination.companyName,
            },
            technicalDetails: {
              ...lot.formData.technicalDetails,
              orderNumber: linkedOrder.orderNumber || lot.formData.technicalDetails.orderNumber,
            }
          }
        };
      }
    } catch (e) {
      console.error('Error syncing with order:', e);
    }
    return lot;
  };

  // Excel-style keyboard navigation
  // Function to sync packing lists with orders
  const syncWithOrders = () => {
    try {
      const orders = JSON.parse(localStorage.getItem('client-orders') || '[]');
      
      const updatedLots = lots.map(lot => {
        if (lot.linkedOrderId) {
          const linkedOrder = orders.find((o: any) => o.id === lot.linkedOrderId);
          if (linkedOrder) {
            return {
              ...lot,
              status: mapOrderStatusToPackingStatus(linkedOrder.status),
              formData: {
                ...lot.formData,
                destination: {
                  ...lot.formData.destination,
                  companyName: linkedOrder.clientName || lot.formData.destination.companyName,
                },
                technicalDetails: {
                  ...lot.formData.technicalDetails,
                  orderNumber: linkedOrder.orderNumber || lot.formData.technicalDetails.orderNumber,
                }
              }
            };
          }
        }
        return lot;
      });

      setLots(updatedLots);
      localStorage.setItem('packing_lists', JSON.stringify(updatedLots));
    } catch (e) {
      console.error('Error syncing with orders:', e);
    }
  };

  // Add auto-sync interval
  useEffect(() => {
    const interval = setInterval(syncWithOrders, 30000); // Sync every 30 seconds
    return () => clearInterval(interval);
  }, [lots]);

  const handleKeyDown = (e: any, rowIndex: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex < currentData.palletRows.length - 1) {
        setSelectedCell({ row: rowIndex + 1, field });
      }
    } else if (e.key === 'Escape') {
      setSelectedCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const fields = ['produit', 'calibre', 'paletteNr', 'caissesPerPalette'];
      const currentFieldIndex = fields.indexOf(field);
      const nextField = fields[currentFieldIndex + 1];
      if (nextField) {
        setSelectedCell({ row: rowIndex, field: nextField });
      } else if (rowIndex < currentData.palletRows.length - 1) {
        setSelectedCell({ row: rowIndex + 1, field: fields[0] });
      }
    }
  };

  const calculations = currentData ? calculateRealSummary(currentData.palletRows) : null;

  if (lots.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-md shadow-sm p-12 text-center">
            <div className="w-20 h-20 bg-emerald-600 rounded-md flex items-center justify-center mx-auto mb-6">
              <Package className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-semibold text-gray-900 mb-3">Aucune liste d'emballage</h2>
            <p className="text-gray-600 mb-8 text-lg">CrÃ©ez votre premiÃ¨re liste pour commencer Ã  gÃ©rer vos expÃ©ditions d'avocats</p>
            <button
              onClick={createNewLot}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 font-medium transition-colors"
            >
              <Plus size={20} />
              CrÃ©er la premiÃ¨re liste
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-600 rounded-md flex items-center justify-center shadow-sm">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Packing List Manager</h1>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500">
                    Plateforme industrielle d'exportation d'avocats â€¢ {lots.length} lot(s)
                  </p>
                  <div className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                    <Link2 className="h-4 w-4" />
                    <span>{lots.filter(l => l.linkedOrderId).length} linked to orders</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-emerald-600">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-xs">Auto-syncing with orders</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 font-medium transition-colors"
              >
                <History size={18} />
                <span className="hidden sm:inline">Historique</span>
              </button>
              <button
                onClick={createNewLot}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 font-medium transition-colors"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Nouvelle Liste</span>
              </button>
            </div>
          </div>

          {/* Lot Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {lots.map((lot) => {
              const statusConfig = getStatusConfig(lot.status);
              const isActive = currentLotId === lot.id;
              const isLinkedToOrder = !!lot.linkedOrderId;
              
              return (
                <div 
                  key={lot.id} 
                  className={`flex items-center rounded-md overflow-hidden min-w-fit transition-all ${
                    isActive ? 'ring-2 ring-emerald-500 shadow-sm' : 'shadow-sm'
                  } ${isLinkedToOrder ? 'border-l-4 border-l-blue-500' : ''}`}
                >
                  <button
                    onClick={() => setCurrentLotId(lot.id)}
                    className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {isLinkedToOrder ? <Link2 size={16} /> : <Truck size={16} />}
                    <div className="text-left">
                      <div className="font-medium text-sm whitespace-nowrap flex items-center gap-2">
                        {lot.lotNumber}
                        {isLinkedToOrder && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Linked</span>
                        )}</div>
                      <div className="text-xs opacity-75">{lot.formData.technicalDetails.orderNumber || 'Sans commande'}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-md font-medium ${
                      isActive ? 'bg-white/20 text-white' : `${statusConfig.bg} ${statusConfig.text}`
                    }`}>
                      {statusConfig.label}
                    </span>
                  </button>

                  <div className="flex bg-gray-50 border-l border-gray-200">
                    <button
                      onClick={() => duplicateLot(lot.id)}
                      className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="Dupliquer"
                      aria-label="Dupliquer le lot"
                    >
                      <Copy size={16} />
                    </button>
                    {lots.length > 1 && (
                      <button
                        onClick={() => deleteLot(lot.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors border-l border-gray-200"
                        title="Supprimer"
                        aria-label="Supprimer le lot"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {showSuccessMessage && (
        <div className="fixed top-20 right-6 z-50 bg-white border border-emerald-200 rounded-md shadow-lg p-4 flex items-center gap-3 animate-slide-in">
          <div className="w-8 h-8 bg-emerald-100 rounded-md flex items-center justify-center">
            <Check className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">SuccÃ¨s!</p>
            <p className="text-sm text-gray-600">{successMessage}</p>
          </div>
        </div>
      )}

      {/* History Sidebar */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setShowHistory(false)}>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <History size={20} />
                  Historique ({lots.length})
                </h2>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-100 rounded-md" aria-label="Fermer">
                  <X size={20} />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setHistoryFilter('all')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    historyFilter === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Tous ({lots.length})
                </button>
                <button
                  onClick={() => setHistoryFilter('termine')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    historyFilter === 'termine' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  ArchivÃ©s ({lots.filter(l => l.status === 'termine').length})
                </button>
              </div>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
              {lots
                .filter(lot => historyFilter === 'all' || lot.status === historyFilter)
                .map(lot => {
                  const statusConfig = getStatusConfig(lot.status);
                  return (
                    <div key={lot.id} className="p-4 border border-gray-200 rounded-md hover:border-emerald-300 cursor-pointer transition-colors" onClick={() => {
                      setCurrentLotId(lot.id);
                      setShowHistory(false);
                    }}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-gray-900">{lot.lotNumber}</div>
                        <span className={`px-2 py-1 text-xs rounded-md font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Commande: {lot.formData.technicalDetails.orderNumber || 'N/A'}</div>
                        <div>Palettes: {calculateRealSummary(lot.formData.palletRows).totalPallets}</div>
                        <div>ModifiÃ©: {new Date(lot.updatedAt).toLocaleDateString('fr-FR')}</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Action Bar */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPDF ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  GÃ©nÃ©ration...
                </>
              ) : (
                <>
                  <FilePlus size={18} />
                  GÃ©nÃ©rer PDF
                </>
              )}
            </button>
            
            <button 
              onClick={generateExcel}
              disabled={isGeneratingExcel}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingExcel ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  GÃ©nÃ©ration...
                </>
              ) : (
                <>
                  <FileSpreadsheet size={18} />
                  Excel
                </>
              )}
            </button>

            <button
              onClick={async () => {
                try {
                  setIsGeneratingPDF(true);
                  await generateInvoice();
                } catch (e) {
                  console.error('Invoice generation error', e);
                } finally {
                  setIsGeneratingPDF(false);
                }
              }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-medium transition-colors"
            >
              <FilePlus size={18} />
              GÃ©nÃ©rer Facture
            </button>
            <button
              onClick={() => setShowPriceConfig(!showPriceConfig)}
              className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-300 font-medium transition-colors"
            >
              <Calculator size={18} />
              Configurer Prix
            </button>
            
            <button 
              onClick={saveData}
              disabled={isSaving}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Sauvegarder
                </>
              )}
            </button>

            <button 
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 font-medium transition-colors"
            >
              <RefreshCw size={18} />
              RÃ©initialiser
            </button>
            
            <button 
              onClick={archiveLot}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-md hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-300 font-medium transition-colors"
            >
              <Archive size={18} />
              Archiver
            </button>

            <button
              onClick={() => setShowCalculations(!showCalculations)}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 font-medium transition-colors"
            >
              <Calculator size={18} />
              {showCalculations ? 'Masquer' : 'Afficher'} calculs
            </button>
          </div>
        </div>

        {/* Info Cards Grid */}
        {/* Price Config Panel */}
        {showPriceConfig && currentData && (
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Configurer les prix de la facture</h3>
                <div className="flex gap-2">
                  <button onClick={() => {
                    // reset prices
                    setInvoicePrices({});
                  }} className="px-3 py-1 bg-gray-100 rounded-md">RÃ©initialiser</button>
                    <button onClick={() => {
                      // Apply AVOCAT HASS BIO preset: calibres 12..32 step 2 with price 33.5
                      const presetCalibres = ['12','14','16','18','20','22','24','26','28','30','32'];
                      const newPrices: Record<string, number> = { ...(invoicePrices || {}) };
                      const newQuantities: Record<string, number> = { ...(invoiceQuantities || {}) };
                      // User-supplied quantities (from the request)
                      const supplied: Record<string, number> = {
                        '12': 0,
                        '14': 0,
                        '16': 748,
                        '18': 704,
                        '20': 748,
                        '22': 704,
                        '24': 748,
                        '26': 0,
                        '28': 0,
                        '30': 0,
                        '32': 0
                      };
                      presetCalibres.forEach(c => {
                        const key = `AVOCAT HASS BIO||${c}`;
                        // set price to 33.5 for all calibres
                        newPrices[key] = 33.5;
                        // set quantity to supplied value or 0 (ensures an entry exists for all calibres)
                        newQuantities[key] = typeof supplied[c] === 'number' ? supplied[c] : (newQuantities[key] || 0);
                      });
                      setInvoicePrices(newPrices);
                      setInvoiceQuantities(newQuantities);
                      // compute total applied
                      const totalApplied = Object.values(newQuantities).reduce((s, v) => s + (v || 0), 0);
                      const appliedList = presetCalibres.map(c => `${c}:${newQuantities[`AVOCAT HASS BIO||${c}`] || 0}`).join(', ');
                      showSuccess(`Prix 33.5â‚¬ appliquÃ©s. Total caisses: ${totalApplied} (${appliedList})`);
                    }} className="px-3 py-1 bg-emerald-600 text-white rounded-md">Importer quantitÃ©s AVOCAT</button>
                  <button onClick={() => setShowPriceConfig(false)} className="px-3 py-1 bg-emerald-600 text-white rounded-md">Fermer</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(() => {
                  const agg: Record<string, { produit: string; calibre: string; qty: number }> = {};
                  (currentData.palletRows || []).forEach(r => {
                    const produit = r.produit || '';
                    const calibre = r.calibre || '';
                    const caisses = parseInt(r.caissesPerPalette || '0') || 0;
                    const key = `${produit}||${calibre}`;
                    if (!agg[key]) agg[key] = { produit, calibre, qty: 0 };
                    agg[key].qty += caisses;
                  });

                  return Object.keys(agg).map(k => {
                    const it = agg[k];
                    const currentPrice = invoicePrices[k] ?? 33.5;
                    return (
                      <div key={k} className="flex items-center justify-between p-2 border rounded-md">
                        <div>
                          <div className="font-medium text-sm">{it.produit} - {it.calibre}</div>
                          <div className="text-xs text-gray-500">QuantitÃ©: {it.qty}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={String(currentPrice)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              setInvoicePrices(prev => ({ ...prev, [k]: v }));
                            }}
                            className="w-28 p-1 border rounded-md text-right"
                            step="0.01"
                          />
                          <span className="text-sm">â‚¬</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Origin Card */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-emerald-600 px-4 py-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-white" />
              <h3 className="font-semibold text-white">Origine</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Entreprise</label>
                <input
                  type="text"
                  value={currentData?.origin.companyName}
                  onChange={(e) => updateField('origin', 'companyName', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                  placeholder="Nom de l'entreprise"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Adresse</label>
                <input
                  type="text"
                  value={currentData?.origin.address}
                  onChange={(e) => updateField('origin', 'address', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Ville</label>
                <input
                  type="text"
                  value={currentData?.origin.city}
                  onChange={(e) => updateField('origin', 'city', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Destination Card */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-700 px-4 py-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-white" />
              <h3 className="font-semibold text-white">Destination</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Entreprise</label>
                <input
                  type="text"
                  value={currentData?.destination.companyName}
                  onChange={(e) => updateField('destination', 'companyName', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Adresse</label>
                <input
                  type="text"
                  value={currentData?.destination.address}
                  onChange={(e) => updateField('destination', 'address', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Ville</label>
                <input
                  type="text"
                  value={currentData?.destination.city}
                  onChange={(e) => updateField('destination', 'city', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Transport Card */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-amber-500 px-4 py-3 flex items-center gap-2">
              <Truck className="h-5 w-5 text-white" />
              <h3 className="font-semibold text-white">Transport</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Camion NÂ°</label>
                <input
                  type="text"
                  value={currentData?.transport.truckNumber}
                  onChange={(e) => updateField('transport', 'truckNumber', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Chauffeur NÂ°</label>
                <input
                  type="text"
                  value={currentData?.transport.chauffeurNumber}
                  onChange={(e) => updateField('transport', 'chauffeurNumber', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Transporteur</label>
                <input
                  type="text"
                  value={currentData?.transport.transporteur}
                  onChange={(e) => updateField('transport', 'transporteur', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">ScellÃ©</label>
                <input
                  type="text"
                  value={currentData?.transport.scelle}
                  onChange={(e) => updateField('transport', 'scelle', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-800 px-4 py-3 flex items-center gap-2">
            <Box className="h-5 w-5 text-white" />
            <h3 className="font-semibold text-white">DÃ©tails Techniques</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date Production</label>
              <input
                type="date"
                value={currentData?.technicalDetails.dateProduction}
                onChange={(e) => updateField('technicalDetails', 'dateProduction', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date DÃ©part</label>
              <input
                type="date"
                value={currentData?.technicalDetails.dateDeparture}
                onChange={(e) => updateField('technicalDetails', 'dateDeparture', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">NÂ° Lot</label>
              <input
                type="text"
                value={currentData?.technicalDetails.lotNumbers}
                onChange={(e) => updateField('technicalDetails', 'lotNumbers', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors font-mono"
              />
            <¨ƒx‹Å0‰[Şl¨$”ŒH–x‹
ÒR2L€P%6%"dÆ$µ0úBÑô3ø5]ÍZÈÑeE0ì#.+O­ªÂîù·®ûótz¼ü†uõC£††İ6œ›‹”©‚Ô%â%Ø\…š ìñz2{kEÑØ£ë8ù¯÷JÊ•šB~ã°&M2)¸t`×‡áE÷Œİú%ì\°ª)_Uª}@Şç¿óHè\E6pG¡<…¿3CÎN«^˜“ÔM Òíz?ºİG„ívÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø3kà69'±)Sáœ½g—«•™­Y%mjT<Í.¢ Öp<S®[UÆ,;¶™«­$,qTír|ÊĞŠÇce¹#ò&*ıhÁùgäûR<N,#©ÒqZW‡wºG|Å+˜Q¤ãõì1{¥
àvòTÁ[ôëöèÕµØòËuHå5dĞc!ÊKÒHAcÑ>¢¦YÏ”<ÆB)>o˜gĞÖNµäø¬¬bnr
œÆP2÷ãç2ŠFÊûñø»^“º±Lã‹+(l÷j»z}æ’Ğ¥BOc9¥]N÷\p2))ÖSPWš(ÌŸYÚ± ›æª‡>p×‹ŸÔ¡êëÏÉg¬q°S›ä ¹FØ·é9~ƒŸ®„»‹CE¨ …EÛ¿aóEH@õÏ"…‡Ïç¡Tà(ÏRë°–—Ôºá6RªÍ'yïÓÓ £#FqÍŠsTß¤ ËÔåL€’`-8ñk´ü&;²¥ë—½V	‹<—MCÁfE‰Ú8¢uİ'ÊüÄ–*¦¶5-8|áâ3iSà9·äŒÓt*ØÕÜÄj­èp&Y1´(ï.1jˆÎ+—‚Ùê§´fˆ4›8Õ»ÈáÇåç)"pFREÏ¶«Fx)¿„ŒçİùàúĞ²=tí‚±–ËÕØqG›€TR–Ï¢¯ÃÙ’/Ëé @!² ô†÷Ü‰¦	U1èî“1©»Íª”°óŞ®¯Şô;4§ÃÅOSÚ#$æG¿ˆä½xÕ ô'ù=}®\C‹’Q6C¹*;/ŒßâìvãÚ
õ…[íY³f@e<Ôæ£?—ŠÉnîòKÓ’"SŞgº"tßX©-G°pÌ*©-•Mq5”–|ûB—°‘Ò€¢Ë't|xùüÛ!ApTe Ì…ê3öSı½'^	²²	‘yÀ fxL˜vØÁmaĞp2ŸçÄ¨ëRlG¿”Û¯àÜ¸›¼~¦SZì7Š½¨•QÅüî2ª_…S¯æsvGÔosâj0ìãÂªc”UÈa4çFÙŞ"è¦0êÎÀ€~ÅxLâ’¿¶ijR@À¹N-ºr[~ ”ì˜…¨”wÂ—+ƒG1mBKŒœmU‰]=„/œ¢ì6U¹`¡7v§‘tUÀúgtaî¦KlÑ'î¦"í*,¢â-ş!û#3¶JKY2ü' ï•óùo+•œ(0*ë‡ÙÔ‚	‡İÛ¦<·a±w?ŠYªØã%ö&|­2¡ëŞŒ¢KÑµäC2îK‚Ğ“éZ±j½P½ƒÛœ¤ó ÜÜn–  ƒ£üôÔ_~7¥C„ËË£a†?U¾†w¥-›¥Zó~3}¹otS¾rÚQTËÂ€Ä‘ìò»ŠxPÿğ¤ÊÌ„|„(”v–uÙ+„èÖuÛw]’±w»õ€“şq/ëş0éµÎ«4`¸ºñik‰Ş©“{qã9ãa¹ÊL"zUæg¢®%#¨âu˜çÁ È4¬¨4²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÈ2.Vg¡;Ş©h‰o³ÇŠ)|øqY?D»±7Ïö(ŠAXÖ„avşÖ U§ÅÎ Ì‚t|ƒ…Ê,Í¤Lí"IY% ñ$$Ïî›´”Ó“ÛÆ "z.UŸ@ğ¾ûİL9şÌ?_L¿êOğøûÜ¨¾Îº¿\Œ«6T»¼¿øOög—¿™Ne	ôhëÏNN‹‚È‘	EA4ûÇ‡ôûş$»®Ã»Ö³yùò•\Ç~S§ªöÕÚ¿:¾mKŸÒ #H6I‰?¹ì&6faòè3ëÜ¼¾ Ó¾ıáöë¿hà›q{¼ŒX4äŠ›#ÆøéIşv·£Ï^®÷‚ñG…İ)jqÃñï7¹ã>øú^ü6¾\‹¾æ|L[RqVx‚ÅíTvNP¶%œù`½Î,k›Ğ¤“Ü†SJt"ufDÕ/øNº´ù>S›†ÎIJ1°ü»ş­úŒó¬(ñî+Ò¸»Åà[|Èî)sœ+¦fH	KÁˆ8y•-Dæ] û(IÑ9}­bwö9bÿúo{«Å–ê4ÇÍ¹¹/ö¯Ïœ2ÑxK½"EJkˆ—“b&³¹òËÓ¤½Àø™hXôáÙ>¼N#Û½Øä©ÆâwÊ™lQlå“{Rlò;oÜCÚ©‚`¦öÕ€%÷—‡Ò€B§VYKl¥_ÃsûécA7µãÈ¶¨y*¨bù$%ËÄ¸ÔÃ`›—\Saq·”“Psš©€·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼“i´»N˜Š1Lïñ›Òì­$¤Ÿy–LÑ s=7ZTœ†s½#ææT½ ˆ÷Ñ{Õıù=¨ı	H}ª™ß@¼É¶×­·æ ÏoÆŸîsñúœø–µ]$£®.-NØ’yd£ ”Ğw¦YÖA™
ñ9ïÅ&³ZèfĞÁBê¦°}(¾`½µN{äÁ÷Ù49+a&Ü†áWyÍÀ[=tü”Ş/¹ûÍª~¡Ïä3¾I|Q<éI%7‡¯¹C.O*Š ¸§Uu`FWí j=ÕÔ×C,vÎle¬ĞtêØ3 nØ”ëÀ—×ykê·h°ósñ†ÖA'™+wµZšYºÏ(±Y,[šFÆ,+²–v=öî[Â…°½Ÿ<ƒ.có\åy´ì<–lFYÈÉILÑ+‚f{8|0cú"¼„m)› ‚Òşb_oÃMºGÌßl"àÓÿï)­dúù·Å×Ûfè• ¯Œ}XÙå1LÈ!QkT‘’¾"v{Å$Ö8/M­’gĞÖA+Og¬Ø$½ÃÌk+Ü™–‘"Ë«Í³îJäÿ±~«’Œ“ŠqnóÀ0ìä*ûo$Û¢Á‡mİFzı@VI9Q¶ii2áwäaeÏïÛà”¹Ôè
Ît¿?ËÜ·à€õÏÍu¨áÛ£¤€¼ÛX7éTqƒ»>°¿iT¨ €S_fÚEì*Ş¯àÁ~şÏíYÎpÎ[Ì„°œ‰0 İ.×°ÎÓlÆ!æiºqXÚ  ÄÇ1ïÊÊbtXñwû¾Šf>¡5n¸™ò8¼UÒ`o’‡ú(£u/úİ…@=Áÿì]*Äaj7–éRûÂ²dÉº’W£Ô†Æı’Æê,|âb²9y$´g¾7S)ÊXkºÊË²¶D™Ñ4ÀÊ§÷Ôœë(bb÷À€Ã¼¹Œ€é¯A=ïÛõ´ºõ­¬z@Ãˆ²ßÙ×ø¡eO“uªDŒÛë£kP.Ùã={¤î†R\½g570èÛğ±«¹„Dº @±ßØ'İ´~6[§ôaìŠÑú&îd½\ôÙ{Õ¾ ò'ò<^aŞ¶R·C»a9¿®Â9ğtò°Š]ùUsüÔâ2Ig¸Äı@²WÊÁzÌQ{Óˆ²ßr,bt–¡ç>İG*K€‡è]'[º„Ü³.Q×øXÓ«BTzúåuĞŞ&¥ÕF€üÇâr÷#©’¹¹¢O[±°“QšyĞu’TyÌÖu\™eg…ğ©£õä¬Ipÿa’®ÿÛà¡ôŞ—©ÁBéÊ˜4˜•ØĞ Kş#?êgÁùë¢#õv?4Å5t
sFìÃğïc­ÒF!g«—RÚÎ#k®0¡+Ÿh¥µÏ)$…>3±iCĞLË¹|»pªîz%ø¼…œáV.#Ë£‡ç­	ÒK’h×YW!_?…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?¬oÁ#Î¤´ÅblÀà§Öip;ÂjJßsøc~àïµóÓ2œg)™,ë•ßšİÔ£XODş“<µF€¡¾ö-=jµØá¥veİ¥0„êX¦÷xlÍB3Vkë9ÈèZA¿ºV‡Ëîä§¤™HŒÌ”2ãnú|Ê#åÅÄÆh©¢†Y]wîvõhqxö^ı†-F~]ƒóÚÔTz ´ŸÙ—lİvÚzºx°ÛÄ´­Œ‚ÜM¶qs+àè—÷×º`%aS›ÉVŸ˜›[¹wëTFÙå*9äê·ğYë‰¼©r×#0¡C09gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&õÉTqKe¿JÌYThòÂ*Ë'²C‹v)@n'³V.bb/V{…³1wË©HT³‡ª]h¶Ax1…¼oó³2xˆdX²ÁÁX§&5]c‚%\Tîb­B6«Y…oÆ²hA"	fi-	%ı„}/Îd˜T”°p‡Úò"	fÆq€ğßëì½÷şï¿Ê§ğûòõÿ/³»ÌÄ£<öÏÙ>şÏúÛ¿ê¼ÁO÷
õø³<UNÊC˜È™$@ûºòş¶=¯®M³ÿş„²û
ğú{®^S*3BnËìÌ4µo_‚	RL @C:y*İ&"fšñ·óÌ¸ªm[š8‹ö‚ı´½øƒ!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øû[üÀ>(¢™Æôm8£ğ^X—µ-~Ğ ÎÂaHuù`9“áª›’“"“D"•§ƒåGĞ˜œŸN.oÛ˜°Úüœ¹ú =øÄÛë4ğøã½ºÌòL´èŠ)s¨ª‡÷½HœIK‹Û8¥9òM³9Ñ1}-œëw–_U¼ü?‹ûœ¤ú {«ù@™ÍÆ{ïØ€™8“©F.{Š×Ùn ¹« ŒƒØ&¶d8¨	zôÍü®=cæK>˜³ÛÀÇ«i„’­zL‰l¥DW’2lÈ2;GíŞ’d—×¡!_¢p}A‚Ö	%4{h‹C1î™kÁ/´§Ü¶)ÉKï´g$Ú$¨ğÓpŸ•ß‘ak·–¡“êç¿û>½:ø»ÔKK7©Yí0¹(İ)b‹\	á©ûåÎşOäûÉ4­Oˆƒx‹Å0‰[Şl¨$”ŒH–x‹
ÂR2LˆĞ%6%"dÆ µ0ú‰BÕô3ø7]ÍZÈ‘AeE0ì#.+O­ªÂîù·®ÿótz¼ü†}õC£††İ6Œ›‹”¨‚Ô%â%Ø\…š(ìñz²ykAÑØ£«8ù¯÷JÊ•šÂ~ã²6M2)¸t`×‡áE÷ŒÜú%ì\°ª!_Uª}@Şç¿÷Hè\E6p	G¡<…¿3BÎN«^˜“ÕM ÒízºİG„ívBFM‰ú2düØ‚aKpÉöæiØâìÏ•ˆø3kà69#±)Sáœ½g—ë—˜­Y%mjV<Í.¢œ Ôp<S®SUÆ-;¶™«­$,qTír|ÊPŠÇce¸#ú&*ıhÁùgäûR<N,#©ÒsZG‡wºG|Á+˜Q ãõì{¥Šàvò@Á[äëÖéÕµØòËuX§5dĞc!ÈKÒHAcÑ.¢¦YÇ”<ÆB)?o˜cĞÖNµäø¬¬bnr
œæP2÷Ïç2ŠFÊıñø»^“º1Lâ‹+(l÷j;z}ä’Ğ¤BOc9¥]Nó\x2))ÒSPWš(ÌŸYÚ± ›æª‡>p×‹ŸÔ¡êëßÉg¬q°[›ä ¹NØ·é9~ÃŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡Ïç¡Tà(ÏZë°–—Ôºá6RªÍ'yïÓÓ £#FyÍŠsTß¤ ËÔål€’`-8ùk´ü&;²¥ë—½V	‹<—MoCÁfE‰Ú™¢uİ%ÊüÄ–*¦·5-8|áâ3iSà9·äŒÓt*ØÕŒÄz­èp&Y1°(ï.1jˆÎ+—‚Ùê¥´fˆ4›8Õ»ÈáÇåç)"pFREÍ¶«Fx+¿„çİùàúĞ²=tí‚‘–ËÕØqG›€TR–Ï¢¯ÃÙ’/Ëé  !² ô÷Ü¦U1èê“1­»Íª”°óŞ®¯Şô;4[§ÁÅOSÚ#$æG¿ˆä½xÕ õ'ù=}Œ\c’Q6C¹*;/ŒßâìvãÚ
õ…[íY³fBgÔæ£?—Š‰nòKÓ’"sŞgº"tßX©-GpÌ*©-•Mq=”|ûB—°‘Ò€¢‹'t|xùüÛ!ArTm Ì…ê³öSù½'^	²²	‘yÀ fxL˜vØÁmaĞp²›çÄ¨ïRlN¿”~Û¯à‹Ô¸›¼~&CZì3Š½˜¨•QÅüî2ª_…¯æsvGÔos¢j0ìãÊªc”UÊ!´çFÙş#è¦0êÎÀ„~ÅxLâ¿¶ijR@À¹N-ºr[ ”ì˜„¨”gÂ—+ƒG1-BKŒ˜mU‰]=„/¦ì6U¹`¡7t§‘tUÀúgtaî¦ËlÑ'î¦"í*, â-ş!û#3¶JKy6ü'"ï•óùo+•œ(0*ë‡Ùtƒ	‡İÛ¦<·b±v?ŠYªØã%ö&|­2¡ëÜŒ¢Ñ½äC2îK‚Ğ“éX±j½P½ƒÛœ¤ó ÜÜî–Š ƒ§üÔÔ_~7¥C„ÊË£A†U¾†w¥-Û¥Y[ó~3m¹&otS¾rÚQTË‚€Ä‘Ìò»ŠpPÿğ¤ÛÌ„|„(”v–uù+„èÖuÛg}’±w»õ€“ÿQ/ëş0é5Ì«4`¸ºñik‰Ş©“{qã;ãa¹ÊL2zUæg¢®%#¨êu˜çÁ Ê4¬¨4°˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÈ2.VgÌ¡;Ş©h‰o³ÇŠ)|øqY?D»±7Ïö(ŠEZÖ„AvşÖ Q¯Å=Î Ì‚t|ƒ…Î,Í¤Lí"IBY% ±$Ïî›´Ó“ÛÆ "z.UŸ@ğ¾ûİL=şÌ?^L¿êOğøûÜ¨¾Îº¿\«6!T»¼¿úOög— ¿™Ne	ôhëÏNN‹‚È‘	EA2ëÇ.§ôûş$»®Ã»Ş³yùòµ\ç~S§ªöÕÚ¿:¾mKŸÒ #Hi‰?¹ì&6faòè3ëŞ¾º Ó>íáöë¿hà›á{´ŒX4äŠ›#ÆøéIş2·£Ï^®÷‚qG…İ)jqÃ±ï5¹ã>øú^ü6¾\‹¾æ|L[RqVx‚ÅíTvNP%¶%œù`½Î,ë›Ğ¤“Ü†SJt"ufEÕ/øNº´ù6S›†ÎIJ1°ü»ş­úŒó¬(ñî+Ò¸»Åá[|Èî-sœ+¦gH	KÁˆ8y•,Dæ\ û(IÑ9}­bwö9bÿúo{«Ä†ê4ÇÍ¹¹+ö¯Ïœ2Ù8C½H"EJkˆ—“b&³øò‹Ó¦½Àø‘hXôáÙ¼ŸN#Û½Úä©Î€âwÊ™lQlå“{lò;kÜCÚ©‚`®öÕ€%×—‡Ò€@§VYKl¥_ÃsûécA7µãÈ¦¨y*¨bù$%ËÄ¸ÔÃ`™—\S`q·”“Ps›©ˆ·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼“i´»N˜Š1LïğœÛÒì­¤y–LÑ s97ZPœ†s½#æçT½ ˆ÷Ğ{Õıù=¨ıH}ª™ß`¼É¶×­·æ ÏoÇŸîsñúœø–·]$£-NØ’yd£ _Ğw¦YÖA™ñ:ïÅ&³ZèfĞÁBê&°}(¾`½•N{äÁ÷Ù49+a&Ü†áwıÍÀ[=tü”Ş/¹{Mª~¡Ïä3¾I|Q<iI3%?‡¯¹C.O*Š ¸§Uu`FWíj=ÕÔ×C,vÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†ÖVA'™+sµšYºÏ(±Y,[šFÆ,+¢–v=öî[Â… ½<ƒ.cñ\åy´ä<–lBYÌÉILÑ+’f:{8|2cú"¼Ìm)› ‚Òşâ_oÃMºGLÏl"àÓÿÏ)2­dúù·Å×Ûfàµ ¯ŒıXÙå1LÈ!Qk¾T‘’¾"¯v{Å¤Ö8/M­’gĞÖA+Kg¬Ø,½ÃNk+Ü™–±"Ë«Ï³îJäÿ±z¿’“ª1nóÀ0ìd*ûo$Ú¢Á‡mİF~½ VI9Q¶ii2áwäaeÏïÛà”¹Ôè
Ît¿?ËÜ·à€õÏÍq¨aÛ£¤€½ÛX7éTqƒ»>°¿iT¨ ˆS_fÚGì(Ş¯àÁ~şÏÍÎpÎÍ„°œ‰0 İn×°ÎÓlÆ!æyºqXÚ ¨ÅÇ1ïÊÊbtXñ7û¾‹f>¡5n8™ò8½UÒ`o’‡ş(£u/øİ…@=Áÿì]2Æaj7–éRûB²dÉº[’W£Ä†Æı’Æê,|âc²9y%´g®7)ÊZkºŠË²$¶D™Ñ4ÀÊ·÷Öœ£(bb÷@€Ã¼©Œ€ë¯AıïÚõ´²õ­Œz@Ãˆ²ßÙ×ø¡eO“uªDŒÛ€ë#kP.Ùã+¤î†R\½g570èÛğ‘«¹„º @±ßØ'Ü´~6[§ôaìŠÑø§îä½\ôÙÕ¾ ò'ò<¯^aŞ¶V¶C»!9¿¦Â9ğtö°Š]	éUsìÔâ2Ig¸ÄüD²WÊÁzÏQ{Óˆ²×r,bt–¡ã>İG*k€‡è]'_º„Ü³.Q×øXÓ«BT=zúåuĞŞ%&¥ÕF€üÇâr÷'©’¹¹¢O[±°“Qºyu²TyÌÖu\™ee•ğ©£÷ä¬ipÿa–®ÿÛŸà¡ôŞ—©ÁBéÊ˜4˜‰•ØĞ Kş#?jgÁùã¢#õv>4Å5t
sFíÃğïc­ÒF <g«—RÚÎ#k®0¡+Ÿè¥µÏ)$>3°iCĞLË¹|»pªîz%ø¬…œáV.#Û£‡ç­	ÒK’h×IW!_…'¼âş2±éhà¨w¦“eoÈº­àáÌ.?¬oÁ#Î¦´ÅblÀà§Vip:Âj
ßsøc~àïµó×2œg9™,ë•ßšİÔ£XODş³<5F ¡ºö-=jµØá¥veİ¥0„êX’¦÷xlÍB3Vkk9ÈèZCŸ²^‡Ëîô¥¤HŒÎ”2ãnú7Ê#çÅÄÆl©¢†y]wîvõhqxö^ı„-F~]ƒóÚÔT{ ¼ŸÉ—lİvÊzºx°ÛÄ´©œ‚ÜM¶qs# èŸ÷×¸`!iS›ÉVŸ˜›Y¹wëTFÙå*9ìê·òY«‰¼©r×#0¡¯C0¹gÌ„j\P”ÃÖ‡(æ}>¿çÔrèÛ&õÉTqKe¿JÌY\hòÂ*Ë'²c‹v)@n'³V.bb/Vk…³1wË©T³‡ª]h¶Ax1…¼oó³2xˆdX²ÁÁX§&5]c‚%\Tîb­B6«X…nÆ²hA"	fi-	%ı„}/Îd˜T”°0‡Şò"	fæq€pßëì½çşï¿Ê§ğûğõÿ/³»ÌÄ£<öÏÙ>üÏúÛ¿ê¼ÁO÷
õø³<ENÊCˆÈÙ$@û²úşö=¿®M³ÿş”²û
ğú{®^s*3BnÊì
Ì4µ_	RH @C:y*İ&"fšq§óÌ¸Šm[’8‹ö‚ı´½ø‹!Õ ?8¸š:Ÿ¬´¹¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«¸û[üÀ>(¢™Æôm8£ğ^X—µ-~Ò ÎÂaHuù`9“aŠ›’“"“D"•§ƒåGğ˜œŸN.OÛ˜¸Úü¼¹ú =øÄÛë4ğøã½ºÌòL´èŠ)s¨ª‡÷½H¼IK‹Û8¥9òM³9Ñ1}-œëw–_U¼ü?‹ûŒ¤ê {«ù@™Æ{ïÜ€™8“©F>{Š×Ùl ¹« ŒƒØ&¶d8¨	z<ôÍü®=cæ.K>˜³[ÀÅ«i„’­zLÉl¥QdW’lÈ2;GíŞ’d†“×¡!_‚p}A‚Ö	%4{h«C1î‘kÁ/´§Ü¶)IKÏ°g$Ú$¨ğÑpŸ•ß‘ak—–¡“êç¿Û>½:ø»ÔKK7©Yí0ù8İ)f›\	á‰ûåÎşOôûÉ4­G¨ƒx‹Å0‰[Şl¨$”ŒH–x‹
ÂR2LÈĞ%6%"dÆ$µ0ú‰BÕä3ø5]ÍZÈÑeE0ì#.+O­ªÂîù·®ÿótz¼ü†]õC#††İvŒ›‹”¨‚Ô%â%Ø\…š(î±z²{cAÓØ¡ë8ù­÷JÊ•šÊ~ãğ6M2)¸t`×§áE÷Œİú%ì\°ª)_Uª}@Şç¿÷Hè^E6p	G¡<…¿3CÎN«^“ÕM Ò“íz?ºİG„­vBM‰ş2düØ‚aKpÉöæiØâäÏ•ˆø3kà69'±)Sáœ½gë—˜­Y%mjV<Í.¢ Öp<S®SUÆ,;¶™«­$$q3TíR|ÊPŠÇce©#ò&*ıhÁùgàùR<^.#©ĞsZG‡w¾G|Å+˜Q¤ãõì1{¥
àvòPÁ[ôëÖèÕµØòËuX¥5dĞc!ÈKÒHAãÑ>¢¦YÇ”<Æ(¿o˜cĞÖNµäø¬¬bn2
œæP2ÿëç2ŠFÊûñø»^“º1Lâ‹+(n÷j;zyä’Ğ¤BOc9¥]N÷\x2))ÒSRWš(ÌŸYÚ± ›æŒª‡>p×‹ŸT¡êëßÉg¬q°S›ä ¹NØ¶é9~ƒŸ®„»‹CE¨ …EÛ¿añA@õÏ"…‡ßç¡Pà(ÏZë°–—Ôºá6RªÍ'yïÛÓ £#FyÍŠsTß¤ ËÔål€’`-8ñk´ü&;²¥ë—½V	‹<—MCÁfE‰Ú¢uİ%ÊüÄ–*¦¶1-8\áâ#iSà9·äŒÓt*ØÕœÄj­ép&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4›8Õ»ÈáÇåç)"rFREÏ¶+x+¿„çİùàúĞ²=tí‚‘–ËÕØqG›€TR–Ï¢¯ÃÙ’/Ûé  !² ô†÷Ü‰¦U1èê“1©»Åª”°óŞ®¯Şô;5§ÁÅOSÚ#$æG¿ˆä¹xÕ õ'ø=}¬^c’Q6C¹*;/Œßâìvãú
õ…[íY³fBe<Ôæ£?—Š‰nÎòKÑ’"SŞwº"tßX©-G°pÌ*©-•Mq=”|ûB—°‘Ò€¢K't|xùüÓ!ApTe Ì•ê3öSù½'^	²²	‘yÀ fxM˜vÙÁmaĞp2ŸçÄ¨ïRlG¿”Û¯à‹Ä¸›¼~&SZì3Š½¨•QÅüî2:ª_…S¯æsvGÔosâj0ìãÂºc”UÈ!4çFÙŞ#è¦0êÎÀ€~Å8Lâ¿¶ijR@À¹O-ºr[ ”ì˜…¨”g‚—‰+ƒG1mBKŒ˜mU‰]=„/œ¢ì6U¹`¡7v§‘tUÀúgtaî¦ËlÑ'î¦#í*, â-ş!û#3öJKY2ü‘'"ï•óùo+•œ(0"ë‡Ùtƒ	‡ßÛ¦<·c±v=
YªØã%ö&|­2¡ëŞŒ¢Ñ½äC2îO’Ğ“éX±"kPµƒÛœ¤÷ ÜÜn–Š ƒ£ü…ôÔOz7¥C„ÊË£A†?U¾†w¥-Û­Zó~3}¹otS¾rÚQTËÂ€Ä‘ìò»ŠxP÷ğ¤ÛÌ|„(”v–uÙ+„èÖtÛwm’±w»õŸ€“ÿQ/ëş0é5Î«4`¸úñik‰Ş©“{qã9ãa¹Ê"zUîg¢®%#¨âuˆçÁ È4¬¨4²˜·–ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÀ2.Òg¡;Ş©h‰o³ÃŠ)|øqY?D»±7Ïö(ŠAXÖ„AvşÖ U§ÅÎ Ì‚||ƒ…Î,Å¤Lí"IY% ñ$&Ïî›´Ó“ÛÆ "z,UŸ@ğ¾ûÜL9şÌ?^L¿êOğøûÜ¨¾Ïº¿\œ«>T»¼¿¸Oöc— ¿™NeIôhëÏ^N‹‚È‘	EA0ûÇ.§ôûş4»®Ã»Ş³yùòµ\Ç~S§«òÕÛ¿:¾mKŸÒ#HIÉ?¹ì&6gAòè3ëÜ¼º Ó>ıáöë¿hà›ñ{¼ŒX4äŠ›+ÆøéIş6·#^®÷‚ñG…İ)jqÃñï7¹ã¾øúü6¾\‹¾ætL[RpVx‚ÅíUvNP%6%LœÉ`½Î,k›Ğ¤“Ü†SJt"ufEÕ/øNº´ù>S›†ÎIJ1°ü»ş©úŒó¬(ñî+Ò¸»ÅÀ[|Èî)sœ+¦fH	IÁˆ8y•-Dæ\ û(IÑ=}­bwö9fÿúo{«Å–ê0ÇÍ¹˜¹+ö¯Ïœ2ÑxC½H"EJkˆ—“b&³¹ò«Ó¦½Àø‘h>XôáÉ>¼N#Û½Øä©ÆâwÊlAlå“{lò;oÜCÚ©‚`®öÕ€%÷—‡Ò€B§VYKl¥_ÃsûécA7µãÈ¶¨y*¨bı$'ËÅ¸ÔÃ`›—\Sby·”“Ts›©€·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU Qû ù¬.Ø¼“i´»N˜Š1LïğÛÒÌ­¤y–LÑ°s97ZTœ†s½#ææT½ˆ÷Ğ{Õıù=¨ı	H}ª™ß`¼É¶×­·æ ÎoÇŸìsñúœø–·]$£-NØ’yä£ Ğw¦YÖA™
ñ:¹ïÅ&³ZèfĞÁBê&°m(¾`½5N{äÁ×Ù49+a&Ü†áW}ÍÀ[=tü”Ş/¹ûMª~¡Ïä3¿I|Q<iI%?‡¯¹C.OªŠ ¸§Uu`FGí*=ÕÔ×C,vÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†ÖA'™+sµZšYºÏ(±Y,[šFÆ,+¢–v=öî[Â… =<.có\åy´ì<†lBYÈÉILÑ)’f{8|2cú"¼Ìm)› ‚Ööb_oÃMºGÌÏl"àÓÿï)2¬dúù·Å×Ûfèµ ¯ŒıXÙå1LÈ!QkT‘’¾"v{Å$Ö8/O¬’gĞÖA*Og¬Ø$½ÃNk+Ü™–±"Ë«Ï³îJäÿ±~¯’“ª1nóÈ0ìdV*ûo$Û¢Á‡mİFz½ VI9Q¶ii2áwäaåÏïÛà”¹Ôè
Ît¿?ËÜ·à€õÏÍu¨aÛ£¤€½ÛX7éDqƒ»>°¿iT¨ €S_fŞEì(Ş¯àÁ~şÏíÎpÎÍ„°œ™0 İn×°ÎÓlÆ!æiÍºqXš  ÅÇ1ïÊÊ™btXñ6»¾Šf>¡5n¨™òš8½UÒ`o’‡ú(£u/øİ…@=Áÿì]*Àaj7–éRúB²dÉº’W£Ô†Æı’Æê,|âb¢yy%´g®7)ÊXkºŠË²$¶D™Ñ4ÀÊ§÷Ö¼«(bb÷@€Ã¼¹Œ€ë¯A½ïÒõ´²õ­¬z@Ãˆ²ßÙ×ø¡O›uªDŒ›ë"kP.Ùã+¤î†R\½g570èÛğ±«¹„Dº @±ßØ'Ü´~6[§ôaìŠÑú&îd½\ôØ{Õ¾ ò'ò<^aŞ¶R·C»!9¿¦‡Â9ğtò°Š]	ùUsìÔâ2Ig¸Àı@²WÊÁzÏQ{Óˆ²×r,bt–¡ç>İG*K€‡è]'[º„Ü³.Q×øxÓ«1BTzúåuĞŞ%&¥ÕG€¼Çâr÷'©’¹¹¢O[±°“QšyĞu’T9ÌÖu\™ee•ğ©£õäìipÿa–®şÛàáôŞ—©áBéÊ˜4˜‰•ØĞ Kş#?jgÁùë¢#õö?4Å5t
sFìÃğï#­ÒF!<g«—RÚÎ'k®0¡+Ÿè¡µÏ)$>3°iCĞLË¹|»pªÎz%ø¼…œáV.#Û£‡ç­	ÒK’h×IW!_?…'¼âş3±éhà¨w¢“eoÈú­àáÌ.?®oÁ#Î¦´ÅblÀà§Öip;ÂjJßsøc~àïµóÓ2œg)™,ë•ÛšİÔ£XODş³µF€¡ºö-=jµØá¥veİ¥0„êX¦÷xlÍB3Vkk9È–èRA&¿ºR‡Ëîä§¤HŒÌ”2ãnúvÊ#çÅÄÆh©¢†}]wîvõèqxöı†-N~]ƒóÚÔTz ¼ŸÉ—lİvÊzºx°ÛÄµ­œ‚ÜM¶qs+ èŸ÷×¸`!aS›ÉVŸ˜›Y¹wëTBÙå*9äê·ğYê‰¼©r×#0¡«C0¹gÌjTP”ÃÖÇ(æu>¿çÔs¨Û&åÉTqKe¿JÌI\hòÂ*Ë'²c‹v)@n'³V.bb/Vk…»1wË©HTŸ³‡º]h¶Ax1…¼oó³2xˆd²ÁÁX'&5]c‚%\Tîb­B6«X…nÆ¾hQ"	fi-	%ı„}/ÎdœT”°0‡Úò"	fæq€ğßëì½÷şï¿Ê§Ğûğõÿ/³»ÌÄ£<öÏÙ>üÏúÛ½ê¼ÁO÷
õø³<ENÊCˆÈ™$@ûºúWşö9¿®M³ÿş„²û
ğú­{®^s*3JnËì
Ì4µo_‚	rH @C:y*İ&"fšñ·óÌ¸ªmSš8‹ö‚ı´½øƒ!Õ ?(¸šŸ¬´¸¸™ãUR\úEíã0¿‹Ê‚ç ¹×éÏhú[¶î
!¸«ğû[ıÀ>(¢™Æôm8£ğ^X—µ-~Ò ÎÂeHuù`9“aª›’“"“F*•§ƒågğ˜œŸN.OÛ˜¸Úü¼¹ú =øÄÛË4ğøã½ºÌòL´èŠ)s¨ª‡÷½H¼IK‹Û8¥9òM³9Ñ1}-¼ëw–_U¼ü?‰ûŒ¤ê {ëù@™ÍÆ{ïÜ€™8“©F>{Š×Ùn ¹« ŒƒØ&¶d8¨	zôÍü®=cçK>˜³KÀÇ«i„’­zLÉl¥dW’lØ2;GíŞ’d†“×!_¢p}AÖ	'4{h‹C1î™ká/´§Ü¶)IKÏ´‘g$Ú$¨ğĞpŸ•ß‘ak–¡›êç¿Û>½:ø»ÔKK7©Yí0ù8İ)f›\	á‰{åÎşOôûÉ$­Gªƒh‹Å0‰[Şl($”ŒH–x‹
ÒR2LÈĞ%6%"dÆ$µ0úBÕô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîñ·®ÿót{¼ü–}õC£††İ6œ›‹”¨‚Ô%â%Ø\…š(ì±z2{kAÓØ£ë8ù¯÷JÊ•šÂ~ãğ&Í2)¸t`×§áE÷Œİú%ì\°ª!_Uª}@Şç¿óHè\E6p	G¡<…¿3CÏN«K^˜“ÔM Òíz?ºİG„ÍvBFM‰ú2düØ‚aKpÉşæiØâäÏ•ˆø3kà69'±)Sá½g—ë•˜­I%mjV<Í.¢ Ôp<S®SUÆ,;¶™«­$,q3TíR|ÊPŠÇce©#â&*ılÁùgäûR<^.#©†ÒqZG‡wºG|Å+˜Q¤ãõì1{µŠàvòTÁ[ğëöhÕµØòËuH¥5dĞc!ÊKÒÈAãÑ>¢¦YÇ”<Æ)¿o˜cĞÖNµäø¬¬`nr
œæP2÷«§2ŠFÊûñø»^“º1Lâ‹+(l÷j;z}æ’Ğ¥BOc9¥]N÷\p2))ÒÓRWš(ÌŸYÚ±¢›æª‡	>p×›ßÔ¡êëßËg¬q°[›æ ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿aóEH@÷Ï"…‡ßç¡Tà(ËRë°–—Üºá6RªÍ'xïÓÓ £#F{ÍŠsTß¤ ËÔåL€’`-8ñk´ü&;²¥ë—½V	‹<—MCÁfE‰Ú¢uİ%ÊüÄ–*¦¶5-8|áâ3iRà9§dŒÓt*ØÕŒÄz­èp'I1´(ï.1jˆÎ+—“‚Ùê¥´fˆ4›¸Õ»ÈáÇåç)"pFREÏ–«Fx+¿„çİùàúĞ²=tí‚‘–ËÕØqGŸ€TR–Ï¢¯ÃÙ’/Ëé  !² ô†÷Ü‰¦U1èê“1©¹Íª”°óŞ®¯Şõ;4[§ÁÅOSÚ#$æG¿ˆä¹xÕ õ'ù=}¬\C’Q6C¹*;/ŒßâìrãÚ
õ…[íY³æBe<Ôæ£?—Š‰nÎòKÓ’"SŞwº"tßX©-GpÌ
©-Mq=–|ûB—°‘Â€¢K't|xùşÛ#Apte ˆ…ê3öSù½'^	²²	‘yÀ fxL˜vØÁmaĞp2›§Ä¨ïRlG¿”~Û¯à‹Ô¸›¼~&CZì3Š½¨•QÅüî2ºO…S¯æsvCÔsâj
0ìãÂªc”UÈ!4çFÙŞ#h¦0êÎÀ€~Å8Lâ¿¶ijR@À¹N-ºr[~ ”ì˜…¨”gÂ—+ƒO1mBKŒ˜mU‰]=„/œ¢ì6U¹`¡7t¯‘tUÀúgtaæ¦ËlÑ'î¦"í*,àâ-ş!û#3¶JKY2ü‘'"ï•óùo+•œ(0*ë‡Ùtƒ	‡İÛ¦<·c±v?
YªØã%ö&|­2¡ëÖŒ¢Ñ½äc2îK’Ğ“áZ±z½P½ƒÛœ¤ó ÜÜn– §üôÔ_~7¥C„ÊË£A†?U¾†w¥-Û¥Zó~;}¹otS¾rÚQTËÂ€Ä‘ìò»ŠpPÿğ¤ÚÌ„|„(”v–uÙ+„èÖuÛw}’±w»õŸ€“ÿI/ëş0é5Î«4`¸ºñik‰Ş©“{qã9ãa¹ÊL2zUîg¢®%#¨â}˜çá Ê4¬¨4²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÈ2.Vg¡;Ş©h‰o³Ç‹)|øqY?D»±7Ïö(ŠAXÖ„avşÖ U§ÅÎ(Ì‚t|ƒ…î,Í¥Lí"IY% ñ$Ïî›´Ó“ÛÖ "z.uŸ@ğ¿ûØL9şÌ?_L½êOòøûÜ¨¾Îº¾\Œ«6T»¼ŸøOöc— ¿™Ne	ôhëÏNN‹‚È‘	E@0ûÇ.§ô{ş$»®Ã»Ö³yùòµÜç~S§ªöõÛ¿:¾mKŸÒ #HI‰?¹ì&faúè3ë\¼º Ó>ıáöë¿xà›ñ{¼ŒX4äŠ›#ÆøéHÿr·£^®÷‚ñG…İ)jqÃñï7¹ã>øú^ü6¾\‹¾ætL{RqVx‚ÅíTvNP%¶%œù`½Î,k›Ğ¤“Ü†SJt"ufDÕ?øNº´ù>S›†ÎIJ1°ü»ş­úŒó¬(ñî/Ò¸»Åá[|Èî)sœ+¦fH	KÁˆ8y•,Dæ\ û(IÑ½}­bwö9bÿúo{¯Ä†ê0ÇÍ¹±-ö¯Ïœ2ÑxC½H"EJkˆ—“b&³½ò‹Ó¦½Àø‘hXôáÙ>¾N#ÛıØä©Î€âwÊ™lAlå“{lò´;oÜCÚ©‚`®öÕ€%÷—‡Ò€B§VYKl¥_ÃsûécA†7µãÈ¶¨y* bı$'ËÅ¸ÔÃ`›—\Saq·”“Ps›©€·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDUQû¡ù¬.Ø¼“i´»N˜Š1LïğÛÒì­$¤y–LÑ s97ZTœ†s½3ææT½ˆ÷Ğ{Õıù=¨ı	H}ª™ß@¼É¶×­·æ ÎoÇŸîsñúœø–·]$;£-Ø’yd£ ˜_Ğw¦YÖA™
ñ:9ïÅ&³ZèfĞÁBê&°}¨¾`½•N{äÁ÷Ù49+a&Ü†áW}ÍÀK=tü”Ü/¹{Íª~¡Ïä3¾I|Q<iI%?‡¯¹C.O*Š ¸§Uu`FGí*=ÕÔ×ClvÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†ÖA'˜+sµZšYºÏ(±Y,[šFÆ,+¢–v=öî[Â…°½<‰.cñ\åy´ì<†lBYÈÉILÑ+’f{8|2cú"¼Ìm)› ‚Öşb_oÃMºEÌÏl"àÓÿï)­dúù·Å×Ûgèµ ¯ŒıXÙõ1DÈ!Qo¾T‘’¾#v{Å&Ö8/M¬’gĞÖA/Kg¬Ø,½ÃNk+Ü™’‘"Ë«Ï³îJäÿ±~¯’“ª1nóÈ0ìdV*ûo$Ú¢ÁmİF½ VI9Qöii2áwäaeÏïÛà”¹Ôè
Ît¿?ëÜ·à€õÏÍt¨áÛ£¤½ÛX7áTqƒ»> ¿iT¨ ˆS_fÚEì(Ş¯àÁ~şOíÎpÎÍ„°œ‰0 n×²ÎÓlÆ!æiºqXÚ  ÅÇ1ïÊÊbtXñ7û¾Šf>¡5n¨™ò8½UÒ`o’‡ø(£u/øİ…@=Áÿì]*Äaj7–éRÛB²dÉº[’W£ÔÆı’Æê,|âb²yy%´e®?S)ÊXkºŠË²$¶D™Ñ4ÀÊ§çÖœ«(bb÷@€Ã¼¹Œ€é¯A½ïÚõ´ºu­¬z@Ãˆ²ßÙ×ø¡EO›uªD›€ë¢kP.Ùã=+¤î„R\½g570èÛğ±«¹„Dº @±ßØ'Ü´~6[§ôaìŠÑø'îd½\ôÙ{Õ¾ ò'ò<^aŞ¶R·»!9»®‡Â9ğtò°Š]	ùUsìÔâ2Ig¸Äı@²WÊÁzÉQ{Óˆ²×r,bt–¡ã>İG*Ë€‡è]7[º„Ü³.Q×øXÓ«BTrúåuĞŞ%&¥ÕF€üÇâr÷!©’¹¹¢O[±°“QšyĞu’TyÎÖu\™ea•ğ©£õä¬irÿa–®şÛà¡ôÎ—©ÁFéÊ˜4ˆ‰•ÚĞ Kş#?jgÁùã¢#õ¶?4Å5t
sFlÃğïc-’F!<gª—RÚÎ#k®0¡+Ÿè¥µÏ)$>3°iCĞLË¹|»pªîz%ø¬…œáV.#Û£Çæ­	ÒK’h×IW!_…#¸âş3±éhà¨w¦“eoÈú­àáÌ.?¬/Á#Î¦´ÅblÀà§Öip{ÂjJßsøc~àïµóÓ2œg)™,ë•ÛšİÔ£YODş³µD ¡ºö-=j½Xá¥veİ¥0„êX¦÷xlÍB#Vkk9È–èZAŸºV†Ëîä§¤HŒÎ”2ãnú$tÈ#åÅÄÆ|©¢†}]wîvuhqxö^ı†-F~]ƒóÚÔT{¼ŸÉ—lİvÚzºx°ÛÄ°­œ‚ÜM¶qs+àèŸ÷×¸`)aS›ÉVŸ˜›Y¹wëTBÙå*9äê·ğYë‰¼©r×30©‹C0½gÌj\P”ÃÖ‡æu>¿çÔsèÛ&åÉTqKe¿JÌY\hòÂ*É'²c‹v)@n'³V.bb?Vk…³1wË©TŸ³‡ª]h¶Ax1…¼oó³2xˆdX²