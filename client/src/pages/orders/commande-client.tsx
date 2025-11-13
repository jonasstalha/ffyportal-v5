import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Calendar, 
  Truck, 
  AlertCircle, 
  Plus,
  MoreVertical,
  Download,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Users,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Database,
  X,
  Save,
  Grid3X3,
  Table
} from 'lucide-react';
import { 
  getClientOrders, 
  updateClientOrder, 
  deleteClientOrder, 
  bulkUpdateOrderStatus,
  getOrderStats,
  addClientOrder,
  ClientOrder,
  addCommunicationNotification
} from '../../lib/firebaseService';
import { initializeClientOrders } from '../../lib/initClientOrders';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { sharedLotService } from '../../lib/sharedLotService';
import { saveQualityControlLot } from '../../lib/qualityControlService';
import { multiLotService } from '../../lib/multiLotService';

// Edit Order Modal Component
const EditOrderModal = ({ order, onClose, onSave }: { 
  order: ClientOrder; 
  onClose: () => void; 
  onSave: (updatedOrder: ClientOrder) => Promise<void>;
}) => {
  const [editedOrder, setEditedOrder] = useState<ClientOrder>(order);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedOrder);
      toast.success('Order updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Edit Order {editedOrder.orderNumber}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Client Information */}
          <div>
            <h3 className="font-medium mb-2">Client Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                value={editedOrder.clientName}
                onChange={(e) => setEditedOrder({...editedOrder, clientName: e.target.value})}
                placeholder="Client Name"
                className="border p-2 rounded"
              />
              <input
                type="email"
                value={editedOrder.clientEmail}
                onChange={(e) => setEditedOrder({...editedOrder, clientEmail: e.target.value})}
                placeholder="Client Email"
                className="border p-2 rounded"
              />
              <input
                type="tel"
                value={editedOrder.clientPhone}
                onChange={(e) => setEditedOrder({...editedOrder, clientPhone: e.target.value})}
                placeholder="Client Phone"
                className="border p-2 rounded"
              />
            </div>
          </div>

          {/* Order Status */}
          <div>
            <h3 className="font-medium mb-2">Order Status</h3>
            <select
              value={editedOrder.status}
              onChange={(e) => setEditedOrder({...editedOrder, status: e.target.value as ClientOrder['status']})}
              className="border p-2 rounded w-full"
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <h3 className="font-medium mb-2">Priority</h3>
            <select
              value={editedOrder.priority}
              onChange={(e) => setEditedOrder({...editedOrder, priority: e.target.value as 'low' | 'medium' | 'high'})}
              className="border p-2 rounded w-full"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <h3 className="font-medium mb-2">Notes</h3>
            <textarea
              value={editedOrder.notes}
              onChange={(e) => setEditedOrder({...editedOrder, notes: e.target.value})}
              placeholder="Order notes..."
              className="border p-2 rounded w-full h-24"
            />
          </div>

          {/* Payment Status */}
          <div>
            <h3 className="font-medium mb-2">Payment Status</h3>
            <select
              value={editedOrder.paymentStatus}
              onChange={(e) => setEditedOrder({...editedOrder, paymentStatus: e.target.value as 'pending' | 'paid' | 'failed'})}
              className="border p-2 rounded w-full"
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 flex items-center"
          >
            {isSaving ? (
              <>
                <span className="mr-2">Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const CommandeClient = () => {
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ClientOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    totalRevenue: 0,
    averageOrderValue: 0
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ClientOrder;
    direction: 'asc' | 'desc';
  }>({ key: 'orderDate', direction: 'desc' });
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState('');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editingOrder, setEditingOrder] = useState<ClientOrder | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Real-time orders listener
  useEffect(() => {
    const ordersRef = collection(db, "client-orders");
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const fetchedOrders = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            orderNumber: data.orderNumber || '',
            clientName: data.clientName || '',
            clientEmail: data.clientEmail || '',
            clientPhone: data.clientPhone || '',
            products: data.products || [],
            status: data.status || 'pending',
            orderDate: data.orderDate?.toDate ? data.orderDate.toDate().toISOString() : new Date().toISOString(),
            requestedDeliveryDate: data.requestedDeliveryDate?.toDate ? data.requestedDeliveryDate.toDate().toISOString() : new Date().toISOString(),
            actualDeliveryDate: data.actualDeliveryDate?.toDate ? data.actualDeliveryDate.toDate().toISOString() : undefined,
            totalAmount: data.totalAmount || 0,
            priority: data.priority || 'medium',
            notes: data.notes || '',
            selected: false,
            shippingAddress: data.shippingAddress || {
              street: '',
              city: '',
              state: '',
              zipCode: '',
              country: ''
            },
            paymentStatus: data.paymentStatus || 'pending',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
          } as ClientOrder;
        });
        setOrders(fetchedOrders);
        setLoading(false);
      } catch (error) {
        console.error("Error processing orders:", error);
        toast.error("Error loading orders");
        setLoading(false);
      }
    }, (error) => {
      console.error("Error listening to orders:", error);
      toast.error("Error connecting to database");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const orderStats = await getOrderStats();
        setStats(orderStats);
      } catch (error) {
        console.error("Error loading stats:", error);
      }
    };
    loadStats();
  }, [orders]);

  // Filter and sort orders
  useEffect(() => {
    let filtered = [...orders];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.clientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.products.some(product => 
          product.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(order => order.priority === priorityFilter);
    }

    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(order => 
        new Date(order.orderDate) >= new Date(dateRange.start)
      );
    }
    if (dateRange.end) {
      filtered = filtered.filter(order => 
        new Date(order.orderDate) <= new Date(dateRange.end)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue === undefined || bValue === undefined) return 0;
      
      if (sortConfig.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter, priorityFilter, dateRange, sortConfig]);

  const handleEditOrder = (order: ClientOrder) => {
    setEditingOrder(order);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (updatedOrder: ClientOrder) => {
    try {
      await updateClientOrder(updatedOrder.id, updatedOrder);
      // Real-time updates will handle the UI update through the snapshot listener
      await addCommunicationNotification(
        `Order ${updatedOrder.orderNumber} has been updated by admin`
      );
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  };

  const getStatusColor = (status: ClientOrder['status']) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      processing: 'bg-blue-100 text-blue-800 border-blue-200',
      shipped: 'bg-purple-100 text-purple-800 border-purple-200',
      delivered: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status];
  };

  const getPriorityColor = (priority: ClientOrder['priority']) => {
    const colors = {
      high: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
      medium: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20',
      low: 'bg-green-50 text-green-700 ring-1 ring-green-600/20'
    };
    return colors[priority];
  };

  const getStatusIcon = (status: ClientOrder['status']) => {
    const icons = {
      pending: <Clock className="h-4 w-4" />,
      processing: <Package className="h-4 w-4" />,
      shipped: <Truck className="h-4 w-4" />,
      delivered: <CheckCircle className="h-4 w-4" />,
      cancelled: <XCircle className="h-4 w-4" />
    };
    return icons[status];
  };

  const handleSort = (key: keyof ClientOrder) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(order => order.id)));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedOrders.size === 0) return;

    try {
      setSaving(true);
      if (bulkAction.startsWith('status:')) {
        const status = bulkAction.split(':')[1] as ClientOrder['status'];
        await bulkUpdateOrderStatus(Array.from(selectedOrders), status);
        toast.success(`Updated ${selectedOrders.size} orders to ${status}`);
      } else if (bulkAction === 'delete') {
        // Bulk delete functionality
        const promises = Array.from(selectedOrders).map(orderId => deleteClientOrder(orderId));
        await Promise.all(promises);
        toast.success(`Deleted ${selectedOrders.size} orders`);
      }
      setSelectedOrders(new Set());
      setBulkAction('');
    } catch (error) {
      console.error("Error performing bulk action:", error);
      toast.error("Error performing bulk action");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: ClientOrder['status']) => {
    try {
      setSaving(true);
      await updateClientOrder(orderId, { status });
      toast.success(`Order status updated to ${status}`);
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Error updating order");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    try {
      setSaving(true);
      await deleteClientOrder(orderId);
      // Also remove potential packing list entry from localStorage for immediate UI update
      try {
        const raw = localStorage.getItem('packing_lists');
        if (raw) {
          const parsed = JSON.parse(raw || '[]');
          const updated = parsed.filter((p: any) => p.linkedOrderId !== orderId && p.orderId !== orderId && p.id !== orderId);
          localStorage.setItem('packing_lists', JSON.stringify(updated));
          try { window.dispatchEvent(new StorageEvent('storage', { key: 'packing_lists', newValue: JSON.stringify(updated) })); } catch(e){}
        }
      } catch (e) {
        console.warn('Packing list cleanup failed on client after order delete:', e);
      }

      toast.success('Order deleted successfully');
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Error deleting order");
    } finally {
      setSaving(false);
    }
  };

  const handleInitializeOrders = async () => {
    try {
      setLoading(true);
      await initializeClientOrders();
      toast.success("Sample orders created successfully!");
    } catch (error) {
      console.error("Error initializing orders:", error);
      toast.error("Error creating sample orders");
    } finally {
      setLoading(false);
    }
  };

  // New Order Modal Component
  const NewOrderModal = () => {
    const [newOrder, setNewOrder] = useState({
      orderNumber: `ORD-${new Date().getFullYear()}-${String(orders.length + 1).padStart(3, '0')}`,
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      priority: 'medium' as ClientOrder['priority'],
      requestedDeliveryDate: '',
      notes: '',
      products: [{ name: '', quantity: 1, unit: 'kg', pricePerUnit: 0 }],
      shippingAddress: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'USA'
      }
    });

    const addProduct = () => {
      setNewOrder(prev => ({
        ...prev,
        products: [...prev.products, { name: '', quantity: 1, unit: 'kg', pricePerUnit: 0 }]
      }));
    };

    const removeProduct = (index: number) => {
      setNewOrder(prev => ({
        ...prev,
        products: prev.products.filter((_, i) => i !== index)
      }));
    };

    const updateProduct = (index: number, field: string, value: any) => {
      setNewOrder(prev => ({
        ...prev,
        products: prev.products.map((product, i) => 
          i === index ? { ...product, [field]: value } : product
        )
      }));
    };

    const calculateTotal = () => {
      return newOrder.products.reduce((sum, product) => 
        sum + (product.quantity * product.pricePerUnit), 0
      );
    };

    const handleSubmitNewOrder = async (e: React.FormEvent) => {
      e.preventDefault();
      console.log('🆕 handleSubmitNewOrder called - Creating new order...', newOrder);
      
      if (!newOrder.clientName || !newOrder.clientEmail || !newOrder.requestedDeliveryDate) {
        toast.error("Please fill in all required fields");
        return;
      }

      try {
        setSaving(true);
        
        const orderData: Omit<ClientOrder, 'id' | 'createdAt' | 'updatedAt' | 'selected'> = {
          orderNumber: newOrder.orderNumber,
          clientName: newOrder.clientName,
          clientEmail: newOrder.clientEmail,
          clientPhone: newOrder.clientPhone,
          products: newOrder.products.map((product, index) => ({
            id: `prod-${Date.now()}-${index}`,
            name: product.name,
            quantity: product.quantity,
            unit: product.unit,
            pricePerUnit: product.pricePerUnit,
            totalPrice: product.quantity * product.pricePerUnit
          })),
          status: 'pending',
          orderDate: new Date().toISOString(),
          requestedDeliveryDate: new Date(newOrder.requestedDeliveryDate).toISOString(),
          totalAmount: calculateTotal(),
          priority: newOrder.priority,
          notes: newOrder.notes,
          shippingAddress: newOrder.shippingAddress,
          paymentStatus: 'pending'
        };

        // 1) Create the order
        const createdOrder = await addClientOrder(orderData);
        console.log('📋 Order created successfully:', createdOrder);

        // 2) Create linked lots (production + quality) and archived QC lot
        let productionLotId: string | undefined;
        let qualitySharedLotId: string | undefined;
        let qcLotId: string | undefined;
        let wasteTrackingLotId: string | undefined;
        let newEntryLotId: string | undefined;
        
        try {
          console.log('🚀 Starting lot creation process...');
          alert('🚀 Order created! Now creating lots: ' + createdOrder.orderNumber); // Test alert
          const lotNumber = createdOrder.orderNumber;
          const firstProduct = orderData.products[0];
          const productName = firstProduct?.name || 'AVOCAT';
          const today = new Date();
          const dateISO = today.toISOString().slice(0, 10);

          // Production lot (shared_lots)
          const defaultProductionData = {
            headerData: {
              date: dateISO,
              produit: productName || 'AVOCAT',
              numeroLotClient: lotNumber,
              typeProduction: 'CONVENTIONNEL'
            },
            calibreData: { 12: 0, 14: 0, 16: 0, 18: 0, 20: 0, 22: 0, 24: 0, 26: 0, 28: 0, 30: 0, 32: 0 },
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

          console.log('🚀 Starting lot creation process for order:', lotNumber);
          
          // Quality card (shared_lots)
          const defaultQualitySharedData = {
            headerData: {
              date: dateISO,
              produit: productName || 'AVOCAT',
              numeroLotClient: lotNumber
            }
          };

          // Archived QC lot (quality_control_lots)
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

          // 4) Create Waste Tracking lot (SuiviDechets)
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

          // 5) Create New Entry lot (Multi-lot system)
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
          
          try {
            console.log('📦 Creating production lot...');
            productionLotId = await sharedLotService.addLot({
              lotNumber,
              status: 'brouillon',
              type: 'production',
              productionData: defaultProductionData
            } as any);
            console.log('✅ Production lot created:', productionLotId);
          } catch (error) {
            console.error('❌ Failed to create production lot:', error);
          }

          try {
            console.log('🔬 Creating quality shared lot...');
            qualitySharedLotId = await sharedLotService.addLot({
              lotNumber,
              status: 'brouillon',
              type: 'quality',
              qualityData: defaultQualitySharedData
            } as any);
            console.log('✅ Quality shared lot created:', qualitySharedLotId);
          } catch (error) {
            console.error('❌ Failed to create quality shared lot:', error);
          }

          try {
            console.log('📋 Creating QC lot...');
            qcLotId = await saveQualityControlLot({
              id: `lot-${Date.now()}`,
              lotNumber,
              formData: qcFormData as any,
              images: [],
              status: 'draft',
              phase: 'controller',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } as any);
            console.log('✅ QC lot created:', qcLotId);
          } catch (error) {
            console.error('❌ Failed to create QC lot:', error);
          }

          try {
            console.log('🗑️ Creating waste tracking lot...');
            alert('🗑️ Creating waste tracking lot: ' + lotNumber); // Debug alert
            wasteTrackingLotId = await sharedLotService.addLot({
              lotNumber: `${lotNumber}`,
              status: 'brouillon',
              type: 'dechets',
              dechetData: defaultDechetForm
            } as any);
            console.log('✅ Waste tracking lot created:', wasteTrackingLotId);
            alert('✅ Waste tracking lot created with ID: ' + wasteTrackingLotId); // Success alert
          } catch (error) {
            console.error('❌ Failed to create waste tracking lot:', error);
            alert('❌ Failed to create waste tracking lot: ' + (error as Error).message); // Error alert
          }

          try {
            console.log('📝 Creating new entry lot...');
            newEntryLotId = await multiLotService.addLot(defaultNewEntryData);
            console.log('✅ New entry lot created:', newEntryLotId);
          } catch (error) {
            console.error('❌ Failed to create new entry lot:', error);
          }

          // Link back to order
          await updateDoc(doc(db, 'client-orders', createdOrder.id), {
            linkedProductionLotId: productionLotId,
            linkedQualitySharedLotId: qualitySharedLotId,
            linkedQualityLotId: qcLotId,
            linkedWasteTrackingLotId: wasteTrackingLotId,
            linkedNewEntryLotId: newEntryLotId,
            updatedAt: serverTimestamp()
          });

          console.log('All lots created:', { 
            productionLotId, 
            qualitySharedLotId, 
            qcLotId, 
            wasteTrackingLotId, 
            newEntryLotId 
          });
        } catch (linkErr) {
          console.error('Failed to create some linked lots:', linkErr);
          
          // Still update order with whatever lots were created successfully
          const updates: any = {
            updatedAt: serverTimestamp()
          };
          
          if (productionLotId) updates.linkedProductionLotId = productionLotId;
          if (qualitySharedLotId) updates.linkedQualitySharedLotId = qualitySharedLotId;
          if (qcLotId) updates.linkedQualityLotId = qcLotId;
          if (wasteTrackingLotId) updates.linkedWasteTrackingLotId = wasteTrackingLotId;
          if (newEntryLotId) updates.linkedNewEntryLotId = newEntryLotId;
          
          await updateDoc(doc(db, 'client-orders', createdOrder.id), updates);
          
          // Fallback to legacy 'lots' so QC has something to show
          try {
            const today = new Date();
            await addDoc(collection(db, 'lots'), {
              lotNumber: createdOrder.orderNumber,
              formData: {
                date: today.toISOString().slice(0, 10),
                product: (orderData.products?.[0]?.name) || 'AVOCAT',
                variety: '',
                campaign: `${today.getFullYear()}-${today.getFullYear() + 1}`,
                clientLot: createdOrder.orderNumber,
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
        }

        toast.success("Order created successfully!");
        setShowNewOrderModal(false);
        
        // Reset form
        setNewOrder({
          orderNumber: `ORD-${new Date().getFullYear()}-${String(orders.length + 2).padStart(3, '0')}`,
          clientName: '',
          clientEmail: '',
          clientPhone: '',
          priority: 'medium',
          requestedDeliveryDate: '',
          notes: '',
          products: [{ name: '', quantity: 1, unit: 'kg', pricePerUnit: 0 }],
          shippingAddress: {
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: 'USA'
          }
        });
      } catch (error) {
        console.error("Error creating order:", error);
        toast.error("Error creating order");
      } finally {
        setSaving(false);
      }
    };

    if (!showNewOrderModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Create New Order</h2>
            <button
              onClick={() => setShowNewOrderModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmitNewOrder} className="p-6 space-y-6">
            {/* Basic Order Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Number *
                </label>
                <input
                  type="text"
                  value={newOrder.orderNumber}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, orderNumber: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={newOrder.priority}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, priority: e.target.value as ClientOrder['priority'] }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
            </div>

            {/* Client Information */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={newOrder.clientName}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, clientName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={newOrder.clientEmail}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, clientEmail: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newOrder.clientPhone}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, clientPhone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Products */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Products</h3>
                <button
                  type="button"
                  onClick={addProduct}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                >
                  Add Product
                </button>
              </div>
              
              {newOrder.products.map((product, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={product.name}
                      onChange={(e) => updateProduct(index, 'name', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={product.quantity}
                      onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={product.unit}
                      onChange={(e) => updateProduct(index, 'unit', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="kg">kg</option>
                      <option value="lbs">lbs</option>
                      <option value="pieces">pieces</option>
                      <option value="boxes">boxes</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price per Unit ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={product.pricePerUnit}
                      onChange={(e) => updateProduct(index, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeProduct(index)}
                      disabled={newOrder.products.length === 1}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-900">
                  Total: {formatCurrency(calculateTotal())}
                </p>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Requested Delivery Date *
                  </label>
                  <input
                    type="date"
                    value={newOrder.requestedDeliveryDate}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, requestedDeliveryDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Notes
                  </label>
                  <textarea
                    value={newOrder.notes}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Special instructions or notes..."
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Create Order
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading orders...</span>
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Client Orders Management</h1>
              <p className="text-gray-600">Track and manage all client orders efficiently</p>
            </div>
            <div className="flex items-center gap-3">
              {orders.length === 0 && !loading && (
                <button 
                  onClick={handleInitializeOrders}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Database className="h-4 w-4" />
                  Initialize Sample Data
                </button>
              )}
              <button 
                onClick={() => setShowNewOrderModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Order
              </button>
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-green-600 mt-1">
                  <TrendingUp className="h-4 w-4 inline mr-1" />
                  +12% from last month
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <ShoppingBag className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-sm text-green-600 mt-1">
                  <TrendingUp className="h-4 w-4 inline mr-1" />
                  +8% from last month
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Avg Order Value</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.averageOrderValue)}</p>
                <p className="text-sm text-blue-600 mt-1">
                  <TrendingUp className="h-4 w-4 inline mr-1" />
                  +5% from last month
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Clients</p>
                <p className="text-3xl font-bold text-gray-900">{new Set(orders.map(o => o.clientEmail)).size}</p>
                <p className="text-sm text-orange-600 mt-1">
                  <Users className="h-4 w-4 inline mr-1" />
                  Unique customers
                </p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Users className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="bg-yellow-100 text-yellow-800 rounded-lg p-3 mb-2">
                <Clock className="h-6 w-6 mx-auto" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-sm text-gray-600">Pending</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 text-blue-800 rounded-lg p-3 mb-2">
                <Package className="h-6 w-6 mx-auto" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.processing}</p>
              <p className="text-sm text-gray-600">Processing</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 text-purple-800 rounded-lg p-3 mb-2">
                <Truck className="h-6 w-6 mx-auto" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.shipped}</p>
              <p className="text-sm text-gray-600">Shipped</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 text-green-800 rounded-lg p-3 mb-2">
                <CheckCircle className="h-6 w-6 mx-auto" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.delivered}</p>
              <p className="text-sm text-gray-600">Delivered</p>
            </div>
            <div className="text-center">
              <div className="bg-red-100 text-red-800 rounded-lg p-3 mb-2">
                <XCircle className="h-6 w-6 mx-auto" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.cancelled}</p>
              <p className="text-sm text-gray-600">Cancelled</p>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 flex-1">
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search orders, clients, products..."
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <select
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none transition-colors"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="relative">
                <select
                  className="px-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none transition-colors"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Grid3X3 className="h-4 w-4" />
                Grid
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'table' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Table className="h-4 w-4" />
                Table
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedOrders.size > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-blue-800 font-semibold text-lg">
                    {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="border-2 border-blue-300 rounded-lg px-4 py-2 text-sm font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value)}
                  >
                    <option value="">Choose action...</option>
                    <option value="status:processing">🔄 Mark as Processing</option>
                    <option value="status:shipped">🚚 Mark as Shipped</option>
                    <option value="status:delivered">✅ Mark as Delivered</option>
                    <option value="status:cancelled">❌ Mark as Cancelled</option>
                    <option value="delete">🗑️ Delete Selected</option>
                  </select>
                  <button
                    onClick={handleBulkAction}
                    disabled={!bulkAction || saving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-md"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-4 w-4" />
                        Apply Action
                      </>
                    )}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrders(new Set())}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 transition-colors"
              >
                <X className="h-4 w-4" />
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Orders Grid - Enhanced UI/UX */}
        {viewMode === 'grid' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Orders Overview ({filteredOrders.length})</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {selectedOrders.size === filteredOrders.length && filteredOrders.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                  ) : selectedOrders.size > 0 ? (
                    <div className="h-4 w-4 bg-blue-600 rounded border-2 border-blue-600 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 bg-white rounded-sm"></div>
                    </div>
                  ) : (
                    <Square className="h-4 w-4 text-gray-400" />
                  )}
                  Select All ({selectedOrders.size})
                </button>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-16">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">No orders found</h3>
                <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
                <button 
                  onClick={() => setShowNewOrderModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  Create First Order
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`bg-white border-2 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 ${
                      selectedOrders.has(order.id) 
                        ? 'border-blue-500 shadow-lg ring-2 ring-blue-200 scale-105' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => handleSelectOrder(order.id)}
                          className={`flex items-center justify-center w-6 h-6 rounded-lg border-2 transition-all duration-200 ${
                            selectedOrders.has(order.id)
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                              : 'border-gray-300 hover:border-blue-400 bg-white'
                          }`}
                        >
                          {selectedOrders.has(order.id) && <CheckSquare className="h-4 w-4" />}
                        </button>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getPriorityColor(order.priority)}`}>
                          {order.priority}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 mb-1">{order.orderNumber}</h4>
                      <div className="text-sm text-gray-600">
                        <p className="font-medium">{order.clientName}</p>
                        <p className="text-xs opacity-75">{order.clientEmail}</p>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-6 space-y-4">
                      {/* Status Section */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Order Status
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gray-50">
                            {getStatusIcon(order.status)}
                          </div>
                          <select
                            value={order.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value as ClientOrder['status'];
                              await handleUpdateOrderStatus(order.id, newStatus);
                              // Send automatic notification about status change
                              try {
                                await addCommunicationNotification(
                                  `🔄 Order ${order.orderNumber} status updated to ${newStatus} for client ${order.clientName}`
                                );
                                toast.success(`Status updated to ${newStatus}`);
                              } catch (error) {
                                console.error('Error adding notification:', error);
                              }
                            }}
                            className={`flex-1 text-sm font-medium border rounded-lg px-3 py-2 ${getStatusColor(order.status)} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                          >
                            <option value="pending">⏳ Pending</option>
                            <option value="processing">🔄 Processing</option>
                            <option value="shipped">🚚 Shipped</option>
                            <option value="delivered">✅ Delivered</option>
                            <option value="cancelled">❌ Cancelled</option>
                          </select>
                        </div>
                      </div>

                      {/* Products Section */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          Products & Calibres ({order.products.length} items)
                        </label>
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                          {order.products.map((product, index) => (
                            <div key={index} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <h5 className="font-semibold text-gray-900 text-sm">{product.name}</h5>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatCurrency(product.pricePerUnit)} per {product.unit}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-gray-900">{formatCurrency(product.totalPrice)}</p>
                                  <p className="text-xs text-green-600">Total</p>
                                </div>
                              </div>
                              
                              {/* Calibre Editor */}
                              <div className="flex items-center gap-3 bg-white rounded-lg p-3 border">
                                <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                                  Calibre:
                                </label>
                                <div className="flex items-center gap-2 flex-1">
                                  <button
                                    onClick={async () => {
                                      if (product.quantity > 1) {
                                        const newQuantity = product.quantity - 1;
                                        const updatedProducts = [...order.products];
                                        updatedProducts[index] = {
                                          ...product,
                                          quantity: newQuantity,
                                          totalPrice: newQuantity * product.pricePerUnit
                                        };
                                        const newTotal = updatedProducts.reduce((sum, p) => sum + p.totalPrice, 0);
                                        
                                        try {
                                          await updateClientOrder(order.id, {
                                            products: updatedProducts,
                                            totalAmount: newTotal
                                          });
                                          
                                          await addCommunicationNotification(
                                            `📦 Product calibre updated in order ${order.orderNumber}: ${product.name} quantity decreased to ${newQuantity} ${product.unit}`
                                          );
                                          
                                          toast.success('Calibre updated successfully');
                                        } catch (error) {
                                          console.error('Error updating product:', error);
                                          toast.error('Failed to update calibre');
                                        }
                                      }
                                    }}
                                    className="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                    disabled={product.quantity <= 1}
                                  >
                                    -
                                  </button>
                                  
                                  <input
                                    type="number"
                                    value={product.quantity}
                                    onChange={async (e) => {
                                      const newQuantity = Math.max(1, parseInt(e.target.value) || 1);
                                      const updatedProducts = [...order.products];
                                      updatedProducts[index] = {
                                        ...product,
                                        quantity: newQuantity,
                                        totalPrice: newQuantity * product.pricePerUnit
                                      };
                                      const newTotal = updatedProducts.reduce((sum, p) => sum + p.totalPrice, 0);
                                      
                                      try {
                                        await updateClientOrder(order.id, {
                                          products: updatedProducts,
                                          totalAmount: newTotal
                                        });
                                        
                                        await addCommunicationNotification(
                                          `📦 Product calibre updated in order ${order.orderNumber}: ${product.name} quantity changed to ${newQuantity} ${product.unit}`
                                        );
                                        
                                        toast.success('Calibre updated successfully');
                                      } catch (error) {
                                        console.error('Error updating product:', error);
                                        toast.error('Failed to update calibre');
                                      }
                                    }}
                                    className="w-16 px-2 py-1 text-center text-sm font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    min="1"
                                  />
                                  
                                  <button
                                    onClick={async () => {
                                      const newQuantity = product.quantity + 1;
                                      const updatedProducts = [...order.products];
                                      updatedProducts[index] = {
                                        ...product,
                                        quantity: newQuantity,
                                        totalPrice: newQuantity * product.pricePerUnit
                                      };
                                      const newTotal = updatedProducts.reduce((sum, p) => sum + p.totalPrice, 0);
                                      
                                      try {
                                        await updateClientOrder(order.id, {
                                          products: updatedProducts,
                                          totalAmount: newTotal
                                        });
                                        
                                        await addCommunicationNotification(
                                          `📦 Product calibre updated in order ${order.orderNumber}: ${product.name} quantity increased to ${newQuantity} ${product.unit}`
                                        );
                                        
                                        toast.success('Calibre updated successfully');
                                      } catch (error) {
                                        console.error('Error updating product:', error);
                                        toast.error('Failed to update calibre');
                                      }
                                    }}
                                    className="w-8 h-8 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-600 rounded-lg transition-colors"
                                  >
                                    +
                                  </button>
                                  
                                  <span className="text-sm text-gray-600 ml-2 whitespace-nowrap">
                                    {product.unit}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Info */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Order Date</p>
                          <p className="text-sm font-medium text-gray-900">{formatDate(order.orderDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Delivery</p>
                          <p className="text-sm font-medium text-gray-900">{formatDate(order.requestedDeliveryDate)}</p>
                        </div>
                      </div>

                      {/* Total Amount */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Total Amount</span>
                          <span className="text-xl font-bold text-blue-600">{formatCurrency(order.totalAmount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          {expandedOrder === order.id ? 'Hide Details' : 'View Details'}
                        </button>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              toast.info("Advanced edit functionality coming soon");
                            }}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit Order"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete order ${order.orderNumber}?`)) {
                                handleDeleteOrder(order.id);
                              }
                            }}
                            disabled={saving}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors"
                            title="Delete Order"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedOrder === order.id && (
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                          <div>
                            <h5 className="text-sm font-semibold text-gray-900 mb-2">📞 Contact Information</h5>
                            <div className="text-sm text-gray-600 space-y-1 bg-white rounded-lg p-3">
                              <div><span className="font-medium">Email:</span> {order.clientEmail}</div>
                              {order.clientPhone && <div><span className="font-medium">Phone:</span> {order.clientPhone}</div>}
                            </div>
                          </div>
                          
                          {order.shippingAddress && (
                            <div>
                              <h5 className="text-sm font-semibold text-gray-900 mb-2">🚚 Shipping Address</h5>
                              <div className="text-sm text-gray-600 bg-white rounded-lg p-3">
                                <div>{order.shippingAddress.street}</div>
                                <div>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</div>
                                <div>{order.shippingAddress.country}</div>
                              </div>
                            </div>
                          )}
                          
                          {order.notes && (
                            <div>
                              <h5 className="text-sm font-semibold text-gray-900 mb-2">📝 Order Notes</h5>
                              <p className="text-sm text-gray-600 bg-white rounded-lg p-3 italic">{order.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders Table - Enhanced for better comparison */}
        {viewMode === 'table' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center justify-center w-5 h-5"
                        type="button"
                        aria-label="Select all orders"
                      >
                        {selectedOrders.size === filteredOrders.length && filteredOrders.length > 0 ? (
                          <CheckSquare className="h-5 w-5 text-blue-600" />
                        ) : selectedOrders.size > 0 ? (
                          <div className="h-5 w-5 bg-blue-600 rounded border-2 border-blue-600 flex items-center justify-center">
                            <div className="h-2 w-2 bg-white rounded-sm"></div>
                          </div>
                        ) : (
                          <Square className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('orderNumber')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Order Details
                        {sortConfig.key === 'orderNumber' && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('clientName')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Client
                        {sortConfig.key === 'clientName' && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Products & Calibres
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Status
                        {sortConfig.key === 'status' && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('orderDate')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Dates
                        {sortConfig.key === 'orderDate' && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('totalAmount')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Amount
                        {sortConfig.key === 'totalAmount' && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <React.Fragment key={`fragment-${order.id}`}>
                      <tr className={`hover:bg-gray-50 transition-colors ${selectedOrders.has(order.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleSelectOrder(order.id)}
                            className="flex items-center justify-center w-5 h-5"
                            type="button"
                            aria-label={`Select order ${order.orderNumber}`}
                          >
                            {selectedOrders.has(order.id) ? (
                              <CheckSquare className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{order.orderNumber}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(order.priority)}`}>
                                {order.priority.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{order.clientName}</span>
                            <span className="text-sm text-gray-500">{order.clientEmail}</span>
                            {order.clientPhone && (
                              <span className="text-sm text-gray-500">{order.clientPhone}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-2">
                            {order.products.slice(0, 2).map((product, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={product.quantity}
                                  onChange={async (e) => {
                                    const newQuantity = parseInt(e.target.value) || 1;
                                    const updatedProducts = [...order.products];
                                    updatedProducts[index] = {
                                      ...product,
                                      quantity: newQuantity,
                                      totalPrice: newQuantity * product.pricePerUnit
                                    };
                                    const newTotal = updatedProducts.reduce((sum, p) => sum + p.totalPrice, 0);
                                    
                                    try {
                                      await updateClientOrder(order.id, {
                                        products: updatedProducts,
                                        totalAmount: newTotal
                                      });
                                      
                                      // Send automatic notification about calibre change
                                      await addCommunicationNotification(
                                        `Product calibre updated in order ${order.orderNumber}: ${product.name} quantity changed to ${newQuantity} ${product.unit}`
                                      );
                                      
                                      toast.success('Product calibre updated successfully');
                                    } catch (error) {
                                      console.error('Error updating product:', error);
                                      toast.error('Failed to update product calibre');
                                    }
                                  }}
                                  className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  min="1"
                                />
                                <span className="text-sm text-gray-600">
                                  {product.unit} {product.name}
                                </span>
                              </div>
                            ))}
                            {order.products.length > 2 && (
                              <button
                                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                className="text-sm text-blue-600 hover:text-blue-800 text-left"
                              >
                                +{order.products.length - 2} more items
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            <select
                              value={order.status}
                              onChange={async (e) => {
                                await handleUpdateOrderStatus(order.id, e.target.value as ClientOrder['status']);
                                // Send automatic notification about status change
                                if (order.clientEmail) {
                                  try {
                                    await addCommunicationNotification(
                                      `Order ${order.orderNumber} status updated to ${e.target.value} for client ${order.clientName}`
                                    );
                                  } catch (error) {
                                    console.error('Error adding notification:', error);
                                  }
                                }
                              }}
                              className={`text-xs font-medium border-0 rounded-full px-2.5 py-0.5 ${getStatusColor(order.status)} focus:ring-2 focus:ring-blue-500`}
                            >
                              <option value="pending">Pending</option>
                              <option value="processing">Processing</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-sm text-gray-600">
                            <span>Ordered: {formatDate(order.orderDate)}</span>
                            <span>Expected: {formatDate(order.requestedDeliveryDate)}</span>
                            {order.actualDeliveryDate && (
                              <span className="text-green-600">Delivered: {formatDate(order.actualDeliveryDate)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{formatCurrency(order.totalAmount)}</div>
                            <div className="text-gray-500">{order.products.length} item{order.products.length !== 1 ? 's' : ''}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => {
                                // TODO: Implement edit functionality
                                toast.info("Edit functionality coming soon");
                              }}
                              className="text-gray-400 hover:text-green-600 transition-colors"
                              title="Edit Order"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteOrder(order.id)}
                              disabled={saving}
                              className="text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                              title="Delete Order"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <button 
                              className="text-gray-400 hover:text-gray-600"
                              title="More Actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedOrder === order.id && (
                        <tr key={`expanded-${order.id}`}>
                          <td colSpan={8} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-2">
                              <h4 className="font-medium text-gray-900">All Products</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {order.products.map((product, index) => (
                                  <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="font-medium text-gray-900">{product.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                          <input
                                            type="number"
                                            value={product.quantity}
                                            onChange={async (e) => {
                                              const newQuantity = parseInt(e.target.value) || 1;
                                              const updatedProducts = [...order.products];
                                              updatedProducts[index] = {
                                                ...product,
                                                quantity: newQuantity,
                                                totalPrice: newQuantity * product.pricePerUnit
                                              };
                                              const newTotal = updatedProducts.reduce((sum, p) => sum + p.totalPrice, 0);
                                              
                                              try {
                                                await updateClientOrder(order.id, {
                                                  products: updatedProducts,
                                                  totalAmount: newTotal
                                                });
                                                
                                                // Send automatic notification about calibre change
                                                await addCommunicationNotification(
                                                  `Product calibre updated in order ${order.orderNumber}: ${product.name} quantity changed to ${newQuantity} ${product.unit}`
                                                );
                                                
                                                toast.success('Product calibre updated successfully');
                                              } catch (error) {
                                                console.error('Error updating product:', error);
                                                toast.error('Failed to update product calibre');
                                              }
                                            }}
                                            className="w-16 px-1 py-0.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                            min="1"
                                          />
                                          <span className="text-sm text-gray-600">{product.unit}</span>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-medium text-gray-900">{formatCurrency(product.totalPrice)}</p>
                                        <p className="text-sm text-gray-600">{formatCurrency(product.pricePerUnit)}/{product.unit}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {order.notes && (
                                <div className="mt-4">
                                  <h5 className="font-medium text-gray-900 mb-2">Order Notes</h5>
                                  <p className="text-gray-600 bg-white rounded-lg p-3 border border-gray-200">{order.notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredOrders.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
                <p className="text-gray-600">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* New Order Modal */}
      <NewOrderModal />
      {/* Edit Order Modal */}
      {showEditModal && editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onClose={() => {
            setShowEditModal(false);
            setEditingOrder(null);
          }}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
};

export default CommandeClient;
