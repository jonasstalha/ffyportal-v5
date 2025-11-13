import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { 
  User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = userCredential.user;
      console.log("Login success, received user data:", userData);
      toast.success("Connexion réussie");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Erreur de connexion: Email ou mot de passe incorrect");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
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
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
} 