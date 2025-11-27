import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Truck, Package, Box, Ship, CheckCircle2, Clock, AlertCircle, Archive, Users, Globe, MoreVertical, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { api, getAvocadoTrackingData } from "@/lib/queryClient";
import { deleteAvocadoTracking } from "@/lib/firebaseService";
import { AvocadoTracking } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useMultiLots } from "@/hooks/useMultiLots";
import { MultiLot } from "@/lib/multiLotService";

export default function LotsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("multi-lots");
  
  // Use React Query to fetch and cache the old data
  const { data: oldLots = [], isLoading: oldLoading, error: oldError, refetch } = useQuery({
    queryKey: ['avocadoTracking'],
    queryFn: getAvocadoTrackingData()
  });

  // Use multi-lots hook for new lot management
  const { 
    activeLots, 
    archivedLots, 
    loading: multiLoading, 
    error: multiError, 
    archiveLot, 
    deleteLot 
  } = useMultiLots();

  // Auto-archive completed lots
  useEffect(() => {
    const autoArchiveCompletedLots = async () => {
      for (const lot of activeLots) {
        const completedStepsCount = lot.completedSteps?.length || 0;
        const isFullyCompleted = completedStepsCount === 7;
        
        // If lot has all 7 steps completed but isn't archived yet, archive it
        if (isFullyCompleted && lot.status !== 'archived') {
          console.log(`Auto-archiving completed lot: ${lot.lotNumber || lot.id}`);
          try {
            await archiveLot(lot.id);
          } catch (error) {
            console.error('Error auto-archiving lot:', error);
          }
        }
      }
    };

    // Run auto-archive check when lots data changes
    if (activeLots.length > 0) {
      autoArchiveCompletedLots();
    }
  }, [activeLots, archiveLot]);

  const loading = oldLoading || multiLoading;
  const error = oldError || multiError;

  const filteredOldLots = oldLots.filter(
    (lot: AvocadoTracking) =>
      lot.harvest.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.harvest.farmLocation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMultiLots = activeLots.filter(
    (lot: MultiLot) =>
      (lot.lotNumber || lot.harvest?.lotNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lot.harvest?.farmLocation || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredArchivedLots = archivedLots.filter(
    (lot: MultiLot) =>
      (lot.lotNumber || lot.harvest?.lotNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lot.harvest?.farmLocation || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProgressPercentage = (lot: AvocadoTracking) => {
    const steps = [
      lot.harvest.harvestDate,
      lot.transport.arrivalDateTime,
      lot.sorting.sortingDate,
      lot.packaging.packagingDate,
      lot.storage.entryDate,
      lot.export.loadingDate,
      lot.delivery.actualDeliveryDate
    ];
    const completedSteps = steps.filter(step => step && step.trim() !== '').length;
    return (completedSteps / steps.length) * 100;
  };

  const getMultiLotProgressPercentage = (lot: MultiLot) => {
    // Use completedSteps array for accurate calculation
    const completedCount = lot.completedSteps?.length || 0;
    return Math.min((completedCount / 7) * 100, 100); // Cap at 100%
  };

  const getStatusBadge = (lot: AvocadoTracking) => {
    if (lot.delivery.actualDeliveryDate && lot.delivery.actualDeliveryDate.trim() !== '') {
      return <Badge className="bg-green-100 text-green-800">✅ Livré</Badge>;
    }
    if (lot.export.loadingDate && lot.export.loadingDate.trim() !== '') {
      return <Badge className="bg-blue-100 text-blue-800">🚢 En Export</Badge>;
    }
    if (lot.storage.entryDate && lot.storage.entryDate.trim() !== '') {
      return <Badge className="bg-purple-100 text-purple-800">🏪 En Stockage</Badge>;
    }
    if (lot.packaging.packagingDate && lot.packaging.packagingDate.trim() !== '') {
      return <Badge className="bg-yellow-100 text-yellow-800">📦 Emballé</Badge>;
    }
    if (lot.sorting.sortingDate && lot.sorting.sortingDate.trim() !== '') {
      return <Badge className="bg-orange-100 text-orange-800">🏭 Trié</Badge>;
    }
    if (lot.transport.arrivalDateTime && lot.transport.arrivalDateTime.trim() !== '') {
      return <Badge className="bg-indigo-100 text-indigo-800">🚛 Transporté</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">🌱 Récolté</Badge>;
  };

  const getMultiLotStatusBadge = (lot: MultiLot) => {
    const statusConfig = {
      'draft': { color: 'bg-gray-100 text-gray-800', icon: '📝', text: 'Brouillon' },
      'in-progress': { color: 'bg-blue-100 text-blue-800', icon: '🔄', text: 'En cours' },
      'completed': { color: 'bg-green-100 text-green-800', icon: '✅', text: 'Terminé' },
      'archived': { color: 'bg-purple-100 text-purple-800', icon: '📦', text: 'Archivé' }
    };

    // Check if lot is actually completed based on steps
    const actualCompletedSteps = lot.completedSteps?.length || 0;
    const isActuallyCompleted = actualCompletedSteps === 7;
    
    // Override status if steps indicate completion
    let effectiveStatus = lot.status;
    if (isActuallyCompleted && lot.status !== 'archived') {
      effectiveStatus = 'completed';
      // Note: Auto-archiving will handle moving this to archive
    }

    const config = statusConfig[effectiveStatus] || statusConfig.draft;
    
    return (
      <Badge className={config.color}>
        <span className="mr-1">{config.icon}</span>
        {config.text}
        {isActuallyCompleted && (
          <span className="ml-1 text-xs">(7/7)</span>
        )}
        {isActuallyCompleted && lot.status !== 'archived' && (
          <span className="ml-1 text-xs">→ Archive</span>
        )}
      </Badge>
    );
  };

  const handleArchiveLot = async (lotId: string) => {
    try {
      await archiveLot(lotId);
    } catch (error) {
      console.error('Error archiving lot:', error);
    }
  };

  const handleDeleteLot = async (lotId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce lot?')) {
      try {
        await deleteLot(lotId);
      } catch (error) {
        console.error('Error deleting lot:', error);
      }
    }
  };

  const handleDeleteOldLot = async (lotId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce lot définitivement? Cette action ne peut pas être annulée.')) {
      try {
        await deleteAvocadoTracking(lotId);
        refetch(); // Refresh the old lots data
      } catch (error) {
        console.error('Error deleting old lot:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-neutral-500">Chargement des lots...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Impossible de charger les lots. Veuillez réessayer plus tard."}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => refetch()}>Réessayer</Button>
        </div>
      </div>
    );
  }

  const renderMultiLotCard = (lot: MultiLot) => (
    <Card key={lot.id} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl flex items-center gap-2">
            {lot.lotNumber || lot.harvest?.lotNumber || 'Nouveau lot'}
            {lot.globallyAccessible && (
              <div className="flex items-center gap-1 text-green-600">
                <Globe className="h-4 w-4" />
                <span className="text-xs">Global</span>
              </div>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {getMultiLotStatusBadge(lot)}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {lot.status === 'completed' && (
                  <DropdownMenuItem onClick={() => handleArchiveLot(lot.id)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archiver
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => handleDeleteLot(lot.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center text-sm text-neutral-500">
          <span className="font-medium">Ferme:</span> {lot.harvest?.farmLocation || 'Non spécifiée'}
        </div>
        {lot.assignedUsers && lot.assignedUsers.length > 1 && (
          <div className="flex items-center gap-1 text-sm text-blue-600">
            <Users className="h-4 w-4" />
            <span>{lot.assignedUsers.length} utilisateurs assignés</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Progression</span>
            <span className="font-medium">{Math.round(getMultiLotProgressPercentage(lot))}%</span>
          </div>
          <Progress value={getMultiLotProgressPercentage(lot)} className="h-2" />
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="space-y-1">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1 text-neutral-500" />
              <span>Étape: {lot.currentStep || 1}/7</span>
            </div>
            <div className="flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-1 text-neutral-500" />
              <span>Terminées: {lot.completedSteps?.length || 0}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center">
              <Package className="h-4 w-4 mr-1 text-neutral-500" />
              <span>Variété: {lot.harvest?.variety || 'N/A'}</span>
            </div>
            <div className="flex items-center">
              <span className="text-neutral-500">MAJ: {lot.updatedAt ? new Date(lot.updatedAt).toLocaleDateString() : 'Jamais'}</span>
            </div>
          </div>
        </div>

        {lot.status === 'completed' && lot.completedAt && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Terminé le {new Date(lot.completedAt).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/multi-lot-detail/${encodeURIComponent(lot.lotNumber || lot.id)}`}>
              Voir détails
            </Link>
          </Button>
        {lot.status !== 'completed' && lot.status !== 'archived' && (
          <Button size="sm" asChild>
            <Link href={`/new-entry?lotId=${lot.id}`}>
              Ouvrir
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );

  const renderOldLotCard = (lot: AvocadoTracking, index: number) => (
    <Card key={`${lot.harvest.lotNumber}-${index}`} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{lot.harvest.lotNumber}</CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge(lot)}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem 
                  onClick={() => handleDeleteOldLot(lot.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center text-sm text-neutral-500">
          <span className="font-medium">Ferme:</span> {lot.harvest.farmLocation}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Progression</span>
            <span className="font-medium">{Math.round(getProgressPercentage(lot))}%</span>
          </div>
          <Progress value={getProgressPercentage(lot)} className="h-2" />
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="space-y-1">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1 text-neutral-500" />
              <span>Récolte: {lot.harvest.harvestDate ? new Date(lot.harvest.harvestDate).toLocaleDateString() : 'En attente'}</span>
            </div>
            <div className="flex items-center">
              <Truck className="h-4 w-4 mr-1 text-neutral-500" />
              <span>Transport: {lot.transport.arrivalDateTime ? new Date(lot.transport.arrivalDateTime).toLocaleDateString() : 'En attente'}</span>
            </div>
            <div className="flex items-center">
              <Package className="h-4 w-4 mr-1 text-neutral-500" />
              <span>Tri: {lot.sorting.sortingDate ? new Date(lot.sorting.sortingDate).toLocaleDateString() : 'En attente'}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center">
              <Box className="h-4 w-4 mr-1 text-neutral-500" />
              <span>Emballage: {lot.packaging.packagingDate ? new Date(lot.packaging.packagingDate).toLocaleDateString() : 'En attente'}</span>
            </div>
            <div className="flex items-center">
              <Ship className="h-4 w-4 mr-1 text-neutral-500" />
              <span>Export: {lot.export.loadingDate ? new Date(lot.export.loadingDate).toLocaleDateString() : 'En attente'}</span>
            </div>
            <div className="flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-1 text-neutral-500" />
              <span>Livraison: {lot.delivery.actualDeliveryDate ? new Date(lot.delivery.actualDeliveryDate).toLocaleDateString() : 'En attente'}</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Variété:</span>
            <span className="font-medium">{lot.harvest.variety}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Grade:</span>
            <span className="font-medium">{lot.sorting.qualityGrade || 'N/A'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Poids net:</span>
            <span className="font-medium">{lot.packaging.netWeight || 0} kg</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/lot-detail/${encodeURIComponent(lot.harvest.lotNumber)}`}>
                Détails
              </Link>
            </Button>
        <Button size="sm" asChild>
          <Link href={`/new-entry?legacyLotId=${encodeURIComponent(lot.harvest.lotNumber)}`}>
            Ouvrir
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des Lots</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <Input
              placeholder="Rechercher un lot..."
              className="pl-10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button asChild>
            <Link href="/new-entry">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau Lot
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="multi-lots" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Lots Multiples ({activeLots.length})
          </TabsTrigger>
          <TabsTrigger value="archives" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archives ({archivedLots.length})
          </TabsTrigger>
          <TabsTrigger value="legacy" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Anciens Lots ({oldLots.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="multi-lots" className="space-y-4">
          {filteredMultiLots.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-neutral-500 mb-4">Aucun lot trouvé</p>
              {searchTerm && (
                <p className="text-sm text-neutral-400">
                  Essayez de modifier vos critères de recherche
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMultiLots.map(renderMultiLotCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archives" className="space-y-4">
          {filteredArchivedLots.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-neutral-500 mb-4">Aucun lot archivé</p>
              <p className="text-sm text-neutral-400">
                Les lots terminés apparaîtront ici après archivage
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredArchivedLots.map(renderMultiLotCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="legacy" className="space-y-4">
          {filteredOldLots.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-neutral-500 mb-4">Aucun ancien lot trouvé</p>
              {searchTerm && (
                <p className="text-sm text-neutral-400">
                  Essayez de modifier vos critères de recherche
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOldLots.map(renderOldLotCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}