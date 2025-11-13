import React, { useEffect, useMemo, useState } from 'react';
import { FilePlus, Package, Plus, RefreshCw, Save, Trash2, Copy } from 'lucide-react';
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';

// Initialize Firestore
const firestore = getFirestore(getApp());

// Fruit defect tracking interface
interface FruitDefects {
  maladieNbr: string;      // Nbr Fruit avec trace de maladie
  maladiePoids: string;
  maladiePercent: string;  // Auto-calculated
  
  mursNbr: string;         // Nbr fruit murs
  mursPoids: string;
  mursPercent: string;     // Auto-calculated
  
  terreuxNbr: string;      // Nbr fruit Terreux
  terreuxPoids: string;
  terreuxPercent: string;  // Auto-calculated
  
  bruluresNbr: string;     // Epiderme et brulures de soleil
  bruluresPoids: string;
  bruluresPercent: string; // Auto-calculated
  
  sansPedonculeNbr: string; // Nbr fruit Sans pédoncule
  sansPedonculePoids: string;
  sansPedonculePercent: string; // Auto-calculated
  
  totalDefautsPercent: string; // Auto-calculated total
}

// Data model matching the new image format
interface ReceptionRow {
  date: string;
  matricule: string;
  chauffeur: string;
  poidsNetUsine: string;
  dechet: string;
  feurte: string;
  poidsNetTicket: string;
  ecart: string;
  leLieu: string;
  variete: string;
  numeroLotInterne: string;
  defects?: FruitDefects; // Optional defects tracking
}

interface ReceptionFormData {
  header: {
    title: string;
    category?: 'convo' | 'bio';
    smq?: string;
    dateReport?: string;
    version?: string;
    chau?: string;
    matricule?: string;
    responsable?: string;
    bonLivraison?: string;
    produit?: string;
    bonReception?: string;
    conventionnel?: boolean;
    biologique?: boolean;
    compagne: string;
  };
  rows: ReceptionRow[];
}

const defaultDefects = (): FruitDefects => ({
  maladieNbr: '',
  maladiePoids: '',
  maladiePercent: '0',
  
  mursNbr: '',
  mursPoids: '',
  mursPercent: '0',
  
  terreuxNbr: '',
  terreuxPoids: '',
  terreuxPercent: '0',
  
  bruluresNbr: '',
  bruluresPoids: '',
  bruluresPercent: '0',
  
  sansPedonculeNbr: '',
  sansPedonculePoids: '',
  sansPedonculePercent: '0',
  
  totalDefautsPercent: '0'
});

const defaultReceptionForm = (): ReceptionFormData => ({
  header: {
    title: 'Reception Avocat Hass 2024/2025',
    category: 'convo',
    smq: 'SMQ,ENR24',
    dateReport: new Date().toISOString().split('T')[0],
    version: '01',
    chau: 'CHAU',
    matricule: 'MATRICULE',
    responsable: '',
    bonLivraison: '',
    produit: 'AVOCAT',
    bonReception: '',
    conventionnel: true,
    biologique: false,
    compagne: '2024/2025'
  },
  rows: Array.from({ length: 1 }, () => ({
    date: new Date().toISOString().split('T')[0],
    numeroLotInterne: '',
    matricule: '',
    chauffeur: '',
    poidsNetUsine: '',
    dechet: '',
    feurte: '',
    poidsNetTicket: '',
    ecart: '',
    leLieu: '',
    variete: '',
    defects: defaultDefects()
  }))
});

