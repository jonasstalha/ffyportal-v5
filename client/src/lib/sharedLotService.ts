import { firestore } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

// Shared Lot Interface - common fields between Quality Control and Production
export interface SharedLot {
  id: string;
  lotNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  type: 'quality' | 'production' | 'reception' | 'dechets'; // Track which type of lot this is
  // Store both quality and production data
  qualityData?: any;
  productionData?: any;
  receptionData?: any;
  dechetData?: any;
}

// Firestore collection for shared lots
const SHARED_LOTS_COLLECTION = 'shared_lots';

class SharedLotService {
  private listeners: ((lots: SharedLot[]) => void)[] = [];
  private unsubscribe: (() => void) | null = null;

  // Subscribe to real-time updates
  subscribeToLots(callback: (lots: SharedLot[]) => void, onError?: (error: Error) => void) {
    this.listeners.push(callback);

    if (!this.unsubscribe) {
      const lotsQuery = query(
        collection(firestore, SHARED_LOTS_COLLECTION),
        orderBy('createdAt', 'desc')
      );

      this.unsubscribe = onSnapshot(
        lotsQuery,
        (snapshot) => {
          const lots: SharedLot[] = [];
          snapshot.forEach((doc) => {
            lots.push({ id: doc.id, ...doc.data() } as SharedLot);
          });
          // Notify all listeners
          this.listeners.forEach(listener => listener(lots));
        },
        (error) => {
          console.error('shared_lots subscription error:', error);
          if (onError) onError(error as unknown as Error);
        }
      );
    }

    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
      if (this.listeners.length === 0 && this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }

  // Add a new lot
  async addLot(lotData: Omit<SharedLot, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(firestore, SHARED_LOTS_COLLECTION), {
        ...lotData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding lot:', error);
      throw error;
    }
  }

  // Update an existing lot
  async updateLot(lotId: string, updates: Partial<SharedLot>): Promise<void> {
    try {
      const lotRef = doc(firestore, SHARED_LOTS_COLLECTION, lotId);
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
      await deleteDoc(doc(firestore, SHARED_LOTS_COLLECTION, lotId));
    } catch (error) {
      console.error('Error deleting lot:', error);
      throw error;
    }
  }

  // Get a single lot
  async getLot(lotId: string): Promise<SharedLot | null> {
    try {
      const docSnap = await getDoc(doc(firestore, SHARED_LOTS_COLLECTION, lotId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as SharedLot;
      }
      return null;
    } catch (error) {
      console.error('Error getting lot:', error);
      throw error;
    }
  }

  // Get all lots
  async getAllLots(): Promise<SharedLot[]> {
    try {
      const snapshot = await collection(firestore, SHARED_LOTS_COLLECTION);
      const lots: SharedLot[] = [];
      return lots;
    } catch (error) {
      console.error('Error getting all lots:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const sharedLotService = new SharedLotService();
