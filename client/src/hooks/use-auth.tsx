import { createContext, useContext, useEffect, useState } from "react";
import { 
  User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInAnonymously
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";

export type UserRole = 'admin' | 'quality' | 'logistics' | 'reception' | 'production' | 'personnel' | 'comptabilite' | 'maintenance';

interface CustomUser extends User {
  role?: UserRole;
}

interface AuthContextType {
  user: CustomUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasAccess: (section: string) => boolean;
}

// All sections are accessible to all roles
const allSections = [
  'menu', 'admin', 'logistics', 'quality', 'reception', 'production',
  'personnel', 'comptabilite', 'maintenance', 'dashboard'
];

const rolePermissions: Record<UserRole, string[]> = {
  admin: allSections,
  quality: allSections,
  logistics: allSections,
  reception: allSections,
  production: allSections,
  personnel: allSections,
  comptabilite: allSections,
  maintenance: allSections
};

// Demo role mapping based on email
const getRoleFromEmail = (email: string): UserRole => {
  const emailLower = email.toLowerCase();
  
  // Specific admin users
  if (emailLower === 'ablaziz@gmail.com') return 'admin';
  
  // Check for admin
  if (emailLower.includes('admin')) return 'admin';
  
  // Check for quality (both English and French)
  if (emailLower.includes('quality') || emailLower.includes('qualite')) return 'quality';
  
  // Check for logistics (both English and French)
  if (emailLower.includes('logistics') || emailLower.includes('logistique')) return 'logistics';
  
  // Check for other roles
  if (emailLower.includes('reception')) return 'reception';
  if (emailLower.includes('production')) return 'production';
  if (emailLower.includes('personnel')) return 'personnel';
  if (emailLower.includes('comptabilite') || emailLower.includes('comptability')) return 'comptabilite';
  if (emailLower.includes('maintenance')) return 'maintenance';
  
  // For unknown emails, return 'quality' as a safer default (instead of admin)
  return 'quality';
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const customUser: CustomUser = {
          ...firebaseUser,
          role: getRoleFromEmail(firebaseUser.email || '')
        };
        setUser(customUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hasAccess = (section: string): boolean => {
    // Always return true to make all sections visible to all users
    return true;
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Check if it's a demo user first
      const demoUsers: Record<string, { email: string; role: UserRole }> = {
        // Example.com demo users
        "admin@example.com": { email: "admin@example.com", role: "admin" },
        "quality@example.com": { email: "quality@example.com", role: "quality" },
        "logistics@example.com": { email: "logistics@example.com", role: "logistics" },
        "reception@example.com": { email: "reception@example.com", role: "reception" },
        "production@example.com": { email: "production@example.com", role: "production" },
        "personnel@example.com": { email: "personnel@example.com", role: "personnel" },
        "comptabilite@example.com": { email: "comptabilite@example.com", role: "comptabilite" },
        "maintenance@example.com": { email: "maintenance@example.com", role: "maintenance" },
        
        // Fruitsforyou.com users with proper roles
        "admin@fruitsforyou.com": { email: "admin@fruitsforyou.com", role: "admin" },
        "qualite@fruitsforyou.com": { email: "qualite@fruitsforyou.com", role: "quality" },
        "logistique@fruitsforyou.com": { email: "logistique@fruitsforyou.com", role: "logistics" },
        "reception@fruitsforyou.com": { email: "reception@fruitsforyou.com", role: "reception" },
        "production@fruitsforyou.com": { email: "production@fruitsforyou.com", role: "production" },
        "personnel@fruitsforyou.com": { email: "personnel@fruitsforyou.com", role: "personnel" },
        "comptabilite@fruitsforyou.com": { email: "comptabilite@fruitsforyou.com", role: "comptabilite" },
        "maintenance@fruitsforyou.com": { email: "maintenance@fruitsforyou.com", role: "maintenance" },
      };

      // Check if it's a demo user
      const isDemoUser = !!demoUsers[email];
      const passwordMatch = password === "Demo@2024!";
      
      console.log("Authentication attempt:", { email, isDemoUser, passwordMatch });
      
      if (isDemoUser && passwordMatch) {
        console.log("Demo user login successful");
        // For demo users, sign in anonymously to get a proper Firebase auth context
        // This ensures Firestore rules recognize the user as authenticated
        const userCredential = await signInAnonymously(auth);
        const firebaseUser = userCredential.user;
        
        // Create a demo user object with the Firebase UID but demo role
        const demoUser: CustomUser = {
          ...firebaseUser,
          email,
          displayName: `${demoUsers[email].role.charAt(0).toUpperCase() + demoUsers[email].role.slice(1)} User`,
          role: demoUsers[email].role,
        };
        setUser(demoUser);
        toast.success("Connexion réussie");
        return;
      }

      console.log("Attempting Firebase authentication");
      // If not a demo user, try Firebase authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = userCredential.user;
      console.log("Firebase login successful");
      toast.success("Connexion réussie");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Erreur de connexion. Vérifiez vos identifiants.");
      toast.error("Erreur de connexion: Email ou mot de passe incorrect");
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Clear user state immediately
      setUser(null);
      
      // Clear localStorage data
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      
      // Clear sessionStorage data
      sessionStorage.clear();
      
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      toast.success("Déconnexion réussie");
      
      // Force page reload to clear any cached state
      setTimeout(() => {
        window.location.href = '/auth';
      }, 500);
      
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Erreur lors de la déconnexion");
      
      // Even if Firebase signOut fails, clear local data and redirect
      setUser(null);
      localStorage.clear();
      sessionStorage.clear();
      
      setTimeout(() => {
        window.location.href = '/auth';
      }, 500);
      
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
