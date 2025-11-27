import { useParams, Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  Warehouse,
  MapPin,
  Calendar,
  Package,
  Users,
  ClipboardList,
  AlertCircle,
  Edit,
  Trash,
  TrendingUp,
  BarChart3,
  Activity,
  RefreshCw
} from "lucide-react";
import { doc, getDoc, deleteDoc, collection, getDocs, query, where, addDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { firestore as db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

// Warehouse type definition
type Warehouse = {
  id: string;
  name: string;
  location: string;
  capacity: string;
  description: string;
  code: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  fridgeLayout?: {
    rows: number;
    columns: number;
    fridgeCount?: number;
    positions: FridgePosition[];
  };
};

type FridgePosition = {
  id: string;
  row: number;
  column: number;
  palletNumber?: string;
  lotId?: string;
  occupiedDate?: string;
  fridgeIndex?: number;
};

// Statistics type
type WarehouseStats = {
  totalLots: number;
  currentStock: number;
  utilizationRate: number;
  monthlyIncoming: number;
  monthlyOutgoing: number;
  avgStorageTime: number;
  storageHistory: Array<{
    month: string;
    incoming: number;
    outgoing: number;
    utilization: number;
  }>;
  lotsByStatus: Array<{
    status: string;
    count: number;
    color: string;
  }>;
};

export default function WarehouseDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const [showLayoutEditor, setShowLayoutEditor] = useState(false);
  const [layoutRows, setLayoutRows] = useState(3);
  const [layoutColumns, setLayoutColumns] = useState(8);
  const [fridgeCount, setFridgeCount] = useState(1);
  const [currentFridgeIndex, setCurrentFridgeIndex] = useState(1);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [palletInput, setPalletInput] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        
        // Fetch warehouse details
        const warehouseRef = doc(db, "salles", id);
        const warehouseSnap = await getDoc(warehouseRef);

        if (warehouseSnap.exists()) {
          const data = warehouseSnap.data();
          const warehouseData = {
            id: warehouseSnap.id,
            name: data.name,
            location: data.location,
            capacity: data.capacity,
            description: data.description || "",
            code: data.code || "",
            active: data.active,
            createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
            fridgeLayout: data.fridgeLayout || null,
          };
          setWarehouse(warehouseData);
          
          // Initialize layout dimensions if they exist
          if (data.fridgeLayout) {
            setLayoutRows(data.fridgeLayout.rows || 3);
            setLayoutColumns(data.fridgeLayout.columns || 8);
            setFridgeCount(data.fridgeLayout.fridgeCount || 1);
            setCurrentFridgeIndex(1);
          }
          
          // Fetch warehouse statistics
          await fetchWarehouseStats(warehouseData);
        } else {
          setError("Entrepôt non trouvé");
        }
      } catch (err) {
        console.error("Error fetching warehouse:", err);
        setError("Erreur lors du chargement des détails de l'entrepôt");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const fetchWarehouseStats = async (warehouseData: Warehouse) => {
    try {
      setStatsLoading(true);
      
      // Get all lots from the API
      const { getAvocadoTrackingData } = await import('@/lib/queryClient');
      const allLots = await getAvocadoTrackingData()();
      
      // Filter lots that are stored in this warehouse
      const warehouseLots = allLots.filter((lot: any) => 
        lot.storage?.storageRoomId?.toLowerCase().includes(warehouseData.name.toLowerCase()) ||
        lot.storage?.storageRoomId?.toLowerCase().includes(warehouseData.location.toLowerCase()) ||
        lot.storage?.storageRoomId?.includes(warehouseData.code)
      );

      // Calculate capacity from string (e.g., "1000 kg" -> 1000)
      const maxCapacity = parseFloat(warehouseData.capacity.replace(/[^0-9.]/g, '')) || 1000;
      
      // Calculate current stock (lots that are in storage but not yet exported)
      const currentLots = warehouseLots.filter((lot: any) => 
        lot.storage?.entryDate && !lot.storage?.exitDate && !lot.export?.loadingDate
      );
      
      const currentStock = currentLots.reduce((sum: number, lot: any) => 
        sum + (lot.packaging?.netWeight || 0), 0
      );
      
      const utilizationRate = (currentStock / maxCapacity) * 100;
      
      // Calculate monthly statistics
      const now = new Date();
      const monthlyData = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        
        const monthLots = warehouseLots.filter((lot: any) => {
          const entryDate = lot.storage?.entryDate ? new Date(lot.storage.entryDate) : null;
          return entryDate && entryDate >= date && entryDate < nextMonth;
        });
        
        const outgoingLots = warehouseLots.filter((lot: any) => {
          const exitDate = lot.storage?.exitDate ? new Date(lot.storage.exitDate) : null;
          return exitDate && exitDate >= date && exitDate < nextMonth;
        });
        
        monthlyData.push({
          month: date.toLocaleDateString('fr-FR', { month: 'short' }),
          incoming: monthLots.length,
          outgoing: outgoingLots.length,
          utilization: Math.min(Math.random() * 100, 95) // Simulated for demo
        });
      }
      
      // Calculate average storage time
      const completedStorageLots = warehouseLots.filter((lot: any) => 
        lot.storage?.entryDate && lot.storage?.exitDate
      );
      
      const avgStorageTime = completedStorageLots.length > 0 
        ? completedStorageLots.reduce((sum: number, lot: any) => {
            const entryDate = new Date(lot.storage.entryDate);
            const exitDate = new Date(lot.storage.exitDate);
            return sum + ((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / completedStorageLots.length
        : 0;
      
      // Lots by status
      const statusCounts = {
        'En stockage': currentLots.length,
        'Expédiés': warehouseLots.filter((lot: any) => lot.export?.loadingDate).length,
        'Livrés': warehouseLots.filter((lot: any) => lot.delivery?.actualDeliveryDate).length,
      };
      
      const lotsByStatus = [
        { status: 'En stockage', count: statusCounts['En stockage'], color: '#3B82F6' },
        { status: 'Expédiés', count: statusCounts['Expédiés'], color: '#10B981' },
        { status: 'Livrés', count: statusCounts['Livrés'], color: '#8B5CF6' },
      ].filter(item => item.count > 0);
      
      const currentMonth = monthlyData[monthlyData.length - 1];
      
      setStats({
        totalLots: warehouseLots.length,
        currentStock: Math.round(currentStock),
        utilizationRate: Math.round(utilizationRate),
        monthlyIncoming: currentMonth?.incoming || 0,
        monthlyOutgoing: currentMonth?.outgoing || 0,
        avgStorageTime: Math.round(avgStorageTime),
        storageHistory: monthlyData,
        lotsByStatus
      });
      
    } catch (error) {
      console.error("Error fetching warehouse stats:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les statistiques de l'entrepôt",
        variant: "destructive",
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleEdit = () => {
    // Redirect to edit page or open edit dialog
    toast({
      title: "Fonctionnalité à venir",
      description: "L'édition directe depuis la page de détails sera bientôt disponible.",
    });
  };

  const handleDelete = async () => {
    if (!warehouse) return;

    if (confirm("Êtes-vous sûr de vouloir supprimer cet entrepôt ?")) {
      try {
        await deleteDoc(doc(db, "salles", warehouse.id));
        toast({
          title: "Entrepôt supprimé",
          description: "L'entrepôt a été supprimé avec succès.",
        });
        setLocation("/warehouses");
      } catch (error) {
        console.error("Error deleting warehouse:", error);
        toast({
          title: "Erreur",
          description: "Une erreur est survenue lors de la suppression de l'entrepôt.",
          variant: "destructive",
        });
      }
    }
  };

  const initializeFridgeLayout = async () => {
    if (!warehouse) return;

    try {
      const positions: FridgePosition[] = [];
      
      for (let f = 1; f <= fridgeCount; f++) {
        for (let row = 1; row <= layoutRows; row++) {
          for (let col = 1; col <= layoutColumns; col++) {
            positions.push({
              id: `${f}-${row}-${col}`,
              fridgeIndex: f,
              row,
              column: col,
            });
          }
        }
      }

      const updatedLayout = {
        rows: layoutRows,
        columns: layoutColumns,
        fridgeCount,
        positions,
      };

      const warehouseRef = doc(db, "salles", warehouse.id);
      // Parse/normalize capacity to a number so Firestore rules that require capacity:number pass
      const numericCapacity = (() => {
        try {
          const raw = (warehouse.capacity ?? '').toString();
          const parsed = parseFloat(raw.replace(/[^0-9.]/g, ''));
          if (!isNaN(parsed)) return parsed;
          // fallback: try a direct number cast
          const direct = Number((warehouse as any).capacity);
          return isNaN(direct) ? 0 : direct;
        } catch (e) {
          return 0;
        }
      })();

      // Update warehouse document with the new layout and ensure capacity is a number
      // Firestore rules expect the full warehouse shape on update (name, location, capacity, code, active)
      await updateDoc(warehouseRef, {
        name: warehouse.name,
        location: warehouse.location,
        code: warehouse.code,
        active: warehouse.active,
        capacity: numericCapacity,
        fridgeLayout: updatedLayout,
        updatedAt: Timestamp.now(),
      });

      // Also save the fridge layout to the fridgePlacements collection for backend management
      try {
        const placementsRef = collection(db, 'fridgePlacements');
        // Always create a new fridge placement document for each fridge so a warehouse can have multiple placements
          for (let f = 1; f <= fridgeCount; f++) {
          const fridgePositions = positions.filter(p => p.fridgeIndex === f).map(p => ({ ...p }));
          await addDoc(placementsRef, {
            warehouseId: warehouse.id,
            name: `${warehouse.name} - Fridge ${f} - ${new Date().toISOString()}`,
            zone: `fridge-${f}`,
            temperature: 0,
            humidity: 0,
            capacity: layoutRows * layoutColumns,
            currentOccupancy: 0,
            status: 'active',
            fridgeIndex: f,
            positions: fridgePositions,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        }
      } catch (err) {
        console.error('Error saving fridge placement to backend:', err);
      }

      setWarehouse({ ...warehouse, fridgeLayout: updatedLayout });
      setShowLayoutEditor(false);

      toast({
        title: "Configuration enregistrée",
        description: `Disposition de ${layoutRows}x${layoutColumns} positions créée.`,
      });
    } catch (error) {
      console.error("Error initializing layout:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration.",
        variant: "destructive",
      });
    }
  };

  const assignPalletToPosition = async (positionId: string) => {
    if (!warehouse || !warehouse.fridgeLayout || !palletInput.trim()) return;

    try {
      const updatedPositions = warehouse.fridgeLayout.positions.map(pos => {
        if (pos.id === positionId) {
          return {
            ...pos,
            palletNumber: palletInput.trim(),
            occupiedDate: new Date().toISOString(),
          };
        }
        return pos;
      });

      const updatedLayout = {
        ...warehouse.fridgeLayout,
        positions: updatedPositions,
      };

      const warehouseRef = doc(db, "salles", warehouse.id);
      await import('firebase/firestore').then(({ updateDoc }) => 
        updateDoc(warehouseRef, { fridgeLayout: updatedLayout })
      );

      setWarehouse({ ...warehouse, fridgeLayout: updatedLayout });
      setSelectedPosition(null);
      setPalletInput("");
      
      toast({
        title: "Palette assignée",
        description: `Palette ${palletInput} assignée à la position ${positionId}.`,
      });
    } catch (error) {
      console.error("Error assigning pallet:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'assigner la palette.",
        variant: "destructive",
      });
    }
  };

  const removePalletFromPosition = async (positionId: string) => {
    if (!warehouse || !warehouse.fridgeLayout) return;

    try {
      const updatedPositions = warehouse.fridgeLayout.positions.map(pos => {
        if (pos.id === positionId) {
          return {
            id: pos.id,
            row: pos.row,
            column: pos.column,
          };
        }
        return pos;
      });

      const updatedLayout = {
        ...warehouse.fridgeLayout,
        positions: updatedPositions,
      };

      const warehouseRef = doc(db, "salles", warehouse.id);
      await import('firebase/firestore').then(({ updateDoc }) => 
        updateDoc(warehouseRef, { fridgeLayout: updatedLayout })
      );

      setWarehouse({ ...warehouse, fridgeLayout: updatedLayout });
      
      toast({
        title: "Palette retirée",
        description: `La palette a été retirée de la position ${positionId}.`,
      });
    } catch (error) {
      console.error("Error removing pallet:", error);
      toast({
        title: "Erreur",
        description: "Impossible de retirer la palette.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-neutral-500">Chargement des détails de l'entrepôt...</p>
        </div>
      </div>
    );
  }

  if (error || !warehouse) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            {error || "Entrepôt non trouvé. Veuillez réessayer plus tard."}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/warehouses">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux entrepôts
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Local alias so TypeScript can narrow fridgeLayout in JSX
  const layout = warehouse?.fridgeLayout;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/warehouses">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{warehouse.name}</h1>
            <p className="text-neutral-500">Code: {warehouse.code}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Modifier
          </Button>
          <Button variant="outline" size="sm" className="text-red-500" onClick={handleDelete}>
            <Trash className="mr-2 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex justify-end">
        <Badge className={warehouse.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {warehouse.active ? "Actif" : "Inactif"}
        </Badge>
      </div>

      {/* Main Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Warehouse className="mr-2 h-5 w-5" />
            Informations Générales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-neutral-500 mr-2 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-neutral-500">Localisation</p>
                  <p className="text-lg">{warehouse.location}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start">
                <Package className="h-5 w-5 text-neutral-500 mr-2 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-neutral-500">Capacité</p>
                  <p className="text-lg">{warehouse.capacity}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="font-medium text-sm text-neutral-500 mb-2">Description</p>
            <p className="text-neutral-700">{warehouse.description || "Aucune description disponible."}</p>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dates Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-sm text-neutral-500">Date de création</p>
                <p>{formatDate(warehouse.createdAt)}</p>
              </div>
              <div>
                <p className="font-medium text-sm text-neutral-500">Dernière modification</p>
                <p>{formatDate(warehouse.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <ClipboardList className="mr-2 h-5 w-5" />
                Statistiques Détaillées
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchWarehouseStats(warehouse!)}
                disabled={statsLoading}
              >
                {statsLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span>Chargement des statistiques...</span>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalLots}</div>
                    <div className="text-sm text-blue-700">Total Lots</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.currentStock}kg</div>
                    <div className="text-sm text-green-700">Stock Actuel</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.utilizationRate}%</div>
                    <div className="text-sm text-purple-700">Utilisation</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600">{stats.avgStorageTime}</div>
                    <div className="text-sm text-orange-700">Jours Moy. Stockage</div>
                  </div>
                </div>

                {/* Monthly Activity Chart */}
                <div>
                  <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Activité Mensuelle
                  </h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stats.storageHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          name === 'utilization' ? `${value.toFixed(1)}%` : `${value} lots`,
                          name === 'incoming' ? 'Entrées' :
                          name === 'outgoing' ? 'Sorties' : 'Utilisation'
                        ]}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="incoming" fill="#3b82f6" name="Entrées" />
                      <Bar yAxisId="left" dataKey="outgoing" fill="#10b981" name="Sorties" />
                      <Line yAxisId="right" type="monotone" dataKey="utilization" stroke="#8b5cf6" name="Utilisation %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Status Distribution */}
                {stats.lotsByStatus.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Répartition par Statut
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={stats.lotsByStatus}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ status, count }) => `${status}: ${count}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {stats.lotsByStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Performance Insights */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg">
                  <h5 className="font-semibold mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    Insights de Performance
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Capacité Restante:</span>
                      <span className="text-blue-600 ml-2">
                        {Math.max(0, parseFloat(warehouse.capacity.replace(/[^0-9.]/g, '')) - stats.currentStock).toFixed(0)}kg
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Rotation Stock:</span>
                      <span className="text-green-600 ml-2">
                        {stats.avgStorageTime > 0 ? (365 / stats.avgStorageTime).toFixed(1) : 'N/A'}x/an
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Activité Ce Mois:</span>
                      <span className="text-purple-600 ml-2">
                        {stats.monthlyIncoming} entrées, {stats.monthlyOutgoing} sorties
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Efficacité:</span>
                      <span className={`ml-2 ${
                        stats.utilizationRate > 80 ? 'text-red-600' :
                        stats.utilizationRate > 60 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {stats.utilizationRate > 80 ? 'Surchargé' :
                         stats.utilizationRate > 60 ? 'Optimal' : 'Sous-utilisé'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-neutral-500 text-center py-8">
                Aucune donnée disponible. Cliquez sur actualiser pour charger les statistiques.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fridge Layout Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="mr-2 h-5 w-5" />
              Gestion des Positions Frigo
            </div>
            {!warehouse.fridgeLayout && (
              <Button onClick={() => setShowLayoutEditor(!showLayoutEditor)}>
                Configurer la disposition
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showLayoutEditor ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nombre de lignes</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={layoutRows}
                    onChange={(e) => setLayoutRows(parseInt(e.target.value) || 3)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Nombre de colonnes (palettes par ligne)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={layoutColumns}
                    onChange={(e) => setLayoutColumns(parseInt(e.target.value) || 8)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Nombre de frigos</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={fridgeCount}
                    onChange={(e) => setFridgeCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  Configuration: {layoutRows} lignes × {layoutColumns} colonnes × {fridgeCount} frigo(s) = {layoutRows * layoutColumns * fridgeCount} emplacements de palettes
                </p>
              </div>
              <div className="flex space-x-2">
                <Button onClick={initializeFridgeLayout}>
                  Créer la disposition
                </Button>
                <Button variant="outline" onClick={() => setShowLayoutEditor(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : layout ? (
            <div className="space-y-6">
              {/* Layout Info */}
              <div className="flex items-center justify-between bg-neutral-50 p-4 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Configuration actuelle</p>
                  <p className="text-2xl font-bold">{layout.rows} × {layout.columns} — {layout.fridgeCount || 1} frigo(s)</p>
                  <p className="text-sm text-neutral-600">
                    {layout.positions.filter(p => p.palletNumber).length} / {layout.positions.length} positions occupées
                  </p>
                </div>
                <Button variant="outline" onClick={() => setShowLayoutEditor(true)}>
                  Reconfigurer
                </Button>
              </div>

              {/* Fridge selector when multiple fridges exist */}
              {layout.fridgeCount && layout.fridgeCount > 1 && (
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-medium">Frigo:</span>
                  {Array.from({ length: layout.fridgeCount }, (_, i) => i + 1).map(f => (
                    <button
                      key={f}
                      className={`px-3 py-1 rounded ${currentFridgeIndex === f ? 'bg-blue-600 text-white' : 'bg-white border'}`}
                      onClick={() => setCurrentFridgeIndex(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}

              {/* Fridge Visual Layout */}
              <div className="border-2 border-neutral-300 rounded-lg p-4 bg-gradient-to-b from-blue-50 to-blue-100">
                <h4 className="text-lg font-semibold mb-4 text-center">Plan du Frigo</h4>
                <div className="space-y-2">
                  {Array.from({ length: layout.rows }, (_, rowIndex) => (
                    <div key={rowIndex} className="flex gap-2">
                      <div className="w-12 flex items-center justify-center font-bold text-neutral-600">
                        L{rowIndex + 1}
                      </div>
                      {Array.from({ length: layout.columns }, (_, colIndex) => {
                        const position = layout.positions.find(
                          p => p.row === rowIndex + 1 && p.column === colIndex + 1 && p.fridgeIndex === currentFridgeIndex
                        );
                        const isOccupied = position?.palletNumber;
                        const positionId = `${currentFridgeIndex}-${rowIndex + 1}-${colIndex + 1}`;
                        const isSelected = selectedPosition === positionId;

                        return (
                          <div
                            key={colIndex}
                            className={`flex-1 min-h-[80px] border-2 rounded-lg p-2 cursor-pointer transition-all ${
                              isOccupied
                                ? 'bg-green-100 border-green-500 hover:bg-green-200'
                                : 'bg-white border-neutral-300 hover:bg-neutral-50'
                            } ${isSelected ? 'ring-4 ring-blue-400' : ''}`}
                            onClick={() => setSelectedPosition(isSelected ? null : positionId)}
                          >
                            <div className="text-xs font-medium text-neutral-500 mb-1">
                              P{colIndex + 1}
                            </div>
                            {isOccupied ? (
                              <div className="space-y-1">
                                <div className="text-sm font-bold text-green-800">
                                  #{position.palletNumber}
                                </div>
                                <div className="text-xs text-green-600">
                                  {position.occupiedDate && new Date(position.occupiedDate).toLocaleDateString('fr-FR')}
                                </div>
                                {isSelected && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full mt-2 text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removePalletFromPosition(positionId);
                                    }}
                                  >
                                    Retirer
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="text-center text-neutral-400 text-xs mt-2">
                                Vide
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pallet Assignment Form */}
              {selectedPosition && !layout.positions.find(p => p.id === selectedPosition)?.palletNumber && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-semibold mb-3">Assigner une palette à la position {selectedPosition}</h5>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Numéro de palette (ex: PAL-001)"
                      value={palletInput}
                      onChange={(e) => setPalletInput(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-md"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          assignPalletToPosition(selectedPosition);
                        }
                      }}
                    />
                    <Button onClick={() => assignPalletToPosition(selectedPosition)}>
                      Assigner
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedPosition(null)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white border-2 border-neutral-300 rounded"></div>
                  <span>Position vide</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded"></div>
                  <span>Position occupée</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
              <p className="text-neutral-600 mb-4">Aucune disposition configurée pour ce frigo</p>
              <Button onClick={() => setShowLayoutEditor(true)}>
                Configurer maintenant
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personnel Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Personnel Assigné
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-neutral-500 text-sm italic mb-4">La gestion du personnel assigné à cet entrepôt sera bientôt disponible.</p>
          <Button variant="outline">
            Assigner du personnel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}