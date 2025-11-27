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
import { fr } from 'date-fns/locale';
import { useNavigate } from 'wouter';

const ARCHIVE_STORAGE_KEY = 'archived_quality_reports';

const Archivagedescontroles = () => {
  const [reports, setReports] = useState<QualityRapport[]>([]);
  const [filteredReports, setFilteredReports] = useState<QualityRapport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    dateStart: '',
    dateEnd: '',
    controller: '',
    status: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<QualityRapport | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useNavigate();

  // Load archived reports from Firebase
  useEffect(() => {
    loadArchivedReports();
  }, []);

  // Filter reports when search term or filters change
  useEffect(() => {
    const filtered = reports.filter(report => {
      const matchesSearch = !searchTerm || 
        report.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.controller.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDateStart = !filters.dateStart || new Date(report.date) >= new Date(filters.dateStart);
      const matchesDateEnd = !filters.dateEnd || new Date(report.date) <= new Date(filters.dateEnd);
      const matchesController = !filters.controller || report.controller.toLowerCase().includes(filters.controller.toLowerCase());
      const matchesStatus = !filters.status || report.status === filters.status;

      return matchesSearch && matchesDateStart && matchesDateEnd && matchesController && matchesStatus;
    });

    setFilteredReports(filtered);
  }, [reports, searchTerm, filters]);

  const loadArchivedReports = async () => {
    setIsLoading(true);
    try {
      // Try to load from archived collection first
      try {
        const archivedRapports = await getArchivedQualityRapports();
        if (archivedRapports && archivedRapports.length > 0) {
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
    } finally {
      setIsLoading(false);
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

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      dateStart: '',
      dateEnd: '',
      controller: '',
      status: ''
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/rapportqualite')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour aux Rapports
              </button>
              <div className="h-6 border-l border-gray-300" />
              <h1 className="text-2xl font-bold text-gray-900">Archives des Contrôles Qualité</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadArchivedReports}
                disabled={isLoading}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Actualiser Firebase
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher par lot, contrôleur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <input
              type="date"
              placeholder="Date début"
              value={filters.dateStart}
              onChange={(e) => setFilters(prev => ({ ...prev, dateStart: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              placeholder="Date fin"
              value={filters.dateEnd}
              onChange={(e) => setFilters(prev => ({ ...prev, dateEnd: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Contrôleur"
              value={filters.controller}
              onChange={(e) => setFilters(prev => ({ ...prev, controller: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={clearFilters}
              className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
            >
              <RotateCcw className="w-4 h-4" />
              Effacer
            </button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">
                  {filteredReports.length} rapport{filteredReports.length !== 1 ? 's' : ''} archivé{filteredReports.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
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
                    <p className="text-gray-900">{(selectedReport as any).observations || (selectedReport as any).notes || 'Aucune observation'}</p>
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