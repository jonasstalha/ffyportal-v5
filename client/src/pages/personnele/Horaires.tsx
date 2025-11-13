import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'wouter';
import { 
  Calendar, 
  Clock,
  Users,
  DollarSign,
  Save,
  Search,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  History,
  Coffee,
  Settings
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  query,
  where,
  orderBy 
} from 'firebase/firestore';

// Interfaces
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  hourlyRate: number;
  status: 'Active' | 'Inactive' | 'On Leave' | 'Fired' | 'Resigned';
}

interface WorkSchedule {
  id?: string;
  employeeId: string;
  date: string;
  entryTime: string;
  exitTime: string;
  pauseDuration: number; // in minutes
  machineCollapseDuration: number; // in minutes
  hoursWorked: number;
  salary: number;
  status: 'present' | 'absent' | 'late' | 'overtime';
  notes?: string;
  checked: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const Horaires: React.FC = () => {
  // State management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{[key: string]: boolean}>({});
  
  // Local input state - NO AUTO SAVE
  const [localInputs, setLocalInputs] = useState<{[key: string]: Partial<WorkSchedule>}>({});
  
  // Form state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'pending'>('all');
  const [showCheckedOnly, setShowCheckedOnly] = useState(false);
  
  // UI state
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Firebase real-time listeners
  useEffect(() => {
    const unsubscribeEmployees = onSnapshot(
      query(collection(db, 'personnel'), where('status', '==', 'Active')),
      (snapshot) => {
        const employeesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Employee[];
        setEmployees(employeesData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching employees:', error);
        setLoading(false);
      }
    );

    return () => unsubscribeEmployees();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;

    const unsubscribeSchedules = onSnapshot(
      query(
        collection(db, 'work_schedules'),
        where('date', '==', selectedDate),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        const schedulesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WorkSchedule[];
        setSchedules(schedulesData);
      },
      (error) => {
        console.error('Error fetching schedules:', error);
      }
    );

    return () => unsubscribeSchedules();
  }, [selectedDate]);

  // FIXED: Improved calculation function with better time parsing and validation
  const calculateHoursAndSalary = useCallback((
    entryTime: string, 
    exitTime: string, 
    hourlyRate: number, 
    pauseDuration = 0, 
    machineCollapseDuration = 0
  ) => {
    console.log('Calculating for:', { entryTime, exitTime, hourlyRate, pauseDuration, machineCollapseDuration });
    
    // Validate inputs
    if (!entryTime || !exitTime || hourlyRate <= 0) {
      console.log('Invalid inputs, returning zeros');
      return { hours: 0, salary: 0 };
    }

    try {
      // Parse time strings (HH:MM format)
      const entryMatch = entryTime.match(/^(\d{1,2}):(\d{2})$/);
      const exitMatch = exitTime.match(/^(\d{1,2}):(\d{2})$/);
      
      if (!entryMatch || !exitMatch) {
        console.log('Invalid time format');
        return { hours: 0, salary: 0 };
      }

      const [, entryHourStr, entryMinStr] = entryMatch;
      const [, exitHourStr, exitMinStr] = exitMatch;
      
      const entryHour = parseInt(entryHourStr, 10);
      const entryMin = parseInt(entryMinStr, 10);
      const exitHour = parseInt(exitHourStr, 10);
      const exitMin = parseInt(exitMinStr, 10);

      // Validate time values
      if (entryHour < 0 || entryHour > 23 || entryMin < 0 || entryMin > 59 ||
          exitHour < 0 || exitHour > 23 || exitMin < 0 || exitMin > 59) {
        console.log('Invalid time values');
        return { hours: 0, salary: 0 };
      }

      // Convert to minutes since midnight
      const entryMinutes = entryHour * 60 + entryMin;
      let exitMinutes = exitHour * 60 + exitMin;

      // Handle overnight shifts (exit time is next day)
      if (exitMinutes <= entryMinutes) {
        exitMinutes += 24 * 60; // Add 24 hours
      }

      // Calculate total minutes worked
      let totalMinutes = exitMinutes - entryMinutes;
      
      console.log('Total minutes before deductions:', totalMinutes);

      // Subtract pause duration (validate pause duration)
      const validPauseDuration = Math.max(0, Math.min(pauseDuration || 0, totalMinutes));
      const workMinutes = totalMinutes - validPauseDuration;

      if (workMinutes <= 0) {
        console.log('No working time after pause deduction');
        return { hours: 0, salary: 0 };
      }

      // Convert to hours
      const totalHours = workMinutes / 60;

      // Calculate salary with new logic:
      // - Normal hours at full rate (12 MAD/hour)
      // - Machine breakdown: deduct only half pay (6 MAD per breakdown hour)
      const validMachineCollapse = Math.max(0, Math.min(machineCollapseDuration || 0, workMinutes));
      const machineCollapseHours = validMachineCollapse / 60;
      
      // Calculate salary: Full pay for all worked hours, then deduct half for machine breakdown
      const fullSalary = totalHours * hourlyRate; // Full pay for all worked hours
      const machineBreakdownDeduction = machineCollapseHours * (hourlyRate / 2); // Deduct half pay for breakdown time
      const totalSalary = fullSalary - machineBreakdownDeduction;

      console.log('Hours breakdown:', { 
        totalHours, 
        machineCollapseHours, 
        fullSalary, 
        machineBreakdownDeduction, 
        finalSalary: totalSalary 
      });

      const result = { 
        hours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
        salary: Math.round(Math.max(0, totalSalary))
      };

      console.log('Final calculation result:', result);
      return result;
    } catch (error) {
      console.error('Error in calculation:', error);
      return { hours: 0, salary: 0 };
    }
  }, []);

  // FIXED: Improved status determination
  const getWorkStatus = useCallback((hours: number): 'present' | 'late' | 'overtime' => {
    if (hours >= 8) return 'overtime';
    if (hours >= 6) return 'present';
    return 'late';
  }, []);

  // Calculate detailed breakdown for display
  const getCalculationBreakdown = useCallback((schedule: WorkSchedule, employee: Employee) => {
    if (!schedule?.entryTime || !schedule?.exitTime) {
      return null;
    }

    const hourlyRate = employee.hourlyRate || 12;
    const entryTime = schedule.entryTime;
    const exitTime = schedule.exitTime;
    const pauseDuration = schedule.pauseDuration || 0;
    const machineCollapseDuration = schedule.machineCollapseDuration || 0;

    // Calculate total time
    const entry = new Date(`2000-01-01T${entryTime}:00`);
    const exit = new Date(`2000-01-01T${exitTime}:00`);
    if (exit < entry) exit.setDate(exit.getDate() + 1);
    
    const totalMinutes = (exit.getTime() - entry.getTime()) / (1000 * 60);
    const totalHours = totalMinutes / 60;
    const workedHours = Math.max(0, totalHours - (pauseDuration / 60));
    const machineBreakdownHours = machineCollapseDuration / 60;
    
    // Calculate salary breakdown
    const fullSalary = workedHours * hourlyRate;
    const machineBreakdownDeduction = machineBreakdownHours * (hourlyRate / 2);
    const finalSalary = fullSalary - machineBreakdownDeduction;

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      workedHours: Math.round(workedHours * 100) / 100,
      pauseHours: Math.round((pauseDuration / 60) * 100) / 100,
      machineBreakdownHours: Math.round(machineBreakdownHours * 100) / 100,
      hourlyRate,
      fullSalary: Math.round(fullSalary),
      machineBreakdownDeduction: Math.round(machineBreakdownDeduction),
      finalSalary: Math.round(Math.max(0, finalSalary))
    };
  }, []);

  // MANUAL UPDATE - Only updates local state, no auto-save
  const updateLocalField = useCallback((employeeId: string, field: keyof WorkSchedule, value: any) => {
    console.log('Updating local field:', field, 'with value:', value);
    
    // Update local state only
    setLocalInputs(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value
      }
    }));
  }, []);

  // MANUAL SAVE - Only saves when user clicks "Enregistrer"
  const saveSchedule = useCallback(async (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) {
      console.error('Employee not found:', employeeId);
      alert('Erreur: Employé non trouvé');
      return;
    }

    setSaving(prev => ({ ...prev, [employeeId]: true }));

    try {
      const existingSchedule = schedules.find(s => s.employeeId === employeeId);
      const currentLocalInputs = localInputs[employeeId] || {};
      
      // Get all current values from local inputs or existing schedule
      const entryTime = currentLocalInputs.entryTime ?? existingSchedule?.entryTime ?? '';
      const exitTime = currentLocalInputs.exitTime ?? existingSchedule?.exitTime ?? '';
      const pauseDuration = currentLocalInputs.pauseDuration ?? existingSchedule?.pauseDuration ?? 0;
      const machineCollapseDuration = currentLocalInputs.machineCollapseDuration ?? existingSchedule?.machineCollapseDuration ?? 0;
      const notes = currentLocalInputs.notes ?? existingSchedule?.notes ?? '';
      
      // DATA VALIDATION - Ensure all required fields are present
      if (!employee.firstName || !employee.lastName) {
        throw new Error('Données employé incomplètes');
      }
      if (!selectedDate) {
        throw new Error('Date manquante');
      }
      
      let updatedSchedule: Partial<WorkSchedule> = {
        entryTime,
        exitTime,
        pauseDuration: Number(pauseDuration),
        machineCollapseDuration: Number(machineCollapseDuration),
        notes
      };

      // Calculate hours and salary if both times are provided
      if (entryTime && exitTime) {
        const { hours, salary } = calculateHoursAndSalary(
          entryTime, 
          exitTime, 
          employee.hourlyRate || 12, 
          Number(pauseDuration), 
          Number(machineCollapseDuration)
        );
        
        // CRITICAL VALIDATION: Log all salary calculations for audit
        console.log('🔍 SALARY CALCULATION AUDIT:', {
          employee: `${employee.firstName} ${employee.lastName}`,
          date: selectedDate,
          entryTime,
          exitTime,
          pauseDuration: Number(pauseDuration),
          machineCollapseDuration: Number(machineCollapseDuration),
          hourlyRate: employee.hourlyRate || 12,
          calculatedHours: hours,
          calculatedSalary: salary,
          timestamp: new Date().toISOString()
        });
        
        // Validate calculations are reasonable
        if (hours < 0 || hours > 24) {
          throw new Error(`Heures invalides: ${hours}h pour ${employee.firstName} ${employee.lastName}`);
        }
        if (salary < 0) {
          throw new Error(`Salaire invalide: ${salary} MAD pour ${employee.firstName} ${employee.lastName}`);
        }
        
        updatedSchedule = {
          ...updatedSchedule,
          hoursWorked: hours,
          salary,
          status: getWorkStatus(hours)
        };
      } else {
        updatedSchedule = {
          ...updatedSchedule,
          hoursWorked: 0,
          salary: 0,
          status: 'absent' as const
        };
      }

      // Update existing schedule or create new one
      if (existingSchedule?.id) {
        const finalData = {
          ...updatedSchedule,
          updatedAt: serverTimestamp()
        };
        console.log('📝 UPDATING EXISTING SCHEDULE:', {
          scheduleId: existingSchedule.id,
          finalData,
          employee: `${employee.firstName} ${employee.lastName}`
        });
        await updateDoc(doc(db, 'work_schedules', existingSchedule.id), finalData);
        console.log('✅ UPDATED SCHEDULE:', existingSchedule.id, finalData);
      } else {
        const baseSchedule = {
          employeeId,
          date: selectedDate,
          entryTime,
          exitTime,
          pauseDuration: Number(pauseDuration),
          machineCollapseDuration: Number(machineCollapseDuration),
          hoursWorked: updatedSchedule.hoursWorked || 0,
          salary: updatedSchedule.salary || 0,
          status: updatedSchedule.status || 'absent' as const,
          notes: updatedSchedule.notes || '',
          checked: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        console.log('🆕 CREATING NEW SCHEDULE:', {
          baseSchedule,
          employee: `${employee.firstName} ${employee.lastName}`
        });
        const newDoc = await addDoc(collection(db, 'work_schedules'), baseSchedule);
        console.log('✅ CREATED NEW SCHEDULE:', newDoc.id, baseSchedule);
      }

      // Clear local inputs after successful save
      setLocalInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[employeeId];
        return newInputs;
      });

      alert('Horaires enregistrés avec succès!');
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setSaving(prev => ({ ...prev, [employeeId]: false }));
    }
  }, [employees, schedules, selectedDate, calculateHoursAndSalary, getWorkStatus, localInputs]);

  // Helper function to get current value (local input or schedule)
  const getCurrentValue = useCallback((employeeId: string, field: keyof WorkSchedule) => {
    const localValue = localInputs[employeeId]?.[field];
    if (localValue !== undefined) return localValue;
    
    const schedule = schedules.find(s => s.employeeId === employeeId);
    const value = schedule?.[field];
    
    // Return appropriate default values for different field types
    if (field === 'pauseDuration' || field === 'machineCollapseDuration') {
      return value || 0;
    }
    return value || '';
  }, [localInputs, schedules]);

  // Get live calculation for display (before saving)
  const getLiveCalculation = useCallback((employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    const schedule = schedules.find(s => s.employeeId === employeeId);
    
    if (!employee) return { hours: 0, salary: 0, status: 'absent' as const };
    
    // Get current values from local inputs or existing schedule (ensure strings)
    const entryTime = String(getCurrentValue(employeeId, 'entryTime') || '');
    const exitTime = String(getCurrentValue(employeeId, 'exitTime') || '');
    const pauseDuration = Number(getCurrentValue(employeeId, 'pauseDuration') || 0);
    const machineCollapseDuration = Number(getCurrentValue(employeeId, 'machineCollapseDuration') || 0);
    
    if (!entryTime || !exitTime) {
      return { hours: 0, salary: 0, status: 'absent' as const };
    }
    
    const { hours, salary } = calculateHoursAndSalary(
      entryTime,
      exitTime,
      employee.hourlyRate || 12,
      pauseDuration,
      machineCollapseDuration
    );
    
    return {
      hours,
      salary,
      status: getWorkStatus(hours)
    };
  }, [employees, schedules, getCurrentValue, calculateHoursAndSalary, getWorkStatus]);

  // FIXED: Better validation for check-in
  const toggleEmployeeCheck = useCallback(async (employeeId: string) => {
    const existingSchedule = schedules.find(s => s.employeeId === employeeId);

    if (!existingSchedule?.entryTime || !existingSchedule?.exitTime) {
      alert('Veuillez remplir les heures d\'entrée et de sortie avant de pointer.');
      return;
    }

    if (existingSchedule.hoursWorked <= 0) {
      alert('Le temps de travail calculé n\'est pas valide. Vérifiez les heures saisies.');
      return;
    }

    if (existingSchedule?.id) {
      try {
        await updateDoc(doc(db, 'work_schedules', existingSchedule.id), {
          checked: !existingSchedule.checked,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating check status:', error);
        alert('Erreur lors de la mise à jour du statut. Veuillez réessayer.');
      }
    }
  }, [schedules]);

  // Filtered data
  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                           employee.position.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDepartment = !departmentFilter || employee.department === departmentFilter;
      
      const schedule = schedules.find(s => s.employeeId === employee.id);
      let matchesStatus = true;
      
      if (statusFilter === 'present') matchesStatus = schedule?.checked === true;
      if (statusFilter === 'absent') matchesStatus = schedule?.checked === false || !schedule;
      if (statusFilter === 'pending') matchesStatus = !schedule?.checked && !!schedule?.entryTime;
      
      const matchesCheckedFilter = !showCheckedOnly || schedule?.checked;
      
      return matchesSearch && matchesDepartment && matchesStatus && matchesCheckedFilter;
    });
  }, [employees, schedules, searchTerm, departmentFilter, statusFilter, showCheckedOnly]);

  // Statistics
  const stats = useMemo(() => {
    const presentEmployees = schedules.filter(s => s.checked);
    const totalSalary = presentEmployees.reduce((sum, s) => sum + (s.salary || 0), 0);
    const totalHours = presentEmployees.reduce((sum, s) => sum + (s.hoursWorked || 0), 0);
    const overtimeEmployees = presentEmployees.filter(s => (s.hoursWorked || 0) >= 8).length;
    
    return {
      totalEmployees: employees.length,
      presentEmployees: presentEmployees.length,
      absentEmployees: employees.length - presentEmployees.length,
      totalSalary,
      totalHours: Math.round(totalHours * 100) / 100,
      overtimeEmployees
    };
  }, [employees, schedules]);

  const departments = Array.from(new Set(employees.map(e => e.department)));

  // Format time for display
  const formatTime = (time: string) => {
    if (!time) return '--:--';
    return time;
  };

  // FIXED: Better working time display
  const getWorkingTimeDisplay = useCallback((schedule: WorkSchedule) => {
    if (!schedule.entryTime || !schedule.exitTime) return '';
    
    const pauseDisplay = schedule.pauseDuration > 0 ? ` (Pause: ${schedule.pauseDuration}min)` : '';
    const machineDisplay = schedule.machineCollapseDuration > 0 ? ` (Machine: ${schedule.machineCollapseDuration}min@50%)` : '';
    
    return `${formatTime(schedule.entryTime)} - ${formatTime(schedule.exitTime)}${pauseDisplay}${machineDisplay}`;
  }, []);

  // FIXED: CSV export function
  const exportToCSV = useCallback(() => {
    const checkedSchedules = schedules.filter(s => s.checked);
    
    if (checkedSchedules.length === 0) {
      alert('Aucun employé pointé à exporter.');
      return;
    }

    const csvData = checkedSchedules.map(s => {
      const employee = employees.find(e => e.id === s.employeeId);
      return [
        `${employee?.firstName} ${employee?.lastName}`,
        s.date,
        s.entryTime,
        s.exitTime,
        s.pauseDuration,
        s.machineCollapseDuration,
        s.hoursWorked,
        s.salary
      ].join(',');
    }).join('\n');

    const header = 'Employé,Date,Entrée,Sortie,Pause (min),Machine Arrêtée (min),Heures,Salaire (MAD)\n';
    const blob = new Blob([header + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pointage-${selectedDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [schedules, employees, selectedDate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-3 rounded-full">
                <Clock className="text-white w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Pointage des Employés</h1>
                <p className="text-gray-600">Gestion du temps et présence</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Aujourd'hui</p>
                <p className="text-2xl font-bold text-blue-600">{new Date().toLocaleDateString('fr-FR')}</p>
              </div>
              <Link href="/work-hours-history">
                <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold transition-colors">
                  <History className="w-5 h-5" />
                  <span>Historique</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Controls Row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de travail</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Nom ou poste..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Département</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tous les départements</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="present">Présents</option>
                <option value="absent">Absents</option>
                <option value="pending">En attente</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center justify-between">
            <button
              onClick={() => setShowCheckedOnly(!showCheckedOnly)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                showCheckedOnly 
                  ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                  : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}
            >
              {showCheckedOnly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="text-sm">Afficher pointés uniquement</span>
            </button>
            
            <button
              onClick={exportToCSV}
              disabled={schedules.filter(s => s.checked).length === 0}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                schedules.filter(s => s.checked).length === 0
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Exporter CSV</span>
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
            <div className="flex items-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Présents</h3>
                <p className="text-3xl font-bold text-green-600">{stats.presentEmployees}</p>
                <p className="text-sm text-gray-500">sur {stats.totalEmployees} employés</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500">
            <div className="flex items-center">
              <XCircle className="w-8 h-8 text-red-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Absents</h3>
                <p className="text-3xl font-bold text-red-600">{stats.absentEmployees}</p>
                <p className="text-sm text-gray-500">non pointés</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Heures Total</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.totalHours}</p>
                <p className="text-sm text-gray-500">heures travaillées</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-yellow-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Salaire Total</h3>
                <p className="text-3xl font-bold text-yellow-600">{stats.totalSalary} MAD</p>
                <p className="text-sm text-gray-500">paiement journalier</p>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Cards */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-lg text-gray-600">Chargement des employés...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredEmployees.map(employee => {
              const schedule = schedules.find(s => s.employeeId === employee.id);
              const isExpanded = expandedCard === employee.id;
              const isSaving = saving[employee.id] || false;
              
              return (
                <div key={employee.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className="p-6">
                    {/* Employee Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                          schedule?.checked ? 'bg-green-500' : 'bg-gray-400'
                        }`}>
                          {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">
                            {employee.firstName} {employee.lastName}
                          </h3>
                          <p className="text-sm text-gray-600">{employee.position} • {employee.department}</p>
                          <p className="text-xs text-gray-500">{employee.hourlyRate || 12} MAD/heure</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedCard(isExpanded ? null : employee.id)}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Main Time Inputs */}
                    <div className="space-y-4 mb-6">
                      {/* Entry and Exit Times */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Heure d'entrée
                          </label>
                          <input
                            type="time"
                            value={String(getCurrentValue(employee.id, 'entryTime'))}
                            onChange={(e) => {
                              console.log('Entry time changed:', e.target.value);
                              updateLocalField(employee.id, 'entryTime', e.target.value);
                            }}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                            disabled={isSaving}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Heure de sortie
                          </label>
                          <input
                            type="time"
                            value={String(getCurrentValue(employee.id, 'exitTime'))}
                            onChange={(e) => {
                              console.log('Exit time changed:', e.target.value);
                              updateLocalField(employee.id, 'exitTime', e.target.value);
                            }}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                            disabled={isSaving}
                          />
                        </div>
                      </div>

                      {/* Pause and Machine Collapse */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <Coffee className="w-4 h-4 mr-1" />
                            Pause (minutes)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="480"
                            value={Number(getCurrentValue(employee.id, 'pauseDuration'))}
                            onChange={(e) => updateLocalField(employee.id, 'pauseDuration', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={isSaving}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <Settings className="w-4 h-4 mr-1" />
                            Machine arrêtée (minutes)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="480"
                            value={Number(getCurrentValue(employee.id, 'machineCollapseDuration'))}
                            onChange={(e) => updateLocalField(employee.id, 'machineCollapseDuration', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={isSaving}
                          />
                        </div>
                      </div>

                      {/* Calculated Results */}
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Heures travaillées</p>
                            <p className="text-xl font-bold text-blue-600">
                              {getLiveCalculation(employee.id).hours.toFixed(2)}h
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Salaire calculé</p>
                            <p className="text-xl font-bold text-green-600">
                              {getLiveCalculation(employee.id).salary} MAD
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Statut</p>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                              getLiveCalculation(employee.id).status === 'overtime' ? 'bg-orange-100 text-orange-800' :
                              getLiveCalculation(employee.id).status === 'present' ? 'bg-green-100 text-green-800' :
                              getLiveCalculation(employee.id).status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {getLiveCalculation(employee.id).status === 'overtime' ? 'Heures sup.' :
                               getLiveCalculation(employee.id).status === 'present' ? 'Présent' :
                               getLiveCalculation(employee.id).status === 'late' ? 'Retard' :
                               'Absent'}
                            </span>
                          </div>
                        </div>

                        {/* Detailed Calculation Breakdown */}
                        {(() => {
                          const breakdown = getCalculationBreakdown(schedule!, employee);
                          if (!breakdown) return null;
                          
                          return (
                            <div className="border-t pt-3 mt-3">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">Détail du calcul:</h5>
                              <div className="text-xs text-gray-600 space-y-1">
                                <div className="flex justify-between">
                                  <span>Temps total ({schedule!.entryTime} → {schedule!.exitTime}):</span>
                                  <span>{breakdown.totalHours}h</span>
                                </div>
                                {breakdown.pauseHours > 0 && (
                                  <div className="flex justify-between">
                                    <span>Pause (déduction complète):</span>
                                    <span>-{breakdown.pauseHours}h</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-medium">
                                  <span>Heures travaillées:</span>
                                  <span>{breakdown.workedHours}h</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Salaire de base ({breakdown.hourlyRate} MAD/h):</span>
                                  <span>{breakdown.fullSalary} MAD</span>
                                </div>
                                {breakdown.machineBreakdownHours > 0 && (
                                  <>
                                    <div className="flex justify-between text-orange-600">
                                      <span>Panne machine ({breakdown.machineBreakdownHours}h):</span>
                                      <span>-{breakdown.machineBreakdownDeduction} MAD (50%)</span>
                                    </div>
                                  </>
                                )}
                                <div className="flex justify-between font-bold text-green-600 border-t pt-1">
                                  <span>Salaire final:</span>
                                  <span>{breakdown.finalSalary} MAD</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t pt-6 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes
                          </label>
                          <textarea
                            value={String(getCurrentValue(employee.id, 'notes'))}
                            onChange={(e) => updateLocalField(employee.id, 'notes', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={3}
                            placeholder="Notes sur la journée de travail..."
                            disabled={isSaving}
                          />
                        </div>

                        {schedule && (
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                              <p><strong>Temps de travail:</strong> {getWorkingTimeDisplay(schedule)}</p>
                              <p><strong>Taux horaire:</strong> {employee.hourlyRate || 12} MAD</p>
                            </div>
                            <div>
                              <p><strong>Créé le:</strong> {schedule.createdAt ? new Date(schedule.createdAt.seconds * 1000).toLocaleString('fr-FR') : 'N/A'}</p>
                              <p><strong>Modifié le:</strong> {schedule.updatedAt ? new Date(schedule.updatedAt.seconds * 1000).toLocaleString('fr-FR') : 'N/A'}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-center space-x-4 pt-6">
                      {/* Save Schedule Button */}
                      <button
                        onClick={() => saveSchedule(employee.id)}
                        disabled={saving[employee.id]}
                        className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                          saving[employee.id]
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-orange-500 hover:bg-orange-600'
                        } text-white shadow-lg`}
                      >
                        {saving[employee.id] ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                        <span>
                          {saving[employee.id] ? 'Sauvegarde...' : 'Enregistrer'}
                        </span>
                      </button>

                      {/* Check In/Out Button */}
                      <button
                        onClick={() => toggleEmployeeCheck(employee.id)}
                        disabled={isSaving || !schedule?.entryTime || !schedule?.exitTime}
                        className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                          schedule?.checked
                            ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg'
                            : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed'
                        } ${isSaving ? 'animate-pulse' : ''}`}
                      >
                        {isSaving ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : schedule?.checked ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                        <span>
                          {isSaving ? 'Sauvegarde...' : 
                           schedule?.checked ? 'Pointé ✓' : 'Pointer employé'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredEmployees.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Aucun employé trouvé</h3>
            <p className="text-gray-600">
              {searchTerm || departmentFilter || statusFilter !== 'all' || showCheckedOnly
                ? 'Modifiez vos filtres pour voir plus d\'employés.'
                : 'Aucun employé actif n\'est disponible.'}
            </p>
          </div>
        )}

        {/* Summary Footer */}
        {!loading && filteredEmployees.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
            <div className="flex flex-wrap items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Employés affichés</p>
                  <p className="text-2xl font-bold text-blue-600">{filteredEmployees.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Heures supplémentaires</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.overtimeEmployees}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Coût journalier</p>
                  <p className="text-2xl font-bold text-green-600">{stats.totalSalary} MAD</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 mt-4 sm:mt-0">
                <span className="text-sm text-gray-500">
                  Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR')}
                </span>
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  <Clock className="w-4 h-4" />
                  <span>Actualiser</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Horaires;