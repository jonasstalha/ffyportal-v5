import React, { useState } from 'react';
import { Settings, Wrench, AlertTriangle, Clock, Calendar, BarChart, CheckCircle, XCircle } from 'lucide-react';

interface MaintenanceTask {
  id: string;
  equipmentId: string;
  equipmentName: string;
  taskType: 'preventive' | 'corrective' | 'predictive';
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue';
  priority: 'high' | 'medium' | 'low';
  scheduledDate: Date;
  assignedTo: string;
  description: string;
}

const AutomatisationDeMaintenance = () => {
  const [activeView, setActiveView] = useState<'calendar' | 'list'>('list');
  const [statusFilter, setStatusFilter] = useState('all');

  const mockTasks: MaintenanceTask[] = [
    {
      id: 'MT001',
      equipmentId: 'EQ-123',
      equipmentName: 'Conveyor Belt A',
      taskType: 'preventive',
      status: 'scheduled',
      priority: 'high',
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      assignedTo: 'John Smith',
      description: 'Monthly belt tension check and lubrication'
    },
    {
      id: 'MT002',
      equipmentId: 'EQ-456',
      equipmentName: 'Packaging Unit B',
      taskType: 'corrective',
      status: 'in-progress',
      priority: 'medium',
      scheduledDate: new Date(),
      assignedTo: 'Sarah Johnson',
      description: 'Replace worn sealing components'
    }
  ];

  const getStatusColor = (status: MaintenanceTask['status']) => {
    const colors = {
      'scheduled': 'bg-blue-100 text-blue-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'overdue': 'bg-red-100 text-red-800'
    };
    return colors[status];
  };

  const getPriorityIcon = (priority: MaintenanceTask['priority']) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'medium':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'low':
        return <Wrench className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Maintenance Automation</h1>
          <p className="text-gray-600">Schedule and track maintenance tasks automatically</p>
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Scheduled Tasks</p>
                  <p className="text-2xl font-semibold text-blue-900">24</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">In Progress</p>
                  <p className="text-2xl font-semibold text-yellow-900">8</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Completed</p>
                  <p className="text-2xl font-semibold text-green-900">156</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Overdue</p>
                  <p className="text-2xl font-semibold text-red-900">3</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
          </div>
        </div>

        {/* View Toggle and Filters */}
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <button
              className={`px-4 py-2 rounded-lg ${
                activeView === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'
              }`}
              onClick={() => setActiveView('list')}
            >
              List View
            </button>
            <button
              className={`px-4 py-2 rounded-lg ${
                activeView === 'calendar' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'
              }`}
              onClick={() => setActiveView('calendar')}
            >
              Calendar View
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Tasks List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Task Details
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Equipment
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mockTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {getPriorityIcon(task.priority)}
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{task.id}</div>
                          <div className="text-sm text-gray-500">{task.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{task.equipmentName}</div>
                      <div className="text-sm text-gray-500">{task.equipmentId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                        {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {task.assignedTo}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {task.scheduledDate.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Maintenance Efficiency</h3>
            <div className="flex items-center">
              <BarChart className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900">94%</p>
                <p className="text-sm text-gray-500">Tasks completed on time</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Equipment Uptime</h3>
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900">98.5%</p>
                <p className="text-sm text-gray-500">Average uptime</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Response Time</h3>
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900">2.5h</p>
                <p className="text-sm text-gray-500">Average response time</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomatisationDeMaintenance;
