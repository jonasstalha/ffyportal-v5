import React, { useEffect } from 'react';
import { useLotSync } from '../../lib/lotSyncService';
import { Plus, Trash2 } from 'lucide-react';

interface LotSyncProps {
  pageType: 'quality' | 'production';
  onLotsUpdate?: (lots: any[]) => void;
  children: React.ReactNode;
}

export const LotSyncProvider: React.FC<LotSyncProps> = ({ 
  pageType, 
  onLotsUpdate, 
  children 
}) => {
  const { lots, qualityLots, productionLots, loading } = useLotSync();

  useEffect(() => {
    if (!loading && onLotsUpdate) {
      const relevantLots = pageType === 'quality' ? qualityLots : productionLots;
      onLotsUpdate(relevantLots);
    }
  }, [lots, loading, pageType, onLotsUpdate, qualityLots, productionLots]);

  return <>{children}</>;
};

// Export the lot count display component
export const LotCountDisplay: React.FC = () => {
  const { qualityLots, productionLots, loading, addLot, deleteLot } = useLotSync();

  const addTestQualityLot = async () => {
    try {
      await addLot({
        lotNumber: `QL-${Date.now()}`,
        status: 'draft',
        type: 'quality',
        data: { testData: 'Quality control lot' }
      });
    } catch (error) {
      console.error('Error adding quality lot:', error);
    }
  };

  const addTestProductionLot = async () => {
    try {
      await addLot({
        lotNumber: `PR-${Date.now()}`,
        status: 'brouillon',
        type: 'production',
        data: { testData: 'Production lot' }
      });
    } catch (error) {
      console.error('Error adding production lot:', error);
    }
  };

  const deleteFirstQualityLot = async () => {
    if (qualityLots.length > 0) {
      try {
        await deleteLot(qualityLots[0].id);
      } catch (error) {
        console.error('Error deleting quality lot:', error);
      }
    }
  };

  const deleteFirstProductionLot = async () => {
    if (productionLots.length > 0) {
      try {
        await deleteLot(productionLots[0].id);
      } catch (error) {
        console.error('Error deleting production lot:', error);
      }
    }
  };

  if (loading) return <div>Loading lots...</div>;

  return (
    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
      <h3 className="text-lg font-semibold text-blue-800 mb-3">📊 Synchronisation des Lots</h3>
      
      {/* Lot Counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="flex items-center gap-2 bg-blue-100 p-3 rounded-lg">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="font-medium text-blue-800">Contrôle Qualité: {qualityLots.length} lots</span>
        </div>
        <div className="flex items-center gap-2 bg-green-100 p-3 rounded-lg">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="font-medium text-green-800">Production: {productionLots.length} lots</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-lg">
          <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
          <span className="font-medium text-gray-800">Total: {qualityLots.length + productionLots.length} lots</span>
        </div>
      </div>

      {/* Test Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={addTestQualityLot}
          className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Ajouter Lot Qualité
        </button>
        <button
          onClick={addTestProductionLot}
          className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
        >
          <Plus size={16} />
          Ajouter Lot Production
        </button>
        {qualityLots.length > 0 && (
          <button
            onClick={deleteFirstQualityLot}
            className="flex items-center gap-1 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
          >
            <Trash2 size={16} />
            Supprimer Lot Qualité
          </button>
        )}
        {productionLots.length > 0 && (
          <button
            onClick={deleteFirstProductionLot}
            className="flex items-center gap-1 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
          >
            <Trash2 size={16} />
            Supprimer Lot Production
          </button>
        )}
      </div>

      <p className="text-sm text-blue-600 mt-2">
        💡 Les lots sont synchronisés en temps réel entre les pages Contrôle Qualité et Production. 
        Testez en ajoutant/supprimant des lots et naviguez entre les pages pour voir la synchronisation.
      </p>
    </div>
  );
};
