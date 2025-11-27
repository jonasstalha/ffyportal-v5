import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  getClientOrders, 
  addClientOrder, 
  updateClientOrder, 
  deleteClientOrder,
  ClientOrder 
} from '../../lib/firebaseService';
import { getAvocadoTrackingData } from '../../lib/firebaseService';
import { multiLotService } from '../../lib/multiLotService';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  CheckSquare, 
  Square, 
  Save, 
  X,
  AlertCircle,
  Clock,
  User,
  Calendar,
  Truck,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface OrderItem {
  id: string;
  clientName: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  caliber: string;
  type: string;
  processingTime: number;
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

interface ClientOrderExtended {
  id: string;
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  orderDate: string;
  requestedDeliveryDate: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  items: OrderItem[];
  totalAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  selected?: boolean;
}

export default function CommandeClient() {
  const [orders, setOrders] = useState<ClientOrderExtended[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [multiLots, setMultiLots] = useState<any[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ClientOrderExtended | null>(null);

  // New order form state
  const [newOrder, setNewOrder] = useState({
    orderNumber: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    requestedDeliveryDate: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    notes: '',
    items: [] as OrderItem[]
  });

  const allChecked = orders.length > 0 && selectedOrders.size === orders.length;

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch client orders
        const clientOrders = await getClientOrders();
        const transformedOrders = clientOrders.map(order => ({
          ...order,
          items: order.products?.map((product, index) => ({
            id: `${order.id}-${index}`,
            clientName: order.clientName,
            lotNumber: `LOT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            quantity: product.quantity,
            unit: product.unit,
            caliber: 'Mixed',
            type: product.name,
            processingTime: Math.floor(Math.random() * 24) + 1,
            completed: false,
            notes: ''
          })) || []
        }));
        setOrders(transformedOrders);

        // Fetch lot data
        const avocadoLots = await getAvocadoTrackingData();
        setLots(avocadoLots);

        // Fetch multi-lots
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

  // Filter and search functionality
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.clientEmail.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  // Handle item completion toggle
  const handleItemToggle = async (orderId: string, itemId: string) => {
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

      // Update in Firebase
      await updateDoc(doc(db, 'client-orders', orderId), {
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
    if (allChecked) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  // Add new item to order
  const addItemToOrder = () => {
    const newItem: OrderItem = {
      id: `item-${Date.now()}`,
      clientName: newOrder.clientName,
      lotNumber: '',
      quantity: 1,
      unit: 'kg',
      caliber: '',
      type: '',
      processingTime: 1,
      completed: false,
      notes: ''
    };
    setNewOrder(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Remove item from order
  const removeItemFromOrder = (index: number) => {
    setNewOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Save new order
  const handleSaveOrder = async () => {
    try {
      setSaving(true);
      
      const orderData = {
        orderNumber: newOrder.orderNumber || `ORD-${Date.now()}`,
        clientName: newOrder.clientName,
        clientEmail: newOrder.clientEmail,
        clientPhone: newOrder.clientPhone,
        products: newOrder.items.map(item => ({
          id: item.id,
          name: item.type,
          quantity: item.quantity,
          unit: item.unit,
          pricePerUnit: 0,
          totalPrice: 0
        })),
        status: 'pending' as const,
        orderDate: new Date().toISOString(),
        requestedDeliveryDate: newOrder.requestedDeliveryDate,
        totalAmount: 0,
        priority: newOrder.priority,
        notes: newOrder.notes,
        shippingAddress: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: ''
        },
        paymentStatus: 'pending' as const
      };

      await addClientOrder(orderData);
      
      // Reset form
      setNewOrder({
        orderNumber: '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        requestedDeliveryDate: '',
        priority: 'medium',
        notes: '',
        items: []
      });
      setShowAddModal(false);

      // Refresh orders
      const updatedOrders = await getClientOrders();
      const transformedOrders = updatedOrders.map(order => ({
        ...order,
        items: order.products?.map((product, index) => ({
          id: `${order.id}-${index}`,
          clientName: order.clientName,
          lotNumber: `LOT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          quantity: product.quantity,
          unit: product.unit,
          caliber: 'Mixed',
          type: product.name,
          processingTime: Math.floor(Math.random() * 24) + 1,
          completed: false,
          notes: ''
        })) || []
      }));
      setOrders(transformedOrders);

    } catch (error) {
      console.error('Error saving order:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete order
  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    try {
      setSaving(true);
      await deleteClientOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (error) {
      console.error('Error deleting order:', error);
    } finally {
      setSaving(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'shipped': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-50 text-red-700 ring-red-600/10';
      case 'medium': return 'bg-yellow-50 text-yellow-700 ring-yellow-600/10';
      case 'low': return 'bg-green-50 text-green-700 ring-green-600/10';
      default: return 'bg-gray-50 text-gray-700 ring-gray-600/10';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
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
              <p className="text-gray-600">Track and manage client orders with lot assignments</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Order
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-3xl font-bold text-gray-900">
                  {orders.filter(o => o.status === 'pending').length}
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
                <p className="text-sm font-medium text-gray-500">In Progress</p>
                <p className="text-3xl font-bold text-gray-900">
                  {orders.filter(o => o.status === 'processing').length}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Available Lots</p>
                <p className="text-3xl font-bold text-gray-900">{lots.length + multiLots.length}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders by client, email, or order number..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <select
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
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
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  {allChecked ? (
                    <CheckSquare className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                  Select All ({selectedOrders.size})
                </button>
              </div>
              
              {selectedOrders.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedOrders.size} selected
                  </span>
                  <button
                    onClick={() => setSelectedOrders(new Set())}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status & Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items & Lots
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => {
                  const completedItems = order.items.filter(item => item.completed).length;
                  const progressPercentage = order.items.length > 0 ? 
                    Math.round((completedItems / order.items.length) * 100) : 0;

                  return (
                    <tr 
                      key={order.id} 
                      className={`hover:bg-gray-50 ${selectedOrders.has(order.id) ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleOrderSelect(order.id)}
                            className="flex items-center justify-center"
                          >
                            {selectedOrders.has(order.id) ? (
                              <CheckSquare className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                            )}
                          </button>
                          <div>
                            <div className="font-medium text-gray-900">{order.orderNumber}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(order.orderDate).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{order.clientName}</div>
                          <div className="text-sm text-gray-500">{order.clientEmail}</div>
                          {order.clientPhone && (
                            <div className="text-sm text-gray-500">{order.clientPhone}</div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${getPriorityColor(order.priority)}`}>
                            {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-2 max-w-xs">
                          {order.items.map((item) => (
                            <div 
                              key={item.id}
                              className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                                item.completed 
                                  ? 'bg-green-50 border-green-200 opacity-75' 
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              <button
                                onClick={() => handleItemToggle(order.id, item.id)}
                                disabled={saving}
                                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  item.completed
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'border-gray-300 hover:border-green-400'
                                }`}
                              >
                                {item.completed && <CheckCircle className="h-3 w-3" />}
                              </button>
                              
                              <div className={`flex-1 text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                <div className="font-medium">{item.type}</div>
                                <div className="text-xs text-gray-500">
                                  {item.quantity} {item.unit} • LOT: {item.lotNumber}
                                </div>
                                <div className="text-xs text-gray-400">
                                  Caliber: {item.caliber} • {item.processingTime}h
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Progress</span>
                            <span className="font-medium text-gray-900">{progressPercentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                progressPercentage === 100 ? 'bg-green-500' : 
                                progressPercentage > 50 ? 'bg-blue-500' : 'bg-yellow-500'
                              }`}
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500">
                            {completedItems} / {order.items.length} items completed
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingOrder(order)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Order"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Order"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria' 
                  : 'Create your first order to get started'
                }
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Create First Order
              </button>
            </div>
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
                        Email *
                      </label>
                      <input
                        type="email"
                        value={newOrder.clientEmail}
                        onChange={(e) => setNewOrder(prev => ({ ...prev, clientEmail: e.target.value }))}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    {newOrder.items.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Product Type
                          </label>
                          <input
                            type="text"
                            value={item.type}
                            onChange={(e) => {
                              const updatedItems = [...newOrder.items];
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
                              const updatedItems = [...newOrder.items];
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
                              const updatedItems = [...newOrder.items];
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
                              const updatedItems = [...newOrder.items];
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
                              const updatedItems = [...newOrder.items];
                              updatedItems[index] = { ...item, lotNumber: e.target.value };
                              setNewOrder(prev => ({ ...prev, items: updatedItems }));
                            }}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select Lot</option>
                            {lots.map((lot) => (
                              <option key={lot.id} value={lot.harvest?.lotNumber || lot.id}>
                                {lot.harvest?.lotNumber || `Lot ${lot.id}`}
                              </option>
                            ))}
                            {multiLots.map((lot) => (
                              <option key={lot.id} value={lot.lotNumber}>
                                {lot.lotNumber} (Multi-Lot)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-end">
                          <button
                            onClick={() => removeItemFromOrder(index)}
                            className="w-full bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}

                    {newOrder.items.length === 0 && (
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
                  disabled={saving || !newOrder.clientName || !newOrder.clientEmail}
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
