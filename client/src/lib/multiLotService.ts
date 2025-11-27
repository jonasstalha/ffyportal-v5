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
  orderBy,
  where,
  getDocs
} from 'firebase/firestore';

export interface MultiLot {
  id: string;
  lotNumber: string;
  status: 'draft' | 'in-progress' | 'completed' | 'archived';
  currentStep: number;
  completedSteps: number[];
  assignedUsers: string[];
  globallyAccessible: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  
  // All tracking data
  harvest: {
    harvestDate: string;
    farmLocation: string;
    farmerId: string;
    lotNumber: string;
    variety: string;
    avocadoType: string;
  };
  transport: {
    transportCompany: string;
    driverName: string;
    vehicleId: string;
    departureDateTime: string;
    arrivalDateTime: string;
    temperature: number;
  };
  sorting: {
    sortingDate: string;
    qualityGrade: string;
    rejectedCount: number;
    notes: string;
  };
  packaging: {
    packagingDate: string;
    boxId: string;
    workerIds: string[];
    netWeight: number;
    avocadoCount: number;
    boxType: string;
    boxTypes: string[];
    calibers: string[];
    boxWeights: string[];
    paletteNumbers: string[];
  };
  storage: {
    boxId: string;
    entryDate: string;
    storageTemperature: number;
    storageRoomId: string;
    exitDate: string;
  };
  export: {
    boxId: string;
    loadingDate: string;
    containerId: string;
    driverName: string;
    vehicleId: string;
    destination: string;
  };
  delivery: {
    boxId: string;
    estimatedDeliveryDate: string;
    actualDeliveryDate: string;
    clientName: string;
    clientLocation: string;
    notes: string;
  };
}

// Firestore collection for multi-lots
const MULTI_LOTS_COLLECTION = 'multi_lots';

class MultiLotService {
  private listeners: ((lots: MultiLot[]) => void)[] = [];
  private unsubscribe: (() => void) | null = null;

