import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc as firestoreDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Save, FilePlus, RefreshCw, Check, Package, Truck, Plus, Copy, X, Trash2, Download, FileSpreadsheet, AlertCircle, Calendar, Weight, Box, MapPin, User, Shield, History, Eye, Calculator, Archive, ChevronDown, Search, Filter } from 'lucide-react';
import logo from '../../../assets/logo.png';
type FormData = {
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
    // optional fields used in invoices
    unitPrice?: string | number;
    transportFee?: string | number;
    truckNumber?: string;
  };
  palletRows: Array<{
    numero: number;
    produit: string;
    calibre: string;
    paletteNr: string;
    caissesPerPalette: string;
  }>;
  calibreSummary: Record<string, { palettes: number; caisses: number }>;
  palletTypes: {
    type220: number;
    type264: number;
    type90: number;
    type108: number;
  };
};

const PackingListManager = () => {
  // Backend API base (can be overridden with env var)
  // Support both CRA-style process.env and Vite's import.meta.env while avoiding "process is not defined" errors
  const API_BASE = (
    (typeof process !== 'undefined' && (process as any)?.env?.REACT_APP_API_BASE) ||
    ((import.meta as any)?.env?.VITE_API_BASE) ||
    '/api'
  ) as string;

  const [lots, setLots] = useState([
    {
      id: 'lot-1',
      lotNumber: 'PL-2025-001',
      status: 'en_cours',
      formData: {
        origin: {
          companyName: 'FRUITS FOR YOU',
          address: 'Lot N°14 Rez De Chaussée Zone Industrielle',
          city: 'Kénitra – Maroc'
        },
        destination: {
          companyName: 'AZ FRANCE',
          address: '18 Rue du Puits Dixme, 94320 Thiais',
          city: 'France'
        },
        transport: {
          truckNumber: 'TRK-1234',
          chauffeurNumber: 'CH-5678',
          transporteur: 'CAP MED',
          scelle: 'SCL-9012'
        },
        technicalDetails: {
          dateProduction: '2025-10-09',
          dateDeparture: '2025-10-10',
          lotNumbers: '5-01-1202FFY25A',
          ggn: '4063651496413',
          orderNumber: '24250134',
          poidsNetTotal: '12672',
          poidsBrutTotal: '13992'
        },
        palletRows: Array.from({ length: 15 }, (_, i) => ({
          numero: i + 1,
          produit: 'AVOCAT HASS BIO',
          calibre: ['16', '18', '20', '22', '24'][i % 5],
          paletteNr: (i + 1).toString(),
          caissesPerPalette: i % 2 === 0 ? '264' : '220'
        })),
        calibreSummary: {},
        palletTypes: { type220: 0, type264: 0, type90: 0, type108: 0 }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]);

  // Fetch initial lots from Firestore on mount (fallback to localStorage/defaults)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const lotsRef = collection(db, 'packing-lists');
        const q = query(lotsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        if (!mounted) return;
        if (!snapshot.empty) {
          const data = snapshot.docs.map(doc => {
            const d: any = doc.data();
            const createdAt = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : d.createdAt;
            const updatedAt = d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt;
            return { id: doc.id, ...d, createdAt, updatedAt };
          });
          setLots(data as any);
          setCurrentLotId(data[0]?.id || '');
          return;
        }
      } catch (err) {
        console.warn('Error fetching packing-lists from Firestore, falling back to localStorage/defaults', err);
      }

      // Fallback: load from localStorage
      try {
        const stored = localStorage.getItem('packing_lists');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLots(parsed);
            setCurrentLotId(parsed[0]?.id || '');
          }
        }
      } catch (e) {
        console.warn('Failed to load packing_lists from localStorage', e);
      }
    })();

    return () => { mounted = false; };
  }, []);

    // UI State
    const [currentLotId, setCurrentLotId] = useState(lots[0]?.id || '');
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showPriceConfig, setShowPriceConfig] = useState(false);
    const [showCalculations, setShowCalculations] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [invoicePrices, setInvoicePrices] = useState<Record<string, number>>({});
    const [invoiceQuantities, setInvoiceQuantities] = useState<Record<string, number>>({});
    const [selectedCell, setSelectedCell] = useState<{ row: number; field: string } | null>(null);
    const [historyFilter, setHistoryFilter] = useState<'all' | 'termine' | 'brouillon'>('all');

    // Real calculation function
    const calculateRealSummary = (rows: any[] = []) => {
      // aggregates per calibre and pallet-types counts
      const calibreSummary: Record<string, { palettes: number; caisses: number; quantity?: number; caissesPerPalette?: number }> = {};
      const palletTypes = { type220: 0, type264: 0, type90: 0, type108: 0 };
  
      let totalNet = 0;
      let totalBrut = 0;
      let totalPallets = 0;
      let totalBoxes = 0;
  
      // defensive: ensure rows is an array
      if (!Array.isArray(rows)) rows = [];
  
      rows.forEach((row) => {
        const calibre = row?.calibre ?? '';
  
        // parse number of palettes for this row (paletteNr is quantity of pallets)
        const palettes = Math.max(0, parseInt(row?.paletteNr || '0', 10) || 0);
        // parse caisses per pallet
        const caissesPerPalette = Math.max(0, parseInt(row?.caissesPerPalette || '0', 10) || 0);
  
        // skip rows without meaningful numbers
        if (!calibre || palettes <= 0 || caissesPerPalette <= 0) {
          // but still add palette count if caissesPerPalette missing? we skip to avoid wrong caisses
          totalPallets += palettes; // count pallets even if caissesPerPalette absent
          return;
        }
  
        const caissesForRow = palettes * caissesPerPalette;
  
        // Accumulate per-calibre
        if (!calibreSummary[calibre]) {
          calibreSummary[calibre] = { palettes: 0, caisses: 0, quantity: 0, caissesPerPalette };
        }
        calibreSummary[calibre].palettes += palettes;
        calibreSummary[calibre].caisses += caissesForRow;
        // quantity shows number of palettes for UI wording
        calibreSummary[calibre].quantity = calibreSummary[calibre].palettes;
        // store a representative caissesPerPalette (computed as average if mixed)
        calibreSummary[calibre].caissesPerPalette = Math.round(calibreSummary[calibre].caisses / Math.max(1, calibreSummary[calibre].palettes));
  
        // Count pallet types by number of palettes of that type
        // caissesPerPalette determines the type
        if (caissesPerPalette === 220) palletTypes.type220 += palettes;
        else if (caissesPerPalette === 264) palletTypes.type264 += palettes;
        else if (caissesPerPalette === 90) palletTypes.type90 += palettes;
        else if (caissesPerPalette === 108) palletTypes.type108 += palettes;
  
        // Weight calculations per box * number of boxes
        // WEIGHT_PER_BOX is expected to exist in this module
        try {
          const netPerBox = Number((WEIGHT_PER_BOX && WEIGHT_PER_BOX.net) || 0);
          const brutPerBox = Number((WEIGHT_PER_BOX && WEIGHT_PER_BOX.brut) || 0);
          totalNet += caissesForRow * (isNaN(netPerBox) ? 0 : netPerBox);
          totalBrut += caissesForRow * (isNaN(brutPerBox) ? 0 : brutPerBox);
        } catch (e) {
          // ignore if weight constant missing
        }
  
        totalPallets += palettes;
        totalBoxes += caissesForRow;
      });
  
      return {
        calibreSummary,
        palletTypes,
        poidsNetTotal: Math.round(totalNet).toString(),
        poidsBrutTotal: Math.round(totalBrut).toString(),
        totalPallets,
        totalBoxes,
        // legacy alias used elsewhere
        totalCaisses: totalBoxes
      };
    };

   const produits = [
    '---------------------BIO - 4 KG produit ----------------',

    'AVOCAT HASS BIO - 12 4 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 14 4 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 16 4 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 18 4 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 20 4 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 22 4 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 24 4 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 26 4 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 28 4 KG produit certifié par CCPB MA-BIO-102',
    '---------------------BIO - 10 KG produit ----------------',




    'AVOCAT HASS BIO - 12 10 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 14 10 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 16 10 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 18 10 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 20 10 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 22 10 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 24 10 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 26 10 KG produit certifié par CCPB MA-BIO-102',
    'AVOCAT HASS BIO - 28 10 KG produit certifié par CCPB MA-BIO-102',

    'AVOCAT HASS  CONVO - 12 ',
    'AVOCAT HASS  CONVO - 14 ',
    'AVOCAT HASS  CONVO - 16 ',
    'AVOCAT HASS  CONVO - 18 ',
    'AVOCAT HASS  CONVO - 20 ',
    'AVOCAT HASS  CONVO - 22 ',
    'AVOCAT HASS  CONVO - 24 ',
    'AVOCAT HASS  CONVO - 26  ',
    'AVOCAT HASS CONVO - 28 ',

  ];
  const calibres = ['12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32'];
  const caissepallete = ['90', '108', '220', '264', '60', '150', '432', '372', '738', '324', '48']; // Fixed missing comma

  // Weight constants per box (kg)
  const WEIGHT_PER_BOX = {
    net: 0,
    brut: 0
  };


