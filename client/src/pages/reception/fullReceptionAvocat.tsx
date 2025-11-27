import React, { useState, useEffect } from 'react';
import { Plus, Download, Edit2, Trash2, Search, FileText, Save, X, Archive, Eye } from 'lucide-react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';

// TypeScript declarations for jsPDF
declare global {
  interface Window {
    jspdf?: {
      jsPDF: any;
    };
  }
}

interface ReceptionEntry {
  id: string;
  date: string;
  numLot: string;
  interne: string;
  matricule: string;
  chauffeur: string;
  poidsNetUsine: number;
  dechet: number;
  feurte: number;
  poidsNetTicket: number;
  ecart: number;
  lieu: string;
  variete: string;
  category: 'conventionnel' | 'biologique';
  receptionId: string; // ID du document Firestore parent
}

interface FormData {
  date: string;
  numLot: string;
  interne: string;
  matricule: string;
  chauffeur: string;
  poidsNetUsine: string;
  dechet: string;
  feurte: string;
  poidsNetTicket: string;
  ecart: number;
  lieu: string;
  variete: string;
}

interface FormErrors {
  [key: string]: string;
}

// Interface for complete reception documents from Firebase
interface ReceptionDocument {
  id: string;
  category: 'conventionnel' | 'biologique';
  header: {
    title: string;
    dateReport: string;
    responsable: string;
    bonLivraison: string;
    compagne: string;
  };
  rows: ReceptionRow[];
  createdAt?: any;
  updatedAt?: any;
  userId?: string;
}

interface ReceptionRow {
  date: string;
  nlotInterne?: string; // Changed from numLot/interne to match Firebase structure
  matricule: string;
  chauffeur: string;
  poidsNetUsine: string;
  dechet: string;
  feurte: string;
  poidsNetTicket: string;
  ecart: string;
  leLieu?: string;
  lieu?: string;
  variete: string;
  id?: string;
}

