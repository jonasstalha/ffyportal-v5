import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Clock, 
  Truck, 
  Search, 
  Filter, 
  Calendar,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  CheckSquare,
  Square,
  CheckCircle,
  User,
  MapPin,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp,
  getDocs 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  getClientOrders, 
  updateClientOrder, 
  deleteClientOrder,
  ClientOrder 
} from '../../lib/firebaseService';
import { getAvocadoTrackingData } from '../../lib/firebaseService';
import { multiLotService } from '../../lib/multiLotService';
import { sharedLotService, SharedLot } from '../../lib/sharedLotService';
import { saveQualityControlLot } from '../../lib/qualityControlService';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  clientName: string;
  lotNumber: string;
  lotName: string;
  caliber: string;
  quantity: number;
  unit: string;
  type: string;
  processingTime: number;
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  orderDate: string;
  requestedDeliveryDate: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  priority: 'high' | 'medium' | 'low';
  totalProcessingTime: number;
  actualDeliveryDate?: string;
  notes?: string;
  delayReason?: string;
  progress?: number;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

// Admin Action Button component
const AdminActionButton = ({ 
  icon: Icon, 
  label, 
  onClick, 
  variant = 'primary',
  disabled = false 
}: { 
  icon: React.ElementType; 
  label: string; 
  onClick: () => void; 
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) => {
  const baseClasses = "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 font-medium text-sm";
  const variantClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300",
    secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:bg-gray-100 disabled:text-gray-400",
    danger: "bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300"
  };

  return (
    <button 
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
};

export default function OrderTrackingView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [multiLots, setMultiLots] = useState<any[]>([]);
  const [sharedLots, setSharedLots] = useState<SharedLot[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    orderNumber: '',
    clientName: '',
    requestedDeliveryDate: '',
    priority: 'medium',
    status: 'pending',
    items: [],
    notes: ''
  });

  // Fetch data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch client orders from admin's system
        const clientOrders = await getClientOrders();
        
        // Transform client orders to our Order format
        const transformedOrders: Order[] = clientOrders.map((order: any) => ({
            id: order.id,
            items: order.products?.map((product: any, index: number) => ({
                id: `${order.id}-${index}`,
                clientName: order.clientName || 'Client Non Spécifié',
                lotName: product.lotName || 'Lot Non Spécifié',
                productType: product.productType || 'Avocat',
                quantity: product.quantity || 0,
                clientInstructions: product.clientInstructions || '',
                currentStep: product.currentStep || 'pending',
                completed: product.completed || false,
                orderDate: order.orderDate?.toDate?.() || new Date(),
                requestedDeliveryDate: order.requestedDeliveryDate?.toDate?.() || new Date(),
                actualDeliveryDate: order.actualDeliveryDate?.toDate?.(),
                clientEmail: order.clientEmail || 'N/A',
                priority: order.priority || 'medium',
                notes: order.notes || ''
            })) || [],
            orderNumber: order.orderNumber || `ORD-${order.id?.substring(0, 6)}`,
            clientName: order.clientName || 'Client Non Spécifié',
            clientEmail: order.clientEmail || 'N/A',
            status: order.status || 'pending',
            priority: order.priority || 'medium',
            notes: order.notes || '',
            totalProcessingTime: order.totalProcessingTime || 0,
            progress: order.progress || 0,
            totalAmount: order.totalAmount || 0,
            orderDate: order.orderDate?.toDate?.()?.toISOString() || new Date().toISOString(),
            requestedDeliveryDate: order.requestedDeliveryDate?.toDate?.()?.toISOString() || new Date().toISOString(),
            actualDeliveryDate: order.actualDeliveryDate?.toDate?.()?.toISOString(),
            createdAt: order.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: order.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        }));        setOrders(transformedOrders);

        // Extract unique client names
        const uniqueClients = Array.from(new Set(transformedOrders.map(o => o.clientName)));
        setClients(uniqueClients);

        // Fetch lot data from admin's system
        const avocadoLots = await getAvocadoTrackingData();
        setLots(avocadoLots);

        // Fetch multi-lots from admin's system  
        const activeLots = await multiLotService.getActiveLots();
        setMultiLots(activeLots);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Subscribe to shared_lots (production and quality)
  useEffect(() => {
    const unsubscribe = sharedLotService.subscribeToLots((lots) => {
      setSharedLots(lots);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for order updates
  useEffect(() => {
    const q = query(collection(db, 'client-orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updates = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          orderDate: typeof data.orderDate === 'string' ? data.orderDate : data.orderDate?.toDate?.().toISOString() || new Date().toISOString(),
          requestedDeliveryDate: typeof data.requestedDeliveryDate === 'string' ? data.requestedDeliveryDate : data.requestedDeliveryDate?.toDate?.().toISOString() || new Date().toISOString(),
          actualDeliveryDate: data.actualDeliveryDate ? (typeof data.actualDeliveryDate === 'string' ? data.actualDeliveryDate : data.actualDeliveryDate?.toDate?.().toISOString()) : undefined,
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
        };
      });
      
      // Only update if we have data to prevent overwriting the initial fetch
      if (updates.length > 0) {
        const transformedOrders: Order[] = updates.map((order: any) => ({
          id: order.id,
          orderNumber: order.orderNumber || `ORD-${order.id?.substring(0, 6)}`,
          clientName: order.clientName || 'Client Non Spécifié',
          clientEmail: order.clientEmail || 'N/A',
          status: order.status || 'pending',
          priority: order.priority || 'medium',
          notes: order.notes || '',
          items: order.products?.map((product: any, index: number) => ({
            id: `${order.id}-${index}`,
            clientName: order.clientName || 'Client Non Spécifié',
            lotNumber: `LOT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            lotName: `Lot ${product.name || 'Non Spécifié'}`,
            caliber: 'Mixed',
            quantity: product.quantity || 0,
            unit: product.unit || 'kg',
            type: product.name || 'Avocat',
            processingTime: Math.floor(Math.random() * 24) + 1,
            completed: product.completed || false,
            completedAt: product.completedAt,
            notes: ''
          })) || [],
          totalProcessingTime: order.totalProcessingTime || 0,
          progress: order.progress || 0,
          totalAmount: order.totalAmount || 0,
          orderDate: order.orderDate || new Date().toISOString(),
          requestedDeliveryDate: order.requestedDeliveryDate || new Date().toISOString(),
          actualDeliveryDate: order.actualDeliveryDate,
          createdAt: order.createdAt || new Date().toISOString(),
          updatedAt: order.updatedAt || new Date().toISOString()
        }));
        setOrders(transformedOrders);
      }
    });

    return () => unsubscribe();
  }, []);

  // Filter orders based on search and status
  const handleDelete = async (orderId: string) => {
    setSaving(true);
    try {
      await deleteClientOrder(orderId);
      // Orders will be updated automatically through the snapshot listener
      toast.success('Order deleted successfully');
      setSelectedOrders(prev => {
        const newSelected = new Set(prev);
        newSelected.delete(orderId);
        return newSelected;
      });
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrders.size === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedOrders.size} orders?`)) {
      setSaving(true);
      try {
        const orderIds = Array.from(selectedOrders);
        for (const orderId of orderIds) {
          await deleteClientOrder(orderId);
        }
        setSelectedOrders(new Set());
        toast.success(`Successfully deleted ${orderIds.length} orders`);
      } catch (error) {
        console.error('Error deleting orders:', error);
        toast.error('Failed to delete some orders');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSaveChanges = async () => {
    if (!editingOrder) return;
    
    setSaving(true);
    try {
      await updateClientOrder(editingOrder.id, editingOrder);
      setEditingOrder(null);
      setIsEditing(false);
      toast.success('Changes saved successfully');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.clientEmail.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      
      const matchesDateRange = (!dateRange.start || new Date(order.orderDate) >= new Date(dateRange.start)) &&
                               (!dateRange.end || new Date(order.orderDate) <= new Date(dateRange.end));
      
      return matchesSearch && matchesStatus && matchesDateRange;
    });
  }, [orders, searchTerm, statusFilter, dateRange]);

  // Toggle item completion (todo-list style)
  const toggleItemCompleted = async (orderId: string, itemId: string) => {
    try {
      setSaving(true);
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const updatedItems = order.items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            completed: !item.completed,
            completedAt: !item.completed ? new Date().toISOString() : undefined
          };
        }
        return item;
      });

      // Update local state
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, items: updatedItems } : o
      ));

      // Save to Firebase
      const orderRef = doc(db, 'client-orders', orderId);
      await updateDoc(orderRef, {
        products: updatedItems.map(item => ({
          id: item.id,
          name: item.type,
          quantity: item.quantity,
          unit: item.unit,
          pricePerUnit: 0,
          totalPrice: 0,
          completed: item.completed,
          completedAt: item.completedAt
        })),
        updatedAt: serverTimestamp()
      });

    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setSaving(false);
    }
  };

  // Change order status
  const changeOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    let previousStatus: Order['status'] | null = null;
    try {
      console.log('changeOrderStatus called', { orderId, newStatus });
      setSaving(true);

      // Save previous value so we can revert on failure and show optimistic UI
      setOrders(prev => prev.map(order => {
        if (order.id === orderId) {
          previousStatus = order.status;
          return { ...order, status: newStatus };
        }
        return order;
      }));

      // Save to Firebase and use the authoritative version returned
      const updated = await updateClientOrder(orderId, { status: newStatus });
      console.log('updateClientOrder returned', updated);

      // Replace local order with server-returned canonical order (keeps timestamps/other fields aligned)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } as Order : o));

      toast.success('Order status updated');
    } catch (error) {
      console.error('Failed to update order status:', error);
      toast.error('Failed to update status');
      // revert local state
      if (previousStatus !== null) {
        setOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: previousStatus! } : order));
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle order selection
  const handleOrderSelect = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  // Delete order
  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    try {
      setSaving(true);
      await deleteClientOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));

      // Client-side localStorage cleanup for immediate UI reaction
      try {
        const raw = localStorage.getItem('packing_lists');
        if (raw) {
          const parsed = JSON.parse(raw || '[]');
          const updated = parsed.filter((p: any) => p.linkedOrderId !== orderId && p.orderId !== orderId && p.id !== orderId);
          localStorage.setItem('packing_lists', JSON.stringify(updated));
          try { window.dispatchEvent(new StorageEvent('storage', { key: 'packing_lists', newValue: JSON.stringify(updated) })); } catch(e){}
        }
        const rawProd = localStorage.getItem('production_lots');
        if (rawProd) {
          const parsedProd = JSON.parse(rawProd || '[]');
          const updatedProd = parsedProd.filter((p: any) => p.linkedOrderId !== orderId && p.lotNumber !== undefined);
          localStorage.setItem('production_lots', JSON.stringify(updatedProd));
          try { window.dispatchEvent(new StorageEvent('storage', { key: 'production_lots', newValue: JSON.stringify(updatedProd) })); } catch(e){}
        }
      } catch (e) {
        console.warn('Local cleanup after order delete failed:', e);
      }
    } catch (error) {
      console.error('Error deleting order:', error);
    } finally {
      setSaving(false);
    }
  };

  // Get status color
  const getStatusColor = (status: Order['status']) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      processing: 'bg-blue-100 text-blue-800 border-blue-200',
      shipped: 'bg-purple-100 text-purple-800 border-purple-200',
      delivered: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status];
  };

  // Get priority color
  const getPriorityBadge = (priority: Order['priority']) => {
    const colors = {
      high: 'bg-red-50 text-red-700 ring-red-600/10',
      medium: 'bg-yellow-50 text-yellow-700 ring-yellow-600/10',
      low: 'bg-green-50 text-green-700 ring-green-600/10'
    };
    return colors[priority];
  };

  // Add item to new order
  const addItemToOrder = () => {
    const newItem: OrderItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      clientName: newOrder.clientName || '',
      lotNumber: '',
      lotName: '',
      caliber: '',
      quantity: 1,
      unit: 'kg',
      type: 'Hass Avocado',
      processingTime: 24,
      completed: false,
      notes: ''
    };
    
    setNewOrder(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
  };

  // Save new order
  const handleSaveOrder = async () => {
    if (!newOrder.clientName) {
      alert('Please fill in client name');
      return;
    }

    try {
      setSaving(true);
      
      const now = new Date();
      const orderData = {
        orderNumber: newOrder.orderNumber || `ORD-${Date.now().toString(36).toUpperCase()}`,
        clientName: newOrder.clientName,
        clientEmail: 'N/A', // Default value since field was removed
        clientPhone: '', // Default value since field was removed
        // Store dates as strings to satisfy firestore.rules (isValidClientOrder expects string)
        orderDate: now.toISOString(),
        requestedDeliveryDate: (newOrder.requestedDeliveryDate
          ? new Date(newOrder.requestedDeliveryDate)
          : now
        ).toISOString(),
        status: 'pending' as const,
        priority: newOrder.priority || 'medium' as const,
        products: newOrder.items?.map(item => ({
          id: item.id,
          name: item.type,
          quantity: item.quantity,
          unit: item.unit,
          pricePerUnit: 0,
          totalPrice: 0,
          completed: false,
          lotNumber: item.lotNumber,
          caliber: item.caliber
        })) || [],
        totalProcessingTime: newOrder.items?.reduce((total, item) => total + item.processingTime, 0) || 0,
        progress: 0,
        totalAmount: 0,
        // Required by rules: shippingAddress (map) and paymentStatus (string)
        shippingAddress: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: ''
        },
        paymentStatus: 'pending' as const,
        notes: newOrder.notes || '',
        createdAt: now,
        updatedAt: now
      };

      // Add to Firebase (order)
      const docRef = await addDoc(collection(db, 'client-orders'), {
        ...orderData,
        // Keep createdAt/updatedAt as server timestamps for ordering, but dates must remain strings
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Create linked Production lot (shared_lots) and Quality Control lot
      try {
        const lotNumber = orderData.orderNumber;
        const firstItem = (orderData.products || [])[0];
        const productName = firstItem?.name || 'AVOCAT';
        const today = new Date();
        const dateISO = today.toISOString().slice(0, 10);

  // 1) Production lot via sharedLotService (type: 'production')
        const defaultProductionData = {
          headerData: {
            date: dateISO,
            produit: productName || 'AVOCAT',
            numeroLotClient: lotNumber,
            typeProduction: 'CONVENTIONNEL'
          },
          calibreData: {
            12: 0, 14: 0, 16: 0, 18: 0, 20: 0, 22: 0, 24: 0, 26: 0, 28: 0, 30: 0, 32: 0
          },
          nombrePalettes: '',
          productionRows: Array.from({ length: 26 }, (_, index) => ({
            numero: index + 1,
            date: '',
            heure: '',
            calibre: '',
            poidsBrut: '',
            poidsNet: '',
            numeroLotInterne: '',
            variete: '',
            nbrCP: '',
            chambreFroide: '',
            decision: ''
          })),
          visas: {
            controleurQualite: '',
            responsableQualite: '',
            directeurOperationnel: ''
          }
        };

        const productionLotId = await sharedLotService.addLot({
          lotNumber,
          status: 'brouillon',
          type: 'production',
          productionData: defaultProductionData
        } as any);

        // 2) Quality lot via sharedLotService (type: 'quality') so it appears on Quality page
        const defaultQualitySharedData = {
          headerData: {
            date: dateISO,
            produit: productName || 'AVOCAT',
            numeroLotClient: lotNumber
          }
        };
        const qualitySharedLotId = await sharedLotService.addLot({
          lotNumber,
          status: 'brouillon',
          type: 'quality',
          qualityData: defaultQualitySharedData
        } as any);

        // 3) Quality Control lot via qualityControlService (collection: quality_control_lots)
        const qcFormData = {
          date: dateISO,
          product: productName,
          variety: '',
          campaign: `${today.getFullYear()}-${today.getFullYear() + 1}`,
          clientLot: lotNumber,
          shipmentNumber: '',
          packagingType: '',
          category: 'I',
          exporterNumber: '106040',
          frequency: '1 Carton/palette',
          palettes: Array.from({ length: 5 }, () => ({ }))
        };

        const qcLotId = await saveQualityControlLot({
          id: `lot-${Date.now()}`,
          lotNumber,
          formData: qcFormData as any,
          images: [],
          status: 'draft',
          phase: 'controller',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any);

        // 4) Create Waste Tracking lot (SuiviDechets)
        console.log('🗑️ Creating waste tracking lot for:', lotNumber);
        const defaultDechetForm = {
          header: {
            code: 'F.S.D',
            date: dateISO,
            version: '00',
            dateTraitement: dateISO,
            responsableTracabilite: 'Auto-created',
            produit: productName || 'AVOCAT',
            conventionnel: true,
            biologique: false,
          },
          rows: Array.from({ length: 26 }, () => ({
            numeroPalette: '',
            nombreCaisses: '',
            poidsBrut: '',
            poidsNet: '',
            natureDechet: '',
            variete: ''
          }))
        };

        const wasteTrackingLotId = await sharedLotService.addLot({
          lotNumber: lotNumber,
          status: 'brouillon',
          type: 'dechets',
          dechetData: defaultDechetForm
        } as any);
        console.log('✅ Waste tracking lot created:', wasteTrackingLotId);

        // 5) Create New Entry lot (Multi-lot system)
        console.log('📦 Creating new entry lot for:', lotNumber);
        const defaultNewEntryData = {
          harvest: {
            harvestDate: dateISO,
            farmLocation: "",
            farmerId: "",
            lotNumber: lotNumber,
            variety: "hass",
            avocadoType: "",
          },
          transport: {
            lotNumber: lotNumber,
            transportCompany: "",
            driverName: "",
            vehicleId: "",
            departureDateTime: "",
            arrivalDateTime: "",
            temperature: 0,
          },
          sorting: {
            lotNumber: lotNumber,
            sortingDate: "",
            qualityGrade: "A",
            rejectedCount: 0,
            notes: "",
          },
          packaging: {
            lotNumber: lotNumber,
            packagingDate: "",
            boxId: "",
            workerIds: [],
            netWeight: 0,
            avocadoCount: 0,
            boxType: "case",
            boxTypes: [],
            calibers: [],
            boxWeights: [],
            paletteNumbers: [],
          },
          storage: {
            boxId: "",
            entryDate: "",
            storageTemperature: 0,
            storageRoomId: "",
            exitDate: "",
            warehouseId: "",
            warehouseName: "",
          },
          export: {
            boxId: "",
            loadingDate: "",
            containerId: "",
            driverName: "",
            vehicleId: "",
            destination: "",
          },
          delivery: {
            boxId: "",
            estimatedDeliveryDate: "",
            actualDeliveryDate: "",
            clientName: "",
            clientLocation: "",
            notes: "",
          },
          selectedFarm: "",
          packagingDate: "",
          boxId: "",
          boxTypes: [],
          calibers: [],
          avocadoCount: 0,
          status: "draft" as const,
          completedSteps: [],
          currentStep: 1,
          assignedUsers: [],
          globallyAccessible: true,
          createdBy: "auto-system",
          lotNumber: lotNumber
        };

        const newEntryLotId = await multiLotService.addLot(defaultNewEntryData);
        console.log('✅ New entry lot created:', newEntryLotId);

        // Link created lot IDs back to the order document
        await updateDoc(doc(db, 'client-orders', docRef.id), {
          linkedProductionLotId: productionLotId,
          linkedQualitySharedLotId: qualitySharedLotId,
          linkedQualityLotId: qcLotId,
          linkedWasteTrackingLotId: wasteTrackingLotId,
          linkedNewEntryLotId: newEntryLotId,
          updatedAt: serverTimestamp()
        });

        console.log('🎉 All lots created successfully:', { 
          productionLotId, 
          qualitySharedLotId, 
          qcLotId, 
          wasteTrackingLotId, 
          newEntryLotId 
        });
      } catch (linkErr) {
        console.error('Failed to create linked lots:', linkErr);
        // Fallback: ensure QC shows something by writing to legacy 'lots' collection
        try {
          const today = new Date();
          await addDoc(collection(db, 'lots'), {
            lotNumber: orderData.orderNumber,
            formData: {
              date: today.toISOString().slice(0, 10),
              product: (orderData.products?.[0]?.name) || 'AVOCAT',
              variety: '',
              campaign: `${today.getFullYear()}-${today.getFullYear() + 1}`,
              clientLot: orderData.orderNumber,
              shipmentNumber: '',
              packagingType: '',
              category: 'I',
              exporterNumber: '106040',
              frequency: '1 Carton/palette',
              palettes: Array.from({ length: 5 }, () => ({}))
            },
            images: [],
            status: 'draft',
            phase: 'controller',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            syncedToFirebase: false
          });
          console.warn('Legacy QC lot created in "lots" collection as fallback');
        } catch (legacyErr) {
          console.error('Legacy QC fallback also failed:', legacyErr);
        }
        // Non-blocking: order is created even if linked lots fail
      }

      // Reset form and close modal
      setNewOrder({
        orderNumber: '',
        clientName: '',
        requestedDeliveryDate: '',
        priority: 'medium',
        status: 'pending',
        items: [],
        notes: ''
      });
      setShowAddModal(false);
      
      // Also create a packing list lot with the same name so it appears in the Packing List page
      try {
        const packingKey = 'packing_lists';
        const saved = localStorage.getItem(packingKey);
        const parsed = saved ? JSON.parse(saved) : [];
        const lotName = orderData.orderNumber;
        const exists = parsed.find((l: any) => l.lotNumber === lotName);
        if (!exists) {
          const nowISO = new Date().toISOString();
          // Minimal compatible formData for PackingListManager
          const defaultCalibres = ['12','14','16','18','20','22','24','26','28','30','32'];
          const defaultForm = {
            origin: {
              companyName: 'FRUITS FOR YOU',
              address: '',
              city: ''
            },
            destination: {
              companyName: orderData.clientName || '',
              address: '',
              city: ''
            },
            transport: {
              truckNumber: '',
              chauffeurNumber: '',
              transporteur: '',
              scelle: ''
            },
            technicalDetails: {
              dateProduction: new Date().toISOString().slice(0,10),
              dateDeparture: new Date().toISOString().slice(0,10),
              lotNumbers: lotName,
              ggn: '4063651496413',
              orderNumber: lotName,
              poidsNetTotal: '',
              poidsBrutTotal: ''
            },
            palletRows: Array.from({ length: 26 }, (_, index) => ({
              numero: index + 1,
              produit: (orderData.products?.[0]?.name) || 'AVOCAT HASS BIO',
              calibre: '16',
              paletteNr: (index + 1).toString(),
              caissesPerPalette: '264'
            })),
            calibreSummary: defaultCalibres.reduce((acc: any, cal: string) => ({ ...acc, [cal]: { palettes: 0, caisses: 0 } }), {}),
            palletTypes: { type220: 0, type264: 0 }
          };

          const newPackingLot = {
            id: `lot-${Date.now()}`,
            lotNumber: lotName,
            status: 'brouillon',
            formData: defaultForm,
            createdAt: nowISO,
            updatedAt: nowISO
          };

          parsed.push(newPackingLot);
          localStorage.setItem(packingKey, JSON.stringify(parsed));
          console.log('Packing list lot created in localStorage:', lotName);
        }
      } catch (lsErr) {
        console.error('Failed to create packing list lot in localStorage:', lsErr);
      }

      console.log('Order created with ID:', docRef.id);
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading client orders...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Client Orders Tracking</h1>
              <p className="text-gray-600">Track and manage client orders with lot assignments from admin system</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Order
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">{orders.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">In Processing</p>
                <p className="text-3xl font-bold text-gray-900">
                  {orders.filter(o => o.status === 'processing').length}
                </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Delivered</p>
                <p className="text-3xl font-bold text-gray-900">
                  {orders.filter(o => o.status === 'delivered').length}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Truck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Available Lots</p>
                <p className="text-3xl font-bold text-gray-900">{lots.length + multiLots.length + sharedLots.length}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders, clients..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <select
                className="pl-10 pr-8 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="date"
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="date"
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Admin Controls and Bulk Actions */}
        {isAdminMode && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-gray-900">Admin Controls</span>
                {selectedOrders.size > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                    {selectedOrders.size} selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!isEditing ? (
                  <>
                    <AdminActionButton
                      icon={Edit}
                      label="Edit Selected"
                      onClick={() => setIsEditing(true)}
                      variant="primary"
                      disabled={selectedOrders.size === 0}
                    />
                    <AdminActionButton
                      icon={Trash2}
                      label="Delete Selected"
                      onClick={handleBulkDelete}
                      variant="danger"
                      disabled={selectedOrders.size === 0 || saving}
                    />
                    <AdminActionButton
                      icon={Plus}
                      label="New Order"
                      onClick={() => setShowAddModal(true)}
                      variant="secondary"
                    />
                  </>
                ) : (
                  <>
                    <AdminActionButton
                      icon={Save}
                      label="Save Changes"
                      onClick={handleSaveChanges}
                      variant="primary"
                      disabled={!editingOrder || saving}
                    />
                    <AdminActionButton
                      icon={X}
                      label="Cancel"
                      onClick={() => {
                        setIsEditing(false);
                        setEditingOrder(null);
                      }}
                      variant="secondary"
                    />
                  </>
                )}
              </div>
            </div>
            {isEditing && editingOrder && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Edit</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                      value={editingOrder.status}
                      onChange={(e) => setEditingOrder({
                        ...editingOrder,
                        status: e.target.value as Order['status']
                      })}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                      value={editingOrder.priority}
                      onChange={(e) => setEditingOrder({
                        ...editingOrder,
                        priority: e.target.value as Order['priority']
                      })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                      value={editingOrder.notes || ''}
                      onChange={(e) => setEditingOrder({
                        ...editingOrder,
                        notes: e.target.value
                      })}
                      placeholder="Add notes..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {selectedOrders.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                  <span className="text-blue-900 font-medium">
                    {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedOrders(new Set())}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
              </div>
            )}

          {/* Orders List */}
          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || statusFilter !== 'all' || dateRange.start || dateRange.end
                    ? 'Try adjusting your search or filter criteria'
                    : 'Orders will appear here when they are created by administrators'
                  }
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const completedItems = order.items.filter(item => item.completed).length;
                const progressPercentage = order.items.length > 0 ? Math.round((completedItems / order.items.length) * 100) : 0;

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-xl shadow-sm border transition-all hover:shadow-md ${selectedOrders.has(order.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <button onClick={() => handleOrderSelect(order.id)} className="mt-1">
                            {selectedOrders.has(order.id) ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
                          </button>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-semibold text-gray-900">{order.orderNumber}</h3>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${getPriorityBadge(order.priority)}`}>{order.priority.charAt(0).toUpperCase() + order.priority.slice(1)} Priority</span>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-gray-600">
                              <div className="flex items-center gap-2"><User className="h-4 w-4" /><span>{order.clientName}</span></div>
                              <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>{order.clientEmail}</span></div>
                              <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>Order: {new Date(order.orderDate).toLocaleDateString()}</span></div>
                              <div className="flex items-center gap-2"><Truck className="h-4 w-4" /><span>Due: {new Date(order.requestedDeliveryDate).toLocaleDateString()}</span></div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Always show status selector so admins can change status at any time */}
                          <select value={order.status} onChange={(e) => changeOrderStatus(order.id, e.target.value as Order['status'])} className="border border-gray-300 rounded px-3 py-1 text-sm" disabled={saving}>
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          <button onClick={() => setEditingOrder(order)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-2"><span className="text-gray-600">Progress</span><span className="font-medium text-gray-900">{progressPercentage}%</span></div>
                        <div className="w-full bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${progressPercentage === 100 ? 'bg-green-500' : progressPercentage > 50 ? 'bg-blue-500' : 'bg-yellow-500'}`} style={{ width: `${progressPercentage}%` }} /></div>
                        <div className="text-xs text-gray-500 mt-1">{completedItems} of {order.items.length} items completed</div>
                      </div>

                      <div className="mt-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Order Items & Lot Assignments</h4>
                        {order.items.length === 0 ? (
                          <div className="text-center py-8 text-gray-500"><AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" /><p>No items in this order</p></div>
                        ) : (
                          <div className="space-y-3">
                            {order.items.map(item => (
                              <div key={item.id} className={`flex items-center gap-4 p-4 rounded-lg border ${item.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                <button onClick={() => toggleItemCompleted(order.id, item.id)} disabled={saving} className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center ${item.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400 hover:bg-green-50'}`}>
                                  {item.completed && <CheckCircle className="h-4 w-4" />}
                                </button>
                                <div className={`flex-1 ${item.completed ? 'opacity-60' : ''}`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h5 className="font-medium text-gray-900">{item.type}</h5>
                                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1"><span>Quantity: {item.quantity} {item.unit}</span><span>Caliber: {item.caliber || 'Not specified'}</span><span>Lot: {item.lotNumber || 'Not assigned'}</span><span>Processing: {item.processingTime}h</span></div>
                                    </div>
                                    {item.completed && item.completedAt && <span className="text-xs text-green-600">✓ {new Date(item.completedAt).toLocaleDateString()}</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {order.notes && (
                        <div className="px-6 pb-6"><div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"><div className="flex items-start gap-2"><AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" /><div><h6 className="text-sm font-medium text-yellow-800">Notes</h6><p className="text-sm text-yellow-700 mt-1">{order.notes}</p></div></div></div></div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        {/* Add Order Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Create New Order</h2>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Client Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Order Number
                      </label>
                      <input
                        type="text"
                        value={newOrder.orderNumber}
                        onChange={(e) => setNewOrder(prev => ({ ...prev, orderNumber: e.target.value }))}
                        placeholder="Auto-generated if empty"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Client Name *
                      </label>
                      <input
                        type="text"
                        value={newOrder.clientName}
                        onChange={(e) => setNewOrder(prev => ({ ...prev, clientName: e.target.value }))}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Requested Delivery Date *
                      </label>
                      <input
                        type="date"
                        value={newOrder.requestedDeliveryDate}
                        onChange={(e) => setNewOrder(prev => ({ ...prev, requestedDeliveryDate: e.target.value }))}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority
                      </label>
                      <select
                        value={newOrder.priority}
                        onChange={(e) => setNewOrder(prev => ({ 
                          ...prev, 
                          priority: e.target.value as 'high' | 'medium' | 'low' 
                        }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Order Items</h3>
                    <button
                      onClick={addItemToOrder}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(newOrder.items || []).map((item, index) => (
                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Product Type
                          </label>
                          <input
                            type="text"
                            value={item.type}
                            onChange={(e) => {
                              const updatedItems = [...(newOrder.items || [])];
                              updatedItems[index] = { ...item, type: e.target.value };
                              setNewOrder(prev => ({ ...prev, items: updatedItems }));
                            }}
                            placeholder="e.g., Hass Avocado"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const updatedItems = [...(newOrder.items || [])];
                              updatedItems[index] = { ...item, quantity: parseInt(e.target.value) || 0 };
                              setNewOrder(prev => ({ ...prev, items: updatedItems }));
                            }}
                            min="1"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Unit
                          </label>
                          <select
                            value={item.unit}
                            onChange={(e) => {
                              const updatedItems = [...(newOrder.items || [])];
                              updatedItems[index] = { ...item, unit: e.target.value };
                              setNewOrder(prev => ({ ...prev, items: updatedItems }));
                            }}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="kg">kg</option>
                            <option value="palette">Palette</option>
                            <option value="box">Box</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Caliber
                          </label>
                          <input
                            type="text"
                            value={item.caliber}
                            onChange={(e) => {
                              const updatedItems = [...(newOrder.items || [])];
                              updatedItems[index] = { ...item, caliber: e.target.value };
                              setNewOrder(prev => ({ ...prev, items: updatedItems }));
                            }}
                            placeholder="e.g., 18-22"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Assigned Lot
                          </label>
                          <select
                            value={item.lotNumber}
                            onChange={(e) => {
                              const updatedItems = [...(newOrder.items || [])];
                              const selectedLot =
                                lots.find(lot => lot.harvest?.lotNumber === e.target.value) ||
                                multiLots.find(lot => lot.lotNumber === e.target.value) ||
                                sharedLots.find(lot => lot.lotNumber === e.target.value);
                              updatedItems[index] = { 
                                ...item, 
                                lotNumber: e.target.value,
                                lotName: selectedLot ? `Lot ${selectedLot.harvest?.lotNumber || selectedLot.lotNumber}` : ''
                              };
                              setNewOrder(prev => ({ ...prev, items: updatedItems }));
                            }}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select Lot</option>
                            <optgroup label="Admin Lots">
                              {lots.map((lot) => (
                                <option key={lot.id} value={lot.harvest?.lotNumber || lot.id}>
                                  {lot.harvest?.lotNumber || `Lot ${lot.id}`} (Admin)
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Multi-Lots (legacy)">
                              {multiLots.map((lot) => (
                                <option key={lot.id} value={lot.lotNumber}>
                                  {lot.lotNumber} (Multi-Lot)
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Shared Lots (Production & Qualité)">
                              {sharedLots.map((lot) => (
                                <option key={lot.id} value={lot.lotNumber}>
                                  {lot.lotNumber} ({lot.type === 'production' ? 'Production' : 'Qualité'})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>

                        <div className="flex items-end">
                          <button
                            onClick={() => {
                              const updatedItems = (newOrder.items || []).filter((_, i) => i !== index);
                              setNewOrder(prev => ({ ...prev, items: updatedItems }));
                            }}
                            className="w-full bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}

                    {(newOrder.items || []).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>No items added yet. Click "Add Item" to start.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={newOrder.notes}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Additional notes or special instructions..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOrder}
                  disabled={saving || !newOrder.clientName}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Create Order
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
