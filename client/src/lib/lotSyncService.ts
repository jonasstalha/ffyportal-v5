import React from 'react';
import { firestore } from './firebase';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

// Universal Lot interface for synchronization
export interface UniversalLot {
  id: string;
  lotNumber: string;
  status: string;
  type: 'quality' | 'production';
  createdAt: any;
  updatedAt: any;
  data?: any; // Store any additional data
}

// Collection name for universal lots
const UNIVERSAL_LOTS_COLLECTION = 'universal_lots';

class LotSyncService {
  private listeners: Set<(lots: UniversalLot[]) => void> = new Set();
  private unsubscribe: (() => void) | null = null;

  // Subscribe to lot changes
  subscribeToLots(callback: (lots: UniversalLot[]) => void) {
    this.listeners.add(callback);

    if (!this.unsubscribe) {
      const lotsQuery = query(
        collection(firestore, UNIVERSAL_LOTS_COLLECTION),
        orderBy('createdAt', 'desc')
      );

      this.unsubscribe = onSnapshot(lotsQuery, (snapshot) => {
        const lots: UniversalLot[] = [];
        snapshot.forEach((doc) => {
          lots.push({ id: doc.id, ...doc.data() } as UniversalLot);
        });

        // Notify all listeners
        this.listeners.forEach(listener => {
          try {
            listener(lots);
          } catch (error) {
            console.error('Error in lot listener:', error);
          }
        });
      });
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }

  // Add a new lot
  async addLot(lot: Omit<UniversalLot, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(firestore, UNIVERSAL_LOTS_COLLECTION), {
        ...lot,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding lot:', error);
      throw error;
    }
  }

  // Update a lot
  async updateLot(lotId: string, updates: Partial<UniversalLot>): Promise<void> {
    try {
      const lotRef = doc(firestore, UNIVERSAL_LOTS_COLLECTION, lotId);
      await updateDoc(lotRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating lot:', error);
      throw error;
    }
  }

  // Delete a lot
  async deleteLot(lotId: string): Promise<void> {
    try {
      await deleteDoc(doc(firestore, UNIVERSAL_LOTS_COLLECTION, lotId));
    } catch (error) {
      console.error('Error deleting lot:', error);
      throw error;
    }
  }

  // Get lots by type
  getQualityLots(lots: UniversalLot[]): UniversalLot[] {
    return lots.filter(lot => lot.type === 'quality');
  }

  getProductionLots(lots: UniversalLot[]): UniversalLot[] {
    return lots.filter(lot => lot.type === 'production');
  }
}

// Export singleton instance
export const lotSyncService = new LotSyncService();

// Hook for using the lot sync service
export const useLotSync = () => {
  const [lots, setLots] = React.useState<UniversalLot[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = lotSyncService.subscribeToLots((updatedLots) => {
      setLots(updatedLots);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return {
    lots,
    loading,
    qualityLots: lotSyncService.getQualityLots(lots),
    productionLots: lotSyncService.getProductionLots(lots),
    addLot: lotSyncService.addLot.bind(lotSyncService),
    updateLot: lotSyncService.updateLot.bind(lotSyncService),
    deleteLot: lotSyncService.deleteLot.bind(lotSyncService)
  };
};
