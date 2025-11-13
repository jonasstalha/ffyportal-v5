import { useState, useEffect } from 'react';
import { multiLotService, MultiLot } from '../lib/multiLotService';
import { useAuth } from './use-auth';

export interface UseMultiLotsReturn {
  lots: MultiLot[];
  activeLots: MultiLot[];
  archivedLots: MultiLot[];
  loading: boolean;
  error: string;
  addLot: (lotData: Omit<MultiLot, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateLot: (lotId: string, updates: Partial<MultiLot>) => Promise<void>;
  updateLotStep: (lotId: string, step: number, stepData: any) => Promise<void>;
  completeLot: (lotId: string) => Promise<void>;
  archiveLot: (lotId: string) => Promise<void>;
  deleteLot: (lotId: string) => Promise<void>;
  addUserToLot: (lotId: string, userId: string) => Promise<void>;
  removeUserFromLot: (lotId: string, userId: string) => Promise<void>;
  getLot: (lotId: string) => MultiLot | undefined;
  getLotsByStatus: (status: string) => MultiLot[];
  getUserLots: () => MultiLot[];
  getInProgressLots: () => MultiLot[];
  getDraftLots: () => MultiLot[];
  getCompletedLots: () => MultiLot[];
}

export const useMultiLots = (): UseMultiLotsReturn => {
  const [lots, setLots] = useState<MultiLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = multiLotService.subscribeToLots((updatedLots) => {
      setLots(updatedLots);
      setLoading(false);
    }, { userId: user.uid });

    return unsubscribe;
  }, [user]);

  const addLot = async (lotData: Omit<MultiLot, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
      setError('');
      if (!user) throw new Error('User not authenticated');
      
      const lotWithUser = {
        ...lotData,
        createdBy: user.uid,
        assignedUsers: [user.uid],
        globallyAccessible: true, // Make all lots globally accessible by default
      };
      
      return await multiLotService.addLot(lotWithUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding lot');
      throw err;
    }
  };

  const updateLot = async (lotId: string, updates: Partial<MultiLot>): Promise<void> => {
    try {
      setError('');
      await multiLotService.updateLot(lotId, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating lot');
      throw err;
    }
  };

  const updateLotStep = async (lotId: string, step: number, stepData: any): Promise<void> => {
    try {
      setError('');
      await multiLotService.updateLotStep(lotId, step, stepData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating lot step');
      throw err;
    }
  };

  const completeLot = async (lotId: string): Promise<void> => {
    try {
      setError('');
      await multiLotService.completeLot(lotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error completing lot');
      throw err;
    }
  };

  const archiveLot = async (lotId: string): Promise<void> => {
    try {
      setError('');
      await multiLotService.archiveLot(lotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error archiving lot');
      throw err;
    }
  };

  const deleteLot = async (lotId: string): Promise<void> => {
    try {
      setError('');
      await multiLotService.deleteLot(lotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting lot');
      throw err;
    }
  };

  const addUserToLot = async (lotId: string, userId: string): Promise<void> => {
    try {
      setError('');
      await multiLotService.addUserToLot(lotId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding user to lot');
      throw err;
    }
  };

  const removeUserFromLot = async (lotId: string, userId: string): Promise<void> => {
    try {
      setError('');
      await multiLotService.removeUserFromLot(lotId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error removing user from lot');
      throw err;
    }
  };

  const getLot = (lotId: string): MultiLot | undefined => {
    // Try exact id match first
    const byId = lots.find(lot => lot.id === lotId);
    if (byId) return byId;

    // Then try matching by lotNumber or harvest.lotNumber (case-insensitive)
    const normalized = lotId?.toString().toLowerCase();
    return lots.find(lot => {
      const candidate = (lot.lotNumber || lot.harvest?.lotNumber || '').toString().toLowerCase();
      return candidate === normalized;
    });
  };

  const getLotsByStatus = (status: string): MultiLot[] => {
    return lots.filter(lot => lot.status === status);
  };

  const getUserLots = (): MultiLot[] => {
    if (!user) return [];
    return lots.filter(lot => 
      lot.createdBy === user.uid || 
      lot.assignedUsers?.includes(user.uid) ||
      lot.globallyAccessible
    );
  };

  const getInProgressLots = (): MultiLot[] => {
    return lots.filter(lot => lot.status === 'in-progress');
  };

  const getDraftLots = (): MultiLot[] => {
    return lots.filter(lot => lot.status === 'draft');
  };

  const getCompletedLots = (): MultiLot[] => {
    return lots.filter(lot => lot.status === 'completed');
  };

  const activeLots = lots.filter(lot => lot.status !== 'archived');
  const archivedLots = lots.filter(lot => lot.status === 'archived');

  return {
    lots,
    activeLots,
    archivedLots,
    loading,
    error,
    addLot,
    updateLot,
    updateLotStep,
    completeLot,
    archiveLot,
    deleteLot,
    addUserToLot,
    removeUserFromLot,
    getLot,
    getLotsByStatus,
    getUserLots,
    getInProgressLots,
    getDraftLots,
    getCompletedLots
  };
};
