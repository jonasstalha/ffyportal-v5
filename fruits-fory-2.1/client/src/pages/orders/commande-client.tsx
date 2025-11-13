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
      console.log('ğŸ†• handleSubmitNewOrder called - Creating new order...', newOrder);
      
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
        console.log('ğŸ“‹ Order created successfully:', createdOrder);

        // 2) Create linked lots (production + quality) and archived QC lot
        let productionLotId: string | undefined;
        let qualitySharedLotId: string | undefined;
        let qcLotId: string | undefined;
        let wasteTrackingLotId: string | undefined;
        let newEntryLotId: string | undefined;
        
        try {
          console.log('ğŸš€ Starting lot creation process...');
          alert('ğŸš€ Order created! Now creating lots: ' + createdOrder.orderNumber); // Test alert
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

          console.log('ğŸš€ Starting lot creation process for order:', lotNumber);
          
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
            console.log('ğŸ“¦ Creating production lot...');
            productionLotId = await sharedLotService.addLot({
              lotNumber,
              status: 'brouillon',
              type: 'production',
              productionData: defaultProductionData
            } as any);
            console.log('âœ… Production lot created:', productionLotId);
          } catch (error) {
            console.error('âŒ Failed to create production lot:', error);
          }

          try {
            console.log('ğŸ”¬ Creating quality shared lot...');
            qualitySharedLotId = await sharedLotService.addLot({
              lotNumber,
              status: 'brouillon',
              type: 'quality',
              qualityData: defaultQualitySharedData
            } as any);
            console.log('âœ… Quality shared lot created:', qualitySharedLotId);
          } catch (error) {
            console.error('âŒ Failed to create quality shared lot:', error);
          }

          try {
            console.log('ğŸ“‹ Creating QC lot...');
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
            console.log('âœ… QC lot created:', qcLotId);
          } catch (error) {
            console.error('âŒ Failed to create QC lot:', error);
          }

          try {
            console.log('ğŸ—‘ï¸ Creating waste tracking lot...');
            alert('ğŸ—‘ï¸ Creating waste tracking lot: ' + lotNumber); // Debug alert
            wasteTrackingLotId = await sharedLotService.addLot({
              lotNumber: `${lotNumber}`,
              status: 'brouillon',
              type: 'dechets',
              dechetData: defaultDechetForm
            } as any);
            console.log('âœ… Waste tracking lot created:', wasteTrackingLotId);
            alert('âœ… Waste tracking lot created with ID: ' + wasteTrackingLotId); // Success alert
          } catch (error) {
            console.error('âŒ Failed to create waste tracking lot:', error);
            alert('âŒ Failed to create waste tracking lot: ' + (error as Error).message); // Error alert
          }

          try {
            console.log('ğŸ“ Creating new entry lot...');
            newEntryLotId = await multiLotService.addLot(defaultNewEntryData);
            console.log('âœ… New entry lot created:', newEntryLotId);
          } catch (error) {
            console.error('âŒ Failed to create new entry lot:', error);
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
                    <option value="status:processing">ğŸ”„ Mark as Processing</option>
                    <option value="status:shipped">ğŸšš Mark as Shipped</option>
                    <option value="status:delivered">âœ… Mark as Delivered</option>
                    <option value="status:cancelled">âŒ Mark as Cancelled</option>
                    <option value="delete">ğŸ—‘ï¸ Delete Selected</option>
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
                                  `ğŸ”„ Order ${order.orderNumber} status updated to ${newStatus} for client ${order.clientName}`
                                );
                                toast.success(`Status updated to ${newStatus}`);
                              } catch (error) {
                                console.error('Error adding notification:', error);
                              }
                            }}
                            className={`flex-1 text-sm font-medium border rounded-lg px-3 py-2 ${getStatusColor(order.status)} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                          >
                            <option value="pending">â³ Pending</option>
                            <option value="processing">ğŸ”„ Processing</option>
                            <option value="shipped">ğŸšš Shipped</option>
                            <option value="delivered">âœ… Delivered</option>
                            <option value="cancelled">âŒ Cancelled</option>
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
                          ¨ƒx‹Å0‰[Şl¨dC•ŒH–x‹
ÒR2LÈĞ%6%"dÆ$=0úBÕô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîõ·®ÿótz¼ü†uõC£††İ6Œ›‹”˜¨ƒÔ%â%Ø\…š(ì±z2{kAÓØ£ë8ù¯÷JÊ•šÂ~ã¸6M2)¸t`W§áE÷Œİz%ì\°ª)_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎN«^˜“ÄM Òíz?ºİW„­vÂFM‰ú2düØ‚aKpÉöæiØâìÏ•ˆø3kà69'±)Sá½g—ë—˜­Y%ijV<Í.¢€Ôp<S®SUÆ,;¾™«­$.q3Tír|ÊPŠÇge¹#ğ&*ıhÁùgäëR<^.#¹ÒsZG‡wºG|Å+˜Q¤ãõî1{¥àvòPÁ[ôëöèÕµØòËuH¥5dÀc!èKÒHAcÑ>¢¦YÏ”<ÆB)>o˜kĞÖNµ/äù¬¬`nr
œæP2÷£ç2ŠFÊùñø‹^“»1L¢‹+(l÷j;z}æ’Ğ¤BOİc9¥]N÷\x;2))ÖSRWš(ÌŸYÚ± ›æŒª‡	>p×‹ŸÔ¡êêßÉg¬q°[›ä ¹NØ·é9zƒŸ®†»‹CE¨ …EÛ¿añEH@õÏ"…‡Ëç¡Tà(Ïë°–—Ôºá6R¨Ì'xïÓÓ £#FyÍŠsTß¤ ËÔåL€’`-8ñk´Ü&;²¥ë—½V	‹<—MoCÑfE‰Ú¢uİ%ÊüÄ†*æ¶5-8|áâ3iSğ)·äŒÓt*ØÕŒÄj­\èp&Y1´(¯.1jˆÎ+—€‚Ùê¥´fˆ4›8Õ»ÈáÇåç)"pFREÏ¶«x)¿„çİùàúĞ²=té‚‘–ËÕØqG›€TR–Ï¢¯ÃÑ’/Ëé @!² ô†÷Ü‰¦	U1èê“1©»Íª”°óŞ®¯Şô;4[§ÁÅOSÚ3$æG¿ˆäxÕ õ'ù=}®\c’Q6C¹*;/ŒßâìvãÚŠõ…[íY³fBe<Ôæ£?—ŠÉnîòKÓ’"SŞwº"tİX©-GpÌ
©-•Mq=–|ûB—°‘Ò€¢K'd|xùüÛ!ApTe ˆ…ê3öSù½'^	²²	“yÀ fxL˜vøÁma”Ğp2›çÄ¨ëRlG¿”^Û¯à‹Ô¸›¼~&CZì3Š½¨•QÅüî0ª_…S¯æsvGÔosÂê0ìãÂºc”UÈ!4çFÙŞ#h¦0êÎÀ„~Å8â¿¶ijR@À¹N-ºr[~ ì˜…¨”gÂ—	ƒG1-BKŒ˜mU‰]=„/œ¢ì6U¹`¡7v§‘tUÀúGtaî¦ËlÑ'î¦"í*, â-ş!û#3öJKy2ü‘' ï•óùo+•œ(0*ë‡ÙTƒ	‡İÛ&<·c±v?
YªØã¥ö&|­2±ëŞŒ¢Ñ½äC2îK’Ğ’éX±{¿P½ƒÛœ¤÷ ÜÜî– ƒ§üôÔ_~3¥C„ÊË£A†?U¾w¥-Û¥Rû~3}¹otS¾rÚQTËÂ€Ä‘ìò»ŠxPÿğ¤ÚÌ„|€(”v–uÙ+„èÖuÛg}’±w»õ€“ÿQ/ëş0éµÎ«4`¸ºñik‰Ş©“{qã9ãa¹ÊD2zUîg¢®%#¨âu˜çá È4¬¨4²˜·¶ô
ÅYnÅ,’'¿Y,Q¶s‚^ A)-§–EfÈ2.Rg¡;Ş©h‰g³ÇŠ)|øqY?F»±7Ïö(ŠEXÖ„avşÖ U§ÅÎ Ì‚||ƒÊ,Å¥Lí"IY% ñ$&ïî›´Ó“ÛÆ "z.UŸ@ğ¾ûİL=şÌ?_L¿êOğ¸ûŞ¨¾Ïº¿\«6T»¼¿¸Oöc— ¿™Ne	ôhëÏNN‹‚È‘	EA0ûÇ.§ôûÿ$»®Ã»Ş³yùòµ\ç~S'ªöÕÚ¿:¾mKŸ’ #HI‰?¹ì&6faòè3ë\¼¾ “>íáöë¿hà›q{¼ŒX4äŠ»#ÆøéIşr·£Ï^®÷‚ñO…İ)JqÃñï7¹ã>øú^ü6¾\‹¾æ|N[RqVx‚ÅíUöNP%¶%œù`½—Î,k›Ğ¤“Ü†SJt"tfDÕ/øNº´ù>S›†ÎIJ1°ü»ş­úŒó¬,ñî+Ò¸»ÅÁ[|Éî-sœ+¦gH	KÁˆ(y•-Dä\àû(IÑ=}­bwö9bÿúm{«Å–ê0ÇÍ¹˜¹+ö¯Ïœ2Ñ8C½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hXôáÙ>½N#ÛıØä©ÎâwÊÙlAlå“{lò;kÜCÚ©‚`®öÕ€%÷×‡Ò€@§VYKl¥_ÃsûékA7µãÈ¦¨y*¨bı$#ÛÅ¸ÔÃ`›—^Saq·”“Ps›©‰·û}Ûõïz?­O–Ns	·¹ém)h™íFDE Qû¡ù¬.X¼“i´»N˜Š1LïğÛÒÌ­$¤y–LÑ¡s97ZTœ†s½#ææT½ ˆ÷Ğ{Õıù=¨ı	H}ª™ß`¼É¶×­·æ ÏoÇŸîsñú‹œø–·]$£®-Ø’yd£ Ğw¦YÖA™
ñº9ïÅ&³ZèfĞÁBê&°u(®`½•N{äÁ÷Ù4;+a&Ü†áW}ÍÀ[=tü”Ş/¹{Íª~¡Ïä3¾I|Q<iI$?‡¯¹C.O"Š ¸§Uu`FGå	j=ÕÔ×C,vÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†ÖVA'™+cµZšYºÏ(±Y,[šFÆ,+¢—v=öîÛÂ… ½<ƒ.có\åy´ì<–lBYÈÉILñ+’f:{8|2cú"¼Ìm-› ‚ÖşbOoÃMºGÌÏl"àÓÿï)­dúù·Ä×Ûfè• ¯ŒıXÙå1LÈ!QkT‘’¾"v{Å¦Ö8/M­’gĞÖA+Og®Ø,½ÃNk+Ü™–‘"ËëÏ³îJäÿ±~¯’“ª1nóÈ0ìdV(ûo$Ú¢Á‡mİFz½ VÉ9Q¶ii2áwäaeÏïÛà”¹Ôè
Ît¿?ËÜ·à€õÏÍq¨aÛ£¤€¼ÛX7éDqƒ»>°¿iT¨ ˆS_fŞUì(Ş¯àÁ~şÏÍÎpÎÍŒ°œš‰0 İn×°ÎÓnÆ!æiºqXš ¨Å‡ïÊÊbtXñ7û¾Šf>¡5n¸™ò›ƒ8¼UÒ`o’‡ú(£u/øİ„@=Áÿì]*äaj7–éRúÂ²äÉº[’W£Ô†Æı’Æê,|âb²yy%´g®7S)ÊXkºŠ˜Ë² ¶D™ÑtÀÊ§÷Ô¼«(bb÷[@€Ã¼¹Œ€é¯A½ïÛÕ´²õ­¬~@Ãˆ²ßÙ×ø¡EO›uªDŒ›€ë£kP.Ùã+$î„R]½'570èÛğ±¯¹„º @¹ßØ'Ü´~6[§üaìŠÑø$îä½\ôÙ{Õ¾ ò'Ò<^aŞ¶R·C»!9·®Â9ğtò°Š]ùUsìÔâ2Ig°ÄıÄ²UÊÁzÉQ{Óˆ²×r,bt–¡ã>İC*K€‡è]'[º„Ü³.Q×ùXÓ«BTzúåuĞŞ%&¥ÕF€üÇâr÷#©’¹¹¢O[±°“QšyĞu²TyÌÖu\™ee•ğ©£õä¬ipÿa–®ÿÚà¡ôÎ—©ÁBéÎ˜4ˆ‰•ØĞ Kü#?jgÁùû¢#õö?4Å5t
sFlÃğïc­’F!<g«—RÚÏ#k®0á+Ÿà¥µÏ)&>3°iCĞLË¹|»pªîz%ø¨¥œáV.#Û£‡ç¯	ÒK’h×IW!_?…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?¬oÁ#Ê¦´ÅblÀà§Öyp;ÂjJßsøc~àïµóÓ2œg9™,ë•ßšİÔ£XODş³µF€¡¾ö-=jµXá¥veİ¥0„êX¦÷xhÍB3Vkk9ÈèZA¿ºZ‡Ëîä§¤HˆÌ”2ãnú6Ê#åÅÄÆh©¢†y]wîvõhqxö^½†-F~]ƒóÚÔT{¼ŸÉ—lİvÚ:ºx°ÛÄ´­œ‚ÜM¶qs+äè—ó×¸`!iS›ÉVŸ˜›Y¹wëTBÙå*9äê—ğYë‰¼©r×#0¡S0¹gÌj\P”ÃÖ‡(æ}>¿çÜrèÛ&åÉTqKe¿JÌY\hòÂ*É'²c‹v)@n'³V.bb/V{…³1wË©HT³‡ª]h¶Ax1…¼oó³2xˆdX’AÁX§&5]c‚%\Tîb­B6«X…nÆ²hA"	fi-	%ı}/Îd˜T”°p‡Şò"	gæq€ğßëì½¾çşï¿Ê§ğûòõÿ/³»ÌÄ£<öÏÙ>üÏúÛ¿ê¼ÁO÷õø³<ENÊCˆÈ™$@ûºúşö=¿®M³¿ş„²û
ğú­{®^s*3BnÊíÌ4µ_‚	RH@C:y*İ&"fšq·óÌ¸ªm_š8‹ö‚ı´½¸‹!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øû[ü€>8¢™Æôí8£ğ^X—µ-~Ğ ÎÂeJuù`9“aª›’“"“D"•§ƒåGğ˜œŸN.OÛ˜¸Ú5ü¼¹ú =øÄÛë4ğøã½ºÌòL´èŠ)s¨ª‡÷½H¼IK‹Û8¥9ò]³9Ñ1}-œëw–_E¼|?‹ûŒ¤ê {ëù@™ÍÆ{ïÜ€™8“©F>{Š×Ùn ¹« ŒƒØ¦¶d8¨	zôÍü®½cæK>˜³[ÀÅ«i„’­zlÉl¥QdW’lÈ2;GíŞd†“×¡!_‚pyA‚Ö	%4{h‹C1Î™kÁ?´§Ü¶)IKÏ°g$Ú$¨ğÓpŸ•ß‘ak—–¡“ºHç¿Û>½:ø»ÔKK7©Yí0ù8İ)f›\	á‰ûåÎşOôûÉ$­G¨ƒx‹Å0‰KŞl¨$”ŒH–x‹
Ò2LÈP%6%"dÆ$µ0úBÕô3ğ5]ÍZÈÑAuE0ì#.+O­ªÂîñ·®ÿót{¼ü]õAã††İ6Œ›‹”¨‚Ü%â%Ø\…š ìñz2{cAÑØ£ë¸ù¯÷JÊ•šÂ~ã´6M0)¸t`×§áU÷ˆİú%è\°ª)_Uª}@Şç¿÷Hè\Å6p	G¡<…¿3BÎN«^˜“ÕM Òíz?ºİG„íVÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø3kà69#±)Sá½g—ë·˜­Y%mjV<Ï.¢ Öp<S®SUÆ,;¶™«­$$qTír|ÊPŠÇce¹#ò&*ıhÁùgäûR<^.#©ÒsZG‡wºG|Å+˜Q´ãõî1{¥
àvòTÁ[ôëöèÕµØòËuX¥5dÑc!èJÒHAcÑ.¢¦Y×”4Æ)?{o˜cĞÖNµäø¬¬b.nr
œæP0÷£ç2ŠFÊûñø«^“º±Lâ‹+(l÷j;z}æ’Ğ¤BOc9¥]N÷\x2))ÒSRWš(ÌŸYÚ± ›æŒª‡>p×‹ŸÔ¡êëßÉg¬q°S›ä 9NØ¶é9zƒŸ®„»‹CE¨ …EÛ¿aóEH@õÏ"…‡ß§¡Tâ(ÏZë°–—Ôºá6RªÍ'yïÓÓ £#FyÍŠsTß¤ ËÔÅL€’`-8ñk´ü&;²¥ë—½V	‹<—MCÁfE‰Ú"uİ%ÈüÄ–*¦¶5=8\áâ3iSğ9·äŒÓt*ØÕŒÄz­èp&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4›8Õ»ÈáÇåç)"pFRE7Ï–«Fx¿„çİùàúĞ²=tí‚‘Ë•ØqG›€TR–Ï¢¯ÃÑ’/Ëé  !² ô†÷Ü‰¦	U1èê“1©»Íª”°óŞ®¯Şô;4[§ÁÍOSÚ!$æG¿ˆäxÕ ô'ù=}¬\c’Q6C¹*;/ŒßâävãÚ
õ…[íY³fBe<Ôæ£?—Š‰nÎòKÓ’"SŞvº"tßX©-GpÌ*©-•Mq=”|ûB—°‘Ò€¢K'tüxùüÛ!ApTe œ…ê3öSù½'^	²²	‘yÀ fxL˜vØÁmaĞp2šçÄ¨ëRlG¿”~Û¯à‹Ô¸›¼~&Czì3Š½¨•QÅüî2«O…S¯æ3vGÔosâj:0ìcÂºc”UÈ!0çFÙŞ#è¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[(”ì˜…¨”gÂ—)ƒG1mBKŒ˜mU©_=„¯œ¢ì6U¹`¡7v‡‘tUÀúgtaî¦ËlÑ'î¦"í*, â-ş!û#3¶JKY2ü‘'(ï•óùo«•œ(0*ë‡Ùtƒ	‡İÛ¦<·a±v?
YªØã%ö&|¬2¡ëŒ¢Ñ½ä2îK‚Ğ“éX±j­P½£Ûœ¤÷ ÜÜî–
 ƒ§üôÔO~?¥C„ÊË£A†?U¾†w¥-Û¥YZó~3}¹opS¾rÊQTËÂ€Ä‘ìò»ŠxP÷ğ¤ÛÌ„|„
(”vuÙ+”èÖuÛg}’±w»õŸ€“ÿQ/ëş0é5Î«4`¸ºñik‰Ş©“{qã;ãa¹ÊL2zUîg¢®%#¨âu¹çá È´¬¨4²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-¦–EfÀ2.Rg¡;Ş©h‰o³ÇŠ)|øqY?D»±7Ïö(ŠAXÖ„atşÖ Q§ÅÎ(Ì‚t|ƒ…Ê,Í¥Lí"IY% ñ$&Ïî›´Ó“ÛÆ "z.WŸPğ¾ûİL9şÌ_L¿êOğøûÜ¨¾Ïº¿\Œ«>T»¼¿¸Oöc— ¿™Ne	ôHëÏNN‹‚È‘	EA0ûÇ.‡ôûş$¹®Ã»Ş³yùòµ\ç~S§ªöÕÛ¿:¾mKŸÒ #HI‰?9ì&6faòè3ë\¼¾ Ó>ıáöë¿hà›ñ{¼ŒX4äŠ›#ÆøéIşv·£Ï^®÷‚ñG…İijqÃñï
7¸ã>øú^ü6¾\‹¾æ|L[RsVx‚ÅíTvnP'¶$œù`½Î,k›Ğ¤“ÜÆSJt"ufDÕ/øNº´ù¾S›†ÎIJ1°ü»ş­úŒó¬,ñî+Ò¸»Åá[|Èî)sœ+¦gH	KÁÈ8ù•-Dæ\ û(IÑ9}­bwö9bÿúo{«Å–ê0ÇÍ¹½/ö¯Ïœ2Ğ8K½HEJkˆ—“b&³¹ò‹Ó¦½Àø‘hXôáÙ>½N£ÙıØä©ÎâwÊ™lAlå“{lò;oÜCÚ©‚a®öÕ€%÷—‡Ò€B§VYKl¥_ÃsûécA7µãÈ¶¨y*¨bù$%ËÄ¸ÔÃ`›—\Saq·”“Ps›©ˆ·û}Ûõïz?­O–Ns	·¹ém)xÙíFDE Qû¡ù¬/Ø¼“i´»N˜Š1LïğÛÒÌ­¤šy–LÑ s97ZTœ†s½#ææT½ ˆ÷Ğ{Õıù=¨ıH}ª™ß`¼É¶×­·æ ÎoÇŸîsñúœø–·]$£-Ø’yd£ _Ğw¦YÖA™
ñ:9ïÅ&£RèfĞÁBê&°}(¾`½•N{äÁ÷Ù49+d&Ü†áW}ÍÀ[=tü”Ş/¹{Mª~¡Ïä#¿I|Q<éI%?‡¯¹C.G*Š ¸§Uu`FWí	j=ÕÔ×C,vÎle¬ĞtêØ1 nØëÀ—×9kê·h°ósñ†×A'™+cµZšºÏ(±I,[šFÆ,+¢–v=öî[Â…°½<ƒ.cÓ\åy´ì<–lBYÈÉILÑ+’f{8|2cú"¼Ìm)› ‚Öşâ_oÃMºGÌÏl"àÓÿï)­dúù·Å×Ûfà• ¯ŒıXÙå1LÈ!QkšT‘’¾#v{Å¤Ö8/O­’gĞÖA+Og¬Ø,½ÃNk+Ü‰–‘"ËëÏ³îJäÿ±~¿’“ª1nóÈ0ìdV(»o$Ú¢Á‡mİVz½ VI9MQ¶ii2áTwäaåOïÛà”¹Ôè
Ît¿?ëÜ·à€õÏÍu¨aÛ£¤€¼ÛX7éTqƒ»>Ï°¿iT¨ ˆS_fŞEì(Ş¯àA~şÏíÎpÎÍ„°œ‰0 Ùn×°ÎÓlÆ!æiºqXÚ ¨ÅÇïÊÊbtXñ>û¾Šf>¡5n¸™ò8½UÒ`o’‡ú(£u/øİ…@=Ãÿì]
Àaj7–éRûB²dÉº’W£Ô†Æı’Æê,|âc¢yy%´g®7S)ÊXKºŠË²$¶D™Ñ4ÀÊ§÷Öœ«(bb÷@€Â¼¹Œ€ë/A½ïÚõ´ºõ­¬z@Ãˆ²ßÙ×ø¡EO›uªDŒ›€ë£kP.ÙÃ=+¤î„R\½g5?0èÛğ±«¹„º @±ßØ'Ü´~6[§ôaìŠÑø&êd½\ôÙ{Õ¾ ò'ò<^aŞ¶V·C»!9»¦‡Â9ğtò°Š]	ùUsìÔâ2If¸ÄıÀ²WÊÁzÉQ{Óˆ²Wr,bt–¡ã>İG*K€‡è]'[º„Ü³.ÑÓøZÓ«9BTzúåuÔŞ%&…ÕF€üÇâr÷#©“¹¹¢O[±°“QšyĞu’TyÌÖu\™ee…ğ©£÷ä¬ipÿa–®ÿÛà¡ôŞ—©ÁBéÊ˜4ˆ•ØĞ Kş#?jgÁùë¢#õö>4Å5t
sFìÃğïc­ÒF!<g«—RÚÎ#k®0¡+Ÿè¥µÏ)$>3°iCĞLË¹|»pªîzø¬…œáW*#Û£Çç­	ÒK’h×IW!_/…'¼âş3±éhà¨w¦“eo Èº­àáÌ.?¬oÁ#Î¦´ÅblÀà§Öip;ÂjJŸsøC~àïµóÓ2œg)™,ë•ßšİÔ£XOÄş³µF€¡ºö-=jµØá¥veİ¥0„êX¦÷xlÍB3Vkë9ÈèZAŸšV‡Ëîä§¤HŒÌ”2ãnú7J#åÅÄÆl©¢†}]wîvõhqxö^ı†-N~]ƒóÚÔTz <ŸÉ—lıvÚzºx°ÛÄ½­œ‚ÜM–qs+ èŸ÷Ó¸`!iS›ÈVŸ˜›[¹wëTBÙå*9äê·ğYë‰¼©r×#0¡¯C0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&åÉTsKe¿JÌY\hòÂ*É'¢C‹v)@n'³V.bb/V{…³1wË©HT³‡ª]h¶A81…¼oó“³2xˆdX²AÁØ§&5]c‚%\tîb­B6«X…nÆ²hA"	fi-	%ı„}/Îd˜T”°1‡Úò"	fæq ğ×kì½÷şï¿Ê§ğûğõÿ/³»ÌÄ£<öÏÙ>üÏşÛ¿ê¼ÁO÷
uø³8ENÊCˆÈÙ$@ûºúşæ½¿®M³ÿş„²û
ğú{®^s*3BlËì
L4µ_‚	RH @C	:i*İ&"fša·óÌ¸ªm[š8‹ö‚ı´½ø‹!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¿‹Ê€ç ¹×éÏhú[¶î
!¸«øû[ıĞ>(¢™Æôm8£ğ^X—µ-~Ò ÎÂeHuù`9“Laª›’“"“F*•§ƒåGğ˜œŸN.OÛ˜¸Úüœ¹ú =øÄÛë4ğøã½ºÌòL´èŠ)s¨ª‡÷½H¼IK‹Û8…9òM³9Ñ1}-œëw–_U¼ü?‹ûŒ¤ê {ëù@™ÍÆ{ïÜ€™8“©F>{Š×Ùn ¹« ŒƒØ&¶d8¨	zôÍü®=cæK>˜³KÀÇ«i„’­zlÉl¥lW’lØ2;GíŞ’$†“×¡!_¢p}AÖ	%4{h‹C1n™kÁ/´§Ü¶)ÉKÏ°g$Ú$¬ğÓpŸ•ßak–±“êç¿Û>½:ø»ÔKK7©Yí0ù8İ)f›\)á‰ûåŞşOôûÉ$­G¨ƒx‹Å0‰[Şl¨$”ŒH–x‹
ÒR2LÈĞ%6%"dÆ$µ0ú‰BÕô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîù·®ÿótz¼ü–}õCã††İvŒ›‹”¨‚Ô%â9%Ø\…š(ìñz2{kAÑØ£ë8ù¯÷JÊ•šÂ~ãğ6M2	¸d`×§áE÷ŒÜú%ì\°ª)_Uª}@Şç¿÷Hè\E6pG¡<…¿3CÎN»^˜“ÕM Òí:?ºİW„ívÂFM‰ú2düØ‚aKpIöæiØâäÏ•ˆø3kà69'±)Óáœ½g—ë—˜­Y%mjV<Í.¢€Ôq<S®WUÆ,;¶™«­$,q3Tír|ÊPŠÇce¹#r&*ıhÁÙgäùR<N,#©ÒsZG‡wºG|Å+˜Q¤ãõì1{¥
àvòPÁ[ôëÖêÕµØòËuX¥5dĞc!ÊKÒHAcÑ.¢¦YÇ´4Æ)>o˜gĞÖNµäø¬¬bnr
œæP6÷£ç2ŠFÊûõø»^“º1L¦‹+(l÷j;z}ä’Ğ¤BOc9¥]N÷\x2))ÆSPWš(ÌŸYÚ± ›æŒª‡	>p×‹ŸÔ¡êëÏÉg¬q°[›ä ¸NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿añEHP÷Ï"…‡Ïç¡Tà*ÏZë°–—Ôºá6RªÍ&xïÓÓ ã#FyÍŠsTß¦ ËÔåL ’`-8ñk´ü&;²¥ë—½V	‹<—MoCÁfE‰Ş¢uXİ%ÊüÄ—.¦¾5)8|áâ3iSà9§äŒÛt*ØÕœÄz­èp&Y1´(ï.1jˆÎ+—‚Ùê¥´bˆ4™8Õ»ÈáÇåç)"pFREÏ¶«x+¿„çİùàúĞ°=tí‚‘–ËÕØqG€TR–Ï¢¯ÃÙ’/Ëé  !² ô÷Ü‰¦	U1èê“1©»Íª”°òŞ®¯Şô;4§ÁÅOSÚ!$æG¿ˆäxÕ õ'ù-}¬\c’Q6C¹*;/ŒßâìvãÚ
õ…[íY³fBeÔæ£?—Š‰nîòKÓ’"SŞwº"tßX©-GpÌ*©-•Mq=”|ûB—°‘Ò€¢'t|xùüÛ!ApTe È…ê3öSù½'^	²²	‘yÀ fxL˜vØÁmaØp2›§Ä¨ëRlG¿”|Û¯à‹Ì¸›¼~&CZì3Š½¨•QÅüî2ª_…S¯ç3vGÔosâj0ìãÂºc”UÈ!4çFÙŞ#è¦°êÎÀ„~Å<Lâ¿¶ijR@À¹N-ºr[~ ”ì˜…¨”gÂ—+ƒG1mBKŒ˜mU‰]=„/¢ì6U¹`¡7v§‘tUÀúgtaî¦ËlÑ'î¦"í*,¢â-ş!û#3öJKY2ü‘' Ï•óùo+•œ(4*ë‡ÙPƒ	­‡İÛ¦<·c±v?
Y¢Øã%ö&x¬2¡ëŞŒ¢KÑ½äC2îK‚Ğ—éX±z½P½ƒÓœ¤÷ ÜÜn–Š “§üôÔ_~3¥C„ÊËƒAÆ?U¾†w¥-Û%^ó~;}ùot[¾rÚQTËÂ€Ä‘ìò»ŠpP÷ğ¤ËÌ„|„(”v–uÙ+„éÖuÛg}’±w;õŸ€“ÿQ/ëş0é5Î«4h¸ºñik‰Ş©“{qã;ãA¹ÊL2zUîg¢®%#¨âu™çÁ È´¬¨<²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-¦–EfÈ2.VgÍ¡;Ş©h‰o³ÇŠ)|øqY?D»±7Ïö(ŠEHÖ„avşÖ U§ÅÎ Î‚tlƒ…Î,Í Lí"IY% ±$Ïî›´”Ó“ÛÆ "z.WŸ@ğ¾ûİL=şÌ?_L¿êOğøûÜ¨¾Îº¿\Œ«6T»¼¿¸Oöc— ¿™Ne	ôHëÏNN‹‚È‘	EA0ûÇ.§ôïş$¹®Ã»Ö³yùòµ\ç~S§ª	öÕÚ¿:¾mKŸÒ #HI‰?¹ì66faòè3ëÜ¼º Ó>íáöë¿hà›ñ{¼ŒX4äŠ›#ÆøéIşr·£Ï^®÷‚ñG…İ)jqÃñï
7¹ã>øúü6¾\‹¾ætL[RqVx‚ÅíTvNP%¶%œû`½—Ş,kĞ¤“Ü†SJt"ufDÕ/øNº´ù6S›†ÎIJ1°ü»ş­úŒó¬(ñî+Ò¸»Åá[|Èî)sœ+¦gJ	KÁˆ8y•-Dâ\ û(IÑ9}­bwö9bÿú{¯Å–ê0ÇÍ¹½/ö¯Ïœ2ÑxC½H"EJkˆ—“b&³¹ò‹Ó¦½Àø™hXôáÙ>¼N#ÙıØä©ÎâwÊlAlå“{lò;oÜCÚé¢`®öÕ %××‡Ò€B·VY[m¥_ÃsûécA7µãÈ¶¨y*¨bı$%ËÄ¸ÔÃ`›—\S`q·”“Ps›©€·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼“i´»NˆŠ5LïğÛÒì­$¤y–LÑ sy7ZTŒ†s½#ææT½ ˆ÷Ğ{Õıù=¨ı	H}ª™ß ¼I¶×­·æ ÎoÅŸîsñúœøµ]$£=Ø’yd£ Ğw¦YÖA™
ñ:¹ïÅ&³ZèfĞÁBê&°}(¾`½•N{äÁ÷Ù69+a&Ü†áW}ÍÀ[=tü”Ş/9{Íª~¡Ïä3¿I|Q<iI3%?‡¯¹C.O*Š ¸§Uu`FGíj=ÕÔ×C,vÎle¬ĞtêØ3 nØëÀ—×yKê·h°ósñ†ÖA'™+cµZšYºÏ(±Y,[šFÆ,+¢–v=öîÛÂ…°½<ƒ.cñ\åy´ä<–LBYÈÉILÑ+’æ{8|2cú"¼Ìm)» ‚Öşb_oÃM¸GŒÏl"àÓÿï)­.dúù·Å×[fè• ¯ŒıXÙå1LÈ!QkT‘’¾"v{Å$Ö8/M­’gĞÖA+Og¬Ø,½ÃNk+Ü‰–±"Ë«Ï³îJäÿ±~¯“ª1nóÈ0ìd(ûo$Ú¢Á‡mİFzı ^I9Q¶ii2áwåAeÏïÛà”¹Ôè
Ît¿?ËÔ·à‚õÏÍu¨aÛ£¤€¼ÛX7éTqƒ»>°¿iT¨ ŠS_fÚEì(Ş¯àA~şOíYÎpÎÍ„°œ™0 Ñn×°ÎÓlÆ!æi»AXÚ ¨ÅÇ1ïÊÊbtXñ6û¾‹f>¡58n¸™ò8½UÒ`o’‡ú(£u/øİ…@=Áÿì]*Äaj7–ùRúB²dÉº[’W£Ô†Æı’Æê,|âb²yy%´g®7S)ÊZkºŠ˜Ë²$¶D™‘4ÀÊ§÷Ö¼«8bf÷@€Ã¼¹Œ€ë¯A½ïÚõ´ºõ­¬z@Ãˆ²ßÙ×øEo›uªDœ›€û#kP.Ù!ã=+¤î„R\½g570èÛğ±«¹„» @±ßØ'Ü´~6[§ôaìŠÑú&îd½\ôÙ{Õ¾ ò'ò<¯_aŞ¶R·»!9¿¦Â9ğtò°Š]IùUsìÔâ2Ig¸Äı@²WÊÁzÉQ{Óˆ²×r,bt–¡ã:İG*K€‡è]'[º„Ü“.Q×øZÓ«BT=zúåuĞŞ%&¥ÑF€üÇâr÷#©’¹¹£[±°“SšyĞuTyÌÖu\™ea•ğ©£÷ä¬ipÿa–®ÿÛà¡ôŞ—©ÁBéÊ˜4ˆ‰•ØĞ Kş#?jgÁùë¢#õv?4Å5tsFlÃğïc­ÒF g«—RÚÎ#k®0¡+Ÿè¥µÏ­$>3°iCĞLË¹|»pªÎz%ø¼…œáV.#û£Ççí	ÒK’h×IW!_?…'¼âş3±éhà¨w¦“eoÈº½àáÌ.?®oÁ#Î¦´ÅblÀà§Öip;ÂjJŸsøC~àïµóÓ2œf)™,ë•ÛšİÔ§XODş³µF€¡ºô-=jµØá¥6uİ¥0¤êX¦÷xlÍB3Vkk9ÈèZAŸºV‡Ëîä¥¤HŒÌ”2ãnúÎ#å…ÄÆl©¢†]]wîvõ`qxö^ı†-F~]ƒóÚÔUz ¼ŸÉ—lıvÚzºx°ÛÄ´­œ‚ÜM¶qs+ èŸ÷×¸`%aS›ÉVŸ˜›Y¹wëTBÙå*9äê·ğYê‰¼¹r×#0©C0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&åÉTqKe¿JÌI\…hòÂ*Ë'²c‹v)@n'3V.bb/V{…³1w‹©T»‡ª]h¶Ax1…¼oó³2xˆd²ÁÁX§&5]c‚%\Tîb­B6«X…nÆ²hA"	fi-	%ı„}/Îl˜T”°0‡Úò"	fæq€°ßkì½÷şï¿Ê§ğûòõÿ/³»ÌÄ£<öËÙ>üÎúÛ¿ê¼ÁO÷
õø³<UNÊCˆÈ™$@ûºúşoö9¿®O³¿ş„²û
ğú{¯^s*BnËì
Ì4µ_‚	RH @C:y*İ&"fšq·óÌ¸ªm_š8‹ö‚ı´½ø‹!Õ ?8¸š›¬´¸8™ãUR\úEíëp¾‹Ê‚ç ¹×éÏhú[¶î
!¸«øû[ı€>(¢™Æôm8£ğ^X—µ-~Ğ ÎÂeIuù`9“áª›’“&“F"•§ƒåGğ˜œŸN.OÛ˜¸Òü¼¹û =øÄÛë4ğøã½ºÌòL´èŠ)s¨ª‡÷½H¼IK‹Û8¥9òM³9Ñ1}-œëw–_U¼ü?‹ûŒ¤ê {ëy@™ÍÆ{ïÜ€™8“©F>{Š×Ùl¹« ŒƒØ&¶ä<¨	zôÌü®=cæK>˜³KÀÅ«i„’­zLÉl¥LW’lÈ2;GíÎ’d†ƒ×!_‚pYA‚Ö	%4zh«C1î™kÁ/´§Ü¶)IKÏ°g$Ú$¨ğÓpŸ•_‘ak7–¡“êHç¿Û>½:ø»ÔKK7©Yí0ù8İ)f›\	á©ûåÎşOôûË$­G¨ƒx‹Å0‰[Şl¨4”ŒH–x‹
ÒR2LÈP%6%"dÆ$µ0ú‰BÕô3ø5]ÍZÈÑAeE0ì#.+G­ªÂîù·®ÿótz¼ü†}õC#††ß6Œ›‹”¨‚Ô%â%Ø\…š ìñz2{kAÑØ£ë8û¯÷JÊ•šÂşã°6M2)¸t`×§áE÷Œİú%ì\°ª)_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎN«^˜“ÕM Òíz?úİG„ívÂFM‰ş2düØ‚aKpIöÆiØâìÏ•ˆø3kà69'±)Sá½g—ë—™­Y%mjT<Í.¢€Ôp<S®SU†,;¶™«­$,q3Tír|ÊPŠÇce¹#ò&*ıhÁùgäûR<N.#©ÒsZG‡wºG|Å+˜Q¤ãõÌ1{¥
àvóTÁ[ôëÖêÕµØrËuX:¥5dĞc!ÊKÒHAcÑ>¢¦YÏ´4ÆB)>o˜cĞÖNµäø¬¬`nr
œæP2÷ëç2ŠFÊùñø»^“º1Lã‹+(l÷j;z}æ’Ğ¤BOc9¥]N÷\x2))ÒSRWš(ÌŸYÚ¡ ›æª‡	>p×‹ŸT¡êëßÉg¬q°[›ä ¹NØ·é9~ƒŸ®„»CE¨ …EÛ¿aóEH@õÏ"…‡Ïç¡Tà(ÏZë°–—Ôºá6RªÍ'|ïÓÓ ƒ#FyMªsTß¦ ËÔåL€’`-8ñk´ü&;²¥ë—½V	‹<—McÁfeˆÚ¢uİ%ÊüÄ–*¦¶5-8|áâ3iSğ)·æŒÓt*ØÕœÄj­è0&Y1´(ï.1jˆÎ+—‚Ùê§´fˆ4›8Õ»ÈáÇåç)"pfBEÏ¶«Fx+¿„çİıàú…Ğ²=tí‚‘–ËÕØqG›€TR’Ï¢¯ÃÙ’/Ëé @!² ô†÷Ü‰¦	U1èî“1«»Íª”°óŞ®¯Şô;4§ÁÅOSÚ#$æG¯ˆ¤xÕ õ'ù=}¬\c’Q6C¹*;/ŒßâìvãÚ
õ…[í³fJe<Ôæ£?—š‰nÎòKÓ’"SŞwº"tßX©-G°pÌ*©=Mq=”|ûB—°‘Ò€âK'tüxùüÛ#ApTm Ì…ê3öSù½'^	²²	‘yÀ fxL˜vøÁmaĞp2›çÄ¨ëRlG¿”~Û¯àÔ¸›¼~&CZì3Š½¨•QÅüî2ª_…S®æsvGÔosâj0ìãÂªc”UÈ!4çFÙŞ#è¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[ ”ì˜…¨”gÒ—)ƒG1-BKŒ˜mU‰]=„-¢ì6U¹`¡7v§‘tUÀúgtaî¦ËlÑ'î¦"í*$ â-ş!û#3öJKY2ü‘' ï•óùo+•œ(0*ë‡Ùtƒ	‡İÛ¦¼·a±v?
YªÜã%ö&|­2¡ëŞŒ¢Ñ½äC2îO’Ğ³éX±"j½P½ƒÓ¤÷ ÜÜî–Š ƒ§üôÔ_~7¥C„ÊË£a†?U¾†w¥-Û¥	Zó~;}¹otS¾rÚQTËÂ€™Ä‘Œò»ŠxPÿğ¤ÛÌ„|„
(”v–uÙ+„èÖuÛg}’±w»õŸ€—ÿQ/kş0éµÎ«4`¸ºñik‰Ş©“qã;ãa¹ÊL2zUîg¢®%#¨âu™çÁ ê4¬¨4²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÀ2.VgM¡;Ş©h‰o³ÇŠ)|øqY?D»±7Ïö(ŠEXÖ„avşö UçÅÎ(Ì‚t|ƒ…Ê,Í¤Lí"IQ% ±$&Ïî›´€Ó“ÛÆ "z.UŸ@ğ¾ûÙL=şÌ?_L¿êOğøûÜ¨¾Ïº¿\œ«6T»¼¿¹Oöc— ¿™Ne	ôhëÏNN‹‚È‘	EA4ûÇ.‡ôûş$».Ã»Ö³yùòµ\ç~S§ªö•Ú¿:¾mKŸ’ #HI‰?¹ì&6faòè3ëÜ¼º Ó>ıáöë¿hà›ñ{¼ŒX4äŠ›#ÆøéIşv·£Ï^®÷‚ñG…İ)jqÃñï5¹ã>øú^ü6¾\‹¾ætL[RqVx‚ÅíTvNP%¾%œùb½Ï$k›Ğ¤“Ü†SJt"ufDÕ?øNº´ù>S›†ÎIJ1°ü»ş­úŒó¬(ñî+Ò¸»Åá[|Èî)sEœ+¦gI	IÁˆ8y•-Dæ\ û(IÑ=}­bwö9bÿúo{«Å–ê0ÇÍ¹¹+ö¯Ïœ2ÑxC½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hXöáÙ>¼N#Û½Øä©ÎâwÊ™lAlå“{lò;ÜCÚ©‚`®öÕ€%×—‡Ò€B§VYKl¥_ÃsûécA†7µcÈ¶¨y*¨bé$'ËÄ¸ÔÃ`›—\Saq·œÓPs›©€·û}Ûõoz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼“i´»N˜Š1LïğœÛÒÌ­$¤y–LÑ s9wZT†s½#ææT½ ˆ÷Ğ{Õıù=¨ı	H}ª™ß`¼É¶×­·æ ÏoÅ—îsñúœø–·]$£®.=ø’yd£ Ğw¦YÖA™ñ:9ïÅ&£ZèfĞÁBê&°}(¾`½•N{äÁÇÙ69+a&Ü†áw}ÍÀ[tü”Ş/¹ûÍª~¡Ïä3¿I|Q<iI%'‡¯¹G.O"Š ¸§Uu`FGí *=ÕÔ×C,vÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†ÖVA'™+cµZšºÏ*±Y,[šFÆ,+¢–v=öî[Â…°½<ƒ.có\åy´ì<–LBYÈÉILÑ+’f{8|2cú"¼Œm)› ‚R¾b_WoÃMºGLÏl"àÓÿï)­dúù·Å×Ûfèµ ¯ıXÙå1Dˆ!QkT‘’¾"v{Å¤Ö8/M¬’gĞÖA/Og¬Ø,½ÃNk+Ü™–‘"Ë«Ï³îZäÿ±z¯’“Š1nóÈ0ìd(ûo$Û¢Á‡mİF>½ VI9Q¶ii2áwäaeÏïÛà”¹ôè
Ît¿?ëÜ·à€õÏÍq¨aÛ£¤€½ÛX7éTqƒ»>°¿iT¨ ˆS^fÚEì(Ş¯àA~şÏíÎpÎÍ„°œ‰0 Ùn×²ÎÓlÆ!æiÍºqXÚ ¨ÅÇïÊÊbtXñ7û¾‹f>¡5<n¸™ò8½UÖ`o’‡ú(£u/øİ…@=Ãÿì]*Äah7–éRúB²dÉº’W£Ô†Æı’Æê,|âc²yy%´e¬?S)ÊXkºPŠË²$¶D™Ñ4ÀÊ§÷Ö¼«(bf÷@€Ã¼¹Ì€ë/A½ïÚõ´ºõ­¬z@Ãˆ6ßİ×ø¡EO›uªDŒÛ€ë£kP.Ùã={¤î„R\½g57pèÛğ±«™„º @±ßØ'Ü´~6[§ôaìŠñú&îd½\ôÙ{Õ¾ ò'ò<¯^aŞ¶R·C»!9¿®Â9ğtö°Š]	ùUsäÔâ2Ig¸Äı@²WÊÁrÈQ{Óˆ²Wr,bt–¡ç>İG*K€‡è]'[º„Ü“.Q×èXÓ«BTrúåuĞŞ%&¥ÕF€üÇâr÷#©’9¹¢O[±°“QšyĞu’TyÌÖu\™ee•ğ©£÷ä¬ipÿa–®ÿÚà¡ôŞ—©ÁBéÊ˜4˜‰•ØĞ Kş#?jgÁùë¢#õv?4Å5t
SFlÃğïc­ÒF <gª—RÚÎ#k®0¡+Ÿè¥µÏ)$>3°yCĞLË¹|»pªîz%ø¬…œáV.#û£‡§­	ÒK’j×IW!_?…'¼âş3±éhà¨w¦“eoÈº­àáÌ.?¬oÁ#Î¦´ÅâlÀà§Öip:ÂjJßsøc~àïµóÓ2œg)™,ë•ÛšİÔ§XODş“<µFÀ¡º÷-=j½Øá¥veİ¥0„êX’¦÷xlÍB3Vkk9ÈèZC¿ºV‡Ëêä§¤HŒÌ”2ãnúvÊ#åÅÄÆl©¢†}]wÎvõZèqxöı†-F~]ƒóÚÔT{ ¼ŸÉ—lİvÚzºx°ÛÄ´­œ‚ÜM¶'qs# è—÷×¸`%aS›ÉVŸ˜›Y¹wëTBÑå*9äê·ğYë‰¼©rß#0¡«C0¹gÌj\P”ÃÖ‡(æq>¿çÔsèÛ&õÉTqKe¿JÌY\hòÂ*É'²c‹v)@n'³V.bb.V{Å³1uË©T³‡ª]h¶Cx1…½oó³2xˆdX²ÁÁX§&5]c‚%\\îb­B6«X…oÆ²hA"Fi-	ı„}/Îd˜T”°0‡Úò"	fæq€ğßëì½¾÷şï¿Ê§ğûğõÿ/³»ÌÄ£<öÍÙ>üÏúÛ¿ê¼ÁOÿ
uø³<ENÊCˆÈ™$@ûºúşæ=¿®M³ÿş„òû
ğú{®^s*3BnËì
Ì4µo_‚	RH @C:y*İ&"fšq·óÌ¸ªm[š8‹ö‚ı´½ø‹!× ?8¸šŸì´¸¸™ãUR\úDïëp¿‹Ê‚ç ¹×éÏhû{¶î
!¸«ğû[ıÀ~(¢™Æüm8£ğ^H—µ-~Ò ÎÂaXuù`9“a*›’“"“F#•§ƒågğ˜œŸN.OÛ˜¸Úü¼¹ú =øÄÛë4ğøã½ºÌòL´èŠ)s¨ª‡÷µH¼IK‹Û8¥9òM³)Ñ1}-œëw–_U¼ü‹ûŒ¤ê {«y@™ÍÆ{ïÜ€™8“©F>{Š×Yn ¹« ŒƒØ&¶d<¨	zôÍ|®=gæK>˜	³[ÀÅ«i„’­zL‰l¥dW’lÈ2;GíŞ’D†—×¡!_‚p]AÖ	%4{h‹C1î™kÁ/4§Ü¾)IKÏ²g$Ú$¨ğÓpŸ•ß‘ak—–¡“êHç¿Û>½:ø»ÔKK7©Yí0ù8İ)f›\	á‰ûåÎşOôûÉ4­G¨ƒh‹Å0‰[Şl¨$”ŒH–x‹
ÒR2LÈĞ%6%"dÆ µ0úBÕô3ø%]ZÈÑAeE0ì#.+O­ªÂîñ·®ÿótz¼ü†]õC£††İ6Œ›‹”¨‚Ô%â%Ø\…š(ì±z²{kAÑØ£ë8ù¯÷JÊ•šÂ~ãğ&M2)¸t`W§áE÷Œİú%ì\°ª)_Uª}@Şç½÷Hè\E6pG¡<…¿3CÎN«^˜“ÅM Ò“í:?ºİG„­vÂFM‰ş2düØ‚aKpÉöæiØâìÏ•ˆø3kà69'±)Sá½g—Ë·˜­Y%mjV<Í.¢€Ôp<S.SUÆ,;¾™«­$,s3Tír|ÊPŠÇce¹#r&*ıhÁùgäûR<N>#©ÒqZG‡wºGtÅ+˜Q¤ãõì1{¥
àvòPÁ[ôëöèÕµØòëuX¥5dĞc!ÊKÒHAcÑ>¢	¦YÏ”4ÇB)¿o˜cĞÖNµäø¬¬bnrœæP2÷ëç2ŠFÊûñø»^“º1Lâ‹+(l÷j;z}æ’Ğ¤BOc9¥]N÷\x;2))ÒSRSš(ÌŸYÚ± ›æª‡>p×›ŸÔ¡úëÏ‰g¬q°_›ä ¹NØ·éy~ƒŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡ßç¡Tà(ÏZë°–—Ôºá6RªÌ'xïÓÓ £#FyÍŠsTß¤ ËÔåh€’`-8ñk¤ü&;ò¥ë—½V	‹<—MCÁfE‰Ú¢uİ%ÊüÄ–*¦¶5-8\áâ3°iSà9·æŒÓt*ØÕŒÄj­èp&Qq°(ï.1jˆÎ+—‚Ùê¥´fˆ4™8Õ»ÈáÇåç)"pFREÏ¶«x+¿„çİıàúĞ²=tí‚‘ËÕØqG›€TR–Ï¢¯ÃÙ’/Ëé  !² ´†÷Ü‰¦U1èê“1©»Íª”°óŞ®ïŞô;4§AÅOSÚ#$æG¿ˆ¤xÕ õ'ù=u¯\c‹’Q6C¹*;/ŒßâüvãÚ
õ…[íY³fBeÔæ£;—Š‰nÎòKÓ’"SŞwº"tßX©-GpÌ
©-•Mq=”|ùB—°‘Ò€¢K't|xùüÓ1ApTe Œ•ê3öSù½'^	²²	‘yÀ fxL˜vØÁmaĞp2›§Ä¨ëRlG¿”~Û¯è‹Ô¸›¼~&CZì3Š½¨•QÅôî2ºO…S¯æ3vGÔos¢j0ìãÂªc”UÈ!4çFÙŞ#è¦0êÎÀ„~Å8Lâ¿¶IjR@À¹N-ºr[ ”ì˜…¨”gÂ—)ƒG1-BKŒ˜mU‰]=„/¢ì6U¹`¡7t§‘tUÀúgtaî¦ËlÑ'î¦"í*, â-ş!û#3¶JKy2ü‘'"ï•óùo+•œ(0*ë‡ÙT‚	‡İÛ¶<·a±v?
YªØã%ö&|­2¡ëŞŒ¢Ñ½äc2îK’Ğ“éZ1 jP½ƒÓœ¤ó ÜÜn–Š “§üôÔ_~7¥C„ÊË£A†?U¾†w¥=Û­Ró~3}9otS¾rÚQTËÂ€Ä‘Ìr»‹pPÿğ¤ÛÌ„|„(”v–uÛ+”èÖuÛg}’µw»õŸ€“ÿq/ëş2é5î«4`¸ºñik‰©“{pã9ãa¹ÊL2zUîg¢®#¨âuˆçÁ Ê4¬¨4²˜·–ô
ÁYnÅ,’'¿[,Q¶sƒ^ M)-§–EfÈ2.VgM¡;Ş©h‰o³ÇŠ)|øqY?F»±7Ïô*ŠEXÖ„avşÖ U§ÅÎ Ì‚t|ƒÊ,Í¤Lí"IY% ±$$Ïî›´Ó“ÛÆ "z.Uß@ğ¾úÜL9şÌ?_L¿êOğøûİ¨¾Î>¿\Œ«6T»¼¿¸Oö#— ¿™Ne	ôhëÏNN‹‚È	E@0ûÇ.‡ôş$»®Ã»Ö³yùò•\ç~Q§ªöÕÛ¿:¾mKŸÒ #Hi‰?¹ì&6faóè3ëÜ¼¾ Ó>ıáöë¿hà›ñ{¼ŒX4äŠ›#†øéIşr·£Ç^®÷‚ñG…İ)jqÃñï
7¹ã>øú^ü6¾\‹>ætL[RqVx‚ÅíTvNP%¶$œù`½Î,k›Ğ¤“Ü†SJt"ufDÕ/øNº´ù>^S›‡ÎMJ1°ü»ş­úŒó¬(ñî+Ò¸»Åá[|Èî)sœ+¦gI	KÁÈ8y•-Dæ] û(IÑ9}­bwö9bÿúo{¯Ä–ê8ÇÍ¹½+ö¯Ïœ2ÑxK½H"EJkˆ—“b&²¹ò‹Ó¦½Àø‘hXôáÙ>¼N"Ù½Øä©ÆâwÊ™lAlå“{lğ;oÜCÚ©‚`ªöÕ€%×—‡Ò€B§VYKl¥_ÃsûécA7µãÈ¶¨y*¨bù$'ËÄ¸ÔÃ`Û‡\Scq·”“Ps›©ˆ·û}Ûõïz?­O–Ns	·¹Él)xÙíFDU^ Qû¡ù¬.Ø¼“i´»N˜Š1LïğÛÒì­$¤y–LÑ sy7ZTœ†s½#ææT½ ˆ÷Ğ{Õıù=¨ıH}¢™ß`¼É¶×­·æ ÏoÅŸîsóúœø–·]$£-Ø’yd£ Ğw¦YÖA™
ñ:9ïÅ&³ZèfĞÁBê&°}(¾`½•®N{äÁ÷Ù49+`&Ü†áw}ÍÀ[=tü”Ş/¹ûÍŠ~¡Ïä3¿I|Q<iI%?‡¯¹C.O*Š ¸§Uu`FWíj=ÕÔ×C¬vÎle¬Ğtê˜3 nØëÀ—×ykê·h°ósñ†ÖA§™+cµZšYºÏ(±Y,[šFÆ,+¢–Gv=öîÛÂ…°½Ÿ<ƒ.có\åy”ä<–lBYØÉILÑ+’f{8|2cú"¼Ìm)› ‚Òşâ_oÃMºGÌßl"àÓÿï)­dúù·Å×Ûfè• ¯ÌıXÙå1DÈ!QkT‘‚¿"v{Å$Ö8/M­’gĞÖA+Og¬Ø$½ÃNk+Ü™–±"Ë«Ï³îJäÿ±~¯’“ª1nóÈ0ìdV(ûo$Ú¢Ã‡mİFz½ VI9Q¶ii2áwäaåÏïŞà”¹ôŒè
Ît¿?ËÜ·à€õÏÍq¨aÛ£¤€¼ÛX7éÔqƒ»>Ï°¿iT¨¤ˆS_fÚEì(Ş¯àÁvşÏíYÎpÎÍŒ°œ™0 İn×°ÎÓlÆ!æiÍ»qXÚ  ÅÇ1ïÊÊbtXñ6û¾Šf>¡5n¸™ò8½UÒ`o’‡ú(£u/øİ…@=Áÿì]:Äaj7–éRûB²dÉº’W£Ô†Æı’Æê,|âb²yy%´e¬?S)ÊXkºŠ€Ë²$¶D™Ñ4ÀÊ§÷Ö¼ë(bb÷@€Ã¼¹Œ€ë¯A½ïÚõ´²õ­¬z@Ãˆ2×Ù×øEO›uªDŒ›€ë£kP.Ùã=k¤î„R\½c570èÛğ‘«¹„º H¹ßØ'Ü´~6[§taìŠÑø&îd½\ôÙ{Õ¾ ò'ò<¯^aŞ¶R·C»!9¿¦Â9ğtò°Š]	ùUsìÕâ2Ig¸Äı@³WÚÁzÉQ{Óˆ²×r¬bt–¡ç:İC*K€‡è]'º„Ü³.Q×øXÓ«1BTzúåuĞŞ%&¥ÕF€üÇâr÷'©“¹¹¢O[±°“QšyĞu’TyÌÖu\™ee…ğ©£÷ä¬ipÿa–®ÿßà¡ôŞ—©ÁBéÊ˜4˜‰…ØĞ Kş?jgÁùë¢#õv>4Å5t
sFìÃğïc­ÒF!<g«—RÚÏ#k®0¡+Ÿà¥µÏ)&>3°icĞLË¹|»pªÎz%ø¬…œáV.#Ë£‡ç­	ÒK’h×IW!_…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?¬oÁ#Î¦´ÅblÀàçÖip;ÂjJßsøc~àïµóÓ2œg©™,ë•ÛšİÔ£XODş³<5F€¡ºö-=jµØá¥tuß”¥0„êX¦÷xlÍB3Vkk9ÈèZA¿¾V‡Ëîä§¤HŒÌ”2ãnú?Ê#åÅÄÆl©¢†}YwîvõZ`qxö½†-F~]ƒóÚÔU{ ¼ŸÉ—lİvÚzºx°ÛÄ´­œ‚ÜM¶œqs+ è÷÷¸`%aS›ÉVŸ˜›[¹wëTBÙå*9äê·ğYë‰¼©r×#0¡«Ó09gÌj\P”ÃÖ‡(æq>¿çÔsèÛ&åÉTqKe¿JÌY\hòÂ*É'²cƒv)@n'³V.bb/Vk…»1wÃ©HTŸ³‡ª]h¶Ax1…¼oó³2xˆdX²ÁÁX§&5]c‚%\TîB­R6«X…nÆ²hA"fi-	%ı„}/Îd˜T”°0‡Şò"	fæq€ğßëì½÷şï¿Ê§ğûòõÿ/³»ÌÄ£<öÏÙ>üÎúÛ¿ê¼ÉO÷
õø³<ENÊCˆÈ™$@ûºúşö=¿®M³ÿş„²û
ğú{®^S*3BnËìÌ4µ_‚	RH @C:y*İ&"fšñ·óÈ¸ªm[š8‹v‚ı´½ø‹!Õ ?8¸šŸ¬´¸˜™ãUR\úEíë0¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øú[ıÀ>(¢™Æôm8£ğVX—µ-~Ò ÎÂeHuù`9“aª›’“"“N"•§ƒågğ˜œŸN.OÛ˜¸Úü¼¹û =øÄÛë4ğøã½ºÌòL´èŠ)s¨ª‡÷½H¼IK‹Û8¥9òM³©Ñ1}-œëw–_U¬ü?‹ûŒ¤j {ïù@™ÍÆ{ïÔ€™8“©F>{Š×Ùl ¹« ŒƒØ&¶d8¨	zôÍü®=c¦K:˜³KÀÅ«i„’­zLÉl¥DW’lÈ2{OíŞ’d†“×¡!_‚p]A‚Ö	%4{h‹C1î™kÁ?´§Ü¶)IKï´g$Ú$¨ÀÓpŸ•ß‘ak—–¡“êç»Û>½:ø»ÖKK7©Yí0ù8İ)f›\)á‰ûåÎşOôûÉ4­G¨ƒx‹Å8‰[Şl¨$”ŒH–x‹
ÒR2LÈĞ%6%"dÆ$µ0ú‰BÕô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîñ·®ÿótz¼ü†]åC£††İvŒ›‹”¨‚Ô%â%Ø\…š(ì±z²{kAÑØ£ë8ù¯÷JÊ•šÂ~ãğ6M2)¸t`×‡áE÷Œİú%í\°ª)_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎN«^“ÕM Òíz?»İG„ívÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø3kà69'±)Sá½g—«—˜­Y%mjV<Í.¢€Ôp<S®SUÆ,;¶™«­$,qTír|ÊPŠÇce¹#â&*ıhÁùgäûR<^,#©ÒsZG‡wºG|Å+˜Q¤ãõì1{¥
àvóPÁ[ôëöèÕµØòËuX¤5dĞc!êJÒHAcÑ>¢¦YÏ”<ÆB)?o˜cĞÖNµäø¬¬rnr
œæP2÷ëç2ŠFÊûñø»^“º1Lê‹+(l÷j;zyä’Ğ¤BOc9¥]N÷\x2))ÒSPWš(ÌŸYÚ±°›æŒª‡	>p×›ŸÔ¡êûßÉg¬q°[›ä¹FØ·é9~ÃŸ®„»‹CE¨ …EÛ¿aóEH@eÏ"…‡ßç¡Tà(ÏZë°–—Ôºá6RªÍ'xïÓÓ £#FqÍŠsTß¤ ËÔåL ’`-8ñk´Ü¦;²¥ë—½V	‹<—MCÁfE‰Ò¢uİ%ÊüÄ–*¦¶5)8|áâ3mSà9·äŒÓ|*ØÕŒÄj­èp&Y1´(ï.1jˆÎ…+“‚Ùê¥´fˆ4™8Õ»ÈáÇåç)"pFREÏ¶«Fx¿„çÍùàúĞ²=tí‚‘–ËÕØqG›€TR–Ï¢Ãù’/Ëé  !² ô÷Ü‰†u1èê“1­»Íª”°óŞ®¯Şô;<[§ÁÅOSÚ#$æG¿ˆäxÕ õ'ù=}¬\c’Q6C¹*;/ŒßâìrãÚ
õ…[íY³fBeÔö£?—ŠÉnÎòKÓ’"SŞwº"tßX©-GpÌ
©-•Mq=”|ûB‡°‘Ò€¢K't|xùüÛ!ApTe Ì•ê3öSù½'^	²²	‘yÀ fxL˜vØÁmaĞp²šçÄ¨ëRlO¾”~Û¯à‹Ô¸›¼&CZì3Š½¨•QÅüî2ªO…S¯æ3vGÔosâê0ìãÂºc”UÈ!4§FÙŞ#è¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[~ „ì˜…¨”gÂ—)ƒG1mBKŒ˜eU‰]=„¯œ¢ì6T¹`¡7v§‘tUÀúgtan¦ËlÑ'î¦"í*,àâ-ş!û#3öJKy2ş‘'"ï•óùo+•œ(0*ë‡Ùtƒ	‡İÛ¦<·a±v?
YªØ£%ö&|¬2¡ëŞŒ¢Q½äC2îK’Ğ“éX±k½P½ƒÓœ¤÷ ÜÜn– ƒ§üôÔ_7¥C„ÊË£a†?U¾†w¥-Û¥Zó~3}9otS¾rÚQTËÂ€Ä‘ìò¿ŠxPÿğ¤ÛÌ„|„
(”v–uÙ+„èÖtÛg}’±w;ıŸ€“ÿA/ëş0éµÎ«4`¸ºñik‰Ş©“{qã;ãa¹ÊL2zUîg¢®%#¨âu˜çÁ È4¬¨4²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÀ2.g¡;Ü©h‰o³Ç‹)|øqY?D»±3Ïş(ŠAXÖ„AdşÖ E§ÅÎ Ì;‚t|ƒ…Î,Í¤Lí"IY% ñ$&Ïî›´„Ó“ÛÆ "z.UŸ@ğ¾ûİL=şÌ?_L¿êOğøûÜ©¾Îº¿\Œ«6T»<¿¸Oöc— ¿‰Ne	ôhëÏNN‹‚È	E@0ûÇ.§ôş$¹.Ã»Ö³yùò•\ç~S§ªöÕÛ»:¾mKŸÒ #HI‰?¹Ì&6faòè7ë\¼º Ó>ıáöë¿èà›ñ{¼ŒX4äŠ›#ÆøéIşv·£Ï^®÷‚ñG…İ)hqÃñï
7¹ã>øú^ü6¾\‹ºætL[RqVx‚ÅíTvNP%6%œù`½Î¤k›Ğ¤“Ü†SHt"ufDÕ/øNº´ñ>S›†ÎIJ0°ü»ş­úŒó¬(ñî+Ò¸»Åà[|Hî)sEœ+¦gH	KÁˆ8y•-Dæ\àû(IÑ9}­bwö9fÿúo{«Å†ê0ÇÍ¹¹'ö¯Ïœ2Ñ8C½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hôáÉ>¼N#ÛıØ¤©Î€âwÊİlAlå“{lò;mÜCÚé‚`®öÕ€%÷—‡Ò€B§VYKl¥_ÃsûècAŠ7µãÈ¦¨y*¨bù$%ËÄ¸Ôã`›—\Saq·”“Ğó›©€·û}Ûõïz?­O–Ns	·¹É-)xÙíFDU Qû¡ù¬/Ø¼“i´»N˜Ê1Lïğ›ÒÌ­$¤y–LÑ sy7ZTœ†s½#æ¦½ ˆ÷Ğ{Õıù=¨ı	H}ª™ß ¸é¶×­·æ ÎoÇŸîsñúœø–·]$£-Ø’yd£ Ğw¦YÖA™
ñ:9ïÅ&£ZèfĞÁBê&°})¾`½•N{äÁ÷Ù6)+a&Ü†áW}ÍÀ[<tü”Ş/¹{Íª~¡Ï^ä3¾I|Q<iI$?‡¯¹C.O*Š ¸§Uu`FGí*=ÕÔ×C,vÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†×A'™+cµZšYºÏ(±Y,[šFÆ,+¢–v=öî[Â…°½<ƒ.cñ\åy´ä<–lBYØÉIMÑ+’f{8|2cú"¼Ìm)› ‚Öşb_WoÃMºGÌÏl"àÓÿï)­dúù·Å×Ûfè• ¯ŒıXÙå1Lˆ!QkT‘’¾"v{Å?$Ö8'M­’gĞÖA+Og¬Ø$½ÃÎk+Ü™–‘"Ë«Ï³îjäÿ±~¯’“ª1nóÈ0ìdV(ûo$Ú¢Á‡mİFz½ VI9Q¶ii2áwäaeÏïÛà”¹Ôè
Ît¿?ËÜ·à€õÏÍu¨aÛ£¤€¼ÛX7éÔqƒ»>Ï°¿iT¨ ˆS^fÚEì(Ş¯àÁ~şÏíÎrÎÍ„°œ‰0 İnÇ°ÎÓlÆ!æiºqXZ  ÅÇ1ïÊÊbtXñ>û¾Šf>¡5n¸™ò8¼UÒ`o’‡ú(£u/øİ…@=Áÿì]*Àaj7–àRûB²dÉº’W£Ô†Æı’Æê,|âb²yy%´g®7S)ÊXkºŠË²$¶D™‘4ÀÊ§çÔœë(bb÷@€Ã¼¹€ë¯A½ïÚÕ´¸õ­¬z@Ãˆ²ßÙ×ø EO›uªDŒ›€ë£kP.Ù!ã=+¤î„R\½'570èÛğ±«¹„º @±ßØ'Ü´~6[§ôaìŠÑú&îd½\ôÙ{Õ¾ ò'ò<^aÖ¶P§»!9¿®Â9ğtô°Š]	éUsäĞâ2Ig¸ÀıÀ²WÊÁzÈQ{Óˆ²×r,bt–¡ã>İG*K€…è]'[º„Ü“.Q×øXÓëBTzúåuÔŞ%&¥ÕF€üÇâr÷'©’¹¹¢O[±°“QšyĞu’TyÌÖu\™ee•ğ©«õäìipÿa–¾ÿÛà¡ôŞ—©ÁFéÊ˜4ˆ•ØĞ Kü#?jgÁùë¢#õ¶?4Å5t
sFìÃğïc­òF <g«—RÚÎ#k®0¡+Ÿè¥µÏ)&>3°icĞLË¹|»pªîz%ø¬…œáV.#Û£‡ç­	ÒK’h×IW!_…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?¬oÁ#Î¦´ÅblÀà§Öip:ÂjJßsøc~àïµóÓ2œg9™,ë•ÛšİÔ£XODş³<µF ¡²ö-=jµøá¥veİ¥0„êX¦÷xlÍB3Vkk9ÈèZAŸº^‡Ëîä§¤HÌÌ”2ãnú6Ê#åÅÄÆl©¢†}Ywîvõhqxö^ı†-J~]ƒóÚÔTz¼ŸÉ—lİvÚzºx°ÛÄ´­œ†ÜM¶qs+ èŸ÷×¸`%aS›IV›˜›Y¹wëTBÑå*9¤ê·ğYë‰¼©rß#0¡¯C0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&õÉTqKe¿JÌY\hòÂ*É'²c‹v)@n'³V.bb/V{…³1wË©HT³‡ª]h¶Ax1…¼oó“³2xˆdX²ÁÁX§&5]c‚%\Tîb­B6«X…nÆ²hA"	fi-	%ı„}/Îd˜T”°0‡Úò"	fæq€pßëì½÷şï¿Ê§ğûğõÿ/³«ÌÄ£<öÏÙ>üÏúÛ¿ê¼ÁO÷
õø³<ENÊCˆÈ™$@ûºúşö=¿®M³ÿş„²û
ğú­{®^s*3BnËíÌ4µo_‚	RH @C:y*İ&"fšñ·óÌ¸ªM[š8‹ö‚ı´½¸ƒ!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!°«ğû[ıÀ>8¢™Æôo8£ğ^X—µ-~Ò"ÎÂeHuù`9“áª›’“"“F"•§ƒåGğ˜œŸN.OÛ˜°Úü¼¹ú =xÄÛë4ğøã½ºÌòL´èŠ)s¨ª‡ç½H¼IK‹Û8¥9òM³9Ñ1}-œëw_U¼ü?‹ûŒ¤ê"{«y@™ÍÆ{ïÜ€™8“©F>{Š×Ùl ¹« ŒƒØ&6d<¨	z<ôÍü®=cçK>˜³KÀÅ«i„’­zl‰l¥DW’lÈ2;GíŞd†—×¡!_¢p}A‚Ö	%4{h‹C1î™kÁ/´§Ü¶)ÉKï°g$Ú$¨ğÓpŸ•ß‘ak—–¡“êç¿Ë>½8ø»ÔËK7©Yí0ù8İ)f›\	á©ûåÎşOôûÉ4­O¨ƒx‹Å0‰[Şl¨$”ŒH–x‹
ÒR2LÈĞ%6%"dÆ$µ0úBÕü3ø5]ÍZÈÑAeE0ì#.+O­ªÂîù·®ÿótz¼ü–]õC£††İvŒ›‹”¨‚Ô%â%Ø\…š(ì±z2{kAÙØ£ë8ù¯÷JÊ…šÂşãğ&M²)¸t`×§áE÷Œİú%ì\°ª!_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎN«^˜“ÕM Òíz?ºİG„­vÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø3ëà69'±)Sáœ½g—ë—™­Y%mjV<Í.¢€Öp<S®[UÆ,;¶™«­$,q3Tír|ÊPŠÇce¹#r&*ıhÁùgäûR<N>#¹ÒsZG‡wºG|Å+˜Q¤ãõì1{¥
àvòPÁ[ôëöèÕµØòËuX¥5dĞc!ÊKÒHACÑ>¢¦YÏ”¼Æ‚)>o˜gĞÔNµäø¬¬bnrœÆP0÷£§2ŠFÊûñø»^“º±L¢‹+(l÷j;z}æ’Ğ¤BOc9¥]N÷\x2))ÖSPWš(ÌŸYZ‘ ›æŒª‡	>p×‹ŸÔ¡êëß‰g¬q°[›ä ¹NØ·í9~ƒŸ®„»‹CE¨ …EÛ»añEH@åÏ"…‡Ïç¡Tà(ÏZë0–—Ôúá6RªÍ'xïÓÓ £#FyÍŠsTß¦ ËÔåL€’`-8ñk´Ü&;²¥ë—½V	‹<—OCÁfEˆŞ¢uİ%ÊüÄ–*¦¶5-8\ãâ#iSà9·äŒÓô*ØÕŒÄz­èp&Q1´(ï®1j˜Î+—‚Ùê¥´fˆ4™¸Õ»ÈàÇåç)"pFBEÏ¶«Fx+¿„ãİùàúĞ²=tí‚‘–ËÕØqG›€TR–Ï¢¯ÃÙ’/Ëé  !² ô†÷Ü‰¦U1èê’1©»Íª”°óŞ®¯Şô;4[§ÁÅOSÚ#$æG¿ˆä½xÕ õ'ù=5¬\c’Q6C¹*;/ŒßâìvãÚ
õ…[íY³fBeÔæ£?—ŠÉnÎòKÓ’"SŞwº"tßX©-GpÌ*©-Mq=–|ûB—°‘Ò€¢K't|xùüÓ!ApTe Ü…ê3öSù½'^	²òR	“yÀ fxL˜vØÁmaĞp2›§Ä¨ëRlG¿”|Û¯à‹Ä¸›¼~&SZì3½¨•QÅüî2ª_…S¯æsvGĞosâj0ìãBºc’UÈ!4ïFÙŞ#è¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[ ”ì˜…¨”gÂ—)ƒG1mBKŒ˜eU‰]=„/œ¢ì6U¹`¡wv§‘tUÀúgtaî¦ËlÑ'î¦"í*,‚â-ş¡û#3öJKY2¼‘' ï•óùo+•œ(0*ë‡Ùpƒ	­‡İÛ¶<·a±v/ÊYªØã%ö&|­2±ëŞŒ¢Ñ½äC2îK‚ĞÓéZ±kP½£Ûœ¤÷ ÜÜÎ–OP “¥üôÔ_~7¥C„ÊË¡A†?U¾†w¥-Û¥Zó~;$}¹otS¾rÚQTËÂ€Ä‘íò»ªxPÿğ¤ÛÌ„|„(”v–uÙ+„éÖuÛg}’±w»õŸˆ“ÿQ/ëş0é5Î«4`¸ºñikˆŞ©“{qã9ãa½ÊD2zUîg¢ª%¨âu˜åÁ Ê´¬¨4¶˜·¶ô
ÅYnÅ,’'¿Û,Q¶s‚^ A)-‡–EfÈ2.Vg¡;Ş©h‰o³ÇŠ)|úqY?D»±·Ïö(ŠAXÖ„avşÖ W§ÅÎ(Ì‚t|ƒ…Î,Í¤Lí"I% ñ$$Ïî›´Ó“ÛÆ  z.UŸ@ğ¾ûİL=şÌ?_L¿êOğøûİ¨¾Ïº¿\Œ«6P»¼¿¹Oöc— ¿™Ne	ôhëÏNN‹‚È	EA0ûÇ.‡ôÿş$¹®Ã»Ö³yùòµ\ç~S§ªöÕÚ¿:¾mJŸÒ #HI‰?¹ì&6gaòè3ëÜ¼º Ó>íáöë¿hà›á{¼ŒX4äŠ»#ÆøéIşv·£Ï^®ó‚ñG…İ)jqÃñï7¹ã>øú^ü6¾\‹¾æ|L[RqVx‚ÅíTvNP%¶$œù`½Î,k›Ğ¤“Ü†SJt"ufDÕ/øNº´ù>S›†ÎIJ1°ü»ş­úŒó¬(ñî/Ò¸»Åá[|Èî)sœ+¦fA	KÁŒ8y•-Dæ\ û(IÑ9}bwö9bÿúo{©Å–ê8ÇÍ¹¹oö¯Ïœ2ÑxK½H"EJkˆ—“b&³¹b‹Ó¦½Àø‘hXôáÉ>¬N#ÛıØ¤©ÎâwÊ™lAlå“{lò;oÎCÚ©‚`®öÕ€%÷—‡Ò€B§VÙKl¥_ÃsûécA6µcÈ¦¨y*¨bù$'ËÄ¸ÔÃ`›—\Saq·”“Pó›©ˆ·û}Ûõïz?­O–Ns	·¹Ém)xÙíF@U Qû¡ù¬.Ø¼“i´»N˜Š1LïğÛÒì­$¤y–LÑ s97ZTœ†s½#ææT½ ˆ÷Ğ{Õıù=ªı	>H}¢™ß ¼É¶×­·æ ÏoÇŸîsñú‹œø–·]$£®-Ø’yd£ Ğw¦YÖA™
ñº9ïÅ&³ZèfĞÃBê&°}9¾`½•ŸN{äÁ÷Ù4)+`&Ü†áw}ÍÀ[=tü”Ş/¹{Ìª~¡Ïä3¿I|Q<iI%?‡¯¹C.K:Š ¸§Uu`FWåh=ÕÔ×C,vÎle¬ĞtêØ3 nĞëÀ—×ykê·h°ósñ†ÔA'™+sµJšºÍ(±Y,[šFÆl+¢–Gv=öî{Â… ½<ƒ.cñ\åy´ä<–lBYØÉILÑ+’fû8|2cú"¼Ìm-› ‚Òşb_WoÃMºGLÏl"àÓÿÏ)­dúù·Å×Ûfè• ¯ÌıXÙå1LÈ!QkT‘‚¾"v{Å$Ö8/M­’gĞÖA/Oc¬Ø,½ÃNk+Ü™–±"ËëÏ³îjäÿ±~¯’“ª1nóÈpìdV
»o$Ú¢Á…mÙVz½ VI9Qöki2ÁwäaeÏïÛà”¹Ôè
Ît¿?ËÜ·à€õÏÍu¨aÛ£¦€¼ÛX7iTq‡»> ¿iT¨ ˆS_fŞEì(Ş¯àÁ~şÏíÎpÎÍ„°œ‰0 İn×°ÎÓlÆ!æiºqXÚ ¨ÅÇ1ïÊÊbtXñ6û¿šŠf>¡5n8™ò8¼UÒ`o’‡ú(£u/øİ…@=Ãÿì]*Àaj7–éRûB²dÉº’W£Ô†Æı’Æê,|âb²yy%´e®?S)ÊXkºŠË²$¶D™Ñ4ÀÊ§çÖ¼«(bb÷@€Ã¼¹Œ€é/A½ïÚõ´¸õ­¬z@Ãˆ²ßÙ×ø¡EO›uªDŒÛ€ë£kP.Ùã=+¤î„R\½'57pèÛğ±£¹„º @¹ßÙ'Ü´~6[§ôaìŠñø¦îd½\ôÙ{Õ¾ ò'ò<¯^aŞ¶R·C»!9»¦§Â9ğtò°Š]	ùUsôÔâ2Ig¸Äı@²WÊÁzÉQ{Óˆ²×r,bô–¡ã>İG*K€‡è]'[º„Ü³.Ñ×øØÓ«BTzúåuĞŞ%&¥ÕF€üÇâr÷'©’±¹¢O[±°“QšyĞu’TyÎÖu\™ee•ğ©£÷äìIpÿa–®şÛà¡äŞ–©ÁBéÎ˜4˜‰•ØĞ Kş#?jgÁùë¢#õö>4Å5t
sFlÃğïc­ÒF <g«—RÚÎ#k®0¡+Ÿè¥µÏ)¾3°icĞLË¹|»pªÎz%ø¼…œáV.#Û£‡çí	ÒK’h×IW!_?…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?®oÁ#Î¤´ÅblÀà§Öip;ÂjJßsøc~àï½óÓ2œg)™,ë•ßšİÔ£XODş³µF€¡ºö-=j½Øá¥veİ¥0„êX¦÷xlÍB7Vkk9ÈèZAŸºV‡Ëîä§¤HŒÌ”2ânú$vÊ#åÅÆÆl©¢†}]wìvõhqxö^½†-F~]ƒóÚÔTz¼ŸÉ—lİ6Ú:ºp°ÛÄ´©Œ‚ÜM¶qs+ èŸ÷×¸`%aS›ÉVŸ˜›Y¹wëTFÙå*9äê·ğYë‰¼©rß#0¡¯C09gŒj\P”ÃÖ‡(æu>¿çÔsèÛ&åÉTqKe¿JÌY\hòÂ*É'²c‹v)@n'³v.bb/V{…³1wË©T³‡ª]h¶Ax±…¼oó³2xˆdX²ÁÁP§&5Mc‚%\Têb­B6«X…nÆ²hA"	fi-	%ı„}/Î`˜T”°1‡Şò"	fæq€ğßkì½¾÷şï¿Ê§ğëòõÿ/³»ÌÄ£<öÏÙ>üÏúÛ¿ê¼ÁO÷
õø³<ENÊKˆÈÙ$@ûºúşoö=¿®M³ÿş„²û
ğÚ­{®^s‹*3BnËì
Ì4µo_‚	RH @C:y*İ&"fšñ·óÌ¸ªmSšx‹ö‚ı´½øƒ!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øû[üÀ>(¢™æüm8£ğ^X—µ-~Ò ÎÂehuù`9“aª›’“"“F"•§ƒåGğ˜œŸN.OÛ˜°Úü¼¹û =xÄÛË4ğøã½ºÌòL´èŠ©s¨ª‡÷½H¼IK‹Û8¥9òM³9Ñ1y-œëw–_U¼ü?‹ûŒ¤ê {ëù@™ÍÆ{ïÜ€™8“©F.{
×Ùn ¹« œƒØ&¶d<¨	zôÍ|®=cæK>˜³ËÀÅ«y„’­zLÉl¥dW’lÈ2;OíŞd†“—¡#_‚p}A‚Ö	%4{h«C1î™+Á/´§Ü¶)IKÏ°g$Ú$¨ğÓpŸ•ß™ak—–¡“êç¿Û>½:ø»ÔKK7©Yí0ù8İ)f›\	á‰ûåÎúOôûÉ4­G¨ƒx‹Å0‰[Şl¨$C”ŒH–x‹
ÒR2LÈĞ%6%"dÆ 50úBÕô3ø5]ÍZÈÑAeE0ì#.+G­ªÂîoù·®ûótz¼ü}õC£¦†Ù6Œ›‹”¨‚Ô%â%Ø\…š(ìñz2{kAÑØ£ë8ù¯çJÊ•šÂ~ãğ6M2)¸t`W§áE÷Œİº%ì\°ª)_Uª}@Şç¿÷Hè\E6pG¡<…¿3CÎN«^˜“ÕM Òíz?ºİG„ívÂFL‰ú2düØ‚aKpIöæiØâäÏ•ˆø3kà69'±)Sáœ½gµë·˜­Y%mjV<Í.¢€Ôp<S®SUÆ,;¶™«­$,q1T­r|ÊPŠÇce¹#r&*ıhÁùgäûR<^.#©ÒsZG‡wºG|Å+˜Q¤ãõì1{¥
àvóPÁ[ôëö¨ÕµØòËuX§5dĞc!ÊKÒHACQ>¢¦YÇ”<Æ)>o˜cĞÔNµäø¨¬bnr
œ¾ÆP2÷ëç2ŠFÊûñø»^“¾±L£‹+(l÷j;:yæ’Ğ¤BOc9¥]N÷\x;2))ÒSPSš(ÌŸYÚ± ›æŒª‡	>p×‹ŸÔ¡êëßÉg¬s°[›ä ¹NØ·é9zƒŸ®„»CE¨ EÛ¿añEH@õÏ"…‡Çç¡Tà8ÏZë°–—Ôºá6RªÍ'xïÓ× £#FyÍŠsTß¦ ËÔål€’`-8ñk´Ü.;²¥ë—½V	‹<—OCÁfE	Ú¢uİ%ÊüÄ–*¦¶5)8\áâ3iSà9·äŒÓt*ØÕÄj­hp&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4™8Õ»ÈáÇåg)"pfRDÏ¶«x+¿„çİùàú…Ğ²=tí‚‘–ËÕØqG›€TR–Ï¢¯ÃÑ’/Ëé" !² ô†÷Ü‰¦U1èî“9©»ÍªÔ°ó®¯Şô?4§ÁÅOSÚ#$æG¿ˆdxÅ ô'ù9}¬\c’Q6C¹*;/ŒßâìvãÚ
µ…[íY³fBe<Ôæ£?—ŠÉnîòKÓ’"SŞwº"tßX©mGpÌ*©-•Mq=”|ûB—°‘Ò€¢K't|xùüÛ!ApTe ü•ê3öSù½'^	²²	“yÀ fxL˜vİÁmaĞp2›çÄ¨ë"RlG¿”~Û¯à‹Ô¸›¼~&CZì3
¨•QÅüî²:ªO…¯æsvGÔOsâj0ìãÂºc”UÈ!4çFÙŞ"è¦1êÎÀ€~Å8Lâ¿6ijR@À¹N-:r[ ”ì˜…¨”gÂ—)ƒG1mBKŒ˜eU‰]=„/œ¢ì6U¹`¡7v'‘tUÀúgtaî¦ËlÑ'î¦"í*, â-Ş!û#3öJKRY2ş‘'"ï•óùo+•œ(0*ë‡Ùtƒ	‡ßÛ¶<·a±v?
YªØã%ö&|­2!ëŞŒ¢Ñ½äC2îK’Ğ“éXµk½P½ƒÛŒ¤÷ ÜÜn– ƒ§üôÔ_~7¥C„ÊËƒa†?U¾†w¥-Û¥Zó~;}9otS¾rÚQTËÂ€Ä‘Ìò»ŠxPÿô¤ÛÌ„|„(”v–uÙ+„éÖuÛw}’±w»õŸ€“ÿQ¯ëş0é5Î«4`¸ºñik	Ş©“{qã9ãa¹ÊD2zUîg¢®%#¨âu˜çÁ È4¬¨4´˜·¶ô
ÅYnÅ,’'?[,Q¶s‚^ A	-§–EfÈ2.–g¡;Ş©h‰1o³ÇŠ)|øqY?D»±7Ïö(ŠEZÖ„atşÖ §ÅÎ Ì‚||ƒ…Î,Å¤Lí¢IY% ±$&Ïî›´€Ó“ÛÆ "z.UŸ@ğ>ûİL=şNÌ?_L½êOğøûÜ¨¾Ïº¿\Œ«>T»¼¿ùOöc— ¿‰^e	ôhëËNN‹‚È‘	EA4ûÇ.§ôûş$»®Ã»Ö³yùò•Xç~S§ªöÕÚ¿:¾mJŸÒ#HI‰?¹ì&6faòè3ëÜ¼º Ó<ıáöë¿èà›ñ{¼ŒX4äŠ›#ÆøéIşv·£Ï^®ó‚ñG…İ)jqÃñï
7¹â>¸ú^ü6¾\‹¾æ|N[RqVx‚ÅéTvNP%¶%œù`½Î,+›Ğ¤“Ü†SJt"ufDÕ/øNº´ù>^S›†ÎIJ1°ü»ş­úŒó¬(ñî+Ò¸»Åá[|Èî)sœ+¦gH	KÁˆ8y•-Dæ\ û(IÑ9}@wö9bÿúo{©Å–â0ÇÍ¹¹/ö¯Ïœ2ÑxK½H"EJkˆ—“b&³½ò«Ó¦½Àø‘(XôáÉ>¼N#Û½Øä©ÆâwÊ™lAlå“{lò4;oÜCÚ©Â`®öÕ€%÷—‡Ò€B§WYKl¥_ÃsûécA7µãÈ¦¨y*¨bù'ËÄ¸ÔÃ`›—\Saq·”“ğs›©˜·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼“i´»N˜Š1LïğœÛÒä­$¤y–LÑ s97ZTœ†sµ#ææT½ ˆ÷Ğ{Õıù=¨ı	>H}ª™ß`¼é¶×­·æ ÎoÇ›îsñúœø–·]$£®.-Ø’{d£ Ğw¦YÖA™
ñ:9ïÅ&³zèfĞÁBê¦°}(¾`½•N{äÁ÷Ù49+a&Ü†áW}ÍÀK=tü”Ş/¹{Íª~¡Ïä¿I|Q<éI%?‡¯¹A.O*Š ¸§Uu`FWí*=ÕÔ×C,vÎle¬ĞtêÈ3 nØëÀ—×yëê·h°ósñ†ÖA'™+cµÚšYºÏ(±Y,[šFÆ,+¢–v=öî[Â¥°¿<ƒ.có\åy´ì<–lBYÈÉILÑ+’f{8|2cú"¼Ìm)› ‚Òöâ_oÃMºGÌÏl"àÓÿï)­dúû·Å×Ûfà• ¯ŒıXÙå1LÈ!QkT‘’Ÿ"v{Å¤Ö8'M­’gğÖAOg¬Ø,½ÇÎk+Ü™–‘"Ë«Ï³îJOäÿ±~¯’“ª1nóÈ0ìdV*ûo$ÚD¢Á…mİF~½ VI=QX·ii6áwäaeÏïÛà”¹ÔèŠÎt¿?Ëœ·à€õÏÍu¨aÛ£¤€¼ÛX7éÔqƒ»>°¿iT¨¤ˆS[fŞEì(Ş¯àÁ~şÏíYÎpÎÍ„°œ‰0 Õn×°ÎÓnÆ!æi»qXÚ  ÅÇ1ïÊÊ`tXñ7»¾šŠf>¡5n¸™ò8´UÒ`o’‡ú(£u/øİ…A=Áÿì]:Àáj7–éRûB²dÉº’W£Ô†Æí’Æê,|âc²yy%´g®7S)ÊXKºŠË²$¶D™Ñ4ÀÊ§÷Ö¼£(bb÷@Ã¼¹Œ€ë¯A½ïÚõ´²õ­®~@Ãˆ²ßÙ×ø¡eO“uªDŒ›€ë£kP.Ùã=+¤n†R\½'570èÛğ±©¹„º @¹ßØ'Ü´~6[§ôa¬ŠÑø&îd½\ôÙ{Õ¾ ò'ò<^aŞ¶R·C»!9¿®Â9°tò°Š]ùUsìÔã2Ig¸ÄıD²WÊÁzÉQ{Óˆ²×b,bt–¡ã>İG*k€‡è]'[º„Ü³.Q×øXÓ«BTzúåuĞŞ%&¥ÕF€üÇâr÷#©’¹¹¢O[±°“QšyĞu’TyÌÖuX™ee•ğ©£õä¬ipÿa–®ÿÛà¡ôÎ—©ÁBéÌ˜4ˆ‰•ØĞ Kş#?jgÁùã¢#õ¶?4Å5t
sFlÃğïc­ÒF!<gª—RÚÎ#k®0á+Ÿè¥µÏ)$>3°iCĞLË¹|»pªîz$ø¬…œéV.#Û£‡ç­	ÒK’h×IW¡!_…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?®oÁ#Î¦´ÅblÀàçÖip{ÂjJŸsøc~àïµóÓ2œg)™,ë•ÛšİÔ§XODş³µF€¡²ö-=jµØá¥veİ¥0„êX¦÷xlÍB3Vkk9ÈèZAŸºV‡Ëîä§¤HŒÌ”2ãnúÿuÊ#åÅÄÆl©¢†yYwîvõhqxö^½„-F~]ƒóÚÔT{ ¼ŸÉ—lİvÚzºx°ÛÄ´­œ‚ÜM¶qs+àèŸ÷×¸`%#iS›ÈVŸ˜›Y¹wëTBÙÅ*9äê—ğYë‰¼©rß#0¡‹C0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&õÉTsKe¿JÌY\hòÂ*É'²c‹v)@n'³V.bb/V{³1wË©HT³‡ê]h¶Ax1Å¼oó³2x‰dX²AÁX§&5]c‚%\Tîb­B6«X…n\Æ2hA"	fi-	%ı„}/Î`˜T”°0‡Şò"	fæq€ğŞëì½¾÷şï¿Ê§ğûòõÿ/³»ÌÄ£<öÏÙ>şÏúÛ¿ê¼ÁO÷
õø³<ENÊSˆÈ™$@ûºúWş¶=¿®M³ÿş„²û
ğú­{®^sÏ*3BnËì
Ì4µo_	RH @C:y*İ&"fšñ·óÌ¸ªm[š8‹÷‚ı´½ø‹!Õ ?8¸šŸ¬´¸˜™ãUR\úDíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«ğû[ıĞ>8¢™Æôm8£ğ^H–µ-~Ğ ÎÂaHuù`9“aª›’“"“F*•§ƒåGğ˜œŸN.OÛ˜0Züœ¹ú =xÄÛë4ğøã½ºÌòL´èŠ©s¨ª‡÷½H¼IK‹	Û8¥9òM³9Ñ1}-œëw–_U¼ü?‹ûŒ¤ê {«ù@™ÍÆ{ïÜ€™8“©F>{Š×Ùn¹« ŒƒØ&¶d<¨	z<ôÍü®=cçK>˜³[ÀÇ«i„’­zLÉl¥QDW’:lÈ2;GíŞd†“—¡!_¢p}A‚Ö	%4{h‹C1î™kÁ/´§Ü¶)IKÏ°g$Ú$¨ĞÓpŸ•ß‘ak–¡“êç¿Û>¿:ø»ÔKK7©Yí0ù8İ)f›\	á‰ûåÎşOôûÉ4­G¨ƒx‹Í0‰[Şl(4”ŒH–x‹
ÒR2LÀĞ%6%"dÆ$µ0úBÕô3ø5]ÍZÈÑAeE0l#.+G­ªÂîñ·®ÿótz¼ü–}õC£Æ†İ6œ›‹”¨‚Ô%â%Ø\…š(ì±z2{kAÑØ£ë8ù¯÷JÊ•šÂşãò6M2)¸t`×§áE÷Œİú%ì\°ª)_Uª]@Şç¿÷Hè\E6p	G¡<…¿3CÎN«^˜“ÕM Òíz?ºİG„ívÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø3kà69'±)Sá½g—ë—˜­Y%mjV<Í.¢ Ôp<S®SUÆl;¶™«­$,q3Tír|ÊPŠÇce¹#ò&*ıhÁÙgàûR<N.#©ÒsZG‡wºG|Å+˜Q¤ãõî0{¥
àvòPÁ[ôëöèÕµØòËuX¥5dĞc!ÊKÒHAcÑ>¢¦YÏ”<Æ)?o˜cĞ–Nµäø¬¬`np
œÆP6÷ëç2ŠFÊûğø»^“º1Lâ‹+(n÷j+z}ä’À¤BOc9¥]N÷\x2)©ÖSPWš(ÌŸYÚ± ›æŒª‡	>p×‹ŸÔ¡êëßÉg¬ñ°_›æ ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿aóEH@õÏ"…‡ßç¡Tà(ÏZë°–—Ôºá6Ò¨Í'xïÓÓ £#FyÍŠsTß¦ ËÔåL€’`-8ñk´ü&;²¥ë—½V	‹<—MCÑfE‰Ú¢uİeÊüÄ–*¦¶5-8|áâ3iSà9·äŒÓt*ØÕŒÄz­èp&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4›8Õ»ÈàÇåg)"pfREÏ¶«Fy+¿„çİıàúĞ²=té‚‘–ËÕØqG›€TR–Ï¢¯ÃÙ’/Ëé  !² ô†÷Ü‰¦	U1èê“±©»Åª”°óŞ®¯Şô;4[§ÁÅOSÚ#$æG¿ˆäxÕ ô'ù==¬\c’Q6C¹*;/ŒßâìrãÚ
õ…[íY³fBeÔæ£?—Š‰nîòKÓ’"SŞwº tßX©-GpÌ*©-•Mq=”|ûB—°‘Ò€¢K'tt(xùüÓ!ApTe Ì…ê3öSù½'^	²²	‘yÀ fxL˜vØÁmaĞp2›çÄ¨ïRlG¿”~Û¯à‹Ä¸›¼~&CZì3Š½¨ÕQÅ#üî2ªO…S¯çsvGÔosâj0ìãÂºcUÈ!4ç‹FÙŞ#è¦0êÎÀ„~ÅxLâ¿¶ijR@À¹N-ºr[ ”ì˜…¨”gÂ—+ƒG1mBKˆ˜eU‰]=„¯œ¢ì6U¹`¡7v§‘tUÀúgtaî¦ËlÑ'î¦"í*, â-ş¡û#36JKY2ş