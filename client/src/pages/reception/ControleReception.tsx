import React, { useEffect, useMemo, useState } from 'react';
import logoUrl from '../../../assets/icon.png';
import { FilePlus, Package, Plus, RefreshCw, Save, Trash2, Copy, Archive, Download, Eye, Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import { archiveReceptionControl, deleteReceptionArchive, getReceptionArchives, saveReceptionControl } from '../../lib/receptionControlService';

// Data model for avocado quality control
interface QualityControlData {
  header: {
    ref: string;
    version: string;
    date: string;
    deliveryDate: string;
    productRange: string;
    provider: string;
    protocol: string;
    conventionnel: boolean;
    bio: boolean;
    deliveryBonNumber: string;
    receptionBonNumber: string;
    receptionTime: string;
    boxState: string;
    matricule: string;
    variety: string;
    producer: string;
    truckQuality: string;
    totalPallets: string;
    netWeight: string;
    productLotNumber: string;
  };
  qualityChecks: {
    diseaseTraces: { count: string; weight: string; percentage: string };
    ripeFruit: { count: string; weight: string; percentage: string };
    dirtyFruit: { count: string; weight: string; percentage: string };
    sunBurns: { count: string; weight: string; percentage: string };
    withoutStem: { count: string; weight: string; percentage: string };
  };
  totalDefects: string;
  color: string;
  odor: string;
  decision: string;
  responsibleSignature: string;
}

interface QualityControlLot {
  id: string;
  lotNumber: string;
  status: 'brouillon' | 'en_cours' | 'termine';
  data: QualityControlData;
  createdAt: Date;
  updatedAt: Date;
}

const SAMPLE_WEIGHT = 230; // 1 Caisse (23KG) / 12palette = 230kg total

// Color constants with your new scheme
const COLORS = {
  primary: '#161f2e', // Dark blue for main elements
  primaryLight: '#2d3748',
  accent: '#3b82f6', // Blue
  success: '#10b981', // Green
  warning: '#f59e0b', // Amber
  danger: '#ef4444', // Red
  lightBg: '#f8fafc',
  border: '#e2e8f0',
  text: '#1e293b',
  textLight: '#64748b',
  tableHeader: '#161f2e',
  tableSubheader: '#e2e8f0',
};

const defaultQualityControlData = (): QualityControlData => ({
  header: {
    ref: 'SMQ.ENR.10',
    version: '01',
    date: '1/07/2023',
    deliveryDate: new Date().toLocaleDateString('fr-FR'),
    productRange: 'Avocat',
    provider: '',
    protocol: '1 Caisse (23KG) / 12palette',
    conventionnel: true,
    bio: false,
    deliveryBonNumber: '',
    receptionBonNumber: '',
    receptionTime: '',
    boxState: '',
    matricule: '',
    variety: '',
    producer: '',
    truckQuality: '',
    totalPallets: '',
    netWeight: '',
    productLotNumber: '',
  },
  qualityChecks: {
    diseaseTraces: { count: '', weight: '', percentage: '' },
    ripeFruit: { count: '', weight: '', percentage: '' }, // Changed from "string" to empty string
    dirtyFruit: { count: '', weight: '', percentage: '' }, // Changed from "string" to empty string
    sunBurns: { count: '', weight: '', percentage: '' }, // Changed from "string" to empty string
    withoutStem: { count: '', weight: '', percentage: '' }, // Changed from "string" to empty string
  },
  totalDefects: '',
  color: '',
  odor: '',
  decision: '',
  responsibleSignature: '',
});

const ControleReception: React.FC = () => {
  const [lots, setLots] = useState<QualityControlLot[]>([
    {
      id: '1',
      lotNumber: 'Réception 1',
      status: 'brouillon',
      data: defaultQualityControlData(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]);
  const [currentLotId, setCurrentLotId] = useState<string>('1');
  const [archives, setArchives] = useState<QualityControlLot[]>([]);
  const [filteredArchives, setFilteredArchives] = useState<QualityControlLot[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchives, setShowArchives] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load archives from Firebase on mount
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingArchives(true);
        const items = await getReceptionArchives();
        const mapped: QualityControlLot[] = items.map((it) => ({
          id: it.id,
          lotNumber: it.lotNumber,
          status: (it.status as any) || 'brouillon',
          data: it.data as any,
          createdAt: new Date(it.createdAt),
          updatedAt: new Date(it.updatedAt),
        }));
        setArchives(mapped);
        setFilteredArchives(mapped);
      } catch (e) {
        console.error('Failed to load archives', e);
      } finally {
        setLoadingArchives(false);
      }
    };
    load();
  }, []);

  // Filter archives based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredArchives(archives);
    } else {
      const filtered = archives.filter(archive => 
        archive.data.header.receptionBonNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        archive.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        archive.data.header.provider?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredArchives(filtered);
    }
  }, [searchTerm, archives]);

  const currentLot = useMemo(() => lots.find(l => l.id === currentLotId), [lots, currentLotId]);

  const createNewLot = () => {
    const newLot: QualityControlLot = {
      id: Date.now().toString(),
      lotNumber: `Réception ${lots.length + 1}`,
      status: 'brouillon',
      data: defaultQualityControlData(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setLots([...lots, newLot]);
    setCurrentLotId(newLot.id);
  };

  const duplicateLot = (lotId: string) => {
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;

    const newLot: QualityControlLot = {
      id: Date.now().toString(),
      lotNumber: `${lot.lotNumber} (Copie)`,
      status: lot.status,
      data: { ...lot.data },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setLots([...lots, newLot]);
    setCurrentLotId(newLot.id);
  };

  const removeLot = (lotId: string) => {
    if (lots.length <= 1) {
      alert('Vous ne pouvez pas supprimer le dernier lot');
      return;
    }
    if (confirm('Supprimer ce lot ?')) {
      const newLots = lots.filter(l => l.id !== lotId);
      setLots(newLots);
      if (currentLotId === lotId) {
        setCurrentLotId(newLots[0].id);
      }
    }
  };

  const updateCurrentLot = (updates: Partial<QualityControlData>) => {
    if (!currentLot) return;

    const updatedLot = {
      ...currentLot,
      data: {
        ...currentLot.data,
        ...updates,
        header: { ...currentLot.data.header, ...(updates.header || {}) },
        qualityChecks: { ...currentLot.data.qualityChecks, ...(updates.qualityChecks || {}) },
      },
      updatedAt: new Date(),
    };

    setLots(lots.map(l => l.id === currentLotId ? updatedLot : l));
  };

  const resetForm = () => {
    updateCurrentLot(defaultQualityControlData());
  };

  const saveDraftToFirebase = async () => {
    if (!currentLot) return;
    try {
      setSaving(true);
      const id = await saveReceptionControl({
        id: currentLot.id.startsWith('archive_') ? undefined : currentLot.id,
        lotNumber: currentLot.lotNumber,
        status: currentLot.status,
        data: currentLot.data as any,
      });
      if (id !== currentLot.id) {
        setLots(lots.map(l => l.id === currentLotId ? { ...l, id } : l));
        setCurrentLotId(id);
      }
      alert('Brouillon enregistré dans Firebase');
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const saveToArchive = async () => {
    if (!currentLot) return;
    try {
      setSaving(true);
      const id = await archiveReceptionControl({
        id: currentLot.id.startsWith('archive_') ? undefined : currentLot.id,
        lotNumber: `Archive - ${currentLot.lotNumber}`,
        status: 'termine',
        data: currentLot.data as any,
      });
      const archivedLot: QualityControlLot = {
        ...currentLot,
        id,
        lotNumber: `Archive - ${currentLot.lotNumber}`,
        updatedAt: new Date(),
      };
      setArchives([archivedLot, ...archives]);
      setFilteredArchives([archivedLot, ...archives]);
      alert('Fiche archivée sur Firebase');
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'archivage");
    } finally {
      setSaving(false);
    }
  };

  const loadFromArchive = (archive: QualityControlLot) => {
    if (!currentLot) return;
    updateCurrentLot(archive.data);
    alert("Archive chargée dans l'éditeur");
    setShowArchives(false);
  };

  const deleteArchive = async (archiveId: string) => {
    if (!confirm('Supprimer cette archive ?')) return;
    try {
      await deleteReceptionArchive(archiveId);
      const newArchives = archives.filter(a => a.id !== archiveId);
      setArchives(newArchives);
      setFilteredArchives(newArchives);
    } catch (e) {
      console.error(e);
      alert('Suppression impossible');
    }
  };

  const calculatePercentage = (weight: string): string => {
    const weightNum = parseFloat(weight) || 0;
    return ((weightNum / SAMPLE_WEIGHT)).toFixed(2);
  };

  const computeTotalDefects = (qc: QualityControlData['qualityChecks']): string => {
    const percentages = [
      parseFloat(calculatePercentage(qc.diseaseTraces.weight)) || 0,
      parseFloat(calculatePercentage(qc.ripeFruit.weight)) || 0,
      parseFloat(calculatePercentage(qc.dirtyFruit.weight)) || 0,
      parseFloat(calculatePercentage(qc.sunBurns.weight)) || 0,
      parseFloat(calculatePercentage(qc.withoutStem.weight)) || 0,
    ];
    
    const sum = percentages.reduce((acc, curr) => acc + curr, 0);
    return sum.toFixed(2);
  };

  // Auto-calculate percentages and total defects when weight values change
  useEffect(() => {
    if (!currentLot) return;
    
    const qc = currentLot.data.qualityChecks;
    
    const updatedQc = {
      ...qc,
      diseaseTraces: {
        ...qc.diseaseTraces,
        percentage: calculatePercentage(qc.diseaseTraces.weight)
      },
      ripeFruit: {
        ...qc.ripeFruit,
        percentage: calculatePercentage(qc.ripeFruit.weight)
      },
      dirtyFruit: {
        ...qc.dirtyFruit,
        percentage: calculatePercentage(qc.dirtyFruit.weight)
      },
      sunBurns: {
        ...qc.sunBurns,
        percentage: calculatePercentage(qc.sunBurns.weight)
      },
      withoutStem: {
        ...qc.withoutStem,
        percentage: calculatePercentage(qc.withoutStem.weight)
      }
    };
    
    const totalDefects = computeTotalDefects(updatedQc);
    
    // Update only if values have changed
    if (
      qc.diseaseTraces.percentage !== updatedQc.diseaseTraces.percentage ||
      qc.ripeFruit.percentage !== updatedQc.ripeFruit.percentage ||
      qc.dirtyFruit.percentage !== updatedQc.dirtyFruit.percentage ||
      qc.sunBurns.percentage !== updatedQc.sunBurns.percentage ||
      qc.withoutStem.percentage !== updatedQc.withoutStem.percentage ||
      currentLot.data.totalDefects !== totalDefects
    ) {
      updateCurrentLot({
        qualityChecks: updatedQc,
        totalDefects
      });
    }
  }, [
    currentLot?.data.qualityChecks.diseaseTraces.weight,
    currentLot?.data.qualityChecks.ripeFruit.weight,
    currentLot?.data.qualityChecks.dirtyFruit.weight,
    currentLot?.data.qualityChecks.sunBurns.weight,
    currentLot?.data.qualityChecks.withoutStem.weight,
    currentLot?.data.totalDefects,
  ]);

  const generatePDF = async () => {
    if (!currentLot) return;

    const jsPDFClass = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default as any;
    const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const margin = 6;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    doc.setLineHeightFactor(1.0);

    const colors = {
      lime300: [190, 242, 100] as const,
      lime200: [217, 249, 157] as const,
      border: [0, 0, 0] as const,
      text: [0, 0, 0] as const,
    };

    // Header frame like page
    const headerH = 30;
    const leftW = 32;
    const rightW = 40;
    const centerW = contentWidth - leftW - rightW;
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.3);
    // Outer
    doc.rect(margin, margin, contentWidth, headerH);
    // Separators
    doc.line(margin + leftW, margin, margin + leftW, margin + headerH);
    doc.line(margin + leftW + centerW, margin, margin + leftW + centerW, margin + headerH);
    // Center title band
    const centerX0 = margin + leftW;
    doc.setFillColor(...colors.lime300);
    const titleBandH = 10;
    doc.rect(centerX0, margin, centerW, titleBandH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text('Fiche de contrôle à la réception (avocat)', centerX0 + centerW / 2, margin + 6.5, { align: 'center' });
    doc.text('SYSTEME DE GESTION DE LA QUALITE', centerX0 + centerW / 2, margin + titleBandH + 7.5, { align: 'center' });
    // Right info rows
    const rightX0 = margin + leftW + centerW;
    const rowH = headerH / 3;
    doc.line(rightX0, margin + rowH, rightX0 + rightW, margin + rowH);
    doc.line(rightX0, margin + rowH * 2, rightX0 + rightW, margin + rowH * 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Réf : ${currentLot.data.header.ref}`, rightX0 + 2, margin + rowH - 2);
    doc.text(`Version : ${currentLot.data.header.version}`, rightX0 + 2, margin + rowH * 2 - 2);
    doc.text(`Date : ${currentLot.data.header.date}`, rightX0 + 2, margin + rowH * 3 - 2);
    // Logo
    const toDataURL = async (url: string): Promise<string> => {
      try {
        if (typeof url === 'string' && url.startsWith('data:')) return url;
      } catch (e) { }

      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onloadend = () => resolve(fr.result as string);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) return dataUrl;
      } catch (e) {
        // continue to image->canvas fallback
      }

      return await new Promise<string>((resolve) => {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.naturalHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch (inner) {
              resolve('');
            }
          };
          img.onerror = () => resolve('');
          img.src = url as unknown as string;
        } catch (err) {
          resolve('');
        }
      });
    };

    try {
      let dataUrl = await toDataURL(logoUrl as unknown as string);
      if (!dataUrl) {
        try {
          dataUrl = await toDataURL('/assets/logo.png');
        } catch (e) {
          // ignore
        }
      }
      const imgSize = 16;
      const imgX = margin + (leftW - imgSize) / 2;
      const imgY = margin + (headerH - imgSize) / 2;
      try {
        if (dataUrl) {
          doc.addImage(dataUrl, 'PNG', imgX, imgY, imgSize, imgSize);
        } else {
          throw new Error('empty data URL');
        }
      } catch (addErr) {
        console.warn('Failed to add logo to PDF (addImage):', addErr);
      }
    } catch (e) {
      console.warn('Failed to load logo for PDF header:', e);
    }

    // Table body matching page
    const rec = currentLot.data.header;
    const qc = currentLot.data.qualityChecks;
    
    autoTable(doc, {
      startY: margin + headerH + 4,
      styles: { 
        font: 'helvetica', 
        fontSize: 9, 
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }, 
        lineColor: colors.border, 
        lineWidth: 0.3, 
        textColor: colors.text 
      },
      margin: { left: margin, right: margin, bottom: 30 },
      theme: 'grid',
      tableWidth: contentWidth,
      columnStyles: {
        0: { cellWidth: contentWidth * 0.25 },
        1: { cellWidth: contentWidth * 0.15 },
        2: { cellWidth: contentWidth * 0.15 },
        3: { cellWidth: contentWidth * 0.15 },
        4: { cellWidth: contentWidth * 0.15 },
        5: { cellWidth: contentWidth * 0.15 },
      },
      body: [
        [
          { content: 'Date', styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: rec.deliveryDate || '' },
          { content: 'Gamme de produit :', styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: `${rec.productRange || ''} ${rec.bio ? '[BIO]' : (rec.conventionnel ? '[Conventionnel]' : '')}` },
          { content: rec.provider || '' },
          { content: '1 Caisse (23KG) / 12palette', styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
        ],

        [{ content: 'N° de Bon de livraison', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.deliveryBonNumber || '', colSpan: 5 }],
        [{ content: 'N° de bon de réception', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.receptionBonNumber || '', colSpan: 5 }],
        [{ content: 'Heure de réception', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.receptionTime || '', colSpan: 5 }],
        [{ content: 'Etats des caisses (C/NC)', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.boxState || '', colSpan: 5 }],
        [{ content: 'Matricule', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.matricule || '', colSpan: 5 }],
        [{ content: 'Variété', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.variety || '', colSpan: 5 }],
        [{ content: 'Producteur', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.producer || '', colSpan: 5 }],
        [{ content: 'Contrôle qualité de états Camion : Odeur ; corps étranger ; nettoyage. (C/NC)', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.truckQuality || '', colSpan: 5 }],
        [{ content: 'Nombre total de palettes', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.totalPallets || '', colSpan: 5 }],
        [{ content: 'Poids NET', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.netWeight || '', colSpan: 5 }],
        [{ content: 'N° de lot du produit', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: rec.productLotNumber || '', colSpan: 5 }],

        // Quality checks with AUTO-CALCULATED percentages
        [
          { content: 'Nbr Fruit avec trace de maladie', rowSpan: 2, styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: 'Nbr de fruits (max 10u)', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: 'Poids', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '%', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '', colSpan: 2 }
        ],
        [
          { content: qc.diseaseTraces.count || '' },
          { content: qc.diseaseTraces.weight || '' },
          { content: qc.diseaseTraces.percentage || '' },
          { content: '', colSpan: 2 }
        ],

        [
          { content: 'Nbr fruit murs', rowSpan: 2, styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: 'Nbr de fruits (max 0u)', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: 'Poids', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '%', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '', colSpan: 2 }
        ],
        [
          { content: qc.ripeFruit.count || '' },
          { content: qc.ripeFruit.weight || '' },
          { content: qc.ripeFruit.percentage || '' },
          { content: '', colSpan: 2 }
        ],

        [
          { content: 'Nbr fruit Terreux', rowSpan: 2, styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: 'Nbr de fruits (max 8u)', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: 'Poids', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '%', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '', colSpan: 2 }
        ],
        [
          { content: qc.dirtyFruit.count || '' },
          { content: qc.dirtyFruit.weight || '' },
          { content: qc.dirtyFruit.percentage || '' },
          { content: '', colSpan: 2 }
        ],

        [
          { content: 'Epiderme et brulures de soleil', rowSpan: 2, styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: 'Nbr de fruits (max 6cm²)', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: 'Poids', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '%', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '', colSpan: 2 }
        ],
        [
          { content: qc.sunBurns.count || '' },
          { content: qc.sunBurns.weight || '' },
          { content: qc.sunBurns.percentage || '' },
          { content: '', colSpan: 2 }
        ],

        [
          { content: 'Nbr fruit Sans pédoncule', rowSpan: 2, styles: { fillColor: colors.lime300, fontStyle: 'bold' } },
          { content: 'Nbr de fruits', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: 'Poids', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '%', styles: { fillColor: colors.lime200, fontStyle: 'bold', halign: 'center' } },
          { content: '', colSpan: 2 }
        ],
        [
          { content: qc.withoutStem.count || '' },
          { content: qc.withoutStem.weight || '' },
          { content: qc.withoutStem.percentage || '' },
          { content: '', colSpan: 2 }
        ],

        [{ content: 'Totalité des défauts %', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: currentLot.data.totalDefects || '', colSpan: 5 }],
        [{ content: 'Couleur C/NC', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: currentLot.data.color || '', colSpan: 5 }],
        [{ content: 'Odeur C / NC', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: currentLot.data.odor || '', colSpan: 5 }],
        [{ content: 'Décision + Action', styles: { fillColor: colors.lime300, fontStyle: 'bold' } }, { content: currentLot.data.decision || '', colSpan: 5 }],
      ],
    });

    // Notes and visa
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 1,
      styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 1, right: 1, bottom: 1, left: 1 }, lineColor: colors.border, lineWidth: 0.3 },
      margin: { left: margin, right: margin, bottom: 34 },
      theme: 'grid',
      body: [
        [{ content: "Note : en cas de présence — En cas d'un taux élevé (10%) des écarts il faut identifier le lot par une F.P et informer le R.Q" }],
      ],
    });

    // Reserve ~3cm bottom area for signature
    const pageHeight = doc.internal.pageSize.getHeight();
    const sigH = 30; // mm
    const sigY = pageHeight - sigH - margin; // keep a small bottom margin
    doc.setLineWidth(0.3);
    doc.rect(margin, sigY, contentWidth, sigH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Visa responsable de réception', margin + 2, sigY + 6);
    // Optional signature line
    doc.setLineWidth(0.3);
    doc.line(margin + 2, sigY + sigH - 10, margin + contentWidth - 2, sigY + sigH - 10);

    // Footer labels just above signature box
    const footerY = sigY - 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Formulaire: ${currentLot.data.header.ref}  |  Version: ${currentLot.data.header.version}`, margin, footerY);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, margin + contentWidth, footerY, { align: 'right' });

    const fileName = `Fiche_Controle_Reception_${currentLot.lotNumber.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
  };

  // Helper function to render a checkbox symbol
  const checkbox = (checked: boolean): string => (checked ? '☑' : '☐');

  if (!currentLot) return <div>Chargement...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Fiche de Contrôle à la Réception - Avocat
              </h1>
              <p className="text-gray-600">Créez, éditez et archivez vos contrôles de réception</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={createNewLot}
                className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-3 rounded-xl hover:bg-gray-50 transition-all hover:shadow-md"
              >
                <Plus size={20} />
                Nouveau Lot
              </button>
              <button
                onClick={saveDraftToFirebase}
                disabled={saving}
                className="flex items-center gap-2 bg-[#161f2e] text-white px-5 py-3 rounded-xl hover:bg-[#1e293b] transition-all disabled:opacity-50"
              >
                <Save size={20} />
                {saving ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto pb-2 gap-2">
            {lots.map((lot) => (
              <div key={lot.id} className="flex items-center bg-gray-100 rounded-xl overflow-hidden min-w-fit">
                <button
                  onClick={() => setCurrentLotId(lot.id)}
                  className={`px-4 py-3 flex items-center gap-3 transition-all ${
                    currentLotId === lot.id 
                      ? 'bg-[#161f2e] text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Package size={18} />
                  <span className="font-medium">{lot.lotNumber}</span>
                  <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                    lot.status === 'termine' ? 'bg-green-100 text-green-800' :
                    lot.status === 'en_cours' ? 'bg-amber-100 text-amber-800' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {lot.status}
                  </span>
                </button>
                <div className="flex">
                  <button
                    onClick={() => duplicateLot(lot.id)}
                    className="p-3 text-gray-600 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                    title="Dupliquer"
                  >
                    <Copy size={16} />
                  </button>
                  {lots.length > 1 && (
                    <button
                      onClick={() => removeLot(lot.id)}
                      className="p-3 text-gray-600 hover:text-red-600 hover:bg-gray-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form-like Printed Layout - Keeping Original Table Structure */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          {/* Form Header */}
          <div className="bg-[#161f2e] text-white p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-lg">
                  <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Fiche de contrôle à la réception (avocat)</h2>
                  <p className="text-gray-300">SYSTEME DE GESTION DE LA QUALITE</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 min-w-[180px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-300">Réf :</span>
                  <input
                    type="text"
                    value={currentLot.data.header.ref}
                    onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, ref: e.target.value } })}
                    className="bg-transparent border-b border-gray-400 text-white text-right focus:outline-none focus:border-white w-24"
                  />
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-300">Version :</span>
                  <input
                    type="text"
                    value={currentLot.data.header.version}
                    onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, version: e.target.value } })}
                    className="bg-transparent border-b border-gray-400 text-white text-right focus:outline-none focus:border-white w-24"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Date :</span>
                  <input
                    type="text"
                    value={currentLot.data.header.date}
                    onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, date: e.target.value } })}
                    className="bg-transparent border-b border-gray-400 text-white text-right focus:outline-none focus:border-white w-24"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Content - Original Table Structure with Enhanced UI */}
          <div className="p-4 md:p-6">
            <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {/* Date Row */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold text-sm w-32">Date</td>
                    <td className="p-3 border-r border-gray-200 w-24">
                      <input
                        type="date"
                        value={currentLot.data.header.deliveryDate}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, deliveryDate: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="bg-[#161f2e] text-white p-3 font-bold">
                      Gamme de
                      <br />
                      produit :
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <div className="mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentLot.data.header.conventionnel}
                            onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, conventionnel: e.target.checked } })}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <span>Conventionnel</span>
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentLot.data.header.bio}
                            onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, bio: e.target.checked } })}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <span>BIO</span>
                        </label>
                      </div>
                    </td>
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Prestataire :</td>
                    <td className="p-3 w-48">
                      <input
                        type="text"
                        value={currentLot.data.header.provider}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, provider: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="bg-[#161f2e] text-white p-3 font-bold">
                      Protocole :
                      <br />
                      1 Caisse (23KG) / 12palette
                    </td>
                  </tr>

                  {/* N° de Bon de livraison */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">N° de Bon de livraison</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.deliveryBonNumber}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, deliveryBonNumber: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* N° de bon de réception */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">N° de bon de réception</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.receptionBonNumber}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, receptionBonNumber: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* Heure de réception */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Heure de réception</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="time"
                        step={60}
                        value={currentLot.data.header.receptionTime}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, receptionTime: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* Etats des caisses */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Etats des caisses (C/NC)</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.boxState}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, boxState: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* Matricule */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Matricule</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.matricule}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, matricule: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* Variété */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Variété</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.variety}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, variety: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* Producteur */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Producteur</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.producer}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, producer: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* Contrôle qualité camion */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Contrôle qualité de états Camion : Odeur ; corps étranger ; nettoyage. (C/NC)</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.truckQuality}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, truckQuality: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* Nombre total de palettes */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Nombre total de palettes</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.totalPallets}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, totalPallets: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* Poids NET */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Poids NET</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.netWeight}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, netWeight: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* N° de lot du produit */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">N° de lot du produit</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.header.productLotNumber}
                        onChange={(e) => updateCurrentLot({ header: { ...currentLot.data.header, productLotNumber: e.target.value } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* Quality rows */}
                  {/* Fruit avec trace de maladie */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold" rowSpan={2}>
                      Nbr Fruit avec trace de maladie
                    </td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">
                      Nbr de fruits<br />(max 10u)
                    </td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">
                      Poids
                    </td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">
                      %
                    </td>
                    <td className="border border-gray-200 p-2" colSpan={3}></td>
                  </tr>
                  <tr>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.diseaseTraces.count}
                        onChange={(e) =>
                          updateCurrentLot({
                            qualityChecks: {
                              ...currentLot.data.qualityChecks,
                              diseaseTraces: {
                                ...currentLot.data.qualityChecks.diseaseTraces,
                                count: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.diseaseTraces.weight}
                        onChange={(e) => {
                          const weight = e.target.value;
                          const newQC = {
                            ...currentLot.data.qualityChecks,
                            diseaseTraces: {
                              ...currentLot.data.qualityChecks.diseaseTraces,
                              weight,
                            },
                          };
                          updateCurrentLot({ qualityChecks: newQC });
                        }}
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.diseaseTraces.percentage}
                        readOnly
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-gray-100 text-gray-700"
                      />
                    </td>
                    <td className="p-3" colSpan={3}></td>
                  </tr>

                  {/* Nbr fruit murs */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold" rowSpan={2}>
                      Nbr fruit murs
                    </td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">
                      Nbr de fruits<br />(max 0u)
                    </td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">
                      Poids
                    </td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">
                      %
                    </td>
                    <td className="border border-gray-200 p-2" colSpan={3}></td>
                  </tr>
                  <tr>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.ripeFruit.count}
                        onChange={(e) =>
                          updateCurrentLot({
                            qualityChecks: {
                              ...currentLot.data.qualityChecks,
                              ripeFruit: {
                                ...currentLot.data.qualityChecks.ripeFruit,
                                count: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.ripeFruit.weight}
                        onChange={(e) => {
                          const weight = e.target.value;
                          const newQC = {
                            ...currentLot.data.qualityChecks,
                            ripeFruit: {
                              ...currentLot.data.qualityChecks.ripeFruit,
                              weight,
                            },
                          };
                          updateCurrentLot({ qualityChecks: newQC });
                        }}
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.ripeFruit.percentage}
                        readOnly
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-gray-100 text-gray-700"
                      />
                    </td>
                    <td className="p-3" colSpan={3}></td>
                  </tr>

                  {/* Nbr fruit Terreux */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold" rowSpan={2}>
                      Nbr fruit Terreux
                    </td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">
                      Nbr de fruits<br />(max 8u)
                    </td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">
                      Poids
                    </td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">
                      %
                    </td>
                    <td className="border border-gray-200 p-2" colSpan={3}></td>
                  </tr>
                  <tr>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.dirtyFruit.count}
                        onChange={(e) =>
                          updateCurrentLot({
                            qualityChecks: {
                              ...currentLot.data.qualityChecks,
                              dirtyFruit: {
                                ...currentLot.data.qualityChecks.dirtyFruit,
                                count: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.dirtyFruit.weight}
                        onChange={(e) => {
                          const weight = e.target.value;
                          const newQC = {
                            ...currentLot.data.qualityChecks,
                            dirtyFruit: {
                              ...currentLot.data.qualityChecks.dirtyFruit,
                              weight,
                            },
                          };
                          updateCurrentLot({ qualityChecks: newQC });
                        }}
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.dirtyFruit.percentage}
                        readOnly
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-gray-100 text-gray-700"
                      />
                    </td>
                    <td className="p-3" colSpan={3}></td>
                  </tr>

                  {/* Epiderme et brulures de soleil */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold" rowSpan={2}>Epiderme et brulures de soleil</td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">Nbr de fruits<br />(max 6cm²)</td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">Poids</td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">%</td>
                    <td className="border border-gray-200 p-2" colSpan={3}></td>
                  </tr>
                  <tr>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.sunBurns.count}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, sunBurns: { ...currentLot.data.qualityChecks.sunBurns, count: e.target.value } } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.sunBurns.weight}
                        onChange={(e) => {
                          const weight = e.target.value;
                          const newQC = {
                            ...currentLot.data.qualityChecks,
                            sunBurns: {
                              ...currentLot.data.qualityChecks.sunBurns,
                              weight,
                            },
                          };
                          updateCurrentLot({ qualityChecks: newQC });
                        }}
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.sunBurns.percentage}
                        readOnly
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-gray-100 text-gray-700"
                      />
                    </td>
                    <td className="p-3" colSpan={3}></td>
                  </tr>

                  {/* Nbr fruit Sans pédoncule */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold" rowSpan={2}>Nbr fruit
                      <br />
                      Sans pédoncule
                    </td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">Nbr de fruits</td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">Poids</td>
                    <td className="bg-gray-100 border border-gray-200 p-2 font-bold text-center">%</td>
                    <td className="border border-gray-200 p-2" colSpan={3}></td>
                  </tr>
                  <tr>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.withoutStem.count}
                        onChange={(e) => updateCurrentLot({ qualityChecks: { ...currentLot.data.qualityChecks, withoutStem: { ...currentLot.data.qualityChecks.withoutStem, count: e.target.value } } })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.withoutStem.weight}
                        onChange={(e) => {
                          const weight = e.target.value;
                          const newQC = {
                            ...currentLot.data.qualityChecks,
                            withoutStem: {
                              ...currentLot.data.qualityChecks.withoutStem,
                              weight,
                            },
                          };
                          updateCurrentLot({ qualityChecks: newQC });
                        }}
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={currentLot.data.qualityChecks.withoutStem.percentage}
                        readOnly
                        className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-gray-100 text-gray-700"
                      />
                    </td>
                    <td className="p-3" colSpan={3}></td>
                  </tr>

                  {/* Totalité des défauts % */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Totalité des défauts %</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.totalDefects}
                        readOnly
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-700 font-medium"
                      />
                    </td>
                  </tr>

                  {/* Couleur C/NC */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Couleur C/NC</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.color}
                        onChange={(e) => updateCurrentLot({ color: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* Odeur C / NC */}
                  <tr className="border-b border-gray-200">
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Odeur C / NC</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.odor}
                        onChange={(e) => updateCurrentLot({ odor: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>

                  {/* Décision + Action */}
                  <tr>
                    <td className="bg-[#161f2e] text-white p-3 font-bold">Décision + Action</td>
                    <td className="p-3" colSpan={6}>
                      <input
                        type="text"
                        value={currentLot.data.decision}
                        onChange={(e) => updateCurrentLot({ decision: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Footer notes */}
              <div className="p-4 text-sm border-t border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-700">Note : en cas de présence :</p>
                <p className="text-gray-600">• En cas d'un taux élevé (10%) des écarts il faut identifier le lot par une F.P et informer le R.Q</p>
              </div>

              <div className="text-center p-6 border-t border-gray-200 bg-gray-50">
                <p className="font-bold text-lg text-gray-900 mb-4">Visa responsable de réception</p>
                <div className="flex justify-center">
                  <input
                    type="text"
                    value={currentLot.data.responsibleSignature}
                    onChange={(e) => updateCurrentLot({ responsibleSignature: e.target.value })}
                    className="w-96 text-sm border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nom et signature"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-wrap gap-3 md:gap-4 justify-center">
              <button
                onClick={generatePDF}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-all hover:shadow-lg"
              >
                <FilePlus size={20} />
                Générer PDF
              </button>
              <button
                onClick={resetForm}
                className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-xl hover:bg-gray-700 transition-all hover:shadow-lg"
              >
                <RefreshCw size={20} />
                Réinitialiser
              </button>
              <button
                onClick={saveToArchive}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all hover:shadow-lg"
              >
                <Save size={20} />
                Archiver
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Archives Section - Collapsible */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <button
            onClick={() => setShowArchives(!showArchives)}
            className="w-full p-6 flex items-center justify-between bg-[#161f2e] text-white hover:bg-[#1e293b] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Archive size={24} />
              <div className="text-left">
                <h2 className="text-xl font-bold">Archives - Bon de Réception</h2>
                <p className="text-gray-300 text-sm">Les fiches archivées sont des copies figées de vos contrôles</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                {filteredArchives.length} archive{filteredArchives.length !== 1 ? 's' : ''}
              </span>
              {showArchives ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
            </div>
          </button>

          {showArchives && (
            <div className="p-6">
              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative max-w-md mx-auto">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Rechercher par N° bon réception, prestataire..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              </div>

              {loadingArchives ? (
                <div className="text-center py-12">
                  <RefreshCw className="animate-spin mx-auto mb-4" size={32} />
                  <p className="text-gray-600">Chargement des archives...</p>
                </div>
              ) : filteredArchives.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-2xl">
                  <Archive className="mx-auto mb-4 text-gray-400" size={48} />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    {searchTerm ? 'Aucune archive trouvée' : 'Aucune archive pour le moment'}
                  </h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    {searchTerm ? 'Aucun résultat pour votre recherche.' : 'Les fiches que vous archivez apparaîtront ici.'}
                  </p>
                  {!searchTerm && (
                    <button
                      onClick={saveToArchive}
                      className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      <Save size={18} />
                      Archiver la fiche actuelle
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredArchives.map((archive) => (
                    <div key={archive.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:border-blue-300 group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-lg text-gray-900 mb-2 group-hover:text-blue-600 transition-colors truncate">
                            {archive.data.header.receptionBonNumber || 'Sans N°'}
                          </div>
                          <div className="text-gray-600 text-sm mb-3 truncate">
                            {archive.lotNumber}
                          </div>
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            archive.status === 'termine' ? 'bg-green-100 text-green-800' :
                            archive.status === 'en_cours' ? 'bg-amber-100 text-amber-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {archive.status}
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1 ml-2">
                          <div>Créé le</div>
                          <div>{archive.createdAt.toLocaleDateString('fr-FR')}</div>
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Prestataire:</span>
                          <span className="font-medium text-gray-900 truncate ml-2 text-right max-w-[150px]">
                            {archive.data.header.provider || 'Non renseigné'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Variété:</span>
                          <span className="font-medium text-gray-900">{archive.data.header.variety || 'Non renseigné'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Date réception:</span>
                          <span className="font-medium text-gray-900">{archive.data.header.deliveryDate || 'Non renseigné'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Poids NET:</span>
                          <span className="font-medium text-gray-900">{archive.data.header.netWeight || 'Non renseigné'}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => loadFromArchive(archive)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Eye size={16} />
                          Charger
                        </button>
                        <button
                          onClick={() => deleteArchive(archive.id)}
                          className="flex items-center justify-center px-3 py-2.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="text-xs text-gray-400 mt-4 pt-2 border-t border-gray-100">
                        Modifié: {archive.updatedAt.toLocaleDateString('fr-FR')} à {archive.updatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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
  );
};

export default ControleReception;