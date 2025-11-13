import { initializeApp, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyBAFPkiFspS6Z_IaoK3uILhGXJCzReRHgw",
  authDomain: "archifage-57bb0.firebaseapp.com",
  projectId: "archifage-57bb0",
  storageBucket: "archifage-57bb0.firebasestorage.app",
  messagingSenderId: "581857787798",
  appId: "1:581857787798:web:f15c74795f1022ce8be7b7",
  measurementId: "G-89K7J1LLRZ"
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  // If an app is already initialized, get that instead
  app = getApp();
}

// Initialize Firebase services
const auth = getAuth(app);
auth.useDeviceLanguage(); // Set language to device's default

// Initialize other services
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

export { auth, db, storage, analytics };
export default app;