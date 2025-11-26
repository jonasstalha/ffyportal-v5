import React, { useEffect, useState } from 'react';
import { FilePlus, Plus, RefreshCw, Save, Trash2, Archive, Edit, X, Menu, ChevronDown, AlertCircle, CheckCircle, Download, Upload, Search, Eye, Share2, Settings } from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../lib/firebase";
import { getStorage } from "firebase/storage";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy
} from 'firebase/firestore';

// Import jsPDF correctly
import jsPDF from 'jspdf';

// Enhanced media queries hook for all screen sizes
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
};

interface ReceptionRow {
  date: string;
  matricule: string;
  chauffeur: string;
  poidsNetUsine: string;
  dechet: string;
  nlotInterne: string;
  feurte: string;
  poidsNetTicket: string;
  ecart: string;
  leLieu: string;
  variete: string;
}

interface ReceptionFormData {
  id?: string;
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
  status?: 'draft' | 'submitted' | 'archived';
}

// Default options that will be synced with Firebase
const DEFAULT_VARIETY_OPTIONS = ['HASS', 'ZUTANO', 'DECHET', 'FUERTY'];
const DEFAULT_MATRICULE_OPTIONS = ['23071 A 59', '20252 B 26', '33971 A 59', '15427 A 51', '630 A 78', '12577 A 45'];
const DEFAULT_CHAUFFEUR_OPTIONS = ['MOHAMMED', 'ABDELLAH', 'SOUHAIL', 'IMADD', 'TRACH', 'IMAAD'];
const DEFAULT_LIEU_OPTIONS = [
  'lmnzah', 'ain ariss', 'sid taibi', 'sale', 'bouknadel', 'rabat', 
  'skhirat', 'laarjat', 'tiflet', 'ould agil', 'dar jdida', 'DELLALHA', 
  'TNIN SID EL YAMANI', 'TNIN AIN FELFEL', 'OUKAD', 'LAANABSA', 'BELIL', 
  'laawamra', 'MOULAY BOUSLHAM', 'oulad mesbah', 'oulad berjal'
];

// Firebase collections for options
const OPTIONS_COLLECTIONS = {
  variety: 'varietyOptions',
  matricule: 'matriculeOptions',
  chauffeur: 'chauffeurOptions',
  lieu: 'lieuOptions'
};

const defaultReceptionForm = (category: 'conventionnel' | 'biologique'): ReceptionFormData => ({
  category,
  header: {
    title: 'Reception Avocat 2025/2026',
    dateReport: new Date().toISOString().split('T')[0],
    responsable: auth.currentUser?.email || '',
    bonLivraison: '',
    compagne: '2025/2026'
  },
  rows: Array.from({ length: 1 }, () => ({
    date: new Date().toISOString().split('T')[0],
    matricule: '',
    chauffeur: '',
    poidsNetUsine: '',
    dechet: '',
    feurte: '',
    poidsNetTicket: '',
    ecart: '',
    leLieu: '',
    variete: category === 'biologique' ? 'HASS BIO' : 'HASS CONV'
  })),
  status: 'draft'
});

