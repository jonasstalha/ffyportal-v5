/**
 * Authentication Service for Multi-Tenant Architecture
 * Handles user registration, login, and company creation
 */

import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  getIdTokenResult
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import type { SignUpData, Company, User, CustomUserClaims } from '../types/multi-tenant';

// ============================================================================
// SIGN UP - NEW COMPANY
// ============================================================================

/**
 * Sign up new user and create new company
 * This is called for new companies joining the platform
 */
export async function signUpNewCompany(data: SignUpData) {
  const { email, password, displayName, companyName } = data;

  try {
    // 1. Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // 2. Generate company ID
    const companyId = doc(collection(db, 'companies')).id;

    // 3. Create Company document
    const companyDocRef = doc(db, 'companies', companyId);
    const newCompany: Company = {
      id: companyId,
      name: companyName || displayName,
      ownerId: firebaseUser.uid,
      createdAt: new Date(),
      subscriptionPlan: 'free',
      status: 'active',
    };

    await setDoc(companyDocRef, {
      ...newCompany,
      createdAt: serverTimestamp(),
    });

    // 4. Create User document with admin role
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const newUser: User = {
      id: firebaseUser.uid,
      email,
      displayName,
      companyId,
      role: 'admin',
      status: 'active',
      createdAt: new Date(),
    };

    await setDoc(userDocRef, {
      ...newUser,
      createdAt: serverTimestamp(),
    });

    // 5. Set custom claims on Firebase Auth user (via Cloud Function)
    await setUserCustomClaims(firebaseUser.uid, {
      companyId,
      role: 'admin',
      email,
    });

    // 6. Refresh token to get updated claims
    await firebaseUser.getIdToken(true);

    return {
      firebaseUser,
      company: newCompany,
      user: newUser,
    };
  } catch (error) {
    console.error('Sign up error:', error);
    throw error;
  }
}

// ============================================================================
// SIGN UP - EXISTING COMPANY (VIA INVITATION)
// ============================================================================

/**
 * Sign up with invitation code to join existing company
 */
export async function signUpWithInvitation(data: SignUpData) {
  const { email, password, displayName, inviteCode } = data;

  if (!inviteCode) {
    throw new Error('Invitation code is required');
  }

  try {
    // 1. Find invitation by code
    const invitationsRef = collection(db, 'companies');
    
    // Note: You'll need to set up a subcollection for invitations
    // or search across companies. Here's the approach with subcollection search:
    const invitation = await findInvitationByCode(inviteCode);

    if (!invitation) {
      throw new Error('Invalid or expired invitation code');
    }

    if (invitation.status !== 'pending') {
      throw new Error('This invitation has already been used');
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error('This invitation has expired');
    }

    if (invitation.invitedEmail !== email) {
      throw new Error('Email does not match invitation');
    }

    const companyId = invitation.companyId;

    // 2. Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // 3. Create User document with role from invitation
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const newUser: User = {
      id: firebaseUser.uid,
      email,
      displayName,
      companyId,
      role: invitation.role,
      status: 'active',
      createdAt: new Date(),
    };

    await setDoc(userDocRef, {
      ...newUser,
      createdAt: serverTimestamp(),
    });

    // 4. Set custom claims
    await setUserCustomClaims(firebaseUser.uid, {
      companyId,
      role: invitation.role,
      email,
    });

    // 5. Mark invitation as accepted
    await updateInvitationStatus(companyId, invitation.id, 'accepted');

    // 6. Refresh token
    await firebaseUser.getIdToken(true);

    return {
      firebaseUser,
      user: newUser,
    };
  } catch (error) {
    console.error('Sign up with invitation error:', error);
    throw error;
  }
}

// ============================================================================
// LOGIN
// ============================================================================

/**
 * Login user and fetch company context
 */
export async function loginUser(email: string, password: string) {
  try {
    // 1. Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // 2. Get custom claims from token
    const tokenResult = await firebaseUser.getIdTokenResult();
    const companyId = tokenResult.claims.companyId as string;

    if (!companyId) {
      throw new Error('User is not assigned to a company');
    }

    // 3. Fetch user document
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userSnapshot = await getDoc(userDocRef);

    if (!userSnapshot.exists()) {
      throw new Error('User profile not found');
    }

    const user = userSnapshot.data() as User;

    // 4. Fetch company document
    const companyRef = doc(db, 'companies', companyId);
    const companySnapshot = await getDoc(companyRef);

    if (!companySnapshot.exists()) {
      throw new Error('Company not found');
    }

    return {
      firebaseUser,
      user,
      companyId,
    };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// ============================================================================
// LOGOUT
// ============================================================================

/**
 * Sign out current user
 */
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

// ============================================================================
// CUSTOM CLAIMS MANAGEMENT
// ============================================================================

/**
 * Set custom claims on Firebase Auth user
 * This should be called from a Cloud Function for security
 */
export async function setUserCustomClaims(uid: string, claims: CustomUserClaims) {
  try {
    // Call Cloud Function to set custom claims
    // This requires a backend function like: setCustomUserClaimsFunction
    const setCustomClaimsFunction = httpsCallable(functions, 'setCustomUserClaims');
    
    await setCustomClaimsFunction({ uid, claims });
  } catch (error) {
    console.error('Error setting custom claims:', error);
    throw error;
  }
}

/**
 * Get custom claims from current user token
 */
export async function getCurrentUserClaims(): Promise<CustomUserClaims | null> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    return null;
  }

  const tokenResult = await currentUser.getIdTokenResult();
  
  return {
    companyId: tokenResult.claims.companyId as string,
    role: tokenResult.claims.role as string,
    email: tokenResult.claims.email as string,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find invitation by code
 * Searches across all companies
 */
async function findInvitationByCode(inviteCode: string) {
  try {
    const companiesRef = collection(db, 'companies');
    const companiesSnapshot = await getDocs(companiesRef);

    for (const companyDoc of companiesSnapshot.docs) {
      const invitationsRef = collection(db, 'companies', companyDoc.id, 'invitations');
      const q = query(invitationsRef, where('inviteCode', '==', inviteCode));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        return {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding invitation:', error);
    throw error;
  }
}

/**
 * Update invitation status
 */
async function updateInvitationStatus(
  companyId: string,
  invitationId: string,
  status: 'pending' | 'accepted' | 'expired'
) {
  try {
    const invitationRef = doc(
      db,
      'companies',
      companyId,
      'invitations',
      invitationId
    );

    await setDoc(invitationRef, { status }, { merge: true });
  } catch (error) {
    console.error('Error updating invitation status:', error);
    throw error;
  }
}

/**
 * Generate unique invitation code
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$/;
  return passwordRegex.test(password);
}
