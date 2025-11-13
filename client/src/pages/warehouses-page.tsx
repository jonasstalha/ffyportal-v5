// Firebase configuration and initialization
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth"; // Import only onAuthStateChanged
import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Plus,
  Edit,
  Trash,
  Warehouse,
  Package,
  Eye
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';

// Using shared Firebase instance from lib/firebase
import { firestore as db, auth } from "@/lib/firebase";

// Define warehouse schema
const warehouseSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  location: z.string().min(1, "La localisation est requise"),
  capacity: z.string().min(1, "La capacité est requise"),
  description: z.string().optional(),
  active: z.boolean().default(true),
});

type Warehouse = z.infer<typeof warehouseSchema> & {
  id: string;
  code: string;
  createdAt: string;
  updatedAt: string;
};

const WarehousesPage = () => {
  const [location, setLocation] = useLocation();
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Add warehouse form
  const addWarehouseForm = useForm<z.infer<typeof warehouseSchema>>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: "",
      location: "",
      capacity: "",
      description: "",
      active: true
    },
  });

  // Edit warehouse form
  const editWarehouseForm = useForm<z.infer<typeof warehouseSchema>>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: "",
      location: "",
      capacity: "",
      description: "",
      active: true
    },
  });

  const fetchWarehouses = async () => {
    try {
      setLoading(true);

      // Ensure the user is authenticated
      const user = auth.currentUser;
      if (!user) {
        console.error("User is not authenticated");
        setWarehouses([]);
        setLoading(false);
        return;
      }

      const warehousesCollection = collection(db, "salles");
      const warehouseQuery = query(warehousesCollection, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(warehouseQuery);

      const warehousesData: Warehouse[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          location: data.location,
          capacity: data.capacity,
          description: data.description || "",
          code: data.code || "",
          active: data.active,
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
        };
      });

      setWarehouses(warehousesData);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
    } finally {
      setLoading(false);
    }
  };

  // Ensure the user is authenticated before fetching data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchWarehouses();
      } else {
        console.error("User is not authenticated");
      }
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const onAddWarehouseSubmit = async (values: z.infer<typeof warehouseSchema>) => {
    try {
      // Ensure user authenticated (Firestore rules may require auth)
      const user = auth.currentUser;
      if (!user) {
        alert('Vous devez être connecté pour ajouter une salle de stockage.');
        return;
      }
      // Generate warehouse code
      const warehouseCode = `WH-${String(warehouses.length + 1).padStart(3, '0')}`;

      // Add doc to Firebase
      const payload = {
        ...values,
        // Firestore rules expect capacity as a number
        capacity: Number(values.capacity),
        code: warehouseCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "salles"), payload);

      // Add the new warehouse to the local state
      const newWarehouse: Warehouse = {
        ...values,
        id: docRef.id,
        code: warehouseCode,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Refresh list from server to ensure consistency
      await fetchWarehouses();
      addWarehouseForm.reset();
      setOpenAddDialog(false);
      toast({ title: 'Salle ajoutée', description: `Salle ${values.name} ajoutée avec succès.` });
    } catch (error) {
      console.error("Error adding warehouse:", error);
      toast({ title: 'Erreur', description: 'Erreur lors de l\'ajout de la salle de stockage. Vérifiez la console.', variant: 'destructive' });
    }
  };

  const handleEditWarehouse = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    editWarehouseForm.reset({
      name: warehouse.name,
      location: warehouse.location,
      capacity: warehouse.capacity,
      description: warehouse.description,
      active: warehouse.active
    });
    setOpenEditDialog(true);
  };

  const onEditWarehouseSubmit = async (values: z.infer<typeof warehouseSchema>) => {
    if (!selectedWarehouse) return;

    try {
      const warehouseRef = doc(db, "salles", selectedWarehouse.id);
      // Ensure capacity is sent as a number to satisfy Firestore rules
      await updateDoc(warehouseRef, {
        ...values,
        capacity: Number(values.capacity),
        updatedAt: serverTimestamp()
      });

      const updatedWarehouse: Warehouse = {
        ...selectedWarehouse,
        ...values,
        updatedAt: new Date().toISOString()
      };

      setWarehouses(warehouses.map(warehouse =>
        warehouse.id === selectedWarehouse.id ? updatedWarehouse : warehouse
      ));

      setOpenEditDialog(false);
      setSelectedWarehouse(null);
    } catch (error) {
      console.error("Error updating warehouse:", error);
    }
  };

  const handleDeleteWarehouse = async (warehouseId: string) => {
    try {
      await deleteDoc(doc(db, "salles", warehouseId));
      setWarehouses(warehouses.filter(warehouse => warehouse.id !== warehouseId));
    } catch (error) {
      console.error("Error deleting warehouse:", error);
    }
  };

  const handleViewWarehouseDetails = (warehouseId: string) => {
    setLocation(`/warehouses/${warehouseId}`);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Salles de stockage</h2>
        <Button onClick={() => setOpenAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> Ajouter une salle de stockage
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-neutral-500">Chargement des salles de stockage...</p>
          </div>
        </div>
      ) : warehouses.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border rounded-lg p-6 bg-neutral-50">
          <Warehouse className="h-12 w-12 text-neutral-300 mb-4" />
          <h3 className="text-lg font-medium mb-2">Aucune salle de stockage trouvée</h3>
          <p className="text-neutral-500 text-center mb-4">
            Vous n'avez pas encore ajouté de salle de stockage. Commencez par en ajouter une.
          </p>
          <Button onClick={() => setOpenAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter une salle de stockage
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((warehouse) => (
            <Card key={warehouse.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{warehouse.name}</CardTitle>
                    <p className="text-sm text-neutral-500 mt-1">{warehouse.location}</p>
                  </div>
                  <Badge variant={warehouse.active ? "default" : "outline"} className={warehouse.active ? "bg-green-100 text-green-800 hover:bg-green-100" : "text-neutral-500"}>
                    {warehouse.active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="flex items-center text-sm text-neutral-500 mb-4">
                  <Package className="h-4 w-4 mr-2" />
                  <span>Capacité: {warehouse.capacity}</span>
                </div>
                <p className="text-sm line-clamp-2">
                  {warehouse.description || "Aucune description disponible."}
                </p>
              </CardContent>
              <CardFooter className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => handleEditWarehouse(warehouse)}>
                  <Edit className="h-4 w-4 mr-2" /> Modifier
                </Button>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDeleteWarehouse(warehouse.id)}>
                    <Trash className="h-4 w-4 mr-2" /> Supprimer
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleViewWarehouseDetails(warehouse.id)}>
                    <Eye className="h-4 w-4 mr-2" /> Détails
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Add Warehouse Dialog */}
      <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une salle de stockage</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour ajouter une nouvelle salle de stockage.
            </DialogDescription>
          </DialogHeader>
          <Form {...addWarehouseForm}>
            <form onSubmit={addWarehouseForm.handleSubmit(onAddWarehouseSubmit)} className="space-y-4">
              <FormField
                control={addWarehouseForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom de la salle de stockage" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addWarehouseForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localisation</FormLabel>
                    <FormControl>
                      <Input placeholder="Adresse ou localisation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addWarehouseForm.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacité</FormLabel>
                    <FormControl>
                      <Input placeholder="Capacité de stockage" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addWarehouseForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Description de la salle de stockage" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addWarehouseForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Actif</FormLabel>
                      <FormDescription>
                        Indiquez si la salle de stockage est actuellement active
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit">Ajouter</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Warehouse Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la salle de stockage</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la salle de stockage.
            </DialogDescription>
          </DialogHeader>
          {selectedWarehouse && (
            <Form {...editWarehouseForm}>
              <form onSubmit={editWarehouseForm.handleSubmit(onEditWarehouseSubmit)} className="space-y-4">
                <FormField
                  control={editWarehouseForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input placeholder="Nom de la salle de stockage" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editWarehouseForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localisation</FormLabel>
                      <FormControl>
                        <Input placeholder="Adresse ou localisation" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editWarehouseForm.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacité</FormLabel>
                      <FormControl>
                        <Input placeholder="Capacité de stockage" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editWarehouseForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Description de la salle de stockage" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editWarehouseForm.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Actif</FormLabel>
                        <FormDescription>
                          Indiquez si la salle de stockage est actuellement active
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">Enregistrer</Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarehousesPage;