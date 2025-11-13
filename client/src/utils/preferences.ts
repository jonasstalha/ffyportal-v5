import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const saveUserPreferences = async (userId: string, preferences: any) => {
  try {
    const userPrefsRef = doc(db, 'userPreferences', userId);
    await setDoc(userPrefsRef, preferences, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving user preferences:', error);
    return false;
  }
};