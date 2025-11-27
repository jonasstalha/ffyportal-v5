import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Package, Clock, CheckCircle, Archive } from 'lucide-react';
import { useMultiLots } from '@/hooks/useMultiLots';
import { MultiLot } from '@/lib/multiLotService';

interface MultiLotSelectorProps {
  selectedLot: MultiLot | null;
  onLotSelect: (lot: MultiLot) => void;
  onNewLot: () => void;
}

export default function MultiLotSelector({ selectedLot, onLotSelect, onNewLot }: MultiLotSelectorProps) {
  const { 
    activeLots, 
    archivedLots, 
    loading, 
    error, 
    getDraftLots, 
    getInProgressLots, 
    getCompletedLots 
  } = useMultiLots();

  const [activeTab, setActiveTab] = useState('active');

  const getProgressPercentage = (lot: MultiLot) => {
    return ((lot.completedSteps?.length || 0) / 7) * 100;
  };

  const getStatusBadge = (lot: MultiLot) => {
    const statusConfig = {
      'draft': { color: 'bg-gray-100 text-gray-800', icon: '📝', text: 'Brouillon' },
      'in-progress': { color: 'bg-blue-100 text-blue-800', icon: '🔄', text: 'En cours' },
      'completed': { color: 'bg-green-100 text-green-800', icon: '✅', text: 'Terminé' },
      'archived': { color: 'bg-purple-100 text-purple-800', icon: '📦', text: 'Archivé' }
    };

    const config = statusConfig[lot.status] || statusConfig.draft;
    
    return (
      <Badge className={config.color}>
        <span className="mr-1">{config.icon}</span>
        {config.text}
      </Badge>
    );
  };

  const renderLotCard = (lot: MultiLot) => (
    <Card 
      key={lot.id} 
      className={`cursor-pointer transition-all hover:shadow-md ${
        selectedLot?.id === lot.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
      }`}
      onClick={() => onLotSelect(lot)}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold">
            {lot.lotNumber || lot.harvest?.lotNumber || 'Nouveau lot'}
          </CardTitle>
          {getStatusBadge(lot)}
        </div>
        <div className="text-sm text-gray-600">
          Ferme: {lot.harvest?.farmLocation || 'Non spécifiée'}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Progression</span>
              <span className="font-medium">{Math.round(getProgressPercentage(lot))}%</span>
            </div>
            <Progress value={getProgressPercentage(lot)} className="h-2" />
          </div>

          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Étape actuelle:</span>
              <span className="font-medium">{lot.currentStep || 1}/7</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Dernière mise à jour:</span>
              <span className="font-medium">
                {lot.updatedAt ? new Date(lot.updatedAt).toLocaleDateString() : 'Jamais'}
              </span>
            </div>
          </div>

          {lot.status === 'completed' && lot.completedAt && (
            <div className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Terminé le {new Date(lot.completedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Sélectionner un lot</h3>
        <Button onClick={onNewLot} size="sm" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nouveau lot
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Actifs ({activeLots.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archives ({archivedLots.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {/* Lots en brouillon */}
          {getDraftLots().length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Brouillons ({getDraftLots().length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getDraftLots().map(renderLotCard)}
              </div>
            </div>
          )}

          {/* Lots en cours */}
          {getInProgressLots().length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Package className="h-4 w-4" />
                En cours ({getInProgressLots().length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getInProgressLots().map(renderLotCard)}
              </div>
            </div>
          )}

          {/* Lots terminés (non archivés) */}
          {getCompletedLots().length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Terminés ({getCompletedLots().length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getCompletedLots().map(renderLotCard)}
              </div>
            </div>
          )}

          {activeLots.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun lot actif</p>
              <p className="text-sm">Créez un nouveau lot pour commencer</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="space-y-4">
          {archivedLots.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {archivedLots.map(renderLotCard)}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun lot archivé</p>
              <p className="text-sm">Les lots terminés apparaîtront ici après archivage</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