const ReceptionApp = () => {
  const [activeTab, setActiveTab] = useState<'conv' | 'bio'>('conv');
  const [allReceptions, setAllReceptions] = useState<ReceptionDocument[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentReceptionId, setCurrentReceptionId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    date: '',
    numLot: '',
    interne: '',
    matricule: '',
    chauffeur: '',
    poidsNetUsine: '',
    dechet: '',
    feurte: '',
    poidsNetTicket: '',
    ecart: 0,
    lieu: '',
    variete: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Transformer toutes les données en format plat pour l'affichage
  const allReceptionData: ReceptionEntry[] = allReceptions.flatMap(doc => 
    doc.rows.map((row, index) => {
      // Handle nlotInterne field - split it into numLot and interne for display
      const nlotInterne = row.nlotInterne || '';
      const [numLot = '', interne = ''] = nlotInterne.split('/').map(part => part.trim());
      
      return {
        id: row.id || `${doc.id}-${index}`,
        date: row.date,
        numLot,
        interne,
        matricule: row.matricule,
        chauffeur: row.chauffeur,
        poidsNetUsine: parseFloat(row.poidsNetUsine) || 0,
        dechet: parseFloat(row.dechet) || 0,
        feurte: parseFloat(row.feurte) || 0,
        poidsNetTicket: parseFloat(row.poidsNetTicket) || 0,
        ecart: parseFloat(row.ecart) || 0,
        lieu: row.leLieu || row.lieu || '',
        variete: row.variete,
        category: doc.category,
        receptionId: doc.id
      };
    })
  );

  const currentData = activeTab === 'conv' 
    ? allReceptionData.filter(item => item.category === 'conventionnel')
    : allReceptionData.filter(item => item.category === 'biologique');

  const convData = allReceptionData.filter(item => item.category === 'conventionnel');
  const bioData = allReceptionData.filter(item => item.category === 'biologique');

  // Fetch ALL receptions from Firebase
  useEffect(() => {
    fetchAllReceptions();
  }, []);

  const fetchAllReceptions = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'receptions'));
      const querySnapshot = await getDocs(q);
      
      const receptions: ReceptionDocument[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ReceptionDocument));

      // Trier par date (plus récent en premier)
      receptions.sort((a, b) => {
        const dateA = a.header?.dateReport || a.createdAt;
        const dateB = b.header?.dateReport || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setAllReceptions(receptions);
      
      // Sélectionner le premier document comme réception courante
      if (receptions.length > 0) {
        setCurrentReceptionId(receptions[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching all receptions:', error);
      alert('Erreur lors du chargement des données: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Trouver la réception courante
  const currentReception = allReceptions.find(doc => doc.id === currentReceptionId) || allReceptions[0];

  const saveToFirebase = async (receptionData: ReceptionDocument) => {
    try {
      const now = new Date().toISOString();
      
      const dataToSave = {
        ...receptionData,
        updatedAt: now
      };

      if (receptionData.id) {
        // Update existing document
        const docRef = doc(db, 'receptions', receptionData.id);
        await updateDoc(docRef, dataToSave);
      } else {
        // Create new document
        dataToSave.createdAt = now;
        const docRef = await addDoc(collection(db, 'receptions'), dataToSave);
        receptionData.id = docRef.id;
      }
      
      // Refresh data
      await fetchAllReceptions();
      return true;
    } catch (error: any) {
      console.error('Error saving to Firebase:', error);
      alert('Erreur lors de la sauvegarde: ' + error.message);
      return false;
    }
  };

  // Create new reception
  const createNewReception = async () => {
    const category = activeTab === 'conv' ? 'conventionnel' : 'biologique';
    
    const newReception: ReceptionDocument = {
      id: '',
      category,
      header: {
        title: `Réception ${category.toUpperCase()}`,
        dateReport: new Date().toISOString(),
        responsable: auth.currentUser?.email || 'Système',
        bonLivraison: 'AUTO',
        compagne: '2024/2025'
      },
      rows: []
    };

    const saved = await saveToFirebase(newReception);
    if (saved) {
      alert('Nouvelle réception créée avec succès!');
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const calculateEcart = (poidsUsine: number, poidsTicket: number): number => {
    return poidsUsine - poidsTicket;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value } as FormData;
    
    if (name === 'poidsNetUsine' || name === 'poidsNetTicket') {
      newFormData.ecart = calculateEcart(
        parseFloat(newFormData.poidsNetUsine) || 0,
        parseFloat(newFormData.poidsNetTicket) || 0
      );
    }
    
    setFormData(newFormData);
    
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    
    if (!formData.date) newErrors.date = 'Date requise';
    if (!formData.numLot && !formData.interne) newErrors.interne = 'N° LOT ou INTERNE requis';
    if (!formData.matricule) newErrors.matricule = 'Matricule requis';
    if (!formData.chauffeur) newErrors.chauffeur = 'Chauffeur requis';
    if (!formData.poidsNetUsine) newErrors.poidsNetUsine = 'Poids Net Usine requis';
    if (!formData.poidsNetTicket) newErrors.poidsNetTicket = 'Poids Net Ticket requis';
    if (!formData.lieu) newErrors.lieu = 'Lieu requis';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      date: '',
      numLot: '',
      interne: '',
      matricule: '',
      chauffeur: '',
      poidsNetUsine: '',
      dechet: '',
      feurte: '',
      poidsNetTicket: '',
      ecart: 0,
      lieu: '',
      variete: ''
    });
    setErrors({});
    setShowAddForm(false);
    setIsEditing(null);
  };

  const handleAdd = async () => {
    if (!validateForm()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!currentReception) {
      alert('Aucune réception sélectionnée');
      return;
    }

    // Combine numLot and interne into nlotInterne for Firebase
    const nlotInterne = `${formData.numLot}${formData.interne ? ` / ${formData.interne}` : ''}`;

    const newEntry: ReceptionRow = {
      date: formData.date,
      nlotInterne: nlotInterne,
      matricule: formData.matricule,
      chauffeur: formData.chauffeur,
      poidsNetUsine: formData.poidsNetUsine,
      dechet: formData.dechet,
      feurte: formData.feurte,
      poidsNetTicket: formData.poidsNetTicket,
      ecart: formData.ecart.toString(),
      leLieu: formData.lieu,
      variete: formData.variete || (currentReception.category === 'conventionnel' ? 'HASS CONV' : 'HASS BIO'),
      id: Date.now().toString()
    };

    const updatedReception = {
      ...currentReception,
      rows: [...currentReception.rows, newEntry]
    };

    const saved = await saveToFirebase(updatedReception);
    
    if (saved) {
      resetForm();
      alert('Ligne ajoutée avec succès!');
    }
  };

  const handleEdit = (item: ReceptionEntry) => {
    setIsEditing(item.id);
    setFormData({
      date: item.date,
      numLot: item.numLot,
      interne: item.interne,
      matricule: item.matricule,
      chauffeur: item.chauffeur,
      poidsNetUsine: item.poidsNetUsine.toString(),
      dechet: item.dechet.toString(),
      feurte: item.feurte.toString(),
      poidsNetTicket: item.poidsNetTicket.toString(),
      ecart: item.ecart,
      lieu: item.lieu,
      variete: item.variete
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = async () => {
    if (!validateForm()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!isEditing || !currentReception) {
      alert('ID de la ligne à modifier non trouvé');
      return;
    }

    // Combine numLot and interne into nlotInterne for Firebase
    const nlotInterne = `${formData.numLot}${formData.interne ? ` / ${formData.interne}` : ''}`;

    const updatedEntry: ReceptionRow = {
      date: formData.date,
      nlotInterne: nlotInterne,
      matricule: formData.matricule,
      chauffeur: formData.chauffeur,
      poidsNetUsine: formData.poidsNetUsine,
      dechet: formData.dechet,
      feurte: formData.feurte,
      poidsNetTicket: formData.poidsNetTicket,
      ecart: formData.ecart.toString(),
      leLieu: formData.lieu,
      variete: formData.variete,
      id: isEditing
    };

    const updatedReception = {
      ...currentReception,
      rows: currentReception.rows.map(item => 
        item.id === isEditing ? updatedEntry : item
      )
    };
    
    const saved = await saveToFirebase(updatedReception);
    
    if (saved) {
      resetForm();
      alert('Ligne mise à jour avec succès!');
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentReception) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette ligne?\nCette action est irréversible.')) {
      const updatedReception = {
        ...currentReception,
        rows: currentReception.rows.filter(item => item.id !== id)
      };
      
      const saved = await saveToFirebase(updatedReception);
      
      if (saved) {
        alert('Ligne supprimée avec succès!');
      }
    }
  };

  const filteredData = currentData.filter(item =>
    Object.values(item).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const calculateTotals = (data: ReceptionEntry[]) => {
    return data.reduce((totals, item) => ({
      poidsNetUsine: Number(totals.poidsNetUsine) + Number(item.poidsNetUsine || 0),
      dechet: Number(totals.dechet) + Number(item.dechet || 0),
      feurte: Number(totals.feurte) + Number(item.feurte || 0),
      poidsNetTicket: Number(totals.poidsNetTicket) + Number(item.poidsNetTicket || 0),
      ecart: Number(totals.ecart) + Number(item.ecart || 0)
    }), {
      poidsNetUsine: 0,
      dechet: 0,
      feurte: 0,
      poidsNetTicket: 0,
      ecart: 0
    });
  };

  // Generate real PDF document
  const generatePDF = async () => {
    if (currentData.length === 0) {
      alert('Aucune donnée à exporter!');
      return;
    }

    try {
      const data = currentData;
      const type = activeTab === 'conv' ? 'CONVENTIONNEL' : 'BIOLOGIQUE';
      const totals = calculateTotals(data);

      // Load jsPDF from CDN
      if (!window.jspdf) {
        const script1 = document.createElement('script');
        script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        document.head.appendChild(script1);
        await new Promise((resolve, reject) => {
          script1.onload = resolve;
          script1.onerror = reject;
          setTimeout(reject, 10000);
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Load autoTable plugin
      if (!window.jspdf?.jsPDF?.API?.autoTable) {
        const script2 = document.createElement('script');
        script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
        document.head.appendChild(script2);
        await new Promise((resolve, reject) => {
          script2.onload = resolve;
          script2.onerror = reject;
          setTimeout(reject, 10000);
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const jsPDF = window.jspdf.jsPDF;
      if (!jsPDF) {
        throw new Error('jsPDF non chargé correctement');
      }

      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      let yPos = margin;

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`RAPPORT DE RÉCEPTION AVOCAT ${type}`, pageWidth / 2, yPos + 10, { align: 'center' });
      doc.setFontSize(12);
      doc.text('Année 2024/2025', pageWidth / 2, yPos + 18, { align: 'center' });
      yPos += 25;

      // Header Information
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.rect(margin, yPos, pageWidth - 2 * margin, 20);

      const infoStartX = margin + 5;
      let infoYPos = yPos + 7;

      doc.text(`Date du rapport: ${new Date().toLocaleDateString('fr-FR')}`, infoStartX, infoYPos);
      infoYPos += 5;
      doc.text(`Responsable: ${auth.currentUser?.email || 'Système'}`, infoStartX, infoYPos);
      infoYPos += 5;
      doc.text(`Total des lignes: ${data.length}`, infoStartX, infoYPos);
      
      const rightColumnX = pageWidth / 2 + margin;
      infoYPos = yPos + 7;
      doc.text(`Poids total usine: ${totals.poidsNetUsine.toFixed(0)} kg`, rightColumnX, infoYPos);
      infoYPos += 5;
      doc.text(`Poids total ticket: ${totals.poidsNetTicket.toFixed(0)} kg`, rightColumnX, infoYPos);
      infoYPos += 5;
      doc.text(`Écart total: ${totals.ecart.toFixed(0)} kg`, rightColumnX, infoYPos);
      
      yPos += 25;

      // Table data - N° LOT et INTERNE fusionnés
      const tableData = data.map((item, index) => [
        (index + 1).toString(),
        item.date,
        `${item.numLot}${item.interne ? ` / ${item.interne}` : ''}`,
        item.matricule,
        item.chauffeur,
        item.poidsNetUsine.toString(),
        item.dechet.toString(),
        item.feurte.toString(),
        item.poidsNetTicket.toString(),
        item.ecart.toString(),
        item.lieu,
        item.variete
      ]);

      // Add totals row
      tableData.push([
        'TOTAL',
        '',
        '',
        '',
        '',
        totals.poidsNetUsine.toFixed(0),
        totals.dechet.toFixed(0),
        totals.feurte.toFixed(0),
        totals.poidsNetTicket.toFixed(0),
        totals.ecart.toFixed(0),
        '',
        ''
      ]);

      (doc as any).autoTable({
        startY: yPos,
        head: [['#', 'DATE', 'N° LOT / INTERNE', 'MATRICULE', 'CHAUFFEUR', 'POIDS NET USINE', 'DÉCHET', 'FEURTE', 'POIDS NET TICKET', 'ÉCART', 'LIEU', 'VARIÉTÉ']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: { 
          fontSize: 7,
          cellPadding: 2,
          halign: 'center',
          lineWidth: 0.1,
          lineColor: [0, 0, 0]
        },
        columnStyles: {
          0: { cellWidth: 8 },
          5: { fillColor: [220, 252, 231] },
          8: { fillColor: [220, 252, 231] },
          9: { fillColor: [254, 226, 226], fontStyle: 'bold' }
        },
        didParseCell: function(data: any) {
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [59, 130, 246];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Document généré automatiquement - Système de Gestion des Réceptions Avocat', pageWidth / 2, finalY, { align: 'center' });

      doc.save(`Rapport_Reception_${type}_${new Date().toISOString().split('T')[0]}.pdf`);
      alert('PDF généré avec succès!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('Erreur lors de la génération du PDF: ' + error.message);
    }
  };

  const downloadCSV = () => {
    if (currentData.length === 0) {
      alert('Aucune donnée à exporter!');
      return;
    }

    const data = currentData;
    const headers = ['DATE', 'N° LOT / INTERNE', 'Matricule', 'Chauffeur', 'Poids Net Usine', 'Déchet', 'FEURTE', 'Poids Net Ticket', 'ÉCART', 'LE LIEU', 'VARIÉTÉ'];
    
    const csvContent = [
      headers.join(','),
      ...data.map(item => [
        item.date,
        `"${item.numLot}${item.interne ? ` / ${item.interne}` : ''}"`,
        `"${item.matricule}"`,
        `"${item.chauffeur}"`,
        item.poidsNetUsine,
        item.dechet,
        item.feurte,
        item.poidsNetTicket,
        item.ecart,
        `"${item.lieu}"`,
        `"${item.variete}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reception_${activeTab.toUpperCase()}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Fichier CSV téléchargé avec succès!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📋 Réception Avocat HASS 2024/2025
          </h1>
          <p className="text-gray-600">Système de Gestion Complet des Réceptions - Données en temps réel</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={() => {
                setActiveTab('conv');
                resetForm();
              }}
              className={`px-8 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'conv'
                  ? 'bg-green-600 text-white shadow-lg scale-105'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🌱 CONVENTIONNEL ({convData.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('bio');
                resetForm();
              }}
              className={`px-8 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'bio'
                  ? 'bg-green-600 text-white shadow-lg scale-105'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🌿 BIOLOGIQUE ({bioData.length})
            </button>
          </div>

          {currentReception && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    📋 Réception {currentReception.category.toUpperCase()} Active
                  </h3>
                  <p className="text-sm text-gray-600">
                    Date: {formatDate(currentReception.header?.dateReport || currentReception.createdAt)} | 
                    Responsable: {currentReception.header?.responsable || 'Non spécifié'} | 
                    Lignes: {currentReception.rows.length}
                  </p>
                </div>
                <button
                  onClick={createNewReception}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold"
                >
                  <Plus size={16} />
                  Nouvelle Réception
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) {
                  resetForm();
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md font-semibold"
            >
              <Plus size={20} />
              {showAddForm ? 'Fermer Formulaire' : 'Ajouter Nouvelle Ligne'}
            </button>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md font-semibold"
              disabled={currentData.length === 0}
            >
              <Download size={20} />
              Exporter Excel (CSV)
            </button>
            <button
              onClick={generatePDF}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-md font-semibold"
              disabled={currentData.length === 0}
            >
              <FileText size={20} />
              Générer PDF
            </button>
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher dans tous les champs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            </div>
          </div>

          {showAddForm && (
            <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  {isEditing ? '✏️ Modifier la Ligne' : '➕ Nouvelle Ligne'} - {activeTab === 'conv' ? 'CONVENTIONNEL' : 'BIOLOGIQUE'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.date ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">N° LOT / INTERNE *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="numLot"
                      value={formData.numLot}
                      onChange={handleInputChange}
                      placeholder="N° LOT"
                      className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      name="interne"
                      value={formData.interne}
                      onChange={handleInputChange}
                      placeholder="INTERNE"
                      className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {errors.interne && <p className="text-red-500 text-xs mt-1">{errors.interne}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Matricule *</label>
                  <input
                    type="text"
                    name="matricule"
                    value={formData.matricule}
                    onChange={handleInputChange}
                    placeholder="Ex: A 40"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.matricule ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.matricule && <p className="text-red-500 text-xs mt-1">{errors.matricule}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Chauffeur *</label>
                  <input
                    type="text"
                    name="chauffeur"
                    value={formData.chauffeur}
                    onChange={handleInputChange}
                    placeholder="Ex: ABDERAHIM"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.chauffeur ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.chauffeur && <p className="text-red-500 text-xs mt-1">{errors.chauffeur}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Poids Net Usine (kg) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="poidsNetUsine"
                    value={formData.poidsNetUsine}
                    onChange={handleInputChange}
                    placeholder="Ex: 2338"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.poidsNetUsine ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.poidsNetUsine && <p className="text-red-500 text-xs mt-1">{errors.poidsNetUsine}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Déchet (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="dechet"
                    value={formData.dechet}
                    onChange={handleInputChange}
                    placeholder="Ex: 0"
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">FEURTE (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="feurte"
                    value={formData.feurte}
                    onChange={handleInputChange}
                    placeholder="Ex: 0"
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Poids Net Ticket (kg) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="poidsNetTicket"
                    value={formData.poidsNetTicket}
                    onChange={handleInputChange}
                    placeholder="Ex: 2338"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.poidsNetTicket ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.poidsNetTicket && <p className="text-red-500 text-xs mt-1">{errors.poidsNetTicket}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ÉCART (kg) - Calculé Auto</label>
                  <input
                    type="number"
                    step="0.01"
                    name="ecart"
                    value={formData.ecart}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 font-bold"
                    disabled
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">LE LIEU *</label>
                  <input
                    type="text"
                    name="lieu"
                    value={formData.lieu}
                    onChange={handleInputChange}
                    placeholder="Ex: FOUARAT (MORAD)"
                    className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.lieu ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.lieu && <p className="text-red-500 text-xs mt-1">{errors.lieu}</p>}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={isEditing ? handleUpdate : handleAdd}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md font-bold"
                >
                  <Save size={20} />
                  {isEditing ? 'Mettre à Jour' : 'Enregistrer'}
                </button>
                <button
                  onClick={resetForm}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition shadow-md font-bold"
                >
                  <X size={20} />
                  Annuler
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">* Champs obligatoires</p>
            </div>
          )}

          {/* Le reste du code du tableau reste identique */}
          <div className="overflow-x-auto shadow-lg rounded-lg">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">DATE</th>
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">N° LOT / INTERNE</th>
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">Matricule</th>
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">Chauffeur</th>
                  <th className="border border-gray-700 px-3 py-3 text-right text-xs font-bold">Poids Net Usine</th>
                  <th className="border border-gray-700 px-3 py-3 text-right text-xs font-bold">Déchet</th>
                  <th className="border border-gray-700 px-3 py-3 text-right text-xs font-bold">FEURTE</th>
                  <th className="border border-gray-700 px-3 py-3 text-right text-xs font-bold">Poids Net Ticket</th>
                  <th className="border border-gray-700 px-3 py-3 text-right text-xs font-bold">ÉCART</th>
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">LE LIEU</th>
                  <th className="border border-gray-700 px-3 py-3 text-left text-xs font-bold">VARIÉTÉ</th>
                  <th className="border border-gray-700 px-3 py-3 text-center text-xs font-bold">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((item, idx) => (
                    <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition`}>
                      <td className="border border-gray-300 px-3 py-2 text-sm">{item.date}</td>
                      <td className="border border-gray-300 px-3 py-2 text-sm font-semibold">
                        {item.numLot}{item.interne ? ` / ${item.interne}` : ''}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">{item.matricule}</td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">{item.chauffeur}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">{item.poidsNetUsine}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm">{item.dechet}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm">{item.feurte}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">{item.poidsNetTicket}</td>
                      <td className={`border border-gray-300 px-3 py-2 text-right text-sm font-bold ${
                        item.ecart < 0 ? 'text-red-600 bg-red-50' : item.ecart > 0 ? 'text-green-600 bg-green-50' : 'text-gray-600'
                      }`}>
                        {item.ecart}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">{item.lieu}</td>
                      <td className="border border-gray-300 px-3 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          item.category === 'biologique' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.variete}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="border border-gray-300 px-3 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <div className="text-6xl mb-4">📦</div>
                        <p className="text-xl font-semibold mb-2">Aucune donnée disponible pour {activeTab === 'conv' ? 'CONVENTIONNEL' : 'BIOLOGIQUE'}</p>
                        <p className="text-sm">Cliquez sur "Ajouter Nouvelle Ligne" pour commencer à saisir des données</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredData.length > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-yellow-100 to-yellow-200 font-bold">
                    <td colSpan={4} className="border border-gray-400 px-3 py-3 text-sm uppercase">
                      📊 TOTAUX {activeTab === 'conv' ? 'CONVENTIONNEL' : 'BIOLOGIQUE'}
                    </td>
                    {(() => {
                      const totals = calculateTotals(filteredData);
                      return (
                        <>
                          <td className="border border-gray-400 px-3 py-3 text-right text-sm">
                            {Number(totals.poidsNetUsine || 0).toFixed(2)} kg
                          </td>
                          <td className="border border-gray-400 px-3 py-3 text-right text-sm">
                            {Number(totals.dechet || 0).toFixed(2)} kg
                          </td>
                          <td className="border border-gray-400 px-3 py-3 text-right text-sm">
                            {Number(totals.feurte || 0).toFixed(2)} kg
                          </td>
                          <td className="border border-gray-400 px-3 py-3 text-right text-sm">
                            {Number(totals.poidsNetTicket || 0).toFixed(2)} kg
                          </td>
                          <td className="border border-gray-400 px-3 py-3 text-right text-sm">
                            {Number(totals.ecart || 0).toFixed(2)} kg
                          </td>
                        </>
                      );
                    })()}
                    <td colSpan={2} className="border border-gray-400"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {filteredData.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-bold text-gray-800 mb-2">📈 Statistiques {activeTab === 'conv' ? 'CONVENTIONNEL' : 'BIOLOGIQUE'}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-white p-3 rounded shadow">
                  <p className="text-gray-600">Total Lignes</p>
                  <p className="text-2xl font-bold text-blue-600">{filteredData.length}</p>
                </div>
                <div className="bg-white p-3 rounded shadow">
                  <p className="text-gray-600">Poids Total Usine</p>
                  <p className="text-2xl font-bold text-green-600">
                    {Number(calculateTotals(filteredData).poidsNetUsine || 0).toFixed(0)} kg
                  </p>
                </div>
                <div className="bg-white p-3 rounded shadow">
                  <p className="text-gray-600">Poids Total Ticket</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {Number(calculateTotals(filteredData).poidsNetTicket || 0).toFixed(0)} kg
                  </p>
                </div>
                <div className="bg-white p-3 rounded shadow">
                  <p className="text-gray-600">Écart Total</p>
                  <p className={`text-2xl font-bold ${
                    Number(calculateTotals(filteredData).ecart || 0) < 0 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                    {Number(calculateTotals(filteredData).ecart || 0).toFixed(0)} kg
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceptionApp;