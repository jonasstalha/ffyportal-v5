import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  Archive,
  Calendar,
  Download,
  Eye,
  FileText,
  Filter,
  Image,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Trash2,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale/fr';
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

interface ArchivedRapport extends QualityRapport {
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

const QualityArchive: React.FC = () => {
  const [archivedRapports, setArchivedRapports] = useState<ArchivedRapport[]>([]);
  const [filteredRapports, setFilteredRapports] = useState<ArchivedRapport[]>([]);
  const [selectedRapport, setSelectedRapport] = useState<ArchivedRapport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rapportToDelete, setRapportToDelete] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    status: '',
    controller: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadArchivedRapports();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, archivedRapports]);

  const loadArchivedRapports = async () => {
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
            // Sort by archived date first, then by created date
            const aDate = a.archivedAt || a.updatedAt || a.createdAt;
            const bDate = b.archivedAt || b.updatedAt || b.createdAt;
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          });

          setArchivedRapports(formattedArchived);
          
          toast({
            title: "Archives chargées",
            description: `${formattedArchived.length} rapport(s) archivé(s) trouvé(s)`,
            variant: "default",
          });
          
          return; // Early return if we found archived rapports
        }
      } catch (archiveError) {
        console.warn('Could not load from archived collection, trying all rapports:', archiveError);
      }
      
      // Fallback: Load all quality rapports and filter for archived/completed ones
      const allRapports = await getQualityRapports();
      
      // Filter for archived and completed rapports
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
          // Sort by archived date first, then by created date
          const aDate = a.archivedAt || a.updatedAt || a.createdAt;
          const bDate = b.archivedAt || b.updatedAt || b.createdAt;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });

      setArchivedRapports(archived);
      
      toast({
        title: "Archives chargées",
        description: `${archived.length} rapport(s) archivé(s) trouvé(s)`,
        variant: "default",
      });
      
    } catch (error) {
      console.error('Error loading archived rapports:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors du chargement des archives: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...archivedRapports];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(rapport =>
        rapport.lotNumber?.toLowerCase().includes(searchLower) ||
        rapport.controller?.toLowerCase().includes(searchLower) ||
        rapport.palletNumber?.toLowerCase().includes(searchLower) ||
        rapport.id.toLowerCase().includes(searchLower)
      );
    }

    // Date filters
    if (filters.dateFrom) {
      filtered = filtered.filter(rapport => 
        rapport.date >= filters.dateFrom
      );
    }
    if (filters.dateTo) {
      filtered = filtered.filter(rapport => 
        rapport.date <= filters.dateTo
      );
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(rapport => 
        rapport.status === filters.status
      );
    }

    // Controller filter
    if (filters.controller) {
      filtered = filtered.filter(rapport => 
        rapport.controller?.toLowerCase().includes(filters.controller.toLowerCase())
      );
    }

    setFilteredRapports(filtered);
  };

  const viewRapportDetails = (rapport: ArchivedRapport) => {
    setSelectedRapport(rapport);
    setShowDetailDialog(true);
  };

  const downloadStandardPDF = async (rapport: ArchivedRapport) => {
    try {
      setIsGeneratingPDF(true);
      
      // Check if PDF URL exists in downloadInfo
      if (rapport.downloadInfo?.standardPdf?.url) {
        // Download from stored URL
        const link = document.createElement('a');
        link.href = rapport.downloadInfo.standardPdf.url;
        link.download = rapport.downloadInfo.standardPdf.fileName;
        link.target = '_blank';
        link.click();
        
        toast({
          title: "Téléchargement réussi",
          description: "Le PDF standard a été téléchargé",
          variant: "default",
        });
      } else {
        // Generate new PDF
        const pdfBlob = await generateQualityRapportPDF(rapport);
        const fileName = `rapport_${rapport.lotNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
        downloadPDF(pdfBlob, fileName);
        
        toast({
          title: "PDF généré",
          description: "Le PDF standard a été généré et téléchargé",
          variant: "default",
        });
      }
      
    } catch (error) {
      console.error('Error downloading standard PDF:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors du téléchargement: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const downloadVisualPDF = async (rapport: ArchivedRapport) => {
    try {
      setIsGeneratingPDF(true);
      
      // Check if visual PDF URL exists in downloadInfo
      if (rapport.downloadInfo?.visualPdf?.url) {
        // Download from stored URL
        const link = document.createElement('a');
        link.href = rapport.downloadInfo.visualPdf.url;
        link.download = rapport.downloadInfo.visualPdf.fileName;
        link.target = '_blank';
        link.click();
        
        toast({
          title: "Téléchargement réussi",
          description: "Le rapport visuel a été téléchargé",
          variant: "default",
        });
      } else {
        // Generate new visual PDF
        const pdfBlob = await generateVisualRapportPDF(rapport);
        const fileName = `rapport_visuel_${rapport.lotNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
        downloadPDF(pdfBlob, fileName);
        
        toast({
          title: "Rapport visuel généré",
          description: "Le rapport visuel a été généré et téléchargé",
          variant: "default",
        });
      }
      
    } catch (error) {
      console.error('Error downloading visual PDF:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors du téléchargement: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const confirmDelete = (rapportId: string) => {
    setRapportToDelete(rapportId);
    setShowDeleteDialog(true);
  };

  const deleteArchivedRapport = async () => {
    if (!rapportToDelete) return;

    try {
      // Delete from Firebase
      await deleteQualityControlLot(rapportToDelete);
      
      // Remove from local state
      setArchivedRapports(prev => prev.filter(r => r.id !== rapportToDelete));
      
      toast({
        title: "Rapport supprimé",
        description: "Le rapport archivé a été supprimé définitivement de Firebase",
        variant: "default",
      });
      
    } catch (error) {
      console.error('Error deleting archived rapport:', error);
      toast({
        title: "Erreur",
        description: `Erreur lors de la suppression: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setRapportToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Terminé</Badge>;
      case 'archived':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Archivé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des archives...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => window.location.href = '/Rapportqualité'}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              ← Retour aux Rapports
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Archive className="w-8 h-8" />
            Archives Qualité
          </h1>
          <p className="text-gray-600">Consultez et gérez les rapports de qualité archivés</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.href = '/qualitycontrol'}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Contrôle Qualité
          </button>
          <Button
            onClick={loadArchivedRapports}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Actualiser
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Recherche</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Lot, contrôleur, palette..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date début</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date fin</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Statut</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tous</option>
                <option value="completed">Terminé</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Contrôleur</label>
              <Input
                placeholder="Nom du contrôleur"
                value={filters.controller}
                onChange={(e) => setFilters(prev => ({ ...prev, controller: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {filteredRapports.length} rapport(s) trouvé(s) sur {archivedRapports.length} total
        </p>
      </div>

      {/* Rapports Grid */}
      {filteredRapports.length === 0 ? (
        <div className="text-center py-12">
          <Archive className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filters.search || filters.dateFrom || filters.dateTo || filters.status || filters.controller
              ? 'Aucun résultat trouvé'
              : 'Aucun rapport archivé'
            }
          </h3>
          <p className="text-gray-500">
            {filters.search || filters.dateFrom || filters.dateTo || filters.status || filters.controller
              ? 'Essayez de modifier vos critères de recherche'
              : 'Les rapports terminés apparaîtront ici une fois archivés'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRapports.map((rapport) => (
            <Card key={rapport.id} className="hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{rapport.lotNumber}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(rapport.date), 'dd MMMM yyyy', { locale: fr })}
                    </CardDescription>
                  </div>
                  {getStatusBadge(rapport.status)}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 truncate">{rapport.controller}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 truncate">{rapport.palletNumber}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{rapport.calibres?.length || 0} calibres</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Image className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{rapport.totalImages || 0} images</span>
                  </div>
                </div>

                {rapport.archivedAt && (
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    Archivé le {format(new Date(rapport.archivedAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                    {rapport.archivedBy && (
                      <span> par {rapport.archivedBy}</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => viewRapportDetails(rapport)}
                    className="flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    Voir
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadStandardPDF(rapport)}
                    disabled={isGeneratingPDF}
                    className="flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    {isGeneratingPDF ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    PDF
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadVisualPDF(rapport)}
                    disabled={isGeneratingPDF}
                    className="flex items-center gap-1 text-purple-600 border-purple-200 hover:bg-purple-50"
                  >
                    {isGeneratingPDF ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Image className="w-4 h-4" />
                    )}
                    Visuel
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => confirmDelete(rapport.id)}
                    className="flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Détails du Rapport - {selectedRapport?.lotNumber}
            </DialogTitle>
            <DialogDescription>
              Informations complètes du rapport de qualité
            </DialogDescription>
          </DialogHeader>
          
          {selectedRapport && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Numéro de lot</label>
                  <p className="text-base font-semibold">{selectedRapport.lotNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date</label>
                  <p className="text-base font-semibold">{selectedRapport.date}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Contrôleur</label>
                  <p className="text-base font-semibold">{selectedRapport.controller}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Palette</label>
                  <p className="text-base font-semibold">{selectedRapport.palletNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Statut</label>
                  <div className="mt-1">{getStatusBadge(selectedRapport.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Images</label>
                  <p className="text-base font-semibold">{selectedRapport.totalImages || 0}</p>
                </div>
              </div>

              {/* Calibres Info */}
              {selectedRapport.calibres && selectedRapport.calibres.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-3">Calibres testés</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {selectedRapport.calibres.map((calibre) => (
                      <div key={calibre} className="p-3 bg-gray-50 rounded-lg text-center">
                        <div className="text-xl font-bold">{calibre}</div>
                        <div className="text-sm text-gray-600">
                          {selectedRapport.images?.[calibre]?.length || 0} images
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Results Summary */}
              {selectedRapport.testResults && Object.keys(selectedRapport.testResults).length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-3">Résultats des tests</h4>
                  <div className="space-y-3">
                    {Object.entries(selectedRapport.testResults).map(([calibre, results]) => (
                      <div key={calibre} className="p-3 border rounded-lg">
                        <h5 className="font-medium mb-2">Calibre {calibre}</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          {Object.entries(results as any).map(([test, value]) => (
                            <div key={test}>
                              <span className="text-gray-600">{test}:</span>
                              <span className="ml-1 font-medium">
                                {typeof value === 'string' && value.includes('http') 
                                  ? 'Image uploadée' 
                                  : String(value)
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Download Options */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => downloadStandardPDF(selectedRapport)}
                  disabled={isGeneratingPDF}
                  className="flex items-center gap-2"
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Télécharger PDF Standard
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => downloadVisualPDF(selectedRapport)}
                  disabled={isGeneratingPDF}
                  className="flex items-center gap-2"
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Image className="w-4 h-4" />
                  )}
                  Télécharger Rapport Visuel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement ce rapport archivé ? 
              Cette action est irréversible et supprimera toutes les données et images associées.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteDialog(false);
                setRapportToDelete(null);
              }}
            >
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={deleteArchivedRapport}
            >
              Supprimer définitivement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QualityArchive;