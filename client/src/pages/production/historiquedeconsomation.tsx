import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/use-auth";
import {
  AlertCircle,
  Check,
  AlertTriangle,
  Save,
  Calendar,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  TrendingUp,
  BarChart3,
  PieChart,
  Filter,
  Download,
  Eye,
  Plus,
  Minus,
  Activity,
  Package,
  Clock,
  Users
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Type definitions
interface Material {
  id: string;
  name: string;
  current_stock: number;
  alert_threshold: number;
  unit: string;
  itemType: string;
  isConsumable: boolean;
}

interface HistoryItem {
  id: string;
  itemName: string;
  quantity: number;
  date: string;
  department: string;
  itemType: string;
  unit: string;
}

interface NotificationData {
  type: 'success' | 'error' | 'info';
  message: string;
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16'];

export default function EnhancedConsumptionTracker() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'consumption' | 'history'>('consumption');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [consumption, setConsumption] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<string[]>([]);
  const [animateItems, setAnimateItems] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(true);
  
  // History & Analytics State
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar' | 'pie'>('line');

  // Check authentication status
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin mb-4">
            <RefreshCw className="h-10 w-10 text-blue-500" />
          </div>
          <p className="text-gray-600 text-lg">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Authentification requise</h2>
          <p className="text-gray-600 mb-4">
            Vous devez être connecté pour accéder à la gestion de consommation.
          </p>
          <p className="text-sm text-gray-500">
            Utilisez les identifiants: production@example.com / Demo@2024!
          </p>
        </div>
      </div>
    );
  }

  // Fetch materials from Firebase inventory collection
  const fetchMaterials = async () => {
    try {
      console.log("Fetching materials from inventory...");
      const querySnapshot = await getDocs(collection(db, "inventory"));
      const inventoryData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Map inventory fields to material fields expected by the component
        name: doc.data().itemName,
        current_stock: parseFloat(doc.data().quantity) || 0,
        alert_threshold: parseFloat(doc.data().alertThreshold) || 10,
        unit: doc.data().unit || 'unité',
        itemType: doc.data().itemType || 'Matériel',
        isConsumable: doc.data().isConsumable !== false // default to true if not specified
      }));
      
      // Filter only consumable items for production consumption
      const consumableMaterials = inventoryData.filter(item => item.isConsumable);
      console.log(`Found ${consumableMaterials.length} consumable materials`);
      setMaterials(consumableMaterials);
      
      // Initialize consumption with zeros
      const initialConsumption: Record<string, number> = {};
      consumableMaterials.forEach(material => {
        initialConsumption[material.id] = 0;
      });
      setConsumption(initialConsumption);
      
    } catch (error: any) {
      console.error("Error fetching materials:", error);
      if (error?.code === 'permission-denied') {
        showNotification({ 
          type: "error", 
          message: "Permissions insuffisantes pour accéder aux matériaux" 
        });
      } else {
        showNotification({ 
          type: "error", 
          message: "Erreur lors du chargement des matériaux" 
        });
      }
      throw error; // Re-throw to be caught by the calling function
    }
  };

  // Fetch consumption history from Firebase
  const fetchConsumptionHistory = async () => {
    try {
      console.log("Fetching consumption history...");
      const querySnapshot = await getDocs(
        query(collection(db, "consumption"), orderBy("timestamp", "desc"))
      );
      const historyData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Map consumption fields to history fields expected by the component
        itemName: doc.data().itemName,
        quantity: parseFloat(doc.data().quantity) || 0,
        date: doc.data().date || new Date(doc.data().timestamp?.toDate()).toISOString().split('T')[0],
        department: doc.data().department || 'production',
        itemType: doc.data().itemType || 'Matériel',
        unit: doc.data().unit || 'unité'
      }));
      
      console.log(`Found ${historyData.length} consumption records`);
      setHistoryData(historyData);
      setFilteredHistory(historyData);
    } catch (error: any) {
      console.error("Error fetching consumption history:", error);
      if (error?.code === 'permission-denied') {
        showNotification({ 
          type: "error", 
          message: "Permissions insuffisantes pour accéder à l'historique" 
        });
      } else {
        showNotification({ 
          type: "error", 
          message: "Erreur lors du chargement de l'historique" 
        });
      }
      throw error; // Re-throw to be caught by the calling function
    }
  };

  // Initialize data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return; // Don't fetch if no user
      
      setLoading(true);
      try {
        // Fetch real data from Firebase
        await fetchMaterials();
        await fetchConsumptionHistory();

        // Trigger animation
        setTimeout(() => setAnimateItems(true), 100);
      } catch (error: any) {
        console.error("Failed to fetch data:", error);
        if (error?.code === 'permission-denied') {
          showNotification({ 
            type: "error", 
            message: "Permissions insuffisantes. Vérifiez votre authentification." 
          });
        } else {
          showNotification({ 
            type: "error", 
            message: "Impossible de charger les données. Vérifiez votre connexion." 
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]); // Add user dependency

  // Calculate remaining stock
  const calculateRemainingStock = (material: Material): number => {
    const consumed = consumption[material.id] || 0;
    return material.current_stock - consumed;
  };

  // Check for low stock alerts
  useEffect(() => {
    const alerts = materials.filter(material => {
      const remaining = calculateRemainingStock(material);
      return remaining <= material.alert_threshold;
    }).map(material => material.name);

    setLowStockAlerts(alerts);
  }, [consumption, materials]);

  // Filter history data
  useEffect(() => {
    let filtered = historyData;

    // Filter by date range
    if (dateRange.start) {
      filtered = filtered.filter(item => item.date >= dateRange.start);
    }
    if (dateRange.end) {
      filtered = filtered.filter(item => item.date <= dateRange.end);
    }

    // Filter by material
    if (selectedMaterial !== 'all') {
      filtered = filtered.filter(item => item.itemName === selectedMaterial);
    }

    // Filter by time period
    const now = new Date();
    if (historyFilter === 'today') {
      const today = now.toISOString().split('T')[0];
      filtered = filtered.filter(item => item.date === today);
    } else if (historyFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(item => new Date(item.date) >= weekAgo);
    } else if (historyFilter === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      filtered = filtered.filter(item => new Date(item.date) >= monthAgo);
    }

    setFilteredHistory(filtered);
  }, [historyData, dateRange, selectedMaterial, historyFilter]);

  // Show notification
  const showNotification = (notif: NotificationData) => {
    setNotification(notif);
    if (notif.type === "success") {
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Handle consumption input change
  const handleConsumptionChange = (materialId: string, value: string) => {
    const numValue = parseInt(value, 10) || 0;
    const material = materials.find(m => m.id === materialId);
    
    if (material && numValue > material.current_stock) {
      showNotification({
        type: "error",
        message: `La consommation ne peut pas dépasser le stock actuel (${material.current_stock})`
      });
      return;
    } else if (numValue < 0) {
      return;
    }

    setConsumption(prev => ({ ...prev, [materialId]: numValue }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedDate) {
      showNotification({
        type: "error",
        message: "Veuillez sélectionner une date"
      });
      return;
    }

    const consumedMaterials = Object.entries(consumption)
      .filter(([_, value]) => (value as number) > 0)
      .map(([materialId, value]) => {
        const material = materials.find(m => m.id === materialId);
        return {
          id: materialId,
          consumed_qty: value as number,
          material_name: material?.name || '',
          material_type: material?.itemType || '',
          unit: material?.unit || ''
        };
      });

    if (consumedMaterials.length === 0) {
      showNotification({
        type: "error",
        message: "Aucune consommation à enregistrer"
      });
      return;
    }

    setSubmitting(true);
    try {
      // Save consumption records to Firebase and update inventory
      for (const item of consumedMaterials) {
        const material = materials.find(m => m.id === item.id);
        if (!material) continue;

        // 1. Add consumption record to Firebase
        const consumptionData = {
          itemId: item.id,
          itemName: item.material_name,
          itemType: item.material_type,
          quantity: item.consumed_qty,
          unit: item.unit,
          date: selectedDate,
          department: 'production',
          timestamp: serverTimestamp(),
          notes: `Consommation de production du ${selectedDate}`
        };

        await addDoc(collection(db, "consumption"), consumptionData);

        // 2. Update inventory quantity in Firebase
        const newQuantity = material.current_stock - item.consumed_qty;
        await updateDoc(doc(db, "inventory", item.id), { 
          quantity: newQuantity.toString() // Store as string to match existing format
        });
      }

      // Refresh data from Firebase
      await fetchMaterials();
      await fetchConsumptionHistory();

      showNotification({
        type: "success",
        message: "Consommation enregistrée avec succès"
      });

    } catch (error) {
      console.error("Failed to submit consumption:", error);
      showNotification({
        type: "error",
        message: "Erreur lors de l'enregistrement de la consommation"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Reset consumption values
  const handleReset = () => {
    const resetConsumption: Record<string, number> = {};
    materials.forEach(material => {
      resetConsumption[material.id] = 0;
    });
    setConsumption(resetConsumption);
    showNotification({
      type: "info",
      message: "Valeurs de consommation réinitialisées"
    });
  };

  // Get stock status
  const getStockStatus = (material: Material): 'danger' | 'warning' | 'normal' => {
    const remaining = calculateRemainingStock(material);
    if (remaining <= 0) return "danger";
    if (remaining <= material.alert_threshold) return "warning";
    return "normal";
  };

  // Render stock status icon
  const renderStockIcon = (status: 'danger' | 'warning' | 'normal') => {
    switch (status) {
      case "danger":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Check className="w-4 h-4 text-green-500" />;
    }
  };

  // Render notification
  const renderNotification = () => {
    if (!notification) return null;

    const styles = {
      success: { bg: "bg-green-50 border-green-400", text: "text-green-700", icon: <Check className="h-5 w-5 text-green-400" /> },
      error: { bg: "bg-red-50 border-red-400", text: "text-red-700", icon: <AlertCircle className="h-5 w-5 text-red-400" /> },
      info: { bg: "bg-blue-50 border-blue-400", text: "text-blue-700", icon: <Info className="h-5 w-5 text-blue-400" /> }
    }[notification.type];

    return (
      <div className={`fixed top-4 right-4 z-50 flex items-center p-4 max-w-xs rounded-xl shadow-lg ${styles.bg} border-l-4 animate-in slide-in-from-right-5 duration-300`}>
        <div className="flex-shrink-0">{styles.icon}</div>
        <div className="ml-3 mr-2 flex-grow">
          <p className={`text-sm font-medium ${styles.text}`}>{notification.message}</p>
        </div>
        <button
          onClick={() => setNotification(null)}
          className="flex-shrink-0 ml-auto text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    );
  };

  // Prepare chart data
  const prepareChartData = () => {
    const groupedData: Record<string, any> = filteredHistory.reduce((acc, item) => {
      const key = item.date;
      if (!acc[key]) {
        acc[key] = { date: key, total: 0 };
      }
      acc[key].total += item.quantity;
      acc[key][item.itemName] = (acc[key][item.itemName] || 0) + item.quantity;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(groupedData).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Prepare pie chart data
  const preparePieData = () => {
    const materialTotals: Record<string, number> = filteredHistory.reduce((acc, item) => {
      acc[item.itemName] = (acc[item.itemName] || 0) + item.quantity;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(materialTotals).map(([name, value]) => ({ name, value }));
  };

  // Calculate statistics
  const getStatistics = () => {
    const totalConsumption = filteredHistory.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueMaterials = new Set(filteredHistory.map(item => item.itemName)).size;
    const averageDaily = filteredHistory.length > 0 
      ? totalConsumption / new Set(filteredHistory.map(item => item.date)).size 
      : 0;
    
    return {
      totalConsumption: totalConsumption.toFixed(1),
      uniqueMaterials,
      averageDaily: averageDaily.toFixed(1),
      totalRecords: filteredHistory.length
    };
  };

  const stats = getStatistics();
  const chartData = prepareChartData();
  const pieData = preparePieData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {renderNotification()}

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Gestion de Consommation
          </h1>
          <p className="text-gray-600 text-lg">Suivez et analysez la consommation de vos matériaux</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex flex-wrap border-b border-gray-200 bg-white rounded-t-xl shadow-sm">
            <button
              onClick={() => setActiveTab('consumption')}
              className={`px-6 py-4 font-medium text-sm transition-all duration-200 ${
                activeTab === 'consumption'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Enregistrer Consommation
              </div>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-4 font-medium text-sm transition-all duration-200 ${
                activeTab === 'history'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Historique & Analytiques
              </div>
            </button>
          </div>
        </div>

        {activeTab === 'consumption' ? (
          /* Consumption Tab */
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Matériaux</p>
                    <p className="text-2xl font-bold text-gray-900">{materials.length}</p>
                  </div>
                  <Package className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Alertes Stock</p>
                    <p className="text-2xl font-bold text-orange-600">{lowStockAlerts.length}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-orange-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Stock Total</p>
                    <p className="text-2xl font-bold text-green-600">
                      {materials.reduce((sum, m) => sum + m.current_stock, 0).toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">À Consommer</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {Object.values(consumption).reduce((sum, val) => sum + val, 0)}
                    </p>
                  </div>
                  <Minus className="w-8 h-8 text-purple-500" />
                </div>
              </div>
            </div>

            {/* Date Selection */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <label htmlFor="date" className="font-medium text-gray-800">Date de consommation:</label>
                </div>
                <input
                  type="date"
                  id="date"
                  className="border border-gray-300 rounded-lg px-4 py-2 w-full sm:w-auto focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all duration-200"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>

            {/* Low Stock Alerts */}
            {lowStockAlerts.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-orange-200">
                <div
                  className="bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-400 p-4 cursor-pointer flex justify-between items-center hover:from-orange-100 hover:to-yellow-100 transition-all"
                  onClick={() => setExpanded(!expanded)}
                >
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <span className="ml-3 font-medium text-orange-800">
                      {lowStockAlerts.length} matériau{lowStockAlerts.length > 1 ? 'x' : ''} en alerte critique
                    </span>
                  </div>
                  {expanded ? 
                    <ChevronUp className="h-5 w-5 text-orange-600" /> : 
                    <ChevronDown className="h-5 w-5 text-orange-600" />
                  }
                </div>
                {expanded && (
                  <div className="p-4 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {lowStockAlerts.map((name, index) => (
                        <div key={index} className="flex items-center p-3 bg-orange-50 rounded-lg">
                          <div className="h-2 w-2 bg-orange-500 rounded-full mr-3"></div>
                          <span className="text-sm text-gray-700">
                            Stock critique: <span className="font-semibold text-orange-700">{name}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Materials Table/Cards */}
            {loading ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <div className="inline-block animate-spin mb-4">
                  <RefreshCw className="h-10 w-10 text-blue-500" />
                </div>
                <p className="text-gray-600 text-lg">Chargement des données...</p>
              </div>
            ) : selectedDate ? (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Matériau
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Stock Actuel
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Consommation
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Stock Restant
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Statut
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {materials.map((material, index) => {
                          const status = getStockStatus(material);
                          const remaining = calculateRemainingStock(material);

                          return (
                            <tr
                              key={material.id}
                              className={`transition-all duration-300 hover:bg-gray-50 ${
                                status === "danger" ? "bg-red-50" :
                                status === "warning" ? "bg-yellow-50" : ""
                              } ${animateItems ? 'opacity-100' : 'opacity-0'}`}
                              style={{ transitionDelay: `${index * 50}ms` }}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
                                      <Package className="h-5 w-5 text-white" />
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-semibold text-gray-900">{material.name}</div>
                                    <div className="text-sm text-gray-500">{material.itemType}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {material.current_stock.toLocaleString()}
                                  <span className="text-gray-500 text-xs ml-1">{material.unit}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max={material.current_stock}
                                    value={consumption[material.id] || 0}
                                    onChange={(e) => handleConsumptionChange(material.id, e.target.value)}
                                    className="border border-gray-300 rounded-lg px-3 py-2 w-24 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
                                  />
                                  <span className="text-xs text-gray-500">{material.unit}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className={`text-sm font-semibold ${
                                  status === "danger" ? "text-red-700" :
                                  status === "warning" ? "text-orange-700" :
                                  "text-green-700"
                                }`}>
                                  {remaining.toLocaleString()}
                                  <span className="text-gray-500 text-xs font-normal ml-1">{material.unit}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {renderStockIcon(status)}
                                  <span className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    status === "danger" ? "bg-red-100 text-red-800" :
                                    status === "warning" ? "bg-yellow-100 text-yellow-800" :
                                    "bg-green-100 text-green-800"
                                  }`}>
                                    {status === "danger" ? "Critique" :
                                     status === "warning" ? "Alerte" : "Normal"}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-4">
                  {materials.map((material, index) => {
                    const status = getStockStatus(material);
                    const remaining = calculateRemainingStock(material);

                    return (
                      <div
                        key={material.id}
                        className={`bg-white rounded-xl shadow-sm p-5 border transition-all duration-300 hover:shadow-md ${
                          status === "danger" ? "border-red-200 bg-red-50" :
                          status === "warning" ? "border-yellow-200 bg-yellow-50" : "border-gray-200"
                        } ${animateItems ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                        style={{ transitionDelay: `${index * 50}ms` }}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center mr-3">
                              <Package className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{material.name}</h3>
                              <p className="text-sm text-gray-500">{material.itemType}</p>
                            </div>
                          </div>
                          <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            status === "danger" ? "bg-red-100 text-red-700" :
                            status === "warning" ? "bg-yellow-100 text-yellow-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {renderStockIcon(status)}
                            <span className="ml-1">
                              {status === "danger" ? "Critique" :
                               status === "warning" ? "Alerte" : "Normal"}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs font-medium text-gray-500 mb-1">Stock Actuel</p>
                            <p className="text-lg font-bold text-gray-900">
                              {material.current_stock.toLocaleString()}
                              <span className="text-xs text-gray-500 font-normal ml-1">{material.unit}</span>
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs font-medium text-gray-500 mb-1">Stock Restant</p>
                            <p className={`text-lg font-bold ${
                              status === "danger" ? "text-red-700" :
                              status === "warning" ? "text-orange-700" : "text-green-700"
                            }`}>
                              {remaining.toLocaleString()}
                              <span className="text-xs text-gray-500 font-normal ml-1">{material.unit}</span>
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-2">Consommation</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="0"
                              max={material.current_stock}
                              value={consumption[material.id] || 0}
                              onChange={(e) => handleConsumptionChange(material.id, e.target.value)}
                              className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
                            />
                            <span className="text-sm text-gray-500 whitespace-nowrap">{material.unit}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <button
                    onClick={handleReset}
                    disabled={submitting}
                    className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-all duration-200 font-medium"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Réinitialiser
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`flex items-center justify-center px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 font-medium`}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Enregistrer la Consommation
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-12 h-12 text-blue-500" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">Sélectionnez une date</h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Choisissez une date pour commencer l'enregistrement de la consommation des matériaux
                </p>
                <div className="inline-block animate-bounce">
                  <ChevronUp className="h-8 w-8 text-blue-400" />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* History & Analytics Tab */
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-xl text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Consommation Totale</p>
                    <p className="text-2xl font-bold">{stats.totalConsumption}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-200" />
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-xl text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Matériaux Uniques</p>
                    <p className="text-2xl font-bold">{stats.uniqueMaterials}</p>
                  </div>
                  <Package className="w-8 h-8 text-green-200" />
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-xl text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Moyenne Journalière</p>
                    <p className="text-2xl font-bold">{stats.averageDaily}</p>
                  </div>
                  <Activity className="w-8 h-8 text-purple-200" />
                </div>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-xl text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Total Enregistrements</p>
                    <p className="text-2xl font-bold">{stats.totalRecords}</p>
                  </div>
                  <Clock className="w-8 h-8 text-orange-200" />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-700">Filtres:</span>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <select
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">Toutes les périodes</option>
                    <option value="today">Aujourd'hui</option>
                    <option value="week">Cette semaine</option>
                    <option value="month">Ce mois</option>
                  </select>

                  <select
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">Tous les matériaux</option>
                    {materials.map(material => (
                      <option key={material.id} value={material.name}>{material.name}</option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    placeholder="Date début"
                  />

                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    placeholder="Date fin"
                  />
                </div>

                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {viewMode === 'chart' ? <Eye className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
                    {viewMode === 'chart' ? 'Vue Tableau' : 'Vue Graphique'}
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">
                    <Download className="w-4 h-4" />
                    Exporter
                  </button>
                </div>
              </div>
            </div>

            {/* Charts/Table View */}
            {viewMode === 'chart' ? (
              <div className="space-y-6">
                {/* Chart Type Selector */}
                <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setChartType('line')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        chartType === 'line' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Courbe
                    </button>
                    <button
                      onClick={() => setChartType('area')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        chartType === 'area' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Zone
                    </button>
                    <button
                      onClick={() => setChartType('bar')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        chartType === 'bar' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Barres
                    </button>
                    <button
                      onClick={() => setChartType('pie')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        chartType === 'pie' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Camembert
                    </button>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Évolution de la Consommation
                    </h3>
                    <div className="h-80">
                      {chartType === 'line' && (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis 
                              dataKey="date" 
                              stroke="#6b7280"
                              fontSize={12}
                            />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="total" 
                              stroke="#3b82f6" 
                              strokeWidth={3}
                              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                      {chartType === 'area' && (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="total" 
                              stroke="#3b82f6" 
                              fill="url(#colorTotal)"
                              fillOpacity={0.6}
                            />
                            <defs>
                              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                              </linearGradient>
                            </defs>
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                      {chartType === 'bar' && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                            <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Répartition par Matériau
                    </h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Table View */
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Matériau
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Quantité
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Département
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {filteredHistory.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(item.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center mr-3">
                                <Package className="h-4 w-4 text-white" />
                              </div>
                              <span className="text-sm font-medium text-gray-900">{item.itemName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                              {item.itemType}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {item.quantity.toLocaleString()}
                            <span className="text-gray-500 text-xs font-normal ml-1">{item.unit}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                              {item.department}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredHistory.length === 0 && (
                  <div className="text-center py-12">
                    <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 text-lg">Aucun historique trouvé pour les filtres sélectionnés</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}