const generateInvoice = async () => {
  if (!currentData || !currentLot) return;
  const jsPDF = (await import('jspdf')).default;
  const doc = new jsPDF('p', 'mm', 'a4');

  const pageWidth = 210;
  const margin = 10;
  let y = margin;

  const darkText: [number, number, number] = [30, 30, 30];

  // === Header background ===
  doc.setFillColor(161, 240, 161);
  doc.rect(0, 0, pageWidth, 30, 'F');

  // === Logo ===
  try {
    const logoUrl = logo;
    const res = await fetch(logoUrl)
      .then(r => r.blob())
      .then(b => new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(b);
      }));

    if (res) {
      const logoSize = 20;
      doc.addImage(String(res), 'PNG', margin + 3, 4, logoSize, logoSize);
    }
  } catch (error) {
    console.error("Error loading logo:", error);
  }

  // === Titles ===
  doc.setFontSize(18);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.text('FRUITS FOR YOU', pageWidth - margin - 165, 16);

  doc.text('INVOICE', pageWidth - margin - 60, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice Date: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin - 60, 18);
  const invoiceNum = ((currentData?.technicalDetails as any)?.invoiceNumber) || `TRC-INV-${currentLot.lotNumber || 'AUTO'}`;
  doc.text(`Invoice #: ${invoiceNum}`, pageWidth - margin - 60, 24);

  y = 36;

  // === FROM / TO ===
  const leftX = margin;
  const midX = pageWidth / 2 + 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('FROM:', leftX, y);
  doc.text('TO:', midX, y);

  doc.setFont('helvetica', 'normal');
  let fromY = y + 5;
  ['FRUITS FOR YOU S.A.R.L AU',
    'Lot N° 14 Rez De Chaussée Zone Industrielle 14A Bir Rami Est',
    'Troisième Tranche - Kénitra - Maroc'
  ].forEach(line => {
    doc.text(line, leftX, fromY, { maxWidth: 80 });
    fromY += 9;
  });

  let toY = y + 8;
  [
    currentData.destination.companyName || '',
    currentData.destination.address || '',
    currentData.destination.city || ''
  ].forEach(line => {
    doc.text(line, midX, toY, { maxWidth: 80 });
    toY += 4;
  });

  y = Math.max(fromY, toY);

  // === Technical Details ===
  const spacing = 5;
  let tY = y;
  const tech = currentData.technicalDetails || {};
  const transport = currentData.transport || {};

  doc.setFont('helvetica', 'bold');
  doc.text('Poids Net:', leftX, tY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${tech.poidsNetTotal || ''} KG`, leftX + 36, tY);

  tY += spacing;
  doc.setFont('helvetica', 'bold');
  doc.text('Poids Brut:', leftX, tY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${tech.poidsBrutTotal || ''} KG`, leftX + 36, tY);

  tY += spacing;
  doc.setFont('helvetica', 'bold');
  doc.text('Truck N°:', leftX, tY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${transport.truckNumber || tech.truckNumber || '5671-011'}`, leftX + 36, tY);

  tY += spacing;
  doc.setFont('helvetica', 'bold');
  doc.text('Total Palettes:', leftX, tY);
  doc.setFont('helvetica', 'normal');
  doc.text('22', leftX + 36, tY);

  tY += spacing;
  doc.setFont('helvetica', 'bold');
  doc.text('Order N°:', leftX, tY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${tech.orderNumber || ''}`, leftX + 36, tY);

  tY += spacing;
  doc.setFont('helvetica', 'bold');
  doc.text('Internal Traceability:', leftX, tY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${tech.traceabilityNumber || '—'}`, leftX + 36, tY);

  y = tY + 8;

  // === Table Header ===
  const tableX = margin;
  const tableW = pageWidth - margin * 2;
  const colW = [tableW * 0.48, tableW * 0.12, tableW * 0.13, tableW * 0.12, tableW * 0.15];
  const colX = [tableX, tableX + colW[0], tableX + colW[0] + colW[1], tableX + colW[0] + colW[1] + colW[2], tableX + colW[0] + colW[1] + colW[2] + colW[3]];

  doc.setFillColor(161, 240, 161);
  doc.rect(tableX, y, tableW, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.setFontSize(10);
  doc.text('DESCRIPTION', colX[0] + 3, y + 7);
  doc.text('ORIGIN', colX[1] + 3, y + 7);
  doc.text('PRICE', colX[2] + 3, y + 7);
  doc.text('QUANTITIES', colX[3] + 3, y + 7);
  doc.text('AMOUNT', colX[4] + 10, y + 7);

  y += 12;

  // === Aggregation ===
  const agg: Record<string, { produit: string; calibre: string; origin: string; price: number; qty: number; amount: number }> = {};
  const rowQtyMap: Record<string, number> = {};
  (currentData.palletRows || []).forEach((r: any) => {
    const produit = r.produit || '';
    const calibre = r.calibre || '';
    const caisses = parseInt(r.caissesPerPalette || '0') || 0;
    const key = `${produit}||${calibre}`;
    rowQtyMap[key] = (rowQtyMap[key] || 0) + caisses;
  });

  const keys = Array.from(new Set([...Object.keys(rowQtyMap), ...Object.keys(invoiceQuantities || {})]));

  keys.forEach(kpc => {
    const [produit, calibre] = kpc.split('||');
    const keyPriceOnly = `${produit}||${calibre}`;
    const manualPrice = (invoicePrices as any)?.[keyPriceOnly];
    const fallbackPrice = parseFloat(String(tech?.unitPrice ?? '33.5')) || 33.5;
    const price = typeof manualPrice === 'number' ? manualPrice : fallbackPrice;
    const qtyFromRows = rowQtyMap[keyPriceOnly] || 0;
    const qtyOverride = (invoiceQuantities as any)?.[keyPriceOnly];
    const qty = typeof qtyOverride === 'number' ? qtyOverride : qtyFromRows;
    const key = `${produit}||${calibre}||${price}`;
    if (!agg[key]) agg[key] = { produit, calibre, origin: 'MOROCCO', price, qty: 0, amount: 0 };
    agg[key].qty += qty;
    agg[key].amount += price * qty;
  });

  // === Draw Rows ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  let rowIndex = 0;
  let totalQty = 0;
  let totalAmount = 0;

  for (const k of Object.keys(agg)) {
    const it = agg[k];
    const isConvo = it.produit.toUpperCase().includes('CONVO');
    const descMain = `${it.produit} `;
    
    // === FIX: Hide lot number for CONVO items ===
    const descSub = !isConvo ? `Lot n° ${tech.lotNumbers || ''}` : '';

    const rowH = descSub ? 12 : 8;

    if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(tableX, y - 1, tableW, rowH + 1, 'F');
    }

    doc.setTextColor(...darkText);
    doc.setFontSize(8);
    doc.text(descMain, colX[0] + 3, y + 5);
    
    // === FIX: Only show descSub if it's not empty (CONVO items will have empty descSub) ===
    if (descSub) {
      doc.text(descSub, colX[0] + 3, y + 10);
    }

    doc.text(it.origin, colX[1] + 3, y + 7);
    doc.text(it.price.toFixed(2) + ' €', colX[2] + colW[2] / 2, y + 7, { align: 'center' });
    doc.text(String(it.qty), colX[3] + colW[3] / 2, y + 7, { align: 'center' });
    doc.text(it.amount.toFixed(2) + ' €', colX[4] + colW[4] - 3, y + 7, { align: 'right' });

    y += rowH + 2;
    rowIndex++;
    totalQty += it.qty;
    totalAmount += it.amount;

    if (y > 250) {
      doc.addPage();
      y = margin + 10;
    }
  }

  // === Totals ===
  y += 6;
  const totalsX = tableX + tableW - 80;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', totalsX, y);
  doc.text(String(totalQty), totalsX + 30, y, { align: 'center' });
  doc.text(totalAmount.toFixed(2) + ' €', totalsX + 70, y, { align: 'right' });

  const transportFee = parseFloat(String(tech?.transportFee ?? '0')) || 0;
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('Transport Fee', totalsX, y);
  doc.text(transportFee.toFixed(2) + ' €', totalsX + 70, y, { align: 'right' });

  const invoiceTotal = totalAmount + transportFee;
  y += 9;
  doc.setFillColor(161, 240, 161);
  doc.rect(totalsX - 2, y - 6, 84, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL INVOICE', totalsX, y);
  doc.text(invoiceTotal.toFixed(2) + ' €', totalsX + 70, y, { align: 'right' });

  // === Footer ===
  const pageHeight = 297;
  const footerHeight = 25;
  const footerY = pageHeight - footerHeight;
  const bankY = footerY - 50;
  const paymentY = footerY - 30;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  doc.text('NOTE:', margin, paymentY);
  doc.text('Payment Term: Bank Transfer', margin, paymentY + 4);
  doc.text('Payment Period: 50% Against documents - 50% after 1 week', margin, paymentY + 8);
  doc.text('Product Global GAP certified: 4063651496413', margin, paymentY + 12);
  doc.text('Incoterm: DAP', margin, paymentY + 16);

  doc.text('Bank Name: BMCE', margin, bankY);
  doc.text('Account Number: 011 330 000012100007968 70', margin, bankY + 4);
  doc.text('IBAN: MA64 0113 3300 0012 1000 7968 70', margin, bankY + 8);
  doc.text('SWIFT: BMCEMAMC', margin, bankY + 12);

  doc.setFillColor(161, 240, 161);
  doc.rect(margin, footerY, pageWidth - margin * 2, footerHeight, 'F');

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('« FRUITS FOR YOU SARL AU »', pageWidth / 2, footerY + 6, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.text(
    'LOT N° 14 Rez De Chaussée Zone Industrielle 14A Bir Rami Est Troisième Tranche - KENITRA - MAROC',
    pageWidth / 2, footerY + 10, { align: 'center' }
  );
  doc.text(
    'RC: 66947 PATENTE: 20116193 IF: 53212280 ICE: 003160557000032',
    pageWidth / 2, footerY + 14, { align: 'center' }
  );
  doc.text(
    'Téléphone: +212 608-107057 - Email: contact@fruitsforyou.ma - Site web: www.fruitsforyou.ma',
    pageWidth / 2, footerY + 18, { align: 'center' }
  );

  const fileName = `Facture_${currentLot.lotNumber}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};

