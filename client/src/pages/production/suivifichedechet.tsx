import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  FilePlus, 
  RefreshCw, 
  Save, 
  Calculator, 
  Download, 
  Trash2, 
  Archive, 
  Factory,
  Palette,
  Scale,
  Package,
  AlertTriangle,
  Database,
  User,
  Calendar,
  FileText,
  BarChart3,
  History,
  Settings,
  Cloud,
  HardDrive
} from 'lucide-react';
import LOGO from '../../../assets/logo.png';

// Color constants matching your industrial theme
const PRIMARY_COLOR = [31, 42, 56]; // rgb(31, 42, 56) - Dark blue/gray
const SECONDARY_COLOR = [16, 185, 129]; // Emerald green
const ACCENT_COLOR = [59, 130, 246]; // Blue for actions
const WARNING_COLOR = [245, 158, 11]; // Amber
const DANGER_COLOR = [239, 68, 68]; // Red
const SUCCESS_COLOR = [16, 185, 129]; // Green
const LIGHT_BG = [249, 250, 251]; // Light gray
const BORDER_COLOR = [229, 231, 235]; // Border gray

const defaultForm = {
  header: {
    code: 'F.S.D',
    dateCreation: new Date().toLocaleDateString('fr-FR'),
    version: '00',
    dateTraitement: new Date().toLocaleDateString('fr-FR'),
    responsableTracabilite: '',
    produit: 'AVOCAT',
    conventionnel: true,
    biologique: false,
  },
  rows: Array.from({ length: 20 }, () => ({
    numeroPalette: '',
    nombreCaisses: '',
    poidsBrut: '',
    poidsNet: '',
    natureDechet: '',
    variete: ''
  }))
};

// Constantes pour les calculs
const POIDS_CAISSE = 2.8; // kg
const TARE_PALETTE = 15; // kg (poids moyen d'une palette vide)

