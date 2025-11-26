import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { FilePlus, RefreshCw, Save, Calculator, Download, Trash2, Archive } from 'lucide-react';
import LOGO from '../../../assets/logo.png';

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
      // Charger depuis le localStorage
      const saved = localStorage.getItem('suivis_dechet_archives');
      if (saved) {
        try { 
          setArchivedSuivis(JSON.parse(saved)); 
        } catch { /* ignore */ }
      }

      // Charger le formulaire courant sauvegardé
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

      // Couleurs industrielles
      const primaryColor = [0, 91, 150]; // Bleu industriel
      const secondaryColor = [200, 16, 46]; // Rouge d'alerte
      const accentColor = [241, 241, 241]; // Gris clair
      const darkColor = [51, 51, 51]; // Gris foncé

      // Fonction pour dessiner l'en-tête avec logo
      const drawHeader = () => {
        // Fond de l'en-tête
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, pageWidth, 35, 'F');
        
        // Logo
        try {
          const img = new Image();
          img.src = LOGO;
          doc.addImage(img, 'PNG', margin, 8, 20, 20);
        } catch (e) {
          console.warn('Logo not available for PDF');
        }
        
        // Titre principal
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text('FICHE SUIVI DÉCHETS INDUSTRIELS', pageWidth / 2, 20, { align: 'center' });
        
        // Informations du document
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(`Code: ${formData.header.code}`, margin + 25, 30);
        doc.text(`Version: ${formData.header.version}`, pageWidth - margin, 30, { align: 'right' });
        
        cursorY = 45;
      };

      // Fonction pour dessiner les informations principales
      const drawMainInfo = () => {
        // Cadre principal
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.roundedRect(margin, cursorY, pageWidth - 2 * margin, 30, 3, 3, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        
        // Ligne 1
        doc.text(`Date de création: ${formData.header.dateCreation}`, margin + 5, cursorY + 8);
        doc.text(`Date de traitement: ${formData.header.dateTraitement}`, pageWidth / 2, cursorY + 8);
        
        // Ligne 2
        doc.text(`Responsable: ${formData.header.responsableTracabilite || 'Non spécifié'}`, margin + 5, cursorY + 16);
        
        // Ligne 3
        doc.text(`Produit: ${formData.header.produit}`, margin + 5, cursorY + 24);
        
        const typeText = [];
        if (formData.header.conventionnel) typeText.push('CONVENTIONNEL');
        if (formData.header.biologique) typeText.push('BIOLOGIQUE');
        
        doc.text(`Type: ${typeText.join(' / ')}`, pageWidth / 2, cursorY + 24);
        
        cursorY += 40;
      };

      // Fonction pour dessiner les totaux
      const drawTotals = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('RÉCAPITULATIF DES TOTAUX:', margin, cursorY);
        cursorY += 8;
        
        const totalsData = [
          { label: 'Nombre de palettes', value: totals.totalPallets, unit: '' },
          { label: 'Total nombre de caisses', value: totals.totalNombreCaisses, unit: '' },
          { label: 'Total poids brut', value: totals.totalPoidsBrut.toFixed(1), unit: 'kg' },
          { label: 'Total poids net', value: totals.totalPoidsNet.toFixed(1), unit: 'kg' }
        ];
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        
        totalsData.forEach(item => {
          doc.text(`${item.label}: ${item.value} ${item.unit}`, margin + 5, cursorY);
          cursorY += 5;
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
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
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
            cellPadding: 2,
            lineColor: [100, 100, 100],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245],
          },
          margin: { left: margin, right: margin },
        });
        
        cursorY = (doc as any).lastAutoTable.finalY + 10;
      };

      // Fonction pour dessiner le pied de page
      const drawFooter = () => {
        const footerY = doc.internal.pageSize.getHeight() - 15;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        
        // Ligne de séparation
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
        
        doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, margin, footerY - 2);
        doc.text('Système de Traçabilité Industrielle - Fiche Suivi Déchets', pageWidth / 2, footerY - 2, { align: 'center' });
        doc.text(`Page 1/1`, pageWidth - margin, footerY - 2, { align: 'right' });
      };

      // Génération du PDF
      drawHeader();
      drawMainInfo();
      drawTotals();
      drawTable();
      drawFooter();

      // Sauvegarder le PDF
      const fileName = `Fiche_Suivi_Dechets_${formData.header.produit}_${formData.header.dateTraitement.replace(/\//g, '-')}.pdf`;
      doc.save(fileName);
      
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('Erreur lors de la génération du PDF. Vérifiez que toutes les données sont valides.');
    }
  };

  return (
    <div className="bg-gradient-to-b from-green-50 to-white min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl">
        <div className="p-6">
          {/* En-tête avec logo et informations */}
          <div className="flex flex-col md:flex-row mb-6 items-center gap-4">
            {/* Logo */}
            <div className="w-20 h-16 bg-green-100 border-2 border-green-300 rounded-lg flex items-center justify-center">
              <img src={LOGO} alt="Logo" className="h-10 w-auto object-contain" />
            </div>

            {/* Titre principal */}
            <div className="flex-1 bg-green-600 text-white flex items-center justify-center rounded-lg py-3">
              <h2 className="text-xl font-bold text-center">Fiche Suivi Déchets Industriels</h2>
            </div>

            {/* Informations du document */}
            <div className="w-full md:w-48 bg-gray-50 border-2 border-gray-300 rounded-lg p-3">
              <div className="text-sm mb-2">
                <span className="font-bold">Code:</span>
                <input
                  type="text"
                  value={formData.header.code}
                  onChange={(e) => updateHeader('code', e.target.value)}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-20"
                />
              </div>
              <div className="text-sm mb-2">
                <span className="font-bold">Date:</span>
                <input
                  type="text"
                  value={formData.header.dateCreation}
                  onChange={(e) => updateHeader('dateCreation', e.target.value)}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-24"
                />
              </div>
              <div className="text-sm">
                <span className="font-bold">Version:</span>
                <input
                  type="text"
                  value={formData.header.version}
                  onChange={(e) => updateHeader('version', e.target.value)}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-8"
                />
              </div>
            </div>
          </div>

          {/* Statut utilisateur */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-800">
                {user ? `Connecté en tant que: ${user.email}` : 'Non connecté - Fonctionnalités locales uniquement'}
              </span>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                {archivedSuivis.filter(a => a.source === 'firebase').length} docs Firebase | 
                {archivedSuivis.filter(a => a.source === 'local').length} docs locaux
              </span>
            </div>
          </div>

          {/* Affichage des totaux */}
          <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-sm font-semibold text-blue-800">Total Pallets</div>
                <div className="text-2xl font-bold text-blue-600">{totals.totalPallets}</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-sm font-semibold text-green-800">Total Caisses</div>
                <div className="text-2xl font-bold text-green-600">{totals.totalNombreCaisses}</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-sm font-semibold text-orange-800">Poids Brut Total</div>
                <div className="text-2xl font-bold text-orange-600">{totals.totalPoidsBrut.toFixed(1)} kg</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-sm font-semibold text-purple-800">Poids Net Total</div>
                <div className="text-2xl font-bold text-purple-600">{totals.totalPoidsNet.toFixed(1)} kg</div>
              </div>
            </div>
          </div>

          {/* Section formulaire */}
          <div className="border-2 border-gray-300 rounded-lg mb-6 overflow-hidden">
            {/* Date et Responsable */}
            <div className="flex flex-col md:flex-row border-b border-gray-300 p-4 bg-gray-50">
              <div className="flex-1 flex items-center mb-2 md:mb-0">
                <span className="font-bold mr-2 min-w-24">Date traitement:</span>
                <input
                  type="text"
                  value={formData.header.dateTraitement}
                  onChange={(e) => updateHeader('dateTraitement', e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 focus:outline-none focus:border-blue-500 flex-1"
                  placeholder="JJ/MM/AAAA"
                />
              </div>
              <div className="flex-1 flex items-center">
                <span className="font-bold mr-2 min-w-40">Responsable Traçabilité:</span>
                <input
                  type="text"
                  value={formData.header.responsableTracabilite}
                  onChange={(e) => updateHeader('responsableTracabilite', e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 focus:outline-none focus:border-blue-500 flex-1"
                  placeholder="Nom du responsable"
                />
              </div>
            </div>

            {/* Produit et Type */}
            <div className="flex flex-col md:flex-row p-4 bg-green-50 items-center">
              <div className="flex-1 flex items-center mb-2 md:mb-0">
                <span className="font-bold mr-2">Produit:</span>
                <input
                  type="text"
                  value={formData.header.produit}
                  onChange={(e) => updateHeader('produit', e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 focus:outline-none focus:border-blue-500 font-bold flex-1"
                />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.header.conventionnel}
                    onChange={(e) => updateHeader('conventionnel', e.target.checked)}
                    className="mr-2 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm font-medium">CONVENTIONNEL</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.header.biologique}
                    onChange={(e) => updateHeader('biologique', e.target.checked)}
                    className="mr-2 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm font-medium">BIOLOGIQUE</span>
                </label>
              </div>
            </div>
          </div>

          {/* Tableau des données */}
          <div className="border-2 border-gray-300 rounded-lg mb-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-green-100 border-b border-gray-300">
                    <th className="p-3 border-r border-gray-300 text-sm font-bold text-center">N° palette</th>
                    <th className="p-3 border-r border-gray-300 text-sm font-bold text-center">Nombre de caisses</th>
                    <th className="p-3 border-r border-gray-300 text-sm font-bold text-center">Poids Brut (kg)</th>
                    <th className="p-3 border-r border-gray-300 text-sm font-bold text-center">Poids Net (kg)</th>
                    <th className="p-3 border-r border-gray-300 text-sm font-bold text-center">Nature de déchet</th>
                    <th className="p-3 text-sm font-bold text-center">Variété</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.rows.map((row: any, index: number) => (
                    <tr key={index} className="border-b border-gray-300 hover:bg-gray-50 transition-colors">
                      <td className="border-r border-gray-300">
                        <input
                          type="text"
                          value={row.numeroPalette}
                          onChange={(e) => updateRow(index, 'numeroPalette', e.target.value)}
                          className="w-full p-3 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                          placeholder={index === 0 ? "1" : "Auto"}
                        />
                      </td>
                      <td className="border-r border-gray-300">
                        <input
                          type="number"
                          step="0.1"
                          value={row.nombreCaisses}
                          onChange={(e) => updateRow(index, 'nombreCaisses', e.target.value)}
                          className="w-full p-3 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                          placeholder="0"
                        />
                      </td>
                      <td className="border-r border-gray-300">
                        <input
                          type="number"
                          step="0.1"
                          value={row.poidsBrut}
                          onChange={(e) => updateRow(index, 'poidsBrut', e.target.value)}
                          className="w-full p-3 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                          placeholder="0.0"
                        />
                      </td>
                      <td className="border-r border-gray-300">
                        <input
                          type="text"
                          value={row.poidsNet}
                          readOnly
                          className="w-full p-3 border-0 text-sm text-center bg-gray-100 text-gray-600"
                          placeholder="Auto-calculé"
                        />
                      </td>
                      <td className="border-r border-gray-300">
                        <select
                          value={row.natureDechet}
                          onChange={(e) => updateRow(index, 'natureDechet', e.target.value)}
                          className="w-full p-3 border-0 text-sm text-center focus:outline-none focus:bg-blue-50 cursor-pointer bg-white"
                          disabled={!row.numeroPalette}
                        >
                          <option value="">— Sélectionner —</option>
                          <option value="D,MACHINE">D,MACHINE</option>
                          <option value="MALO">MALO</option>
                          <option value="petit calibre">petit calibre</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.variete}
                          onChange={(e) => updateRow(index, 'variete', e.target.value)}
                          className="w-full p-3 border-0 text-sm text-center focus:outline-none focus:bg-blue-50 cursor-pointer bg-white"
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

          {/* Actions principales */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={generatePDF}
              disabled={isLoading}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={20} /> 
              {isLoading ? 'Génération...' : 'Générer PDF'}
            </button>
            <button
              onClick={saveToFirebase}
              disabled={isLoading || !auth.currentUser}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={20} /> 
              {isLoading ? 'Sauvegarde...' : 'Enregistrer (Firebase)'}
            </button>
            <button
              onClick={calculateAllPoidsNets}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md"
            >
              <Calculator size={20} /> Calculer Poids Nets
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-all shadow-md"
            >
              <RefreshCw size={20} /> Réinitialiser
            </button>
            <button
              onClick={archiveCurrent}
              className="flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-lg hover:bg-amber-600 transition-all shadow-md"
            >
              <Archive size={20} /> Archiver Local
            </button>
          </div>

          {/* Information sur le calcul */}
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm text-yellow-800">
              <strong>Formule de calcul automatique :</strong> Poids Net = Poids Brut - (Nombre de Caisses × 2.8 kg + 15 kg tare palette)
            </div>
          </div>

          {/* Archives */}
          <div className="border-2 border-gray-300 rounded-lg p-4">
            <div className="flex flex-col md:flex-row items-center justify-between mb-4">
              <h3 className="text-lg font-semibold mb-2 md:mb-0">Suivis Archivés ({archivedSuivis.length})</h3>
              <div className="flex gap-2">
                <button 
                  onClick={syncArchivesFromFirebase} 
                  disabled={isLoading || !auth.currentUser}
                  className="flex items-center gap-2 text-sm bg-sky-600 text-white px-3 py-2 rounded hover:bg-sky-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={16} />
                  {isLoading ? 'Synchronisation...' : 'Sync Firebase'}
                </button>
              </div>
            </div>
            
            {archivedSuivis.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Aucun suivi archivé pour le moment
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {archivedSuivis.map(archive => (
                  <div key={archive.id} className="p-4 border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {archive.header.produit} - {new Date(archive.archivedAt).toLocaleDateString('fr-FR')}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            archive.source === 'firebase' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {archive.source === 'firebase' ? '☁️ Firebase' : '💾 Local'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Traité le: {archive.header.dateTraitement} | 
                          Responsable: {archive.header.responsableTracabilite || 'Non spécifié'}
                        </div>
                        <div className="text-xs text-blue-600 mt-2">
                          📦 Pallets: {archive.totals?.totalPallets || 'N/A'} | 
                          📋 Caisses: {archive.totals?.totalNombreCaisses || 'N/A'} | 
                          ⚖️ Brut: {archive.totals?.totalPoidsBrut ? archive.totals.totalPoidsBrut.toFixed(1) : 'N/A'}kg | 
                          📊 Net: {archive.totals?.totalPoidsNet ? archive.totals.totalPoidsNet.toFixed(1) : 'N/A'}kg
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 md:mt-0">
                        <button 
                          onClick={() => restoreArchive(archive.id)}
                          className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition-all"
                        >
                          <RefreshCw size={14} /> Restaurer
                        </button>
                        <button 
                          onClick={() => deleteArchive(archive.id)}
                          className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-600 text-sm rounded border border-red-200 hover:bg-red-200 transition-all"
                        >
                          <Trash2 size={14} /> Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuiviDechets;