import React, { useState, useEffect } from 'react';
import { Download, Printer, Archive, Plus, Trash2, Search, Filter, Save, Edit2, CheckCircle, AlertCircle, Calendar, TrendingUp, Package, DollarSign, Users, FolderOpen, History, X, Upload, Copy } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { storage, db } from '../../lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, deleteDoc, doc, where } from 'firebase/firestore';

export default function AvocadoSalesTracker() {
  // Editable titles
  const [mainTitle, setMainTitle] = useState('SUIVI VENTES AVOCATS 2025/2026');
  const [sectionTitle, setSectionTitle] = useState('Journal des Ventes');
  const [dataCleared, setDataCleared] = useState(false);

  // Editable column headers
  const [headers, setHeaders] = useState({
    date: 'DATE',
    clients: 'CLIENTS',
    poidsKg: 'POIDS KG',
    prixKg: 'PRIX / KG',
    prixTotal: 'PRIX TOTAL DH',
    payer: 'PAYER',
    deductions: 'DEDUCTIONS DH',
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
    payer: string;
    deductions: string;
    variete: string;
    netPayant: string;
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
    archiveName: string;
  }

  const [salesData, setSalesData] = useState<SalesEntry[]>([
    { date: '', clients: '', poidsKg: '', prixKg: '', prixTotal: '', payer: '', deductions: '', variete: '', netPayant: '' },
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
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveName, setArchiveName] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicates, setDuplicates] = useState<{duplicates: SalesEntry[], unique: SalesEntry[]}>({duplicates: [], unique: []});

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

  // Find duplicates based on key fields
  const findDuplicates = () => {
    const seen = new Set();
    const duplicates: SalesEntry[] = [];
    const unique: SalesEntry[] = [];

    salesData.forEach(row => {
      // Create a unique key based on important fields
      const key = `${row.date}-${row.clients}-${row.poidsKg}-${row.prixKg}-${row.prixTotal}`;
      
      if (seen.has(key)) {
        duplicates.push(row);
      } else {
        seen.add(key);
        unique.push(row);
      }
    });

    return { duplicates, unique };
  };

  // Remove duplicates function
  const removeDuplicates = () => {
    const { duplicates, unique } = findDuplicates();
    
    if (duplicates.length === 0) {
      showNotif('Aucun doublon trouvé dans les données', 'warning');
      return;
    }

    setDuplicates({ duplicates, unique });
    setShowDuplicateModal(true);
  };

  // Confirm duplicate removal - UPDATED to delete from Firebase
  const confirmRemoveDuplicates = async () => {
    try {
      let firebaseDeletionCount = 0;
      let firebaseDeletionErrors = 0;
      
      // Delete duplicates from Firebase
      for (const duplicate of duplicates.duplicates) {
        if (duplicate.id) {
          try {
            await deleteDoc(doc(db, 'ventesAvocats', duplicate.id));
            firebaseDeletionCount++;
          } catch (error) {
            console.error('Error deleting duplicate from Firebase:', error);
            firebaseDeletionErrors++;
          }
        }
      }

      // Update local state
      setSalesData(duplicates.unique);
      setShowDuplicateModal(false);
      
      // Show appropriate notification
      if (firebaseDeletionCount > 0 && firebaseDeletionErrors === 0) {
        showNotif(`${duplicates.duplicates.length} doublon(s) supprimé(s) (${firebaseDeletionCount} de Firebase)!`, 'success');
      } else if (firebaseDeletionCount > 0 && firebaseDeletionErrors > 0) {
        showNotif(`${duplicates.duplicates.length} doublon(s) supprimé(s) localement, ${firebaseDeletionCount} de Firebase, ${firebaseDeletionErrors} erreurs`, 'warning');
      } else {
        showNotif(`${duplicates.duplicates.length} doublon(s) supprimé(s) localement!`, 'success');
      }
    } catch (error) {
      console.error('Error removing duplicates:', error);
      showNotif('Erreur lors de la suppression des doublons', 'error');
    }
  };

  const clearAllData = () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer TOUTES les données (Firebase, local storage, et données actuelles) ?')) {
      // Clear local storage
      localStorage.removeItem('avocadoSalesCurrentData');
      localStorage.removeItem('avocadoSalesArchives');
      
      // Reset to initial state
      setSalesData([{ date: '', clients: '', poidsKg: '', prixKg: '', prixTotal: '', payer: '', deductions: '', variete: '', netPayant: '' }]);
      setMainTitle('SUIVI VENTES AVOCATS 2025/2026');
      setSectionTitle('Journal des Ventes');
      setHeaders({
        date: 'DATE',
        clients: 'CLIENTS',
        poidsKg: 'POIDS KG',
        prixKg: 'PRIX / KG',
        prixTotal: 'PRIX TOTAL DH',
        payer: 'PAYER',
        deductions: 'DEDUCTIONS DH',
        variete: 'VARIÉTÉ',
        netPayant: 'NET PAYANT DH'
      });
      
      // Set flag to prevent reloading
      setDataCleared(true);
      
      // Also set a flag in localStorage to prevent future reloads
      localStorage.setItem('avocadoDataManuallyCleared', 'true');
      
      showNotif('Toutes les données ont été supprimées', 'success');
    }
  };

  // Modified useEffect
  useEffect(() => {
    // Check if data was manually cleared
    const wasManuallyCleared = localStorage.getItem('avocadoDataManuallyCleared') === 'true';
    
    if (wasManuallyCleared) {
      // If manually cleared, don't load any data
      localStorage.removeItem('avocadoDataManuallyCleared');
      return;
    }

    // Only load from Firebase if there's meaningful data
    const saved = localStorage.getItem('avocadoSalesCurrentData');
    
    if (saved) {
      try {
        const data = JSON.parse(saved);
        // Check if the saved data has actual content (not just empty rows)
        const hasActualData = data.salesData && data.salesData.some(row => 
          row.clients || row.poidsKg || row.prixKg || parseFloat(row.prixTotal) > 0
        );
        
        if (hasActualData) {
          setMainTitle(data.mainTitle || mainTitle);
          setSectionTitle(data.sectionTitle || sectionTitle);
          setHeaders(data.headers || headers);
          // Add netPayant field to existing data if it doesn't exist
          const updatedSalesData = data.salesData.map((row: any) => ({
            ...row,
            netPayant: row.netPayant || calculateNetPayant(row.prixTotal, row.deductions)
          }));
          setSalesData(updatedSalesData);
          showNotif('Données chargées depuis la sauvegarde locale', 'success');
        } else {
          // If only empty data, fetch from Firebase but don't override if Firebase is also empty
          fetchEntriesFromFirebase();
        }
      } catch (error) {
        console.error('Error parsing saved data:', error);
        fetchEntriesFromFirebase();
      }
    } else {
      // No local data, fetch from Firebase
      fetchEntriesFromFirebase();
    }
  }, []);

  // Helper function to calculate net payant
  const calculateNetPayant = (prixTotal: string, deductions: string): string => {
    const total = parseFloat(prixTotal) || 0;
    const deduc = parseFloat(deductions) || 0;
    return (total - deduc).toFixed(2);
  };

  const stats = calculateStats();

  // Get unique clients and varieties for filters
  const uniqueClients = [...new Set(salesData.map(row => row.clients))];
  const uniqueVarietes = [...new Set(salesData.map(row => row.variete))];

  // Filter data based on search and filters
  const filteredData = salesData.filter(row => {
    const matchesSearch = Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesClient = filterClient === 'all' || row.clients === filterClient;
    const matchesVariete = filterVariete === 'all' || row.variete === filterVariete;

    return matchesSearch && matchesClient && matchesVariete;
  });

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

      showNotif('Vente sauvegardée avec succès dans la base de données', 'success');
      return docRef.id;
    } catch (error) {
      console.error('Error saving entry:', error);
      showNotif('Erreur lors de la sauvegarde dans la base de données', 'error');
      return null;
    }
  };

  // Row manipulation helpers
  const addRow = () => {
    setSalesData([...salesData, {
      date: new Date().toLocaleDateString('fr-FR'),
      clients: '',
      poidsKg: '',
      prixKg: '',
      prixTotal: '',
      payer: '',
      deductions: '',
      variete: 'HASS',
      netPayant: ''
    }]);
    showNotif('Ligne ajoutée avec succès');
  };

  const deleteRow = (index: number) => {
    if (salesData.length > 1) {
      setSalesData(salesData.filter((_, i) => i !== index));
      showNotif('Ligne supprimée', 'warning');
    }
  };

  const updateCell = (index: number, field: string, value: string) => {
    const updated = [...salesData];
    updated[index] = { ...updated[index], [field]: value } as any;

    // Auto-calculate prixTotal when poidsKg or prixKg changes
    if (field === 'poidsKg' || field === 'prixKg') {
      const poids = parseFloat(updated[index].poidsKg) || 0;
      const prix = parseFloat(updated[index].prixKg) || 0;
      updated[index].prixTotal = (poids * prix).toFixed(2);
    }

    // Auto-calculate netPayant when prixTotal or deductions changes
    if (field === 'prixTotal' || field === 'deductions') {
      const prixTotal = parseFloat(updated[index].prixTotal) || 0;
      const deductions = parseFloat(updated[index].deductions) || 0;
      updated[index].netPayant = (prixTotal - deductions).toFixed(2);
    }

    setSalesData(updated);
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
      [headers.payer]: row.payer,
      [headers.deductions]: row.deductions,
      [headers.variete]: row.variete,
      [headers.netPayant]: row.netPayant
    })));

    XLSX.utils.book_append_sheet(wb, ws, 'Ventes Avocats');
    XLSX.writeFile(wb, `${mainTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotif('Fichier Excel téléchargé avec succès!');
  };

  // Fixed Import from Excel function
  const importFromExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        let jsonData;
        try {
          jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            raw: false
          });
        } catch {
          jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            raw: true
          });
        }

        if (jsonData.length < 2) {
          showNotif('Le fichier Excel ne contient pas de données valides', 'error');
          return;
        }

        // Get headers from first row
        const excelHeaders = jsonData[0] as string[];
        
        // Map column indices based on expected headers
        const headerMapping: { [key: string]: number } = {};
        excelHeaders.forEach((header, index) => {
          const headerLower = header.toLowerCase();
          if (headerLower.includes('date')) headerMapping.date = index;
          else if (headerLower.includes('client')) headerMapping.clients = index;
          else if (headerLower.includes('poids')) headerMapping.poidsKg = index;
          else if (headerLower.includes('prix') && headerLower.includes('kg')) headerMapping.prixKg = index;
          else if (headerLower.includes('total')) headerMapping.prixTotal = index;
          else if (headerLower.includes('payer')) headerMapping.payer = index;
          else if (headerLower.includes('déduction') || headerLower.includes('deduction')) headerMapping.deductions = index;
          else if (headerLower.includes('variété') || headerLower.includes('variete')) headerMapping.variete = index;
          else if (headerLower.includes('net') || headerLower.includes('payant')) headerMapping.netPayant = index;
        });

        // Process data rows
        const importedData: SalesEntry[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          // Helper function to convert Excel serial date to formatted string
          const convertExcelDate = (excelSerial: number): string => {
            try {
              const excelEpoch = new Date(1899, 11, 30);
              const jsDate = new Date(excelEpoch.getTime() + (excelSerial - 1) * 24 * 60 * 60 * 1000);
              
              if (excelSerial >= 60) {
                jsDate.setTime(jsDate.getTime() - 24 * 60 * 60 * 1000);
              }
              
              const day = String(jsDate.getDate()).padStart(2, '0');
              const month = String(jsDate.getMonth() + 1).padStart(2, '0');
              const year = jsDate.getFullYear();
              return `${day}/${month}/${year}`;
            } catch {
              return String(excelSerial);
            }
          };

          // Helper function to safely get cell value
          const getCellValue = (index: number | undefined, isDateField = false): string => {
            if (index === undefined || index >= row.length) return '';
            const value = row[index];
            
            if (isDateField && typeof value === 'number' && value > 0 && value < 100000) {
              return convertExcelDate(value);
            }
            
            if (value instanceof Date) {
              const day = String(value.getDate()).padStart(2, '0');
              const month = String(value.getMonth() + 1).padStart(2, '0');
              const year = value.getFullYear();
              return `${day}/${month}/${year}`;
            }
            
            return String(value || '');
          };

          const entry: SalesEntry = {
            date: getCellValue(headerMapping.date, true),
            clients: getCellValue(headerMapping.clients),
            poidsKg: getCellValue(headerMapping.poidsKg),
            prixKg: getCellValue(headerMapping.prixKg),
            prixTotal: getCellValue(headerMapping.prixTotal),
            payer: getCellValue(headerMapping.payer),
            deductions: getCellValue(headerMapping.deductions),
            variete: getCellValue(headerMapping.variete) || 'HASS',
            netPayant: getCellValue(headerMapping.netPayant)
          };

          // Auto-calculate prixTotal if not provided but poidsKg and prixKg are available
          if (!entry.prixTotal && entry.poidsKg && entry.prixKg) {
            const poids = parseFloat(entry.poidsKg) || 0;
            const prix = parseFloat(entry.prixKg) || 0;
            entry.prixTotal = (poids * prix).toFixed(2);
          }

          // Auto-calculate netPayant if not provided
          if (!entry.netPayant && entry.prixTotal) {
            const prixTotal = parseFloat(entry.prixTotal) || 0;
            const deductions = parseFloat(entry.deductions) || 0;
            entry.netPayant = (prixTotal - deductions).toFixed(2);
          }

          importedData.push(entry);
        }

        if (importedData.length > 0) {
          // Ask user if they want to replace or append data
          const userChoice = window.confirm(
            `Voulez-vous:\n\n• "OK" - Remplacer toutes les données existantes\n• "Annuler" - Ajouter les ${importedData.length} nouvelles lignes aux données existantes`
          );

          if (userChoice) {
            // Replace all data
            setSalesData(importedData);
            showNotif(`${importedData.length} lignes importées (remplacement) avec succès!`, 'success');
          } else {
            // Append to existing data
            setSalesData(prevData => [...prevData, ...importedData]);
            showNotif(`${importedData.length} lignes ajoutées aux données existantes!`, 'success');
          }
          
          setShowImportModal(false);
        } else {
          showNotif('Aucune donnée valide trouvée dans le fichier Excel', 'warning');
        }
      } catch (error) {
        console.error('Error importing Excel file:', error);
        showNotif('Erreur lors de l\'importation du fichier Excel', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    event.target.value = '';
  };

  // Generate PDF report (without stats)
  const generatePDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text(mainTitle, 105, 20, { align: 'center' });

    // Date
    doc.setFontSize(12);
    doc.text(`Rapport généré le: ${new Date().toLocaleDateString('fr-FR')}`, 105, 30, { align: 'center' });

    // Table only - no statistics
    const tableData = filteredData.map(row => [
      row.date,
      row.clients,
      row.poidsKg,
      row.prixKg,
      row.prixTotal,
      row.payer,
      row.deductions,
      row.variete,
      row.netPayant
    ]);

    autoTable(doc, {
      head: [[
        headers.date,
        headers.clients,
        headers.poidsKg,
        headers.prixKg,
        headers.prixTotal,
        headers.payer,
        headers.deductions,
        headers.variete,
        headers.netPayant
      ]],
      body: tableData,
      startY: 50,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [50, 50, 50]
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 248, 255]
      }
    });

    doc.save(`${mainTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotif('PDF généré avec succès!');
  };

  const handlePrint = () => {
    window.print();
    showNotif('Impression lancée');
  };

  // Fixed Archive function with custom naming
  const handleArchive = async () => {
    setShowArchiveModal(true);
  };

  const confirmArchive = async () => {
    if (!archiveName.trim()) {
      showNotif('Veuillez donner un nom à l\'archive', 'error');
      return;
    }

    try {
      const archiveData = {
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
        mainTitle,
        sectionTitle,
        headers,
        salesData,
        stats: calculateStats(),
        archiveName: archiveName.trim()
      };

      await addDoc(collection(db, 'ventesAvocatsArchives'), archiveData);
      showNotif(`Archive "${archiveName}" créée avec succès dans Firebase!`, 'success');

      // Local storage backup
      const localArchives = JSON.parse(localStorage.getItem('avocadoSalesArchives') || '[]');
      localArchives.push(archiveData);
      localStorage.setItem('avocadoSalesArchives', JSON.stringify(localArchives));

      // Reset and close modal
      setArchiveName('');
      setShowArchiveModal(false);

      // Refresh archives list if manager is open
      if (showArchiveManager) {
        loadArchives();
      }
    } catch (error) {
      console.error('Error archiving data:', error);
      showNotif('Erreur lors de l\'archivage des données', 'error');
    }
  };

  // Load all archives
  const loadArchives = async () => {
    try {
      setLoadingArchives(true);
      const q = query(collection(db, 'ventesAvocatsArchives'), orderBy('date', 'desc'));
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
      showNotif('Erreur lors du chargement des archives', 'error');
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
      setSalesData(archive.salesData);
      setShowArchiveManager(false);
      showNotif(`Archive "${archive.archiveName}" chargée avec succès!`, 'success');
    } catch (error) {
      console.error('Error loading archive:', error);
      showNotif('Erreur lors du chargement de l\'archive', 'error');
    }
  };

  // Delete archive
  const deleteArchive = async (archiveId: string, archiveTitle: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'archive "${archiveTitle}" ?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'ventesAvocatsArchives', archiveId));
      setArchives(archives.filter(a => a.id !== archiveId));
      showNotif('Archive supprimée avec succès', 'warning');
    } catch (error) {
      console.error('Error deleting archive:', error);
      showNotif('Erreur lors de la suppression de l\'archive', 'error');
    }
  };

  // Open archive manager
  const openArchiveManager = async () => {
    setShowArchiveManager(true);
    await loadArchives();
  };

  const handleSave = () => {
    const saveData = {
      mainTitle,
      sectionTitle,
      headers,
      salesData
    };
    localStorage.setItem('avocadoSalesCurrentData', JSON.stringify(saveData));
    showNotif('Données sauvegardées localement avec succès!');
  };

  const handleSaveAllToFirebase = async () => {
    const totalEntries = salesData.length;
    let successCount = 0;

    for (let i = 0; i < salesData.length; i++) {
      try {
        if (salesData[i].id) {
          successCount++;
          continue;
        }

        const success = await saveEntryToFirebase(salesData[i], i);
        if (success) {
          successCount++;
        }
      } catch (error) {
        console.error('Error saving entry:', error);
      }
    }

    if (successCount === totalEntries) {
      showNotif(`Toutes les ventes (${successCount}) ont été sauvegardées avec succès!`, 'success');
    } else {
      showNotif(`${successCount}/${totalEntries} ventes sauvegardées. Certaines n'ont pas pu être sauvegardées.`, 'warning');
    }
  };

  // Fetch entries from Firebase
  const fetchEntriesFromFirebase = async () => {
    try {
      const q = query(collection(db, 'ventesAvocats'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);

      const entries: SalesEntry[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({ 
          id: doc.id, 
          ...data,
          netPayant: data.netPayant || calculateNetPayant(data.prixTotal, data.deductions)
        } as SalesEntry);
      });

      if (entries.length > 0) {
        setSalesData(entries);
        showNotif('Données chargées depuis la base de données', 'success');
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
      showNotif('Erreur lors du chargement des données', 'error');
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchEntriesFromFirebase();

    const saved = localStorage.getItem('avocadoSalesCurrentData');
    if (saved) {
      const data = JSON.parse(saved);
      setMainTitle(data.mainTitle || mainTitle);
      setSectionTitle(data.sectionTitle || sectionTitle);
      setHeaders(data.headers || headers);
      // Add netPayant field to existing data if it doesn't exist
      const updatedSalesData = data.salesData.map((row: any) => ({
        ...row,
        netPayant: row.netPayant || calculateNetPayant(row.prixTotal, row.deductions)
      }));
      setSalesData(updatedSalesData || salesData);
    }
  }, []);

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
        }}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            onChange(tempValue);
            setIsEditing(false);
          }
        }}
        className={`${className} border-2 border-blue-400 rounded px-2 py-1 focus:outline-none focus:border-blue-600`}
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
        }}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            onChange(tempValue);
            setIsEditing(false);
          }
        }}
        className="w-full bg-blue-700 text-white px-2 py-1 border-2 border-white rounded focus:outline-none text-center"
        autoFocus
      />
    ) : (
      <div className="flex items-center justify-center gap-1 cursor-pointer group" onClick={() => setIsEditing(true)}>
        <span>{value}</span>
        <Edit2 size={12} className="text-blue-200 group-hover:text-white transition print:hidden" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-slate-100 p-6 print:p-2">
      {/* Notification */}
      {showNotification && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-2xl transform transition-all duration-300 ${notificationType === 'success' ? 'bg-green-600' :
            notificationType === 'warning' ? 'bg-orange-600' : 'bg-red-600'
          } text-white print:hidden`}>
          {notificationType === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
          <span className="font-medium">{notificationMessage}</span>
        </div>
      )}

      {/* Duplicate Removal Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Supprimer les Doublons</h2>
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="text-yellow-600" size={24} />
                  <h3 className="text-lg font-semibold text-yellow-800">
                    {duplicates.duplicates.length} doublon(s) trouvé(s)
                  </h3>
                </div>
                <p className="text-yellow-700">
                  Les doublons seront supprimés en conservant une seule occurrence de chaque entrée unique.
                  {duplicates.unique.length} entrée(s) unique(s) seront conservées.
                </p>
                <div className="mt-3 p-3 bg-yellow-100 rounded">
                  <p className="text-yellow-800 text-sm font-medium">
                    <strong>Attention:</strong> Les doublons seront également supprimés de la base de données Firebase.
                  </p>
                  <p className="text-yellow-700 text-sm mt-1">
                    {duplicates.duplicates.filter(d => d.id).length} doublon(s) seront supprimés de Firebase.
                  </p>
                </div>
              </div>

              {duplicates.duplicates.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Doublons qui seront supprimés :</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border-b p-2 text-left">Date</th>
                          <th className="border-b p-2 text-left">Client</th>
                          <th className="border-b p-2 text-left">Poids (kg)</th>
                          <th className="border-b p-2 text-left">Prix/kg</th>
                          <th className="border-b p-2 text-left">Total</th>
                          <th className="border-b p-2 text-left">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicates.duplicates.slice(0, 10).map((dup, index) => (
                          <tr key={index} className="border-b hover:bg-red-50">
                            <td className="p-2">{dup.date}</td>
                            <td className="p-2">{dup.clients}</td>
                            <td className="p-2">{dup.poidsKg}</td>
                            <td className="p-2">{dup.prixKg}</td>
                            <td className="p-2">{dup.prixTotal} DH</td>
                            <td className="p-2">
                              {dup.id ? (
                                <span className="text-red-600 font-medium">Firebase</span>
                              ) : (
                                <span className="text-gray-500">Local</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {duplicates.duplicates.length > 10 && (
                          <tr>
                            <td colSpan={6} className="p-2 text-center text-gray-500">
                              ... et {duplicates.duplicates.length - 10} autres doublons
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center p-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Total après suppression: {duplicates.unique.length} entrée(s) unique(s)
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDuplicateModal(false)}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmRemoveDuplicates}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  <Trash2 size={20} />
                  Supprimer {duplicates.duplicates.length} Doublon(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Name Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Créer une Archive</h2>
              <button
                onClick={() => {
                  setShowArchiveModal(false);
                  setArchiveName('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'archive *
                </label>
                <input
                  type="text"
                  value={archiveName}
                  onChange={(e) => setArchiveName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  placeholder="Ex: Archive Janvier 2025, Ventes Saisonnières..."
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-2">
                  Donnez un nom significatif à cette archive pour la retrouver facilement
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Résumé de l'archive :</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• {salesData.length} ventes</li>
                  <li>• {stats.totalPoids.toFixed(2)} kg total</li>
                  <li>• {stats.totalRevenue.toFixed(2)} DH de chiffre d'affaires</li>
                  <li>• {stats.uniqueClients} clients</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowArchiveModal(false);
                  setArchiveName('');
                }}
                className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmArchive}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                disabled={!archiveName.trim()}
              >
                <Archive size={20} />
                Créer l'Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Importer depuis Excel</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="text-center mb-6">
                <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600 mb-2">
                  Sélectionnez un fichier Excel (.xlsx, .xls) pour importer les données
                </p>
                <p className="text-sm text-gray-500">
                  Vous pourrez choisir de remplacer ou d'ajouter les données
                </p>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={importFromExcel}
                  className="w-full"
                  id="excel-import"
                />
                <label htmlFor="excel-import" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="text-gray-400" size={24} />
                    <span className="text-gray-600">Cliquez pour sélectionner un fichier</span>
                    <span className="text-sm text-gray-500">.xlsx, .xls, .csv</span>
                  </div>
                </label>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Options d'importation :</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>Remplacer</strong> - Efface toutes les données existantes</li>
                  <li>• <strong>Ajouter</strong> - Garde les données existantes et ajoute les nouvelles</li>
                </ul>
              </div>

              <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">Instructions :</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• La première ligne doit contenir les en-têtes des colonnes</li>
                  <li>• Les colonnes seront mappées automatiquement par nom</li>
                  <li>• Sauvegardez vos données avant l'importation</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Manager Modal */}
      {showArchiveManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Gestionnaire d'Archives</h2>
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
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Chargement des archives...</p>
                </div>
              ) : archives.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Aucune archive trouvée</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Créez votre première archive pour sauvegarder l'état actuel de vos données
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {archives.map((archive) => (
                    <div key={archive.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-gray-800">{archive.archiveName}</h3>
                          <p className="text-sm text-gray-600">
                            Titre: {archive.mainTitle}
                          </p>
                          <p className="text-sm text-gray-600">
                            Créée le: {new Date(archive.date).toLocaleDateString('fr-FR')} à {new Date(archive.date).toLocaleTimeString('fr-FR')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {archive.salesData.length} ventes • {archive.stats.totalPoids.toFixed(2)} kg
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadArchive(archive)}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <FolderOpen size={16} />
                            Charger
                          </button>
                          <button
                            onClick={() => deleteArchive(archive.id, archive.archiveName)}
                            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Trash2 size={16} />
                            Supprimer
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="bg-gray-50 p-2 rounded">
                          <span className="font-medium">CA Total:</span> {archive.stats.totalRevenue.toFixed(2)} DH
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <span className="font-medium">Revenu Net:</span> {archive.stats.netRevenue.toFixed(2)} DH
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <span className="font-medium">Déductions:</span> {archive.stats.totalDeductions.toFixed(2)} DH
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <span className="font-medium">Clients:</span> {archive.stats.uniqueClients}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center p-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                {archives.length} archive(s) trouvée(s)
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowArchiveManager(false)}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Fermer
                </button>
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  <Archive size={20} />
                  Nouvelle Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1800px] mx-auto">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-green-900 via-green-800 to-green-900 rounded-2xl shadow-2xl p-8 mb-6 print:shadow-none print:bg-white">
          <EditableTitle
            value={mainTitle}
            onChange={setMainTitle}
            className="text-4xl font-bold text-white text-center mb-6 print:text-gray-900"
            placeholder="Titre principal"
          />

          {/* Statistics Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6 print:hidden">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <Package className="text-green-300" size={24} />
                <span className="text-green-200 text-sm font-medium">Total Poids</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalPoids.toFixed(2)} kg</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="text-yellow-300" size={24} />
                <span className="text-green-200 text-sm font-medium">CA Total</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalRevenue.toFixed(2)} DH</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="text-red-300" size={24} />
                <span className="text-green-200 text-sm font-medium">Déductions</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalDeductions.toFixed(2)} DH</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="text-blue-300" size={24} />
                <span className="text-green-200 text-sm font-medium">Revenu Net</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.netRevenue.toFixed(2)} DH</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="text-purple-300" size={24} />
                <span className="text-green-200 text-sm font-medium">Prix Moyen/kg</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.avgPrice} DH</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <Users className="text-orange-300" size={24} />
                <span className="text-green-200 text-sm font-medium">Clients</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.uniqueClients}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center print:hidden">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Save size={20} />
              Sauvegarder
            </button>
            
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Download size={20} />
              Exporter Excel
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Upload size={20} />
              Importer Excel
            </button>

            <button
              onClick={generatePDF}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Printer size={20} />
              Générer PDF
            </button>

            <button
              onClick={handleSaveAllToFirebase}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Save size={20} />
              Tout Sauvegarder
            </button>

            <button
              onClick={openArchiveManager}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <History size={20} />
              Gérer Archives
            </button>

            <button
              onClick={handleArchive}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Archive size={20} />
              Créer Archive
            </button>

            <button
              onClick={removeDuplicates}
              className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Copy size={20} />
              Supprimer Doublons
            </button>

            <button
              onClick={clearAllData}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <Trash2 size={20} />
              Effacer Toutes les Données
            </button>
          </div>
        </div>

        {/* Sales Tracking Table */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 print:shadow-none">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <EditableTitle
              value={sectionTitle}
              onChange={setSectionTitle}
              className="text-2xl font-bold text-gray-800"
              placeholder="Titre de section"
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
                  className="pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none w-full md:w-64"
                />
              </div>

              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              >
                <option value="all">Tous les clients</option>
                {uniqueClients.map(client => (
                  <option key={client} value={client}>{client}</option>
                ))}
              </select>

              <select
                value={filterVariete}
                onChange={(e) => setFilterVariete(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              >
                <option value="all">Toutes variétés</option>
                {uniqueVarietes.map(variete => (
                  <option key={variete} value={variete}>{variete}</option>
                ))}
              </select>

              <button
                onClick={addRow}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                <Plus size={20} />
                Ajouter
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border-2 border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                  <th className="border border-green-500 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.date} onChange={(val) => setHeaders({ ...headers, date: val })} />
                  </th>
                  <th className="border border-green-500 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.clients} onChange={(val) => setHeaders({ ...headers, clients: val })} />
                  </th>
                  <th className="border border-green-500 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.poidsKg} onChange={(val) => setHeaders({ ...headers, poidsKg: val })} />
                  </th>
                  <th className="border border-green-500 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.prixKg} onChange={(val) => setHeaders({ ...headers, prixKg: val })} />
                  </th>
                  <th className="border border-green-500 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.prixTotal} onChange={(val) => setHeaders({ ...headers, prixTotal: val })} />
                  </th>
                  <th className="border border-green-500 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.payer} onChange={(val) => setHeaders({ ...headers, payer: val })} />
                  </th>
                  <th className="border border-green-500 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.deductions} onChange={(val) => setHeaders({ ...headers, deductions: val })} />
                  </th>
                  <th className="border border-green-500 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.netPayant} onChange={(val) => setHeaders({ ...headers, netPayant: val })} />
                  </th>
                  <th className="border border-green-500 p-3 text-sm font-semibold">
                    <EditableHeader value={headers.variete} onChange={(val) => setHeaders({ ...headers, variete: val })} />
                  </th>
                  <th className="border border-green-500 p-3 text-sm font-semibold print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, index) => {
                  const actualIndex = salesData.findIndex(r => r === row);
                  return (
                    <tr key={actualIndex} className="hover:bg-green-50 transition-colors duration-150">
                      <td className="border border-gray-300 p-2">
                        <input
                          type="text"
                          value={row.date}
                          onChange={(e) => updateCell(actualIndex, 'date', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-green-500 focus:outline-none text-sm"
                          placeholder="JJ/MM/AAAA"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <input
                          type="text"
                          value={row.clients}
                          onChange={(e) => updateCell(actualIndex, 'clients', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-green-500 focus:outline-none text-sm"
                          placeholder="Nom du client"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <input
                          type="number"
                          value={row.poidsKg}
                          onChange={(e) => updateCell(actualIndex, 'poidsKg', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-green-500 focus:outline-none text-sm"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <input
                          type="number"
                          value={row.prixKg}
                          onChange={(e) => updateCell(actualIndex, 'prixKg', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-green-500 focus:outline-none text-sm"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="border border-gray-300 p-2 bg-blue-50">
                        <input
                          type="text"
                          value={row.prixTotal}
                          readOnly
                          className="w-full p-2 bg-blue-50 font-bold text-blue-700 rounded text-sm text-center"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <input
                          type="text"
                          value={row.payer}
                          onChange={(e) => updateCell(actualIndex, 'payer', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-green-500 focus:outline-none text-sm"
                          placeholder="Payeur"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <input
                          type="number"
                          value={row.deductions}
                          onChange={(e) => updateCell(actualIndex, 'deductions', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-green-500 focus:outline-none text-sm"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="border border-gray-300 p-2 bg-green-50">
                        <input
                          type="text"
                          value={row.netPayant}
                          readOnly
                          className="w-full p-2 bg-green-50 font-bold text-green-700 rounded text-sm text-center"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        <select
                          value={row.variete}
                          onChange={(e) => updateCell(actualIndex, 'variete', e.target.value)}
                          className="w-full p-2 rounded border border-gray-300 focus:border-green-500 focus:outline-none text-sm"
                        >
                          <option value="HASS">HASS</option>
                          <option value="FUERTE ZUTANO">FUERTE ZUTANO</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </td>
                      <td className="border border-gray-300 p-2 text-center print:hidden">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => saveEntryToFirebase(row, actualIndex)}
                            className="text-green-600 hover:text-green-800 hover:bg-green-50 p-2 rounded transition-colors duration-150"
                            title="Sauvegarder dans la base de données"
                          >
                            <Save size={20} />
                          </button>
                          <button
                            onClick={() => deleteRow(actualIndex)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded transition-colors duration-150"
                            disabled={salesData.length === 1}
                            title="Supprimer"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-block bg-white rounded-lg shadow-lg px-8 py-4 print:shadow-none">
            <p className="text-gray-600 text-sm font-medium">
              © 2024/2025 - Système de Gestion des Ventes d'Avocats
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Plateforme professionnelle de suivi et d'analyse des ventes
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
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          input, select {
            border: none !important;
            background: transparent !important;
          }
          .bg-gradient-to-r,
          .bg-gradient-to-br,
          .bg-gradient-to-l {
            background: white !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}