const SuiviDechets: React.FC = () => {
  const [formData, setFormData] = useState<any>(defaultForm);
  const [archivedSuivis, setArchivedSuivis] = useState<any[]>([]);
  const [totals, setTotals] = useState({
    totalPoidsBrut: 0,
    totalPoidsNet: 0,
    totalNombreCaisses: 0,
    totalPallets: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'archive'>('form');

  // Calculer les totaux automatiquement
  useEffect(() => {
    const calculatedTotals = formData.rows.reduce((acc: any, row: any) => {
      if (row.numeroPalette && row.numeroPalette.trim() !== '') {
        acc.totalPallets++;
      }
      
      const nbCaisses = parseFloat(row.nombreCaisses) || 0;
      const poidsBrut = parseFloat(row.poidsBrut) || 0;
      const poidsNet = parseFloat(row.poidsNet) || 0;
      
      acc.totalNombreCaisses += nbCaisses;
      acc.totalPoidsBrut += poidsBrut;
      acc.totalPoidsNet += poidsNet;
      
      return acc;
    }, {
      totalPoidsBrut: 0,
      totalPoidsNet: 0,
      totalNombreCaisses: 0,
      totalPallets: 0
    });

    setTotals(calculatedTotals);
  }, [formData.rows]);

  // Charger les données au démarrage
  useEffect(() => {
    const loadInitialData = async () => {
      const saved = localStorage.getItem('suivis_dechet_archives');
      if (saved) {
        try { 
          setArchivedSuivis(JSON.parse(saved)); 
        } catch { /* ignore */ }
      }

      const currentSaved = localStorage.getItem('suivi_dechet_current');
      if (currentSaved) {
        try {
          setFormData(JSON.parse(currentSaved));
        } catch { /* ignore */ }
      }
    };

    loadInitialData();

    // Écouter les changements d'authentification pour Firebase
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (!user) return;
      
      try {
        setIsLoading(true);
        const col = collection(db, 'suivis_dechet');
        const q = query(col, where('createdBy', '==', user.uid), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const remote = snap.docs.map(d => ({ 
          id: d.id, 
          ...(d.data() as any),
          archivedAt: d.data().archivedAt?.toDate?.()?.toISOString() || 
                     d.data().createdAt?.toDate?.()?.toISOString() || 
                     new Date().toISOString()
        }));
        
        setArchivedSuivis(prev => {
          const ids = new Set(prev.map(a => a.id));
          const merged = [...prev, ...remote.filter(r => !ids.has(r.id))];
          try { 
            localStorage.setItem('suivis_dechet_archives', JSON.stringify(merged)); 
          } catch {}
          return merged as any[];
        });
      } catch (e) {
        console.warn('Could not load remote archives', e);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Sauvegarder les archives dans localStorage quand elles changent
  useEffect(() => {
    localStorage.setItem('suivis_dechet_archives', JSON.stringify(archivedSuivis));
  }, [archivedSuivis]);

  // Sauvegarder le formulaire courant
  useEffect(() => {
    localStorage.setItem('suivi_dechet_current', JSON.stringify(formData));
  }, [formData]);

  const updateHeader = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, header: { ...prev.header, [field]: value } }));
  };

  // Fonction pour calculer automatiquement le poids net
  const calculatePoidsNet = (nombreCaisses: string, poidsBrut: string): string => {
    const nbCaisses = parseFloat(nombreCaisses) || 0;
    const pBrut = parseFloat(poidsBrut) || 0;
    
    if (nbCaisses > 0 && pBrut > 0) {
      const poidsNet = pBrut - (nbCaisses * POIDS_CAISSE + TARE_PALETTE);
      return Math.max(0, poidsNet).toFixed(1);
    }
    return '';
  };

  // Fonction pour générer automatiquement le numéro de palette
  const getAutoPaletteNumber = (currentIndex: number): string => {
    const existingNumbers = formData.rows
      .map((row: any) => {
        const num = parseInt(row.numeroPalette);
        return isNaN(num) ? 0 : num;
      })
      .filter(num => num > 0);
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return (maxNumber + 1).toString();
  };

  const updateRow = (index: number, field: string, value: any) => {
    setFormData((prev: any) => {
      const rows = prev.rows.map((row: any, i: number) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };

        // Numéro de palette auto-incrémenté
        if (field === 'numeroPalette' && value === '' && i > 0) {
          const prevRow = prev.rows[i - 1];
          if (prevRow.numeroPalette && prevRow.numeroPalette.trim() !== '') {
            updated.numeroPalette = getAutoPaletteNumber(i);
          }
        }

        // Calcul automatique du poids net quand nombre de caisses ou poids brut change
        if ((field === 'nombreCaisses' || field === 'poidsBrut') && updated.numeroPalette) {
          const poidsNetCalcule = calculatePoidsNet(
            field === 'nombreCaisses' ? value : updated.nombreCaisses,
            field === 'poidsBrut' ? value : updated.poidsBrut
          );
          updated.poidsNet = poidsNetCalcule;
        }

        // Définir les valeurs par défaut quand une palette est saisie
        if (field === 'numeroPalette' && value.trim() !== '') {
          if (!updated.natureDechet) updated.natureDechet = 'D,MACHINE';
          if (!updated.variete) updated.variete = 'HASS';
          
          // Auto-incrémentation du numéro de palette pour les lignes suivantes
          if (i < prev.rows.length - 1) {
            const nextRow = prev.rows[i + 1];
            if (!nextRow.numeroPalette || nextRow.numeroPalette.trim() === '') {
              setTimeout(() => {
                updateRow(i + 1, 'numeroPalette', getAutoPaletteNumber(i + 1));
              }, 100);
            }
          }
        }

        // Vider les champs dépendants si la palette est vidée
        if (field === 'numeroPalette' && value.trim() === '') {
          updated.natureDechet = '';
          updated.variete = '';
          updated.nombreCaisses = '';
          updated.poidsBrut = '';
          updated.poidsNet = '';
        }

        return updated;
      });
      return { ...prev, rows };
    });
  };

  // Fonction pour calculer automatiquement tous les poids nets
  const calculateAllPoidsNets = () => {
    setFormData((prev: any) => {
      const rows = prev.rows.map((row: any) => {
        if (!row.numeroPalette || row.numeroPalette.trim() === '') {
          return row;
        }
        
        const poidsNetCalcule = calculatePoidsNet(row.nombreCaisses, row.poidsBrut);
        return {
          ...row,
          poidsNet: poidsNetCalcule
        };
      });
      return { ...prev, rows };
    });
    alert('Tous les poids nets ont été calculés automatiquement');
  };

  const resetForm = () => {
    if (window.confirm('Êtes-vous sûr de vouloir réinitialiser le formulaire ? Toutes les données non sauvegardées seront perdues.')) {
      setFormData(defaultForm);
      localStorage.removeItem('suivi_dechet_current');
    }
  };

  const archiveCurrent = async () => {
    if (!formData.rows.some((row: any) => row.numeroPalette && row.numeroPalette.trim() !== '')) {
      alert('Veuillez saisir au moins une palette avant d\'archiver.');
      return;
    }

    const temp = {
      id: `arch-${Date.now()}`,
      header: { ...formData.header },
      rows: formData.rows.filter((r: any) => r.numeroPalette && r.numeroPalette.trim() !== ''),
      totals: { ...totals },
      archivedAt: new Date().toISOString(),
      source: 'local'
    };
    
    setArchivedSuivis(prev => {
      const next = [temp, ...prev];
      try { localStorage.setItem('suivis_dechet_archives', JSON.stringify(next)); } catch {}
      return next;
    });
    
    resetForm();
    alert('Suivi archivé localement avec succès');

    // Sauvegarder dans Firebase si authentifié
    if (auth.currentUser) {
      try {
        const payload = { 
          header: temp.header, 
          rows: temp.rows, 
          totals: temp.totals,
          archivedAt: serverTimestamp(), 
          createdBy: auth.currentUser.uid, 
          createdAt: serverTimestamp(),
          source: 'firebase'
        };
        const col = collection(db, 'suivis_dechet');
        const docRef = await addDoc(col, payload as any);
        
        // Remplacer l'ID temporaire par l'ID Firebase
        setArchivedSuivis(prev => {
          const mapped = prev.map(a => (a.archivedAt === temp.archivedAt ? { ...a, id: docRef.id, source: 'firebase' } : a));
          try { localStorage.setItem('suivis_dechet_archives', JSON.stringify(mapped)); } catch {}
          return mapped;
        });
        
        alert('Suivi également sauvegardé sur Firebase');
      } catch (err) {
        console.warn('Failed to save archive to Firebase', err);
        alert('Archivage local réussi, mais échec de la sauvegarde Firebase');
      }
    }
  };

  const saveToFirebase = async () => {
    if (!auth.currentUser) {
      alert('Veuillez vous connecter pour sauvegarder sur Firebase');
      return;
    }

    if (!formData.rows.some((row: any) => row.numeroPalette && row.numeroPalette.trim() !== '')) {
      alert('Veuillez saisir au moins une palette avant de sauvegarder.');
      return;
    }

    try {
      setIsLoading(true);
      const payload = {
        header: formData.header,
        rows: formData.rows.filter((r: any) => r.numeroPalette && r.numeroPalette.trim() !== ''),
        totals: totals,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        source: 'firebase'
      };
      
      const col = collection(db, 'suivis_dechet');
      const docRef = await addDoc(col, payload as any);
      
      const archived = { 
        id: docRef.id, 
        header: { ...formData.header }, 
        rows: formData.rows.filter((r: any) => r.numeroPalette && r.numeroPalette.trim() !== ''), 
        totals: { ...totals },
        archivedAt: new Date().toISOString(),
        source: 'firebase'
      };
      
      setArchivedSuivis(prev => [archived, ...prev]);
      resetForm();
      alert('Suivi enregistré sur Firebase avec succès');
    } catch (err) {
      console.error('Firebase save failed', err);
      alert('Enregistrement Firebase impossible — sauvegarde locale effectuée');
      archiveCurrent();
    } finally {
      setIsLoading(false);
    }
  };

  const syncArchivesFromFirebase = async () => {
    if (!auth.currentUser) {
      alert('Veuillez vous connecter pour synchroniser avec Firebase');
      return;
    }

    try {
      setIsLoading(true);
      const col = collection(db, 'suivis_dechet');
      const q = query(col, where('createdBy', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const remote = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        archivedAt: d.data().archivedAt?.toDate?.()?.toISOString() || 
                   d.data().createdAt?.toDate?.()?.toISOString() || 
                   new Date().toISOString(),
        source: 'firebase'
      }));
      
      setArchivedSuivis(remote as any[]);
      alert(`${remote.length} archives synchronisées depuis Firebase avec succès`);
    } catch (err) {
      console.error('Sync from Firebase failed', err);
      alert('Impossible de synchroniser depuis Firebase');
    } finally {
      setIsLoading(false);
    }
  };

  const restoreArchive = async (id: string) => {
    const item = archivedSuivis.find(a => a.id === id);
    if (!item) return;
    
    // Reconstituer le formulaire avec 20 lignes
    const restoredRows = [...item.rows];
    while (restoredRows.length < 20) {
      restoredRows.push({
        numeroPalette: '',
        nombreCaisses: '',
        poidsBrut: '',
        poidsNet: '',
        natureDechet: '',
        variete: ''
      });
    }
    
    setFormData({ 
      header: { ...item.header }, 
      rows: restoredRows 
    });
    setActiveTab('form');
    
    // Supprimer de la liste locale
    setArchivedSuivis(prev => {
      const next = prev.filter(a => a.id !== id);
      try { localStorage.setItem('suivis_dechet_archives', JSON.stringify(next)); } catch {}
      return next;
    });
    
    // Si c'est un document Firebase, le supprimer aussi
    if (id && !id.startsWith('arch-')) {
      try {
        await deleteDoc(doc(db, 'suivis_dechet', id));
      } catch (e) {
        console.warn('Failed to delete remote archive after restore', e);
      }
    }
    
    alert('Suivi restauré avec succès');
  };

  const deleteArchive = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cet archivage ?')) return;
    
    // Si c'est un document Firebase, le supprimer de Firebase
    if (id && !id.startsWith('arch-')) {
      try {
        await deleteDoc(doc(db, 'suivis_dechet', id));
      } catch (e) {
        console.warn('Failed to delete remote archive', e);
        alert('Impossible de supprimer depuis Firebase');
        return;
      }
    }
    
    // Supprimer de la liste locale
    setArchivedSuivis(prev => {
      const next = prev.filter(a => a.id !== id);
      try { localStorage.setItem('suivis_dechet_archives', JSON.stringify(next)); } catch {}
      return next;
    });
    
    alert('Archive supprimée avec succès');
  };

  // Fonction generatePDF professionnelle et industrielle
  const generatePDF = async () => {
    if (!formData.rows.some((row: any) => row.numeroPalette && row.numeroPalette.trim() !== '')) {
      alert('Veuillez saisir au moins une palette avant de générer le PDF.');
      return;
    }

    try {
      // Charger jsPDF dynamiquement
      const jsPDFModule = await import('jspdf');
      const jsPDF = (jsPDFModule as any).default || jsPDFModule;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = (autoTableModule as any).default || autoTableModule;
      
      // Configuration du document
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let cursorY = margin;

      // Fonction pour dessiner l'en-tête avec logo
      const drawHeader = () => {
        // Fond de l'en-tête
        doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        // Logo
        try {
          const img = new Image();
          img.src = LOGO;
          doc.addImage(img, 'PNG', margin, 8, 24, 24);
        } catch (e) {
          // Fallback si logo non disponible
          doc.setFillColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
          doc.roundedRect(margin, 8, 24, 24, 3, 3, 'F');
          doc.setFontSize(14);
          doc.setTextColor(255, 255, 255);
          doc.text('FFY', margin + 12, 22, { align: 'center' });
        }
        
        // Titre principal
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text('FICHE SUIVI DÉCHETS INDUSTRIELS', pageWidth / 2, 20, { align: 'center' });
        
        // Informations du document
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(`Document: ${formData.header.code}`, margin + 30, 32);
        doc.text(`Version: ${formData.header.version}`, pageWidth - margin, 32, { align: 'right' });
        
        cursorY = 50;
      };

      // Fonction pour dessiner les informations principales
      const drawMainInfo = () => {
        // Cadre principal
        doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
        doc.roundedRect(margin, cursorY, pageWidth - 2 * margin, 35, 3, 3, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        
        // Ligne 1
        doc.text(`Date de création: ${formData.header.dateCreation}`, margin + 5, cursorY + 10);
        doc.text(`Date de traitement: ${formData.header.dateTraitement}`, pageWidth / 2, cursorY + 10);
        
        // Ligne 2
        doc.text(`Responsable traçabilité: ${formData.header.responsableTracabilite || 'Non spécifié'}`, margin + 5, cursorY + 18);
        
        // Ligne 3
        doc.text(`Produit: ${formData.header.produit}`, margin + 5, cursorY + 26);
        
        const typeText = [];
        if (formData.header.conventionnel) typeText.push('CONVENTIONNEL');
        if (formData.header.biologique) typeText.push('BIOLOGIQUE');
        
        doc.text(`Type: ${typeText.join(' / ')}`, pageWidth / 2, cursorY + 26);
        
        cursorY += 45;
      };

      // Fonction pour dessiner les totaux
      const drawTotals = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.text('SYNTHÈSE DES TOTAUX:', margin, cursorY);
        cursorY += 10;
        
        const totalsData = [
          { label: 'Nombre total de palettes', value: totals.totalPallets, unit: '', icon: '📦' },
          { label: 'Total nombre de caisses', value: totals.totalNombreCaisses, unit: '', icon: '📋' },
          { label: 'Total poids brut', value: totals.totalPoidsBrut.toFixed(1), unit: 'kg', icon: '⚖️' },
          { label: 'Total poids net', value: totals.totalPoidsNet.toFixed(1), unit: 'kg', icon: '📊' }
        ];
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        
        totalsData.forEach((item, idx) => {
          doc.setTextColor(100, 100, 100);
          doc.text(`${item.icon} ${item.label}:`, margin + 5, cursorY);
          doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
          doc.text(`${item.value} ${item.unit}`, pageWidth - margin - 20, cursorY, { align: 'right' });
          cursorY += 6;
        });
        
        cursorY += 10;
      };

      // Fonction pour dessiner le tableau avec autoTable
      const drawTable = () => {
        const headers = [
          'N° Palette', 
          'Nb Caisses', 
          'Poids Brut (kg)', 
          'Poids Net (kg)', 
          'Nature Déchet', 
          'Variété'
        ];
        
        const rows = formData.rows
          .filter((row: any) => row.numeroPalette && row.numeroPalette.trim() !== '')
          .map((row: any) => [
            row.numeroPalette,
            row.nombreCaisses || '0',
            row.poidsBrut ? `${parseFloat(row.poidsBrut).toFixed(1)}` : '0.0',
            row.poidsNet ? `${parseFloat(row.poidsNet).toFixed(1)}` : '0.0',
            row.natureDechet || '-',
            row.variete || '-'
          ]);
        
        if (rows.length === 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(10);
          doc.setTextColor(WARNING_COLOR[0], WARNING_COLOR[1], WARNING_COLOR[2]);
          doc.text('Aucune donnée de palette à afficher', margin, cursorY);
          cursorY += 10;
          return;
        }

        autoTable(doc, {
          startY: cursorY,
          head: [headers],
          body: rows,
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: 3,
            lineColor: [BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]],
            lineWidth: 0.3,
            textColor: [PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]]
          },
          headStyles: {
            fillColor: [PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
          },
          alternateRowStyles: {
            fillColor: [LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]],
          },
          margin: { left: margin, right: margin },
        });
        
        cursorY = (doc as any).lastAutoTable.finalY + 15;
      };

      // Fonction pour dessiner le pied de page
      const drawFooter = () => {
        const footerY = doc.internal.pageSize.getHeight() - 20;
        
        // Ligne de séparation
        doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        doc.line(margin, footerY - 12, pageWidth - margin, footerY - 12);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        
        // Informations de bas de page
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, margin, footerY - 4);
        doc.text('Système de Traçabilité Industrielle - Fruits For You', pageWidth / 2, footerY - 4, { align: 'center' });
        doc.text('Page 1/1', pageWidth - margin, footerY - 4, { align: 'right' });
      };

      // Génération du PDF
      drawHeader();
      drawMainInfo();
      drawTotals();
      drawTable();
      drawFooter();

      // Sauvegarder le PDF
      const fileName = `FFY_Suivi_Dechets_${formData.header.produit}_${formData.header.dateTraitement.replace(/\//g, '-')}.pdf`;
      doc.save(fileName);
      
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('Erreur lors de la génération du PDF. Vérifiez que toutes les données sont valides.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div 
                  className="h-12 w-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `rgb(${PRIMARY_COLOR.join(',')})` }}
                >
                  <Factory className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Suivi Déchets Industriels</h1>
                <p className="text-sm text-gray-600">Système de Traçabilité & Archivage</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {new Date().toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.email || 'Connectez-vous'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1">
            {[
              { id: 'form', label: 'Formulaire', icon: FileText },
              { id: 'archive', label: 'Archives', icon: Archive },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center space-x-3 py-4 px-6 text-sm font-medium transition-all duration-200
                  ${activeTab === tab.id 
                    ? `text-white border-b-2` 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
                style={activeTab === tab.id ? { 
                  backgroundColor: `rgb(${PRIMARY_COLOR.join(',')})`,
                  borderBottomColor: `rgb(${SECONDARY_COLOR.join(',')})`
                } : {}}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'form' ? (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <Factory className="h-6 w-6" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} />
                    Formulaire de Suivi des Déchets
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Saisissez les données de palettes de déchets pour générer le rapport officiel
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${user ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span>{user ? 'Connecté à la base de données' : 'Mode hors ligne'}</span>
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <HardDrive className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Local: {archivedSuivis.filter(a => a.source === 'local').length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Cloud className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-600">Firebase: {archivedSuivis.filter(a => a.source === 'firebase').length}</span>
                  </div>
                </div>
                <div className="flex-1"></div>
                <div className="text-xs text-gray-500">
                  Données sauvegardées automatiquement
                </div>
              </div>
            </div>

            {/* Header Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Document Info */}
              <div className="border-b border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <FileText className="h-5 w-5" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Code Document</label>
                      <input
                        type="text"
                        value={formData.header.code}
                        onChange={(e) => updateHeader('code', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ 
                          borderColor: `rgb(${BORDER_COLOR.join(',')})`,
                          focusRingColor: `rgb(${PRIMARY_COLOR.join(',')})`
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Calendar className="h-5 w-5" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date Traitement</label>
                      <input
                        type="text"
                        value={formData.header.dateTraitement}
                        onChange={(e) => updateHeader('dateTraitement', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:border-transparent"
                        placeholder="JJ/MM/AAAA"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <User className="h-5 w-5" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Responsable Traçabilité</label>
                      <input
                        type="text"
                        value={formData.header.responsableTracabilite}
                        onChange={(e) => updateHeader('responsableTracabilite', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:border-transparent"
                        placeholder="Nom du responsable"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Package className="h-5 w-5" style={{ color: `rgb(${SECONDARY_COLOR.join(',')})` }} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Produit</label>
                      <input
                        type="text"
                        value={formData.header.produit}
                        onChange={(e) => updateHeader('produit', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:border-transparent font-medium"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.header.conventionnel}
                        onChange={(e) => updateHeader('conventionnel', e.target.checked)}
                        className="w-4 h-4 border-gray-300 rounded focus:ring-2 focus:ring-offset-0 cursor-pointer"
                        style={{ 
                          focusRingColor: `rgb(${PRIMARY_COLOR.join(',')})`
                        }}
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">CONVENTIONNEL</span>
                    </label>
                    
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.header.biologique}
                        onChange={(e) => updateHeader('biologique', e.target.checked)}
                        className="w-4 h-4 border-gray-300 rounded focus:ring-2 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">BIOLOGIQUE</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Totals Display */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} />
                Synthèse des Totaux
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Palette className="h-4 w-4" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} />
                    <div className="text-sm font-medium text-gray-600">Total Pallets</div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }}>
                    {totals.totalPallets}
                  </div>
                </div>
                
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4" style={{ color: `rgb(${SECONDARY_COLOR.join(',')})` }} />
                    <div className="text-sm font-medium text-gray-600">Total Caisses</div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: `rgb(${SECONDARY_COLOR.join(',')})` }}>
                    {totals.totalNombreCaisses}
                  </div>
                </div>
                
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="h-4 w-4" style={{ color: `rgb(${WARNING_COLOR.join(',')})` }} />
                    <div className="text-sm font-medium text-gray-600">Poids Brut Total</div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: `rgb(${WARNING_COLOR.join(',')})` }}>
                    {totals.totalPoidsBrut.toFixed(1)} <span className="text-sm">kg</span>
                  </div>
                </div>
                
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="h-4 w-4" style={{ color: `rgb(${SUCCESS_COLOR.join(',')})` }} />
                    <div className="text-sm font-medium text-gray-600">Poids Net Total</div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: `rgb(${SUCCESS_COLOR.join(',')})` }}>
                    {totals.totalPoidsNet.toFixed(1)} <span className="text-sm">kg</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        <div className="flex items-center gap-2">
                          <Palette className="h-4 w-4" />
                          N° Palette
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Nombre de caisses
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        <div className="flex items-center gap-2">
                          <Scale className="h-4 w-4" />
                          Poids Brut (kg)
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        <div className="flex items-center gap-2">
                          <Scale className="h-4 w-4" />
                          Poids Net (kg)
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Nature de déchet
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Variété
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {formData.rows.map((row: any, index: number) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-3">
                          <input
                            type="text"
                            value={row.numeroPalette}
                            onChange={(e) => updateRow(index, 'numeroPalette', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                            placeholder={index === 0 ? "1" : "Auto"}
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            type="number"
                            step="0.1"
                            value={row.nombreCaisses}
                            onChange={(e) => updateRow(index, 'nombreCaisses', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:border-transparent text-right"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            type="number"
                            step="0.1"
                            value={row.poidsBrut}
                            onChange={(e) => updateRow(index, 'poidsBrut', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:border-transparent text-right"
                            placeholder="0.0"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            type="text"
                            value={row.poidsNet}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-100 text-gray-600 text-right"
                            placeholder="Auto-calculé"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <select
                            value={row.natureDechet}
                            onChange={(e) => updateRow(index, 'natureDechet', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                            disabled={!row.numeroPalette}
                          >
                            <option value="">— Sélectionner —</option>
                            <option value="D,MACHINE">D,MACHINE</option>
                            <option value="MALO">MALO</option>
                            <option value="petit calibre">petit calibre</option>
                          </select>
                        </td>
                        <td className="px-6 py-3">
                          <select
                            value={row.variete}
                            onChange={(e) => updateRow(index, 'variete', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                            disabled={!row.numeroPalette}
                          >
                            <option value="">— Sélectionner —</option>
                            <option value="HASS">HASS</option>
                            <option value="ZUTANO">ZUTANO</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={generatePDF}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 rounded font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: `rgb(${SECONDARY_COLOR.join(',')})`,
                    color: 'white'
                  }}
                >
                  <Download className="h-5 w-5" />
                  {isLoading ? 'Génération...' : 'Générer PDF'}
                </button>
                
                <button
                  onClick={saveToFirebase}
                  disabled={isLoading || !auth.currentUser}
                  className="flex items-center gap-2 px-6 py-3 rounded font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: `rgb(${PRIMARY_COLOR.join(',')})`,
                    color: 'white'
                  }}
                >
                  <Save className="h-5 w-5" />
                  {isLoading ? 'Sauvegarde...' : 'Enregistrer (Firebase)'}
                </button>
                
                <button
                  onClick={calculateAllPoidsNets}
                  className="flex items-center gap-2 px-6 py-3 rounded font-medium transition-all hover:opacity-90"
                  style={{ 
                    backgroundColor: `rgb(${ACCENT_COLOR.join(',')})`,
                    color: 'white'
                  }}
                >
                  <Calculator className="h-5 w-5" />
                  Calculer Tous les Poids Nets
                </button>
                
                <button
                  onClick={archiveCurrent}
                  className="flex items-center gap-2 px-6 py-3 rounded font-medium transition-all hover:opacity-90"
                  style={{ 
                    backgroundColor: `rgb(${WARNING_COLOR.join(',')})`,
                    color: 'white'
                  }}
                >
                  <Archive className="h-5 w-5" />
                  Archiver Local
                </button>
                
                <button
                  onClick={resetForm}
                  className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded font-medium transition-all hover:bg-gray-50"
                >
                  <RefreshCw className="h-5 w-5" />
                  Réinitialiser
                </button>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="text-sm text-yellow-800">
                  <strong>Calcul automatique :</strong> Poids Net = Poids Brut - (Nombre de Caisses × 2.8 kg + 15 kg tare palette)
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Archives Tab */
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <Archive className="h-6 w-6" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} />
                    Archives des Suivis
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Consultez et gérez l'historique complet des suivis de déchets
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={syncArchivesFromFirebase}
                    disabled={isLoading || !auth.currentUser}
                    className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      backgroundColor: `rgb(${ACCENT_COLOR.join(',')})`,
                      color: 'white'
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {isLoading ? 'Synchronisation...' : 'Synchroniser Firebase'}
                  </button>
                  <div className="text-sm px-3 py-1 bg-gray-100 rounded-full">
                    <span className="font-medium" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }}>
                      {archivedSuivis.length} document{archivedSuivis.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center">
                    <svg className="animate-spin h-8 w-8" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">Chargement des archives</h3>
                  <p className="mt-2 text-gray-600">Récupération des données archivées...</p>
                </div>
              ) : archivedSuivis.length === 0 ? (
                <div className="text-center py-12">
                  <Archive className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">Aucun suivi archivé</h3>
                  <p className="mt-2 text-gray-600">
                    Créez et archivez un premier suivi pour le voir apparaître ici
                  </p>
                  <button
                    onClick={() => setActiveTab('form')}
                    className="mt-6 px-6 py-2 rounded font-medium transition-all hover:opacity-90"
                    style={{ 
                      backgroundColor: `rgb(${PRIMARY_COLOR.join(',')})`,
                      color: 'white'
                    }}
                  >
                    Créer un Suivi
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {archivedSuivis.map((archive, index) => (
                    <div key={archive.id} className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white">
                      <div className="p-4">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold text-gray-900">
                                  {archive.header.produit}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  archive.source === 'firebase' 
                                    ? 'bg-green-100 text-green-800 border border-green-200' 
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}>
                                  {archive.source === 'firebase' ? '☁️ Firebase' : '💾 Local'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {new Date(archive.archivedAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <div className="text-gray-600">Document</div>
                                <div className="font-medium">{archive.header.code}</div>
                              </div>
                              <div>
                                <div className="text-gray-600">Traitement</div>
                                <div className="font-medium">{archive.header.dateTraitement}</div>
                              </div>
                              <div>
                                <div className="text-gray-600">Responsable</div>
                                <div className="font-medium">{archive.header.responsableTracabilite || '—'}</div>
                              </div>
                              <div>
                                <div className="text-gray-600">Version</div>
                                <div className="font-medium">{archive.header.version}</div>
                              </div>
                            </div>
                            
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Palette className="h-4 w-4 text-gray-400" />
                                <span>{archive.totals?.totalPallets || 0} pallets</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-gray-400" />
                                <span>{archive.totals?.totalNombreCaisses || 0} caisses</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Scale className="h-4 w-4 text-gray-400" />
                                <span>{archive.totals?.totalPoidsBrut?.toFixed(1) || '0.0'} kg brut</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Scale className="h-4 w-4 text-gray-400" />
                                <span>{archive.totals?.totalPoidsNet?.toFixed(1) || '0.0'} kg net</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => restoreArchive(archive.id)}
                              className="flex items-center gap-1 px-4 py-2 rounded text-sm font-medium transition-all hover:opacity-90"
                              style={{ 
                                backgroundColor: `rgb(${SECONDARY_COLOR.join(',')})`,
                                color: 'white'
                              }}
                            >
                              <RefreshCw className="h-4 w-4" />
                              Restaurer
                            </button>
                            <button
                              onClick={() => deleteArchive(archive.id)}
                              className="flex items-center gap-1 px-4 py-2 border border-red-200 text-red-600 bg-red-50 rounded text-sm font-medium transition-all hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              © {new Date().getFullYear()} Système de Suivi des Déchets. Fruits For You.
            </div>
            <div className="text-xs text-gray-400">
              Version 2.0 • Conçu pour l'industrie
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SuiviDechets;