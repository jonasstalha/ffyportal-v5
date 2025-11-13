import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Download, Filter, TrendingUp, TrendingDown, Activity, DollarSign, Clock, Wrench, Search, Eye, FileText } from 'lucide-react';

const HistoriqueMaintenance = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('6months');
  const [selectedEquipment, setSelectedEquipment] = useState('all');
  const [viewType, setViewType] = useState('timeline');

  // Sample data for charts
  const maintenanceData = [
    { month: 'Jan', preventive: 12, corrective: 5, cost: 4500 },
    { month: 'Fév', preventive: 15, corrective: 3, cost: 3200 },
    { month: 'Mar', preventive: 18, corrective: 7, cost: 5800 },
    { month: 'Avr', preventive: 14, corrective: 4, cost: 4100 },
    { month: 'Mai', preventive: 20, corrective: 6, cost: 6200 },
    { month: 'Jun', preventive: 16, corrective: 2, cost: 3800 }
  ];

  const equipmentData = [
    { name: 'Compresseurs', value: 35, color: '#3B82F6' },
    { name: 'Pompes', value: 25, color: '#10B981' },
    { name: 'Convoyeurs', value: 20, color: '#F59E0B' },
    { name: 'Générateurs', value: 20, color: '#EF4444' }
  ];

  const recentHistory = [
    {
      id: 'HM-001',
      date: '2024-06-15',
      equipment: 'Compresseur A1',
      type: 'Préventive',
      technician: 'Jean Dupont',
      duration: '2h 30min',
      cost: '450€',
      status: 'completed',
      description: 'Maintenance trimestrielle - Remplacement filtres'
    },
    {
      id: 'HM-002',
      date: '2024-06-14',
      equipment: 'Pompe B2',
      type: 'Corrective',
      technician: 'Marie Martin',
      duration: '4h 15min',
      cost: '800€',
      status: 'completed',
      description: 'Réparation fuite circuit hydraulique'
    },
    {
      id: 'HM-003',
      date: '2024-06-12',
      equipment: 'Convoyeur C3',
      type: 'Préventive',
      technician: 'Pierre Durand',
      duration: '1h 45min',
      cost: '200€',
      status: 'completed',
      description: 'Lubrification et contrôle roulements'
    },
    {
      id: 'HM-004',
      date: '2024-06-10',
      equipment: 'Générateur D1',
      type: 'Corrective',
      technician: 'Sophie Blanc',
      duration: '3h 20min',
      cost: '650€',
      status: 'completed',
      description: 'Remplacement batterie et contrôle alternateur'
    }
  ];

  const getTypeColor = (type) => {
    return type === 'Préventive' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-orange-100 text-orange-800 border-orange-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Historique de Maintenance</h1>
              <p className="text-gray-600">Analysez les tendances et performances de vos opérations de maintenance</p>
            </div>
            <div className="flex space-x-3">
              <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span>Filtres</span>
              </button>
              <button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Période:</label>
                <select
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="1month">1 mois</option>
                  <option value="3months">3 mois</option>
                  <option value="6months">6 mois</option>
                  <option value="1year">1 an</option>
                </select>
              </div>
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Équipement:</label>
                <select
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={selectedEquipment}
                  onChange={(e) => setSelectedEquipment(e.target.value)}
                >
                  <option value="all">Tous</option>
                  <option value="compresseurs">Compresseurs</option>
                  <option value="pompes">Pompes</option>
                  <option value="convoyeurs">Convoyeurs</option>
                  <option value="generateurs">Générateurs</option>
                </select>
              </div>
              <div className="flex items-center space-x-2 ml-auto">
                <button
                  className={`px-4 py-2 rounded-lg transition-colors ${viewType === 'timeline' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  onClick={() => setViewType('timeline')}
                >
                  Timeline
                </button>
                <button
                  className={`px-4 py-2 rounded-lg transition-colors ${viewType === 'analytics' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  onClick={() => setViewType('analytics')}
                >
                  Analytics
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex items-center text-green-600 text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span>+12%</span>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total Interventions</h3>
            <p className="text-2xl font-bold text-gray-900">142</p>
            <p className="text-xs text-gray-500 mt-1">Ce mois-ci</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex items-center text-red-600 text-sm">
                <TrendingDown className="h-4 w-4 mr-1" />
                <span>-8%</span>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Temps Moyen</h3>
            <p className="text-2xl font-bold text-gray-900">2h 45min</p>
            <p className="text-xs text-gray-500 mt-1">Par intervention</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex items-center text-green-600 text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span>+5%</span>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Coût Total</h3>
            <p className="text-2xl font-bold text-gray-900">28,450€</p>
            <p className="text-xs text-gray-500 mt-1">Ce mois-ci</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Wrench className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex items-center text-green-600 text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span>+15%</span>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Taux Préventif</h3>
            <p className="text-2xl font-bold text-gray-900">72%</p>
            <p className="text-xs text-gray-500 mt-1">Vs correctif</p>
          </div>
        </div>

        {viewType === 'analytics' ? (
          // Analytics View
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Maintenance Trend Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Évolution des Maintenances</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={maintenanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="preventive" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', strokeWidth: 2, r: 6 }} />
                  <Line type="monotone" dataKey="corrective" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', strokeWidth: 2, r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Equipment Distribution */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par Équipement</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={equipmentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {equipmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {equipmentData.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-gray-600">{item.name}</span>
                    <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost Analysis */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Analyse des Coûts</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={maintenanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="cost" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          // Timeline View
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Historique Récent</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher dans l'historique..."
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                {recentHistory.map((item, index) => (
                  <div key={item.id} className="relative">
                    {/* Timeline connector */}
                    {index !== recentHistory.length - 1 && (
                      <div className="absolute left-6 top-12 w-0.5 h-16 bg-gray-200"></div>
                    )}
                    
                    <div className="flex items-start space-x-4">
                      {/* Timeline dot */}
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                        <Wrench className="h-5 w-5 text-white" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">{item.equipment}</h4>
                            <p className="text-sm text-gray-500">{item.id} • {new Date(item.date).toLocaleDateString('fr-FR')}</p>
                          </div>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getTypeColor(item.type)}`}>
                            {item.type}
                          </span>
                        </div>
                        
                        <p className="text-gray-700 mb-3">{item.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Technicien:</span>
                            <p className="font-medium">{item.technician}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Durée:</span>
                            <p className="font-medium">{item.duration}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Coût:</span>
                            <p className="font-medium text-blue-600">{item.cost}</p>
                          </div>
                          <div className="flex items-center justify-end">
                            <button className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium">
                              <Eye className="h-4 w-4" />
                              <span>Détails</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="text-center mt-8">
                <button className="bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 px-6 py-3 rounded-xl font-medium transition-all duration-200">
                  Charger plus d'historique
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Reports Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Rapports Récents</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'Rapport Mensuel - Juin 2024', date: '15/06/2024', size: '2.4 MB', type: 'PDF' },
                { name: 'Analyse Coûts Q2 2024', date: '12/06/2024', size: '1.8 MB', type: 'Excel' },
                { name: 'Performance Équipements', date: '10/06/2024', size: '3.1 MB', type: 'PDF' },
              ].map((report, index) => (
                <div key={index} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{report.name}</h4>
                    <p className="text-sm text-gray-500">{report.date} • {report.size}</p>
                  </div>
                  <button className="text-blue-600 hover:text-blue-700">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoriqueMaintenance;