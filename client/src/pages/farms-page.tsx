// Firebase imports
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
import { firestore as db } from "@/lib/firebase"; // Import shared firestore instance
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
  DialogFooter
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
import { Plus, MapPin, Edit2, Trash2, Eye } from "lucide-react";
import { useLocation } from "wouter";

// Using shared Firebase instance from lib/firebase.ts
// No need to initialize Firebase again here

// Define farm schema
const farmSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  location: z.string().min(1, "La localisation est requise"),
  description: z.string().optional(),
  code: z.string().optional(),
  active: z.boolean().default(true),
});

type Farm = z.infer<typeof farmSchema> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

const FarmsPage = () => {
  const [location, setLocation] = useLocation();
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  // Add farm form
  const addFarmForm = useForm<z.infer<typeof farmSchema>>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      name: "",
      location: "",
      description: "",
      code: "",
      active: true
    },
  });

  // Edit farm form
  const editFarmForm = useForm<z.infer<typeof farmSchema>>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      name: "",
      location: "",
      description: "",
      code: "",
      active: true
    },
  });

  // Fetch farms from Firebase on component mount
  useEffect(() => {
    fetchFarms();
  }, []);

  const fetchFarms = async () => {
    try {
      setLoading(true);
      const farmsCollection = collection(db, "farms");
      const farmQuery = query(farmsCollection, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(farmQuery);

      const farmsData: Farm[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          location: data.location,
          description: data.description || "",
          code: data.code || "",
          active: data.active,
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
        };
      });

      setFarms(farmsData);
    } catch (error) {
      console.error("Error fetching farms:", error);
    } finally {
      setLoading(false);
    }
  };

  const onAddFarmSubmit = async (values: z.infer<typeof farmSchema>) => {
    try {
      // Generate farm code
      const farmCode = `F-${String(farms.length + 1).padStart(3, '0')}`;

      // Add doc to Firebase
      const docRef = await addDoc(collection(db, "farms"), {
        ...values,
        code: farmCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Add the new farm to the local state
      const newFarm: Farm = {
        ...values,
        id: docRef.id,
        code: farmCode,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setFarms(prevFarms => [newFarm, ...prevFarms]);
      addFarmForm.reset();
      setOpenAddDialog(false);
    } catch (error) {
      console.error("Error adding farm:", error);
    }
  };

  const handleEditFarm = (farm: Farm) => {
    setSelectedFarm(farm);
    editFarmForm.reset({
      name: farm.name,
      location: farm.location,
      description: farm.description,
      code: farm.code,
      active: farm.active
    });
    setOpenEditDialog(true);
  };

  const onEditFarmSubmit = async (values: z.infer<typeof farmSchema>) => {
    if (!selectedFarm) return;

    try {
      const farmRef = doc(db, "farms", selectedFarm.id);
      await updateDoc(farmRef, {
        ...values,
        updatedAt: serverTimestamp()
      });

      const updatedFarm: Farm = {
        ...selectedFarm,
        ...values,
        updatedAt: new Date().toISOString()
      };

      setFarms(farms.map(farm =>
        farm.id === selectedFarm.id ? updatedFarm : farm
      ));

      setOpenEditDialog(false);
      setSelectedFarm(null);
    } catch (error) {
      console.error("Error updating farm:", error);
    }
  };

  const handleDeleteFarm = async (farmId: string) => {
    try {
      await deleteDoc(doc(db, "farms", farmId));
      setFarms(farms.filter(farm => farm.id !== farmId));
    } catch (error) {
      console.error("Error deleting farm:", error);
    }
  };

  const handleViewFarmDetails = (farmId: string) => {
    setLocation(`/farms/${farmId}`);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des Fermes</h2>
        <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une ferme
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une ferme</DialogTitle>
            </DialogHeader>
            <Form {...addFarmForm}>
              <form onSubmit={addFarmForm.handleSubmit(onAddFarmSubmit)} className="space-y-4">
                <FormField
                  control={addFarmForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de la ferme</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addFarmForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localisation</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addFarmForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addFarmForm.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Ferme active</FormLabel>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">
                    Créer
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.length > 0 ? (
            farms.map((farm) => (
              <Card key={farm.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl">{farm.name}</CardTitle>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-blue-500 hover:text-blue-700"
                        onClick={() => handleEditFarm(farm)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteFarm(farm.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-neutral-500">
                    <MapPin className="h-4 w-4 mr-1" />
                    {farm.location}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600">{farm.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-mono text-neutral-500">{farm.code}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${farm.active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                      }`}>
                      {farm.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between text-sm text-neutral-500">
                  <span>Créé le {new Date(farm.createdAt).toLocaleDateString()}</span>
                  <span>Modifié le {new Date(farm.updatedAt).toLocaleDateString()}</span>
                </CardFooter>
                <CardFooter className="pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleViewFarmDetails(farm.id)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Détails
                  </Button>
                </CardFooter>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center p-12 text-neutral-500">
              Aucune ferme trouvée. Ajoutez une nouvelle ferme en cliquant sur le bouton ci-dessus.
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la ferme</DialogTitle>
          </DialogHeader>
          <Form {...editFarmForm}>
            <form onSubmit={editFarmForm.handleSubmit(onEditFarmSubmit)} className="space-y-4">
              <FormField
                control={editFarmForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de la ferme</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editFarmForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localisation</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editFarmForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editFarmForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editFarmForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Ferme active</FormLabel>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit">
                  Enregistrer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FarmsPage;