// Now the corrected generatePDF function


const getCurrentLot = () => lots.find(lot => lot.id === currentLotId);
  const currentLot = getCurrentLot();
  const currentData = currentLot?.formData;

  // calculateRealSummary is defined above (uses paletteNr and caissesPerPalette)

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

  const updateField = (section: keyof FormData, field: string, value: any) => {
    setLots((prevLots) =>
      prevLots.map((lot) => {
        if (lot.id === currentLotId) {
          const updatedSection = {
            ...(lot.formData as any)[section],
            [field]: value
          };

          const updatedForm = {
            ...lot.formData,
            [section]: updatedSection
          } as any;

          return {
            ...lot,
            formData: updatedForm,
            updatedAt: new Date().toISOString()
          } as any;
        }
        return lot;
      })
    );

    // persist locally immediately when editing a row
    try { localStorage.setItem('packing_lists', JSON.stringify(lots)); } catch (e) { /* ignore */ }
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
    try { localStorage.setItem('packing_lists', JSON.stringify(lots)); } catch (e) { /* ignore */ }
  };

  const deleteRow = (rowIndex: number) => {
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

    const updateRow = (rowIndex: number, field: string, value: any) => {
      setLots(prevLots => prevLots.map(lot => {
        if (lot.id === currentLotId) {
          const newRows = lot.formData.palletRows.map((r: any, idx: number) => idx === rowIndex ? { ...r, [field]: value } : r);
          newRows.forEach((r: any, idx: number) => r.numero = idx + 1);

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
          } as any;
        }
        return lot;
      }));

      try { localStorage.setItem('packing_lists', JSON.stringify(lots)); } catch (e) { /* ignore */ }
    };

  const createNewLot = () => {
    const newLot = {
      id: `lot-${Date.now()}`,
      lotNumber: `PL-2025-${String(lots.length + 1).padStart(3, '0')}`,
      status: 'brouillon',
      formData: {
        origin: { companyName: 'FRUITS FOR YOU', address: 'Lot N°14 Rez De Chaussée Zone Industrielle', city: 'Kénitra – Maroc' },
        destination: { companyName: 'AZ FRANCE', address: '18 Rue du Puits Dixme, 94320 Thiais', city: 'France' },
        transport: { truckNumber: '', chauffeurNumber: '', transporteur: 'CAP MED', scelle: '' },
        technicalDetails: {
          dateProduction: new Date().toISOString().split('T')[0],
          dateDeparture: new Date().toISOString().split('T')[0],
          lotNumbers: '', ggn: '4063651496413', orderNumber: '',
          poidsNetTotal: '0', poidsBrutTotal: '0',
          traceabilityNumber: '',
          invoiceNumber: ''
        },
        palletRows: Array.from({ length: 10 }, (_, i) => ({
          numero: i + 1, produit: 'AVOCAT HASS BIO', calibre: '16',
          paletteNr: (i + 1).toString(), caissesPerPalette: '264'
        })),
        calibreSummary: {}, palletTypes: { type220: 0, type264: 0, type90: 0, type108: 0 }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setLots([...lots, newLot]);
    setCurrentLotId(newLot.id);
    try { localStorage.setItem('packing_lists', JSON.stringify([...lots, newLot])); } catch (e) { /* ignore */ }
    showSuccess('Nouveau lot créé avec succès!');
  };

  const duplicateLot = (lotId: string) => {
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
    const newLots = [...lots, newLot];
    setLots(newLots);
    setCurrentLotId(newLot.id);
    try { localStorage.setItem('packing_lists', JSON.stringify(newLots)); } catch (e) { /* ignore */ }
    showSuccess('Lot dupliqué avec succès!');
  };

  const deleteLot = (lotId: string) => {
    if (lots.length <= 1) {
      alert('Vous ne pouvez pas supprimer le dernier lot');
      return;
    }
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce lot ?')) {
      const newLots = lots.filter(lot => lot.id !== lotId);
      setLots(newLots);
      try { localStorage.setItem('packing_lists', JSON.stringify(newLots)); } catch (e) { console.warn('local save failed', e); }
      if (currentLotId === lotId) {
        setCurrentLotId(newLots[0]?.id || '');
      }
      showSuccess('Lot supprimé avec succès!');
    }
  };

  const archiveLot = () => {
    // Update local state and persist locally first
    setLots(prevLots => {
      const newLots = prevLots.map(lot => {
        if (lot.id === currentLotId) {
          return { ...lot, status: 'termine', updatedAt: new Date().toISOString() };
        }
        return lot;
      });
      try {
        localStorage.setItem('packing_lists', JSON.stringify(newLots));
      } catch (e) {
        console.warn('Local save failed during archive', e);
      }

      // Try to persist archive to Firestore (backend)
      (async () => {
        try {
          if (!currentLotId) throw new Error('Aucun lot sélectionné');
          const docRef = firestoreDoc(db, 'packing-lists', currentLotId);
          await updateDoc(docRef, { status: 'termine', updatedAt: serverTimestamp() });
          showSuccess('Lot archivé sur Firestore avec succès!');
        } catch (err) {
          console.error('Archive backend error', err);
          showSuccess('Lot archivé localement. Backend indisponible.');
        }
      })();

      showSuccess('Lot archivé localement!');
      return newLots;
    });
  };

  const resetForm = () => {
    if (window.confirm("Êtes-vous sûr de vouloir réinitialiser ce lot?")) {
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
      showSuccess('Lot réinitialisé!');
    }
  };
const generatePDF = useCallback(async () => {
  if (!currentData || !currentLot) return;

  setIsGeneratingPDF(true);
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF('l', 'mm', 'a4'); // LANDSCAPE orientation

    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 10;

    type RGB = [number, number, number];
    const colors: Record<string, RGB> = {
      primary: [34, 197, 94],
      primaryDark: [22, 163, 74],
      dark: [33, 33, 33],
      muted: [97, 97, 97],
      headerBg: [230, 252, 239],
      lightGreen: [240, 253, 244],
      border: [200, 200, 200],
      white: [255, 255, 255],
      accent: [249, 115, 22]
    };

    // ENHANCED HEADER - Larger and more prominent
    const HEADER_HEIGHT = 35;
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');
    
    // Accent bar for visual separation
    doc.setFillColor(...colors.primaryDark);
    doc.rect(0, HEADER_HEIGHT - 4, pageWidth, 4, 'F');

    // Enhanced Logo with larger size
    try {
      const logoUrl = '/assets/logo.png';
      const res = await fetch(logoUrl).then(r => r.blob()).then(b => new Promise((res2, rej) => {
        const fr = new FileReader(); 
        fr.onload = () => res2(fr.result); 
        fr.onerror = rej; 
        fr.readAsDataURL(b);
      }));
      if (res) {
        doc.addImage(String(res), 'PNG', margin, 4, 22, 22);
      }
    } catch (e) {
      // Fallback company name
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('FRUITS FOR YOU', margin, 15);
    }

    // Enhanced Title with larger font
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PACKING LIST', pageWidth / 2, 15, { align: 'center' });
    
    // Subtitle for better context
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Document d\'Expédition et Traçabilité', pageWidth / 2, 22, { align: 'center' });

    // Enhanced Header Info - Larger and better organized
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const headerRightX = pageWidth - margin;
    
    const headerInfo = [
      { label: 'LOT:', value: currentLot.lotNumber },
      { label: 'DATE:', value: new Date().toLocaleDateString('fr-FR') },
      { label: 'CHARGEMENT:', value: (currentData?.technicalDetails as any)?.loadingDate || currentData?.technicalDetails?.dateDeparture || 'N/A' },
      { label: 'PRODUCTION:', value: (currentData?.technicalDetails as any)?.productionDate || currentData?.technicalDetails?.dateProduction || 'N/A' }
    ];

    let headerY = 10;
    headerInfo.forEach((info) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(240, 240, 240);
      doc.text(info.label, headerRightX - 30, headerY, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
      doc.text(info.value, headerRightX, headerY, { align: 'right' });
      headerY += 5;
    });

    // Enhanced Origin/Destination section - Larger and more prominent
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    
    const originDestY = 27;
    const originDestWidth = 85;
    
    // Origin section with background
    doc.setFillColor(255, 255, 255, 0.15);
    doc.roundedRect(margin + 25, originDestY, originDestWidth, 8, 2, 2, 'F');
    doc.text('🢒 ORIGINE', margin + 30, originDestY + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${currentData.origin.companyName || 'FRUITS FOR YOU'}`, margin + 50, originDestY + 3);
    doc.text(`${currentData.origin.city || 'Kénitra'}`, margin + 50, originDestY + 6);

    // Destination section with background
    doc.setFillColor(255, 255, 255, 0.15);
    doc.roundedRect(margin + 25 + originDestWidth + 5, originDestY, originDestWidth, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('🢒 DESTINATION', margin + 30 + originDestWidth + 5, originDestY + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`${currentData.destination.companyName || 'Westfalia'}`, margin + 50 + originDestWidth + 5, originDestY + 3);
    doc.text(`${currentData.destination.city || 'France'}`, margin + 50 + originDestWidth + 5, originDestY + 6);

    const contentStartY = HEADER_HEIGHT + 8;

    // Calculate data
    const calculations = calculateRealSummary(currentData.palletRows || []);

    // ENHANCED LEFT COLUMN - Larger Pallet Details Table
    const leftColX = margin;
    const leftColWidth = 120;

    const palletRows = currentData.palletRows || [];
    const tableHead = [['N°', 'PRODUIT', 'CALIBRE', 'PALETTES', 'CAISSES/PAL', 'TOTAL CAISSES']];

    const tableBody = palletRows.map((r: any, idx: number) => {
      const numero = r.numero ?? (idx + 1);
      const produit = r.produit || '';
      const calibre = r.calibre || '';
      const palettes = parseInt(String(r.paletteNr || '0'), 10) || 0;
      const caissesPer = parseInt(String(r.caissesPerPalette || '0'), 10) || 0;
      const totalCaisses = palettes * caissesPer;
      return [String(numero), produit, String(calibre), String(palettes), String(caissesPer), String(totalCaisses)];
    });

    // Enhanced totals row
    tableBody.push([
      'TOTAL GÉNÉRAL', 
      '', 
      '', 
      String(calculations.totalPallets || 0), 
      '', 
      String(calculations.totalCaisses || calculations.totalBoxes || 0)
    ]);

    autoTable(doc, {
      startY: contentStartY,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: colors.primary,
        textColor: colors.white,
        halign: 'center',
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 3,
        lineWidth: 0.2
      },
      styles: {
        fontSize: 8,
        textColor: colors.dark,
        cellPadding: 2,
        halign: 'center',
        lineWidth: 0.15,
        lineColor: colors.border
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 50, halign: 'left' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: (data: any) => {
        if (data.row.index === tableBody.length - 1 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = colors.lightGreen;
          data.cell.styles.fontSize = 9;
        }
        // Highlight rows with data issues
        if (data.section === 'body' && data.row.index < tableBody.length - 1) {
          const palettes = parseInt(data.row.raw[3] || '0');
          const caissesPer = parseInt(data.row.raw[4] || '0');
          if (palettes > 0 && caissesPer === 0) {
            data.cell.styles.fillColor = [255, 243, 205]; // Warning yellow
          }
        }
      },
      margin: { left: leftColX },
      tableWidth: leftColWidth,
      pageBreak: 'auto'
    });

    // ENHANCED MIDDLE COLUMN - Larger Pallet Type Tables
    const midColX = leftColX + leftColWidth + 8;
    const midColWidth = 58;

    const palletRowsForPdf = currentData.palletRows || [];
    const palletTypesToRender = [90, 108, 220, 264];

    // Enhanced pallet type table builder
    const buildPalletTypeTable = (caissesPer: number) => {
      const groups: Record<string, number> = {};
      let totalPalettes = 0;
      let totalBoxes = 0;

      palletRowsForPdf.forEach((r: any) => {
        const cpp = parseInt(r.caissesPerPalette || '0', 10) || 0;
        if (cpp === caissesPer) {
          const cal = String(r.calibre || 'N/A');
          const palettes = parseInt(r.paletteNr || '0', 10) || 0;
          groups[cal] = (groups[cal] || 0) + palettes;
          totalPalettes += palettes;
          totalBoxes += palettes * caissesPer;
        }
      });

      const rows = Object.entries(groups)
        .sort((a, b) => {
          const na = parseInt(a[0], 10);
          const nb = parseInt(b[0], 10);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a[0].localeCompare(b[0]);
        })
        .map(([cal, pal]) => [cal, String(pal)]);

      if (rows.length > 0) {
        rows.push(['———', '———']); // Separator
        rows.push(['TOTAL PAL.', String(totalPalettes)]);
        rows.push(['TOTAL CAIS.', String(totalBoxes)]);
      }

      return {
        head: [['CALIBRE', `PALETTE ${caissesPer}`]],
        body: rows.length > 0 ? rows : [['Aucune', 'donnée']]
      };
    };

    // Render enhanced pallet type tables with better spacing
    let currentY = contentStartY;
    for (let i = 0; i < palletTypesToRender.length; i++) {
      const cpp = palletTypesToRender[i];
      const tbl = buildPalletTypeTable(cpp);
      
      autoTable(doc, {
        startY: currentY,
        head: tbl.head,
        body: tbl.body,
        theme: 'grid',
        headStyles: {
          fillColor: colors.primary,
          textColor: colors.white,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          cellPadding: 2.5
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 1.5,
          textColor: colors.dark,
          halign: 'center',
          lineWidth: 0.15
        },
        columnStyles: {
          0: { cellWidth: 25, fontStyle: 'bold' },
          1: { cellWidth: 28 }
        },
        didParseCell: (data: any) => {
          const bodyLen = tbl.body.length;
          if (data.section === 'body') {
            if (data.row.raw[0] === '———') {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = colors.muted;
            } else if (data.row.index >= bodyLen - 2 && rows.length > 0) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = colors.lightGreen;
              data.cell.styles.fontSize = 8;
            }
          }
        },
        margin: { left: midColX },
        tableWidth: midColWidth
      });

      currentY = (doc as any).lastAutoTable?.finalY + 6;
    }

    // ENHANCED RIGHT COLUMN - Larger Technical Details
    const rightColX = midColX + midColWidth + 8;
    const rightColWidth = pageWidth - rightColX - margin;
    const rightColHeight = 125;
    
    // Enhanced technical details box
    doc.setFillColor(...colors.lightGreen);
    doc.roundedRect(rightColX, contentStartY, rightColWidth, rightColHeight, 3, 3, 'F');
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.7);
    doc.roundedRect(rightColX, contentStartY, rightColWidth, rightColHeight, 3, 3);
    
    // Enhanced header with icon
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text('📋 DÉTAILS TECHNIQUES', rightColX + 5, contentStartY + 8);
    
    // Separator line
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.4);
    doc.line(rightColX + 5, contentStartY + 11, rightColX + rightColWidth - 5, contentStartY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let detailY = contentStartY + 18;
    const lineHeight = 5.5;
    
    // Enhanced details list with better organization
    const detailsList = [
      { label: '📅 Date Production:', value: (currentData.technicalDetails as any)?.productionDate || currentData.technicalDetails?.dateProduction || '—' },
      { label: '🚚 Date Chargement:', value: (currentData.technicalDetails as any)?.loadingDate || currentData.technicalDetails?.dateDeparture || '—' },
      { label: '🏷️ N° Lot:', value: currentData.technicalDetails?.lotNumbers || '—' },
      { label: '🌐 GGN:', value: currentData.technicalDetails?.ggn || '—' },
      { label: '📦 Commande N°:', value: currentData.technicalDetails?.orderNumber || '—' },
      { label: '🧾 N° Facture:', value: (currentData.technicalDetails as any)?.invoiceNumber || '—' },
      { label: '🔍 Traçabilité:', value: (currentData.technicalDetails as any)?.traceabilityNumber || '—' },
      { label: '🔒 Scellé:', value: (currentData.technicalDetails as any)?.seal || '—' },
      { label: '⚖️ Poids Net (KG):', value: String(currentData.technicalDetails?.poidsNetTotal || '—') },
      { label: '📦 Poids Brut (KG):', value: String(currentData.technicalDetails?.poidsBrutTotal || '—') },
      { label: '🕒 Créé le:', value: new Date().toLocaleString('fr-FR') }
    ];

    // Enhanced transport info section
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.primaryDark);
    doc.text('🚛 INFORMATIONS TRANSPORT', rightColX + 5, detailY);
    detailY += lineHeight + 2;

    const transportInfo = [
      { label: 'Camion N°:', value: currentData.transport?.truckNumber || '—' },
      { label: 'Chauffeur:', value: currentData.transport?.chauffeurNumber || '—' },
      { label: 'Transporteur:', value: currentData.transport?.transporteur || '—' },
      { label: 'Scellé:', value: (currentData.transport as any)?.scelle || '—' }
    ];

    transportInfo.forEach(({ label, value }) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.dark);
      doc.text(label, rightColX + 8, detailY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.muted);
      doc.text(value, rightColX + 35, detailY, { maxWidth: rightColWidth - 40 });
      detailY += lineHeight;
    });

    detailY += 3;

    // Enhanced details rendering with better spacing
    detailsList.forEach(({ label, value }) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.dark);
      doc.text(label, rightColX + 5, detailY, { maxWidth: rightColWidth - 10 });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.muted);
      doc.text(value || '—', rightColX + 45, detailY, { maxWidth: rightColWidth - 50 });
      detailY += lineHeight;
    });

    // ENHANCED SUMMARY SECTION - Larger and more prominent
    try {
      const lastY = Math.max((doc as any).lastAutoTable?.finalY || contentStartY, detailY + 10);
      const totalsBoxX = margin;
      const totalsBoxW = pageWidth - margin * 2;
      const totalsBoxH = 16;
      const totalsBoxY = lastY + 6;

      // Enhanced summary box
      doc.setFillColor(...colors.headerBg);
      doc.roundedRect(totalsBoxX, totalsBoxY, totalsBoxW, totalsBoxH, 3, 3, 'F');
      doc.setDrawColor(...colors.primary);
      doc.setLineWidth(0.6);
      doc.roundedRect(totalsBoxX, totalsBoxY, totalsBoxW, totalsBoxH, 3, 3);

      // Enhanced summary content with larger fonts
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.dark);
      
      const summaryItems = [
        `📦 ${calculations.totalPallets || 0} Palettes`,
        `📋 ${calculations.totalCaisses || calculations.totalBoxes || 0} Caisses`,
        `⚖️ Net: ${currentData.technicalDetails?.poidsNetTotal || 0} KG`,
        `📊 Brut: ${currentData.technicalDetails?.poidsBrutTotal || 0} KG`
      ];
      
      const summaryText = summaryItems.join('  •  ');
      doc.text(summaryText, totalsBoxX + totalsBoxW / 2, totalsBoxY + 10, { align: 'center' });

    } catch (e) {
      console.warn('PDF summary render error', e);
    }

    // ENHANCED FOOTER - Larger and more informative
    doc.setFontSize(7);
    doc.setTextColor(...colors.muted);
    const footerY = pageHeight - 8;
    
    doc.text(`🕒 Généré le ${new Date().toLocaleString('fr-FR')}`, margin, footerY);
    doc.text(`📄 Document Officiel - Page 1/1`, pageWidth / 2, footerY, { align: 'center' });
    doc.text(`© FRUITS FOR YOU ${new Date().getFullYear()}`, pageWidth - margin, footerY, { align: 'right' });

    // Add document border for professional look
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.3);
    doc.rect(3, 3, pageWidth - 6, pageHeight - 6);

    const filename = `PackingList_${currentData.technicalDetails?.lotNumbers || currentLot.lotNumber || 'PACK'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);

    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 4000);
  } catch (err) {
    console.error('Error generating enhanced PDF:', err);
    showSuccess('Erreur lors de la génération du PDF');
  } finally {
    setIsGeneratingPDF(false);
  }
}, [currentData, currentLot]);
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
      csv += `Truck N°,${currentData.transport.truckNumber}\n`;
      csv += `Chauffeur N°,${currentData.transport.chauffeurNumber}\n`;
      csv += `Transporteur,${currentData.transport.transporteur}\n`;
      csv += `Scellé,${currentData.transport.scelle}\n\n`;

      csv += 'DETAILS TECHNIQUES\n';
      csv += `Date Production,${currentData.technicalDetails.dateProduction}\n`;
      csv += `Date Departure,${currentData.technicalDetails.dateDeparture}\n`;
      csv += `Lot Numbers,${currentData.technicalDetails.lotNumbers}\n`;
      csv += `GGN,${currentData.technicalDetails.ggn}\n`;
      csv += `Order N°,${currentData.technicalDetails.orderNumber}\n`;
      csv += `Poids Net Total,${currentData.technicalDetails.poidsNetTotal} KG\n`;
      csv += `Poids Brut Total,${currentData.technicalDetails.poidsBrutTotal} KG\n\n`;

      csv += 'PALETTES\n';
      csv += 'N°,Produit,Calibre,Palette Nr,Caisses/Palette\n';
      currentData.palletRows.forEach(row => {
        csv += `${row.numero},${row.produit},${row.calibre},${row.paletteNr},${row.caissesPerPalette}\n`;
      });

      csv += '\nCALIBRE SUMMARY\n';
      csv += 'Calibre,Palettes,Caisses\n';
      const calculations = calculateRealSummary(currentData.palletRows);
      Object.entries(calculations.calibreSummary).forEach(([cal, data]) => {
        const typedData = data as { palettes: number; caisses: number };
        if (typedData.palettes > 0) {
          csv += `${cal},${typedData.palettes},${typedData.caisses}\n`;
        }
      });

      csv += '\nPALLET TYPES\n';
      csv += `Type 90,${calculations.palletTypes.type90}\n`;
      csv += `Type 10,${calculations.palletTypes.type108}\n`;
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

      showSuccess('Fichier Excel généré avec succès!');

    } catch (error) {
      console.error('Error generating Excel:', error);
      alert('Erreur lors de la génération du fichier Excel');
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  // Fixing implicit 'any' types
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const getStatusConfig = (status: 'en_cours' | 'brouillon' | 'termine') => {
    const configs = {
      brouillon: { label: 'Brouillon', bg: 'bg-gray-100', text: 'text-gray-700', ring: 'ring-gray-300' },
      en_cours: { label: 'En cours', bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-300' },
      termine: { label: 'Terminé', bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-300' },
    };
    return configs[status];
  };

  // Excel-style keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentData && rowIndex < currentData.palletRows.length - 1) {
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
      } else if (currentData && rowIndex < currentData.palletRows.length - 1) {
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
            <p className="text-gray-600 mb-8 text-lg">Créez votre première liste pour commencer à gérer vos expéditions d'avocats</p>
            <button
              onClick={createNewLot}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 font-medium transition-colors"
            >
              <Plus size={20} />
              Créer la première liste
            </button>
          </div>
        </div>
      </div>
    );
  }

  const saveData = () => {
    // Immediate local save first (user data saved to localhost)
    try {
      localStorage.setItem('packing_lists', JSON.stringify(lots));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }

    // Then attempt to save to backend; return a promise so callers can await if needed
    const doSave = async () => {
      setIsSaving(true);
      try {
        // Persist all lots to Firestore (local-first: we've already saved to localStorage)
        const savePromises = lots.map(async (lot) => {
          const docRef = firestoreDoc(db, 'packing-lists', lot.id);
          // Use merge so existing fields are preserved and timestamps are updated by server
          await setDoc(docRef, { ...lot, updatedAt: serverTimestamp() }, { merge: true });
        });
        await Promise.all(savePromises);
        showSuccess('Données sauvegardées sur Firestore avec succès!');
      } catch (err) {
        console.error('Error saving to backend:', err);
        showSuccess('Backend indisponible. Sauvegarde locale effectuée.');
      } finally {
        setIsSaving(false);
      }
    };

    doSave();
  };

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
                <p className="text-sm text-gray-500">Plateforme industrielle d'exportation d'avocats • {lots.length} lot(s)</p>
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
              const statusConfig = getStatusConfig(lot.status as 'en_cours' | 'brouillon' | 'termine');
              const isActive = currentLotId === lot.id;

              return (
                <div
                  key={lot.id}
                  className={`flex items-center rounded-md overflow-hidden min-w-fit transition-all ${isActive ? 'ring-2 ring-emerald-500 shadow-sm' : 'shadow-sm'
                    }`}
                >
                  <button
                    onClick={() => setCurrentLotId(lot.id)}
                    className={`px-4 py-2 flex items-center gap-2 transition-colors ${isActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <Truck size={16} />
                    <div className="text-left">
                      <div className="font-medium text-sm whitespace-nowrap">{lot.lotNumber}</div>
                      <div className="text-xs opacity-75">{lot.formData.technicalDetails.orderNumber || 'Sans commande'}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-md font-medium ${isActive ? 'bg-white/20 text-white' : `${statusConfig.bg} ${statusConfig.text}`
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
            <p className="font-medium text-gray-900">Succès!</p>
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
                  className={`px-3 py-1 rounded-md text-sm font-medium ${historyFilter === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                >
                  Tous ({lots.length})
                </button>
                <button
                  onClick={() => setHistoryFilter('termine')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${historyFilter === 'termine' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                >
                  Archivés ({lots.filter(l => l.status === 'termine').length})
                </button>
              </div>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
              {lots
                .filter(lot => historyFilter === 'all' || lot.status === historyFilter)
                .map(lot => {
                  const statusConfig = getStatusConfig(lot.status as 'en_cours' | 'brouillon' | 'termine');
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
                        <div>Modifié: {new Date(lot.updatedAt).toLocaleDateString('fr-FR')}</div>
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
              onClick={() => setShowGenerateModal(true)}
              disabled={isGeneratingPDF}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPDF ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <FilePlus size={18} />
                  Générer PDF
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
                  Génération...
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
              Générer Facture
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
              Réinitialiser
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

        {/* Generate PDF confirmation modal */}
        {showGenerateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            onClick={() => { if (!isGeneratingPDF) setShowGenerateModal(false); }}
            aria-hidden={isGeneratingPDF}
          >
            <div className="bg-white rounded-md shadow-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <h3 className="text-lg font-semibold mb-2">Générer PDF</h3>
              <p className="text-sm text-gray-600 mb-4">Vérifiez les totaux ci-dessous avant de générer le PDF.</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-gray-50 rounded border">
                  <div className="text-xs text-gray-500">Palettes totales</div>
                  <div className="text-xl font-bold">{calculations?.totalPallets ?? 0}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded border">
                  <div className="text-xs text-gray-500">Caisses totales</div>
                  <div className="text-xl font-bold">{calculations?.totalCaisses ?? calculations?.totalBoxes ?? 0}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-2">
                <div className="flex-1 text-sm text-gray-600">La génération peut prendre quelques secondes selon la taille de la liste.</div>
                {isGeneratingPDF && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                    <div>Génération en cours...</div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { if (!isGeneratingPDF) setShowGenerateModal(false); }}
                  className={`px-4 py-2 border rounded-md ${isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={isGeneratingPDF}
                >
                  Annuler
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Keep the modal visible while generating so user sees progress
                      await generatePDF();
                      // close modal after success
                      setShowGenerateModal(false);
                    } catch (err) {
                      console.error('PDF generation failed', err);
                      showSuccess('Erreur lors de la génération du PDF.');
                    }
                  }}
                  className={`px-4 py-2 bg-red-600 text-white rounded-md ${isGeneratingPDF ? 'opacity-70 cursor-wait' : ''}`}
                  disabled={isGeneratingPDF}
                >
                  {isGeneratingPDF ? 'Génération...' : 'Confirmer et générer'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                  }} className="px-3 py-1 bg-gray-100 rounded-md">Réinitialiser</button>
                  <button onClick={() => {
                    // Apply AVOCAT HASS BIO preset: calibres 12..32 step 2 with price 33.5
                    const presetCalibres = ['12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32'];
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
                    showSuccess(`Prix 33.5€ appliqués. Total caisses: ${totalApplied} (${appliedList})`);
                  }} className="px-3 py-1 bg-emerald-600 text-white rounded-md">Importer quantités AVOCAT</button>
                  <button onClick={() => setShowPriceConfig(false)} className="px-3 py-1 bg-emerald-600 text-white rounded-md">Fermer</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(() => {
                  const agg: Record<string, { produit: string; calibre: string; qty: number }> = {};
                  (currentData.palletRows || []).forEach((r) => {
                    const produit = r.produit || '';
                    const calibre = r.calibre || '';
                    const caisses = parseInt(r.caissesPerPalette || '0') || 0;
                    const key = `${produit}||${calibre}`;
                    if (!agg[key]) agg[key] = { produit, calibre, qty: 0 };
                    agg[key].qty += caisses;
                  });

                  return Object.keys(agg).map((k) => {
                    const it = agg[k];
                    const currentPrice = invoicePrices[k] ?? 33.5;
                    return (
                      <div key={k} className="flex items-center justify-between p-2 border rounded-md">
                        <div>
                          <div className="font-medium text-sm">{it.produit} - {it.calibre}</div>
                          <div className="text-xs text-gray-500">Quantité: {it.qty}</div>
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
                          <span className="text-sm">€</span>
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
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Camion N°</label>
                <input
                  type="text"
                  value={currentData?.transport.truckNumber}
                  onChange={(e) => updateField('transport', 'truckNumber', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Chauffeur N°</label>
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
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Scellé</label>
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
            <h3 className="font-semibold text-white">Détails Techniques</h3>
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
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date Départ</label>
              <input
                type="date"
                value={currentData?.technicalDetails.dateDeparture}
                onChange={(e) => updateField('technicalDetails', 'dateDeparture', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">N° Lot</label>
              <input
                type="text"
                value={currentData?.technicalDetails.lotNumbers}
                onChange={(e) => updateField('technicalDetails', 'lotNumbers', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">GGN</label>
              <input
                type="text"
                value={currentData?.technicalDetails.ggn}
                onChange={(e) => updateField('technicalDetails', 'ggn', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Commande N°</label>
              <input
                type="text"
                value={currentData?.technicalDetails.orderNumber}
                onChange={(e) => updateField('technicalDetails', 'orderNumber', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">N° Facture (Invoice #)</label>
              <input
                type="text"
                value={(currentData?.technicalDetails as any)?.invoiceNumber || ''}
                onChange={(e) => updateField('technicalDetails', 'invoiceNumber', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                placeholder="Entrez le numéro de facture"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Tracabilité interne</label>
              <input
                type="text"
                value={(currentData?.technicalDetails as any)?.traceabilityNumber || ''}
                onChange={(e) => updateField('technicalDetails', 'traceabilityNumber', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors font-mono"
                placeholder="Entrez le numéro de tracabilité"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1 flex items-center gap-1">
                <Weight size={14} />
                Poids Net (KG)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={currentData?.technicalDetails.poidsNetTotal}
                onChange={(e) => {
                  const value = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0).toString();
                  updateField('technicalDetails', 'poidsNetTotal', value);
                }}
                className="w-full px-3 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold"
                placeholder="Entrer le poids net"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1 flex items-center gap-1">
                <Weight size={14} />
                Poids Brut (KG)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={currentData?.technicalDetails.poidsBrutTotal}
                onChange={(e) => {
                  const value = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0).toString();
                  updateField('technicalDetails', 'poidsBrutTotal', value);
                }}
                className="w-full px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-amber-700 font-semibold"
                placeholder="Entrer le poids brut"
              />
            </div>
          </div>
        </div>

        {/* Excel-Style Pallet Table */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="h-5 w-5 text-white" />
              <h3 className="font-semibold text-white">Détails des Palettes</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-white text-sm font-medium bg-white/20 px-3 py-1 rounded-md">
                {calculations?.totalPallets || 0} palettes • {calculations?.totalBoxes || 0} caisses
              </div>
              <button
                onClick={addRow}
                className="bg-white text-emerald-600 px-3 py-1 rounded-md hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-white font-medium text-sm flex items-center gap-1"
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-16">N°</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Produit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-32">Calibre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-32">quantity pallet N°</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-40">Caisses/Palette</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-32">Total caisses</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentData?.palletRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-emerald-50 transition-colors ${selectedCell?.row === idx ? 'bg-emerald-50' : ''
                      }`}
                  >
                    <td className="px-4 py-2">
                      <div className="w-8 h-8 bg-emerald-600 rounded-md flex items-center justify-center text-white font-semibold text-sm">
                        {row.numero}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={row.produit}
                        onChange={(e) => updateRow(idx, 'produit', e.target.value)}
                        onFocus={() => setSelectedCell({ row: idx, field: 'produit' })}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'produit')}
                        className="w-full px-2 py-1.5 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors text-sm"
                      >
                        {produits.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={row.calibre}
                        onChange={(e) => updateRow(idx, 'calibre', e.target.value)}
                        onFocus={() => setSelectedCell({ row: idx, field: 'calibre' })}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'calibre')}
                        className="w-full px-2 py-1.5 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors text-sm font-semibold"
                      >
                        {calibres.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        value={row.paletteNr}
                        onChange={(e) => {
                          const value = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0).toString();
                          updateRow(idx, 'paletteNr', value);
                        }}
                        onFocus={() => setSelectedCell({ row: idx, field: 'paletteNr' })}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'paletteNr')}
                        className="w-full px-2 py-1.5 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors text-center font-semibold text-sm"
                        placeholder="Quantité"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        value={row.caissesPerPalette}
                        onChange={(e) => {
                          const value = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0).toString();
                          updateRow(idx, 'caissesPerPalette', value);
                        }}
                        onFocus={() => setSelectedCell({ row: idx, field: 'caissesPerPalette' })}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'caissesPerPalette')}
                        className="w-full px-2 py-1.5 rounded-md border border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors text-center font-semibold text-sm"
                        placeholder="Nombre de caisses"
                      />
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">
                      {((parseInt(row.paletteNr || '0') || 0) * (parseInt(row.caissesPerPalette || '0') || 0)).toString()}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => deleteRow(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Supprimer la ligne"
                        aria-label="Supprimer la ligne"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
            <div className="flex items-center gap-4">
              <span>💡 Astuce: Utilisez Tab/Enter pour naviguer rapidement entre les cellules (style Excel)</span>
            </div>
          </div>
        </div>

        {/* Real Calculations Summary */}
        {showCalculations && calculations && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Calibre Summary */}
            <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-emerald-600 px-4 py-3 flex items-center gap-2">
                <Calculator className="h-5 w-5 text-white" />
                <h3 className="font-semibold text-white">Résumé par Calibre</h3>
              </div>
              <div className="p-4 space-y-2">
                {Object.entries(calculations.calibreSummary).map(([cal, data]) => {
                  const typedData = data as { palettes: number; caisses: number; quantity: number; caissesPerPalette: number };
                  if (typedData.palettes > 0) {
                    return (
                      <div key={cal} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-emerald-600 rounded-md flex items-center justify-center text-white font-semibold">
                            {cal}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-700">Calibre {cal}</div>
                            <div className="text-xs text-gray-500">{typedData.quantity} lots de {typedData.caissesPerPalette} caisses</div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-xl font-semibold text-emerald-600">{typedData.caisses}</div>
                          <div className="text-xs text-gray-500">caisses</div>
                          <div className="text-xs text-gray-500">
                            ({typedData.quantity} × {typedData.caissesPerPalette} = {typedData.caisses})
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>

            {/* Pallet Types - improved UI with bars, always shown (zeros muted) */}
            <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-amber-500 px-4 py-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-white" />
                <h3 className="font-semibold text-white">Types de Palettes</h3>
              </div>
              <div className="p-4 space-y-3">
                {/* Calculate proportions for bars */}
                {(() => {
                  const pt = calculations.palletTypes || { type90: 0, type108: 0, type220: 0, type264: 0 };
                  const total = Math.max(1, calculations.totalPallets || (pt.type90 + pt.type108 + pt.type220 + pt.type264));
                  const items = [
                    { id: '90', label: 'Type 90', value: pt.type90, color: 'bg-blue-500', bg: 'bg-blue-100' },
                    { id: '108', label: 'Type 108', value: pt.type108, color: 'bg-purple-500', bg: 'bg-purple-100' },
                    { id: '220', label: 'Type 220', value: pt.type220, color: 'bg-amber-500', bg: 'bg-amber-100' },
                    { id: '264', label: 'Type 264', value: pt.type264, color: 'bg-emerald-500', bg: 'bg-emerald-100' }
                  ];
                  return items.map((it) => {
                    const pct = Math.round((it.value / total) * 100);
                    const muted = it.value === 0;
                    return (
                      <div key={it.id} className={`flex items-center gap-3 ${muted ? 'opacity-50' : ''}`}>
                        <div className={`w-12 h-8 flex items-center justify-center rounded-md text-white font-semibold ${it.color}`}>{it.id}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-gray-700">{it.label}</div>
                            <div className="text-sm font-semibold text-gray-900">{it.value}</div>
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded mt-2 overflow-hidden">
                            <div className={`${it.color} h-2`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}

                <div className="pt-3 mt-3 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-gray-50 rounded-md text-center">
                      <div className="text-xs text-gray-500">Palettes</div>
                      <div className="text-xl font-bold text-emerald-600">{calculations.totalPallets}</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-md text-center">
                      <div className="text-xs text-gray-500">Caisses</div>
                      <div className="text-xl font-bold text-emerald-600">{calculations.totalCaisses || calculations.totalBoxes}</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-md text-center">
                      <div className="text-xs text-gray-500">Poids Net (kg)</div>
                      <div className="text-lg font-semibold text-gray-700">{calculations.poidsNetTotal ?? 0}</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-md text-center">
                      <div className="text-xs text-gray-500">Poids Brut (kg)</div>
                      <div className="text-lg font-semibold text-gray-700">{calculations.poidsBrutTotal ?? 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="font-medium">Synchronisé avec localStorage</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Calendar size={16} />
            <span>Dernière modification: {currentLot?.updatedAt ? new Date(currentLot.updatedAt).toLocaleString('fr-FR') : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackingListManager;