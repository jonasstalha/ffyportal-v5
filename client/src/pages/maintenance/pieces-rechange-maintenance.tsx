import React, { useState } from 'react';
import { Package, Search, Filter, AlertCircle, Truck, BarChart2, Settings } from 'lucide-react';

interface SparePart {
  id: string;
  name: string;
  category: string;
  stock: number;
  minimumStock: number;
  location: string;
  lastRestocked: Date;
  supplier: string;
  price: number;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
}

const PiecesDeRechangeMaintenance = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const mockParts: SparePart[] = [
    {
      id: 'SP001',
      name: 'Conveyor Belt Motor',
      category: 'Motors',
      stock: 3,
      minimumStock: 2,
      location: 'Warehouse A-12',
      lastRestocked: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      supplier: 'Industrial Motors Inc.',
      price: 450.00,
      status: 'in-stock'
    },
    {
      id: 'SP002',
      name: 'Hydraulic Pump',
      category: 'Hydraulics',
      stock: 1,
      minimumStock: 2,
      location: 'Warehouse B-03',
      lastRestocked: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      supplier: 'Fluid Systems Co.',
      price: 299.99,
      status: 'low-stock'
    }
  ];

  const getStatusColor = (status: SparePart['status']) => {
    const colors = {
      'in-stock': 'bg-green-100 text-green-800',
      'low-stock': 'bg-yellow-100 text-yellow-800',
      'out-of-stock': 'bg-red-100 text-red-800'
    };
    return colors[status];
  };

  const getStatusText = (status: SparePart['status']) => {
    return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Spare Parts Inventory</h1>
          <p className="text-gray-600">Manage maintenance spare parts and equipment inventory</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Package className="h-10 w-10 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Parts</p>
                <p className="text-2xl font-semibold text-gray-900">248</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <AlertCircle className="h-10 w-10 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Low Stock</p>
                <p className="text-2xl font-semibold text-gray-900">12</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Truck className="h-10 w-10 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">On Order</p>
                <p className="text-2xl font-semibold text-gray-900">15</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <BarChart2 className="h-10 w-10 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Value</p>
                <p className="text-2xl font-semibold text-gray-900">$45,829</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search parts..."
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <select
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="motors">Motors</option>
              <option value="hydraulics">Hydraulics</option>
              <option value="electronics">Electronics</option>
              <option value="mechanical">Mechanical Parts</option>
            </select>
          </div>

          <div className="relative">
            <Settings className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <select
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Parts Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Part Details
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Info
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockParts.map((part) => (
                <tr key={part.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{part.name}</span>
                      <span className="text-sm text-gray-500">{part.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900">Stock: {part.stock}</span>
                      <span className="text-sm text-gray-500">Min: {part.minimumStock}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900">{part.location}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900">{part.supplier}</span>
                      <span className="text-sm text-gray-500">${part.price.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(part.status)}`}>
                      {getStatusText(part.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stock Level Chart */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Level Trends</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Stock level visualization chart will be implemented here
          </div>
        </div>
      </div>
    </div>
  );
};

export default PiecesDeRechangeMaintenance;
