import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Calendar, 
  Users, 
  Download, 
  Search, 
  Filter,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  BarChart3,
  Eye,
  FileText,
  AlertCircle
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { 
  collection, 
  onSnapshot,
  query,
  orderBy,
  where,
  Timestamp 
} from 'firebase/firestore';

// Interfaces
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  hourlyRate: number;
  status: string;
}

interface WorkSchedule {
  id: string;
  employeeId: string;
  date: string;
  entryTime: string;
  exitTime: string;
  pauseDuration: number;
  machineCollapseDuration: number;
  hoursWorked: number;
  salary: number;
  status: 'present' | 'absent' | 'late' | 'overtime';
  notes?: string;
  checked: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface EmployeeWorkSummary {
  employee: Employee;
  totalHours: number;
  totalSalary: number;
  workDays: number;
  averageHoursPerDay: number;
  overtimeHours: number;
  lastWorked: string;
  schedules: WorkSchedule[];
}

const WorkHoursHistory: React.FC = () => {
  // State management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0] // today
  });
  const [sortBy, setSortBy] = useState<'name' | 'hours' | 'salary' | 'days'>('hours');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // UI states
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');

  // Firebase listeners
  useEffect(() => {
    // Listen to employees
    const unsubscribeEmployees = onSnapshot(
      collection(db, 'personnel'),
      (snapshot) => {
        const employeesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Employee[];
        setEmployees(employeesData);
        setLoading(false);
      }
    );

    return () => unsubscribeEmployees();
  }, []);

  // Listen to schedules with date range filter - FETCH ALL SAVED RECORDS
  useEffect(() => {
    console.log('🔄 FETCHING WORK SCHEDULES from Firebase...', {
      dateRange,
      collection: 'work_schedules'
    });
    
    const unsubscribeSchedules = onSnapshot(
      query(
        collection(db, 'work_schedules'),
        where('date', '>=', dateRange.start),
        where('date', '<=', dateRange.end),
        // Removed checked filter to show ALL saved salary data
        orderBy('date', 'desc')
      ),
      (snapshot) => {
        const schedulesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WorkSchedule[];
        
        console.log('📊 FETCHED SCHEDULES DATA:', {
          totalRecords: schedulesData.length,
          dateRange,
          sampleRecord: schedulesData[0] || 'No records found',
          allFields: schedulesData.length > 0 ? Object.keys(schedulesData[0]) : []
        });
        
        // Validate data integrity
        schedulesData.forEach(schedule => {
          if (!schedule.employeeId || !schedule.date) {
            console.error('⚠️ INVALID SCHEDULE DATA:', schedule);
          }
          if (schedule.hoursWorked < 0 || schedule.salary < 0) {
            console.error('⚠️ NEGATIVE VALUES DETECTED:', schedule);
          }
        });
        
        setSchedules(schedulesData);
      },
      (error) => {
        console.error('❌ FIREBASE FETCH ERROR:', error);
      }
    );

    return () => unsubscribeSchedules();
  }, [dateRange]);

  // Process employee work summaries
  const employeeWorkSummaries = useMemo(() => {
    console.log('📈 PROCESSING EMPLOYEE SUMMARIES...', {
      totalEmployees: employees.length,
      totalSchedules: schedules.length
    });
    
    const summaries: EmployeeWorkSummary[] = employees.map(employee => {
      const employeeSchedules = schedules.filter(s => s.employeeId === employee.id);
      
      console.log(`👤 Processing ${employee.firstName} ${employee.lastName}:`, {
        employeeId: employee.id,
        scheduleCount: employeeSchedules.length,
        schedules: employeeSchedules.map(s => ({
          date: s.date,
          hours: s.hoursWorked,
          salary: s.salary,
          pause: s.pauseDuration,
          machine: s.machineCollapseDuration
        }))
      });
      
      const totalHours = employeeSchedules.reduce((sum, s) => sum + (s.hoursWorked || 0), 0);
      const totalSalary = employeeSchedules.reduce((sum, s) => sum + (s.salary || 0), 0);
      const workDays = employeeSchedules.length;
      const averageHoursPerDay = workDays > 0 ? totalHours / workDays : 0;
      const overtimeHours = employeeSchedules.reduce((sum, s) => sum + Math.max(0, (s.hoursWorked || 0) - 8), 0);
      const lastWorked = employeeSchedules.length > 0 ? employeeSchedules[0].date : 'Never';

      return {
        employee,
        totalHours: Number(totalHours.toFixed(2)),
        totalSalary,
        workDays,
        averageHoursPerDay: Number(averageHoursPerDay.toFixed(2)),
        overtimeHours: Number(overtimeHours.toFixed(2)),
        lastWorked,
        schedules: employeeSchedules
      };
    });

    // Filter summaries
    let filtered = summaries.filter(summary => {
      const fullName = `${summary.employee.firstName} ${summary.employee.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                           summary.employee.position.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesEmployee = !selectedEmployee || summary.employee.id === selectedEmployee;
      const matchesDepartment = !selectedDepartment || summary.employee.department === selectedDepartment;
      
      return matchesSearch && matchesEmployee && matchesDepartment;
    });

    // Sort summaries
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = `${a.employee.firstName} ${a.employee.lastName}`;
          bValue = `${b.employee.firstName} ${b.employee.lastName}`;
          break;
        case 'hours':
          aValue = a.totalHours;
          bValue = b.totalHours;
          break;
        case 'salary':
          aValue = a.totalSalary;
          bValue = b.totalSalary;
          break;
        case 'days':
          aValue = a.workDays;
          bValue = b.workDays;
          break;
        default:
          aValue = a.totalHours;
          bValue = b.totalHours;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [employees, schedules, searchTerm, selectedEmployee, selectedDepartment, sortBy, sortOrder]);

  // Overall statistics
  const overallStats = useMemo(() => {
    const totalEmployees = employeeWorkSummaries.length;
    const activeEmployees = employeeWorkSummaries.filter(s => s.workDays > 0).length;
    const totalHours = employeeWorkSummaries.reduce((sum, s) => sum + s.totalHours, 0);
    const totalSalary = employeeWorkSummaries.reduce((sum, s) => sum + s.totalSalary, 0);
    const totalOvertimeHours = employeeWorkSummaries.reduce((sum, s) => sum + s.overtimeHours, 0);
    const averageHoursPerEmployee = activeEmployees > 0 ? totalHours / activeEmployees : 0;
    const averageSalaryPerEmployee = activeEmployees > 0 ? totalSalary / activeEmployees : 0;

    return {
      totalEmployees,
      activeEmployees,
      totalHours: Number(totalHours.toFixed(2)),
      totalSalary,
      totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
      averageHoursPerEmployee: Number(averageHoursPerEmployee.toFixed(2)),
      averageSalaryPerEmployee: Math.round(averageSalaryPerEmployee)
    };
  }, [employeeWorkSummaries]);

  // Export to CSV
  const exportToCSV = () => {
    const csvData = employeeWorkSummaries.map(summary => [
      `${summary.employee.firstName} ${summary.employee.lastName}`,
      summary.employee.department,
      summary.employee.position,
      summary.totalHours,
      summary.workDays,
      summary.averageHoursPerDay,
      summary.overtimeHours,
      summary.totalSalary,
      summary.lastWorked
    ].join(',')).join('\n');

    const header = 'Employee,Department,Position,Total Hours,Work Days,Avg Hours/Day,Overtime Hours,Total Salary (MAD),Last Worked\n';
    const blob = new Blob([header + csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-hours-report-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
  };

  // Export detailed report
  const exportDetailedReport = () => {
    let csvData = 'Employee,Department,Position,Date,Entry Time,Exit Time,Pause (min),Machine Breakdown (min),Hours Worked,Salary (MAD),Status,Notes\n';
    
    employeeWorkSummaries.forEach(summary => {
      summary.schedules.forEach(schedule => {
        csvData += [
          `${summary.employee.firstName} ${summary.employee.lastName}`,
          summary.employee.department,
          summary.employee.position,
          schedule.date,
          schedule.entryTime,
          schedule.exitTime,
          schedule.pauseDuration || 0,
          schedule.machineCollapseDuration || 0,
          schedule.hoursWorked,
          schedule.salary,
          schedule.status,
          schedule.notes || ''
        ].join(',') + '\n';
      });
    });

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detailed-work-hours-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
  };

  const departments = Array.from(new Set(employees.map(e => e.department)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-3 rounded-full">
                <BarChart3 className="text-white w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Work Hours History</h1>
                <p className="text-gray-600">Complete employee work hours tracking and analysis</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setViewMode(viewMode === 'summary' ? 'detailed' : 'summary')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  viewMode === 'summary' 
                    ? 'bg-indigo-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {viewMode === 'summary' ? 'Summary View' : 'Detailed View'}
              </button>
            </div>
          </div>

          {/* Filters and Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            {/* Date Range */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Employee name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Sort Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <div className="flex space-x-1">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="hours">Hours</option>
                  <option value="salary">Salary</option>
                  <option value="days">Days</option>
                  <option value="name">Name</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-r-lg transition-colors"
                >
                  {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={exportToCSV}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Summary</span>
            </button>
            <button
              onClick={exportDetailedReport}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Export Detailed</span>
            </button>
            <div className="text-sm text-gray-600">
              Period: {dateRange.start} to {dateRange.end} ({employeeWorkSummaries.length} employees)
            </div>
          </div>
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Total Hours</h3>
                <p className="text-3xl font-bold text-blue-600">{overallStats.totalHours}</p>
                <p className="text-sm text-gray-500">Avg: {overallStats.averageHoursPerEmployee}h/employee</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Total Salary</h3>
                <p className="text-3xl font-bold text-green-600">{overallStats.totalSalary}</p>
                <p className="text-sm text-gray-500">Avg: {overallStats.averageSalaryPerEmployee} MAD/employee</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-orange-500">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-orange-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Overtime</h3>
                <p className="text-3xl font-bold text-orange-600">{overallStats.totalOvertimeHours}</p>
                <p className="text-sm text-gray-500">extra hours worked</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-purple-500">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-purple-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Active Employees</h3>
                <p className="text-3xl font-bold text-purple-600">{overallStats.activeEmployees}</p>
                <p className="text-sm text-gray-500">of {overallStats.totalEmployees} total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Work Summaries */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <span className="ml-4 text-lg text-gray-600">Loading work hours...</span>
          </div>
        ) : employeeWorkSummaries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No work hours found</h3>
            <p className="text-gray-500">No employees have logged work hours in the selected date range.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {employeeWorkSummaries.map(summary => (
              <div key={summary.employee.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-6">
                  {/* Employee Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        {summary.employee.firstName.charAt(0)}{summary.employee.lastName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">
                          {summary.employee.firstName} {summary.employee.lastName}
                        </h3>
                        <p className="text-gray-600">{summary.employee.position} • {summary.employee.department}</p>
                        <p className="text-sm text-gray-500">{summary.employee.hourlyRate || 15} MAD/hour</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedEmployee(expandedEmployee === summary.employee.id ? null : summary.employee.id)}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedEmployee === summary.employee.id ? 'rotate-180' : ''
                      }`} />
                    </button>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{summary.totalHours}</div>
                      <div className="text-sm text-gray-500">Total Hours</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{summary.totalSalary}</div>
                      <div className="text-sm text-gray-500">Total Salary</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{summary.workDays}</div>
                      <div className="text-sm text-gray-500">Work Days</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-indigo-600">{summary.averageHoursPerDay}</div>
                      <div className="text-sm text-gray-500">Avg Hours/Day</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{summary.overtimeHours}</div>
                      <div className="text-sm text-gray-500">Overtime</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-600">{summary.lastWorked}</div>
                      <div className="text-sm text-gray-500">Last Worked</div>
                    </div>
                  </div>

                  {/* Detailed Work Records */}
                  {expandedEmployee === summary.employee.id && summary.schedules.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Work History</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left p-3 font-semibold text-gray-700">Date</th>
                              <th className="text-left p-3 font-semibold text-gray-700">Entrée</th>
                              <th className="text-left p-3 font-semibold text-gray-700">Sortie</th>
                              <th className="text-left p-3 font-semibold text-gray-700">Pause</th>
                              <th className="text-left p-3 font-semibold text-gray-700">Machine</th>
                              <th className="text-left p-3 font-semibold text-gray-700">Heures</th>
                              <th className="text-left p-3 font-semibold text-gray-700">Statut</th>
                              <th className="text-right p-3 font-semibold text-gray-700">Salaire</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.schedules.map(schedule => (
                              <tr key={schedule.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">{schedule.date}</td>
                                <td className="p-3">{schedule.entryTime}</td>
                                <td className="p-3">{schedule.exitTime}</td>
                                <td className="p-3 text-orange-600">{schedule.pauseDuration || 0}min</td>
                                <td className="p-3 text-red-600">{schedule.machineCollapseDuration || 0}min</td>
                                <td className="p-3 font-semibold">{schedule.hoursWorked.toFixed(2)}h</td>
                                <td className="p-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    schedule.status === 'present' ? 'bg-green-100 text-green-800' :
                                    schedule.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                    schedule.status === 'overtime' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {schedule.status}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-semibold text-green-600">{schedule.salary} MAD</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkHoursHistory;