const SuiviReception: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<'convo' | 'bio'>('convo');
  const [form, setForm] = useState<ReceptionFormData>(defaultReceptionForm());
  const [showDefectsPanel, setShowDefectsPanel] = useState(false);

  const updateForm = (updates: Partial<ReceptionFormData>) => {
    setForm(prev => ({
      header: { ...prev.header, ...(updates.header || {}) },
      rows: updates.rows || prev.rows
    }));
  };

  const blankRow = (): ReceptionRow => ({
    date: '',
    numeroLotInterne: '',
    matricule: '',
    chauffeur: '',
    poidsNetUsine: '',
    dechet: '',
    feurte: '',
    poidsNetTicket: '',
    ecart: '',
    leLieu: '',
    variete: '',
    defects: defaultDefects()
  });

  // Calculate defect percentages
  const calculateDefectPercent = (poids: string, totalPoids: string): string => {
    const p = parseFloat(poids) || 0;
    const total = parseFloat(totalPoids) || 0;
    if (total === 0) return '0.00';
    return ((p / total) * 100).toFixed(2);
  };

  const updateDefects = (index: number, updates: Partial<FruitDefects>) => {
    const rows = [...form.rows];
    if (!rows[index].defects) {
      rows[index].defects = defaultDefects();
    }
    
    rows[index].defects = { ...rows[index].defects!, ...updates };
    
    // Auto-calculate percentages
    const totalPoids = parseFloat(rows[index].poidsNetUsine) || 0;
    const defects = rows[index].defects!;
    
    defects.maladiePercent = calculateDefectPercent(defects.maladiePoids, String(totalPoids));
    defects.mursPercent = calculateDefectPercent(defects.mursPoids, String(totalPoids));
    defects.terreuxPercent = calculateDefectPercent(defects.terreuxPoids, String(totalPoids));
    defects.bruluresPercent = calculateDefectPercent(defects.bruluresPoids, String(totalPoids));
    defects.sansPedonculePercent = calculateDefectPercent(defects.sansPedonculePoids, String(totalPoids));
    
    // Calculate total defects percentage
    const totalDefects = (
      parseFloat(defects.maladiePoids) || 0) +
      (parseFloat(defects.mursPoids) || 0) +
      (parseFloat(defects.terreuxPoids) || 0) +
      (parseFloat(defects.bruluresPoids) || 0) +
      (parseFloat(defects.sansPedonculePoids) || 0
    );
    
    defects.totalDefautsPercent = calculateDefectPercent(String(totalDefects), String(totalPoids));
    
    updateForm({ rows });
  };

  const updateRow = (index: number, updates: Partial<ReceptionRow>) => {
    const rows = [...form.rows];
    
    if (!rows[index]) {
      rows[index] = blankRow();
    }

    rows[index] = { 
      ...rows[index], 
      ...updates
    };

    // Calculate ecart: poids net usine + feurte - poids net ticket
    const pnUsine = parseFloat(rows[index].poidsNetUsine) || 0;
    const feurte = parseFloat(rows[index].feurte) || 0;
    const pnTicket = parseFloat(rows[index].poidsNetTicket) || 0;
    rows[index].ecart = String(pnUsine + feurte - pnTicket);

    // Recalculate defect percentages if poids net usine changed
    if (updates.poidsNetUsine !== undefined && rows[index].defects) {
      const defects = rows[index].defects!;
      const totalPoids = pnUsine;
      
      defects.maladiePercent = calculateDefectPercent(defects.maladiePoids, String(totalPoids));
      defects.mursPercent = calculateDefectPercent(defects.mursPoids, String(totalPoids));
      defects.terreuxPercent = calculateDefectPercent(defects.terreuxPoids, String(totalPoids));
      defects.bruluresPercent = calculateDefectPercent(defects.bruluresPoids, String(totalPoids));
      defects.sansPedonculePercent = calculateDefectPercent(defects.sansPedonculePoids, String(totalPoids));
      
      const totalDefects = (
        (parseFloat(defects.maladiePoids) || 0) +
        (parseFloat(defects.mursPoids) || 0) +
        (parseFloat(defects.terreuxPoids) || 0) +
        (parseFloat(defects.bruluresPoids) || 0) +
        (parseFloat(defects.sansPedonculePoids) || 0)
      );
      
      defects.totalDefautsPercent = calculateDefectPercent(String(totalDefects), String(totalPoids));
    }

    updateForm({ rows });
  };

  const addRow = () => {
    updateForm({ rows: [...form.rows, blankRow()] });
  };

  const removeLastRow = () => {
    if (form.rows.length <= 1) {
      alert('Il doit rester au moins une ligne');
      return;
    }
    if (!confirm('Supprimer la dernière ligne ?')) return;
    updateForm({ rows: form.rows.slice(0, -1) });
  };

  const calculateTotals = () => {
    const totalPoidsNetUsine = form.rows.reduce((sum, r) => sum + (parseFloat(r.poidsNetUsine) || 0), 0);
    const totalDechet = form.rows.reduce((sum, r) => sum + (parseFloat(r.dechet) || 0), 0);
    const totalFeurte = form.rows.reduce((sum, r) => sum + (parseFloat(r.feurte) || 0), 0);
    const totalPoidsNetTicket = form.rows.reduce((sum, r) => sum + (parseFloat(r.poidsNetTicket) || 0), 0);
    const totalEcart = totalPoidsNetUsine + totalFeurte - totalPoidsNetTicket;

    return { totalPoidsNetUsine, totalDechet, totalFeurte, totalPoidsNetTicket, totalEcart };
  };

  const computeEcartRow = (r: ReceptionRow) => {
    const pnUsine = parseFloat(r.poidsNetUsine) || 0;
    const feurte = parseFloat(r.feurte) || 0;
    const pnTicket = parseFloat(r.poidsNetTicket) || 0;
    return pnUsine + feurte - pnTicket;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-FR');
    } catch {
      return dateStr;
    }
  };

  const generatePDF = async () => {
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF('landscape', 'mm', 'a4');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = margin;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(form.header.title || 'Reception Avocat Hass', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    // Show ONLY selected category
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const selectedMode = form.header.conventionnel ? 'Conventionnel' : 'Biologique';
    doc.text(`Mode de production: ${selectedMode}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Header info
    doc.setFontSize(9);
    doc.text(`SMQ: ${form.header.smq || ''}`, margin, yPos);
    doc.text(`Date: ${formatDate(form.header.dateReport || '')}`, pageWidth - margin - 40, yPos);
    yPos += 6;
    doc.text(`Responsable: ${form.header.responsable || ''}`, margin, yPos);
    doc.text(`Bon Livraison: ${form.header.bonLivraison || ''}`, pageWidth / 2, yPos);
    yPos += 10;

    // Table
    const totals = calculateTotals();
    const tableData = form.rows.map(r => [
      formatDate(r.date),
      r.numeroLotInterne,
      r.matricule,
      r.chauffeur,
      r.poidsNetUsine,
      r.dechet,
      r.feurte,
      r.poidsNetTicket,
      computeEcartRow(r).toFixed(2),
      r.leLieu,
      r.variete
    ]);

    tableData.push([
      'TOTAL',
      '',
      '',
      '',
      totals.totalPoidsNetUsine.toFixed(0),
      totals.totalDechet.toFixed(0),
      totals.totalFeurte.toFixed(0),
      totals.totalPoidsNetTicket.toFixed(0),
      totals.totalEcart.toFixed(2),
      '',
      ''
    ]);

    const autoTable = (await import('jspdf-autotable')).default;
    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'N° Lot', 'Matricule', 'Chauffeur', 'PN Usine', 'Déchet', 'Fuerte', 'PN Ticket', 'Écart', 'Lieu', 'Variété']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 34], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 18 },
        2: { cellWidth: 22 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 18 },
        6: { cellWidth: 18 },
        7: { cellWidth: 20 },
        8: { cellWidth: 18 },
        9: { cellWidth: 25 },
        10: { cellWidth: 20 }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Defects section
    if (showDefectsPanel) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Défauts des Fruits', margin, yPos);
      yPos += 8;

      form.rows.forEach((row, idx) => {
        if (row.defects && parseFloat(row.poidsNetUsine) > 0) {
          const d = row.defects;
          const defectData = [
            ['Trace de maladie', d.maladieNbr, d.maladiePoids, `${d.maladiePercent}%`],
            ['Fruits mûrs', d.mursNbr, d.mursPoids, `${d.mursPercent}%`],
            ['Fruits terreux', d.terreuxNbr, d.terreuxPoids, `${d.terreuxPercent}%`],
            ['Brûlures soleil', d.bruluresNbr, d.bruluresPoids, `${d.bruluresPercent}%`],
            ['Sans pédoncule', d.sansPedonculeNbr, d.sansPedonculePoids, `${d.sansPedonculePercent}%`],
            ['TOTAL DÉFAUTS', '', '', `${d.totalDefautsPercent}%`]
          ];

          doc.setFontSize(9);
          doc.text(`Lot ${idx + 1} - ${formatDate(row.date)}`, margin, yPos);
          yPos += 5;

          autoTable(doc, {
            startY: yPos,
            head: [['Type de défaut', 'Nombre', 'Poids (kg)', 'Pourcentage']],
            body: defectData,
            theme: 'striped',
            headStyles: { fillColor: [220, 53, 69], fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: {
              0: { cellWidth: 60 },
              1: { cellWidth: 30 },
              2: { cellWidth: 30 },
              3: { cellWidth: 35, fontStyle: 'bold', textColor: [220, 53, 69] }
            }
          });

          yPos = (doc as any).lastAutoTable.finalY + 8;
        }
      });
    }

    doc.save(`Reception_${formatDate(form.header.dateReport || '')}.pdf`);
  };

  const archiveForm = async (formData: ReceptionFormData) => {
    try {
      await addDoc(collection(firestore, 'receptions'), {
        ...formData,
        createdAt: new Date().toISOString()
      });
      alert('Formulaire archivé avec succès');
    } catch (e) {
      console.error('Error:', e);
      alert('Erreur lors de l\'archivage');
    }
  };

  const fetchSavedData = async (documentId: string) => {
    try {
      const docRef = doc(firestore, 'receptions', documentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setForm(docSnap.data() as ReceptionFormData);
        alert('Données chargées');
      } else {
        alert('Document non trouvé');
      }
    } catch (e) {
      console.error('Error:', e);
      alert('Erreur lors du chargement');
    }
  };

  const updateSavedData = async (documentId: string, formData: ReceptionFormData) => {
    try {
      const docRef = doc(firestore, 'receptions', documentId);
      await updateDoc(docRef, { ...formData, updatedAt: new Date().toISOString() });
      alert('Données mises à jour');
    } catch (e) {
      console.error('Error:', e);
      alert('Erreur lors de la mise à jour');
    }
  };

  const deleteSavedData = async (documentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;
    try {
      await deleteDoc(doc(firestore, 'receptions', documentId));
      alert('Document supprimé');
    } catch (e) {
      console.error('Error:', e);
      alert('Erreur lors de la suppression');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 py-8 px-4">
      <div className="max-w-[1400px] mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6 border-t-4 border-green-600">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-6">
            {form.header.title}
          </h1>

          {/* Category Selection - Radio buttons */}
          <div className="mb-6 flex justify-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={form.header.conventionnel}
                onChange={() => updateForm({ 
                  header: { ...form.header, conventionnel: true, biologique: false } 
                })}
                className="w-5 h-5"
              />
              <span className="text-lg font-semibold text-gray-700">Conventionnel</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={form.header.biologique}
                onChange={() => updateForm({ 
                  header: { ...form.header, conventionnel: false, biologique: true } 
                })}
                className="w-5 h-5"
              />
              <span className="text-lg font-semibold text-gray-700">Biologique (BIO)</span>
            </label>
          </div>

          {/* Header fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">SMQ</label>
              <input
                type="text"
                value={form.header.smq}
                onChange={(e) => updateForm({ header: { ...form.header, smq: e.target.value } })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Date Rapport</label>
              <input
                type="date"
                value={form.header.dateReport}
                onChange={(e) => updateForm({ header: { ...form.header, dateReport: e.target.value } })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Version</label>
              <input
                type="text"
                value={form.header.version}
                onChange={(e) => updateForm({ header: { ...form.header, version: e.target.value } })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Responsable</label>
              <input
                type="text"
                value={form.header.responsable}
                onChange={(e) => updateForm({ header: { ...form.header, responsable: e.target.value } })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Bon Livraison</label>
              <input
                type="text"
                value={form.header.bonLivraison}
                onChange={(e) => updateForm({ header: { ...form.header, bonLivraison: e.target.value } })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Produit</label>
              <input
                type="text"
                value={form.header.produit}
                onChange={(e) => updateForm({ header: { ...form.header, produit: e.target.value } })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-gray-200 mb-6">
          <div className="overflow-x-auto">
            {/* Table Header */}
            <div className="flex bg-gradient-to-r from-green-600 to-green-700 text-white font-bold text-xs min-w-[1200px]">
              <div className="w-24 p-3 text-center border-r border-white/30">Date</div>
              <div className="w-28 p-3 text-center border-r border-white/30">N° Lot Interne</div>
              <div className="w-24 p-3 text-center border-r border-white/30">Matricule</div>
              <div className="w-32 p-3 text-center border-r border-white/30">Chauffeur</div>
              <div className="w-28 p-3 text-center border-r border-white/30">Poids Net Usine</div>
              <div className="w-24 p-3 text-center border-r border-white/30 bg-amber-600">Déchet</div>
              <div className="w-24 p-3 text-center border-r border-white/30 bg-amber-600">Fuerte</div>
              <div className="w-28 p-3 text-center border-r border-white/30">Poids Net Ticket</div>
              <div className="w-24 p-3 text-center border-r border-white/30">Écart</div>
              <div className="w-32 p-3 text-center border-r border-white/30">Lieu</div>
              <div className="w-28 p-3 text-center">Variété</div>
            </div>

            {/* Table Rows */}
            {form.rows.map((row, index) => (
              <div key={index} className="flex border-b border-gray-200 hover:bg-green-50 transition-colors min-w-[1200px]">
                <div className="w-24 border-r border-gray-200">
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(index, { date: e.target.value })}
                    className="w-full p-2 border-0 bg-transparent text-xs text-center focus:outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 transition-all"
                  />
                </div>
                <div className="w-28 border-r border-gray-200">
                  <input
                    type="text"
                    value={row.numeroLotInterne}
                    onChange={(e) => updateRow(index, { numeroLotInterne: e.target.value })}
                    className="w-full p-2 border-0 bg-transparent text-xs text-center focus:outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 transition-all"
                  />
                </div>

                <div className="w-24 border-r border-gray-200">
                  <input
                    type="text"
                    value={row.matricule}
                    onChange={(e) => updateRow(index, { matricule: e.target.value })}
                    className="w-full p-2 border-0 bg-transparent text-xs text-center focus:outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 transition-all"
                  />
                </div>
                <div className="w-32 border-r border-gray-200">
                  <input
                    type="text"
                    value={row.chauffeur}
                    onChange={(e) => updateRow(index, { chauffeur: e.target.value })}
                    className="w-full p-2 border-0 bg-transparent text-xs text-center focus:outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 transition-all"
                  />
                </div>
                <div className="w-28 border-r border-gray-200">
                  <input
                    type="number"
                    value={row.poidsNetUsine}
                    onChange={(e) => updateRow(index, { poidsNetUsine: e.target.value })}
                    className="w-full p-2 border-0 bg-transparent text-xs text-center focus:outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 transition-all"
                    step="0.01"
                  />
                </div>
                <div className="w-24 border-r border-gray-200 bg-amber-50">
                  <input
                    type="number"
                    value={row.dechet}
                    onChange={(e) => updateRow(index, { dechet: e.target.value })}
                    className="w-full p-2 border-0 bg-transparent text-xs text-center focus:outline-none focus:bg-amber-100 focus:ring-2 focus:ring-amber-400 transition-all font-medium"
                    step="0.01"
                  />
                </div>
                <div className="w-24 border-r border-gray-200 bg-amber-50">
                  <input
                    type="number"
                    value={row.feurte}
                    onChange={(e) => updateRow(index, { feurte: e.target.value })}
                    className="w-full p-2 border-0 bg-transparent text-xs text-center focus:outline-none focus:bg-amber-100 focus:ring-2 focus:ring-amber-400 transition-all font-medium"
                    step="0.01"
                  />
                </div>
                <div className="w-28 border-r border-gray-200">
                  <input
                    type="number"
                    value={row.poidsNetTicket}
                    onChange={(e) => updateRow(index, { poidsNetTicket: e.target.value })}
                    className="w-full p-2 border-0 bg-transparent text-xs text-center focus:outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 transition-all"
                    step="0.01"
                  />
                </div>
                <div className="w-24 border-r border-gray-200 bg-gradient-to-br from-green-50 to-blue-50">
                  <div className={`w-full p-2 text-xs text-center font-bold ${computeEcartRow(row) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {computeEcartRow(row).toFixed(2)}
                  </div>
                </div>
                <div className="w-32 border-r border-gray-200">
                  <input
                    type="text"
                    value={row.leLieu}
                    onChange={(e) => updateRow(index, { leLieu: e.target.value })}
                    className="w-full p-2 border-0 bg-transparent text-xs text-center focus:outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 transition-all"
                  />
                </div>
                <div className="w-28">
                  <input
                    type="text"
                    value={row.variete}
                    onChange={(e) => updateRow(index, { variete: e.target.value })}
                    className="w-full p-2 border-0 bg-transparent text-xs text-center focus:outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 transition-all"
                  />
                </div>
              </div>
            ))}

            {/* TOTAL row */}
            <div className="flex bg-gradient-to-r from-green-600 to-green-700 items-center min-w-[1200px] border-t-2 border-green-800">
              <div className="w-24 p-3 text-center font-bold text-sm border-r border-white/30 text-white">TOTAL</div>
              <div className="w-28 border-r border-white/30"></div>
              <div className="w-24 border-r border-white/30"></div>
              <div className="w-32 border-r border-white/30"></div>
              <div className="w-28 p-3 text-center border-r border-white/30">
                <div className="font-bold text-base text-white">{calculateTotals().totalPoidsNetUsine.toFixed(0)}</div>
              </div>
              <div className="w-24 p-3 text-center border-r border-white/30 bg-amber-400">
                <div className="font-bold text-base text-white">{calculateTotals().totalDechet.toFixed(0)}</div>
              </div>
              <div className="w-24 p-3 text-center border-r border-white/30 bg-amber-400">
                <div className="font-bold text-base text-white">{calculateTotals().totalFeurte.toFixed(0)}</div>
              </div>
              <div className="w-28 p-3 text-center border-r border-white/30">
                <div className="font-bold text-base text-white">{calculateTotals().totalPoidsNetTicket.toFixed(0)}</div>
              </div>
              <div className="w-24 p-3 text-center border-r border-white/30">
                <div className={`font-bold text-base ${calculateTotals().totalEcart >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                 {calculateTotals().totalEcart.toFixed(2)}
                </div>
              </div>
              <div className="w-32 border-r border-white/30"></div>
              <div className="w-28"></div>
            </div>
          </div>

          {/* Defects Panel Toggle */}
          <div className="p-4 bg-gray-50 border-t-2 border-gray-200">
            <button 
              onClick={() => setShowDefectsPanel(!showDefectsPanel)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg"
            >
              {showDefectsPanel ? '▼ Masquer' : '▶ Afficher'} Suivi des Défauts
            </button>
          </div>

          {/* Defects Tracking Table */}
          {showDefectsPanel && (
            <div className="p-6 bg-gradient-to-br from-red-50 to-orange-50 border-t-2 border-red-200">
              <h3 className="text-xl font-bold text-red-700 mb-4">📊 Suivi des Défauts des Fruits</h3>
              
              {form.rows.map((row, index) => (
                <div key={index} className="mb-6 bg-white rounded-lg shadow-lg p-4 border-2 border-red-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-lg font-semibold text-gray-800">
                      Lot {index + 1} - {formatDate(row.date)} - Poids Net: {row.poidsNetUsine || '0'} kg
                    </h4>
                    <div className="text-2xl font-bold text-red-600">
                      Total Défauts: {row.defects?.totalDefautsPercent || '0'}%
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-4">
                    {/* Maladie */}
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <div className="text-sm font-semibold text-gray-700 mb-2">Trace de maladie</div>
                      <div className="text-xs text-gray-600 mb-1">Max: 10 fruits</div>
                      <input
                        type="number"
                        placeholder="Nbr"
                        value={row.defects?.maladieNbr || ''}
                        onChange={(e) => updateDefects(index, { maladieNbr: e.target.value })}
                        className="w-full p-2 border rounded mb-2 text-sm"
                        max="10"
                      />
                      <input
                        type="number"
                        placeholder="Poids (kg)"
                        value={row.defects?.maladiePoids || ''}
                        onChange={(e) => updateDefects(index, { maladiePoids: e.target.value })}
                        className="w-full p-2 border rounded mb-2 text-sm"
                        step="0.01"
                      />
                      <div className="text-center font-bold text-red-600 text-lg">
                        {row.defects?.maladiePercent || '0'}%
                      </div>
                    </div>

                    {/* Murs */}
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <div className="text-sm font-semibold text-gray-700 mb-2">Fruits mûrs</div>
                      <div className="text-xs text-gray-600 mb-1">Max: 10 fruits</div>
                      <input
                        type="number"
                        placeholder="Nbr"
                        value={row.defects?.mursNbr || ''}
                        onChange={(e) => updateDefects(index, { mursNbr: e.target.value })}
                        className="w-full p-2 border rounded mb-2 text-sm"
                        max="10"
                      />
                      <input
                        type="number"
                        placeholder="Poids (kg)"
                        value={row.defects?.mursPoids || ''}
                        onChange={(e) => updateDefects(index, { mursPoids: e.target.value })}
                        className="w-full p-2 border rounded mb-2 text-sm"
                        step="0.01"
                      />
                      <div className="text-center font-bold text-yellow-600 text-lg">
                        {row.defects?.mursPercent || '0'}%
                      </div>
                    </div>

                    {/* Terreux */}
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <div className="text-sm font-semibold text-gray-700 mb-2">Fruits terreux</div>
                      <div className="text-xs text-gray-600 mb-1">Max: 8 fruits</div>
                      <input
                        type="number"
                        placeholder="Nbr"
                        value={row.defects?.terreuxNbr || ''}
                        onChange={(e) => updateDefects(index, { terreuxNbr: e.target.value })}
                        className="w-full p-2 border rounded mb-2 text-sm"
                        max="8"
                      />
                      <input
                        type="number"
                        placeholder="Poids (kg)"
                        value={row.defects?.terreuxPoids || ''}
                        onChange={(e) => updateDefects(index, { terreuxPoids: e.target.value })}
                        className="w-full p-2 border rounded mb-2 text-sm"
                        step="0.01"
                      />
                      <div className="text-center font-bold text-amber-600 text-lg">
                        {row.defects?.terreuxPercent || '0'}%
                      </div>
                    </div>

                    {/* Brûlures */}
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <div className="text-sm font-semibold text-gray-700 mb-2">Brûlures soleil</div>
                      <div className="text-xs text-gray-600 mb-1">Max: 6 cm²</div>
                      <input
                        type="number"
                        placeholder="Nbr"
                        value={row.defects?.bruluresNbr || ''}
                        onChange={(e) => updateDefects(index, { bruluresNbr: e.target.value })}
                        className="w-full p-2 border rounded mb-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Poids (kg)"
                        value={row.defects?.bruluresPoids || ''}
                        onChange={(e) => updateDefects(index, { bruluresPoids: e.target.value })}
                        className="w-full p-2 border rounded mb-2 text-sm"
                        step="0.01"
                      />
                      <div className="text-center font-bold text-orange-600 text-lg">
                        {row.defects?.bruluresPercent || '0'}%
                      </div>
                    </div>

                    {/* Sans Pédoncule */}
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <div className="text-sm font-semibold text-gray-700 mb-2">Sans pédoncule</div>
                      <div className="text-xs text-gray-600 mb-1">&nbsp;</div>
                      <input
                        type="number"
                        placeholder="Nbr"
                        value={row.defects?.sansPedonculeNbr || ''}
                        onChange={(e) => updateDefects(index, { sansPedonculeNbr: e.target.value })}
                        className="w-full p-2 border rounded mb-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Poids (kg)"
                        value={row.defects?.sansPedonculePoids || ''}
                        onChange={(e) => updateDefects(index, { sansPedonculePoids: e.target.value })}
                        className="w-full p-2 border rounded mb-2 text-sm"
                        step="0.01"
                      />
                      <div className="text-center font-bold text-purple-600 text-lg">
                        {row.defects?.sansPedonculePercent || '0'}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 p-5 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border-2 border-gray-200 shadow-inner">
            <button onClick={addRow} className="inline-flex items-center gap-2 bg-gradient-to-r from-gray-700 to-gray-800 text-white px-5 py-3 rounded-lg hover:from-gray-800 hover:to-gray-900 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
              <Plus size={18} /> <span className="font-medium">Ajouter ligne</span>
            </button>
            <button onClick={removeLastRow} className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
              <Trash2 size={18} /> <span className="font-medium">Supprimer ligne</span>
            </button>
            <div className="flex-1" />
            <button onClick={generatePDF} className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-semibold">
              <FilePlus size={20} /> <span>Générer PDF</span>
            </button>
            <button onClick={() => setForm(defaultReceptionForm())} className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
              <RefreshCw size={20} /> <span className="font-medium">Réinitialiser</span>
            </button>
            <button onClick={() => archiveForm(form)} className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-5 py-3 rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
              <Save size={20} /> <span className="font-medium">Archiver</span>
            </button>
            <button onClick={() => fetchSavedData('documentId')} className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-5 py-3 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
              <Package size={20} /> <span className="font-medium">Charger</span>
            </button>
            <button onClick={() => updateSavedData('documentId', form)} className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
              <RefreshCw size={20} /> <span className="font-medium">Mettre à jour</span>
            </button>
            <button onClick={() => deleteSavedData('documentId')} className="inline-flex items-center gap-2 bg-gradient-to-r from-red-700 to-red-800 text-white px-5 py-3 rounded-lg hover:from-red-800 hover:to-red-900 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
              <Trash2 size={20} /> <span className="font-medium">Supprimer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="max-w-[1400px] mx-auto mt-6 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl shadow-lg p-6 border-2 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-2xl">📊</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Formules de Calcul</h3>
            <div className="bg-white rounded-lg p-4 shadow-inner border border-blue-200 mb-4">
              <p className="text-gray-700 font-mono text-sm mb-2">
                <span className="font-bold text-green-600">ECART</span> = 
                <span className="font-bold text-blue-600"> Poids Net Usine</span> + 
                <span className="font-bold text-amber-600"> Fuerte</span> - 
                <span className="font-bold text-purple-600"> Poids Net Ticket</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                ✨ L'écart est calculé automatiquement pour chaque ligne et met en évidence les différences positives (vert) ou négatives (rouge).
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-inner border border-red-200">
              <p className="text-gray-700 font-mono text-sm mb-2">
                <span className="font-bold text-red-600">POURCENTAGE DÉFAUT</span> = 
                <span className="font-bold text-blue-600"> (Poids Défaut / Poids Net Usine)</span> × 100
              </p>
              <p className="text-xs text-gray-500 mt-2">
                🔢 Les pourcentages sont calculés automatiquement pour chaque type de défaut et le total des défauts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuiviReception;