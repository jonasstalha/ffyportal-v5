import { useState, useEffect } from 'react';
import { sharedLotService, SharedLot } from '../lib/sharedLotService';

export interface UseSharedLotsReturn {
  lots: SharedLot[];
  loading: boolean;
  error: string;
  addLot: (lotData: Omit<SharedLot, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateLot: (lotId: string, updates: Partial<SharedLot>) => Promise<void>;
  deleteLot: (lotId: string) => Promise<void>;
  getLot: (lotId: string) => SharedLot | undefined;
  getQualityLots: () => SharedLot[];
  getProductionLots: () => SharedLot[];
  getDechetLots: () => SharedLot[];
}

export const useSharedLots = (): UseSharedLotsReturn => {
  const [lots, setLots] = useState<SharedLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = sharedLotService.subscribeToLots(
      (updatedLots) => {
        setLots(updatedLots);
        setLoading(false);
      },
      (err) => {
        console.error('useSharedLots subscribe error:', err);
        setError(err.message || 'Permission or network error');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const addLot = async (lotData: Omit<SharedLot, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
      setError('');
      return await sharedLotService.addLot(lotData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding lot');
      throw err;
    }
  };

  const updateLot = async (lotId: string, updates: Partial<SharedLot>): Promise<void> => {
    try {
      setError('');
      await sharedLotService.updateLot(lotId, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating lot');
      throw err;
    }
  };

  const deleteLot = async (lotId: string): Promise<void> => {
    try {
      setError('');
      await sharedLotService.deleteLot(lotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting lot');
      throw err;
    }
  };

  const getLot = (lotId: string): SharedLot | undefined => {
    return lots.find(lot => lot.id === lotId);
  };

  const getQualityLots = (): SharedLot[] => {
    return lots.filter(lot => lot.type === 'quality');
  };

  const getProductionLots = (): SharedLot[] => {
    return lots.filter(lot => lot.type === 'production');
  };

  const getDechetLots = (): SharedLot[] => {
    return lots.filter(lot => lot.type === 'dechets');
  };

  return {
    lots,
    loading,
    error,
    addLot,
    updateLot,
    deleteLot,
    getLot,
    getQualityLots,
  getProductionLots,
  getDechetLots
  };
};
