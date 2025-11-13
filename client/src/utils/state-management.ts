import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const loadAppState = async (userId: string) => {
  try {
    const stateRef = doc(db, 'appState', userId);
    const stateDoc = await getDoc(stateRef);
    if (stateDoc.exists()) {
      return stateDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error loading app state:', error);
    return null;
  }
};