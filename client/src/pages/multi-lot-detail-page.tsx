import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Truck, 
  Package, 
  Box, 
  Ship, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MapPin,
  Thermometer,
  Scale,
  Calendar,
  User,
  Building,
  FileText,
  Share2,
  Wifi,
  WifiOff,
  Globe,
  Users,
  Edit,
  Archive
} from "lucide-react";
import { Link } from "wouter";
import { AvocadoTracking } from "@shared/schema";
import { MultiLot } from "@/lib/multiLotService";
import { useMultiLots } from "@/hooks/useMultiLots";
import { getAvocadoTrackingData } from "@/lib/queryClient";

export default function LotDetailPage() {
  const { lotId: rawLotId } = useParams<{ lotId: string }>();
  const [lotData, setLotData] = useState<AvocadoTracking | MultiLot | null>(null);
  const [lotType, setLotType] = useState<'multi' | 'legacy' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const { getLot: getMultiLot, archiveLot } = useMultiLots();

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchLotData = async () => {
      if (!rawLotId) {
        setErrorMessage('ID de lot manquant');
        setIsLoading(false);
        return;
      }

      const decodedLotId = decodeURIComponent(rawLotId);
      setIsLoading(true);
      setErrorMessage(null);

      try {
        // First, try to find in multi-lots by ID
        const multiLot = getMultiLot(decodedLotId);
        if (multiLot) {
          setLotData(multiLot);
          setLotType('multi');
          setIsLoading(false);
          return;
        }

        // If not found by ID, search in legacy lots by lot number
        const allLots = await getAvocadoTrackingData()();
        const foundLot = allLots.find(lot => 
          lot.harvest?.lotNumber === decodedLotId ||
          lot.harvest?.lotNumber?.toLowerCase() === decodedLotId.toLowerCase() ||
          lot.id === decodedLotId
        );

        if (foundLot) {
          setLotData(foundLot);
          setLotType('legacy');
        } else {
          setErrorMessage(`Lot ${decodedLotId} non trouvé`);
        }
      } catch (error) {
        console.error('Error fetching lot data:', error);
        setErrorMessage('Erreur lors de la récupération des données du lot');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLotData();
  }, [rawLotId, getMultiLot]);

  const getProgressPercentage = (): number => {
    if (!lotData) return 0;

    if (lotType === 'multi') {
      const multiLot = lotData as MultiLot;
      return Math.min(((multiLot.completedSteps?.length || 0) / 7) * 100, 100);
    } else {
      const legacyLot = lotData as AvocadoTracking;
      const steps = [
        legacyLot.harvest.harvestDate,
        legacyLot.transport.arrivalDateTime,
        legacyLot.sorting.sortingDate,
        legacyLot.packaging.packagingDate,
        legacyLot.storage.entryDate,
        legacyLot.export.loadingDate,
        legacyLot.delivery.actualDeliveryDate
      ];
      const completedSteps = steps.filter(step => step && step.trim() !== '').length;
      return (completedSteps / steps.length) * 100;
    }
  };

  const getStatusBadge = () => {
    if (!lotData) return null;

    if (lotType === 'multi') {
      const multiLot = lotData as MultiLot;
      const statusConfig = {
        'draft': { color: 'bg-gray-100 text-gray-800', icon: '📝', text: 'Brouillon' },
        'in-progress': { color: 'bg-blue-100 text-blue-800', icon: '🔄', text: 'En cours' },
        'completed': { color: 'bg-green-100 text-green-800', icon: '✅', text: 'Terminé' },
        'archived': { color: 'bg-purple-100 text-purple-800', icon: '📦', text: 'Archivé' }
      };
      
      const config = statusConfig[multiLot.status] || statusConfig.draft;
      return (
        <Badge className={`${config.color} px-3 py-1 text-xs sm:text-sm font-medium`}>
          <span className="mr-1">{config.icon}</span>
          {config.text}
        </Badge>
      );
    } else {
      const legacyLot = lotData as AvocadoTracking;
      if (legacyLot.delivery.actualDeliveryDate) {
        return <Badge className="bg-green-100 text-green-800 px-3 py-1 text-xs sm:text-sm">✅ Livré</Badge>;
      }
      if (legacyLot.export.loadingDate) {
        return <Badge className="bg-blue-100 text-blue-800 px-3 py-1 text-xs sm:text-sm">🚢 En Export</Badge>;
      }
      if (legacyLot.storage.entryDate) {
        return <Badge className="bg-purple-100 text-purple-800 px-3 py-1 text-xs sm:text-sm">🏪 En Stockage</Badge>;
      }
      if (legacyLot.packaging.packagingDate) {
        return <Badge className="bg-yellow-100 text-yellow-800 px-3 py-1 text-xs sm:text-sm">📦 Emballé</Badge>;
      }
      if (legacyLot.sorting.sortingDate) {
        return <Badge className="bg-orange-100 text-orange-800 px-3 py-1 text-xs sm:text-sm">🏭 Trié</Badge>;
      }
      if (legacyLot.transport.arrivalDateTime) {
        return <Badge className="bg-indigo-100 text-indigo-800 px-3 py-1 text-xs sm:text-sm">🚛 Transporté</Badge>;
      }
      return <Badge className="bg-gray-100 text-gray-800 px-3 py-1 text-xs sm:text-sm">🌱 Récolté</Badge>;
    }
  };

  const formatDate = (dateString: string | Date | undefined | null): string => {
    if (!dateString) return "En attente";
    
    if (dateString instanceof Date) {
      try {
        return dateString.toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return "Date invalide";
      }
    }
    
    if (typeof dateString === 'string') {
      if (dateString.trim() === '') return "En attente";
      try {
        return new Date(dateString).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return "Date invalide";
      }
    }
    
    try {
      const dateStr = String(dateString);
      if (dateStr === 'null' || dateStr === 'undefined' || dateStr.trim() === '') return "En attente";
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "Date invalide";
    }
  };

  const formatDateShort = (dateString: string | Date | undefined | null): string => {
    if (!dateString) return "En attente";
    
    if (dateString instanceof Date) {
      try {
        return dateString.toLocaleDateString('fr-FR');
      } catch {
        return "Date invalide";
      }
    }
    
    if (typeof dateString === 'string') {
      if (dateString.trim() === '') return "En attente";
      try {
        return new Date(dateString).toLocaleDateString('fr-FR');
      } catch {
        return "Date invalide";
      }
    }
    
    try {
      const dateStr = String(dateString);
      if (dateStr === 'null' || dateStr === 'undefined' || dateStr.trim() === '') return "En attente";
      return new Date(dateStr).toLocaleDateString('fr-FR');
    } catch {
      return "Date invalide";
    }
  };

  const getTimelineSteps = () => {
    if (!lotData) return [];

    if (lotType === 'multi') {
      const multiLot = lotData as MultiLot;
      return [
        {
          title: "Récolte",
          date: multiLot.harvest?.harvestDate,
          icon: <Clock className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(1) || false,
          details: `Ferme: ${multiLot.harvest?.farmLocation || 'N/A'} | Variété: ${multiLot.harvest?.variety || 'N/A'}`
        },
        {
          title: "Transport",
          date: multiLot.transport?.arrivalDateTime,
          icon: <Truck className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(2) || false,
          details: `Véhicule: ${multiLot.transport?.vehicleId || 'N/A'} | Chauffeur: ${multiLot.transport?.driverName || 'N/A'}`
        },
        {
          title: "Tri",
          date: multiLot.sorting?.sortingDate,
          icon: <Package className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(3) || false,
          details: `Grade: ${multiLot.sorting?.qualityGrade || 'N/A'} | Rejetés: ${multiLot.sorting?.rejectedCount || 0} kg`
        },
        {
          title: "Emballage",
          date: multiLot.packaging?.packagingDate,
          icon: <Box className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(4) || false,
          details: `Poids net: ${multiLot.packaging?.netWeight || 0} kg | Type: ${multiLot.packaging?.boxType || 'N/A'}`
        },
        {
          title: "Stockage",
          date: multiLot.storage?.entryDate,
          icon: <Building className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(5) || false,
          details: `Zone: ${multiLot.storage?.storageRoomId || 'N/A'} | Temp: ${multiLot.storage?.storageTemperature || 'N/A'}°C`
        },
        {
          title: "Export",
          date: multiLot.export?.loadingDate,
          icon: <Ship className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(6) || false,
          details: `Destination: ${multiLot.export?.destination || 'N/A'} | Container: ${multiLot.export?.containerId || 'N/A'}`
        },
        {
          title: "Livraison",
          date: multiLot.delivery?.actualDeliveryDate,
          icon: <CheckCircle2 className="h-5 w-5" />,
          completed: multiLot.completedSteps?.includes(7) || false,
          details: `Client: ${multiLot.delivery?.clientName || 'N/A'}`
        }
      ];
    } else {
      const legacyLot = lotData as AvocadoTracking;
      return [
        {
          title: "Récolte",
          date: legacyLot.harvest.harvestDate,
          icon: <Clock className="h-5 w-5" />,
          completed: !!(legacyLot.harvest.harvestDate && legacyLot.harvest.harvestDate.trim() !== ''),
          details: `Ferme: ${legacyLot.harvest.farmLocation} | Variété: ${legacyLot.harvest.variety}`
        },
        {
          title: "Transport",
          date: legacyLot.transport.arrivalDateTime,
          icon: <Truck className="h-5 w-5" />,
          completed: !!(legacyLot.transport.arrivalDateTime && legacyLot.transport.arrivalDateTime.trim() !== ''),
          details: `Véhicule: ${legacyLot.transport.vehicleId || 'N/A'} | Chauffeur: ${legacyLot.transport.driverName || 'N/A'}`
        },
        {
          title: "Tri",
          date: legacyLot.sorting.sortingDate,
          icon: <Package className="h-5 w-5" />,
          completed: !!(legacyLot.sorting.sortingDate && legacyLot.sorting.sortingDate.trim() !== ''),
          details: `Grade: ${legacyLot.sorting.qualityGrade || 'N/A'} | Rejetés: ${legacyLot.sorting.rejectedCount || 0} kg`
        },
        {
          title: "Emballage",
          date: legacyLot.packaging.packagingDate,
          icon: <Box className="h-5 w-5" />,
          completed: !!(legacyLot.packaging.packagingDate && legacyLot.packaging.packagingDate.trim() !== ''),
          details: `Poids net: ${legacyLot.packaging.netWeight || 0} kg | Type: ${legacyLot.packaging.boxType || 'N/A'}`
        },
        {
          title: "Stockage",
          date: legacyLot.storage.entryDate,
          icon: <Building className="h-5 w-5" />,
          completed: !!(legacyLot.storage.entryDate && legacyLot.storage.entryDate.trim() !== ''),
          details: `Zone: ${legacyLot.storage.storageRoomId || 'N/A'} | Temp: ${legacyLot.storage.storageTemperature || 'N/A'}°C`
        },
        {
          title: "Export",
          date: legacyLot.export.loadingDate,
          icon: <Ship className="h-5 w-5" />,
          completed: !!(legacyLot.export.loadingDate && legacyLot.export.loadingDate.trim() !== ''),
          details: `Destination: ${legacyLot.export.destination || 'N/A'} | Container: ${legacyLot.export.containerId || 'N/A'}`
        },
        {
          title: "Livraison",
          date: legacyLot.delivery.actualDeliveryDate,
          icon: <CheckCircle2 className="h-5 w-5" />,
          completed: !!(legacyLot.delivery.actualDeliveryDate && legacyLot.delivery.actualDeliveryDate.trim() !== ''),
          details: `Client: ${legacyLot.delivery.clientName || 'N/A'}`
        }
      ];
    }
  };

  const handleShare = async () => {
    try {
      const lotNumber = lotType === 'multi' 
        ? (lotData as MultiLot).lotNumber || (lotData as MultiLot).harvest?.lotNumber || `Multi-Lot-${(lotData as MultiLot).id?.slice(-6)}`
        : (lotData as AvocadoTracking).harvest.lotNumber;
        
      const shareData = {
        title: `Lot d'Avocat ${lotNumber}`,
        text: `Informations de traçabilité pour le lot ${lotNumber}`,
        url: window.location.href
      };

      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Lien copié dans le presse-papiers');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleArchive = async () => {
    if (lotType === 'multi' && lotData) {
      const multiLot = lotData as MultiLot;
      if (multiLot.status === 'completed') {
        try {
          await archiveLot(multiLot.id);
          alert('Lot archivé avec succès');
        } catch (error) {
          console.error('Error archiving lot:', error);
          alert('Erreur lors de l\'archivage du lot');
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 px-4">
        <div className="text-center max-w-sm">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-green-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-lg sm:text-xl font-semibold mb-3 text-gray-900">Chargement des détails...</p>
          <p className="text-sm text-gray-600 mb-4">Veuillez patienter</p>
          <div className="flex items-center justify-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-xs sm:text-sm font-medium text-green-600">Connecté</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-xs sm:text-sm font-medium text-red-600">Hors ligne</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-4 sm:p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <Alert variant="destructive" className="mb-4 border-2">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">Erreur</AlertTitle>
            <AlertDescription className="text-sm sm:text-base">{errorMessage}</AlertDescription>
          </Alert>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => window.location.reload()} className="flex-1">
              Réessayer
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/lots">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux lots
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!lotData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-4 sm:p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <Alert className="border-2">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">Lot non trouvé</AlertTitle>
            <AlertDescription className="text-sm sm:text-base">Le lot demandé n'existe pas.</AlertDescription>
          </Alert>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link href="/lots">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux lots
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const timelineSteps = getTimelineSteps();
  const lotNumber = lotType === 'multi' 
    ? (lotData as MultiLot).lotNumber || (lotData as MultiLot).harvest?.lotNumber || `Multi-Lot-${(lotData as MultiLot).id?.slice(-6)}`
    : (lotData as AvocadoTracking).harvest.lotNumber;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header - Mobile Optimized */}
        <div className="space-y-4">
          {/* Back Button & Actions Row */}
          <div className="flex items-center justify-between gap-2">
            <Button asChild variant="ghost" size="sm" className="hover:bg-white/80">
              <Link href="/lots">
                <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Retour</span>
              </Link>
            </Button>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="sm" onClick={handleShare} className="hover:bg-white/80">
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Partager</span>
              </Button>
              {lotType === 'multi' && (
                <>
                  <Button variant="ghost" size="sm" asChild className="hover:bg-white/80">
                    <Link href={`/new-entry?lotId=${(lotData as MultiLot).id}`}>
                      <Edit className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Modifier</span>
                    </Link>
                  </Button>
                  {(lotData as MultiLot).status === 'completed' && (
                    <Button variant="ghost" size="sm" onClick={handleArchive} className="hover:bg-white/80">
                      <Archive className="h-4 w-4" />
                      <span className="hidden md:inline ml-2">Archiver</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Title Card */}
          <Card className="border-none shadow-lg bg-gradient-to-r from-green-600 to-green-500 text-white overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold truncate">
                      Lot {lotNumber}
                    </h1>
                    {lotType === 'multi' && (lotData as MultiLot).globallyAccessible && (
                      <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-1 backdrop-blur-sm flex-shrink-0">
                        <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="text-xs sm:text-sm font-medium">Global</span>
                      </div>
                    )}
                  </div>
                  <p className="text-green-100 text-sm sm:text-base">
                    {lotType === 'multi' ? '🔄 Multi-lot' : '📦 Lot ancien'} • Suivi complet
                  </p>
                </div>
                <div className="flex-shrink-0 self-start">
                  {getStatusBadge()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Overview - Enhanced */}
        <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              Progression Générale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-base font-medium text-gray-700">Progression totale</span>
              <div className="flex items-center gap-2">
                <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
                  {Math.round(getProgressPercentage())}%
                </span>
              </div>
            </div>
            <div className="relative">
              <Progress value={getProgressPercentage()} className="h-4 bg-gray-100" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600 drop-shadow-sm">
                  {timelineSteps.filter(step => step.completed).length}/{timelineSteps.length}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-gray-500">
                {timelineSteps.filter(step => step.completed).length} étapes complétées
              </span>
              <span className="text-gray-400">
                {timelineSteps.length - timelineSteps.filter(step => step.completed).length} restantes
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Info Grid - Mobile First */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="border-none shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Ferme</p>
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 truncate" title={lotType === 'multi' ? (lotData as MultiLot).harvest?.farmLocation || 'N/A' : (lotData as AvocadoTracking).harvest.farmLocation}>
                  {lotType === 'multi' 
                    ? (lotData as MultiLot).harvest?.farmLocation || 'N/A'
                    : (lotData as AvocadoTracking).harvest.farmLocation
                  }
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Variété</p>
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 truncate" title={lotType === 'multi' ? (lotData as MultiLot).harvest?.variety || 'N/A' : (lotData as AvocadoTracking).harvest.variety}>
                  {lotType === 'multi' 
                    ? (lotData as MultiLot).harvest?.variety || 'N/A'
                    : (lotData as AvocadoTracking).harvest.variety
                  }
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                  <Scale className="h-5 w-5 text-orange-600" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Poids Net</p>
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900">
                  {lotType === 'multi' 
                    ? `${(lotData as MultiLot).packaging?.netWeight || 0} kg`
                    : `${(lotData as AvocadoTracking).packaging.netWeight || 0} kg`
                  }
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Package className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">Grade</p>
                <p className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 truncate" title={lotType === 'multi' ? (lotData as MultiLot).sorting?.qualityGrade || 'N/A' : (lotData as AvocadoTracking).sorting.qualityGrade || 'N/A'}>
                  {lotType === 'multi' 
                    ? (lotData as MultiLot).sorting?.qualityGrade || 'N/A'
                    : (lotData as AvocadoTracking).sorting.qualityGrade || 'N/A'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline - Redesigned for Mobile */}
        <Card className="border-none shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              Chronologie du Lot
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="space-y-4 sm:space-y-6">
              {timelineSteps.map((step, index) => (
                <div key={index} className="relative">
                  {/* Connection Line */}
                  {index < timelineSteps.length - 1 && (
                    <div className={`absolute left-5 top-12 bottom-0 w-0.5 -mb-4 ${
                      step.completed ? 'bg-green-300' : 'bg-gray-200'
                    }`} />
                  )}
                  
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${
                      step.completed 
                        ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg' 
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {step.icon}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 bg-white rounded-lg p-3 sm:p-4 border-2 transition-all duration-300" style={{
                      borderColor: step.completed ? '#10b981' : '#e5e7eb'
                    }}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <h3 className={`text-base sm:text-lg font-semibold ${
                          step.completed ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {step.title}
                        </h3>
                        <span className={`text-xs sm:text-sm px-2 py-1 rounded-full flex-shrink-0 w-fit ${
                          step.completed 
                            ? 'bg-green-100 text-green-700 font-medium' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {formatDateShort(step.date)}
                        </span>
                      </div>
                      
                      <p className="text-xs sm:text-sm text-gray-600 mb-1 break-words">
                        {step.details}
                      </p>
                      
                      {step.completed && (
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(step.date)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Additional Info for Multi-lots - Mobile Optimized */}
        {lotType === 'multi' && (
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                Informations de Collaboration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <p className="text-xs sm:text-sm font-medium text-blue-900">Créé par</p>
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-blue-900 truncate" title={(lotData as MultiLot).createdBy}>
                    {(lotData as MultiLot).createdBy}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <p className="text-xs sm:text-sm font-medium text-purple-900">Utilisateurs assignés</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-purple-900">
                      {(lotData as MultiLot).assignedUsers?.length || 0}
                    </span>
                    <span className="text-sm text-purple-700">utilisateur(s)</span>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <p className="text-xs sm:text-sm font-medium text-green-900">Créé le</p>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-green-900 break-words">
                    {formatDate((lotData as MultiLot).createdAt)}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <p className="text-xs sm:text-sm font-medium text-orange-900">Dernière mise à jour</p>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-orange-900 break-words">
                    {formatDate((lotData as MultiLot).updatedAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}