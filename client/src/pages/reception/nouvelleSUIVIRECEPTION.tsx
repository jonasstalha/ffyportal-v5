import React, { useState, useEffect } from 'react';
import { Download, Printer, Save, Archive, Plus, Trash2, FileText, Database, Share2, Search, ChevronDown, Eye, Edit, FilePlus, RefreshCw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

// PDF logo: set this to a public path (e.g. '/logo.png') or an absolute URL.
const PDF_LOGO_URL = '../../../assets/logo.png';

interface RowData {
  id: number;
  noPalette: string;
  nrCaisse: string;
  tarePalette: string;
  poidsBrut: string;
  poidsNet: string;
  variete: string;
  lotIntern: string;
  decision: string;
}

interface FormData {
  date: string;
  version: string;
  chau: string;
  matricule: string;
  dateMatricule: string;
  responsable: string;
  compagne1: string;
  compagne2: string;
  bonLivraison: string;
  produit: string;
  bonReception: string;
  rows: RowData[];
  firebaseId?: string;
}

interface Totals {
  totalPalettes: number;
  totalCaisses: number;
  totalTare: string;
  totalBrut: string;
  totalPoids: string;
  poidsUsine: string;
  poidsTicket: string;
  poidsUsineBrut: string;
  poidsBrutTicket: string;
  ecart: string;
  ecartBrut: string;
}

interface ArchiveData extends FormData {
  firebaseId?: string;
  type: string;
  totals: Totals;
  savedAt: string;
  timestamp: number;
}

const SuiviReception = () => {
  const [activeType, setActiveType] = useState<'CONVENTIONNEL' | 'BIOLOGIQUE'>('CONVENTIONNEL');
  const [archives, setArchives] = useState<ArchiveData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [isLoadingArchives, setIsLoadingArchives] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'responsable' | 'bonLivraison'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [formData, setFormData] = useState<FormData>({
    date: new Date().toISOString().split('T')[0],
    version: '01',
    chau: '',
    matricule: '',
    dateMatricule: new Date().toISOString().split('T')[0],
    responsable: 'LAILA LAKTOB',
    compagne1: '2025',
    compagne2: '2026',
    bonLivraison: '08',
    produit: 'AVOCAT',
    bonReception: '08',
    rows: [
      { id: 1, noPalette: '1', nrCaisse: '24', tarePalette: '23', poidsBrut: '', poidsNet: '', variete: 'HASS', lotIntern: '', decision: '' },
      { id: 2, noPalette: '2', nrCaisse: '24', tarePalette: '23', poidsBrut: '', poidsNet: '', variete: 'HASS', lotIntern: '', decision: '' },
      { id: 3, noPalette: '3', nrCaisse: '24', tarePalette: '23', poidsBrut: '', poidsNet: '', variete: 'HASS', lotIntern: '', decision: '' }
    ]
  });

  const [totals, setTotals] = useState<Totals>({
    totalPalettes: 0,
    totalCaisses: 0,
    totalTare: '0',
    totalBrut: '0',
    totalPoids: '0',
    poidsUsine: '0',
    poidsTicket: '0',
    poidsUsineBrut: '0',
    poidsBrutTicket: '0',
    ecart: '0',
    ecartBrut: '0'
  });

  // Helper function to extract numbers from Bon Livraison for proper numerical sorting
  const extractNumberFromBonLivraison = (bonLivraison: string | undefined): number => {
    if (!bonLivraison) return 0;
    
    const numbers = bonLivraison.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      return parseInt(numbers[0], 10);
    }
    
    return 0;
  };

  // Helper functions for archive section
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatFirestoreDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      if (typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Date invalide';
    }
  };

  const calculateTotals = () => {
    const totalPalettes = formData.rows.length;
    const totalCaisses = formData.rows.reduce((sum, row) => sum + (parseFloat(row.nrCaisse) || 0), 0);
    const totalTare = formData.rows.reduce((sum, row) => sum + (parseFloat(row.tarePalette) || 0), 0);
    const totalBrut = formData.rows.reduce((sum, row) => sum + (parseFloat(row.poidsBrut) || 0), 0);
    const totalPoids = formData.rows.reduce((sum, row) => sum + (parseFloat(row.poidsNet) || 0), 0);

    // Calculate the new brut values
    const poidsUsineBrut = totalPoids + (totalCaisses * 2.79) + totalTare;
    const poidsBrutTicket = (totalCaisses * 2.80) + totalTare + (parseFloat(totals.poidsTicket) || 0);
    const ecartBrut = (poidsUsineBrut - poidsBrutTicket);

    setTotals(prev => {
      const poidsTicket = parseFloat(prev.poidsTicket) || 0;
      const poidsUsineVal = totalPoids;
      return {
        ...prev,
        totalPalettes,
        totalCaisses,
        totalTare: totalTare.toFixed(0),
        totalBrut: totalBrut.toFixed(0),
        totalPoids: totalPoids.toFixed(2),
        poidsUsine: poidsUsineVal.toFixed(2),
        ecart: (poidsUsineVal - poidsTicket).toFixed(2),
        poidsUsineBrut: poidsUsineBrut.toFixed(2),
        poidsBrutTicket: poidsBrutTicket.toFixed(2),
        ecartBrut: ecartBrut.toFixed(2)
      };
    });
  };

  useEffect(() => {
    calculateTotals();
  }, [formData.rows, totals.poidsTicket]);

  // Load archives on component mount
  useEffect(() => {
    loadFromFirebase();
  }, []);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRowChange = (id: number, field: keyof RowData, value: string) => {
    setFormData(prev => {
      const updatedRows = prev.rows.map(row => {
        if (row.id === id) {
          const updated = { ...row, [field]: value };

          // Formula: Poids Net = Poids Brut - Tare Palette - (Nr Caisse * 2.79)
          if (field === 'poidsBrut' || field === 'tarePalette' || field === 'nrCaisse') {
            const brut = parseFloat(updated.poidsBrut) || 0;
            const tare = parseFloat(updated.tarePalette) || 0;
            const nrCaisse = parseFloat(updated.nrCaisse) || 0;
            updated.poidsNet = (brut - tare - (nrCaisse * 2.79)).toFixed(2);
          }

          return updated;
        }
        return row;
      });
      return { ...prev, rows: updatedRows };
    });
  };

  const addRow = () => {
    const newId = Math.max(...formData.rows.map(r => r.id), 0) + 1;
    setFormData(prev => ({
      ...prev,
      rows: [...prev.rows, {
        id: newId,
        noPalette: String(prev.rows.length + 1),
        nrCaisse: '24',
        tarePalette: '23',
        poidsBrut: '',
        poidsNet: '',
        variete: 'HASS',
        lotIntern: '',
        decision: ''
      }]
    }));
  };

  const deleteRow = (id: number) => {
    if (formData.rows.length > 1) {
      setFormData(prev => {
        const rows = prev.rows.filter(row => row.id !== id).map((r, i) => ({ ...r, noPalette: String(i + 1) }));
        return {
          ...prev,
          rows
        };
      });
    }
  };

  // Firestore-backed CRUD
  const saveToFirebase = async () => {
    setLoading(true);
    try {
      const record = {
        ...formData,
        type: activeType,
        totals,
        savedAt: new Date().toISOString(),
        timestamp: Date.now()
      };

      const colRef = collection(db, 'suiviReception');

      if (formData.firebaseId) {
        const docRef = doc(db, 'suiviReception', formData.firebaseId);
        await updateDoc(docRef, record);
        setArchives(prev => prev.map(a => a.firebaseId === formData.firebaseId ? { ...record, firebaseId: formData.firebaseId } : a));
        alert('✅ Enregistrement mis à jour!');
      } else {
        const docRef = await addDoc(colRef, record);
        setArchives(prev => [{ ...record, firebaseId: docRef.id }, ...prev]);
        setFormData(prev => ({ ...prev, firebaseId: docRef.id }));
        alert('✅ Enregistré avec succès dans Firebase!\nID: ' + docRef.id);
      }
    } catch (err) {
      console.error('Erreur Firebase:', err);
      alert('❌ Erreur Firebase: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const loadFromFirebase = async () => {
    setIsLoadingArchives(true);
    try {
      const colRef = collection(db, 'suiviReception');
      const q = query(colRef, orderBy('timestamp', 'desc'));
      const snaps = await getDocs(q);
      const archivesList = snaps.docs.map(d => ({ 
        ...(d.data() as ArchiveData), 
        firebaseId: d.id 
      }));
      setArchives(archivesList);
    } catch (err) {
      console.error('Erreur chargement Firebase:', err);
      alert('❌ Erreur chargement: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoadingArchives(false);
    }
  };

  const deleteFromFirebase = async (firebaseId: string) => {
    if (!confirm('Supprimer cet enregistrement de Firebase?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'suiviReception', firebaseId));
      setArchives(prev => prev.filter(a => a.firebaseId !== firebaseId));
      if (formData.firebaseId === firebaseId) {
        setFormData(prev => {
          const copy = { ...prev };
          delete copy.firebaseId;
          return copy;
        });
      }
      alert('✅ Supprimé de Firebase!');
    } catch (err) {
      console.error('Erreur suppression:', err);
      alert('❌ Erreur: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Archive functions
  const viewArchive = (archived: ArchiveData) => {
    alert(`Consultation de l'archive: ${archived.bonReception}\nResponsable: ${archived.responsable}\nDate: ${archived.dateMatricule}`);
  };

  const loadArchive = (archived: ArchiveData) => {
    if (!confirm('Charger cet enregistrement? Les données actuelles seront remplacées.')) return;
    
    setFormData({
      ...archived,
      firebaseId: archived.firebaseId
    });
    setActiveType(archived.type as 'CONVENTIONNEL' | 'BIOLOGIQUE');
    setTotals(archived.totals);
    setShowArchive(false);
    alert('✅ Enregistrement chargé!');
  };

  const duplicateArchive = (archived: ArchiveData) => {
    const duplicated = {
      ...archived,
      firebaseId: undefined,
      bonReception: `${archived.bonReception}-COPY`,
      timestamp: Date.now(),
      savedAt: new Date().toISOString()
    };
    
    setFormData(duplicated);
    setTotals(archived.totals);
    setShowArchive(false);
    alert('✅ Enregistrement dupliqué! Modifiez le numéro de bon de réception.');
  };

  const deleteArchive = async (firebaseId: string) => {
    await deleteFromFirebase(firebaseId);
  };

  const generatePDF = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');

    const logoUrl = (function () {
      try {
        if (!PDF_LOGO_URL) return '';
        if (PDF_LOGO_URL.startsWith('http://') || PDF_LOGO_URL.startsWith('https://')) return PDF_LOGO_URL;
        return window.location.origin + (PDF_LOGO_URL.startsWith('/') ? PDF_LOGO_URL : '/' + PDF_LOGO_URL);
      } catch (e) {
        return '';
      }
    })();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>SUIVI RECEPTION - ${formData.bonReception}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 11px;
            padding: 10px;
          }
          
          .header {
            display: flex;
            border: 3px solid black;
            margin-bottom: 2px;
            height: 100px;
          }
          
          .header-logo {
            width: 140px;
            border-right: 3px solid black;
            padding: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          
          .logo-circle {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #ff6b6b 50%, #4ecdc4 50%);
            border-radius: 50%;
            margin-bottom: 5px;
            position: relative;
            border: 2px solid #2d5016;
          }
          
          .logo-circle::after {
            content: '';
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 15px;
            background: #7fb069;
            clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
          }
          
          .logo-text {
            font-size: 10px;
            font-weight: bold;
            color: #2d5016;
          }
          
          .header-title {
            flex: 1;
            background: #7fb069;
            border-right: 3px solid black;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .header-title h1 {
            font-size: 38px;
            font-weight: bold;
            letter-spacing: 2px;
          }
          
          .header-info {
            width: 180px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            justify-content: space-around;
            text-align: center;
          }
          
          .header-info div {
            font-weight: bold;
            font-size: 11px;
          }
          
          .info-row {
            display: flex;
            border: 3px solid black;
            border-top: none;
            min-height: 32px;
          }
          
          .info-cell {
            flex: 1;
            border-right: 3px solid black;
            padding: 8px;
            display: flex;
            align-items: center;
            font-weight: bold;
            font-size: 11px;
          }
          
          .info-cell:last-child { border-right: none; }
          
          .product-row {
            display: flex;
            border: 3px solid black;
            border-top: none;
            min-height: 32px;
          }
          
          .product-cell {
            flex: 1;
            border-right: 3px solid black;
            padding: 8px;
            display: flex;
            align-items: center;
            font-weight: bold;
            font-size: 11px;
          }
          
          .product-cell:last-child { border-right: none; }
          .product-cell.green { background: #7fb069; }
          
          .type-checkbox {
            display: inline-flex;
            align-items: center;
            margin-left: 15px;
            padding: 4px 12px;
            border: 2px solid black;
            background: white;
          }
          
          .type-checkbox.active {
            background: #7fb069;
          }
          
          .checkbox-mark {
            font-size: 16px;
            font-weight: bold;
            margin-right: 5px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            border: 3px solid black;
            border-top: 2px solid black;
            margin-top: 2px;
          }
          
          th, td {
            border: 2px solid black;
            padding: 3px 2px;
            text-align: center;
            font-size: 9px;
            line-height: 1.1;
          }
          
          th {
            background: #7fb069;
            font-weight: bold;
            font-size: 9px;
            line-height: 1.2;
          }
          
          .total-row {
            background: #87ceeb;
            font-weight: bold;
            font-size: 11px;
          }
          
          .weight-section {
            display: flex;
            margin-top: 5px;
            gap: 0;
          }
          
          .weight-box {
            flex: 1;
            border: 3px solid black;
            padding: 12px;
            text-align: center;
          }
          
          .weight-box:not(:last-child) {
            border-right: none;
          }
          
          .weight-label {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 5px;
          }
          
          .weight-value {
            font-size: 18px;
            font-weight: bold;
          }
          
          @media print {
            body { padding: 0; }
            .header { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-logo">
            <img src="${logoUrl}" alt="logo" style="max-width:120px;max-height:80px;object-fit:contain;" onerror="this.style.display='none'" />
            <div class="logo-circle" style="${logoUrl ? 'display:none;' : ''}"></div>
            <div class="logo-text" style="${logoUrl ? 'display:none;' : ''}">fruitsforyou</div>
          </div>
          <div class="header-title">
            <h1>SUIVI RECEPTION</h1>
          </div>
          <div class="header-info">
            <div>SMQ.ENR24</div>
            <div>Date: ${formData.dateMatricule}</div>
            <div>Version: ${formData.version}</div>
          </div>
        </div>
        
        <div class="info-row">
          <div class="info-cell">CHAU : ${formData.chau}</div>
          <div class="info-cell">MATRICULE : ${formData.matricule}</div>
        </div>
        
        <div class="info-row">
          <div class="info-cell">DATE : ${formData.dateMatricule}</div>
          <div class="info-cell">Responsable: ${formData.responsable}</div>
          <div class="info-cell">Compagne: ${formData.compagne1}/${formData.compagne2}</div>
        </div>
        
        <div class="product-row">
          <div class="info-cell">N° BON DE LIVRISON : ${formData.bonLivraison}</div>
          <div class="product-cell green">PRODUIT : ${formData.produit}</div>
        </div>
        
        <div class="product-row">
          <div class="info-cell">N° BON DE RECEPTION : ${formData.bonReception}</div>
          <div class="info-cell">
            <span class="type-checkbox ${activeType === 'CONVENTIONNEL' ? 'active' : ''}">
              <span class="checkbox-mark"></span> CONVENTIONNEL
            </span>
            <span class="type-checkbox ${activeType === 'BIOLOGIQUE' ? 'active' : ''}">
              <span class="checkbox-mark"></span> BIOLOGIQUE
            </span>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>N° PALETTE</th>
              <th>NR CAISSE</th>
              <th>TARE<br>PALETTE</th>
              <th>POIDS BRUT<br>(kg)</th>
              <th>POIDS NET<br>(kg)</th>
              <th>VARIETE</th>
              <th>N° DE LOT<br>INTERN</th>
              <th>DECISION</th>
            </tr>
          </thead>
          <tbody>
            ${formData.rows.map(row => `
              <tr>
                <td><strong>${row.noPalette}</strong></td>
                <td>${row.nrCaisse}</td>
                <td>${row.tarePalette}</td>
                <td>${row.poidsBrut}</td>
                <td><strong>${row.poidsNet}</strong></td>
                <td>${row.variete}</td>
                <td>${row.lotIntern}</td>
                <td>${row.decision}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td></td>
              <td>${totals.totalCaisses}</td>
              <td>${totals.totalTare}</td>
              <td>${totals.totalBrut}</td>
              <td>${totals.totalPoids}</td>
              <td colspan="3"></td>
            </tr>
          </tbody>
        </table>
        
        <div class="weight-section">
          <div class="weight-box">
            <div class="weight-label">POIDS USINE</div>
            <div class="weight-value">${totals.poidsUsine}</div>
          </div>
          <div class="weight-box">
            <div class="weight-label">POIDS TICKET</div>
            <div class="weight-value">${totals.poidsTicket}</div>
          </div>
          <div class="weight-box">
            <div class="weight-label">ECART</div>
            <div class="weight-value">${totals.ecart}</div>
          </div>
          <div class="weight-box">
            <div class="weight-label">POIDS USINE BRUT</div>
            <div class="weight-value">${totals.poidsUsineBrut}</div>
          </div>
          <div class="weight-box">
            <div class="weight-label">POIDS BRUT TICKET</div>
            <div class="weight-value">${totals.poidsBrutTicket}</div>
          </div>
          <div class="weight-box">
            <div class="weight-label">ECART BRUT</div>
            <div class="weight-value">${totals.ecartBrut}</div>
          </div>
        </div>
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow!.document.write(htmlContent);
    printWindow!.document.close();
  };

  const exportToExcel = () => {
    let csv = 'SUIVI RECEPTION SMQ ENR24\n';
    csv += `Date: ${formData.dateMatricule},Version: ${formData.version}\n`;
    csv += `CHAU: ${formData.chau},MATRICULE: ${formData.matricule}\n`;
    csv += `Responsable: ${formData.responsable},Compagne: ${formData.compagne1}/${formData.compagne2}\n\n`;
    csv += `BON LIVRAISON: ${formData.bonLivraison},PRODUIT: ${formData.produit},TYPE: ${activeType}\n`;
    csv += `BON RECEPTION: ${formData.bonReception}\n\n`;

    csv += 'N° PALETTE,NR CAISSE,TARE PALETTE,POIDS BRUT (kg),POIDS NET (kg),VARIETE,N° DE LOT INTERN,DECISION\n';
    formData.rows.forEach(row => {
      csv += `${row.noPalette},${row.nrCaisse},${row.tarePalette},${row.poidsBrut},${row.poidsNet},${row.variete},${row.lotIntern},${row.decision}\n`;
    });
    csv += `TOTAL,${totals.totalCaisses},${totals.totalTare},${totals.totalBrut},${totals.totalPoids},,,\n\n`;
    csv += `POIDS USINE,POIDS TICKET,ECART,POIDS USINE BRUT,POIDS BRUT TICKET,ECART BRUT\n`;
    csv += `${totals.poidsUsine},${totals.poidsTicket},${totals.ecart},${totals.poidsUsineBrut},${totals.poidsBrutTicket},${totals.ecartBrut}\n`;

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SUIVI_RECEPTION_${formData.bonReception}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alert('✅ Exporté en Excel (CSV)!');
  };

  const printForm = () => {
    window.print();
  };

  // Filter archives based on search term
  const filteredArchives = archives.filter(archive => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      archive.bonReception?.toLowerCase().includes(searchLower) ||
      archive.responsable?.toLowerCase().includes(searchLower) ||
      archive.bonLivraison?.toLowerCase().includes(searchLower) ||
      archive.bonLivraison?.includes(searchTerm) ||
      archive.produit?.toLowerCase().includes(searchLower) ||
      archive.rows.some(row => 
        row.variete?.toLowerCase().includes(searchLower) ||
        row.lotIntern?.toLowerCase().includes(searchLower)
      )
    );
  }).sort((a, b) => {
    // Numerical sorting for Bon Livraison
    if (sortBy === 'bonLivraison') {
      const aNum = extractNumberFromBonLivraison(a.bonLivraison);
      const bNum = extractNumberFromBonLivraison(b.bonLivraison);
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    } else if (sortBy === 'date') {
      const aDate = new Date(a.dateMatricule);
      const bDate = new Date(b.dateMatricule);
      return sortOrder === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
    } else if (sortBy === 'responsable') {
      const aResp = a.responsable || '';
      const bResp = b.responsable || '';
      return sortOrder === 'asc' ? aResp.localeCompare(bResp) : bResp.localeCompare(aResp);
    }
    return 0;
  });

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden border border-gray-300">
        {/* Header */}
        <div className="bg-[#1f2a38] text-white p-4 md:p-6">
          <h1 className="text-xl md:text-3xl font-bold text-center flex items-center justify-center gap-2 md:gap-3">
            <Database className="animate-pulse" size={24} />
            SUIVI RECEPTION SMQ, ENR24
          </h1>
          <div className="flex flex-wrap justify-between items-center mt-3 md:mt-4 text-sm gap-2">
            <span className="bg-[#2a384a] px-3 py-1 rounded">Date: {formData.date}</span>
            <span className="bg-[#2a384a] px-3 py-1 rounded">Version: {formData.version}</span>
            <span className={`px-3 py-1 rounded ${loading ? 'bg-yellow-600' : 'bg-green-600'}`}>
              {loading ? '⏳ Traitement...' : '✅ Prêt'}
            </span>
          </div>
        </div>

        {/* Info Section */}
        <div className="p-4 md:p-6 bg-gray-50 border-b border-gray-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">CHAU</label>
              <input
                type="text"
                value={formData.chau}
                onChange={(e) => handleInputChange('chau', e.target.value)}
                className="w-full px-3 py-2 border border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">MATRICULE</label>
              <input
                type="text"
                value={formData.matricule}
                onChange={(e) => handleInputChange('matricule', e.target.value)}
                className="w-full px-3 py-2 border border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">DATE</label>
              <input
                type="date"
                value={formData.dateMatricule}
                onChange={(e) => handleInputChange('dateMatricule', e.target.value)}
                className="w-full px-3 py-2 border border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Responsable</label>
              <input
                type="text"
                value={formData.responsable}
                onChange={(e) => handleInputChange('responsable', e.target.value)}
                className="w-full px-3 py-2 border border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Compagne 1</label>
              <input
                type="text"
                value={formData.compagne1}
                onChange={(e) => handleInputChange('compagne1', e.target.value)}
                className="w-full px-3 py-2 border border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Compagne 2</label>
              <input
                type="text"
                value={formData.compagne2}
                onChange={(e) => handleInputChange('compagne2', e.target.value)}
                className="w-full px-3 py-2 border border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
              />
            </div>
          </div>
        </div>

        {/* Product Info & Type Selection */}
        <div className="p-4 md:p-6 border-b border-gray-300 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">N° BON DE LIVRAISON</label>
                <input
                  type="text"
                  value={formData.bonLivraison}
                  onChange={(e) => handleInputChange('bonLivraison', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">PRODUIT</label>
                <input
                  type="text"
                  value={formData.produit}
                  onChange={(e) => handleInputChange('produit', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                />
              </div>
            </div>

            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">N° BON DE RECEPTION</label>
                <input
                  type="text"
                  value={formData.bonReception}
                  onChange={(e) => handleInputChange('bonReception', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">TYPE</label>
                <div className="flex gap-3 md:gap-4">
                  <button
                    onClick={() => setActiveType('CONVENTIONNEL')}
                    className={`flex-1 px-3 md:px-4 py-2 rounded font-semibold transition-all border-2 ${
                      activeType === 'CONVENTIONNEL'
                        ? 'bg-[#1f2a38] text-white border-[#1f2a38]'
                        : 'bg-white text-gray-700 border-gray-400 hover:border-[#1f2a38]'
                    }`}
                  >
                    CONVENTIONNEL
                  </button>
                  <button
                    onClick={() => setActiveType('BIOLOGIQUE')}
                    className={`flex-1 px-3 md:px-4 py-2 rounded font-semibold transition-all border-2 ${
                      activeType === 'BIOLOGIQUE'
                        ? 'bg-[#1f2a38] text-white border-[#1f2a38]'
                        : 'bg-white text-gray-700 border-gray-400 hover:border-[#1f2a38]'
                    }`}
                  >
                    BIOLOGIQUE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-4 md:p-6 overflow-x-auto">
          <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <h2 className="text-lg md:text-xl font-bold text-gray-800">Tableau de Réception - {activeType}</h2>
            <button
              onClick={addRow}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#1f2a38] text-white rounded hover:bg-[#2a384a] transition-colors font-semibold"
            >
              <Plus size={16} /> Ajouter Ligne
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-2 border-gray-400">
              <thead>
                <tr className="bg-[#1f2a38] text-white">
                  <th className="border-2 border-gray-600 p-2 text-xs whitespace-nowrap">N° PALETTE</th>
                  <th className="border-2 border-gray-600 p-2 text-xs whitespace-nowrap">NR CAISSE</th>
                  <th className="border-2 border-gray-600 p-2 text-xs whitespace-nowrap">TARE<br />PALETTE</th>
                  <th className="border-2 border-gray-600 p-2 text-xs whitespace-nowrap">POIDS BRUT<br />(kg)</th>
                  <th className="border-2 border-gray-600 p-2 text-xs whitespace-nowrap">POIDS NET<br />(kg)</th>
                  <th className="border-2 border-gray-600 p-2 text-xs whitespace-nowrap">VARIETE</th>
                  <th className="border-2 border-gray-600 p-2 text-xs whitespace-nowrap">N° DE LOT<br />INTERN</th>
                  <th className="border-2 border-gray-600 p-2 text-xs whitespace-nowrap">DECISION</th>
                  <th className="border-2 border-gray-600 p-2 text-xs whitespace-nowrap">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {formData.rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="border-2 border-gray-400 p-1">
                      <input
                        type="text"
                        value={String(index + 1)}
                        readOnly
                        className="w-full px-2 py-1 text-sm text-center border-0 bg-gray-100 font-semibold rounded"
                        title="N° PALETTE auto-généré"
                      />
                    </td>
                    <td className="border-2 border-gray-400 p-1">
                      <input
                        type="number"
                        value={row.nrCaisse}
                        onChange={(e) => handleRowChange(row.id, 'nrCaisse', e.target.value)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 rounded outline-none"
                      />
                    </td>
                    <td className="border-2 border-gray-400 p-1">
                      <input
                        type="number"
                        step="0.01"
                        value={row.tarePalette}
                        onChange={(e) => handleRowChange(row.id, 'tarePalette', e.target.value)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 rounded outline-none"
                      />
                    </td>
                    <td className="border-2 border-gray-400 p-1">
                      <input
                        type="number"
                        step="0.01"
                        value={row.poidsBrut}
                        onChange={(e) => handleRowChange(row.id, 'poidsBrut', e.target.value)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 rounded outline-none"
                      />
                    </td>
                    <td className="border-2 border-gray-400 p-1 bg-yellow-50">
                      <input
                        type="text"
                        value={row.poidsNet}
                        readOnly
                        className="w-full px-2 py-1 text-sm text-center border-0 bg-transparent font-bold text-green-700"
                        title="Auto-calculé: Brut - Tare - (Caisses × 2.79)"
                      />
                    </td>
                    <td className="border-2 border-gray-400 p-1">
                      <select
                        value={row.variete}
                        onChange={(e) => handleRowChange(row.id, 'variete', e.target.value)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 rounded outline-none bg-white"
                      >
                        <option>HASS</option>
                        <option>ZUTANO</option>
                        <option>FUERTE</option>
                        <option>BACON</option>
                      </select>
                    </td>
                    <td className="border-2 border-gray-400 p-1">
                      <input
                        type="text"
                        value={row.lotIntern}
                        onChange={(e) => handleRowChange(row.id, 'lotIntern', e.target.value)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 rounded outline-none"
                      />
                    </td>
                    <td className="border-2 border-gray-400 p-1">
                      <input
                        type="text"
                        value={row.decision}
                        onChange={(e) => handleRowChange(row.id, 'decision', e.target.value)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-300 focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 rounded outline-none"
                      />
                    </td>
                    <td className="border-2 border-gray-400 p-1 text-center">
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-30"
                        disabled={formData.rows.length === 1}
                        title="Supprimer la ligne"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Totals Row */}
                <tr className="bg-[#1f2a38] text-white font-bold">
                  <td className="border-2 border-gray-600 p-2 text-sm"></td>
                  <td className="border-2 border-gray-600 p-2 text-sm text-center">{totals.totalCaisses}</td>
                  <td className="border-2 border-gray-600 p-2 text-sm text-center">{totals.totalTare}</td>
                  <td className="border-2 border-gray-600 p-2 text-sm text-center">{totals.totalBrut}</td>
                  <td className="border-2 border-gray-600 p-2 text-sm text-center bg-[#2a384a]">{totals.totalPoids}</td>
                  <td className="border-2 border-gray-600 p-2" colSpan={4}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Weight Verification */}
          <div className="mt-6 bg-gray-50 p-4 md:p-6 rounded-lg border-2 border-gray-400">
            <h3 className="font-bold text-gray-800 mb-4 text-lg">⚖️ Vérification des Poids</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded border-2 border-blue-400">
                <label className="block text-sm font-semibold text-gray-700 mb-2">POIDS USINE (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={totals.poidsUsine}
                  readOnly
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded bg-gray-100 text-center text-lg font-bold"
                  title="Auto-calculé: Somme des POIDS NET"
                />
              </div>
              <div className="bg-white p-4 rounded border-2 border-green-400">
                <label className="block text-sm font-semibold text-gray-700 mb-2">POIDS TICKET (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={totals.poidsTicket}
                  onChange={(e) => setTotals(prev => {
                    const newTicket = parseFloat(e.target.value) || 0;
                    const poidsUsine = parseFloat(prev.poidsUsine) || 0;
                    return ({
                      ...prev,
                      poidsTicket: newTicket.toString(),
                      ecart: (poidsUsine - newTicket).toFixed(2)
                    });
                  })}
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 text-center text-lg font-bold outline-none"
                />
              </div>
              <div className="bg-white p-4 rounded border-2 border-orange-400">
                <label className="block text-sm font-semibold text-gray-700 mb-2">ÉCART (kg)</label>
                <input
                  type="text"
                  value={totals.ecart}
                  readOnly
                  className="w-full px-4 py-3 border-2 border-orange-400 rounded bg-orange-50 font-bold text-orange-700 text-center text-lg"
                />
              </div>
              <div className="bg-white p-4 rounded border-2 border-purple-400">
                <label className="block text-sm font-semibold text-gray-700 mb-2">POIDS USINE brut (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={totals.poidsUsineBrut}
                  readOnly
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded bg-gray-100 text-center text-lg font-bold"
                  title="Auto-calculé: Poids Net USINE + (Nbr Caisse × 2.79) + Tare Palette"
                />
              </div>
              <div className="bg-white p-4 rounded border-2 border-green-400">
                <label className="block text-sm font-semibold text-gray-700 mb-2">POIDS BRUT TICKET (kg)</label>
                <input
                  type="text"
                  value={totals.poidsBrutTicket}
                  readOnly
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded bg-gray-100 text-center text-lg font-bold"
                  title="Auto-calculé: (Nbr Caisse Total × 2.80) + Tare Palette Total + Poids Net Ticket"
                />
              </div>
              <div className="bg-white p-4 rounded border-2 border-orange-400">
                <label className="block text-sm font-semibold text-gray-700 mb-2">ÉCART BRUT (kg)</label>
                <input
                  type="text"
                  value={totals.ecartBrut}
                  readOnly
                  className="w-full px-4 py-3 border-2 border-orange-400 rounded bg-orange-50 font-bold text-orange-700 text-center text-lg"
                />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600 text-center">
              📊 Formules: 
              <br />Poids Net = Poids Brut - Tare Palette - (Nr Caisse × 2.79)
              <br />Poids USINE Brut = Poids Net USINE + (Nbr Caisse Total × 2.79) + Tare Palette Total
              <br />Poids BRUT Ticket = (Nbr Caisse Total × 2.80) + Tare Palette Total + Poids Net Ticket
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 md:p-6 bg-gray-50 border-t-2 border-gray-300">
          <div className="flex flex-wrap gap-3 justify-center mb-4">
            <button
              onClick={saveToFirebase}
              disabled={loading}
              className="flex items-center gap-2 px-4 md:px-6 py-3 bg-[#1f2a38] text-white rounded hover:bg-[#2a384a] transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 font-semibold"
            >
              <Database size={18} /> {loading ? 'Enregistrement...' : 'Sauvegarder Firebase'}
            </button>

            <button
              onClick={() => loadFromFirebase()}
              disabled={loading}
              className="flex items-center gap-2 px-4 md:px-6 py-3 bg-purple-600 text-white rounded hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 font-semibold"
            >
              <Archive size={18} /> Charger Archives ({archives.length})
            </button>

            <button
              onClick={generatePDF}
              className="flex items-center gap-2 px-4 md:px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
            >
              <FileText size={18} /> Générer PDF
            </button>

            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 md:px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
            >
              <Download size={18} /> Export Excel
            </button>

            <button
              onClick={printForm}
              className="flex items-center gap-2 px-4 md:px-6 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
            >
              <Printer size={18} /> Imprimer
            </button>
          </div>

          <div className="text-center text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-300">
            💡 <strong>Configuration Firebase:</strong> Remplacez "YOUR-PROJECT-ID" dans le code avec votre ID de projet Firebase
          </div>
        </div>

        {/* Archive Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-400">
          <div className="border-b border-gray-400 p-4 md:p-6 bg-gray-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <Archive className="text-gray-600" size={22} />
                <h3 className="text-lg md:text-xl font-semibold text-gray-900">Historique des Réceptions</h3>
                <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm font-medium border border-gray-400">
                  {filteredArchives.length} réception{filteredArchives.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="text"
                    placeholder="Rechercher par bon réception, responsable..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 md:py-3 border border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none w-full bg-white"
                  />
                </div>

                <div className="flex gap-2">
                  {/* Sort Options */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'responsable' | 'bonLivraison')}
                    className="px-3 md:px-4 py-2 md:py-3 border border-gray-400 rounded focus:border-[#1f2a38] focus:ring-2 focus:ring-[#1f2a38]/20 outline-none bg-white"
                  >
                    <option value="date">Trier par Date</option>
                    <option value="responsable">Trier par Responsable</option>
                    <option value="bonLivraison">Trier par Bon Livraison</option>
                  </select>

                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 md:px-4 py-2 md:py-3 border border-gray-400 rounded hover:bg-gray-100 transition-colors bg-white font-semibold"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>

                <button
                  onClick={() => setShowArchive(!showArchive)}
                  className="flex items-center justify-center gap-2 px-4 py-2 md:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold transition-colors border border-gray-400"
                >
                  {showArchive ? 'Masquer' : 'Afficher'} l'historique
                  <ChevronDown size={18} className={`transform transition ${showArchive ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {showArchive && (
            <div className="p-4 md:p-6 bg-gray-50">
              {isLoadingArchives ? (
                <div className="text-center py-8">
                  <RefreshCw className="animate-spin mx-auto text-gray-600" size={32} />
                  <p className="text-gray-600 mt-3">Chargement des réceptions...</p>
                </div>
              ) : filteredArchives.length === 0 ? (
                <div className="text-center py-8">
                  <Archive className="mx-auto text-gray-400" size={48} />
                  <p className="text-gray-600 mt-3">
                    {archives.length === 0 
                      ? "Aucune réception enregistrée dans Firebase. Sauvegardez d'abord une réception." 
                      : "Aucune réception ne correspond à votre recherche."}
                  </p>
                  {archives.length === 0 && (
                    <button
                      onClick={saveToFirebase}
                      className="mt-4 px-6 py-3 bg-[#1f2a38] text-white rounded hover:bg-[#2a384a] transition-colors font-semibold"
                    >
                      Sauvegarder une première réception
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredArchives.map((archived) => (
                    <div
                      key={archived.firebaseId}
                      className="bg-white rounded border border-gray-400 hover:border-[#1f2a38] transition-colors p-4 md:p-6"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                            <h4 className="text-base md:text-lg font-semibold text-gray-900">
                              Bon Réception: {archived.bonReception}
                            </h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${
                              archived.type === 'BIOLOGIQUE' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-blue-100 text-blue-800 border-blue-300'
                            }`}>
                              {archived.type}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium border border-gray-300">
                              {formatDate(archived.dateMatricule)}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Responsable:</span>
                              <span>{archived.responsable || 'Non spécifié'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Bon Livraison:</span>
                              <span className="font-mono bg-gray-100 px-2 py-1 rounded border border-gray-400">
                                {archived.bonLivraison || 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Produit:</span>
                              <span>{archived.produit}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Lignes:</span>
                              <span>{archived.rows.length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Créé le:</span>
                              <span>{formatFirestoreDate(archived.savedAt)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Total Poids Net:</span>
                              <span className="font-semibold">{archived.totals.totalPoids} kg</span>
                            </div>
                          </div>

                          {/* Quick row summary */}
                          <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-400">
                            <div className="text-xs font-semibold text-gray-600 mb-2">RÉSUMÉ DES LIGNES</div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <span className="font-medium">Total Caisses:</span>{' '}
                                {archived.totals.totalCaisses}
                              </div>
                              <div>
                                <span className="font-medium">Total Poids Net:</span>{' '}
                                {archived.totals.totalPoids} kg
                              </div>
                              <div>
                                <span className="font-medium">Poids Ticket:</span>{' '}
                                {archived.totals.poidsTicket} kg
                              </div>
                              <div>
                                <span className="font-medium">Écart:</span>{' '}
                                <span className={
                                  parseFloat(archived.totals.ecart) >= 0
                                    ? 'text-green-700 font-semibold'
                                    : 'text-red-700 font-semibold'
                                }>
                                  {archived.totals.ecart} kg
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => viewArchive(archived)}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm font-semibold"
                          >
                            <Eye size={14} />
                            Consulter
                          </button>
                          <button
                            onClick={() => loadArchive(archived)}
                            className="flex items-center gap-2 px-3 py-2 bg-[#1f2a38] hover:bg-[#2a384a] text-white rounded transition-colors text-sm font-semibold"
                          >
                            <Edit size={14} />
                            Modifier
                          </button>
                          <button
                            onClick={() => duplicateArchive(archived)}
                            className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors text-sm font-semibold"
                          >
                            <FilePlus size={14} />
                            Dupliquer
                          </button>
                          <button
                            onClick={() => archived.firebaseId && deleteArchive(archived.firebaseId)}
                            className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm font-semibold"
                          >
                            <Trash2 size={14} />
                            Supprimer
                          </button>
                        </div>
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

export default SuiviReception;