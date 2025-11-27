import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc as firestoreDoc } from 'firebase/firestore';
import { firestore, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Folder, Edit, Trash2, Download, Calendar, Truck, MapPin, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale/fr';

interface ExpeditionHistoryItem {
  id: string;
  name: string;
  date: string;
  type: 'expedition';
  transporteur?: string;
  destination?: string;
  pdfURL?: string;
  createdAt?: string;
  updatedAt?: string;
  headerData?: any;
  rows?: any[];
}

export default function DocumentArchive() {
  const [expeditions, setExpeditions] = useState<ExpeditionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [expeditionToDelete, setExpeditionToDelete] = useState<string | null>(null);

  // Load expedition history when component mounts
  useEffect(() => {
    loadExpeditionHistory();
  }, []);

  const loadExpeditionHistory = async () => {
    setLoading(true);
    try {
      const allExpeditions: ExpeditionHistoryItem[] = [];

      // Load from localStorage first (faster and works offline)
      const savedExpeditions = localStorage.getItem('savedExpeditions');
      console.log('🔄 Loading expeditions from localStorage...');
      
      if (savedExpeditions) {
        try {
          const localExpeditions = JSON.parse(savedExpeditions);
          console.log(`📂 Found ${localExpeditions.length} expeditions in localStorage`);
          
          localExpeditions.forEach((exp: any) => {
            console.log('📄 Local expedition:', { id: exp.id, name: exp.name });
            allExpeditions.push({
              id: exp.id,
              name: exp.name || `Expedition_${exp.headerData?.transporteur || 'Unknown'}_${exp.date}`,
              date: exp.date,
              type: 'expedition',
              transporteur: exp.headerData?.transporteur,
              destination: exp.headerData?.destination,
              pdfURL: exp.pdfURL,
              createdAt: exp.createdAt,
              updatedAt: exp.updatedAt,
              headerData: exp.headerData,
              rows: exp.rows
            });
          });
        } catch (e) {
          console.error('❌ Error parsing local expeditions:', e);
        }
      } else {
        console.log('📂 No expeditions found in localStorage');
      }

      // Also try to load from Firestore (with fallback user ID)
      try {
        const currentUserId = auth.currentUser?.uid || 'USER123';
        console.log('🔄 Loading expeditions from Firestore for user:', currentUserId);
        
        const q = query(
          collection(firestore, 'expeditions'),
          where('userId', '==', currentUserId)
        );

        const querySnapshot = await getDocs(q);
        console.log(`📖 Found ${querySnapshot.docs.length} expeditions in Firestore`);
        
        querySnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log('📄 Firestore expedition:', { id: data.id, name: data.name });
          
          // Check if this expedition is already in our local list
          const existingIndex = allExpeditions.findIndex(exp => exp.id === data.id);
          if (existingIndex === -1) {
            // Add from Firestore if not in localStorage
            allExpeditions.push({
              id: data.id || doc.id,
              name: data.name || `Expedition_${data.headerData?.transporteur || 'Unknown'}_${data.date}`,
              date: data.date,
              type: 'expedition',
              transporteur: data.headerData?.transporteur,
              destination: data.headerData?.destination,
              pdfURL: data.pdfURL,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
              updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
              headerData: data.headerData,
              rows: data.rows
            });
          } else {
            console.log('⚠️  Expedition already exists in localStorage:', data.id);
          }
        });
        console.log('✅ Successfully loaded expeditions from Firestore');
      } catch (firestoreError: any) {
        console.error('❌ Could not load from Firestore:', firestoreError);
        console.log('Using localStorage only');
      }

      // Sort by date (newest first) and remove duplicates
      const uniqueExpeditions = allExpeditions.filter((exp, index, self) => 
        index === self.findIndex(e => e.id === exp.id)
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      console.log(`📊 Total unique expeditions loaded: ${uniqueExpeditions.length}`);
      setExpeditions(uniqueExpeditions);
    } catch (error) {
      console.error('Error loading expedition history:', error);
      toast.error('Erreur lors du chargement de l\'historique');
    } finally {
      setLoading(false);
    }
  };

  const editExpedition = (expeditionId: string) => {
    // Navigate to the expedition form with the ID parameter
    window.location.href = `/logistique/fichedexpidition?id=${expeditionId}`;
  };

  const deleteExpedition = async (expeditionId: string) => {
    try {
      // Remove from localStorage
      const savedExpeditions = localStorage.getItem('savedExpeditions');
      if (savedExpeditions) {
        const expeditionsArray = JSON.parse(savedExpeditions);
        const filteredExpeditions = expeditionsArray.filter((exp: any) => exp.id !== expeditionId);
        localStorage.setItem('savedExpeditions', JSON.stringify(filteredExpeditions));
      }

      // Remove from Firestore with fallback user ID
      try {
        const currentUserId = auth.currentUser?.uid || 'USER123';
        const q = query(
          collection(firestore, 'expeditions'),
          where('id', '==', expeditionId)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          await deleteDoc(firestoreDoc(firestore, 'expeditions', querySnapshot.docs[0].id));
          console.log('Deleted from Firestore successfully');
        }
      } catch (firestoreError) {
        console.log('Could not delete from Firestore:', firestoreError);
      }

      // Update local state
      setExpeditions(prev => prev.filter(exp => exp.id !== expeditionId));
      
      toast.success('Fiche d\'expédition supprimée');
      setIsDeleteDialogOpen(false);
      setExpeditionToDelete(null);
    } catch (error) {
      console.error('Error deleting expedition:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const downloadPDF = async (expedition: ExpeditionHistoryItem) => {
    try {
      if (expedition.pdfURL && expedition.pdfURL.startsWith('local_')) {
        // Handle local PDF from localStorage
        const pdfData = localStorage.getItem(`pdf_${expedition.id}`);
        if (pdfData) {
          const link = document.createElement('a');
          link.href = pdfData;
          link.download = `Fiche_Expedition_${expedition.name}.pdf`;
          link.click();
          toast.success('PDF téléchargé');
        } else {
          toast.error('PDF non trouvé');
        }
      } else if (expedition.pdfURL) {
        // Handle Firebase Storage URL
        const link = document.createElement('a');
        link.href = expedition.pdfURL;
        link.target = '_blank';
        link.click();
        toast.success('PDF ouvert');
      } else {
        toast.error('Aucun PDF disponible pour cette expédition');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Erreur lors du téléchargement du PDF');
    }
  };

  const filteredExpeditions = expeditions.filter(exp =>
    exp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.transporteur?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.destination?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-green-600" />
          <p>Chargement de l'historique...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Historique des Expéditions</h1>
          <p className="text-gray-600">Gérez vos fiches d'expédition sauvegardées</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={loadExpeditionHistory}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
          <Button 
            onClick={() => window.location.href = '/logistique/fichedexpidition'}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Expédition
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          placeholder="Rechercher par nom, transporteur ou destination..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Expedition Cards Grid */}
      {filteredExpeditions.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'Aucun résultat trouvé' : 'Aucune expédition trouvée'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm 
              ? 'Essayez de modifier votre recherche' 
              : 'Commencez par créer votre première fiche d\'expédition'
            }
          </p>
          {!searchTerm && (
            <Button 
              onClick={() => window.location.href = '/logistique/fichedexpidition'}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Créer une fiche d'expédition
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExpeditions.map((expedition) => (
            <Card key={expedition.id} className="p-6 hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FileText className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate" title={expedition.name}>
                      {expedition.name}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(expedition.date), 'dd MMMM yyyy', { locale: fr })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expedition Details */}
              <div className="space-y-2 mb-4">
                {expedition.transporteur && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Truck className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="truncate">{expedition.transporteur}</span>
                  </div>
                )}
                {expedition.destination && (
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="truncate">{expedition.destination}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editExpedition(expedition.id)}
                    className="flex items-center gap-1"
                  >
                    <Edit className="h-4 w-4" />
                    Modifier
                  </Button>
                  {expedition.pdfURL && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadPDF(expedition)}
                      className="flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setExpeditionToDelete(expedition.id);
                    setIsDeleteDialogOpen(true);
                  }}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette fiche d'expédition ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setExpeditionToDelete(null);
              }}
            >
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={() => expeditionToDelete && deleteExpedition(expeditionToDelete)}
            >
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}