  // Subscribe to real-time updates
  subscribeToLots(callback: (lots: MultiLot[]) => void, filter?: { status?: string; userId?: string }) {
    this.listeners.push(callback);

    if (!this.unsubscribe) {
      let lotsQuery = query(
        collection(firestore, MULTI_LOTS_COLLECTION),
        orderBy('updatedAt', 'desc')
      );

      // Add filters if provided
      if (filter?.status) {
        lotsQuery = query(lotsQuery, where('status', '==', filter.status));
      }

      this.unsubscribe = onSnapshot(lotsQuery, (snapshot) => {
        const lots: MultiLot[] = [];
        snapshot.forEach((doc) => {
          const lotData = { id: doc.id, ...doc.data() } as MultiLot;
          
          // Filter by user access if specified
          if (filter?.userId) {
            if (lotData.globallyAccessible || 
                lotData.createdBy === filter.userId || 
                lotData.assignedUsers?.includes(filter.userId)) {
              lots.push(lotData);
            }
          } else {
            lots.push(lotData);
          }
        });

        // Notify all listeners
        this.listeners.forEach(listener => listener(lots));
      });
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
  async addLot(lotData: Omit<MultiLot, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(firestore, MULTI_LOTS_COLLECTION), {
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
  async updateLot(lotId: string, updates: Partial<MultiLot>): Promise<void> {
    try {
      const lotRef = doc(firestore, MULTI_LOTS_COLLECTION, lotId);
      await updateDoc(lotRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating lot:', error);
      throw error;
    }
  }

  // Mark lot as completed and archive
  async completeLot(lotId: string): Promise<void> {
    try {
      const lotRef = doc(firestore, MULTI_LOTS_COLLECTION, lotId);
      await updateDoc(lotRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error completing lot:', error);
      throw error;
    }
  }

  // Archive completed lot (move from active to archive)
  async archiveLot(lotId: string): Promise<void> {
    try {
      const lotRef = doc(firestore, MULTI_LOTS_COLLECTION, lotId);
      await updateDoc(lotRef, {
        status: 'archived',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error archiving lot:', error);
      throw error;
    }
  }

  // Delete a lot
  async deleteLot(lotId: string): Promise<void> {
    try {
      await deleteDoc(doc(firestore, MULTI_LOTS_COLLECTION, lotId));
    } catch (error) {
      console.error('Error deleting lot:', error);
      throw error;
    }
  }

  // Get a single lot
  async getLot(lotId: string): Promise<MultiLot | null> {
    try {
      const docSnap = await getDoc(doc(firestore, MULTI_LOTS_COLLECTION, lotId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as MultiLot;
      }
      return null;
    } catch (error) {
      console.error('Error getting lot:', error);
      throw error;
    }
  }

  // Get all active lots (not archived)
  async getActiveLots(): Promise<MultiLot[]> {
    try {
      const q = query(
        collection(firestore, MULTI_LOTS_COLLECTION),
        where('status', '!=', 'archived'),
        orderBy('status'),
        orderBy('updatedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const lots: MultiLot[] = [];
      snapshot.forEach((doc) => {
        lots.push({ id: doc.id, ...doc.data() } as MultiLot);
      });
      
      return lots;
    } catch (error) {
      console.error('Error getting active lots:', error);
      throw error;
    }
  }

  // Get archived lots
  async getArchivedLots(): Promise<MultiLot[]> {
    try {
      const q = query(
        collection(firestore, MULTI_LOTS_COLLECTION),
        where('status', '==', 'archived'),
        orderBy('completedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const lots: MultiLot[] = [];
      snapshot.forEach((doc) => {
        lots.push({ id: doc.id, ...doc.data() } as MultiLot);
      });
      
      return lots;
    } catch (error) {
      console.error('Error getting archived lots:', error);
      throw error;
    }
  }

  // Update lot step and mark as completed
  async updateLotStep(lotId: string, step: number, stepData: any): Promise<void> {
    try {
      const lotRef = doc(firestore, MULTI_LOTS_COLLECTION, lotId);
      const lotDoc = await getDoc(lotRef);
      
      if (!lotDoc.exists()) {
        throw new Error('Lot not found');
      }
      
      const currentLot = lotDoc.data() as MultiLot;
      const completedSteps = [...(currentLot.completedSteps || [])];
      
      if (!completedSteps.includes(step)) {
        completedSteps.push(step);
      }
      
      // Determine if lot is completed (all 7 steps done)
      const isCompleted = completedSteps.length === 7;
      let status = currentLot.status;
      
      if (isCompleted) {
        status = 'completed';
      } else if (status === 'draft') {
        status = 'in-progress';
      }
      
      const updates: any = {
        currentStep: Math.max(step + 1, currentLot.currentStep || 1),
        completedSteps,
        status,
        ...stepData,
        updatedAt: serverTimestamp()
      };
      
      if (isCompleted) {
        updates.completedAt = serverTimestamp();
      }
      
      await updateDoc(lotRef, updates);
      
      // Auto-archive if completed
      if (isCompleted) {
        setTimeout(async () => {
          await this.archiveLot(lotId);
        }, 1000); // Small delay to let the UI update
      }
    } catch (error) {
      console.error('Error updating lot step:', error);
      throw error;
    }
  }

  // Add user to lot
  async addUserToLot(lotId: string, userId: string): Promise<void> {
    try {
      const lotRef = doc(firestore, MULTI_LOTS_COLLECTION, lotId);
      const lotDoc = await getDoc(lotRef);
      
      if (!lotDoc.exists()) {
        throw new Error('Lot not found');
      }
      
      const currentLot = lotDoc.data() as MultiLot;
      const assignedUsers = [...(currentLot.assignedUsers || [])];
      
      if (!assignedUsers.includes(userId)) {
        assignedUsers.push(userId);
        await updateDoc(lotRef, {
          assignedUsers,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error adding user to lot:', error);
      throw error;
    }
  }

  // Remove user from lot
  async removeUserFromLot(lotId: string, userId: string): Promise<void> {
    try {
      const lotRef = doc(firestore, MULTI_LOTS_COLLECTION, lotId);
      const lotDoc = await getDoc(lotRef);
      
      if (!lotDoc.exists()) {
        throw new Error('Lot not found');
      }
      
      const currentLot = lotDoc.data() as MultiLot;
      const assignedUsers = (currentLot.assignedUsers || []).filter(id => id !== userId);
      
      await updateDoc(lotRef, {
        assignedUsers,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error removing user from lot:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const multiLotService = new MultiLotService();
