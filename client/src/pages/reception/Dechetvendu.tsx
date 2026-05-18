import React, { useState, useEffect, useRef } from 'react';
import { Download, Printer, Archive, Plus, Trash2, Search, Filter, Save, Edit2, CheckCircle, AlertCircle, Calendar, TrendingUp, Package, DollarSign, Users, FolderOpen, History, X, Upload, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc, where, writeBatch, setDoc, getDoc } from 'firebase/firestore';

export default function AvocadoSalesTracker() {
  // Color constants
  const COLORS = {
    primary: '#161f2e',
    primaryLight: '#2d3748',
    accent: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    lightBg: '#f8fafc',
    border: '#e2e8f0',
    text: '#1e293b',
    textLight: '#64748b',
  };

  // Editable titles
  const [mainTitle, setMainTitle] = useState('SUIVI VENTES AVOCATS 2025/2026');
  const [sectionTitle, setSectionTitle] = useState('Journal des Ventes');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable column headers
  const [headers, setHeaders] = useState({
    date: 'DATE',
    clients: 'CLIENTS',
    poidsKg: 'POIDS KG',
    prixKg: 'PRIX / KG',
    prixTotal: 'PRIX TOTAL DH',
    deductions: 'DEDUCTIONS DH',
    payantPar: 'PAYANT PAR',
    variete: 'VARIÉTÉ',
    netPayant: 'NET PAYANT DH'
  });

  interface SalesEntry {
    id?: string;
    date: string;
    clients: string;
    poidsKg: string;
    prixKg: string;
    prixTotal: string;
    deductions: string;
    payantPar: string;
    variete: string;
    netPayant: string;
    createdAt?: any;
    updatedAt?: any;
  }

  interface ArchiveEntry {
    id: string;
    date: string;
    createdAt: any;
    mainTitle: string;
    sectionTitle: string;
    headers: any;
    salesData: SalesEntry[];
    stats: any;
  }

  const [salesData, setSalesData] = useState<SalesEntry[]>([
    { date: '', clients: '', poidsKg: '', prixKg: '', prixTotal: '', deductions: '', payantPar: '', variete: 'HASS', netPayant: '' },
  ]);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [filterVariete, setFilterVariete] = useState('all');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');
  const [showArchiveManager, setShowArchiveManager] = useState(false);
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Show notification
  const showNotif = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  // Calculate statistics
  const calculateStats = () => {
    const totalPoids = salesData.reduce((sum, row) => sum + (parseFloat(row.poidsKg) || 0), 0);
    const totalRevenue = salesData.reduce((sum, row) => sum + (parseFloat(row.prixTotal) || 0), 0);
    const totalDeductions = salesData.reduce((sum, row) => sum + (parseFloat(row.deductions) || 0), 0);
    const netRevenue = totalRevenue - totalDeductions;
    const uniqueClients = [...new Set(salesData.map(row => row.clients))].length;
    const avgPrice = totalPoids > 0 ? (totalRevenue / totalPoids).toFixed(2) : '0.00';

    return { totalPoids, totalRevenue, totalDeductions, netRevenue, uniqueClients, avgPrice };
  };

  // Optimized clear function - CLEARS FIREBASE DATA
  const clearCurrentData = async () => {
    if (confirm('Êtes-vous sûr de vouloir effacer TOUTES les données de la base de données ? Cette action est irréversible.')) {
      setIsSaving(true);
      try {
        // Delete all sales entries from Firebase
        const salesQuery = query(collection(db, 'ventesAvocats'));
        const salesSnapshot = await getDocs(salesQuery);
        
        if (!salesSnapshot.empty) {
          const batch = writeBatch(db);
          salesSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }

        // Reset local state
        setSalesData([{ date: '', clients: '', poidsKg: '', prixKg: '', prixTotal: '', deductions: '', payantPar: '', variete: 'HASS', netPayant: '' }]);
        setHasChanges(false);
        
        // Also clear any titles saved in Firebase
        await saveAppSettingsToFirebase();
        
        showNotif('Toutes les données ont été supprimées de la base de données', 'success');
      } catch (error) {
        console.error('Error clearing data:', error);
        showNotif('Erreur lors de la suppression des données', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Helper function to calculate net payant
  const calculateNetPayant = (prixTotal: string, deductions: string): string => {
    const total = parseFloat(prixTotal) || 0;
    const deduc = parseFloat(deductions) || 0;
    return (total - deduc).toFixed(2);
  };

  const stats = calculateStats();

  // Get unique clients and varieties for filters
  const uniqueClients = [...new Set(salesData.map(row => row.clients).filter(Boolean))];
  const uniqueVarietes = [...new Set(salesData.map(row => row.variete).filter(Boolean))];

  // Filter data based on search and filters
  const filteredData = salesData.filter(row => {
    const matchesSearch = Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesClient = filterClient === 'all' || row.clients === filterClient;
    const matchesVariete = filterVariete === 'all' || row.variete === filterVariete;

    return matchesSearch && matchesClient && matchesVariete;
  });

  // Calculate PRIX TOTAL DH for filtered data
  const filteredPrixTotal = filteredData.reduce((sum, row) => sum + (parseFloat(row.prixTotal) || 0), 0);

  // Save entry to Firebase
  const saveEntryToFirebase = async (entry: SalesEntry, index: number) => {
    try {
      // Prepare data without undefined or empty string values
      const entryData = Object.entries(entry).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== '') {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      // Remove ID before saving to avoid conflicts
      delete entryData.id;

      // Add entry to Firestore
      const docRef = await addDoc(collection(db, 'ventesAvocats'), {
        ...entryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update local state with the new ID
      const updatedData = [...salesData];
      updatedData[index] = { ...entry, id: docRef.id };
      setSalesData(updatedData);
      setHasChanges(false);

      showNotif('Vente sauvegardée avec succès', 'success');
      return docRef.id;
    } catch (error) {
      console.error('Error saving entry:', error);
      showNotif('Erreur lors de la sauvegarde', 'error');
      return null;
    }
  };

  // Update existing entry in Firebase
  const updateEntryInFirebase = async (entry: SalesEntry) => {
    if (!entry.id) return null;

    try {
      const entryData = { ...entry };
      delete entryData.id;

      await updateDoc(doc(db, 'ventesAvocats', entry.id), {
        ...entryData,
        updatedAt: serverTimestamp()
      });

      showNotif('Vente mise à jour', 'success');
      return entry.id;
    } catch (error) {
      console.error('Error updating entry:', error);
      showNotif('Erreur lors de la mise à jour', 'error');
      return null;
    }
  };

  // Save app settings (titles, headers) to Firebase
  const saveAppSettingsToFirebase = async () => {
    try {
      const settingsRef = doc(db, 'appSettings', 'avocadoSalesTracker');
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        await updateDoc(settingsRef, {
          mainTitle,
          sectionTitle,
          headers,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(settingsRef, {
          mainTitle,
          sectionTitle,
          headers,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      return true;
    } catch (error) {
      console.error('Error saving app settings:', error);
      return false;
    }
  };

  // Load app settings from Firebase
  const loadAppSettingsFromFirebase = async () => {
    try {
      const settingsRef = doc(db, 'appSettings', 'avocadoSalesTracker');
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        setMainTitle(data.mainTitle || 'SUIVI VENTES AVOCATS 2025/2026');
        setSectionTitle(data.sectionTitle || 'Journal des Ventes');
        setHeaders(data.headers || {
          date: 'DATE',
          clients: 'CLIENTS',
          poidsKg: 'POIDS KG',
          prixKg: 'PRIX / KG',
          prixTotal: 'PRIX TOTAL DH',
          deductions: 'DEDUCTIONS DH',
          payantPar: 'PAYANT PAR',
          variete: 'VARIÉTÉ',
          netPayant: 'NET PAYANT DH'
        });
        return true;
      }
    } catch (error) {
      console.error('Error loading app settings:', error);
    }
    return false;
  };

  // Row manipulation helpers
  const addRow = () => {
    const newRow = {
      date: new Date().toLocaleDateString('fr-FR'),
      clients: '',
      poidsKg: '',
      prixKg: '',
      prixTotal: '',
      deductions: '',
      payantPar: '',
      variete: 'HASS',
      netPayant: ''
    };
    setSalesData([...salesData, newRow]);
    setHasChanges(true);
    showNotif('Ligne ajoutée');
  };

  const deleteRow = async (index: number) => {
    if (salesData.length <= 1) {
      showNotif('Au moins une ligne est requise', 'warning');
      return;
    }

    const row = salesData[index];
    
    // If the row exists in Firebase, delete it
    if (row.id) {
      if (!confirm('Supprimer cette vente de la base de données ?')) {
        return;
      }
      try {
        await deleteDoc(doc(db, 'ventesAvocats', row.id));
      } catch (error) {
        console.error('Error deleting from Firebase:', error);
        showNotif('Erreur lors de la suppression', 'error');
        return;
      }
    }

    setSalesData(salesData.filter((_, i) => i !== index));
    setHasChanges(true);
    showNotif('Ligne supprimée', 'warning');
  };

  const updateCell = (index: number, field: string, value: string) => {
    const updated = [...salesData];
    updated[index] = { ...updated[index], [field]: value } as any;

    // Auto-calculate prixTotal when poidsKg or prixKg changes
    if (field === 'poidsKg' || field === 'prixKg') {
      const poids = parseFloat(updated[index].poidsKg) || 0;
      const prix = parseFloat(updated[index].prixKg) || 0;
      updated[index].prixTotal = (poids * prix).toFixed(2);
      
      // Recalculate netPayant if prixTotal changes
      const prixTotal = parseFloat(updated[index].prixTotal) || 0;
      const deductions = parseFloat(updated[index].deductions) || 0;
      updated[index].netPayant = (prixTotal - deductions).toFixed(2);
    }

    // Auto-calculate netPayant when prixTotal or deductions changes
    if (field === 'prixTotal' || field === 'deductions') {
      const prixTotal = parseFloat(updated[index].prixTotal) || 0;
      const deductions = parseFloat(updated[index].deductions) || 0;
      updated[index].netPayant = (prixTotal - deductions).toFixed(2);
    }

    setSalesData(updated);
    setHasChanges(true);
    
    // Auto-save to Firebase if row has an ID
    if (updated[index].id) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      autoSaveTimerRef.current = setTimeout(() => {
        updateEntryInFirebase(updated[index]);
      }, 2000);
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const ws = XLSX.utils.json_to_sheet(salesData.map(row => ({
      [headers.date]: row.date,
      [headers.clients]: row.clients,
      [headers.poidsKg]: row.poidsKg,
      [headers.prixKg]: row.prixKg,
      [headers.prixTotal]: row.prixTotal,
      [headers.deductions]: row.deductions,
      [headers.payantPar]: row.payantPar,
      [headers.variete]: row.variete,
      [headers.netPayant]: row.netPayant
    })));

    XLSX.utils.book_append_sheet(wb, ws, 'Ventes Avocats');
    XLSX.writeFile(wb, `${mainTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotif('Fichier Excel téléchargé');
  };

  // Fixed Excel import function
  const importFromExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportProgress('Traitement du fichier...');
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { 
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      
      // Get the first sheet
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Convert to JSON with proper handling
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        defval: ''
      });

      if (jsonData.length < 2) {
        showNotif('Le fichier est vide ou ne contient pas de données', 'error');
        setImportProgress('');
        return;
      }

      setImportProgress('Analyse des données...');

      // Get headers from first row
      const excelHeaders = (jsonData[0] as any[]).map((h: any) => String(h || '').trim());
      
      // Map Excel headers to our data structure
      const headerIndices: {[key: string]: number} = {};
      
      excelHeaders.forEach((header, index) => {
        if (!header) return;
        
        const headerLower = header.toLowerCase().trim();
        
        if (headerLower.includes('date')) {
          headerIndices.date = index;
        } else if (headerLower.includes('client')) {
          headerIndices.clients = index;
        } else if (headerLower.includes('poids')) {
          headerIndices.poidsKg = index;
        } else if (headerLower.includes('prix') && headerLower.includes('kg')) {
          headerIndices.prixKg = index;
        } else if (headerLower.includes('prix total')) {
          headerIndices.prixTotal = index;
        } else if (headerLower.includes('déduction') || headerLower.includes('deduction')) {
          headerIndices.deductions = index;
        } else if (headerLower.includes('payant') || headerLower.includes('payé')) {
          headerIndices.payantPar = index;
        } else if (headerLower.includes('variété') || headerLower.includes('variete')) {
          headerIndices.variete = index;
        } else if (headerLower.includes('net payant')) {
          headerIndices.netPayant = index;
        }
      });

      // Debug: Check header mapping
      console.log('Header mapping found:', headerIndices);

      setImportProgress('Importation des données vers Firebase...');

      const importedData: SalesEntry[] = [];
      let successCount = 0;
      
      // Clear existing data first
      const salesQuery = query(collection(db, 'ventesAvocats'));
      const salesSnapshot = await getDocs(salesQuery);
      
      if (!salesSnapshot.empty) {
        const batch = writeBatch(db);
        salesSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log('Cleared existing data from Firebase');
      }

      // Process rows
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        const getValue = (key: string): string => {
          const idx = headerIndices[key];
          if (idx === undefined || idx >= row.length) return '';
          const value = row[idx];
          return value !== null && value !== undefined ? String(value).trim() : '';
        };

        const date = getValue('date');
        const clients = getValue('clients');
        const poidsKg = getValue('poidsKg');
        const prixKg = getValue('prixKg');
        const prixTotal = getValue('prixTotal');
        const deductions = getValue('deductions');
        const payantPar = getValue('payantPar');
        const variete = getValue('variete');
        const netPayant = getValue('netPayant');

        // Skip empty rows (like your example's last row)
        const isEmptyRow = !date && !clients && !prixTotal && !poidsKg && !prixKg && !deductions && !payantPar && !variete && !netPayant;
        if (isEmptyRow) {
          console.log('Skipping empty row at index', i);
          continue;
        }

        // Skip rows without essential data
        const hasEssentialData = date && clients && (prixTotal || (poidsKg && prixKg));
        if (!hasEssentialData) {
          console.log('Skipping row without essential data at index', i, { date, clients, prixTotal, poidsKg, prixKg });
          continue;
        }

        // Parse numeric values
        const parseNum = (val: string): number => {
          if (!val) return 0;
          const cleaned = val.toString().replace(/[^\d.,]/g, '').replace(',', '.');
          return parseFloat(cleaned) || 0;
        };

        const poidsNum = parseNum(poidsKg);
        const prixNum = parseNum(prixKg);
        const totalNum = parseNum(prixTotal);
        const deducNum = parseNum(deductions);
        const netNum = parseNum(netPayant);

        // Calculate values
        let finalPrixTotal = '';
        if (totalNum > 0) {
          finalPrixTotal = totalNum.toFixed(2);
        } else if (poidsNum > 0 && prixNum > 0) {
          finalPrixTotal = (poidsNum * prixNum).toFixed(2);
        } else {
          finalPrixTotal = '0.00';
        }

        let finalNetPayant = '';
        if (netNum > 0) {
          finalNetPayant = netNum.toFixed(2);
        } else {
          finalNetPayant = (parseFloat(finalPrixTotal) - deducNum).toFixed(2);
        }

        // Format date
        let finalDate = date;
        if (date && !date.includes('/') && !isNaN(Date.parse(date))) {
          try {
            const parsed = new Date(date);
            if (!isNaN(parsed.getTime())) {
              const day = parsed.getDate().toString().padStart(2, '0');
              const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
              const year = parsed.getFullYear();
              finalDate = `${day}/${month}/${year}`;
            }
          } catch (e) {
            // Keep original date string
          }
        }

        const entryData = {
          date: finalDate,
          clients: clients,
          poidsKg: poidsNum > 0 ? poidsNum.toFixed(2) : '',
          prixKg: prixNum > 0 ? prixNum.toFixed(2) : '',
          prixTotal: finalPrixTotal,
          deductions: deducNum > 0 ? deducNum.toFixed(2) : '0.00',
          payantPar: payantPar || 'ABDELAZIZ',
          variete: variete || 'HASS',
          netPayant: finalNetPayant,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        console.log('Importing row:', entryData);

        // Save to Firebase
        try {
          const docRef = await addDoc(collection(db, 'ventesAvocats'), entryData);
          importedData.push({
            ...entryData,
            id: docRef.id
          });
          successCount++;
        } catch (error) {
          console.error('Error saving row to Firebase:', error);
        }

        // Update progress
        if (i % 5 === 0) {
          setImportProgress(`Importation: ${i} sur ${jsonData.length - 1} lignes...`);
        }
      }

      // Update local state
      if (importedData.length > 0) {
        setSalesData(importedData);
        setHasChanges(false);
        showNotif(`${successCount} lignes importées avec succès`, 'success');
      } else {
        showNotif('Aucune donnée valide trouvée dans le fichier', 'warning');
      }
      
      // Save app settings
      await saveAppSettingsToFirebase();
      
      setShowImportModal(false);
      setImportProgress('');
                
    } catch (error) {
      console.error('Error importing Excel:', error);
      setImportProgress('');
      showNotif('Erreur lors de l\'importation. Vérifiez le format du fichier.', 'error');
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Generate PDF report
  const generatePDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text(mainTitle, 105, 15, { align: 'center' });
    
    doc.setFontSize(11);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 105, 22, { align: 'center' });
    
    // SUMMARY SECTION
    doc.setFontSize(12);
    doc.setTextColor(22, 31, 46);
    doc.text('RÉSUMÉ FINANCIER', 20, 35);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    const summaryYStart = 42;
    doc.text(`Total CA: ${stats.totalRevenue.toFixed(2)} DH`, 20, summaryYStart);
    doc.text(`Total Déductions: ${stats.totalDeductions.toFixed(2)} DH`, 70, summaryYStart);
    doc.text(`Net Payant Total: ${stats.netRevenue.toFixed(2)} DH`, 140, summaryYStart, { align: 'right' });

    // Main Table
    const tableData = filteredData.map(row => [
      row.date,
      row.clients.substring(0, 20),
      row.poidsKg,
      row.prixKg,
      row.prixTotal,
      row.deductions,
      row.payantPar,
      row.netPayant,
      row.variete
    ]);

    autoTable(doc, {
      head: [[
        headers.date,
        headers.clients,
        headers.poidsKg,
        headers.prixKg,
        headers.prixTotal,
        headers.deductions,
        headers.payantPar,
        headers.netPayant,
        headers.variete
      ]],
      body: tableData,
      startY: 50,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [50, 50, 50]
      },
      headStyles: {
        fillColor: [22, 31, 46],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold'
      },
      columnStyles: {
        4: { // PRIX TOTAL column
          fillColor: [220, 230, 240],
          fontStyle: 'bold',
          textColor: [0, 0, 139]
        },
        7: { // NET PAYANT column
          fillColor: [220, 237, 200],
          fontStyle: 'bold',
          textColor: [0, 100, 0]
        }
      },
      alternateRowStyles: {
        fillColor: [240, 248, 255]
      }
    });

    // Add total row at the end
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`Total PRIX TOTAL: ${filteredPrixTotal.toFixed(2)} DH`, 20, finalY);

    doc.save(`${mainTitle.replace(/\s+/g, '_')}_rapport.pdf`);
    showNotif('PDF généré');
  };

  const handlePrint = () => {
    window.print();
    showNotif('Impression lancée');
  };

  const handleArchive = async () => {
    try {
      // Create archive data
      const archiveData = {
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
        mainTitle,
        sectionTitle,
        headers,
        salesData,
        stats: calculateStats()
      };

      await addDoc(collection(db, 'ventesAvocatsArchives'), archiveData);
      showNotif('Archivage réussi', 'success');
      
      if (showArchiveManager) {
        loadArchives();
      }
    } catch (error) {
      console.error('Error archiving:', error);
      showNotif('Erreur d\'archivage', 'error');
    }
  };

  // Load archives
  const loadArchives = async () => {
    try {
      setLoadingArchives(true);
      const q = query(collection(db, 'ventesAvocatsArchives'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const loadedArchives: ArchiveEntry[] = [];
      querySnapshot.forEach((doc) => {
        loadedArchives.push({
          id: doc.id,
          ...doc.data()
        } as ArchiveEntry);
      });

      setArchives(loadedArchives);
    } catch (error) {
      console.error('Error loading archives:', error);
      showNotif('Erreur de chargement', 'error');
    } finally {
      setLoadingArchives(false);
    }
  };

  // Load specific archive
  const loadArchive = async (archive: ArchiveEntry) => {
    try {
      setMainTitle(archive.mainTitle);
      setSectionTitle(archive.sectionTitle);
      setHeaders(archive.headers);
      
      // Save app settings for this archive
      await saveAppSettingsToFirebase();
      
      // Save sales data to Firebase
      setIsSaving(true);
      const batch = writeBatch(db);
      let batchOperations = 0;
      
      // First, clear existing data
      const salesQuery = query(collection(db, 'ventesAvocats'));
      const salesSnapshot = await getDocs(salesQuery);
      
      if (!salesSnapshot.empty) {
        salesSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
          batchOperations++;
        });
      }
      
      // Add new data from archive
      archive.salesData.forEach((sale) => {
        const saleData = { ...sale };
        delete saleData.id;
        const docRef = doc(collection(db, 'ventesAvocats'));
        batch.set(docRef, {
          ...saleData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        batchOperations++;
      });
      
      if (batchOperations > 0) {
        await batch.commit();
      }
      
      setSalesData(archive.salesData);
      setHasChanges(false);
      setShowArchiveManager(false);
      setIsSaving(false);
      showNotif(`Archive chargée`, 'success');
    } catch (error) {
      console.error('Error loading archive:', error);
      setIsSaving(false);
      showNotif('Erreur de chargement', 'error');
    }
  };

  // Delete archive
  const deleteArchive = async (archiveId: string, archiveTitle: string) => {
    if (!confirm(`Supprimer l'archive "${archiveTitle}" ?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'ventesAvocatsArchives', archiveId));
      setArchives(archives.filter(a => a.id !== archiveId));
      showNotif('Archive supprimée', 'warning');
    } catch (error) {
      console.error('Error deleting archive:', error);
      showNotif('Erreur de suppression', 'error');
    }
  };

  const openArchiveManager = async () => {
    setShowArchiveManager(true);
    await loadArchives();
  };

  // Save all data to Firebase
  const saveAllDataToFirebase = async () => {
    if (salesData.length === 0) {
      showNotif('Aucune donnée à sauvegarder', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      // Save app settings first
      await saveAppSettingsToFirebase();
      
      // Save sales data
      const batch = writeBatch(db);
      let batchOperations = 0;
      let newEntries = 0;
      let updatedEntries = 0;
      
      for (const row of salesData) {
        const rowData = { ...row };
        delete rowData.id;
        delete rowData.createdAt;
        delete rowData.updatedAt;
        
        if (row.id) {
          // Update existing entry
          const docRef = doc(db, 'ventesAvocats', row.id);
          batch.update(docRef, {
            ...rowData,
            updatedAt: serverTimestamp()
          });
          updatedEntries++;
        } else {
          // Create new entry
          const docRef = doc(collection(db, 'ventesAvocats'));
          batch.set(docRef, {
            ...rowData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          // Update local state with new ID
          const index = salesData.findIndex(r => r === row);
          if (index !== -1) {
            const updatedData = [...salesData];
            updatedData[index].id = docRef.id;
            setSalesData(updatedData);
          }
          newEntries++;
        }
        
        batchOperations++;
        
        // Firestore batch limit
        if (batchOperations >= 500) {
          await batch.commit();
          batchOperations = 0;
        }
      }
      
      if (batchOperations > 0) {
        await batch.commit();
      }
      
      setHasChanges(false);
      showNotif(`${newEntries + updatedEntries} données sauvegardées dans Firebase (${newEntries} nouvelles, ${updatedEntries} mises à jour)`, 'success');
    } catch (error) {
      console.error('Error saving all data:', error);
      showNotif('Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch all data from Firebase
  const fetchAllDataFromFirebase = async () => {
    try {
      setIsLoading(true);
      
      // Load app settings
      await loadAppSettingsFromFirebase();
      
      // Load sales data
      const q = query(collection(db, 'ventesAvocats'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const entries: SalesEntry[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({ 
          id: doc.id, 
          payantPar: data.payantPar || '',
          netPayant: data.netPayant || calculateNetPayant(data.prixTotal, data.deductions),
          ...data
        } as SalesEntry);
      });

      if (entries.length > 0) {
        setSalesData(entries);
        showNotif('Données chargées depuis Firebase', 'success');
      } else {
        // Keep default empty row
        showNotif('Aucune donnée trouvée dans Firebase', 'info');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotif('Erreur de chargement depuis Firebase', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save changes to Firebase
  useEffect(() => {
    if (!hasChanges || isLoading) return;

    const timer = setTimeout(() => {
      saveAllDataToFirebase();
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasChanges, salesData, mainTitle, sectionTitle, headers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Load data on component mount - FROM FIREBASE ONLY
  useEffect(() => {
    fetchAllDataFromFirebase();
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = 'Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir quitter ?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Editable title component
  type EditableTitleProps = {
    value: string;
    onChange: (v: string) => void;
    className?: string;
    placeholder?: string;
  };

  const EditableTitle: React.FC<EditableTitleProps> = ({ value, onChange, className, placeholder }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    return isEditing ? (
      <input
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={() => {
          onChange(tempValue);
          setIsEditing(false);
          setHasChanges(true);
        }}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            onChange(tempValue);
            setIsEditing(false);
            setHasChanges(true);
          }
        }}
        className={`${className} border-2 border-blue-400 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-600`}
        autoFocus
        placeholder={placeholder}
      />
    ) : (
      <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
        <span className={className}>{value}</span>
        <Edit2 size={16} className="text-gray-400 group-hover:text-blue-600 transition print:hidden" />
      </div>
    );
  };

  // Editable header component
  type EditableHeaderProps = {
    value: string;
    onChange: (v: string) => void;
  };

  const EditableHeader: React.FC<EditableHeaderProps> = ({ value, onChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    return isEditing ? (
      <input
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={() => {
          onChange(tempValue);
          setIsEditing(false);
          setHasChanges(true);
        }}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            onChange(tempValue);
            setIsEditing(false);
            setHasChanges(true);
          }
        }}
        className="w-full bg-[#161f2e] text-white px-3 py-2 border-2 border-white rounded-lg focus:outline-none text-center"
        autoFocus
      />
    ) : (
      <div className="flex items-center justify-center gap-1 cursor-pointer group" onClick={() => setIsEditing(true)}>
        <span>{value}</span>
        <Edit2 size={14} className="text-gray-300 group-hover:text-white transition print:hidden" />
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#161f2e] mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Chargement des données depuis Firebase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-6 print:p-2">
      {/* Notification */}
      {showNotification && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transform transition-all duration-300 ${
          notificationType === 'success' ? 'bg-green-600' :
          notificationType === 'warning' ? 'bg-amber-600' : 'bg-red-600'
        } text-white print:hidden`}>
          {notificationType === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
          <span className="font-medium">{notificationMessage}</span>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Importer Excel</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportProgress('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="text-center mb-6">
                <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600 mb-2">
                  Sélectionnez un fichier Excel
                </p>
                <p className="text-sm text-gray-500">
                  Les données seront directement sauvegardées dans Firebase
                </p>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={importFromExcel}
                  className="hidden"
                  id="excel-import"
                />
                <label htmlFor="excel-import" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="text-gray-400" size={24} />
                    <span className="text-gray-600">Cliquez pour sélectionner</span>
                    <span className="text-sm text-gray-500">.xlsx, .xls</span>
                  </div>
                </label>
              </div>

              {importProgress && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-blue-700 font-medium">{importProgress}</span>
                  </div>
                </div>
              )}

              <div className="mt-4 p-4 bg-amber-50 rounded-lg">
                <h4 className="font-semibold text-amber-800 mb-2">Instructions :</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• La première ligne doit contenir les en-têtes exacts</li>
                  <li>• Format recommandé : DATE, CLIENTS, POIDS KG, PRIX / KG, PRIX TOTAL DH, DEDUCTIONS DH, PAYANT PAR, VARIÉTÉ, NET PAYANT DH</li>
                  <li>• Les dates doivent être au format texte (JJ/MM/AAAA)</li>
                  <li>• Les lignes vides seront automatiquement ignorées</li>
                  <li>• PAYANT PAR par défaut: "ABDELAZIZ" si vide</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportProgress('');
                }}
                className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Manager */}
      {showArchiveManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Archives</h2>
              <button
                onClick={() => setShowArchiveManager(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingArchives ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#161f2e] mx-auto"></div>
                  <p className="text-gray-600 mt-4">Chargement...</p>
                </div>
              ) : archives.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Aucune archive</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {archives.map((archive) => (
                    <div key={archive.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-gray-800">{archive.mainTitle}</h3>
                          <p className="text-sm text-gray-600">
                            {new Date(archive.date).toLocaleDateString('fr-FR')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {archive.salesData.length} ventes • Prix Total: {archive.stats.totalRevenue.toFixed(2)} DH • Net: {archive.stats.netRevenue.toFixed(2)} DH
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadArchive(archive)}
                            className="flex items-center gap-2 bg-[#161f2e] hover:bg-[#2d3748] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <FolderOpen size={16} />
                            Charger
                          </button>
                          <button
                            onClick={() => deleteArchive(archive.id, archive.mainTitle)}
                            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Trash2 size={16} />
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowArchiveManager(false)}
                className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className={`bg-[#161f2e] rounded-2xl shadow-xl p-8 mb-6 print:shadow-none print:bg-white`}>
          <EditableTitle
            value={mainTitle}
            onChange={setMainTitle}
            className="text-4xl font-bold text-white text-center mb-6 print:text-gray-900"
            placeholder="Titre principal"
          />

          {/* KEY STATISTICS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:hidden">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-gray-200 text-sm font-medium mb-2">TOTAL PRIX TOTAL</div>
              <p className="text-2xl font-bold text-white">{stats.totalRevenue.toFixed(2)} DH</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-gray-200 text-sm font-medium mb-2">TOTAL NET</div>
              <p className="text-2xl font-bold text-white">{stats.netRevenue.toFixed(2)} DH</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-gray-200 text-sm font-medium mb-2">TOTAL KG</div>
              <p className="text-2xl font-bold text-white">{stats.totalPoids.toFixed(2)} kg</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-gray-200 text-sm font-medium mb-2">CLIENTS</div>
              <p className="text-2xl font-bold text-white">{stats.uniqueClients}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center print:hidden">
            <button
              onClick={saveAllDataToFirebase}
              disabled={isSaving}
              className={`flex items-center gap-2 ${isSaving ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-3 rounded-xl font-medium shadow hover:shadow-md transition-all`}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Sauvegarder dans Firebase {hasChanges && "●"}
                </>
              )}
            </button>
            
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium shadow hover:shadow-md transition-all"
            >
              <Download size={20} />
              Excel
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium shadow hover:shadow-md transition-all"
            >
              <Upload size={20} />
              Importer
            </button>

            <button
              onClick={generatePDF}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-medium shadow hover:shadow-md transition-all"
            >
              <Printer size={20} />
              PDF
            </button>

            <button
              onClick={openArchiveManager}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium shadow hover:shadow-md transition-all"
            >
              <Archive size={20} />
              Archives
            </button>

            <button
              onClick={clearCurrentData}
              disabled={isSaving}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-medium shadow hover:shadow-md transition-all"
            >
              <Trash2 size={20} />
              Effacer
            </button>
          </div>
          
          {hasChanges && (
            <div className="mt-4 text-center">
              <span className="text-yellow-300 text-sm font-medium">
                ⚠️ Modifications non sauvegardées. Cliquez sur "Sauvegarder dans Firebase"
              </span>
            </div>
          )}
        </div>

        {/* Sales Table */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 print:shadow-none">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <EditableTitle
              value={sectionTitle}
              onChange={setSectionTitle}
              className="text-2xl font-bold text-gray-800"
              placeholder="Journal des Ventes"
            />

            {/* Search and Filter */}
            <div className="flex flex-wrap gap-3 w-full md:w-auto print:hidden">
              <div className="relative flex-1 md:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none w-full md:w-64"
                />
              </div>

              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Tous les clients</option>
                {uniqueClients.map(client => (
                  <option key={client} value={client}>{client}</option>
                ))}
              </select>

              <button
                onClick={addRow}
                className="flex items-center gap-2 bg-[#161f2e] hover:bg-[#2d3748] text-white px-6 py-3 rounded-xl font-medium shadow hover:shadow-md transition-all"
              >
                <Plus size={20} />
                Ajouter
              </button>
            </div>
          </div>

          {/* TOTAL PRIX TOTAL Display */}
          <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="text-blue-600" size={24} />
                <div>
                  <h3 className="font-bold text-lg text-blue-800">TOTAL {headers.prixTotal}</h3>
                  <p className="text-sm text-blue-600">Pour les données filtrées</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-900">{filteredPrixTotal.toFixed(2)} DH</p>
                <p className="text-sm text-blue-700">
                  {filteredData.length} {filteredData.length === 1 ? 'ligne' : 'lignes'} affichées
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border-2 border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#161f2e] text-white">
                  <th className="border border-gray-300 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.date} onChange={(val) => setHeaders({ ...headers, date: val })} />
                  </th>
                  <th className="border border-gray-300 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.clients} onChange={(val) => setHeaders({ ...headers, clients: val })} />
                  </th>
                  <th className="border border-gray-300 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.poidsKg} onChange={(val) => setHeaders({ ...headers, poidsKg: val })} />
                  </th>
                  <th className="border border-gray-300 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.prixKg} onChange={(val) => setHeaders({ ...headers, prixKg: val })} />
                  </th>
                  <th className="border border-gray-300 p-3 text-sm font-semibold bg-blue-800">
                    <EditableHeader value={headers.prixTotal} onChange={(val) => setHeaders({ ...headers, prixTotal: val })} />
                  </th>
                  <th className="border border-gray-300 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.deductions} onChange={(val) => setHeaders({ ...headers, deductions: val })} />
                  </th>
                  <th className="border border-gray-300 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.payantPar} onChange={(val) => setHeaders({ ...headers, payantPar: val })} />
                  </th>
                  <th className="border border-gray-300 p-3 text-sm font-semibold bg-green-800">
                    <EditableHeader value={headers.netPayant} onChange={(val) => setHeaders({ ...headers, netPayant: val })} />
                  </th>
                  <th className="border border-gray-300 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.variete} onChange={(val) => setHeaders({ ...headers, variete: val })} />
                  </th>
                  <th className="border border-gray-300 p-3 text-sm font-semibold print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, index) => (
                  <tr key={row.id || `row-${index}`} className="hover:bg-gray-50 transition-colors">
                    <td className="border border-gray-300 p-2">
                      <input
                        type="text"
                        value={row.date}
                        onChange={(e) => updateCell(index, 'date', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                        placeholder="JJ/MM/AAAA"
                      />
                    </td>
                    <td className="border border-gray-300 p-2">
                      <input
                        type="text"
                        value={row.clients}
                        onChange={(e) => updateCell(index, 'clients', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                        placeholder="Client"
                      />
                    </td>
                    <td className="border border-gray-300 p-2">
                      <input
                        type="number"
                        value={row.poidsKg}
                        onChange={(e) => updateCell(index, 'poidsKg', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="border border-gray-300 p-2">
                      <input
                        type="number"
                        value={row.prixKg}
                        onChange={(e) => updateCell(index, 'prixKg', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="border border-gray-300 p-2 bg-blue-50">
                      <input
                        type="text"
                        value={row.prixTotal}
                        readOnly
                        className="w-full p-2 bg-blue-50 font-bold text-blue-800 rounded-lg text-sm text-center"
                      />
                    </td>
                    <td className="border border-gray-300 p-2">
                      <input
                        type="number"
                        value={row.deductions}
                        onChange={(e) => updateCell(index, 'deductions', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="border border-gray-300 p-2">
                      <input
                        type="text"
                        value={row.payantPar}
                        onChange={(e) => updateCell(index, 'payantPar', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                        placeholder="Qui paie ?"
                      />
                    </td>
                    <td className="border border-gray-300 p-2 bg-green-50">
                      <input
                        type="text"
                        value={row.netPayant}
                        readOnly
                        className="w-full p-2 bg-green-50 font-bold text-green-800 rounded-lg text-sm text-center"
                      />
                    </td>
                    <td className="border border-gray-300 p-2">
                      <select
                        value={row.variete}
                        onChange={(e) => updateCell(index, 'variete', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                      >
                        <option value="HASS">HASS</option>
                        <option value="FUERTE ZUTANO">FUERTE ZUTANO</option>
                        <option value="OTHER">AUTRE</option>
                      </select>
                    </td>
                    <td className="border border-gray-300 p-2 text-center print:hidden">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => row.id ? updateEntryInFirebase(row) : saveEntryToFirebase(row, index)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                          title={row.id ? "Mettre à jour" : "Sauvegarder"}
                        >
                          <Save size={18} />
                        </button>
                        <button
                          onClick={() => deleteRow(index)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center print:hidden">
          <div className="inline-block bg-white rounded-xl shadow px-6 py-3">
            <p className="text-gray-600 text-sm">
              © 2025/2026 - Suivi Ventes Avocats | 
              <span className="ml-2 text-[#161f2e] font-medium">
                Données sauvegardées dans Firebase | 
                {headers.prixTotal}: {stats.totalRevenue.toFixed(2)} DH | 
                {headers.netPayant}: {stats.netRevenue.toFixed(2)} DH
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
          }
          thead {
            display: table-header-group;
          }
          input, select {
            border: none !important;
            background: transparent !important;
          }
          .bg-gradient-to-r {
            background: white !important;
          }
          @page {
            margin: 0.5cm;
          }
        }
      `}</style>
    </div>
  );
}