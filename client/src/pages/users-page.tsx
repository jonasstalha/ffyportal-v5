import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, User as UserIcon, Loader2, Edit, Trash2, RefreshCw, Eye, AlertCircle } from "lucide-react";
import { createUserWithEmailAndPassword, deleteUser as deleteAuthUser, updateProfile, getAuth } from "firebase/auth";
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { toast } from "react-hot-toast";
import { useAuth } from "@/lib/auth";

type UserRole = "admin" | "operator" | "client" | "logistique" | "quality" | "comptability" | "support" | "production" | "reception";

interface UserData {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  id?: string;
  createdAt?: any;
  updatedAt?: any;
  displayName?: string;
}

const db = getFirestore();

const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  confirmPassword: z.string(),
  fullName: z.string().min(2, "Le nom complet est requis"),
  role: z.enum(["admin", "operator", "client", "logistique", "quality", "comptability", "support", "production", "reception"]),
}).refine((data) => {
  return data.password === data.confirmPassword;
}, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const editUserSchema = z.object({
  email: z.string().email("Email invalide"),
  fullName: z.string().min(2, "Le nom complet est requis"),
  role: z.enum(["admin", "operator", "client", "logistique", "quality", "comptability", "support", "production", "reception"]),
});

function UsersPage() {
  // Auth hooks
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.email === 'ablaziz@gmail.com' || authUser?.email?.endsWith('@admin.com');

  // Form hooks
  const addUserForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      role: "operator",
    },
  });

  const editUserForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      email: "",
      fullName: "",
      role: "operator",
    },
  });

  // State hooks
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // REAL FETCH USERS FUNCTION
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      console.log("Not admin, skipping fetch");
      return;
    }
    
    try {
      setIsLoading(true);
      console.log("Fetching users from Firestore...");
      
      const usersCollection = collection(db, "users");
      const userSnapshot = await getDocs(usersCollection);
      
      console.log(`Found ${userSnapshot.docs.length} users`);
      
      const usersList: UserData[] = userSnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        console.log("User data:", data);
        
        return {
          id: docSnapshot.id,
          uid: data.uid || docSnapshot.id,
          email: data.email || "N/A",
          fullName: data.fullName || data.displayName || "Sans nom",
          role: (data.role || "operator") as UserRole,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          displayName: data.displayName || data.fullName,
        };
      });
      
      console.log("Processed users:", usersList);
      setUsers(usersList);
      setFilteredUsers(usersList);
      
      if (usersList.length > 0) {
        toast.success(`${usersList.length} utilisateur(s) chargé(s)`);
      } else {
        toast.info("Aucun utilisateur trouvé");
      }
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error(`Erreur: ${error.message || "Impossible de récupérer les utilisateurs"}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // REAL CREATE USER FUNCTION
  const onAddUserSubmit = async (values: z.infer<typeof registerSchema>) => {
    try {
      setIsSubmitting(true);
      console.log("Creating user with values:", values);
      
      if (!isAdmin) {
        toast.error("Seuls les administrateurs peuvent créer des utilisateurs");
        return;
      }

      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        values.email,
        values.password
      );
      
      console.log("User created in Auth:", userCredential.user.uid);
        
      const userId = userCredential.user.uid;
      
      // Update display name in auth
      await updateProfile(userCredential.user, {
        displayName: values.fullName
      });
      
      // Create user document in Firestore
      const userDoc = doc(db, "users", userId);
      const userData = {
        email: values.email,
        fullName: values.fullName,
        role: values.role,
        uid: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        displayName: values.fullName,
      };
      
      console.log("Creating Firestore document:", userData);
      await setDoc(userDoc, userData);
      
      toast.success(`Utilisateur ${values.fullName} créé avec succès`);
      addUserForm.reset();
      setOpenAddDialog(false);
      
      // Refresh users list
      await fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      
      // Handle Firebase Auth errors
      if (error.code === 'auth/email-already-in-use') {
        toast.error(`⚠️ L'email ${values.email} est déjà utilisé. Veuillez en choisir un autre.`, {
          duration: 5000,
        });
      } else if (error.code === 'auth/invalid-email') {
        toast.error("Adresse email invalide");
      } else if (error.code === 'auth/weak-password') {
        toast.error("Le mot de passe doit contenir au moins 6 caractères");
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error("La création de compte par email/mot de passe n'est pas activée");
      } else if (error.code === 'auth/network-request-failed') {
        toast.error("Erreur de connexion réseau");
      } else if (error.message?.includes('INVALID_EMAIL')) {
        toast.error("Format d'email invalide");
      } else if (error.message?.includes('EMAIL_EXISTS')) {
        toast.error("Cette adresse email est déjà utilisée");
      } else if (error.message?.includes('WEAK_PASSWORD')) {
        toast.error("Le mot de passe est trop faible (minimum 6 caractères)");
      } else {
        toast.error(`Erreur: ${error.message || "Erreur lors de la création de l'utilisateur"}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // REAL UPDATE USER FUNCTION
  const onEditUserSubmit = async (values: z.infer<typeof editUserSchema>) => {
    if (!selectedUser) {
      toast.error("Aucun utilisateur sélectionné");
      return;
    }
    
    try {
      setIsSubmitting(true);
      console.log("Updating user:", selectedUser.uid, "with values:", values);
      
      if (!isAdmin) {
        toast.error("Seuls les administrateurs peuvent modifier les utilisateurs");
        return;
      }

      const userId = selectedUser.id || selectedUser.uid;
      const userDocRef = doc(db, "users", userId);
      
      // Check if user exists
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        toast.error("Utilisateur non trouvé dans la base de données");
        return;
      }

      // Update Firestore document
      const updateData = {
        email: values.email,
        fullName: values.fullName,
        role: values.role,
        displayName: values.fullName,
        updatedAt: serverTimestamp(),
      };
      
      console.log("Updating with data:", updateData);
      await updateDoc(userDocRef, updateData);

      toast.success(`Utilisateur ${values.fullName} mis à jour avec succès`);
      setOpenEditDialog(false);
      setSelectedUser(null);
      
      // Refresh users list
      await fetchUsers();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(`Erreur: ${error.message || "Erreur lors de la mise à jour"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // REAL DELETE USER FUNCTION
  const confirmDeleteUser = (user: UserData) => {
    setUserToDelete(user);
    setOpenDeleteDialog(true);
  };

  const deleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setIsSubmitting(true);
      console.log("Deleting user:", userToDelete.uid);
      
      if (!isAdmin) {
        toast.error("Seuls les administrateurs peuvent supprimer des utilisateurs");
        return;
      }

      const userId = userToDelete.id || userToDelete.uid;
      
      // Delete from Firestore
      const userDocRef = doc(db, "users", userId);
      console.log("Deleting Firestore document:", userId);
      await deleteDoc(userDocRef);
      
      toast.success(`Utilisateur ${userToDelete.fullName} supprimé avec succès`);
      setOpenDeleteDialog(false);
      setUserToDelete(null);
      
      // Refresh users list
      await fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(`Erreur: ${error.message || "Erreur lors de la suppression"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // REFRESH FUNCTION
  const refreshUsers = async () => {
    setIsRefreshing(true);
    console.log("Refreshing users...");
    await fetchUsers();
    setIsRefreshing(false);
  };

  // OPEN EDIT DIALOG
  const openEditUserDialog = (user: UserData) => {
    console.log("Opening edit dialog for user:", user);
    setSelectedUser(user);
    editUserForm.reset({
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
    });
    setOpenEditDialog(true);
  };

  // OPEN VIEW DIALOG
  const openViewUserDialog = (user: UserData) => {
    console.log("Opening view dialog for user:", user);
    setSelectedUser(user);
    setOpenViewDialog(true);
  };

  // Effect for initial load
  useEffect(() => {
    console.log("Initial load effect, isAdmin:", isAdmin);
    if (isAdmin) {
      fetchUsers();
    } else {
      setIsLoading(false);
    }
  }, [isAdmin, fetchUsers]);

  // Effect for filtering users
  useEffect(() => {
    console.log("Filtering users, search:", searchTerm, "role:", selectedRole);
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedRole !== "all") {
      filtered = filtered.filter(user => user.role === selectedRole);
    }

    console.log(`Filtered ${filtered.length} users from ${users.length}`);
    setFilteredUsers(filtered);
  }, [users, searchTerm, selectedRole]);

  // Early return for non-admin users
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Accès Refusé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Seuls les administrateurs peuvent accéder à cette page.</p>
            <p className="text-sm text-gray-500 mt-2">Votre email: {authUser?.email}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getUserRoleDisplay = (role: string) => {
    const roleMap: Record<string, string> = {
      admin: "Administrateur",
      operator: "Opérateur",
      client: "Client",
      logistique: "Logistique",
      quality: "Qualité",
      comptability: "Comptabilité",
      support: "Support",
      production: "Production",
      reception: "Réception"
    };
    return roleMap[role] || role;
  };

  const getUserRoleBadgeClass = (role: string) => {
    const badgeMap: Record<string, string> = {
      admin: "bg-purple-100 text-purple-800",
      operator: "bg-blue-100 text-blue-800",
      client: "bg-yellow-100 text-yellow-800",
      logistique: "bg-green-100 text-green-800",
      quality: "bg-red-100 text-red-800",
      comptability: "bg-orange-100 text-orange-800",
      support: "bg-teal-100 text-teal-800",
      production: "bg-pink-100 text-pink-800",
      reception: "bg-indigo-100 text-indigo-800"
    };
    return badgeMap[role] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    
    try {
      // Handle Firestore Timestamp
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString('fr-FR');
      }
      // Handle Date object
      if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString('fr-FR');
      }
      return "N/A";
    } catch (error) {
      return "N/A";
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Gestion des Utilisateurs ({users.length})</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={refreshUsers}
                variant="outline"
                size="icon"
                disabled={isRefreshing}
                title="Actualiser"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter un utilisateur
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajouter un utilisateur</DialogTitle>
                  </DialogHeader>
                  <Form {...addUserForm}>
                    <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="space-y-4">
                      <FormField
                        control={addUserForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="utilisateur@example.com" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addUserForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mot de passe</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} placeholder="Min. 6 caractères" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addUserForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmer le mot de passe</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addUserForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom complet</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Jean Dupont" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addUserForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rôle</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner un rôle" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="admin">Administrateur</SelectItem>
                                <SelectItem value="operator">Opérateur</SelectItem>
                                <SelectItem value="client">Client</SelectItem>
                                <SelectItem value="logistique">Logistique</SelectItem>
                                <SelectItem value="quality">Qualité</SelectItem>
                                <SelectItem value="comptability">Comptabilité</SelectItem>
                                <SelectItem value="support">Support</SelectItem>
                                <SelectItem value="production">Production</SelectItem>
                                <SelectItem value="reception">Réception</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpenAddDialog(false)}>
                          Annuler
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Créer
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="flex gap-4 mt-4">
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole | "all")}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="operator">Opérateur</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="logistique">Logistique</SelectItem>
                <SelectItem value="quality">Qualité</SelectItem>
                <SelectItem value="comptability">Comptabilité</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="reception">Réception</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <UserIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Aucun utilisateur trouvé</p>
              {searchTerm || selectedRole !== "all" ? (
                <p className="text-sm text-gray-400 mt-2">Essayez de modifier vos filtres</p>
              ) : (
                <Button onClick={() => setOpenAddDialog(true)} className="mt-4">
                  Créer le premier utilisateur
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Date de création</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id || user.uid}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <UserIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium">{user.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{user.email}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUserRoleBadgeClass(user.role)}`}>
                        {getUserRoleDisplay(user.role)}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openViewUserDialog(user)}
                          title="Voir les détails"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditUserDialog(user)}
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => confirmDeleteUser(user)}
                          disabled={isSubmitting}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* EDIT DIALOG */}
          <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifier l'utilisateur</DialogTitle>
              </DialogHeader>
              <Form {...editUserForm}>
                <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-4">
                  <FormField
                    control={editUserForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editUserForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom complet</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editUserForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rôle</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un rôle" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Administrateur</SelectItem>
                            <SelectItem value="operator">Opérateur</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                            <SelectItem value="logistique">Logistique</SelectItem>
                            <SelectItem value="quality">Qualité</SelectItem>
                            <SelectItem value="comptability">Comptabilité</SelectItem>
                            <SelectItem value="support">Support</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="reception">Réception</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpenEditDialog(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* VIEW DIALOG */}
          <Dialog open={openViewDialog} onOpenChange={setOpenViewDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Détails de l'utilisateur</DialogTitle>
              </DialogHeader>
              {selectedUser && (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-center gap-4 pb-4 border-b">
                      <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                        <UserIcon className="h-8 w-8 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{selectedUser.fullName}</h3>
                        <p className="text-sm text-gray-500">{selectedUser.email}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Rôle</label>
                      <p className="text-sm mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUserRoleBadgeClass(selectedUser.role)}`}>
                          {getUserRoleDisplay(selectedUser.role)}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Date de création</label>
                      <p className="text-sm mt-1">{formatDate(selectedUser.createdAt)}</p>
                    </div>
                    {selectedUser.updatedAt && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Dernière modification</label>
                        <p className="text-sm mt-1">{formatDate(selectedUser.updatedAt)}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-gray-500">ID utilisateur</label>
                      <p className="text-sm text-gray-400 font-mono mt-1 break-all">{selectedUser.uid}</p>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenViewDialog(false)}>
                  Fermer
                </Button>
                <Button type="button" onClick={() => {
                  setOpenViewDialog(false);
                  openEditUserDialog(selectedUser!);
                }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* DELETE CONFIRMATION DIALOG */}
          <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Confirmer la suppression
                </DialogTitle>
              </DialogHeader>
              {userToDelete && (
                <div className="space-y-4">
                  <p>Êtes-vous sûr de vouloir supprimer l'utilisateur suivant ?</p>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                        <UserIcon className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{userToDelete.fullName}</p>
                        <p className="text-sm text-gray-600">{userToDelete.email}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getUserRoleBadgeClass(userToDelete.role)}`}>
                          {getUserRoleDisplay(userToDelete.role)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-red-600 font-medium">
                    ⚠️ Cette action est irréversible et supprimera toutes les données associées à cet utilisateur.
                  </p>
                </div>
              )}
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setOpenDeleteDialog(false);
                    setUserToDelete(null);
                  }}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button 
                  type="button" 
                  variant="destructive"
                  onClick={deleteUser}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Supprimer définitivement
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

export default UsersPage;