// Options Management Modal Component
const OptionsManagementModal = ({
  isOpen,
  onClose,
  options,
  onOptionsUpdate,
  title,
  placeholder
}: {
  isOpen: boolean;
  onClose: () => void;
  options: string[];
  onOptionsUpdate: (options: string[]) => void;
  title: string;
  placeholder: string;
}) => {
  const [localOptions, setLocalOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    setLocalOptions(options);
  }, [options]);

  const addOption = () => {
    if (newOption.trim() && !localOptions.includes(newOption.trim())) {
      const updatedOptions = [...localOptions, newOption.trim()];
      setLocalOptions(updatedOptions);
      setNewOption('');
    }
  };

  const removeOption = (optionToRemove: string) => {
    const updatedOptions = localOptions.filter(opt => opt !== optionToRemove);
    setLocalOptions(updatedOptions);
  };

  const saveOptions = () => {
    onOptionsUpdate(localOptions);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addOption();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-hidden p-6">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-200 outline-none"
            />
            <button
              onClick={addOption}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Ajouter
            </button>
          </div>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            {localOptions.map((option, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
              >
                <span className="text-gray-700">{option}</span>
                <button
                  onClick={() => removeOption(option)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {localOptions.length === 0 && (
              <div className="p-4 text-center text-gray-500">
                Aucune option disponible
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
          >
            Annuler
          </button>
          <button
            onClick={saveOptions}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced Combobox Component with options management
const Combobox = ({
  value,
  onChange,
  options,
  placeholder = "Taper ou sélectionner...",
  className = "",
  onManageOptions
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  onManageOptions?: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [filteredOptions, setFilteredOptions] = useState(options);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    const filtered = options.filter(option =>
      option.toLowerCase().includes(newValue.toLowerCase())
    );
    setFilteredOptions(filtered);

    if (!isOpen) {
      setIsOpen(true);
    }

    if (options.includes(newValue)) {
      onChange(newValue);
    }
  };

  const handleSelect = (option: string) => {
    setInputValue(option);
    onChange(option);
    setIsOpen(false);
    setFilteredOptions(options);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setIsOpen(false);
      if (!options.includes(inputValue) && value) {
        setInputValue(value);
      }
    }, 200);
  };

  const handleFocus = () => {
    setFilteredOptions(options);
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredOptions.length > 0 && !options.includes(inputValue)) {
      handleSelect(filteredOptions[0]);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition outline-none pr-20"
      />
      <div className="absolute inset-y-0 right-0 flex items-center">
        {onManageOptions && (
          <button
            type="button"
            onClick={onManageOptions}
            className="p-1 text-gray-400 hover:text-gray-600 mr-1"
            title="Gérer les options"
          >
            <Settings size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="h-full px-2 text-gray-400 hover:text-gray-600 border-l border-gray-200"
        >
          <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredOptions.map((option, index) => (
            <div
              key={index}
              onClick={() => handleSelect(option)}
              className="px-3 py-2 cursor-pointer hover:bg-green-50 hover:text-green-700 transition border-b border-gray-100 last:border-b-0"
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function SuiviReception() {
  const [activeTab, setActiveTab] = useState<'conventionnel' | 'biologique'>('conventionnel');
  const [form, setForm] = useState<ReceptionFormData>(defaultReceptionForm('conventionnel'));
  const [archivedForms, setArchivedForms] = useState<ReceptionFormData[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [editingArchiveId, setEditingArchiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'responsable'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoadingArchives, setIsLoadingArchives] = useState(false);
  const [allReceptionsData, setAllReceptionsData] = useState<ReceptionFormData[]>([]);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Options state with Firebase sync
  const [varietyOptions, setVarietyOptions] = useState<string[]>(DEFAULT_VARIETY_OPTIONS);
  const [matriculeOptions, setMatriculeOptions] = useState<string[]>(DEFAULT_MATRICULE_OPTIONS);
  const [chauffeurOptions, setChauffeurOptions] = useState<string[]>(DEFAULT_CHAUFFEUR_OPTIONS);
  const [lieuOptions, setLieuOptions] = useState<string[]>(DEFAULT_LIEU_OPTIONS);

  // Options management modals
  const [showVarietyModal, setShowVarietyModal] = useState(false);
  const [showMatriculeModal, setShowMatriculeModal] = useState(false);
  const [showChauffeurModal, setShowChauffeurModal] = useState(false);
  const [showLieuModal, setShowLieuModal] = useState(false);

  // Enhanced media queries for all screen sizes including small PCs
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
  const isSmallDesktop = useMediaQuery('(min-width: 1025px) and (max-width: 1280px)');
  const isMediumDesktop = useMediaQuery('(min-width: 1281px) and (max-width: 1440px)');
  const isLargeDesktop = useMediaQuery('(min-width: 1441px)');

  // Get current screen size for responsive adjustments
  const getScreenSize = () => {
    if (isMobile) return 'mobile';
    if (isTablet) return 'tablet';
    if (isSmallDesktop) return 'small-desktop';
    if (isMediumDesktop) return 'medium-desktop';
    if (isLargeDesktop) return 'large-desktop';
    return 'desktop';
  };

  const screenSize = getScreenSize();

  // Firebase options management functions
  const loadOptionsFromFirebase = async (collectionName: string, defaultOptions: string[]): Promise<string[]> => {
    try {
      const optionsRef = collection(db, collectionName);
      const querySnapshot = await getDocs(optionsRef);
      
      if (querySnapshot.empty) {
        // If no options exist, create default ones
        await Promise.all(defaultOptions.map(async (option) => {
          await addDoc(optionsRef, { name: option, createdAt: serverTimestamp() });
        }));
        return defaultOptions;
      }
      
      const options = querySnapshot.docs.map(doc => doc.data().name);
      return options.length > 0 ? options : defaultOptions;
    } catch (error) {
      console.error(`Error loading ${collectionName}:`, error);
      return defaultOptions;
    }
  };

  const saveOptionsToFirebase = async (collectionName: string, options: string[]) => {
    try {
      // Clear existing options
      const optionsRef = collection(db, collectionName);
      const querySnapshot = await getDocs(optionsRef);
      
      await Promise.all(querySnapshot.docs.map(async (docSnap) => {
        await deleteDoc(doc(db, collectionName, docSnap.id));
      }));
      
      // Add new options
      await Promise.all(options.map(async (option) => {
        await addDoc(optionsRef, { 
          name: option, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }));
      
      return true;
    } catch (error) {
      console.error(`Error saving ${collectionName}:`, error);
      return false;
    }
  };

  // Load all options on component mount
  useEffect(() => {
    const loadAllOptions = async () => {
      try {
        const [
          varietyOpts,
          matriculeOpts,
          chauffeurOpts,
          lieuOpts
        ] = await Promise.all([
          loadOptionsFromFirebase(OPTIONS_COLLECTIONS.variety, DEFAULT_VARIETY_OPTIONS),
          loadOptionsFromFirebase(OPTIONS_COLLECTIONS.matricule, DEFAULT_MATRICULE_OPTIONS),
          loadOptionsFromFirebase(OPTIONS_COLLECTIONS.chauffeur, DEFAULT_CHAUFFEUR_OPTIONS),
          loadOptionsFromFirebase(OPTIONS_COLLECTIONS.lieu, DEFAULT_LIEU_OPTIONS)
        ]);

        setVarietyOptions(varietyOpts);
        setMatriculeOptions(matriculeOpts);
        setChauffeurOptions(chauffeurOpts);
        setLieuOptions(lieuOpts);
      } catch (error) {
        console.error('Error loading options:', error);
        showNotification('error', 'Erreur lors du chargement des options');
      }
    };

    loadAllOptions();
  }, []);

  // Enhanced fetch all receptions with real data
  const fetchAllReceptions = async () => {
    setIsLoadingArchives(true);
    try {
      const receptionsRef = collection(db, "receptions");
      const querySnapshot = await getDocs(receptionsRef);
      const allData: ReceptionFormData[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as ReceptionFormData));

      setAllReceptionsData(allData);

      // Filter by active tab
      const filteredData = allData.filter(item => item.category === activeTab);

      // Sort data
      const sortedData = filteredData.sort((a, b) => {
        if (sortBy === 'date') {
          return sortOrder === 'asc'
            ? a.header.dateReport.localeCompare(b.header.dateReport)
            : b.header.dateReport.localeCompare(a.header.dateReport);
        } else {
          return sortOrder === 'asc'
            ? (a.header.responsable || '').localeCompare(b.header.responsable || '')
            : (b.header.responsable || '').localeCompare(a.header.responsable || '');
        }
      });

      setArchivedForms(sortedData);
    } catch (err: any) {
      console.error("❌ Error loading Firestore data:", err);
      showNotification("error", "Erreur lors du chargement des réceptions: " + err.message);
    } finally {
      setIsLoadingArchives(false);
    }
  };

  // Enhanced archive fetching
  useEffect(() => {
    fetchAllReceptions();
  }, [activeTab, sortBy, sortOrder]);

  const switchTab = (tab: 'conventionnel' | 'biologique') => {
    setActiveTab(tab);
    setForm(defaultReceptionForm(tab));
    setEditingArchiveId(null);
    setShowMobileMenu(false);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const updateForm = (updates: Partial<ReceptionFormData>) => {
    setForm(prev => ({
      ...prev,
      header: { ...prev.header, ...(updates.header || {}) },
      rows: updates.rows || prev.rows,
      ...updates
    }));
  };

  const blankRow = (): ReceptionRow => ({
    date: new Date().toISOString().split('T')[0],
    matricule: '',
    chauffeur: '',
    poidsNetUsine: '',
    dechet: '',
    nlotInterne: '',
    feurte: '',
    poidsNetTicket: '',
    ecart: '',
    leLieu: '',
    variete: activeTab === 'biologique' ? 'HASS BIO' : 'HASS CONV'
  });

  const updateRow = (index: number, updates: Partial<ReceptionRow>) => {
    const rows = [...form.rows];
    if (!rows[index]) rows[index] = blankRow();
    rows[index] = { ...rows[index], ...updates };

    // Calculate ecart
    const pnUsine = parseFloat(rows[index].poidsNetUsine) || 0;
    const feurte = parseFloat(rows[index].feurte) || 0;
    const pnTicket = parseFloat(rows[index].poidsNetTicket) || 0;
    const dechet = parseFloat(rows[index].dechet) || 0;
    rows[index].ecart = (pnUsine + dechet + feurte - pnTicket).toFixed(2);

    updateForm({ rows });
  };

  // Helper function to extract numbers from Bon Livraison for proper sorting
  const extractNumberFromBonLivraison = (bonLivraison: string | undefined): number => {
    if (!bonLivraison) return 0;
    
    const numbers = bonLivraison.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      return parseInt(numbers[0], 10);
    }
    
    return 0;
  };

  const addRow = () => {
    updateForm({ rows: [...form.rows, blankRow()] });
    showNotification('success', 'Ligne ajoutée');
  };

  const removeLastRow = () => {
    if (form.rows.length <= 1) {
      showNotification('error', 'Il doit rester au moins une ligne');
      return;
    }
    updateForm({ rows: form.rows.slice(0, -1) });
    showNotification('success', 'Ligne supprimée');
  };

  const removeSpecificRow = (index: number) => {
    if (form.rows.length <= 1) {
      showNotification('error', 'Il doit rester au moins une ligne');
      return;
    }
    const newRows = form.rows.filter((_, i) => i !== index);
    updateForm({ rows: newRows });
    showNotification('success', 'Ligne supprimée');
  };

  const calculateTotals = () => {
    const totalPoidsNetUsine = form.rows.reduce((sum, r) => sum + (parseFloat(r.poidsNetUsine) || 0), 0);
    const totalDechet = form.rows.reduce((sum, r) => sum + (parseFloat(r.dechet) || 0), 0);
    const totalFeurte = form.rows.reduce((sum, r) => sum + (parseFloat(r.feurte) || 0), 0);
    const totalPoidsNetTicket = form.rows.reduce((sum, r) => sum + (parseFloat(r.poidsNetTicket) || 0), 0);
    const totalEcart = totalPoidsNetUsine + totalDechet + totalFeurte - totalPoidsNetTicket;
    return { totalPoidsNetUsine, totalDechet, totalFeurte, totalPoidsNetTicket, totalEcart };
  };

  const computeEcartRow = (r: ReceptionRow) => {
    const pnUsine = parseFloat(r.poidsNetUsine) || 0;
    const feurte = parseFloat(r.feurte) || 0;
    const pnTicket = parseFloat(r.poidsNetTicket) || 0;
    const dechet = parseFloat(r.dechet) || 0;
    return pnUsine + dechet + feurte - pnTicket;
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

  const formatFirestoreDate = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR');
    } catch {
      return '';
    }
  };

  // Enhanced CRUD operations - Single save function
  const saveReception = async (status: 'draft' | 'submitted' = 'submitted') => {
    if (status === 'submitted' && !form.rows.some(r => r.poidsNetUsine)) {
      showNotification('error', 'Veuillez remplir au moins une ligne avant de soumettre');
      return;
    }

    setIsLoading(true);
    try {
      const dataToSave = {
        ...form,
        userId: auth.currentUser?.uid,
        status,
        createdAt: editingArchiveId ? form.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      let savedDocId = editingArchiveId;

if (editingArchiveId) {
  // SAFE UPDATE or CREATE if missing
  const docRef = doc(db, "receptions", editingArchiveId);

  await setDoc(docRef, dataToSave, { merge: true });

  showNotification(
    'success',
    `Réception ${status === 'draft' ? 'brouillon' : ''} mise à jour`
  );

  savedDocId = editingArchiveId;

} else {
  // CREATE new document
  const newDoc = await addDoc(collection(db, "receptions"), dataToSave);
  savedDocId = newDoc.id;

  showNotification(
    'success',
    `Réception ${status === 'draft' ? 'brouillon' : ''} enregistrée`
  );
}


      // Refresh all data
      await fetchAllReceptions();

      if (status === 'submitted') {
        setForm(defaultReceptionForm(activeTab));
        setEditingArchiveId(null);
      } else {
        setEditingArchiveId(savedDocId || null);
      }

    } catch (error: any) {
      console.error("Firestore error:", error);
      showNotification('error', `Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced load archive function
  const loadArchive = (archived: ReceptionFormData) => {
    setForm(archived);
    setEditingArchiveId(archived.id || null);
    setShowArchive(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotification('success', 'Réception chargée pour modification');
  };

  // Enhanced duplicate function
  const duplicateArchive = async (archived: ReceptionFormData) => {
    try {
      const duplicatedData = {
        ...archived,
        id: undefined,
        header: {
          ...archived.header,
          bonLivraison: `${archived.header.bonLivraison} - Copie`,
          dateReport: new Date().toISOString().split('T')[0],
          responsable: auth.currentUser?.email || ''
        },
        rows: archived.rows.map(row => ({
          ...row,
          date: new Date().toISOString().split('T')[0]
        })),
        userId: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'draft' as const
      };

      await addDoc(collection(db, "receptions"), duplicatedData);

      await fetchAllReceptions();
      showNotification('success', 'Réception dupliquée avec succès');
    } catch (error: any) {
      showNotification('error', `Erreur duplication: ${error.message}`);
    }
  };

  // Enhanced delete function
  const deleteArchive = async (id: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer définitivement cette réception ?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, "receptions", id));
      await fetchAllReceptions();
      showNotification('success', 'Réception supprimée définitivement');

      // Reset form if the deleted archive was being edited
      if (editingArchiveId === id) {
        setForm(defaultReceptionForm(activeTab));
        setEditingArchiveId(null);
      }
    } catch (error: any) {
      console.error('Error deleting reception:', error);
      showNotification('error', `Erreur lors de la suppression: ${error.message}`);
    }
  };

  // Enhanced reset function
  const resetForm = () => {
    if (editingArchiveId && !window.confirm('Voulez-vous vraiment abandonner les modifications ? Les changements non sauvegardés seront perdus.')) {
      return;
    }
    setForm(defaultReceptionForm(activeTab));
    setEditingArchiveId(null);
    showNotification('success', 'Formulaire réinitialisé');
  };

  // View archive without editing
  const viewArchive = (archived: ReceptionFormData) => {
    setForm(archived);
    setEditingArchiveId(null); // Set to null for view mode
    setShowArchive(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotification('info', 'Mode consultation - Cliquez sur "Nouveau" pour créer une nouvelle réception');
  };

  // Options management handlers
  const handleUpdateVarietyOptions = async (newOptions: string[]) => {
    const success = await saveOptionsToFirebase(OPTIONS_COLLECTIONS.variety, newOptions);
    if (success) {
      setVarietyOptions(newOptions);
      showNotification('success', 'Options de variété mises à jour');
    } else {
      showNotification('error', 'Erreur lors de la mise à jour des options');
    }
  };

  const handleUpdateMatriculeOptions = async (newOptions: string[]) => {
    const success = await saveOptionsToFirebase(OPTIONS_COLLECTIONS.matricule, newOptions);
    if (success) {
      setMatriculeOptions(newOptions);
      showNotification('success', 'Options de matricule mises à jour');
    } else {
      showNotification('error', 'Erreur lors de la mise à jour des options');
    }
  };

  const handleUpdateChauffeurOptions = async (newOptions: string[]) => {
    const success = await saveOptionsToFirebase(OPTIONS_COLLECTIONS.chauffeur, newOptions);
    if (success) {
      setChauffeurOptions(newOptions);
      showNotification('success', 'Options de chauffeur mises à jour');
    } else {
      showNotification('error', 'Erreur lors de la mise à jour des options');
    }
  };

  const handleUpdateLieuOptions = async (newOptions: string[]) => {
    const success = await saveOptionsToFirebase(OPTIONS_COLLECTIONS.lieu, newOptions);
    if (success) {
      setLieuOptions(newOptions);
      showNotification('success', 'Options de lieu mises à jour');
    } else {
      showNotification('error', 'Erreur lors de la mise à jour des options');
    }
  };

  // Filter archives based on search term
  const filteredArchives = archivedForms.filter(archived =>
    archived.header.responsable?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    archived.header.bonLivraison?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    archived.header.dateReport?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    archived.rows.some(row =>
      row.matricule?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.chauffeur?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.leLieu?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Statistics for dashboard
  const getStatistics = () => {
    const totalReceptions = allReceptionsData.length;
    const conventionnelCount = allReceptionsData.filter(r => r.category === 'conventionnel').length;
    const biologiqueCount = allReceptionsData.filter(r => r.category === 'biologique').length;
    const totalRows = allReceptionsData.reduce((sum, r) => sum + r.rows.length, 0);

    return {
      totalReceptions,
      conventionnelCount,
      biologiqueCount,
      totalRows
    };
  };

  const stats = getStatistics();

  // SIMPLE PDF GENERATION WITHOUT AUTOTABLE
  const generatePDF = async (forWhatsApp: boolean = false): Promise<Blob | null> => {
    try {
      if (forWhatsApp) {
        showNotification('success', 'Préparation du PDF pour WhatsApp...');
      } else {
        showNotification('success', 'Génération du PDF en cours...');
      }

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
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // ENHANCED Header with better contrast
      doc.setFillColor(34, 84, 61);
      doc.rect(0, 0, pageWidth, 40, 'F');

      // ENHANCED Title with better spacing
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`RAPPORT DE RÉCEPTION AVOCAT`, pageWidth / 2, 18, { align: 'center' });

      doc.setFontSize(16);
      doc.text(`Campagne 2025/2026`, pageWidth / 2, 28, { align: 'center' });

      doc.setFontSize(14);
      doc.text(`${activeTab === 'biologique' ? 'BIOLOGIQUE' : 'CONVENTIONNEL'}`, pageWidth / 2, 35, { align: 'center' });

      yPos = 45;

      // ENHANCED Information Table
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 25, 'F');
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.5);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 25);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);

      doc.text('Date Rapport:', margin + 8, yPos + 9);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(form.header.dateReport), margin + 35, yPos + 9);

      doc.setFont('helvetica', 'bold');
      doc.text('Responsable:', margin + 90, yPos + 9);
      doc.setFont('helvetica', 'normal');
      doc.text(form.header.responsable || 'Non spécifié', margin + 120, yPos + 9);

      doc.setFont('helvetica', 'bold');
      doc.text('Bon Livraison:', margin + 180, yPos + 9);
      doc.setFont('helvetica', 'normal');
      doc.text(form.header.bonLivraison || 'N/A', margin + 215, yPos + 9);

      doc.setFont('helvetica', 'bold');
      doc.text('Site:', margin + 8, yPos + 18);
      doc.setFont('helvetica', 'normal');
      doc.text('Fruits For You', margin + 25, yPos + 18);

      doc.setFont('helvetica', 'bold');
      doc.text('Compagne:', margin + 90, yPos + 18);
      doc.setFont('helvetica', 'normal');
      doc.text('2025/2026', margin + 120, yPos + 18);

      doc.setFont('helvetica', 'bold');
      doc.text('Total Lignes:', margin + 180, yPos + 18);
      doc.setFont('helvetica', 'normal');
      doc.text(form.rows.length.toString(), margin + 215, yPos + 18);

      yPos += 30;

      // ENHANCED Table data preparation
      const totals = calculateTotals();
      const tableData = form.rows.map(r => [
        formatDate(r.date),
        r.matricule || '-',
        r.chauffeur || '-',
        r.nlotInterne || '-',
        (parseFloat(r.poidsNetUsine) || 0).toFixed(0),
        (parseFloat(r.dechet) || 0).toFixed(0),
        (parseFloat(r.feurte) || 0).toFixed(0),
        (parseFloat(r.poidsNetTicket) || 0).toFixed(0),
        computeEcartRow(r).toFixed(0),
        r.leLieu || '-',
        r.variete || '-'
      ]);

      // ENHANCED Totals row
      tableData.push([
        'TOTAL GÉNÉRAL',
        '',
        '',
        '',
        totals.totalPoidsNetUsine.toFixed(0),
        totals.totalDechet.toFixed(0),
        totals.totalFeurte.toFixed(0),
        totals.totalPoidsNetTicket.toFixed(0),
        totals.totalEcart.toFixed(0),
        '',
        ''
      ]);

      // ENHANCED Main table with better styling
      (doc as any).autoTable({
        startY: yPos,
        head: [
          [
            'DATE',
            'MATRICULE',
            'CHAUFFEUR',
            'N° LOT INTERNE',
            'POIDS NET USINE',
            'DÉCHET',
            'FUERTE',
            'POIDS NET TICKET',
            'ECART',
            'LIEU',
            'VARIÉTÉ'
          ]
        ],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [34, 84, 61],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 4,
          lineWidth: 0.3
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          halign: 'center',
          lineWidth: 0.3,
          textColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        styles: {
          lineWidth: 0.3,
          lineColor: [100, 100, 100]
        },
        didParseCell: function (data: any) {
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [139, 195, 74];
            data.cell.styles.textColor = [0, 0, 0];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 9;
          }
          
          if (data.column.index === 8 && data.row.index < tableData.length - 1) {
            const ecartValue = parseFloat(data.cell.raw);
            if (ecartValue < 0) {
              data.cell.styles.fillColor = [255, 230, 230];
              data.cell.styles.textColor = [200, 0, 0];
            }
          }
        },
        margin: { left: margin, right: margin }
      });

      // ENHANCED Footer
      const finalY = pageHeight - 20;
      doc.setFillColor(34, 84, 61);
      doc.rect(0, finalY, pageWidth, 20, 'F');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);

      const currentDate = new Date().toLocaleDateString('fr-FR');
      const currentTime = new Date().toLocaleTimeString('fr-FR');
      
      doc.text(
        `Fruits For You - Système de Gestion des Réceptions - Généré le ${currentDate} à ${currentTime}`,
        pageWidth / 2,
        finalY + 8,
        { align: 'center' }
      );

      doc.text(
        `Page 1/1 - ${form.rows.length} lignes traitées`,
        pageWidth / 2,
        finalY + 14,
        { align: 'center' }
      );

      if (forWhatsApp) {
        const pdfBlob = doc.output('blob');
        return pdfBlob;
      } else {
        const filename = `Reception_Avocat_${activeTab}_${form.header.compagne}_${formatDate(form.header.dateReport)}.pdf`;
        doc.save(filename);
        showNotification('success', 'PDF généré avec succès');
        return null;
      }
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showNotification('error', `Erreur lors de la génération du PDF: ${error.message}`);
      return null;
    }
  };

  // Enhanced WhatsApp sharing
  const sendReportToWhatsApp = async () => {
    if (!form.rows.some(r => r.poidsNetUsine)) {
      showNotification('error', 'Veuillez remplir au moins une ligne avant de partager');
      return;
    }

    setIsSendingWhatsApp(true);
    try {
      showNotification('info', 'Préparation du PDF...');

      const pdfBlob = await generatePDF(true);
      if (!pdfBlob) {
        throw new Error("Échec de la génération du PDF");
      }

      showNotification('info', 'Téléversement du PDF...');

      const storage = getStorage();
      const fileName = `reports/Rapport_${Date.now()}.pdf`;
      const pdfRef = ref(storage, fileName);
      await uploadBytes(pdfRef, pdfBlob);
      const fileLink = await getDownloadURL(pdfRef);

      const totals = calculateTotals();
      const message =
        `🍋 *RAPPORT RÉCEPTION AVOCAT* 🍋\n\n` +
        `*Type:* ${activeTab === 'biologique' ? 'BIOLOGIQUE 🌱' : 'CONVENTIONNEL'}\n` +
        `*Date:* ${formatDate(form.header.dateReport)}\n` +
        `*Responsable:* ${form.header.responsable || 'Non spécifié'}\n` +
        `*Bon Livraison:* ${form.header.bonLivraison || 'N/A'}\n` +
        `*Nombre de Lignes:* ${form.rows.length}\n\n` +
        `⚖️ *TOTAUX* ⚖️\n` +
        `• Poids Net Usine: ${totals.totalPoidsNetUsine.toFixed(0)} kg\n` +
        `• Déchet: ${totals.totalDechet.toFixed(0)} kg\n` +
        `• Feurte: ${totals.totalFeurte.toFixed(0)} kg\n` +
        `• Poids Net Ticket: ${totals.totalPoidsNetTicket.toFixed(0)} kg\n` +
        `• Écart Total: ${totals.totalEcart.toFixed(0)} kg\n\n` +
        `📄 *RAPPORT COMPLET:*\n${fileLink}\n\n` +
        `_Généré automatiquement par Fruits For You_`;

      const phoneNumber = "212601902159";
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappUrl, "_blank");
      showNotification('success', 'Rapport envoyé sur WhatsApp avec succès ✅');

    } catch (error: any) {
      console.error("Erreur lors de l'envoi du rapport:", error);
      showNotification('error', `Erreur lors de l'envoi: ${error.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Responsive container class based on screen size
  const getContainerClass = () => {
    switch (screenSize) {
      case 'mobile':
        return 'max-w-full mx-auto px-3 py-4';
      case 'tablet':
        return 'max-w-6xl mx-auto px-4 py-6';
      case 'small-desktop':
        return 'max-w-7xl mx-auto px-4 py-6';
      case 'medium-desktop':
        return 'max-w-7xl mx-auto px-6 py-8';
      case 'large-desktop':
        return 'max-w-[1800px] mx-auto px-8 py-10';
      default:
        return 'max-w-[1800px] mx-auto px-6 py-8';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Options Management Modals */}
      <OptionsManagementModal
        isOpen={showVarietyModal}
        onClose={() => setShowVarietyModal(false)}
        options={varietyOptions}
        onOptionsUpdate={handleUpdateVarietyOptions}
        title="Gérer les Variétés"
        placeholder="Nouvelle variété..."
      />

      <OptionsManagementModal
        isOpen={showMatriculeModal}
        onClose={() => setShowMatriculeModal(false)}
        options={matriculeOptions}
        onOptionsUpdate={handleUpdateMatriculeOptions}
        title="Gérer les Matricules"
        placeholder="Nouveau matricule..."
      />

      <OptionsManagementModal
        isOpen={showChauffeurModal}
        onClose={() => setShowChauffeurModal(false)}
        options={chauffeurOptions}
        onOptionsUpdate={handleUpdateChauffeurOptions}
        title="Gérer les Chauffeurs"
        placeholder="Nouveau chauffeur..."
      />

      <OptionsManagementModal
        isOpen={showLieuModal}
        onClose={() => setShowLieuModal(false)}
        options={lieuOptions}
        onOptionsUpdate={handleUpdateLieuOptions}
        title="Gérer les Lieux"
        placeholder="Nouveau lieu..."
      />

      {/* Professional Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg border-l-4 shadow-lg ${notification.type === 'success'
              ? 'bg-white border-green-500 text-gray-800'
              : notification.type === 'error'
                ? 'bg-white border-red-500 text-gray-800'
                : 'bg-white border-blue-500 text-gray-800'
            }`}>
            {notification.type === 'success' ? (
              <div className="flex items-center gap-3">
                <CheckCircle size={20} className="text-green-500" />
                <span className="font-medium">{notification.message}</span>
              </div>
            ) : notification.type === 'error' ? (
              <div className="flex items-center gap-3">
                <AlertCircle size={20} className="text-red-500" />
                <span className="font-medium">{notification.message}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Eye size={20} className="text-blue-500" />
                <span className="font-medium">{notification.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setShowMobileMenu(false)}>
          <div className="bg-white h-full w-80 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b bg-gray-800">
              <h3 className="text-xl font-bold text-white">Navigation</h3>
              <button onClick={() => setShowMobileMenu(false)} className="text-white p-2">
                <X size={24} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <button
                onClick={() => switchTab('conventionnel')}
                className={`w-full py-4 px-6 text-left rounded-lg font-semibold border-2 transition-colors ${activeTab === 'conventionnel'
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
              >
                <div className="flex justify-between items-center">
                  <span>Conventionnel</span>
                  <span className={`px-3 py-1 rounded-full text-sm ${activeTab === 'conventionnel' ? 'bg-gray-600' : 'bg-gray-200'
                    }`}>
                    {stats.conventionnelCount}
                  </span>
                </div>
              </button>
              <button
                onClick={() => switchTab('biologique')}
                className={`w-full py-4 px-6 text-left rounded-lg font-semibold border-2 transition-colors ${activeTab === 'biologique'
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
              >
                <div className="flex justify-between items-center">
                  <span>Biologique</span>
                  <span className={`px-3 py-1 rounded-full text-sm ${activeTab === 'biologique' ? 'bg-gray-600' : 'bg-gray-200'
                    }`}>
                    {stats.biologiqueCount}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={getContainerClass()}>
        {/* Mobile Header */}
        <div className="lg:hidden mb-6 bg-white rounded-lg shadow border border-gray-200 p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Réception Avocat</h2>
            <span className="inline-block mt-1 text-sm bg-gray-800 text-white px-3 py-1 rounded font-semibold capitalize">
              {activeTab}
            </span>
            <div className="text-xs text-gray-600 mt-2 flex items-center gap-3">
              <span className="font-medium">{stats.totalReceptions} réceptions</span>
              <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
              <span className="font-medium">{stats.totalRows} lignes</span>
            </div>
          </div>
          <button
            onClick={() => setShowMobileMenu(true)}
            className="p-3 bg-gray-800 text-white rounded-lg"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Desktop Tab Navigation */}
        <div className="hidden lg:block bg-white rounded-lg shadow border border-gray-200 mb-6">
          <div className="flex">
            <button
              onClick={() => switchTab('conventionnel')}
              className={`flex-1 py-4 px-8 font-semibold border-r border-gray-200 transition-colors ${activeTab === 'conventionnel'
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
            >
              <div className="flex items-center justify-center gap-3">
                <span>CONVENTIONNEL</span>
                <span className={`px-3 py-1 rounded text-sm ${activeTab === 'conventionnel' ? 'bg-gray-600' : 'bg-gray-200'
                  }`}>
                  {stats.conventionnelCount}
                </span>
              </div>
            </button>
            <button
              onClick={() => switchTab('biologique')}
              className={`flex-1 py-4 px-8 font-semibold transition-colors ${activeTab === 'biologique'
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
            >
              <div className="flex items-center justify-center gap-3">
                <span>BIOLOGIQUE</span>
                <span className={`px-3 py-1 rounded text-sm ${activeTab === 'biologique' ? 'bg-gray-600' : 'bg-gray-200'
                  }`}>
                  {stats.biologiqueCount}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-200">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Réception Avocat Hass 2025/2026
            </h1>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg">
              <span className="text-sm font-semibold text-gray-700 uppercase">
                {activeTab === 'conventionnel' ? 'Conventionnel' : 'Biologique'}
              </span>
              {editingArchiveId && (
                <span className="text-xs bg-amber-500 text-white px-2 py-1 rounded">
                  MODIFICATION
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm max-w-2xl mx-auto">
              <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                <div className="font-bold text-gray-900">{stats.totalReceptions}</div>
                <div className="text-gray-600">Total Réceptions</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                <div className="font-bold text-gray-900">{stats.totalRows}</div>
                <div className="text-gray-600">Total Lignes</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                <div className="font-bold text-gray-900">{archivedForms.length}</div>
                <div className="text-gray-600">{activeTab} Actifs</div>
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Date Rapport</label>
              <input
                type="date"
                value={form.header.dateReport}
                onChange={(e) => updateForm({ header: { ...form.header, dateReport: e.target.value } })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Responsable</label>
              <input
                type="text"
                value={form.header.responsable}
                onChange={(e) => updateForm({ header: { ...form.header, responsable: e.target.value } })}
                placeholder="Nom du responsable"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-gray-700">Bon Livraison</label>
              <input
                type="text"
                value={form.header.bonLivraison}
                onChange={(e) => updateForm({ header: { ...form.header, bonLivraison: e.target.value } })}
                placeholder="Numéro de bon"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
              />
            </div>
          </div>

          {editingArchiveId && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <strong className="text-amber-900 font-semibold">Mode édition</strong>
                  <p className="text-amber-800 text-sm mt-1">
                    Vous modifiez une réception existante. Les modifications seront sauvegardées lorsque vous cliquerez sur "Mettre à jour".
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MAIN TABLE SECTION */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6 border border-gray-200">
          {/* Mobile Cards View */}
          <div className="lg:hidden divide-y divide-gray-200">
            {form.rows.map((row, index) => (
              <div key={index} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-gray-600">Ligne {index + 1}</span>
                  <div className="flex gap-2">
                    <span className={`text-base font-semibold ${computeEcartRow(row) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                      Écart: {computeEcartRow(row).toFixed(0)}
                    </span>
                    {form.rows.length > 1 && (
                      <button
                        onClick={() => removeSpecificRow(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateRow(index, { date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Matricule</label>
                    <Combobox
                      value={row.matricule}
                      onChange={(value) => updateRow(index, { matricule: value })}
                      options={matriculeOptions}
                      placeholder="Choisir matricule..."
                      className="text-sm"
                      onManageOptions={() => setShowMatriculeModal(true)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Chauffeur</label>
                    <Combobox
                      value={row.chauffeur}
                      onChange={(value) => updateRow(index, { chauffeur: value })}
                      options={chauffeurOptions}
                      placeholder="Choisir chauffeur..."
                      className="text-sm"
                      onManageOptions={() => setShowChauffeurModal(true)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">N° Lot Interne</label>
                    <input
                      type="text"
                      value={row.nlotInterne || ''}
                      onChange={(e) => updateRow(index, { nlotInterne: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Poids Net Usine</label>
                    <input
                      type="number"
                      step="0.01"
                      value={row.poidsNetUsine}
                      onChange={(e) => updateRow(index, { poidsNetUsine: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Déchet</label>
                    <input
                      type="number"
                      step="0.01"
                      value={row.dechet}
                      onChange={(e) => updateRow(index, { dechet: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Feurte</label>
                    <input
                      type="number"
                      step="0.01"
                      value={row.feurte}
                      onChange={(e) => updateRow(index, { feurte: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Poids Net Ticket</label>
                    <input
                      type="number"
                      step="0.01"
                      value={row.poidsNetTicket}
                      onChange={(e) => updateRow(index, { poidsNetTicket: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Lieu</label>
                    <Combobox
                      value={row.leLieu}
                      onChange={(value) => updateRow(index, { leLieu: value })}
                      options={lieuOptions}
                      placeholder="Choisir lieu..."
                      className="text-sm"
                      onManageOptions={() => setShowLieuModal(true)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Variété</label>
                    <Combobox
                      value={row.variete}
                      onChange={(value) => updateRow(index, { variete: value })}
                      options={varietyOptions}
                      placeholder="Choisir variété..."
                      className="text-sm"
                      onManageOptions={() => setShowVarietyModal(true)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[1800px]">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-16">
                    #
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-40">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-60">
                    Matricule
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-60">
                    Chauffeur
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-60">
                    N° Lot Interne
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-60">
                    Poids Net Usine
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-60">
                    Déchet
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-60">
                    Feurte
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-60">
                    Poids Net Ticket
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-40">
                    Écart
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-60">
                    Lieu
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider border-r border-gray-600 w-60">
                    Variété
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-sm uppercase tracking-wider w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {form.rows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 border-r border-gray-200">
                      <div className="text-sm font-semibold text-gray-900 text-center">
                        {index + 1}
                      </div>
                    </td>

                    <td className="px-6 py-4 border-r border-gray-200">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateRow(index, { date: e.target.value })}
                        className="w-full px-4 py-3 text-base border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                      />
                    </td>

                    <td className="px-6 py-4 border-r border-gray-200">
                      <Combobox
                        value={row.matricule}
                        onChange={(value) => updateRow(index, { matricule: value })}
                        options={matriculeOptions}
                        placeholder="Sélectionner matricule..."
                        className="text-base py-3"
                        onManageOptions={() => setShowMatriculeModal(true)}
                      />
                    </td>

                    <td className="px-6 py-4 border-r border-gray-200">
                      <Combobox
                        value={row.chauffeur}
                        onChange={(value) => updateRow(index, { chauffeur: value })}
                        options={chauffeurOptions}
                        placeholder="Sélectionner chauffeur..."
                        className="text-base py-3"
                        onManageOptions={() => setShowChauffeurModal(true)}
                      />
                    </td>

                    <td className="px-6 py-4 border-r border-gray-200">
                      <input
                        type="text"
                        value={row.nlotInterne || ''}
                        onChange={(e) => updateRow(index, { nlotInterne: e.target.value })}
                        className="w-full px-4 py-3 text-base border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                        placeholder="N° lot..."
                      />
                    </td>

                    <td className="px-6 py-4 border-r border-gray-200">
                      <input
                        type="number"
                        step="0.01"
                        value={row.poidsNetUsine}
                        onChange={(e) => updateRow(index, { poidsNetUsine: e.target.value })}
                        className="w-full px-4 py-3 text-base border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                        placeholder="0.00"
                      />
                    </td>

                    <td className="px-6 py-4 border-r border-gray-200">
                      <input
                        type="number"
                        step="0.01"
                        value={row.dechet}
                        onChange={(e) => updateRow(index, { dechet: e.target.value })}
                        className="w-full px-4 py-3 text-base border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                        placeholder="0.00"
                      />
                    </td>

                    <td className="px-6 py-4 border-r border-gray-200">
                      <input
                        type="number"
                        step="0.01"
                        value={row.feurte}
                        onChange={(e) => updateRow(index, { feurte: e.target.value })}
                        className="w-full px-4 py-3 text-base border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                        placeholder="0.00"
                      />
                    </td>

                    <td className="px-6 py-4 border-r border-gray-200">
                      <input
                        type="number"
                        step="0.01"
                        value={row.poidsNetTicket}
                        onChange={(e) => updateRow(index, { poidsNetTicket: e.target.value })}
                        className="w-full px-4 py-3 text-base border border-gray-300 rounded focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                        placeholder="0.00"
                      />
                    </td>

                    <td className="px-6 py-4 border-r border-gray-200">
                      <div className={`px-4 py-3 rounded text-center font-semibold text-lg ${computeEcartRow(row) >= 0
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                        {computeEcartRow(row).toFixed(0)}
                      </div>
                    </td>

                    <td className="px-6 py-4 border-r border-gray-200">
                      <Combobox
                        value={row.leLieu}
                        onChange={(value) => updateRow(index, { leLieu: value })}
                        options={lieuOptions}
                        placeholder="Sélectionner lieu..."
                        className="text-base py-3"
                        onManageOptions={() => setShowLieuModal(true)}
                      />
                    </td>

                    <td className="px-6 py-4 border-r border-gray-200">
                      <Combobox
                        value={row.variete}
                        onChange={(value) => updateRow(index, { variete: value })}
                        options={varietyOptions}
                        placeholder="Sélectionner variété..."
                        className="text-base py-3"
                        onManageOptions={() => setShowVarietyModal(true)}
                      />
                    </td>

                    <td className="px-6 py-4">
                      {form.rows.length > 1 && (
                        <button
                          onClick={() => removeSpecificRow(index)}
                          className="text-red-500 hover:text-red-700 p-2 transition-colors"
                          title="Supprimer cette ligne"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Footer Totals */}
              <tfoot className="bg-gray-100 border-t border-gray-300">
                <tr>
                  <td colSpan={5} className="px-6 py-4 font-semibold text-right text-gray-900 border-r border-gray-200">
                    TOTAL GÉNÉRAL
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 text-center border-r border-gray-200">
                    {calculateTotals().totalPoidsNetUsine.toFixed(0)}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 text-center border-r border-gray-200">
                    {calculateTotals().totalDechet.toFixed(0)}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 text-center border-r border-gray-200">
                    {calculateTotals().totalFeurte.toFixed(0)}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 text-center border-r border-gray-200">
                    {calculateTotals().totalPoidsNetTicket.toFixed(0)}
                  </td>
                  <td className="px-6 py-4 font-semibold text-lg text-center border-r border-gray-200">
                    <span className={calculateTotals().totalEcart >= 0 ? 'text-green-700' : 'text-red-700'}>
                      {calculateTotals().totalEcart.toFixed(0)}
                    </span>
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Table Actions */}
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex flex-wrap gap-3 justify-between items-center">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={addRow}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-semibold transition-colors"
                >
                  <Plus size={18} />
                  Ajouter Ligne
                </button>
                <button
                  onClick={removeLastRow}
                  className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                >
                  <Trash2 size={18} />
                  Supprimer Dernière Ligne
                </button>
              </div>
              <div className="text-sm text-gray-600 font-medium">
                {form.rows.length} ligne{form.rows.length > 1 ? 's' : ''} •
                Total Écart: <span className={calculateTotals().totalEcart >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {calculateTotals().totalEcart.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Action Buttons */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-200">
          <div className={`grid grid-cols-1 ${screenSize === 'mobile' ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'} gap-4`}>
            <button
              onClick={() => saveReception('submitted')}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-semibold transition-colors"
            >
              <CheckCircle size={18} />
              {isLoading ? 'Enregistrement...' : (editingArchiveId ? 'Mettre à Jour' : 'Enregistrer Réception')}
            </button>

            <button
              onClick={() => generatePDF()}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              <Download size={18} />
              Générer PDF
            </button>

            <button
              onClick={sendReportToWhatsApp}
              disabled={isSendingWhatsApp}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white rounded-lg font-semibold transition-colors"
            >
              <Share2 size={18} />
              {isSendingWhatsApp ? 'Envoi...' : 'Envoyer WhatsApp'}
            </button>

            <button
              onClick={resetForm}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
            >
              <RefreshCw size={18} />
              Nouveau
            </button>
          </div>
        </div>

        {/* Archive Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
          <div className="border-b border-gray-200 p-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <Archive className="text-gray-600" size={24} />
                <h3 className="text-xl font-semibold text-gray-900">Historique des Réceptions</h3>
                <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                  {filteredArchives.length} réception{filteredArchives.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Rechercher par titre, responsable, bon livraison..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none w-64"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'responsable' | 'bonLivraison')}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                  >
                    <option value="date">Trier par Date</option>
                    <option value="responsable">Trier par Responsable</option>
                    <option value="bonLivraison">Trier par Bon Livraison</option>
                  </select>

                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>

                <button
                  onClick={() => setShowArchive(!showArchive)}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  {showArchive ? 'Masquer' : 'Afficher'} l'historique
                  <ChevronDown size={18} className={`transform transition ${showArchive ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {showArchive && (
            <div className="p-6 bg-gray-50">
              {isLoadingArchives ? (
                <div className="text-center py-8">
                  <RefreshCw className="animate-spin mx-auto text-gray-600" size={32} />
                  <p className="text-gray-600 mt-3">Chargement des réceptions...</p>
                </div>
              ) : filteredArchives.length === 0 ? (
                <div className="text-center py-8">
                  <Archive className="mx-auto text-gray-400" size={48} />
                  <p className="text-gray-600 mt-3">Aucune réception trouvée</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredArchives
                    .filter(archived => {
                      if (!searchTerm) return true;
                      const searchLower = searchTerm.toLowerCase();
                      return (
                        archived.header.title?.toLowerCase().includes(searchLower) ||
                        archived.header.responsable?.toLowerCase().includes(searchLower) ||
                        archived.header.bonLivraison?.toLowerCase().includes(searchLower) ||
                        archived.header.bonLivraison === searchTerm ||
                        archived.header.bonLivraison?.includes(searchTerm) ||
                        archived.rows.some(row => 
                          row.produit?.toLowerCase().includes(searchLower) ||
                          row.lot?.toLowerCase().includes(searchLower)
                        )
                      );
                    })
                    .sort((a, b) => {
                      if (sortBy === 'bonLivraison') {
                        const aNum = extractNumberFromBonLivraison(a.header.bonLivraison);
                        const bNum = extractNumberFromBonLivraison(b.header.bonLivraison);
                        return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
                      } else if (sortBy === 'date') {
                        const aDate = new Date(a.header.dateReport);
                        const bDate = new Date(b.header.dateReport);
                        return sortOrder === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
                      } else if (sortBy === 'responsable') {
                        const aResp = a.header.responsable || '';
                        const bResp = b.header.responsable || '';
                        return sortOrder === 'asc' ? aResp.localeCompare(bResp) : bResp.localeCompare(aResp);
                      }
                      return 0;
                    })
                    .map((archived) => (
                      <div
                        key={archived.id}
                        className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors p-6"
                      >
                        <div className="flex flex-wrap justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-3 mb-3">
                              <h4 className="text-lg font-semibold text-gray-900">
                                {archived.header.title}
                              </h4>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${archived.status === 'submitted'
                                  ? 'bg-green-100 text-green-800'
                                  : archived.status === 'draft'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                {archived.status === 'submitted' ? 'Soumis' :
                                  archived.status === 'draft' ? 'Brouillon' : 'Archivé'}
                              </span>
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                {archived.category === 'biologique' ? 'BIO' : 'CONV'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">Date:</span>
                                <span>{formatDate(archived.header.dateReport)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">Responsable:</span>
                                <span>{archived.header.responsable || 'Non spécifié'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">Bon Livraison:</span>
                                <span className="font-mono bg-gray-100 px-2 py-1 rounded border">
                                  {archived.header.bonLivraison || 'N/A'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">Lignes:</span>
                                <span>{archived.rows.length}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">Créé le:</span>
                                <span>{formatFirestoreDate(archived.createdAt)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">Modifié le:</span>
                                <span>{formatFirestoreDate(archived.updatedAt)}</span>
                              </div>
                            </div>

                            {/* Quick row summary */}
                            <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                              <div className="text-xs font-semibold text-gray-600 mb-2">RÉSUMÉ DES LIGNES</div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Poids Net Usine:</span>{' '}
                                  {archived.rows.reduce((sum, r) => sum + (parseFloat(r.poidsNetUsine) || 0), 0).toFixed(0)}
                                </div>
                                <div>
                                  <span className="font-medium">Déchet:</span>{' '}
                                  {archived.rows.reduce((sum, r) => sum + (parseFloat(r.dechet) || 0), 0).toFixed(0)}
                                </div>
                                <div>
                                  <span className="font-medium">Poids Net Ticket:</span>{' '}
                                  {archived.rows.reduce((sum, r) => sum + (parseFloat(r.poidsNetTicket) || 0), 0).toFixed(0)}
                                </div>
                                <div>
                                  <span className="font-medium">Écart Total:</span>{' '}
                                  <span className={
                                    archived.rows.reduce((sum, r) => sum + computeEcartRow(r), 0) >= 0
                                      ? 'text-green-600 font-semibold'
                                      : 'text-red-600 font-semibold'
                                  }>
                                    {archived.rows.reduce((sum, r) => sum + computeEcartRow(r), 0).toFixed(0)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => viewArchive(archived)}
                              className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors text-sm font-medium"
                            >
                              <Eye size={16} />
                              Consulter
                            </button>
                            <button
                              onClick={() => loadArchive(archived)}
                              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded transition-colors text-sm font-medium"
                            >
                              <Edit size={16} />
                              Modifier
                            </button>
                            <button
                              onClick={() => duplicateArchive(archived)}
                              className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors text-sm font-medium"
                            >
                              <FilePlus size={16} />
                              Dupliquer
                            </button>
                            <button
                              onClick={() => archived.id && deleteArchive(archived.id)}
                              className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors text-sm font-medium"
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
          )}
        </div>
      </div>
    </div>
  );
}

export default SuiviReception;