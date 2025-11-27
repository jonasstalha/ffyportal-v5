import { useState, useEffect } from "react";
import { Link } from "wouter";
import { 
  Plus, 
  QrCode, 
  Archive, 
  History, 
  Package, 
  Truck, 
  Users, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  Building,
  Warehouse,
  Leaf,
  Globe
} from "lucide-react";
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatsData, Farm, AvocadoTracking } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { api, getAvocadoTrackingData } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMultiLots } from "@/hooks/useMultiLots";

export default function DashboardPage() {
  const { t } = useLanguage();

  // Fetch avocado tracking data
  const { data: avocadoTrackingData = [], isLoading: isLoadingAvocadoTracking } = useQuery({
    queryKey: ['avocadoTracking'],
    queryFn: getAvocadoTrackingData()
  });
  
  // Fetch farms data
  const { data: farms = [], isLoading: isLoadingFarms } = useQuery({
    queryKey: ['farms'],
    queryFn: () => api.get<Farm[]>('/api/farms')
  });

  // Use multi-lots hook for new lot management
  const { activeLots, archivedLots, loading: multiLoading } = useMultiLots();
  
  // Calculate company metrics
  const totalLots = avocadoTrackingData.length + activeLots.length;
  const completedLots = avocadoTrackingData.filter(lot => 
    lot.delivery.actualDeliveryDate && lot.delivery.actualDeliveryDate.trim() !== ''
  ).length + activeLots.filter(lot => lot.status === 'completed').length;
  
  const inProgressLots = activeLots.filter(lot => 
    lot.status === 'in-progress' || lot.status === 'draft'
  ).length;
  
  const totalWeight = avocadoTrackingData.reduce((sum, lot) => 
    sum + (lot.packaging?.netWeight || 0), 0
  );
  
  const totalFarms = farms.length;
  const activeFarms = farms.filter(farm => farm.active !== false).length;
  
  // Quick stats calculations
  const completionRate = totalLots > 0 ? (completedLots / totalLots) * 100 : 0;
  const avgWeight = totalLots > 0 ? totalWeight / totalLots : 0;
  
  const isLoading = isLoadingAvocadoTracking || isLoadingFarms || multiLoading;

  // Communication messages & notifications from Firestore
  const [commMessages, setCommMessages] = useState<any[]>([]);
  const [commNotifications, setCommNotifications] = useState<any[]>([]);

  // Combine and sort recent alerts (messages + notifications)
  const combinedRecent: { id: string; type: 'notification' | 'message'; content: string; sender?: string; timestamp: Date; read: boolean }[] = [...commNotifications.map(n => ({
    id: `${n.id}`,
    type: 'notification' as const,
    content: n.content || n.message || '',
    timestamp: n.timestamp ? (n.timestamp.toDate ? n.timestamp.toDate() : new Date(n.timestamp)) : new Date(),
    read: !!n.read
  })), ...commMessages.map(m => ({
    id: `${m.id}`,
    type: 'message' as const,
    content: m.content || '',
    sender: m.senderName || m.senderEmail || m.sender || '',
    timestamp: m.timestamp ? (m.timestamp.toDate ? m.timestamp.toDate() : new Date(m.timestamp)) : new Date(),
    read: !!m.read
  }))].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  useEffect(() => {
    // Listen to messages collection
    const messagesRef = collection(db, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'desc'));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snap) => {
      const list: any[] = [];
      snap.docs.forEach(doc => {
        const data = doc.data();
        list.push({ id: doc.id, ...data });
      });
      setCommMessages(list);
    }, (err) => {
      console.error('Error listening messages:', err);
      setCommMessages([]);
    });

    // Listen to communication-notifications collection
    const notificationsRef = collection(db, 'communication-notifications');
    const notificationsQuery = query(notificationsRef, orderBy('createdAt', 'desc'));
    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snap) => {
      const list: any[] = [];
      snap.docs.forEach(doc => {
        const data = doc.data();
        list.push({ id: doc.id, ...data });
      });
      setCommNotifications(list);
    }, (err) => {
      console.error('Error listening notifications:', err);
      setCommNotifications([]);
    });

    return () => {
      unsubscribeMessages();
      unsubscribeNotifications();
    };
  }, []);

  // Quick action buttons data
  const quickActions = [
    {
      title: "Nouveau Lot",
      description: "Créer un nouveau lot",
      href: "/new-entry",
      icon: Plus,
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      title: "Scanner Code",
      description: "Scanner un code-barres",
      href: "/scan",
      icon: QrCode,
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      title: "Gérer Lots",
      description: "Voir tous les lots",
      href: "/lots",
      icon: Package,
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      title: "Fermes",
      description: "Gérer les fermes",
      href: "/farms",
      icon: Building,
      color: "bg-amber-500 hover:bg-amber-600",
    },
    {
      title: "Entrepôts",
      description: "Gérer les entrepôts",
      href: "/warehouses",
      icon: Warehouse,
      color: "bg-indigo-500 hover:bg-indigo-600",
    },
    {
      title: "Statistiques",
      description: "Voir les rapports",
      href: "/calculedeconsomation",
      icon: BarChart3,
      color: "bg-teal-500 hover:bg-teal-600",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-neutral-500">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Company Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">
          FruitsForYou Dashboard
        </h1>
        <p className="text-neutral-600">
          Système de traçabilité des avocats - Aperçu global de l'entreprise
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des Lots</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLots}</div>
            <p className="text-xs text-muted-foreground">
              {inProgressLots} en cours, {completedLots} terminés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
            <Progress value={completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fermes Actives</CardTitle>
            <Leaf className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeFarms}</div>
            <p className="text-xs text-muted-foreground">
              sur {totalFarms} fermes totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Poids Total</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWeight.toLocaleString()} kg</div>
            <p className="text-xs text-muted-foreground">
              Moyenne: {avgWeight.toFixed(1)} kg/lot
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Lots Récents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeLots.slice(0, 5).map((lot) => (
                <div key={lot.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <div>
                    <p className="font-medium">{lot.lotNumber || lot.harvest?.lotNumber || 'Nouveau lot'}</p>
                    <p className="text-sm text-neutral-500">{lot.harvest?.farmLocation}</p>
                  </div>
                  <Badge variant={lot.status === 'completed' ? 'default' : 'secondary'}>
                    {lot.status === 'completed' ? 'Terminé' : 'En cours'}
                  </Badge>
                </div>
              ))}
              {activeLots.length === 0 && (
                <p className="text-neutral-500 text-center py-4">Aucun lot récent</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Alertes & Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* keep some system alerts */}
              {inProgressLots > 10 && (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium">Beaucoup de lots en cours</p>
                    <p className="text-xs text-neutral-500">{inProgressLots} lots nécessitent une attention</p>
                  </div>
                </div>
              )}

              {/* Render recent communications (messages + notifications) */}
              <div>
                <h3 className="text-sm font-medium mb-2">Récents (Communication)</h3>
                <div className="space-y-2">
                  {combinedRecent.length === 0 && (
                    <p className="text-xs text-neutral-500">Aucune notification de communication récente</p>
                  )}
                  {combinedRecent.slice(0, 5).map(item => (
                    <div key={item.type + '-' + item.id} className={`flex items-start justify-between p-2 rounded-lg ${item.read ? 'bg-white' : 'bg-blue-50'} border`}> 
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{item.type === 'notification' ? 'Notification' : 'Message'}</span>
                          {!item.read && <span className="text-xs bg-red-500 text-white rounded-full px-2">New</span>}
                        </div>
                        <p className="text-xs text-neutral-700 truncate">{item.type === 'message' ? `${item.sender}: ${item.content}` : item.content}</p>
                        <p className="text-xs text-neutral-400 mt-1">{item.timestamp.toLocaleString()}</p>
                      </div>
                      <div className="ml-3 flex-shrink-0">
                        <button className="text-xs text-blue-600">Voir</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions Rapides</CardTitle>
          <p className="text-sm text-neutral-600">
            Accès rapide aux fonctionnalités principales
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((action) => (
              <Button
                key={action.title}
                asChild
                variant="outline"
                className="h-auto p-4 flex flex-col items-center space-y-2 hover:shadow-md transition-shadow"
              >
                <Link href={action.href}>
                  <div className={`p-3 rounded-full ${action.color} text-white`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">{action.title}</p>
                    <p className="text-xs text-neutral-500 mt-1">{action.description}</p>
                  </div>
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            État du Système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium">Base de données</span>
              <Badge className="bg-green-100 text-green-800">Opérationnel</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium">Firebase</span>
              <Badge className="bg-green-100 text-green-800">Connecté</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium">API</span>
              <Badge className="bg-green-100 text-green-800">Actif</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}