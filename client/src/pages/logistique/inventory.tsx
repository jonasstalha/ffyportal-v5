import React, { useState, useEffect } from 'react';
import './inventory.css'; // Import the CSS file with animation definitions
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, getDocs as getDocsAgain } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  Search, Filter, Plus, Edit2, Trash2, Check, X, AlertCircle,
  ArrowUpDown, Package, Calendar, DollarSign, FileText,
  ChevronRight, ChevronDown, Tag, Truck, Clipboard, ChevronUp,
  History, BarChart2, RefreshCw, Link, Minus, AlertTriangle
} from "lucide-react";

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("entryDate");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [viewMode, setViewMode] = useState("table"); // "table" or "grid"
  const [showConsumptionHistory, setShowConsumptionHistory] = useState(false);
  const [consumptionHistory, setConsumptionHistory] = useState([]);
  const [consumptionLoading, setConsumptionLoading] = useState(false);
  const [showConsumptionForm, setShowConsumptionForm] = useState(false);
  const [selectedItemForConsumption, setSelectedItemForConsumption] = useState(null);

  const initialFormState = {
    itemType: '',
    itemName: '',
    quantity: '',
    unit: '',
    entryDate: new Date().toISOString().split('T')[0],
    supplier: '',
    isPaid: false,
    notes: '',
    category: 'logistics', // 'logistics' or 'production'
    alertThreshold: '',
    isConsumable: true,
  };

  const initialConsumptionState = {
    itemId: '',
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    department: 'production',
  };

  const [consumptionForm, setConsumptionForm] = useState(initialConsumptionState);

  const [form, setForm] = useState(initialFormState);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "inventory"));
      const inventoryData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Set default values for new fields if they don't exist
        category: doc.data().category || 'logistics',
        alertThreshold: doc.data().alertThreshold || '',
        isConsumable: doc.data().isConsumable !== undefined ? doc.data().isConsumable : true
      }));
      setInventory(inventoryData);
    } catch (e) {
      console.error("Error fetching inventory: ", e);
      showNotification("Error loading inventory", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConsumptionHistory = async (itemId = null) => {
    setConsumptionLoading(true);
    try {
      let consumptionQuery;

      if (itemId) {
        // Fetch consumption history for a specific item
        consumptionQuery = query(
          collection(db, "consumption"),
          where("itemId", "==", itemId)
        );
      } else {
        // Fetch all consumption history
        consumptionQuery = collection(db, "consumption");
      }

      const querySnapshot = await getDocs(consumptionQuery);
      const historyData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Sort by date descending
      historyData.sort((a, b) => new Date(b.date) - new Date(a.date));

      setConsumptionHistory(historyData);
    } catch (e) {
      console.error("Error fetching consumption history: ", e);
      showNotification("Error loading consumption history", "error");
    } finally {
      setConsumptionLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    // Also fetch consumption history when component mounts
    fetchConsumptionHistory();
  }, []);

  const handleConsumptionChange = (e) => {
    const { name, value } = e.target;
    setConsumptionForm({ ...consumptionForm, [name]: value });
  };

  const openConsumptionForm = (item) => {
    setSelectedItemForConsumption(item);
    setConsumptionForm({
      ...initialConsumptionState,
      itemId: item.id,
    });
    setShowConsumptionForm(true);
  };

  const resetConsumptionForm = () => {
    setConsumptionForm(initialConsumptionState);
    setSelectedItemForConsumption(null);
    setShowConsumptionForm(false);
  };

  const handleConsumptionSubmit = async (e) => {
    if (e) e.preventDefault();

    // Basic validation
    if (!consumptionForm.quantity || !consumptionForm.date) {
      showNotification("Please fill all required fields", "error");
      return;
    }

    const consumedQuantity = parseFloat(consumptionForm.quantity);
    const item = inventory.find(i => i.id === consumptionForm.itemId);

    if (!item) {
      showNotification("Item not found", "error");
      return;
    }

    const currentQuantity = parseFloat(item.quantity);

    if (consumedQuantity > currentQuantity) {
      showNotification(`Cannot consume more than available quantity (${currentQuantity} ${item.unit})`, "error");
      return;
    }

    setFormSubmitting(true);

    try {
      // 1. Add consumption record
      const consumptionData = {
        ...consumptionForm,
        quantity: consumedQuantity,
        itemName: item.itemName,
        itemType: item.itemType,
        unit: item.unit,
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, "consumption"), consumptionData);

      // 2. Update inventory quantity
      const newQuantity = currentQuantity - consumedQuantity;
      await updateDoc(doc(db, "inventory", item.id), { quantity: newQuantity });

      // 3. Update local state
      setInventory(inventory.map(i =>
        i.id === item.id ? { ...i, quantity: newQuantity } : i
      ));

      // 4. Refresh consumption history
      fetchConsumptionHistory();

      showNotification("Consumption recorded successfully");
      resetConsumptionForm();
    } catch (e) {
      console.error("Error recording consumption: ", e);
      showNotification("Error recording consumption", "error");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const resetForm = () => {
    setForm(initialFormState);
    setEditingItem(null);
    setShowForm(false);
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    // Basic validation
    if (!form.itemName || !form.itemType || !form.quantity || !form.unit) {
      showNotification("Please fill all required fields", "error");
      return;
    }

    setFormSubmitting(true);

    const submitData = async () => {
      try {
        // Prepare form data with all fields
        const formData = {
          ...form,
          // Ensure numeric fields are stored as numbers
          quantity: parseFloat(form.quantity),
          alertThreshold: form.alertThreshold ? parseFloat(form.alertThreshold) : null,
          // Ensure boolean fields are stored as booleans
          isPaid: Boolean(form.isPaid),
          isConsumable: Boolean(form.isConsumable)
        };

        if (editingItem) {
          // Update existing item
          await updateDoc(doc(db, "inventory", editingItem.id), formData);
          setInventory(inventory.map(item =>
            item.id === editingItem.id ? { id: editingItem.id, ...formData } : item
          ));
          showNotification("Item updated successfully");
        } else {
          // Add new item
          const docRef = await addDoc(collection(db, "inventory"), formData);
          setInventory([...inventory, { id: docRef.id, ...formData }]);
          showNotification("Item added successfully");
        }
        resetForm();
      } catch (e) {
        console.error("Error saving document: ", e);
        showNotification("Error saving item", "error");
      } finally {
        setFormSubmitting(false);
      }
    };

    submitData();
  };

  const handleEdit = (item) => {
    setForm({
      itemType: item.itemType || '',
      itemName: item.itemName || '',
      quantity: item.quantity || '',
      unit: item.unit || '',
      entryDate: item.entryDate || new Date().toISOString().split('T')[0],
      supplier: item.supplier || '',
      isPaid: item.isPaid || false,
      notes: item.notes || '',
      // New fields
      category: item.category || 'logistics',
      alertThreshold: item.alertThreshold || '',
      isConsumable: item.isConsumable !== undefined ? item.isConsumable : true,
    });
    setEditingItem(item);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "inventory", id));
      setInventory(inventory.filter(item => item.id !== id));
      setShowConfirmDelete(null);
      showNotification("Item deleted successfully");
    } catch (e) {
      console.error("Error deleting document: ", e);
      showNotification("Error deleting item", "error");
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const toggleItemExpansion = (id) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  // Filter and sort inventory items
  const filteredInventory = inventory
    .filter(item => {
      // Apply filter
      if (filter === "all") return true;
      if (filter === "paid") return item.isPaid;
      if (filter === "unpaid") return !item.isPaid;
      return item.itemType === filter;
    })
    .filter(item => {
      // Apply search
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        (item.itemName || '').toLowerCase().includes(search) ||
        (item.supplier || '').toLowerCase().includes(search) ||
        (item.notes || '').toLowerCase().includes(search) ||
        (item.itemType || '').toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      // Apply sorting
      const aValue = a[sortBy] || '';
      const bValue = b[sortBy] || '';

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  // Get unique item types for filter dropdown
  const itemTypes = ["all", "paid", "unpaid", ...new Set(inventory.map(item => item.itemType).filter(Boolean))];

  // Get inventory stats
  const stats = {
    total: inventory.length,
    paid: inventory.filter(item => item.isPaid).length,
    unpaid: inventory.filter(item => !item.isPaid).length,
    types: Object.entries(inventory.reduce((acc, item) => {
      if (item.itemType) {
        acc[item.itemType] = (acc[item.itemType] || 0) + 1;
      }
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3) // Top 3 types
  };

  // Icon mapper for item types
  const getItemTypeIcon = (type) => {
    const iconMap = {
      'Pallet': <Package className="h-5 w-5 text-amber-600" />,
      'Box': <Package className="h-5 w-5 text-blue-600" />,
      'Packaging': <Package className="h-5 w-5 text-green-600" />,
      'Stickers': <Tag className="h-5 w-5 text-purple-600" />,
      'Labels': <Tag className="h-5 w-5 text-indigo-600" />,
      'Tools': <Clipboard className="h-5 w-5 text-gray-600" />,
      'Other': <Package className="h-5 w-5 text-gray-600" />,
    };

    return iconMap[type] || <Package className="h-5 w-5 text-gray-600" />;
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-all duration-300 notification-animation ${notification.type === 'error' ? 'bg-red-100 text-red-800 border-l-4 border-red-500' : 'bg-green-100 text-green-800 border-l-4 border-green-500'
            }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <Check className="h-5 w-5" />
          )}
          <p>{notification.message}</p>
        </div>
      )}

      {/* Consumption Form Modal */}
      {showConsumptionForm && selectedItemForConsumption && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Record Consumption</h2>
              <button
                onClick={resetConsumptionForm}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConsumptionSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item
                </label>
                <div className="p-2 border rounded-md bg-gray-50">
                  {selectedItemForConsumption.itemName} ({selectedItemForConsumption.itemType})
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Stock
                </label>
                <div className="p-2 border rounded-md bg-gray-50">
                  {selectedItemForConsumption.quantity} {selectedItemForConsumption.unit}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consumption Quantity*
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    name="quantity"
                    value={consumptionForm.quantity}
                    onChange={handleConsumptionChange}
                    className="w-full p-2 border rounded-md"
                    min="0.01"
                    max={selectedItemForConsumption.quantity}
                    step="0.01"
                    required
                  />
                  <span className="ml-2">{selectedItemForConsumption.unit}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date*
                </label>
                <input
                  type="date"
                  name="date"
                  value={consumptionForm.date}
                  onChange={handleConsumptionChange}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  name="department"
                  value={consumptionForm.department}
                  onChange={handleConsumptionChange}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="production">Production</option>
                  <option value="logistics">Logistics</option>
                  <option value="administration">Administration</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={consumptionForm.notes}
                  onChange={handleConsumptionChange}
                  className="w-full p-2 border rounded-md"
                  rows="2"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={resetConsumptionForm}
                  className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? (
                    <>
                      <RefreshCw className="animate-spin mr-2" size={16} />
                      Processing...
                    </>
                  ) : (
                    'Record Consumption'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header and Add Button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-800">
            <Package className="h-7 w-7 text-blue-600" />
            Inventory Management
          </h1>
          <p className="text-gray-500 mt-1">Manage and track your inventory items</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowConsumptionHistory(!showConsumptionHistory)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${showConsumptionHistory
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-green-600 text-white hover:bg-green-700'
              }`}
          >
            {showConsumptionHistory ? (
              <>Hide Consumption History</>
            ) : (
              <><History size={16} /> View Consumption History</>
            )}
          </button>

          <button
            onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${showForm
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            {showForm ? (
              <>Hide Form</>
            ) : (
              <><Plus size={16} /> Add New Item</>
            )}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-4 border border-blue-100 shadow-sm">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-blue-700">Total Items</p>
            <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-green-50 rounded-xl p-4 flex items-center gap-4 border border-green-100 shadow-sm">
          <div className="bg-green-100 p-3 rounded-lg">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-green-700">Paid Items</p>
            <p className="text-2xl font-bold text-green-900">{stats.paid}</p>
          </div>
        </div>

        <div className="bg-red-50 rounded-xl p-4 flex items-center gap-4 border border-red-100 shadow-sm">
          <div className="bg-red-100 p-3 rounded-lg">
            <X className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-red-700">Unpaid Items</p>
            <p className="text-2xl font-bold text-red-900">{stats.unpaid}</p>
          </div>
        </div>

        <div className="bg-purple-50 rounded-xl p-4 flex items-center gap-4 border border-purple-100 shadow-sm">
          <div className="bg-purple-100 p-3 rounded-lg">
            <Tag className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-purple-700">Top Category</p>
            <p className="text-2xl font-bold text-purple-900">
              {stats.types.length > 0 ? stats.types[0][0] : 'None'}
            </p>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 transition-all duration-300" style={{ animation: 'fadeInDown 0.3s' }}>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800">
            {editingItem ? (
              <><Edit2 size={20} className="text-blue-600" /> Edit Item</>
            ) : (
              <><Plus size={20} className="text-green-600" /> Add New Item</>
            )}
          </h2>

          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Package size={14} /> Item Type <span className="text-red-500">*</span>
              </label>
              <select
                name="itemType"
                value={form.itemType}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                required
              >
                <option value="">Select Item Type</option>
                <option>Pallet</option>
                <option>Box</option>
                <option>Packaging</option>
                <option>Stickers</option>
                <option>Labels</option>
                <option>Tools</option>
                <option>Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Tag size={14} /> Item Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="itemName"
                value={form.itemName}
                onChange={handleChange}
                placeholder="Enter item name"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Clipboard size={14} /> Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                placeholder="Enter quantity"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Tag size={14} /> Unit <span className="text-red-500">*</span>
              </label>
              <select
                name="unit"
                value={form.unit}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                required
              >
                <option value="">Select Unit</option>
                <option>kg</option>
                <option>units</option>
                <option>boxes</option>
                <option>rolls</option>
                <option>liters</option>
                <option>Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Calendar size={14} /> Entry Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="entryDate"
                value={form.entryDate}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Truck size={14} /> Supplier
              </label>
              <input
                type="text"
                name="supplier"
                value={form.supplier}
                onChange={handleChange}
                placeholder="Enter supplier name"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <FileText size={14} /> Notes
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Additional notes (optional)"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all h-24"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <BarChart2 size={14} /> Category
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="logistics">Logistics</option>
                <option value="production">Production</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <AlertTriangle size={14} /> Alert Threshold
              </label>
              <input
                type="number"
                name="alertThreshold"
                value={form.alertThreshold}
                onChange={handleChange}
                placeholder="Minimum stock level before alert"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPaid"
                name="isPaid"
                checked={form.isPaid}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all"
              />
              <label htmlFor="isPaid" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <DollarSign size={14} /> Paid
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isConsumable"
                name="isConsumable"
                checked={form.isConsumable}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all"
              />
              <label htmlFor="isConsumable" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Link size={14} /> Consumable (can be used in production)
              </label>
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all"
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 ${formSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
              >
                {formSubmitting ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    {editingItem ? 'Updating...' : 'Adding...'}
                  </>
                ) : (
                  <>{editingItem ? 'Update Item' : 'Add Item'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Consumption History Section */}
      {showConsumptionHistory && (
        <div className="mb-8 bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Consumption History</h2>
            <button
              onClick={() => setShowConsumptionHistory(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          {consumptionLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : consumptionHistory.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500">No consumption records found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {consumptionHistory.map((record, index) => (
                    <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.itemName} ({record.itemType})
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.quantity} {record.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.department}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {record.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inventory List */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
              <Package className="h-5 w-5 text-blue-600" /> Inventory List
            </h2>

            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1 rounded-lg text-sm ${viewMode === "table"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:bg-gray-200"
                  }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1 rounded-lg text-sm ${viewMode === "grid"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:bg-gray-200"
                  }`}
              >
                Grid
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg appearance-none w-full md:w-40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                {itemTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading inventory...</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center">
            <div className="bg-gray-100 rounded-full p-4 mb-4">
              <AlertCircle size={40} className="text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-800 mb-1">No items found</p>
            <p className="text-gray-500 max-w-md mx-auto">
              {inventory.length === 0
                ? "Your inventory is empty. Add your first item using the 'Add New Item' button above."
                : "No items match your current search or filter. Try adjusting your criteria."}
            </p>
            {inventory.length === 0 && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <Plus size={16} /> Add First Item
              </button>
            )}
          </div>
        ) : viewMode === "table" ? (
          // Table View
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer border-b" onClick={() => handleSort("itemName")}>
                    <div className="flex items-center gap-1">
                      Item
                      {sortBy === "itemName" && (
                        <ArrowUpDown size={14} className={sortOrder === "asc" ? "transform rotate-180" : ""} />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer border-b" onClick={() => handleSort("itemType")}>
                    <div className="flex items-center gap-1">
                      Type
                      {sortBy === "itemType" && (
                        <ArrowUpDown size={14} className={sortOrder === "asc" ? "transform rotate-180" : ""} />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer border-b" onClick={() => handleSort("quantity")}>
                    <div className="flex items-center gap-1">
                      Quantity
                      {sortBy === "quantity" && (
                        <ArrowUpDown size={14} className={sortOrder === "asc" ? "transform rotate-180" : ""} />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer border-b" onClick={() => handleSort("entryDate")}>
                    <div className="flex items-center gap-1">
                      Date
                      {sortBy === "entryDate" && (
                        <ArrowUpDown size={14} className={sortOrder === "asc" ? "transform rotate-180" : ""} />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer border-b" onClick={() => handleSort("supplier")}>
                    <div className="flex items-center gap-1">
                      Supplier
                      {sortBy === "supplier" && (
                        <ArrowUpDown size={14} className={sortOrder === "asc" ? "transform rotate-180" : ""} />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 cursor-pointer border-b" onClick={() => handleSort("isPaid")}>
                    <div className="flex items-center gap-1">
                      Status
                      {sortBy === "isPaid" && (
                        <ArrowUpDown size={14} className={sortOrder === "asc" ? "transform rotate-180" : ""} />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr
                      className={`border-b hover:bg-blue-50 transition-colors cursor-pointer ${expandedItem === item.id ? 'bg-blue-50' : ''}`}
                      onClick={() => toggleItemExpansion(item.id)}
                    >
                      <td className="px-4 py-3 font-medium text-blue-700">{item.itemName}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          {getItemTypeIcon(item.itemType)}
                          <span>{item.itemType}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-sm">{item.entryDate}</td>
                      <td className="px-4 py-3 text-sm">{item.supplier || '-'}</td>
                      <td className="px-4 py-3">
                        {item.isPaid ? (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            <Check size={12} className="mr-1" /> Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                            <X size={12} className="mr-1" /> Unpaid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          {item.isConsumable && (
                            <button
                              onClick={() => openConsumptionForm(item)}
                              className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all"
                              title="Record Consumption"
                            >
                              <Minus size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            onClick={() => setShowConfirmDelete(item.id)}
                            className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row with additional details */}
                    {expandedItem === item.id && (
                      <tr className="bg-blue-50">
                        <td colSpan="7" className="px-4 py-3 animate-fadeIn">
                          <div className="bg-white rounded-lg border border-blue-200 p-4 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-500">Item Details</h4>
                                <p className="text-sm mt-1">
                                  <span className="font-medium">Type:</span> {item.itemType}<br />
                                  <span className="font-medium">Name:</span> {item.itemName}<br />
                                  <span className="font-medium">Quantity:</span> {item.quantity} {item.unit}
                                </p>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold text-gray-500">Supply Information</h4>
                                <p className="text-sm mt-1">
                                  <span className="font-medium">Supplier:</span> {item.supplier || 'Not specified'}<br />
                                  <span className="font-medium">Entry Date:</span> {item.entryDate}<br />
                                  <span className="font-medium">Payment:</span> {item.isPaid ? 'Paid' : 'Unpaid'}
                                </p>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold text-gray-500">Notes</h4>
                                <p className="text-sm mt-1 text-gray-700">
                                  {item.notes || 'No additional notes'}
                                </p>
                              </div>
                            </div>

                            <div className="flex justify-end mt-3 gap-2">
                              <button
                                onClick={() => handleEdit(item)}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1"
                              >
                                <Edit2 size={14} /> Edit
                              </button>
                              <button
                                onClick={() => setShowConfirmDelete(item.id)}
                                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center gap-1"
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // Grid View
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInventory.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className="p-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${item.isPaid ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                      {getItemTypeIcon(item.itemType)}
                    </div>
                    <div>
                      <h3 className="font-medium text-blue-700">{item.itemName}</h3>
                      <p className="text-sm text-gray-500">{item.itemType}</p>
                    </div>
                  </div>

                  {item.isPaid ? (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      <Check size={12} className="mr-1" /> Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                      <X size={12} className="mr-1" /> Unpaid
                    </span>
                  )}
                </div>

                <div className="px-4 pb-2">
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <p className="text-gray-500">Quantity</p>
                      <p className="font-medium">{item.quantity} {item.unit}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Supplier</p>
                      <p className="font-medium">{item.supplier || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Entry Date</p>
                      <p className="font-medium">{item.entryDate}</p>
                    </div>
                  </div>

                  {item.notes && (
                    <div className="border-t border-gray-100 pt-2 mb-3">
                      <p className="text-xs text-gray-500">Notes</p>
                      <p className="text-sm text-gray-700 truncate">{item.notes}</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 p-3 bg-gray-50 flex justify-end gap-2">
                  {item.isConsumable && (
                    <button
                      onClick={() => openConsumptionForm(item)}
                      className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all"
                      title="Record Consumption"
                    >
                      <Minus size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>

                  <button
                    onClick={() => setShowConfirmDelete(item.id)}
                    className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500 flex justify-between items-center">
          <span>
            Showing {filteredInventory.length} of {inventory.length} items
          </span>

          {filteredInventory.length > 0 && (
            <div className="flex items-center gap-2">
              <span>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setSortOrder("asc");
                }}
                className="py-1 px-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="itemName">Item Name</option>
                <option value="itemType">Type</option>
                <option value="quantity">Quantity</option>
                <option value="entryDate">Date</option>
                <option value="supplier">Supplier</option>
                <option value="isPaid">Payment Status</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="p-1 border border-gray-300 rounded-lg"
              >
                {sortOrder === "asc" ? (
                  <ChevronDown size={16} className="text-gray-600" />
                ) : (
                  <ChevronUp size={16} className="text-gray-600" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 animate-scaleIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Confirm Deletion</h3>
            </div>

            <p className="mb-6 text-gray-600">
              Are you sure you want to delete this item? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showConfirmDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center gap-2"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
  <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
        
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Inventory;