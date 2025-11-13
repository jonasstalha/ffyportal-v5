import { useParams, Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  Building,
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
  Clock
} from "lucide-react";
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { firestore as db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  RadialBarChart,
  RadialBar,
  ScatterChart,
  Scatter
} from "recharts";

// Chart colors
const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const GRADIENT_COLORS = {
  green: { start: '#10b981', end: '#065f46' },
  blue: { start: '#3b82f6', end: '#1e40af' },
  orange: { start: '#f59e0b', end: '#d97706' },
  purple: { start: '#8b5cf6', end: '#6d28d9' },
  pink: { start: '#ec4899', end: '#be185d' }
};

// Using shared Firebase instance from lib/firebase.ts

// Define Farm type
type Farm = {
  id: string;
  name: string;
  location: string;
  description: string;
  code: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

// Define Farm Statistics type
interface FarmStats {
  totalLots: number;
  totalProduction: number; // in kg
  activeHarvests: number;
  averageQuality: string;
  monthlyProduction: Array<{
    month: string;
    production: number;
    lots: number;
  }>;
  varietyDistribution: Array<{
    variety: string;
    count: number;
    percentage: number;
  }>;
  qualityGrades: Array<{
    grade: string;
    count: number;
    percentage: number;
  }>;
  performanceMetrics: {
    productionEfficiency: number;
    qualityRate: number;
    harvestFrequency: number;
  };
  seasonalTrends: Array<{
    season: string;
    avgProduction: number;
    avgQuality: number;
    lotCount: number;
  }>;
  productionTrend: Array<{
    month: string;
    production: number;
    efficiency: number;
    quality: number;
  }>;
  dailyHarvestPattern: Array<{
    hour: number;
    harvests: number;
  }>;
}

export default function FarmDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [farmStats, setFarmStats] = useState<FarmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Fetch farm statistics from lots collection
  const fetchFarmStats = async (farmId: string, farmName: string): Promise<FarmStats> => {
    try {
      // Query lots that belong to this farm
      const lotsQuery = query(
        collection(db, "lots"),
        where("harvest.farmLocation", "==", farmId)
      );
      
      // Also try with farm name as fallback
      const lotsQuery2 = query(
        collection(db, "lots"),
        where("selectedFarm", "==", farmId)
      );

      const [lotsSnapshot, lotsSnapshot2] = await Promise.all([
        getDocs(lotsQuery),
        getDocs(lotsQuery2)
      ]);

      // Combine results and remove duplicates
      const allLots = new Map();
      [...lotsSnapshot.docs, ...lotsSnapshot2.docs].forEach(doc => {
        allLots.set(doc.id, { id: doc.id, ...doc.data() });
      });

      const lots = Array.from(allLots.values());

      // Calculate statistics
      const totalLots = lots.length;
      const activeHarvests = lots.filter(lot => lot.status === 'in-progress' || lot.status === 'draft').length;
      
      // Calculate total production (sum of avocado counts)
      const totalProduction = lots.reduce((sum, lot) => {
        const avocadoCount = lot.packaging?.avocadoCount || lot.avocadoCount || 0;
        return sum + avocadoCount;
      }, 0);

      // Calculate average quality
      const qualityGrades = lots.filter(lot => lot.sorting?.qualityGrade).map(lot => lot.sorting.qualityGrade);
      const gradeValues = { 'A': 3, 'B': 2, 'C': 1 };
      const avgQualityNum = qualityGrades.length > 0 
        ? qualityGrades.reduce((sum, grade) => sum + (gradeValues[grade] || 0), 0) / qualityGrades.length
        : 0;
      const averageQuality = avgQualityNum >= 2.5 ? 'A' : avgQualityNum >= 1.5 ? 'B' : 'C';

      // Monthly production analysis
      const monthlyData = {};
      lots.forEach(lot => {
        if (lot.harvest?.harvestDate) {
          const date = new Date(lot.harvest.harvestDate);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { production: 0, lots: 0 };
          }
          
          monthlyData[monthKey].production += lot.packaging?.avocadoCount || lot.avocadoCount || 0;
          monthlyData[monthKey].lots += 1;
        }
      });

      const monthlyProduction = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12) // Last 12 months
        .map(([month, data]: [string, any]) => ({
          month: new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
          production: data.production,
          lots: data.lots
        }));

      // Variety distribution
      const varietyCount = {};
      lots.forEach(lot => {
        const variety = lot.harvest?.variety || 'Unknown';
        varietyCount[variety] = (varietyCount[variety] || 0) + 1;
      });

      const varietyDistribution = Object.entries(varietyCount).map(([variety, count]: [string, number]) => ({
        variety: variety.charAt(0).toUpperCase() + variety.slice(1),
        count,
        percentage: Math.round((count / totalLots) * 100)
      }));

      // Quality grades distribution
      const qualityCount = {};
      lots.forEach(lot => {
        const grade = lot.sorting?.qualityGrade || 'Unknown';
        qualityCount[grade] = (qualityCount[grade] || 0) + 1;
      });

      const qualityGradesData = Object.entries(qualityCount).map(([grade, count]: [string, number]) => ({
        grade,
        count,
        percentage: Math.round((count / totalLots) * 100)
      }));

      // Performance metrics
      const completedLots = lots.filter(lot => lot.status === 'completed').length;
      const highQualityLots = lots.filter(lot => lot.sorting?.qualityGrade === 'A').length;
      
      const performanceMetrics = {
        productionEfficiency: totalLots > 0 ? Math.round((completedLots / totalLots) * 100) : 0,
        qualityRate: totalLots > 0 ? Math.round((highQualityLots / totalLots) * 100) : 0,
        harvestFrequency: monthlyProduction.length > 0 
          ? Math.round(monthlyProduction.reduce((sum, month) => sum + month.lots, 0) / monthlyProduction.length)
          : 0
      };

      // Seasonal trends analysis
      const seasonalData = {};
      lots.forEach(lot => {
        if (lot.harvest?.harvestDate) {
          const date = new Date(lot.harvest.harvestDate);
          const month = date.getMonth();
          const season = month >= 2 && month <= 4 ? 'Printemps' : 
                        month >= 5 && month <= 7 ? 'Été' :
                        month >= 8 && month <= 10 ? 'Automne' : 'Hiver';
          
          if (!seasonalData[season]) {
            seasonalData[season] = { production: 0, qualitySum: 0, lotCount: 0 };
          }
          
          seasonalData[season].production += lot.packaging?.avocadoCount || lot.avocadoCount || 0;
          seasonalData[season].qualitySum += gradeValues[lot.sorting?.qualityGrade] || 0;
          seasonalData[season].lotCount += 1;
        }
      });

      const seasonalTrends = Object.entries(seasonalData).map(([season, data]: [string, any]) => ({
        season,
        avgProduction: data.lotCount > 0 ? Math.round(data.production / data.lotCount) : 0,
        avgQuality: data.lotCount > 0 ? Math.round((data.qualitySum / data.lotCount) * 100) / 100 : 0,
        lotCount: data.lotCount
      }));

      // Production trend with efficiency and quality
      const productionTrend = monthlyProduction.map(month => {
        const monthLots = lots.filter(lot => {
          if (!lot.harvest?.harvestDate) return false;
          const date = new Date(lot.harvest.harvestDate);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          return monthKey.includes(month.month.split(' ')[1] + '-' + (month.month.split(' ')[0] === 'jan' ? '01' : 
                                                                      month.month.split(' ')[0] === 'fév' ? '02' :
                                                                      month.month.split(' ')[0] === 'mar' ? '03' :
                                                                      month.month.split(' ')[0] === 'avr' ? '04' :
                                                                      month.month.split(' ')[0] === 'mai' ? '05' :
                                                                      month.month.split(' ')[0] === 'jui' ? '06' :
                                                                      month.month.split(' ')[0] === 'jul' ? '07' :
                                                                      month.month.split(' ')[0] === 'aoû' ? '08' :
                                                                      month.month.split(' ')[0] === 'sep' ? '09' :
                                                                      month.month.split(' ')[0] === 'oct' ? '10' :
                                                                      month.month.split(' ')[0] === 'nov' ? '11' : '12'));
        });
        
        const completedInMonth = monthLots.filter(lot => lot.status === 'completed').length;
        const highQualityInMonth = monthLots.filter(lot => lot.sorting?.qualityGrade === 'A').length;
        
        return {
          month: month.month,
          production: month.production,
          efficiency: month.lots > 0 ? Math.round((completedInMonth / month.lots) * 100) : 0,
          quality: month.lots > 0 ? Math.round((highQualityInMonth / month.lots) * 100) : 0
        };
      });

      // Daily harvest pattern (simulate based on harvest dates)
      const hourlyData = {};
      lots.forEach(lot => {
        if (lot.harvest?.harvestDate) {
          const date = new Date(lot.harvest.harvestDate);
          const hour = date.getHours();
          hourlyData[hour] = (hourlyData[hour] || 0) + 1;
        }
      });

      const dailyHarvestPattern = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        harvests: hourlyData[hour] || 0
      }));

      return {
        totalLots,
        totalProduction,
        activeHarvests,
        averageQuality,
        monthlyProduction,
        varietyDistribution,
        qualityGrades: qualityGradesData,
        performanceMetrics,
        seasonalTrends,
        productionTrend,
        dailyHarvestPattern
      };
    } catch (error) {
      console.error('Error fetching farm statistics:', error);
      throw error;
    }
  };

  useEffect(() => {
    const fetchFarm = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const farmRef = doc(db, "farms", id);
        const farmSnap = await getDoc(farmRef);

        if (farmSnap.exists()) {
          const data = farmSnap.data();
          const farmData = {
            id: farmSnap.id,
            name: data.name,
            location: data.location,
            description: data.description || "",
            code: data.code || "",
            active: data.active,
            createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
          };
          setFarm(farmData);

          // Fetch statistics
          setStatsLoading(true);
          try {
            const stats = await fetchFarmStats(farmData.id, farmData.name);
            setFarmStats(stats);
          } catch (statsError) {
            console.error('Failed to load farm statistics:', statsError);
            // Continue without statistics
          } finally {
            setStatsLoading(false);
          }
        } else {
          setError("Ferme non trouvée");
        }
      } catch (err) {
        console.error("Error fetching farm:", err);
        setError("Erreur lors de la récupération des données de la ferme");
      } finally {
        setLoading(false);
      }
    };

    fetchFarm();
  }, [id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleDelete = async () => {
    if (!farm) return;

    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la ferme ${farm.name}?`)) {
      try {
        await deleteDoc(doc(db, "farms", farm.id));
        toast({
          title: "Ferme supprimée",
          description: `La ferme ${farm.name} a été supprimée avec succès.`,
        });
        setLocation("/farms");
      } catch (err) {
        console.error("Error deleting farm:", err);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Une erreur est survenue lors de la suppression de la ferme.",
        });
      }
    }
  };

  const handleEdit = () => {
    // Redirect to farms page with edit dialog open
    // This would require state management across pages
    // For now, just redirect to farms page
    setLocation("/farms");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erreur</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/farms">Retour aux fermes</Link>
        </Button>
      </Alert>
    );
  }

  if (!farm) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Ferme non trouvée</AlertTitle>
        <AlertDescription>La ferme demandée n'existe pas ou a été supprimée.</AlertDescription>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/farms">Retour aux fermes</Link>
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/farms">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">{farm.name}</h2>
          <Badge variant={farm.active ? "success" : "destructive"}>
            {farm.active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={handleEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="icon" onClick={handleDelete}>
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Statut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Building className="h-5 w-5 mr-2" />
              Statut
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">État:</span>
                <Badge variant={farm.active ? "success" : "destructive"}>
                  {farm.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Code:</span>
                <span className="font-mono">{farm.code}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <ClipboardList className="h-5 w-5 mr-2" />
              Informations générales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">Localisation:</span>
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1 text-neutral-500" />
                  <span>{farm.location}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Description:</span>
                <span className="text-right">{farm.description || "Non spécifiée"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">Créé le:</span>
                <span>{formatDate(farm.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Dernière mise à jour:</span>
                <span>{formatDate(farm.updatedAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistiques de production */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Statistiques de production
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
                <span className="ml-2 text-neutral-500">Chargement des statistiques...</span>
              </div>
            ) : farmStats ? (
              <div className="space-y-6">
                {/* Enhanced Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="relative p-6 bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 rounded-xl overflow-hidden">
                    <div className="absolute top-0 right-0 p-2">
                      <Package className="h-6 w-6 text-green-300" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-green-700">{farmStats.totalLots.toLocaleString()}</div>
                      <div className="text-sm font-medium text-green-600">Lots totaux</div>
                      <div className="text-xs text-green-500">Depuis le début</div>
                    </div>
                  </div>
                  
                  <div className="relative p-6 bg-gradient-to-br from-blue-50 to-cyan-100 border border-blue-200 rounded-xl overflow-hidden">
                    <div className="absolute top-0 right-0 p-2">
                      <TrendingUp className="h-6 w-6 text-blue-300" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-blue-700">{farmStats.totalProduction.toLocaleString()}</div>
                      <div className="text-sm font-medium text-blue-600">Avocats produits</div>
                      <div className="text-xs text-blue-500">Production totale</div>
                    </div>
                  </div>
                  
                  <div className="relative p-6 bg-gradient-to-br from-orange-50 to-amber-100 border border-orange-200 rounded-xl overflow-hidden">
                    <div className="absolute top-0 right-0 p-2">
                      <Activity className="h-6 w-6 text-orange-300" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-orange-700">{farmStats.activeHarvests}</div>
                      <div className="text-sm font-medium text-orange-600">Récoltes actives</div>
                      <div className="text-xs text-orange-500">En cours</div>
                    </div>
                  </div>
                  
                  <div className="relative p-6 bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200 rounded-xl overflow-hidden">
                    <div className="absolute top-0 right-0 p-2">
                      <BarChart3 className="h-6 w-6 text-purple-300" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-purple-700">Grade {farmStats.averageQuality}</div>
                      <div className="text-sm font-medium text-purple-600">Qualité moyenne</div>
                      <div className="text-xs text-purple-500">Performance globale</div>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="space-y-8">
                  {/* Production Trend Analysis */}
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center text-lg">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Analyse des tendances de production
                    </h4>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={farmStats.productionTrend}>
                          <defs>
                            <linearGradient id="productionGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="month" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e5e7eb', 
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            formatter={(value, name) => [
                              name === 'production' ? `${value} avocats` : `${value}%`,
                              name === 'production' ? 'Production' : 
                              name === 'efficiency' ? 'Efficacité' : 'Qualité'
                            ]}
                          />
                          <Legend />
                          <Area 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="production" 
                            fill="url(#productionGradient)" 
                            stroke="#10b981"
                            strokeWidth={3}
                            name="Production"
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="efficiency" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                            name="Efficacité (%)"
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="quality" 
                            stroke="#f59e0b" 
                            strokeWidth={2}
                            dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                            name="Qualité (%)"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Seasonal Analysis and Variety Distribution */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Seasonal Trends */}
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center">
                        <Activity className="h-4 w-4 mr-2" />
                        Tendances saisonnières
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="80%" data={farmStats.seasonalTrends}>
                            <RadialBar
                              dataKey="avgProduction"
                              cornerRadius={10}
                              fill="#8884d8"
                            />
                            <Tooltip 
                              formatter={(value, name) => [`${value} avocats/lot`, 'Production moyenne']}
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                border: '1px solid #e5e7eb', 
                                borderRadius: '8px'
                              }}
                            />
                            <Legend />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Enhanced Variety Distribution */}
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Distribution des variétés
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <defs>
                              {farmStats.varietyDistribution.map((entry, index) => (
                                <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.8}/>
                                  <stop offset="100%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.6}/>
                                </linearGradient>
                              ))}
                            </defs>
                            <Pie
                              data={farmStats.varietyDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ variety, percentage }) => `${variety} ${percentage}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="count"
                            >
                              {farmStats.varietyDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`url(#gradient-${index})`} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value) => [`${value} lots`, 'Nombre']}
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                border: '1px solid #e5e7eb', 
                                borderRadius: '8px'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Daily Harvest Pattern */}
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Modèle de récolte quotidien
                    </h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={farmStats.dailyHarvestPattern}>
                          <defs>
                            <linearGradient id="harvestGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="hour" 
                            tickFormatter={(hour) => `${hour}h`}
                          />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(hour) => `${hour}h00`}
                            formatter={(value) => [`${value} récoltes`, 'Nombre']}
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e5e7eb', 
                              borderRadius: '8px'
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="harvests"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            fill="url(#harvestGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Enhanced Performance Metrics */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center text-lg">
                    <Activity className="h-5 w-5 mr-2" />
                    Métriques de performance avancées
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                        <span className="text-2xl font-bold text-green-600">{farmStats.performanceMetrics.productionEfficiency}%</span>
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-green-700">Efficacité de production</span>
                        <div className="w-full bg-green-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500 ease-in-out" 
                            style={{ width: `${farmStats.performanceMetrics.productionEfficiency}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-green-600">Pourcentage de lots complétés</p>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <BarChart3 className="h-6 w-6 text-blue-600" />
                        </div>
                        <span className="text-2xl font-bold text-blue-600">{farmStats.performanceMetrics.qualityRate}%</span>
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-blue-700">Taux de qualité A</span>
                        <div className="w-full bg-blue-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-500 ease-in-out" 
                            style={{ width: `${farmStats.performanceMetrics.qualityRate}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-blue-600">Pourcentage de lots grade A</p>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Activity className="h-6 w-6 text-purple-600" />
                        </div>
                        <span className="text-2xl font-bold text-purple-600">{farmStats.performanceMetrics.harvestFrequency}</span>
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-purple-700">Fréquence de récolte</span>
                        <div className="w-full bg-purple-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-purple-400 to-purple-600 h-3 rounded-full transition-all duration-500 ease-in-out" 
                            style={{ width: `${Math.min(farmStats.performanceMetrics.harvestFrequency * 10, 100)}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-purple-600">Lots par mois en moyenne</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Quality Grades Distribution */}
                {farmStats.qualityGrades.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center text-lg">
                      <BarChart3 className="h-5 w-5 mr-2" />
                      Distribution des grades de qualité
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {farmStats.qualityGrades.map((grade, index) => {
                        const gradeColors = {
                          'A': { bg: 'from-green-50 to-emerald-50', border: 'border-green-200', text: 'text-green-600', icon: 'bg-green-100' },
                          'B': { bg: 'from-yellow-50 to-orange-50', border: 'border-yellow-200', text: 'text-yellow-600', icon: 'bg-yellow-100' },
                          'C': { bg: 'from-red-50 to-pink-50', border: 'border-red-200', text: 'text-red-600', icon: 'bg-red-100' }
                        };
                        const colors = gradeColors[grade.grade] || gradeColors['C'];
                        
                        return (
                          <div key={grade.grade} className={`p-6 bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-xl`}>
                            <div className="flex items-center justify-between mb-4">
                              <div className={`p-3 ${colors.icon} rounded-full`}>
                                <span className={`text-lg font-bold ${colors.text}`}>
                                  {grade.grade === 'A' ? '🌟' : grade.grade === 'B' ? '⭐' : '✨'}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className={`text-2xl font-bold ${colors.text}`}>{grade.count}</div>
                                <div className={`text-sm ${colors.text} opacity-75`}>lots</div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className={`font-medium ${colors.text}`}>Grade {grade.grade}</span>
                                <span className={`text-sm font-bold ${colors.text}`}>{grade.percentage}%</span>
                              </div>
                              <div className={`w-full bg-white bg-opacity-50 rounded-full h-2`}>
                                <div 
                                  className={`h-2 rounded-full transition-all duration-500 ease-in-out ${
                                    grade.grade === 'A' ? 'bg-gradient-to-r from-green-400 to-green-600' :
                                    grade.grade === 'B' ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                                    'bg-gradient-to-r from-red-400 to-red-600'
                                  }`}
                                  style={{ width: `${grade.percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Seasonal Performance Summary */}
                {farmStats.seasonalTrends.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center text-lg">
                      <Calendar className="h-5 w-5 mr-2" />
                      Résumé saisonnier
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {farmStats.seasonalTrends.map((season, index) => {
                        const seasonColors = {
                          'Printemps': { bg: 'from-green-50 to-lime-50', border: 'border-green-200', text: 'text-green-600', icon: '🌱' },
                          'Été': { bg: 'from-yellow-50 to-orange-50', border: 'border-yellow-200', text: 'text-yellow-600', icon: '☀️' },
                          'Automne': { bg: 'from-orange-50 to-red-50', border: 'border-orange-200', text: 'text-orange-600', icon: '🍂' },
                          'Hiver': { bg: 'from-blue-50 to-cyan-50', border: 'border-blue-200', text: 'text-blue-600', icon: '❄️' }
                        };
                        const colors = seasonColors[season.season] || seasonColors['Printemps'];
                        
                        return (
                          <div key={season.season} className={`p-4 bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-lg`}>
                            <div className="text-center">
                              <div className="text-2xl mb-2">{colors.icon}</div>
                              <div className={`text-lg font-bold ${colors.text}`}>{season.season}</div>
                              <div className="space-y-1 mt-3">
                                <div className={`text-sm ${colors.text} opacity-75`}>Production moyenne</div>
                                <div className={`text-xl font-bold ${colors.text}`}>{season.avgProduction}</div>
                                <div className={`text-xs ${colors.text} opacity-75`}>{season.lotCount} lots</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-neutral-500 py-8">
                <Package className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                <p>Aucune donnée de production disponible.</p>
                <p className="text-sm">Les statistiques apparaîtront une fois que des lots seront créés pour cette ferme.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personnel assigné */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Personnel assigné
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-neutral-500 py-4">
              Aucun personnel assigné pour le moment.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}