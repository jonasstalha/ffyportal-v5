import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Trash2, 
  Download, 
  Upload, 
  Calendar, 
  User, 
  Wrench, 
  Hash,
  FileText,
  Plus,
  RotateCcw,
  Check,
  AlertTriangle,
  Archive,
  Loader2,
  Package,
  RefreshCw,
  Image,
  X,
  ExternalLink,
  Camera,
  FileImage,
  ArrowLeft
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  getQualityRapports, 
  getArchivedQualityRapports,
  updateQualityRapport,
  deleteQualityControlLot,
  QualityRapport
} from '@/lib/qualityControlService';
import {
  downloadPDF,
  generateQualityRapportPDF,
  generateVisualRapportPDF
} from '@/lib/qualityRapportPDF';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale/fr';

const ARCHIVE_STORAGE_KEY = 'archived_reports';

// Updated interface to match Firebase data
interface ArchivedReport extends QualityRapport {
  archivedAt?: string;
  archivedBy?: string;
  totalImages?: number;
  downloadInfo?: {
    standardPdf?: {
      url: string;
      fileName: string;
      size: number;
      generatedAt: string;
    };
    visualPdf?: {
      url: string;
      fileName: string;
      size: number;
      generatedAt: string;
    };
  };
}

const Archivagedescontroles = () => {
  const [reports, setReports] = useState<QualityRapport[]>([]);
  // State management
  const [filteredReports, setFilteredReports] = useState(reports);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    dateStart: '',
    dateEnd: '',
    controller: '',
    chief: '',
    calibre: '',
    status: ''
  });
  const [editingReport, setEditingReport] = useState<QualityRapport | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<QualityRapport | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  // Load archived reports from Firebase
  useEffect(() => {
    loadArchivedReports();
  }, []);

  const loadArchivedReports = async () => {
    try {
      setIsLoading(true);
      
      // Try to load archived rapports first
      try {
        const archivedRapports = await getArchivedQualityRapports();
        
        if (archivedRapports.length > 0) {
          const formattedArchived = archivedRapports.map(rapport => ({
            ...rapport,
            totalImages: Object.values(rapport.images || {})
              .reduce((total, images) => total + (Array.isArray(images) ? images.length : 0), 0)
          })).sort((a, b) => {
            const aDate = a.archivedAt || a.updatedAt || a.createdAt;
            const bDate = b.archivedAt || b.updatedAt || b.createdAt;
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          });

          setReports(formattedArchived);
          return;
        }
      } catch (archiveError) {
        console.warn('Could not load from archived collection, trying all rapports:', archiveError);
      }
      
      // Fallback: Load all quality rapports and filter for archived/completed ones
      const allRapports = await getQualityRapports();
      const archived = allRapports
        .filter(rapport => 
          rapport.status === 'archived' || 
          rapport.status === 'completed'
        )
        .map(rapport => ({
          ...rapport,
          totalImages: Object.values(rapport.images || {})
            .reduce((total, images) => total + (Array.isArray(images) ? images.length : 0), 0)
        }))
        .sort((a, b) => {
          const aDate = a.archivedAt || a.updatedAt || a.createdAt;
          const bDate = b.archivedAt || b.updatedAt || b.createdAt;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });

      setReports(archived);
      
    } catch (error) {
      console.error('Error loading archived reports:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors du chargement des archives: ${(error as Error).message}`,
        variant: "destructive",
      });
      
      // Fallback to localStorage data if Firebase fails
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const savedReports = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      if (savedReports) {
        const parsedReports = JSON.parse(savedReports);
        setReports(parsedReports);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  };

  // Download standard PDF function
  const downloadStandardPDF = (report: QualityRapport) => {
    try {
      generateQualityRapportPDF(report);
      toast({
        title: "Succès",
        description: "PDF téléchargé avec succès",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du téléchargement du PDF",
        variant: "destructive",
      });
    }
  };

  // Download visual PDF function
  const downloadVisualPDF = async (report: QualityRapport) => {
    try {
      await generateVisualRapportPDF(report);
      toast({
        title: "Succès",
        description: "PDF avec images téléchargé avec succès",
      });
    } catch (error) {
      console.error('Error downloading visual PDF:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du téléchargement du PDF avec images",
        variant: "destructive",
      });
    }
  };

  // Delete report function
  const deleteReport = async (reportId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rapport archivé ?')) {
      return;
    }

    try {
      await deleteQualityControlLot(reportId);
      
      // Remove from local state
      setReports(prevReports => prevReports.filter(report => report.id !== reportId));
      
      toast({
        title: "Succès",
        description: "Rapport supprimé avec succès",
      });
    } catch (error) {
      console.error('Error deleting report:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression du rapport",
        variant: "destructive",
      });
    }
  };

  // Function to convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Function to generate comprehensive PDF report
  const generateCompletePdfReport = async (report: QualityRapport) => {
    setGeneratingPdf(report.id);
    try {
      // Use the existing visual PDF function for comprehensive reports
      await generateVisualRapportPDF(report);
      toast({
        title: "Succès",
        description: "PDF complet généré avec succès!",
      });
    } catch (error) {
      console.error('Error generating complete PDF report:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors de la génération du PDF: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(null);
    }
  };

  // Add sample data for testing (you can remove this in production)
  const addSampleData = () => {
    const sampleReports: ArchivedReport[] = [
      {
        id: 'sample-1',
        lotNumber: 'LOT001',
        date: '2025-01-15',
        controller: 'John Doe',
        palletNumber: 'P001',
        calibres: [16, 18, 20],
        images: {
          16: [], // In real app, this would contain File objects
          18: [],
          20: []
        },
        testResults: {
          16: { poids: 180, firmness: 2.5 },
          18: { poids: 200, firmness: 2.8 },
          20: { poids: 220, firmness: 3.0 }
        },
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString()
      },
      {
        id: 'sample-2',
        lotNumber: 'LOT002',
        date: '2025-01-16',
        controller: 'Alice Johnson',
        palletNumber: 'P002',
        calibres: [14, 16, 18],
        images: {
          14: [],
          16: [],
          18: []
        },
        testResults: {
          14: { poids: 150, firmness: 2.2 },
          16: { poids: 175, firmness: 2.6 },
          18: { poids: 195, firmness: 2.9 }
        },
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString()
      }
    ];

    const existing = JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY) || '[]');
    const combined = [...existing, ...sampleReports];
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(combined));
    setReports(combined);
    alert('Sample data added! You can now test the PDF generation.');
  };

  // Load archived reports from localStorage on mount
  useEffect(() => {
    const loadArchivedReports = () => {
      try {
        const archived = JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY) || '[]');
        console.log('Loaded archived reports:', archived);
        setReports(archived);
      } catch (error) {
        console.error('Error loading archived reports:', error);
        setReports([]);
      }
    };

    loadArchivedReports();
    
    // Listen for storage changes to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ARCHIVE_STORAGE_KEY) {
        loadArchivedReports();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Apply filters and search
  useEffect(() => {
    let filtered = reports;

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(report =>
        report.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.controller.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.controller.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.calibres.some(cal => String(cal).toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply filters
    if (filters.dateStart) {
      filtered = filtered.filter(report => report.date >= filters.dateStart);
    }
    if (filters.dateEnd) {
      filtered = filtered.filter(report => report.date <= filters.dateEnd);
    }
    if (filters.controller) {
      filtered = filtered.filter(report => 
        report.controller.toLowerCase().includes(filters.controller.toLowerCase())
      );
    }
    if (filters.chief) {
      filtered = filtered.filter(report => 
        report.controller.toLowerCase().includes(filters.chief.toLowerCase())
      );
    }
    if (filters.calibre) {
      filtered = filtered.filter(report => 
        report.calibres.some(cal => String(cal).toLowerCase().includes(filters.calibre.toLowerCase()))
      );
    }
    if (filters.status) {
      filtered = filtered.filter(report => report.status === filters.status);
    }

    setFilteredReports(filtered);
  }, [searchTerm, filters, reports]);

  // Handle edit
  const handleEdit = (report: QualityRapport) => {
    setEditingReport({ ...report });
  };

  // Save edited report
  const saveEdit = () => {
    if (!editingReport) return;
    
    const updatedReports = reports.map(report =>
      report.id === editingReport.id ? editingReport : report
    );
    
    setReports(updatedReports);
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(updatedReports));
    setEditingReport(null);
    alert('Report updated successfully!');
  };

  // Handle delete
  const handleDelete = (reportId: string) => {
    const updatedReports = reports.filter(report => report.id !== reportId);
    setReports(updatedReports);
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(updatedReports));
    setDeleteConfirm(null);
    alert('Report deleted successfully!');
  };

  // Handle PDF download/view
  const handlePdfAction = (pdfName: string | null | undefined, action: string) => {
    if (!pdfName) {
      alert('PDF not available');
      return;
    }
    // In real app, this would download/view the actual PDF
    console.log(`${action} PDF: ${pdfName}`);
    alert(`${action}: ${pdfName}`);
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusProps = (status: string) => {
      switch (status) {
        case 'Completed':
          return {
            bg: 'bg-green-100',
            text: 'text-green-800',
            icon: <Check className="w-3 h-3" />
          };
        case 'Incomplete':
          return {
            bg: 'bg-yellow-100',
            text: 'text-yellow-800',
            icon: <AlertTriangle className="w-3 h-3" />
          };
        case 'Archived':
          return {
            bg: 'bg-gray-100',
            text: 'text-gray-800',
            icon: <Archive className="w-3 h-3" />
          };
        default:
          return {
            bg: 'bg-gray-100',
            text: 'text-gray-800',
            icon: null
          };
      }
    };

    const props = getStatusProps(status);
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${props.bg} ${props.text}`}>
        {props.icon}
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => window.location.href = '/Rapportqualité'}
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
                >
                  ← Retour aux Rapports
                </button>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Archive className="w-8 h-8 text-blue-600" />
                Archives Qualité Firebase
              </h1>
              <p className="text-gray-600 mt-2">
                Consultez les rapports de qualité archivés automatiquement après finalisation. 
                Visualisez toutes les images, téléchargez les PDFs et accédez aux détails complets.
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-4 mb-2">
                <button
                  onClick={() => window.location.href = '/qualitycontrol'}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Contrôle Qualité
                </button>
                <button
                  onClick={loadArchivedReports}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {isLoading ? 'Chargement...' : 'Actualiser Firebase'}
                </button>
              </div>
              <p className="text-2xl font-bold text-blue-600">{filteredReports.length}</p>
              <p className="text-sm text-gray-500">Total Reports</p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* Search Bar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by Lot ID, Controller, Chief, or Calibre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 rounded-lg border transition-colors flex items-center gap-2 ${
                showFilters 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date Start
                  </label>
                  <input
                    type="date"
                    value={filters.dateStart}
                    onChange={(e) => setFilters(prev => ({...prev, dateStart: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date End
                  </label>
                  <input
                    type="date"
                    value={filters.dateEnd}
                    onChange={(e) => setFilters(prev => ({...prev, dateEnd: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="w-4 h-4 inline mr-1" />
                    Controller
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by controller"
                    value={filters.controller}
                    onChange={(e) => setFilters(prev => ({...prev, controller: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Wrench className="w-4 h-4 inline mr-1" />
                    Chief
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by chief"
                    value={filters.chief}
                    onChange={(e) => setFilters(prev => ({...prev, chief: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Hash className="w-4 h-4 inline mr-1" />
                    Calibre
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by calibre"
                    value={filters.calibre}
                    onChange={(e) => setFilters(prev => ({...prev, calibre: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({...prev, status: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Status</option>
                    <option value="Completed">Completed</option>
                    <option value="Incomplete">Incomplete</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setFilters({
                    dateStart: '', dateEnd: '', controller: '', chief: '', calibre: '', status: ''
                  })}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Chargement des archives depuis Firebase...</p>
                <p className="text-sm text-gray-500">Cela peut prendre un moment</p>
              </div>
            </div>
          </div>
        ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lot Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Controller
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Palette
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Calibres
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Images
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <Archive className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun rapport archivé</h3>
                      <p className="text-gray-500">Les rapports terminés apparaîtront ici une fois archivés</p>
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{report.lotNumber}</div>
                      <div className="text-xs text-gray-500">ID: {report.id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(report.date), 'dd/MM/yyyy', { locale: fr })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{report.controller}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{report.palletNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(report.calibres || {}).map(([size, count]) => (
                          <span key={size} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {size}: {count}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Camera className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          {(report.images && Object.keys(report.images).length) || 0} images
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Archive className="w-3 h-3 mr-1" />
                        Archivé
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                          title="Voir les détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadStandardPDF(report)}
                          className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                          title="Télécharger PDF standard"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadVisualPDF(report)}
                          className="text-purple-600 hover:text-purple-900 p-1 rounded hover:bg-purple-50"
                          title="Télécharger PDF avec images"
                        >
                          <FileImage className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteReport(report.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Detail Modal */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Détails du Rapport - Lot {selectedReport.lotNumber}
                </h3>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <p className="text-gray-900">{format(new Date(selectedReport.date), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contrôleur</label>
                    <p className="text-gray-900">{selectedReport.controller}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de Palette</label>
                    <p className="text-gray-900">{selectedReport.palletNumber}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Calibres</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedReport.calibres || {}).map(([size, count]) => (
                        <span key={size} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {size}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
                    <p className="text-gray-900">{(selectedReport as any).observations || 'Aucune observation'}</p>
                  </div>
                </div>
              </div>

              {selectedReport.images && Object.keys(selectedReport.images).length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Images</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(selectedReport.images).map(([key, imageData]) => {
                      // Handle both URL strings and arrays of images
                      const imageUrl = Array.isArray(imageData) ? imageData[0] : imageData;
                      if (!imageUrl) return null;
                      
                      return (
                        <div key={key} className="relative group">
                          <img 
                            src={imageUrl} 
                            alt={`Image ${key}`}
                            className="w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-80"
                            onClick={() => window.open(imageUrl, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <ExternalLink className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => downloadStandardPDF(selectedReport)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  <Download className="w-4 h-4" />
                  PDF Standard
                </button>
                <button
                  onClick={() => downloadVisualPDF(selectedReport)}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
                >
                  <FileImage className="w-4 h-4" />
                  PDF avec Images
                </button>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="flex items-center gap-2 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Archivagedescontroles;