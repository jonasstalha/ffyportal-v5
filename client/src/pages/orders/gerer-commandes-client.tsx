import React, { useState } from 'react';
import { Calendar, Clock, Package, Truck, Filter, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface AvocadoOrder {
  id: string;
  clientName: string;
  orderDate: Date;
  requestedDeliveryDate: Date;
  status: 'pending' | 'processing' | 'delayed' | 'completed' | 'cancelled';
  items: Array<{
    caliber: string;
    quantity: number;
    type: string;
    processingTime: number; // in hours
  }>;
  priority: 'high' | 'medium' | 'low';
  totalProcessingTime: number;
  actualDeliveryDate?: Date;
  notes?: string;
  delayReason?: string;
}

export default function GererLesCommandesClient() {
  const [orders, setOrders] = useState<AvocadoOrder[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // New order form state
  const [newOrder, setNewOrder] = useState<Partial<AvocadoOrder>>({
    items: [],
    status: 'pending',
    orderDate: new Date()
  });

  React.useEffect(() => {
    // Listen for real-time updates from Firestore
    const q = query(collection(db, 'avocado_orders'), orderBy('orderDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          orderDate: data.orderDate?.toDate ? data.orderDate.toDate() : new Date(data.orderDate),
          requestedDeliveryDate: data.requestedDeliveryDate?.toDate ? data.requestedDeliveryDate.toDate() : new Date(data.requestedDeliveryDate),
          actualDeliveryDate: data.actualDeliveryDate?.toDate ? data.actualDeliveryDate.toDate() : data.actualDeliveryDate ? new Date(data.actualDeliveryDate) : undefined,
        } as AvocadoOrder;
      });
      setOrders(fetchedOrders);
    });
    return () => unsubscribe();
  }, []);

  const calculateProcessingTime = (items: AvocadoOrder['items']) => {
    return items.reduce((total, item) => {
      // Base processing time per caliber
      const baseTime = {
        '16': 4,
        '18': 3.5,
        '20': 3,
        '22': 2.5,
        '24': 2
      }[item.caliber] || 3;

      // Adjust time based on quantity
      return total + (baseTime * Math.ceil(item.quantity / 1000));
    }, 0);
  };

  const getStatusColor = (status: AvocadoOrder['status']) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      processing: 'bg-blue-100 text-blue-800 border-blue-200',
      delayed: 'bg-red-100 text-red-800 border-red-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || colors.pending;
  };

  const addOrderItem = () => {
    if (!newOrder.items) return;
    setNewOrder({
      ...newOrder,
      items: [
        ...newOrder.items,
        { caliber: '', quantity: 0, type: '', processingTime: 0 }
      ]
    });
  };

  const handleSubmitOrder = async () => {
    if (!newOrder.clientName || !newOrder.items?.length) return;
    const processingTime = calculateProcessingTime(newOrder.items);
    const newOrderComplete: Omit<AvocadoOrder, 'id'> = {
      ...newOrder as Omit<AvocadoOrder, 'id'>,
      totalProcessingTime: processingTime,
      orderDate: new Date(),
      status: 'pending',
    };
    try {
      await addDoc(collection(db, 'avocado_orders'), {
        ...newOrderComplete,
        orderDate: new Date(),
        requestedDeliveryDate: newOrder.requestedDeliveryDate,
        actualDeliveryDate: newOrder.actualDeliveryDate || null,
      });
      setShowAddModal(false);
      setNewOrder({ items: [], status: 'pending', orderDate: new Date() });
    } catch (e) {
      alert('Failed to add order: ' + e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Management</h1>
            <p className="text-gray-600">Manage and track avocado orders and processing times</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Add New Order
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Package className="h-10 w-10 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Orders</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {orders.filter(o => o.status === 'processing').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Clock className="h-10 w-10 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Processing Time</p>
                <p className="text-2xl font-semibold text-gray-900">4.5h</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-10 w-10 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Delayed</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {orders.filter(o => o.status === 'delayed').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completed Today</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {orders.filter(o => 
                    o.status === 'completed' && 
                    o.actualDeliveryDate?.toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-full md:w-48">
            <Filter className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <select
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="delayed">Delayed</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Details
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timing
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{order.id}</span>
                      <span className="text-sm text-gray-500">{order.clientName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col space-y-1">
                      {order.items.map((item, idx) => (
                        <span key={idx} className="text-sm text-gray-600">
                          {item.quantity} palette{item.quantity > 1 ? 's' : ''} - {item.type} (Caliber {item.caliber})
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900">
                        Processing: {order.totalProcessingTime}h
                      </span>
                      <span className="text-sm text-gray-500">
                        Due: {order.requestedDeliveryDate.toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-blue-600 hover:text-blue-900">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Order Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Add New Order</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Client Name</label>
                  <input
                    type="text"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newOrder.clientName || ''}
                    onChange={(e) => setNewOrder({ ...newOrder, clientName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Requested Delivery Date</label>
                  <input
                    type="date"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newOrder.requestedDeliveryDate?.toISOString().split('T')[0] || ''}
                    onChange={(e) => setNewOrder({ ...newOrder, requestedDeliveryDate: new Date(e.target.value) })}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Items</label>
                    <button
                      onClick={addOrderItem}
                      className="text-blue-600 hover:text-blue-900 text-sm"
                    >
                      + Add Item
                    </button>
                  </div>
                  
                  {newOrder.items?.map((item, index) => (
                    <div key={index} className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-gray-500">Type</label>
                        <select
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          value={item.type}
                          onChange={(e) => {
                            const updatedItems = [...(newOrder.items || [])];
                            updatedItems[index] = { ...item, type: e.target.value };
                            setNewOrder({ ...newOrder, items: updatedItems });
                          }}
                        >
                          <option value="">Select Type</option>
                          <option value="Hass">Hass</option>
                          <option value="Fuerte">zutano</option>

                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-500">Caliber</label>
                        <select
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          value={item.caliber}
                          onChange={(e) => {
                            const updatedItems = [...(newOrder.items || [])];
                            updatedItems[index] = { ...item, caliber: e.target.value };
                            setNewOrder({ ...newOrder, items: updatedItems });
                          }}
                        >
                          <option value="">Select Caliber</option>
                          <option value="20">12</option>
                          <option value="16">16</option>
                          <option value="18">18</option>
                          <option value="20">20</option>
                          <option value="22">22</option>
                          <option value="24">24</option>
                          <option value="26">26</option>
                          <option value="28">28</option>
                          <option value="30">30</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-500">Quantity (pallete)</label>
                        <input
                          type="number"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          value={item.quantity || ''}
                          onChange={(e) => {
                            const updatedItems = [...(newOrder.items || [])];
                            updatedItems[index] = { ...item, quantity: Number(e.target.value) };
                            setNewOrder({ ...newOrder, items: updatedItems });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    rows={3}
                    value={newOrder.notes || ''}
                    onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitOrder}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Create Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
