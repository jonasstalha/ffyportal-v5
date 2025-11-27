import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

/**
 * Authentication utilities for Firebase uploads
 */

export const getCurrentUser = (): User | null => {
  return getAuth().currentUser;
};

export const requireAuthentication = (): User => {
  const user = getCurrentUser();
  if (!user) {
    console.error('❌ AUTHENTICATION REQUIRED');
    console.error('🔐 User must be signed in to perform this action');
    console.error('🔧 Check: User authentication status in app');
    throw new Error('Authentication required: User must be signed in');
  }
  return user;
};

export const waitForAuthentication = (timeoutMs: number = 10000): Promise<User> => {
  return new Promise((resolve, reject) => {
    const auth = getAuth();
    
    // If already authenticated, return immediately
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    
    // Set up timeout
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Authentication timeout: No user signed in after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout);
      unsubscribe();
      
      if (user) {
        resolve(user);
      } else {
        reject(new Error('Authentication failed: No user signed in'));
      }
    });
  });
};

export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    const auth = getAuth();
    
    // Check if Firebase Auth is initialized
    if (!auth) {
      console.error('❌ Firebase Auth not initialized');
      return false;
    }
    
    console.log('✅ Firebase Auth initialized');
    
    const user = auth.currentUser;
    if (user) {
      console.log('✅ User authenticated:', {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName
      });
      return true;
    } else {
      console.log('⚠️ No user currently signed in');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Firebase connection check failed:', error);
    return false;
  }
};

export const logAuthStatus = (): void => {
  console.log('🔍 AUTHENTICATION STATUS CHECK');
  console.log('=' .repeat(40));
  
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (user) {
    console.log('✅ USER AUTHENTICATED');
    console.log('👤 User details:', {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime
    });
    
    // Check token
    user.getIdToken().then(token => {
      console.log('🔑 Auth token valid:', token.substring(0, 20) + '...');
    }).catch(error => {
      console.error('❌ Auth token error:', error);
    });
    
  } else {
    console.log('❌ NO USER AUTHENTICATED');
    console.log('🔧 Solutions:');
    console.log('   1. Make sure user is signed in to your app');
    console.log('   2. Check authentication flow in your login component');
    console.log('   3. Verify Firebase Auth configuration');
  }
  
  console.log('=' .repeat(40));
};
