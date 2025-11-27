import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { storage, db } from './firebase';

// Simple data structure for the MVP
export interface LotData {
  id: string;
  name: string;
  calibers: {
    caliber: string;
    images: File[];
    savedImageUrls: string[];
  }[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Upload an image to Firebase Storage for quality control
 */
export const uploadQualityControlImage = async (
  file: File,
  lotId: string,
  type: string,
  caliber: string
): Promise<string> => {
  try {
    // Clean the caliber name for use in path
    const cleanCaliber = caliber.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Create a unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    
    // Create storage path
    const imagePath = `quality-control/${lotId}/${type}/${cleanCaliber}/${fileName}`;
    const imageRef = ref(storage, imagePath);
    
    console.log('Uploading image to path:', imagePath);
    console.log('File details:', { name: file.name, size: file.size, type: file.type });
    
    // Upload the file
    const snapshot = await uploadBytes(imageRef, file);
    console.log('Upload successful, getting download URL...');
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('Download URL obtained:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error(`Failed to upload image: ${(error as Error).message}`);
  }
};

/**
 * Save quality control data to Firestore
 */
export const saveQualityControlData = async (lots: LotData[]): Promise<void> => {
  try {
    console.log('Saving quality control data to Firestore...');
    
    // Save to a single document for simplicity
    const docRef = doc(db, 'quality-control', 'lots-data');
    await setDoc(docRef, {
      lots: lots,
      lastUpdated: new Date().toISOString(),
      cleared: false, // Reset cleared flag when saving new data
    });
    
    console.log('Quality control data saved successfully');
  } catch (error) {
    console.error('Error saving quality control data:', error);
    throw new Error(`Failed to save data: ${(error as Error).message}`);
  }
};

/**
 * Get quality control data from Firestore
 */
export const getQualityControlData = async (): Promise<LotData[]> => {
  try {
    console.log('Loading quality control data from Firestore...');
    
    // Check localStorage first to see if recently hidden
    const hiddenTimestamp = localStorage.getItem('qualityControlHidden');
    const clearedTimestamp = localStorage.getItem('qualityControlCleared');
    if (hiddenTimestamp || clearedTimestamp) {
      const hiddenTime = hiddenTimestamp ? new Date(hiddenTimestamp) : new Date(clearedTimestamp || '');
      const now = new Date();
      const timeDiff = now.getTime() - hiddenTime.getTime();
      
      // If hidden less than 10 minutes ago, don't even try to load
      if (timeDiff < 10 * 60 * 1000) {
        console.log('Data was recently hidden locally, returning empty array');
        return [];
      }
    }
    
    const docRef = doc(db, 'quality-control', 'lots-data');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('Quality control data loaded successfully', data);
      
      // Multiple checks for hidden/cleared state
      if (data.hidden === true || 
          data.cleared === true || 
          !data.lots || 
          data.lots.length === 0 ||
          (data.hiddenAt && new Date(data.hiddenAt).getTime() > (Date.now() - 10 * 60 * 1000)) ||
          (data.clearedAt && new Date(data.clearedAt).getTime() > (Date.now() - 10 * 60 * 1000))) {
        console.log('Data was hidden/cleared or empty, returning empty array');
        return [];
      }
      
      // Additional validation - check if lots array is actually empty
      const validLots = data.lots.filter((lot: any) => lot && lot.id && lot.name);
      if (validLots.length === 0) {
        console.log('No valid lots found, returning empty array');
        return [];
      }
      
      return validLots;
    } else {
      console.log('No existing quality control data found');
      return [];
    }
  } catch (error) {
    console.error('Error loading quality control data:', error);
    // On error, return empty array instead of throwing
    console.log('Returning empty array due to error');
    return [];
  }
};

/**
 * Hide all quality control data (mark as hidden without deleting)
 */
export const hideQualityControlData = async (): Promise<void> => {
  try {
    console.log('Hiding all quality control data...');
    
    // Hide MVP data (lots-data document) by marking as hidden
    const docRef = doc(db, 'quality-control', 'lots-data');
    await setDoc(docRef, {
      lots: [],
      lastUpdated: new Date().toISOString(),
      hiddenAt: new Date().toISOString(),
      hidden: true,
      version: Date.now(),
    });
    console.log('MVP document marked as hidden');
    
    // Hide all documents in quality_control_lots collection
    console.log('Hiding quality_control_lots collection...');
    const lotsCollectionRef = collection(db, 'quality_control_lots');
    const lotsSnapshot = await getDocs(lotsCollectionRef);
    
    if (!lotsSnapshot.empty) {
      const batch = writeBatch(db);
      lotsSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          hidden: true,
          hiddenAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
      console.log(`Marked ${lotsSnapshot.docs.length} lots as hidden in quality_control_lots collection`);
    }
    
    // Hide all documents in quality_reports collection
    console.log('Hiding quality_reports collection...');
    const reportsCollectionRef = collection(db, 'quality_reports');
    const reportsSnapshot = await getDocs(reportsCollectionRef);
    
    if (!reportsSnapshot.empty) {
      const batch = writeBatch(db);
      reportsSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          hidden: true,
          hiddenAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
      console.log(`Marked ${reportsSnapshot.docs.length} reports as hidden in quality_reports collection`);
    }
    
    // Wait to ensure all operations are committed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('All quality control data marked as hidden successfully');
  } catch (error) {
    console.error('Error hiding quality control data:', error);
    throw new Error(`Failed to hide data: ${(error as Error).message}`);
  }
};

/**
 * Clear all quality control data (reset to zero state)
 * @deprecated Use hideQualityControlData instead to preserve data
 */
export const clearQualityControlData = async (): Promise<void> => {
  // Redirect to hide function to preserve data
  return hideQualityControlData();
};

/**
 * Test Firebase Storage connection and authentication
 */
export const testFirebaseConnection = async (): Promise<boolean> => {
  try {
    console.log('Testing Firebase connection...');
    
    // Create a test reference
    const testRef = ref(storage, '.connection-test');
    console.log('Storage reference created successfully');
    
    // Test Firestore connection
    const docRef = doc(db, 'test', 'connection');
    await setDoc(docRef, { 
      timestamp: new Date().toISOString(),
      test: true 
    });
    console.log('Firestore connection test successful');
    
    return true;
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return false;
  }
};
