// components/auth-provider.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword 
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { toast } from "react-hot-toast";

// Define the User interface
export interface User {
  uid: string;
  email: string;
  role: string;
  name?: string;
  createdAt?: string;
  isActive?: boolean;
  department?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, name: string, role: string) => Promise<void>;
  loading: boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAccess: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper function to get department from role
  const getDepartmentFromRole = (role: string): string => {
    const roleToDepartment: Record<string, string> = {
      'admin': 'Administration',
      'quality': 'Qualité',
      'logistics': 'Logistique',
      'reception': 'Réception',
      'production': 'Production',
      'personnel': 'Personnel',
      'comptabilite': 'Comptabilité',
      'maintenance': 'Maintenance',
    };
    return roleToDepartment[role] || 'Général';
  };

  // Function to override role based on email (for debugging/fixing)
  const overrideRoleByEmail = (email: string, currentRole: string): string => {
    const emailLower = email.toLowerCase();
    
    // Map specific emails to roles
    const emailToRole: Record<string, string> = {
      'hemzalktob@gmai.com': 'reception',
      'hemzalktob@gmail.com': 'reception',
      // Add other email mappings here as needed
    };
    
    // Check for exact email match
    if (emailToRole[emailLower]) {
      console.log(`🔄 Overriding role from "${currentRole}" to "${emailToRole[emailLower]}" for ${email}`);
      return emailToRole[emailLower];
    }
    
    // Check for email patterns
    if (emailLower.includes('reception')) return 'reception';
    if (emailLower.includes('quality') || emailLower.includes('qualite')) return 'quality';
    if (emailLower.includes('logistics') || emailLower.includes('logistique')) return 'logistics';
    if (emailLower.includes('production')) return 'production';
    if (emailLower.includes('compta') || emailLower.includes('accounting')) return 'comptabilite';
    if (emailLower.includes('personnel') || emailLower.includes('hr') || emailLower.includes('rh')) return 'personnel';
    if (emailLower.includes('maintenance')) return 'maintenance';
    if (emailLower.includes('admin')) return 'admin';
    
    return currentRole; // Keep existing role if no match
  };

  // Fetch user data from Firestore
  const fetchUserData = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
      console.log(`🔍 Fetching user data for: ${firebaseUser.email} (UID: ${firebaseUser.uid})`);
      
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      console.log(`📄 User document exists: ${userDoc.exists()}`);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log(`📊 User data from Firestore:`, userData);
        console.log(`🎯 Role in Firestore: "${userData.role}"`);
        
        // CRITICAL: Do NOT default to 'quality' anymore
        if (!userData.role || userData.role.trim() === '') {
          console.error(`❌ ERROR: No role found in Firestore for user ${firebaseUser.email}`);
          throw new Error("User role not configured in database");
        }
        
        // Apply email-based override if needed
        const finalRole = overrideRoleByEmail(firebaseUser.email!, userData.role);
        
        const userObj = {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          role: finalRole, // Use final role (with override applied)
          name: userData.name || firebaseUser.email!.split('@')[0],
          isActive: userData.isActive !== false,
          department: userData.department || getDepartmentFromRole(finalRole),
          createdAt: userData.createdAt,
          // Spread other fields at the end
          ...userData
        };
        
        console.log(`✅ Final user object:`, userObj);
        return userObj;
      } else {
        // DO NOT CREATE USER AUTOMATICALLY
        console.error(`❌ ERROR: No Firestore document found for user ${firebaseUser.email}`);
        console.error(`User must be created by admin in the /users management page first`);
        
        toast.error(`Compte non configuré. Contactez l'administrateur pour créer votre profil.`);
        await firebaseSignOut(auth);
        return null;
      }
    } catch (error) {
      console.error("❌ Error in fetchUserData:", error);
      return null;
    }
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const userData = await fetchUserData(userCredential.user);
      
      if (userData) {
        if (userData.isActive === false) {
          toast.error("Votre compte est désactivé. Contactez l'administrateur.");
          await firebaseSignOut(auth);
          setUser(null);
          return;
        }
        
        setUser(userData);
        toast.success("Connexion réussie!");
      } else {
        toast.error("Compte utilisateur non configuré. Contactez l'administrateur.");
        await firebaseSignOut(auth);
        setUser(null);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        toast.error("Email ou mot de passe incorrect.");
      } else if (error.code === 'auth/too-many-requests') {
        toast.error("Trop de tentatives de connexion. Veuillez réessayer plus tard.");
      } else if (error.code === 'auth/user-disabled') {
        toast.error("Ce compte a été désactivé.");
      } else {
        toast.error("Erreur de connexion. Veuillez réessayer.");
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign up function
  const signUp = async (email: string, password: string, name: string, role: string) => {
    try {
      setLoading(true);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email,
        name,
        role,
        createdAt: new Date().toISOString(),
        isActive: true,
        department: getDepartmentFromRole(role),
      });
      
      const userData = await fetchUserData(userCredential.user);
      setUser(userData);
      
      toast.success("Inscription réussie! Bienvenue!");
    } catch (error: any) {
      console.error("Sign up error:", error);
      
      if (error.code === 'auth/email-already-in-use') {
        toast.error("Cet email est déjà utilisé.");
      } else if (error.code === 'auth/weak-password') {
        toast.error("Mot de passe trop faible.");
      } else {
        toast.error("Erreur lors de l'inscription.");
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      setLoading(true);
      await firebaseSignOut(auth);
      setUser(null);
      toast.success("Déconnexion réussie.");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Erreur lors de la déconnexion.");
    } finally {
      setLoading(false);
    }
  };

  // Check if user has specific role
  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };

  // Check if user has any of the given roles
  const hasAnyRole = (roles: string[]): boolean => {
    return roles.includes(user?.role || '');
  };

  // Check if user has access to specific section
  const hasAccess = (section: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    const sectionAccess: Record<string, string[]> = {
      'menu': ['admin', 'quality', 'logistics', 'reception', 'production', 'personnel', 'comptabilite', 'maintenance'],
      'admin': ['admin'],
      'logistics': ['admin', 'logistics'],
      'quality': ['admin', 'quality'],
      'reception': ['admin', 'reception'],
      'production': ['admin', 'production'],
      'personnel': ['admin', 'personnel'],
      'Comptabilité': ['admin', 'comptabilite'],
      'maintenance': ['admin', 'maintenance']
    };
    
    return sectionAccess[section]?.includes(user.role) || false;
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userData = await fetchUserData(firebaseUser);
          
          if (userData) {
            if (userData.isActive === false) {
              console.warn("User account is deactivated");
              await firebaseSignOut(auth);
              setUser(null);
            } else {
              setUser(userData);
            }
          } else {
            console.warn("No user document found, signing out");
            await firebaseSignOut(auth);
            setUser(null);
          }
        } catch (error) {
          console.error("Error in auth state change:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    login,
    signOut,
    signUp,
    loading,
    hasRole,
    hasAnyRole,
    hasAccess,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}