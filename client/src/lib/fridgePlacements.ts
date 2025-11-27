import { db } from './firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  DocumentReference,
} from 'firebase/firestore';

export interface FridgePlacement {
  id?: string;
  warehouseId: string;  // Reference to the warehouse/salle
  name: string;         // Nom du placement
  zone: string;         // Zone dans l'entrepôt
  temperature: number;  // Température en Celsius
  humidity: number;    // Humidité en pourcentage
  capacity: number;    // Capacité en kg ou en unités
  currentOccupancy: number; // Occupation actuelle
  status: 'active' | 'maintenance' | 'inactive'; // État du placement
  lastMaintenanceDate?: Date; // Date du dernier entretien
  notes?: string;      // Notes supplémentaires
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION_NAME = 'fridgePlacements';

// Create a new fridge placement
export async function createFridgePlacement(data: Omit<FridgePlacement, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    // Verify if the warehouse exists
    const warehouseRef = doc(db, 'salles', data.warehouseId);
    const warehouseDoc = await getDoc(warehouseRef);
    
    if (!warehouseDoc.exists()) {
      throw new Error('Warehouse not found');
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      id: docRef.id,
      ...data,
    };
  } catch (error) {
    console.error('Error creating fridge placement:', error);
    throw error;
  }
}

// Get a single fridge placement by ID
export async function getFridgePlacement(id: string): Promise<FridgePlacement | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as FridgePlacement;
  } catch (error) {
    console.error('Error getting fridge placement:', error);
    throw error;
  }
}

// Get all fridge placements for a specific warehouse
export async function getWarehouseFridgePlacements(warehouseId: string): Promise<FridgePlacement[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('warehouseId', '==', warehouseId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FridgePlacement[];
  } catch (error) {
    console.error('Error getting warehouse fridge placements:', error);
    throw error;
  }
}

// Get all fridge placements
export async function getAllFridgePlacements(): Promise<FridgePlacement[]> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FridgePlacement[];
  } catch (error) {
    console.error('Error getting all fridge placements:', error);
    throw error;
  }
}

// Update a fridge placement
export async function updateFridgePlacement(
  id: string,
  data: Partial<Omit<FridgePlacement, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating fridge placement:', error);
    throw error;
  }
}

// Delete a fridge placement
export async function deleteFridgePlacement(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error('Error deleting fridge placement:', error);
    throw error;
  }
}

// Get fridge placements by status
export async function getFridgePlacementsByStatus(status: FridgePlacement['status']): Promise<FridgePlacement[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', status)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FridgePlacement[];
  } catch (error) {
    console.error('Error getting fridge placements by status:', error);
    throw error;
  }
}

// Get available fridge placements (not full)
export async function getAvailableFridgePlacements(): Promise<FridgePlacement[]> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(placement => 
        placement.currentOccupancy < placement.capacity && 
        placement.status === 'active'
      ) as FridgePlacement[];
  } catch (error) {
    console.error('Error getting available fridge placements:', error);
    throw error;
  }
}

// Update fridge placement occupancy
export async function updateFridgePlacementOccupancy(
  id: string,
  newOccupancy: number
): Promise<void> {
  try {
    const placement = await getFridgePlacement(id);
    if (!placement) {
      throw new Error('Fridge placement not found');
    }

    if (newOccupancy > placement.capacity) {
      throw new Error('New occupancy exceeds capacity');
    }

    await updateDoc(doc(db, COLLECTION_NAME, id), {
      currentOccupancy: newOccupancy,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating fridge placement occupancy:', error);
    throw error;
  }
}