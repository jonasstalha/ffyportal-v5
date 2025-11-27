import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart } from 'recharts';
import { Calendar, User, Users, Package, Trash2, AlertTriangle, TrendingUp, Download, Plus, BarChart3, PieChart as PieChartIcon, Activity, FileText, Filter } from 'lucide-react';
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

type ReportData = {
  id: string;
  date: string;
  employee: string; // Now represents the supervisor/responsible person
  shift: 'matin' | 'apres-midi' | 'nuit';
  notes?: string;
  entrants: number; // Total facility input in tonnes
  emballes: number; // Total facility output in tonnes
  dechets: number; // Total facility waste in tonnes
  unfound?: number; // New: unfound/lost volume in tonnes
  workerAllocations?: number; // New: total allocations to workers in kg
  numberOfBeneficiaries?: number; // New: number of workers receiving allocations
  pertes: number;
  tauxDechets: number;
  tauxPertes: number;
  qualityGrade: 'A' | 'B' | 'C';
  temperature: number;
  humidity: number;
  processedHours: number;
  timestamp: number;
  week: number;
  month: number;
  year: number;
};

type HistoricalTrend = {
  period: string;
  avgEfficiency: number;
  avgWaste: number;
  avgLoss: number;
  totalVolume: number;
  qualityScore: number;
  trend: 'up' | 'down' | 'stable';
};

type ShiftPerformance = {
  shift: string;
  efficiency: number;
  volume: number;
  employees: number;
  quality: number;
};

const AvocadoProcessingDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reports, setReports] = useState<ReportData[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportData[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [timeFrame, setTimeFrame] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Firebase functions
  const saveReportToFirebase = async (reportData: Omit<ReportData, 'id'>) => {
    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, 'production_reports'), {
        ...reportData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      toast.success('Rapport sauvegardÃ© avec succÃ¨s!');
      return docRef.id;
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error('Erreur lors de la sauvegarde du rapport');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const fetchReportsFromFirebase = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'production_reports'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const fetchedReports: ReportData[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ReportData));
      
      setReports(fetchedReports);
      setFilteredReports(fetchedReports);
      toast.success(`${fetchedReports.length} rapports chargÃ©s depuis Firebase`);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Erreur lors du chargement des rapports');
      // Fallback to sample data if Firebase fails
      const sampleData = generateSampleData();
      setReports(sampleData);
      setFilteredReports(sampleData);
    } finally {
      setLoading(false);
    }
  };

  const deleteReportFromFirebase = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'production_reports', reportId));
      const updatedReports = reports.filter(r => r.id !== reportId);
      setReports(updatedReports);
      toast.success('Rapport supprimÃ© avec succÃ¨s');
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Erreur lors de la suppression du rapport');
    }
  };

  // Download individual daily report
  const downloadDailyReport = (report: ReportData) => {
    const reportContent = `
=== RAPPORT JOURNALIER DE CONSOMMATION GLOBALE ===
Fruit For You - SystÃ¨me de Gestion d'Avocats

Date: ${new Date(report.date).toLocaleDateString('fr-FR')}
Responsable: ${report.employee}
Ã‰quipe Principale: ${report.shift === 'matin' ? 'Matin (6h-14h)' : report.shift === 'apres-midi' ? 'AprÃ¨s-midi (14h-22h)' : 'Nuit (22h-6h)'}

=== DONNÃ‰ES DE PRODUCTION GLOBALE (Installation ComplÃ¨te) ===
â€¢ Avocats entrants: ${report.entrants.toLocaleString()} T (${(report.entrants*1000).toLocaleString()} kg)
â€¢ Avocats emballÃ©s: ${report.emballes.toLocaleString()} T (${(report.emballes*1000).toLocaleString()} kg)
â€¢ DÃ©chets: ${report.dechets.toLocaleString()} T (${report.tauxDechets}%)
â€¢ Non trouvÃ©s/Perdus: ${(report.unfound || 0).toLocaleString()} T
â€¢ Pertes rÃ©elles: ${report.pertes.toLocaleString()} T (${report.tauxPertes}%)

=== DOTATIONS AUX EMPLOYÃ‰S ===
â€¢ Allocations donnÃ©es: ${(report.workerAllocations || 0).toLocaleString()} kg
â€¢ Nombre de bÃ©nÃ©ficiaires: ${report.numberOfBeneficiaries || 0} employÃ©s
â€¢ Allocation moyenne: ${report.numberOfBeneficiaries ? ((report.workerAllocations || 0) / report.numberOfBeneficiaries).toFixed(1) : '0'} kg/employÃ©

=== PERFORMANCE GLOBALE ===
â€¢ EfficacitÃ© globale: ${((report.emballes / report.entrants) * 100).toFixed(1)}%
â€¢ Grade qualitÃ© installation: ${report.qualityGrade}
â€¢ Heures opÃ©rationnelles: ${report.processedHours}h

=== CONDITIONS ENVIRONNEMENTALES ===
â€¢ TempÃ©rature: ${report.temperature}Â°C
â€¢ HumiditÃ©: ${report.humidity}%

=== OBSERVATIONS & NOTES ===
${report.notes || 'Aucune observation particuliÃ¨re'}

=== BILAN DE LA JOURNÃ‰E ===
${report.tauxDechets <= 4 ? 'âœ…' : report.tauxDechets <= 6 ? 'âš ï¸' : 'âŒ'} Taux de dÃ©chets: ${report.tauxDechets}% (Objectif: <6%)
${report.tauxPertes <= 7 ? 'âœ…' : report.tauxPertes <= 10 ? 'âš ï¸' : 'âŒ'} Taux de pertes: ${report.tauxPertes}% (Objectif: <10%)
${((report.emballes / report.entrants) * 100) >= 88 ? 'âœ…' : ((report.emballes / report.entrants) * 100) >= 85 ? 'âš ï¸' : 'âŒ'} EfficacitÃ©: ${((report.emballes / report.entrants) * 100).toFixed(1)}% (Objectif: >88%)

Rapport gÃ©nÃ©rÃ© le ${new Date().toLocaleDateString('fr-FR')} Ã  ${new Date().toLocaleTimeString('fr-FR')}
    `.trim();

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rapport_journalier_${report.date}_${report.employee.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    toast.success('Rapport tÃ©lÃ©chargÃ© avec succÃ¨s!');
  };
  
  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    employee: '',
    shift: 'matin' as 'matin' | 'apres-midi' | 'nuit',
    entrants: '',
    emballes: '',
    dechets: '',
    unfound: '', // New field for unfound/lost volume
    workerAllocations: '', // New field for worker allocations
    numberOfBeneficiaries: '', // New field for number of beneficiaries
    qualityGrade: 'B' as 'A' | 'B' | 'C',
    temperature: '',
    humidity: '',
    processedHours: '',
    notes: ''
  });

  // Initialize with data from Firebase
  useEffect(() => {
    fetchReportsFromFirebase();
  }, []);

  // Filter reports based on date range and employee
  useEffect(() => {
    let filtered = reports;
    
    if (dateRange.start) {
      filtered = filtered.filter(report => report.date >= dateRange.start);
    }
    if (dateRange.end) {
      filtered = filtered.filter(report => report.date <= dateRange.end);
    }
    if (employeeFilter) {
      filtered = filtered.filter(report => 
        report.employee.toLowerCase().includes(employeeFilter.toLowerCase())
      );
    }
    
    setFilteredReports(filtered);
  }, [reports, dateRange, employeeFilter]);

  const generateSampleData = (): ReportData[] => {
    // Realistic Moroccan/North African employee names
    const employees = [
      'Omar Benjelloun', 
      'Fatima Zahra El Alami', 
      'Mohamed Bouchaib', 
      'Aicha Berrada', 
      'Youssef Taha',
      'Samira Bennani',
      'Abdelkader Idrissi',
      'Leila Mansouri'
    ];
    
    const shifts: Array<'matin' | 'apres-midi' | 'nuit'> = ['matin', 'apres-midi', 'nuit'];
    const qualityGrades: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
    
    const notes = [
      "Production normale",
      "QualitÃ© excellente - avocats premium",
      "LÃ©gÃ¨re augmentation des dÃ©chets due Ã  la maturitÃ©",
      "Rendement optimal",
      "ContrÃ´le qualitÃ© renforcÃ©",
      "Tri plus sÃ©lectif aujourd'hui",
      "Bonne cadence de production",
      "TempÃ©rature idÃ©ale pour le traitement",
      "HumiditÃ© contrÃ´lÃ©e",
      "Ã‰quipe trÃ¨s efficace aujourd'hui",
      ""
    ];
    
    const data: ReportData[] = [];
    
    // Generate 6 months of historical data
    for (let i = 180; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Multiple shifts per day
      shifts.forEach((shift, shiftIndex) => {
        // Skip some night shifts (not always operational)
        if (shift === 'nuit' && Math.random() > 0.6) return;
        
        // Realistic avocado processing volumes (converted to tonnes for global tracking)
        const baseProduction = shift === 'matin' ? 2.8 : shift === 'apres-midi' ? 2.2 : 1.5; // In tonnes
        const seasonalFactor = Math.sin((date.getMonth() + 1) * Math.PI / 6) * 0.3 + 1;
        const dailyVariation = 0.8 + Math.random() * 0.4;
        const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.3 : 1;
        
        const entrants = Number((baseProduction * seasonalFactor * dailyVariation * weekendFactor).toFixed(1));
        
        // Realistic processing rates with shift variations
        const shiftEfficiencyFactor = shift === 'matin' ? 1.02 : shift === 'apres-midi' ? 1.0 : 0.95;
        const qualityFactor = (0.87 + Math.random() * 0.05) * shiftEfficiencyFactor;
        const wasteFactor = 0.03 + Math.random() * 0.05;
        
        const emballes = Number((entrants * qualityFactor).toFixed(1));
        const dechets = Number((entrants * wasteFactor).toFixed(1));
        
        // Global consumption tracking - new fields
        const unfound = Number((entrants * (0.01 + Math.random() * 0.02)).toFixed(1)); // 1-3% unfound
        const workerAllocations = Math.round(50 + Math.random() * 100); // 50-150 kg per shift
        const numberOfBeneficiaries = Math.round(15 + Math.random() * 20); // 15-35 workers
        
        const pertes = Number((entrants - emballes - dechets - unfound - (workerAllocations/1000)).toFixed(1));
        
        // Environmental conditions
        const temperature = 12 + Math.random() * 6; // 12-18Â°C optimal for avocado processing
        const humidity = 60 + Math.random() * 20; // 60-80% humidity
        const processedHours = 6 + Math.random() * 2; // 6-8 hours per shift
        
        // Quality grade based on efficiency
        let qualityGrade: 'A' | 'B' | 'C' = 'B';
        const efficiency = (emballes / entrants) * 100;
        if (efficiency > 90) qualityGrade = 'A';
        else if (efficiency < 85) qualityGrade = 'C';
        
        data.push({
          id: `report-${i}-${shiftIndex}`,
          date: dateStr,
          employee: employees[Math.floor(Math.random() * employees.length)],
          shift,
          entrants,
          emballes,
          dechets,
          unfound,
          workerAllocations,
          numberOfBeneficiaries,
          pertes,
          tauxDechets: Number(((dechets / entrants) * 100).toFixed(2)),
          tauxPertes: Number(((pertes / entrants) * 100).toFixed(2)),
          qualityGrade,
          temperature: Number(temperature.toFixed(1)),
          humidity: Number(humidity.toFixed(1)),
          processedHours: Number(processedHours.toFixed(1)),
          notes: Math.random() > 0.7 ? notes[Math.floor(Math.random() * notes.length)] : "",
          timestamp: date.getTime() + (shiftIndex * 8 * 60 * 60 * 1000), // Add shift offset
          week: getWeekNumber(date),
          month: date.getMonth() + 1,
          year: date.getFullYear()
        });
      });
    }
    
    return data.sort((a, b) => b.timestamp - a.timestamp);
  };

  // Helper function to get week number
  const getWeekNumber = (date: Date): number => {
    const startDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil(days / 7);
  };

  // Historical trend analysis
  const getHistoricalTrends = (): HistoricalTrend[] => {
    const trends: HistoricalTrend[] = [];
    const currentDate = new Date();
    
    // Weekly trends for last 12 weeks
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(currentDate);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // End of week
      
      const weekReports = filteredReports.filter(report => {
        const reportDate = new Date(report.date);
        return reportDate >= weekStart && reportDate <= weekEnd;
      });
      
      if (weekReports.length > 0) {
        const totalEntrants = weekReports.reduce((sum, r) => sum + r.entrants, 0);
        const totalEmballes = weekReports.reduce((sum, r) => sum + r.emballes, 0);
        const avgEfficiency = (totalEmballes / totalEntrants) * 100;
        const avgWaste = weekReports.reduce((sum, r) => sum + r.tauxDechets, 0) / weekReports.length;
        const avgLoss = weekReports.reduce((sum, r) => sum + r.tauxPertes, 0) / weekReports.length;
        const qualityScore = weekReports.filter(r => r.qualityGrade === 'A').length / weekReports.length * 100;
        
        // Calculate trend (compare with previous week)
        const prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(prevWeekStart.getDate() - 7);
        const prevWeekEnd = new Date(weekEnd);
        prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);
        
        const prevWeekReports = filteredReports.filter(report => {
          const reportDate = new Date(report.date);
          return reportDate >= prevWeekStart && reportDate <= prevWeekEnd;
        });
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (prevWeekReports.length > 0) {
          const prevTotalEntrants = prevWeekReports.reduce((sum, r) => sum + r.entrants, 0);
          const prevTotalEmballes = prevWeekReports.reduce((sum, r) => sum + r.emballes, 0);
          const prevEfficiency = (prevTotalEmballes / prevTotalEntrants) * 100;
          
          if (avgEfficiency > prevEfficiency + 1) trend = 'up';
          else if (avgEfficiency < prevEfficiency - 1) trend = 'down';
        }
        
        trends.push({
          period: `Sem ${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
          avgEfficiency: Number(avgEfficiency.toFixed(1)),
          avgWaste: Number(avgWaste.toFixed(1)),
          avgLoss: Number(avgLoss.toFixed(1)),
          totalVolume: Math.round(totalEntrants / 1000), // in tons
          qualityScore: Number(qualityScore.toFixed(1)),
          trend
        });
      }
    }
    
    return trends;
  };

  // Shift performance analysis
  const getShiftPerformance = (): ShiftPerformance[] => {
    const shifts = ['matin', 'apres-midi', 'nuit'];
    return shifts.map(shift => {
      const shiftReports = filteredReports.filter(r => r.shift === shift);
      if (shiftReports.length === 0) {
        return { shift, efficiency: 0, volume: 0, employees: 0, quality: 0 };
      }
      
      const totalEntrants = shiftReports.reduce((sum, r) => sum + r.entrants, 0);
      const totalEmballes = shiftReports.reduce((sum, r) => sum + r.emballes, 0);
      const efficiency = (totalEmballes / totalEntrants) * 100;
      const uniqueEmployees = new Set(shiftReports.map(r => r.employee)).size;
      const qualityA = shiftReports.filter(r => r.qualityGrade === 'A').length / shiftReports.length * 100;
      
      return {
        shift: shift.charAt(0).toUpperCase() + shift.slice(1),
        efficiency: Number(efficiency.toFixed(1)),
        volume: Math.round(totalEntrants / 1000), // in tons
        employees: uniqueEmployees,
        quality: Number(qualityA.toFixed(1))
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const entrants = parseFloat(formData.entrants);
    const emballes = parseFloat(formData.emballes);
    const dechets = parseFloat(formData.dechets);
    const unfound = parseFloat(formData.unfound) || 0;
    const workerAllocations = parseFloat(formData.workerAllocations) || 0;
    const numberOfBeneficiaries = parseInt(formData.numberOfBeneficiaries) || 0;
    
    // Calculate actual losses (excluding unfound and worker allocations)
    const pertes = entrants - emballes - dechets - unfound - (workerAllocations / 1000); // Convert kg to tonnes
    
    const reportDate = new Date(formData.date);
    
    const newReportData: Omit<ReportData, 'id'> = {
      date: formData.date,
      employee: formData.employee,
      shift: formData.shift,
      entrants,
      emballes,
      dechets,
      unfound,
      workerAllocations,
      numberOfBeneficiaries,
      pertes,
      tauxDechets: Number(((dechets / entrants) * 100).toFixed(2)),
      tauxPertes: Number(((pertes / entrants) * 100).toFixed(2)),
      qualityGrade: formData.qualityGrade,
      temperature: parseFloat(formData.temperature) || 15,
      humidity: parseFloat(formData.humidity) || 70,
      processedHours: parseFloat(formData.processedHours) || 8,
      notes: formData.notes,
      timestamp: reportDate.getTime(),
      week: getWeekNumber(reportDate),
      month: reportDate.getMonth() + 1,
      year: reportDate.getFullYear()
    };

    try {
      const docId = await saveReportToFirebase(newReportData);
      
      // Add to local state with the Firebase document ID
      const newReport: ReportData = {
        id: docId,
        ...newReportData
      };
      
      const updatedReports = [newReport, ...reports];
      setReports(updatedReports);
      
      // Reset form
      resetForm();
      
      // Switch to dashboard to see the new data
      setActiveTab('dashboard');
      
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      employee: '',
      shift: 'matin',
      entrants: '',
      emballes: '',
      dechets: '',
      unfound: '',
      workerAllocations: '',
      numberOfBeneficiaries: '',
      qualityGrade: 'B',
      temperature: '',
      humidity: '',
      processedHours: '',
      notes: ''
    });
  };

  const getKPIs = () => {
    if (filteredReports.length === 0) return null;
    
    const totalEntrants = filteredReports.reduce((sum, report) => sum + report.entrants, 0);
    const totalEmballes = filteredReports.reduce((sum, report) => sum + report.emballes, 0);
    const totalDechets = filteredReports.reduce((sum, report) => sum + report.dechets, 0);
    const totalPertes = filteredReports.reduce((sum, report) => sum + report.pertes, 0);
    
    const avgTauxDechets = filteredReports.reduce((sum, report) => sum + report.tauxDechets, 0) / filteredReports.length;
    const avgTauxPertes = filteredReports.reduce((sum, report) => sum + report.tauxPertes, 0) / filteredReports.length;
    
    return {
      totalEntrants,
      totalEmballes,
      totalDechets,
      totalPertes,
      avgTauxDechets,
      avgTauxPertes,
      efficiency: (totalEmballes / totalEntrants) * 100
    };
  };

  const kpis = getKPIs();
  const historicalTrends = getHistoricalTrends();
  const shiftPerformance = getShiftPerformance();

  // Enhanced chart data with different time frames
  const getChartData = () => {
    let dataSource = filteredReports;
    let groupBy = 'day';
    let dataPoints = 15;
    
    switch (timeFrame) {
      case 'weekly':
        groupBy = 'week';
        dataPoints = 12;
        break;
      case 'monthly':
        groupBy = 'month';
        dataPoints = 6;
        break;
      default:
        dataPoints = 15;
    }

    if (timeFrame === 'daily') {
      return dataSource.slice(-dataPoints).reverse().map(report => ({
        date: new Date(report.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        entrants: Math.round(report.entrants / 10) / 100,
        emballes: Math.round(report.emballes / 10) / 100,
        dechets: Math.round(report.dechets / 10) / 100,
        pertes: Math.round(report.pertes / 10) / 100,
        tauxDechets: report.tauxDechets,
        tauxPertes: report.tauxPertes,
        efficiency: (report.emballes / report.entrants) * 100,
        temperature: report.temperature,
        humidity: report.humidity,
        qualityGrade: report.qualityGrade
      }));
    }

    // Weekly aggregation
    if (timeFrame === 'weekly') {
      const weeklyData = new Map();
      
      dataSource.forEach(report => {
        const weekKey = `${report.year}-W${report.week}`;
        if (!weeklyData.has(weekKey)) {
          weeklyData.set(weekKey, {
            date: weekKey,
            entrants: 0,
            emballes: 0,
            dechets: 0,
            pertes: 0,
            count: 0,
            tempSum: 0,
            humiditySum: 0,
            qualityA: 0
          });
        }
        
        const week = weeklyData.get(weekKey);
        week.entrants += report.entrants;
        week.emballes += report.emballes;
        week.dechets += report.dechets;
        week.pertes += report.pertes;
        week.tempSum += report.temperature;
        week.humiditySum += report.humidity;
        week.qualityA += report.qualityGrade === 'A' ? 1 : 0;
        week.count++;
      });

      return Array.from(weeklyData.values())
        .slice(-dataPoints)
        .map(week => ({
          date: week.date.split('-W')[1],
          entrants: Math.round(week.entrants / 100) / 10,
          emballes: Math.round(week.emballes / 100) / 10,
          dechets: Math.round(week.dechets / 100) / 10,
          pertes: Math.round(week.pertes / 100) / 10,
          tauxDechets: Number(((week.dechets / week.entrants) * 100).toFixed(1)),
          tauxPertes: Number(((week.pertes / week.entrants) * 100).toFixed(1)),
          efficiency: Number(((week.emballes / week.entrants) * 100).toFixed(1)),
          temperature: Number((week.tempSum / week.count).toFixed(1)),
          humidity: Number((week.humiditySum / week.count).toFixed(1)),
          qualityScore: Number(((week.qualityA / week.count) * 100).toFixed(1))
        }));
    }

    // Monthly aggregation
    const monthlyData = new Map();
    dataSource.forEach(report => {
      const monthKey = `${report.year}-${report.month.toString().padStart(2, '0')}`;
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          date: monthKey,
          entrants: 0,
          emballes: 0,
          dechets: 0,
          pertes: 0,
          count: 0,
          tempSum: 0,
          humiditySum: 0,
          qualityA: 0
        });
      }
      
      const month = monthlyData.get(monthKey);
      month.entrants += report.entrants;
      month.emballes += report.emballes;
      month.dechets += report.dechets;
      month.pertes += report.pertes;
      month.tempSum += report.temperature;
      month.humiditySum += report.humidity;
      month.qualityA += report.qualityGrade === 'A' ? 1 : 0;
      month.count++;
    });

    return Array.from(monthlyData.values())
      .slice(-dataPoints)
      .map(month => ({
        date: month.date.split('-')[1],
        entrants: Math.round(month.entrants / 1000) / 1,
        emballes: Math.round(month.emballes / 1000) / 1,
        dechets: Math.round(month.dechets / 1000) / 1,
        pertes: Math.round(month.pertes / 1000) / 1,
        tauxDechets: Number(((month.dechets / month.entrants) * 100).toFixed(1)),
        tauxPertes: Number(((month.pertes / month.entrants) * 100).toFixed(1)),
        efficiency: Number(((month.emballes / month.entrants) * 100).toFixed(1)),
        temperature: Number((month.tempSum / month.count).toFixed(1)),
        humidity: Number((month.humiditySum / month.count).toFixed(1)),
        qualityScore: Number(((month.qualityA / month.count) * 100).toFixed(1))
      }));
  };

  const chartData = getChartData();

  const wasteData = filteredReports.slice(-7).reverse().map(report => ({
    date: new Date(report.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    dechets: report.tauxDechets,
    pertes: report.tauxPertes
  }));

  const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#8B5CF6'];

  const pieData = kpis ? [
    { name: 'EmballÃ©s', value: kpis.totalEmballes, color: '#10B981' },
    { name: 'DÃ©chets', value: kpis.totalDechets, color: '#EF4444' },
    { name: 'Pertes', value: kpis.totalPertes, color: '#F59E0B' }
  ] : [];

  const employeeStats = filteredReports.reduce((acc, report) => {
    if (!acc[report.employee]) {
      acc[report.employee] = { totalEntrants: 0, totalEmballes: 0, reports: 0 };
    }
    acc[report.employee].totalEntrants += report.entrants;
    acc[report.employee].totalEmballes += report.emballes;
    acc[report.employee].reports += 1;
    return acc;
  }, {} as Record<string, { totalEntrants: number; totalEmballes: number; reports: number }>);

  const employeeChartData = Object.entries(employeeStats).map(([name, stats]) => ({
    employee: name,
    efficiency: (stats.totalEmballes / stats.totalEntrants) * 100,
    reports: stats.reports
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Fruit For You</h1>
                <p className="text-sm text-gray-500">SystÃ¨me de Gestion d'Avocats</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', label: 'Tableau de Bord', icon: BarChart3 },
              { id: 'form', label: 'Nouveau Rapport', icon: Plus },
              { id: 'analytics', label: 'Analyses', icon: Activity },
              { id: 'history', label: 'Historique', icon: FileText }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Enhanced Filters */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Filtres & PÃ©riode:</span>
                </div>
                
                {/* Time Frame Selector */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  {[
                    { id: 'daily', label: 'Journalier' },
                    { id: 'weekly', label: 'Hebdomadaire' },
                    { id: 'monthly', label: 'Mensuel' }
                  ].map((frame) => (
                    <button
                      key={frame.id}
                      onClick={() => setTimeFrame(frame.id as 'daily' | 'weekly' | 'monthly')}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        timeFrame === frame.id
                          ? 'bg-white text-green-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      {frame.label}
                    </button>
                  ))}
                </div>
                
                <input
                  type="date"
                  placeholder="Date dÃ©but"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <input
                  type="date"
                  placeholder="Date fin"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <input
                  type="text"
                  placeholder="EmployÃ©..."
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <button
                  onClick={() => {
                    setDateRange({ start: '', end: '' });
                    setEmployeeFilter('');
                    setTimeFrame('daily');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                >
                  RÃ©initialiser
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            {kpis && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">Volume TraitÃ©</p>
                      <p className="text-2xl font-bold">{(kpis.totalEntrants / 1000).toFixed(1)} T</p>
                      <p className="text-green-200 text-xs">{kpis.totalEntrants.toLocaleString()} kg</p>
                    </div>
                    <Package className="h-8 w-8 text-green-200" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Rendement Global</p>
                      <p className="text-2xl font-bold">{kpis.efficiency.toFixed(1)}%</p>
                      <p className="text-blue-200 text-xs">Objectif: {'>'} 88%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-200" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-100 text-sm">Taux DÃ©chets</p>
                      <p className="text-2xl font-bold">{kpis.avgTauxDechets.toFixed(1)}%</p>
                      <p className="text-yellow-200 text-xs">Seuil: {'<'} 6%</p>
                    </div>
                    <Trash2 className="h-8 w-8 text-yellow-200" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-100 text-sm">Pertes Process</p>
                      <p className="text-2xl font-bold">{kpis.avgTauxPertes.toFixed(1)}%</p>
                      <p className="text-red-200 text-xs">Seuil: {'<'} 10%</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-200" />
                  </div>
                </div>
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Production Trend */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Ã‰volution de la Production {timeFrame === 'daily' ? '(JournaliÃ¨re)' : timeFrame === 'weekly' ? '(Hebdomadaire)' : '(Mensuelle)'}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {timeFrame === 'daily' ? 'Tonnes' : timeFrame === 'weekly' ? 'Dizaines de T' : 'Centaines de T'}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        `${value} ${timeFrame === 'daily' ? 'T' : timeFrame === 'weekly' ? 'x10T' : 'x100T'}`,
                        name
                      ]}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="entrants" 
                      stackId="1" 
                      stroke="#10B981" 
                      fill="#10B981" 
                      fillOpacity={0.7}
                      name="Entrants"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="emballes" 
                      stackId="2" 
                      stroke="#3B82F6" 
                      fill="#3B82F6" 
                      fillOpacity={0.7}
                      name="EmballÃ©s"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Efficiency & Quality Trend */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">EfficacitÃ© & QualitÃ©</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" domain={[80, 100]} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="efficiency" 
                      stroke="#10B981" 
                      strokeWidth={3}
                      name="EfficacitÃ© (%)"
                    />
                    {timeFrame !== 'daily' && (
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="qualityScore" 
                        stroke="#8B5CF6" 
                        strokeWidth={2}
                        name="Score QualitÃ© (%)"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Historical Trends */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendances Historiques (12 DerniÃ¨res Semaines)</h3>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={historicalTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      typeof value === 'number' ? value.toFixed(1) : value,
                      name
                    ]}
                  />
                  <Legend />
                  <Area 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="totalVolume" 
                    fill="#E5E7EB" 
                    stroke="#6B7280"
                    name="Volume (T)"
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="avgEfficiency" 
                    stroke="#10B981" 
                    strokeWidth={3}
                    name="EfficacitÃ© (%)"
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="qualityScore" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    name="QualitÃ© A (%)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Shift Performance Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Shift Efficiency */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance par Ã‰quipe</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={shiftPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="shift" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="efficiency" fill="#10B981" name="EfficacitÃ© (%)" />
                    <Bar dataKey="quality" fill="#8B5CF6" name="QualitÃ© A (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Environmental Conditions */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conditions Environnementales</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="temp" domain={[10, 20]} />
                    <YAxis yAxisId="humidity" orientation="right" domain={[50, 90]} />
                    <Tooltip />
                    <Legend />
                    <Line 
                      yAxisId="temp"
                      type="monotone" 
                      dataKey="temperature" 
                      stroke="#EF4444" 
                      strokeWidth={2}
                      name="TempÃ©rature (Â°C)"
                    />
                    <Line 
                      yAxisId="humidity"
                      type="monotone" 
                      dataKey="humidity" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      name="HumiditÃ© (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Additional Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Waste Trends */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Ã‰volution des Pertes</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={wasteData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="dechets" 
                      stroke="#EF4444" 
                      strokeWidth={3}
                      name="DÃ©chets (%)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="pertes" 
                      stroke="#F59E0B" 
                      strokeWidth={3}
                      name="Pertes (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Employee Performance */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance par EmployÃ©</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={employeeChartData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="employee" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="efficiency" fill="#10B981" name="EfficacitÃ© (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'form' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Nouveau Rapport Journalier</h2>
                <p className="text-gray-600">Saisissez les donnÃ©es de consommation globale de l'installation</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="inline h-4 w-4 mr-2" />
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="inline h-4 w-4 mr-2" />
                      Responsable du Rapport
                    </label>
                    <input
                      type="text"
                      placeholder="Nom du superviseur/responsable"
                      value={formData.employee}
                      onChange={(e) => setFormData({...formData, employee: e.target.value})}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ã‰quipe Principale
                    </label>
                    <select
                      value={formData.shift}
                      onChange={(e) => setFormData({...formData, shift: e.target.value as 'matin' | 'apres-midi' | 'nuit'})}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    >
                      <option value="matin">Ã‰quipe du Matin (6h-14h)</option>
                      <option value="apres-midi">Ã‰quipe de l'AprÃ¨s-midi (14h-22h)</option>
                      <option value="nuit">Ã‰quipe de Nuit (22h-6h)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Grade QualitÃ© Global
                    </label>
                    <select
                      value={formData.qualityGrade}
                      onChange={(e) => setFormData({...formData, qualityGrade: e.target.value as 'A' | 'B' | 'C'})}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    >
                      <option value="A">Grade A - Premium ({'>'}90% efficacitÃ© globale)</option>
                      <option value="B">Grade B - Standard (85-90% efficacitÃ© globale)</option>
                      <option value="C">Grade C - Basique ({'<'}85% efficacitÃ© globale)</option>
                    </select>
                  </div>
                </div>

                {/* Global Production Data */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Package className="h-5 w-5 mr-2" />
                    DonnÃ©es de Production Globale (Installation ComplÃ¨te)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Avocats Entrants (tonnes)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 1000 (1000T)"
                        value={formData.entrants}
                        onChange={(e) => setFormData({...formData, entrants: e.target.value})}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Volume total reÃ§u dans l'installation</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Avocats EmballÃ©s (tonnes)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 500 (500T)"
                        value={formData.emballes}
                        onChange={(e) => setFormData({...formData, emballes: e.target.value})}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Volume total prÃªt pour expÃ©dition</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        DÃ©chets (tonnes)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 250 (250T)"
                        value={formData.dechets}
                        onChange={(e) => setFormData({...formData, dechets: e.target.value})}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Volume total de dÃ©chets produits</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Non TrouvÃ©s/Perdus (tonnes)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 250 (250T)"
                        value={formData.unfound || ''}
                        onChange={(e) => setFormData({...formData, unfound: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Volume manquant/non comptabilisÃ©</p>
                    </div>
                  </div>
                </div>

                {/* Worker Allocations */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Dotations aux EmployÃ©s
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dotations DonnÃ©es (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 500 (dotations aux employÃ©s)"
                        value={formData.workerAllocations || ''}
                        onChange={(e) => setFormData({...formData, workerAllocations: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Avocats donnÃ©s aux employÃ©s</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre d'EmployÃ©s BÃ©nÃ©ficiaires
                      </label>
                      <input
                        type="number"
                        step="1"
                        placeholder="ex: 25"
                        value={formData.numberOfBeneficiaries || ''}
                        onChange={(e) => setFormData({...formData, numberOfBeneficiaries: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Nombre d'employÃ©s ayant reÃ§u des dotations</p>
                    </div>
                  </div>
                </div>

                {/* Environmental Conditions */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Conditions Environnementales
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        TempÃ©rature (Â°C)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 15.5"
                        value={formData.temperature}
                        onChange={(e) => setFormData({...formData, temperature: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        HumiditÃ© (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 70.5"
                        value={formData.humidity}
                        onChange={(e) => setFormData({...formData, humidity: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Heures OpÃ©rationnelles
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 8.0"
                        value={formData.processedHours}
                        onChange={(e) => setFormData({...formData, processedHours: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Heures d'opÃ©ration de l'installation</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes & Observations (optionnel)
                  </label>
                  <textarea
                    placeholder="Notes sur les conditions de travail, incidents, allocations spÃ©ciales aux employÃ©s, problÃ¨mes techniques, etc..."
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Mentionnez les dotations spÃ©ciales aux employÃ©s, les incidents, les conditions particuliÃ¨res, etc.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-3 px-6 rounded-lg shadow-md transition-all transform hover:scale-[1.02] focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:transform-none disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sauvegarde en cours...
                      </span>
                    ) : (
                      'Enregistrer le Rapport'
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 disabled:text-gray-400 font-medium py-3 px-6 rounded-lg shadow-md transition-all focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed"
                  >
                    RÃ©initialiser
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyses AvancÃ©es</h2>
              <p className="text-gray-600">Insights dÃ©taillÃ©s sur votre production</p>
            </div>

            {/* Efficiency Trend */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendance d'EfficacitÃ©</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="efficiency" 
                    stroke="#10B981" 
                    strokeWidth={3}
                    name="EfficacitÃ© (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Production Volume Comparison */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparaison des Volumes</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="entrants" fill="#10B981" name="Entrants (T)" />
                  <Bar dataKey="emballes" fill="#3B82F6" name="EmballÃ©s (T)" />
                  <Bar dataKey="dechets" fill="#EF4444" name="DÃ©chets (T)" />
                  <Bar dataKey="pertes" fill="#F59E0B" name="Pertes (T)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Historique des Rapports</h2>
                <p className="text-gray-600 mt-1">Rapports journaliers crÃ©Ã©s et sauvegardÃ©s dans Firebase</p>
              </div>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={fetchReportsFromFirebase}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                >
                  <Activity className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Actualiser</span>
                </button>
                <span className="text-sm text-gray-500">
                  {loading ? 'Chargement...' : `${filteredReports.length} rapport(s)`}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100">
                <div className="text-center">
                  <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Chargement des rapports</h3>
                  <p className="text-gray-600">RÃ©cupÃ©ration des donnÃ©es depuis Firebase...</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        EmployÃ©
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ã‰quipe
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entrants (T)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        EmballÃ©s (T)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        QualitÃ©
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        DÃ©chets (%)
                      </th>
                  ¨ƒh‹Í0‰[Şl¨$C”ŒH–x‹
ÒR2LÈĞ%6%"dÆ µ0ú‰BÑô3ø5]ÍZÈÑAeE0ì#.+K­ªÂîñ·®ûótz¼ü–}õC£††İ6Œ›‹”¨‚Ô%â%Ø\…š(ìñz2{kAÑØ¡ë8ù¯÷JÊ•šÂ~ãğ&M2)¸t`×§áE÷Œİú%Dì\°ª)_Uª}@Şç¿÷Hè\E2p	G¡<…¿3CÎN«^˜“ÕM Ò“íz?º–İG„­vÂFM‰ú2düØ‚aKpÉöæiØâìÏ•ˆø3kà&9#±)Sáœ½g—ë·˜­Y%mjV<Í.¢€Ôp<S®SUÆ,;¶™«í4,qTír|ÊPŠÇce©#ò&*ıhÁùgäûR<^,#©ÒsZG‡wºG|Å+˜Q¤ãõî1{¥
àvòPÁ[ôëöhÕµØòëuXZ¥5dĞc!ÊKÒHACÑ.¢¦YÏ”<ÆB)>o˜cĞÖNµäø¬¬`îr
œæP2ÿëç2ŠFÊûñø«^“º±Lâ‹+(l÷j+z}æ’Ğ¤BOc9¥]N÷\x2))ÒSPWš(ÌŸYÒ± ›æŒª‡	>p×‹ŸÔ¡êëïÉg¬q°Y›ä ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿aóEH@õÏ"…‡ßç¡Tà(ÇZë°–—Üºá6RªÍ'xïÓÓ £#FyÍŠsTß¦ ËÔåL€’`-8ñk´ü&;²¥ë—½V	‹<—MCÑfE‰Ú¢uXİ%ÊüÄ–*¦¶5-8|áâ3iSà9·äŒÓt*ØÕŒÄj­èp&I1´(ï.1j‰Î+—‚Ùê¥´fˆ4™8Õ»ÊáÇåç)"pFREÏ¶«x+¿„çİùàúĞ²=tí‚‘–ËÕÈqG›€TR–Ï¢¯ÃĞ’/Ëé  !² õ†÷Ü‰¦	u1àj“1©»Íª”°óŞ®¯ßô;4[§ÁÅOSÚ#$æG¿ˆä½xÕ õ'ù=}®\C’Q6C¹*;/ŒßâìvãÚ
õ…[íY³FBe<Tæ£?—ŠÉnÎòKÓ’"SŞwº"tßX©-GpÌ
©-•Mp=–|û@—°Ò€¢K't|xùüÛ!ApTe ¬…ê3öSù½'^	²²	‘yÀ fx\˜vØÁmaTĞp2›çÄ¨ëRlF¿”~Û¯à‹Ä¸›<~&[Zì3Šª•QÅüî2«[…S®æsvGÔosâj
0ìãÂºc”UÈa4ç‹FÙŞ#è¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[ ”ìœ…¨”gÂ—+ƒG1mBKŒ˜eU‰]=„/œ¢ì6U¹`¡7v§‘tUÈúgtaî¦ËlÑ'î¦"í*,¢â-ş!û#3¶JKY2ü‘' ï•óyo+•œ(0"ë‡Ùtƒ	‡İÛ¶,·a±v?ŠYªØã%ö&|­2¡ëŞŒ¢Ñ½äC2îK’Ğ“éZ±j½P½£Ûœ¤ó ÜÜn–Š ƒ§üôÔ_~7§C„ÊË£A†?U¾†w¥-Û¥Zó~;}¹otS¾rÚQTËÂ€Ä‘ìò»‹xPÿğ¤ÚÌ„|„(”v–uÙ+„éÖuÛg}Ò±w»õŸ€“ÿQ/ïş0é5Î«4`¸ºñikˆŞ©“{qã9ãa¹ÊL"zUîg¢®%#¨âu˜åÁ Ê4¬¨4°˜·¶ô
ÅYnÅ,’'¿S,Q:¶s‚^ A)-§–EfÈ2.gÍ¡;Ş©h‰o³ÇŠ)|øqY?D»±·Ïö(ŠAXÖŒavşÖ U§ÅÎ Ì‚t|ƒ…Ê,Í¤Lí"I%0ñ$&Ïî‹´Ó“ÛÆ "z.UŸ@ğ¾ûİL¹şÌ?_L¿êOğøûÜ¨¾Îº¿\Œ«6T»¼¿¹Oöc— ¿™Ne	ôHëÏNN‹‚È‘	EA4ûÇ.§ôûş$¹®Ã»Ö³yùòµ\ç~S§ªö•Z¿:¾mKŸÒ #H¶I‰?¹ì&6faòè3ëÜ¼º Ó>ıáöë¿èà›ñ{¼ŒX4äŠ›#ÆøéIşr·£Ï^®÷‚óG…İ)jqÃñïZ7¹ã>øú^ü6¾\‹¾æ|N[RqVx‚ÅéTvNP%¶%œù`½7Ï,k›Ğ¤“ÜSJt"ufDÕ/øNº´ù>S›†ÎIJ1°ü¿ş­úŒó¬(ñî+Ò¸»Åá[|Èî)sœ+¦cÈ	KÁˆ8y•-Dæ\ û(IÑ=}­bwö9bÿúo{«Å–ê0ÇÍ¹¹/ö¯Ïœ2ÑpC½H"EJkˆ—“b&³¹ò‹Ó¦½Àø™hXôáÙ>¼N#Û½Øä©ÎâwÊ™lAlå“{lò;oÜCÚ©‚`®öÕ€%×—‡Ò€B§VYKl¥_ÃsûécA7µãÈ¦¨y*¨bù$'ËÅ¸ÔÃ`›—\Saq·”“Ps›©ˆ·û}Ûõïz?­O–Ns	·¹Ém)x‰íFDU Qû¡ù¬.Ø¼“i´»N˜Š1LïğœÛÒì­$¤y–LÑ¡s97ZTœ†s½#ææT½ ˆ÷Ğ{Õıù=¨ı	H}ª™ß@¼É¶×­·æ ÎoÇŸîsñúœø–·]$£-NØ’yd£ _Ğw¦YÖA™
ñ:9ïÅ&³ZèfĞÁBê&°}(¾`½•N{äÁßÙ49+a&Ü†áw}ÍÀ[=tü”Ş/¹{Ìª~¡Ïä3¿I|Q<iI$?‡¯¹C&K*Š ¸§Uu`FGíj=ÕÔ×clvÎle¬ØtêØ3 nØëÀ—×ykè·l°ósñ†ÖA'™+sµZYºÏ(±YP,[šFÆ,+¢—v=öî[Â… ½<ƒ.cñ\åy´ä<–lBYÈÉILÑ+’æ{8|2cú"¼Üm)› ‚Òşb_WoÃMºGÌÏl"àÓÿï)­dúù·Å×Ûæàµ ¯ŒıXÙå1DÈ!QkT‘’¾"v{Å¤Ö8/O­’gĞöA+Og¨Ø,½ÃNk+Ü™–±"Ë«Ï³ÎJäÿ±~¯’“Š1nóÈ0ìlV(ûo$Ú¢Á‡mİFz½ VI™Q¶ii"áwäaeÍïÛà¹Ôè
Ît¿?‹Ü·à€õÏÍu¨aÛ£¤€½ÛX7ùÔqƒ»>°¿iT¨ ˆS_fŞEì(Ş¯àA~şOíYÎpÎÍ„°œš‰0 Õn×°ÎÓlÆ!æyºqXÚ ¨ÄÇ1ïÊÊbtXñ7û¾Šf>¡5n¨‰ò8½UÒ`o’‡ú(£u/øİ…@=Áÿì]*Äaj7–éRûB²dÉº’W£Ô†ÆıÆê,|âc²yy-%´g®?S)ÊXkºŠÏ²$¶D™Ñ4ÀÊ§÷Ö¼«(bf÷@‚Ã¼¹Œ€é/A½ïÚõ´ºõ­¬z@Ãˆ²ßÙ×ø¡EO›uªDŒ›€ë£kP.Ùã+¤î„R\½g570èÛğ±£¹„º @¹ßØ'Ü´~6[§ôaìŠÑú¦îd½\ôÙ{Õ¾ ò7ò<NaŞ¶R·»!9¿®Â9ğtò°Š]	ùUsìÔâ2Ig¸ÄıÄ²WÊÁzÊQ{Óˆ²×r¬bt–¡ã>İG*K€‡è]'[º„Ü³.QÓøXÓ«BTzúåuĞŞ%&¥ÕF€|Çâr÷'©’9¹¢O[±°“QšyĞu’TyÌÖu\™ee•ğ©£÷ä¬ipÿa’®ÿÛŸä¡ôÎ—©ÁBéÎ˜4˜‰•ØĞ Kş#?jgÁùë¢#ôv?4Å5t
sFlÃğïc­ÒFa<gª—RÚÎ#k®0¡+Ÿà¥µÏ)$>3°yCĞLË¹|ûpªîz%ø¬…œáV.#Û£‡ç­	ÒK’h×IW!_?…'¼âş3±éhà¨w¦“eoèú­àaÌ.?¬gÁ#Î¦´ÅblÀà§Öip;ÀjJßsøc~àïµóÓ2œg)™,ë•ÛšİÔ·XODş³•F€¡ºö-=jµØá¥vuİ¥²„êX¦
÷ølÍB7Vkk9ÈèZA¿ºV‡Ëîä§¤HŒÎ”2•ãnúvÊ#åÅÄÆl©¢†y]wîfõZhqxö^ı†-F~]ƒóÚÔT{ ¼ŸÉ—lİvÚ:ºx°ÛÄ´©Œ‚ÜM¶qs+ ¨Ÿ÷×¸`%aS›ÉVŸ˜›Y¹wëTBÙå*9äê·ğYë‰¼©r×#0¡¯C0¹gÌj\P´ÃÖ•‡(æu>¿çÔsèÛ&õÁTqKe¿JÌY\hòÂ*É'²c‹v)@n'³F.bb/V{…³1wË©HCT³‡ª]h¶Ax1…¼oó³2xˆdX²ÁÁX¯&5]c‚%\Tîb­B¶«X…nÆºhA"	f)-	%ı„}/Î`˜T”°1‡Şò"	fæq€°ßkì½÷şï¿Ê§ğûğõû/³»ÌÄ£<öÏÙ>üÏúÛ¿ê¼ÁO÷
uø³<ENÊCˆÈ™$@ûºúşö=¿®M³ÿş„²û
ğú­{®^s*3BnËì
Ì4µo_‚	RH @C:y*İ&"fšñ·óÌ¸ªm[š8‹ö‚ı´¹øƒ!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¾‹Ê‚ç¤¹×éÏhú{¶î
!¸«øû[ıÀ>(¢™Æôm8£ğVX—µ-~Ò(ÎÂeHuù`9“aª›’“"“N"•§ƒÅGğ˜œŸN.OÛ˜°Úüœ¹ú =øÄÛË4ğøã½ºÌr´èŠ)s ª‡÷½H¼IK‹Û8¥9òM³9Ñ1}-œëw¶_U¼ü‹ûŒ„ê {«ù@™ÍÆ{ïÜ€‰8“©F>{Š×Ùn¹« œƒØ'¶d8¨	zôÍ|®=cæK>˜³KÀÇ«i„’­zLÉl¥dW’lÈ2;GíŞd†—×!_‚p]A‚Ö	%<{h‹C1î™ká/´§Ü¾)IKÏ°g$Ú$¨ğÓpŸ•ß‘ak—–¡“úç¿Û>½:ø»ÔKK7©Yí0ù8İ)f›\	á©{åÎşOôûÉ$­G¨ƒx‹Å0‰[Şl¨$”ŒH–x‹
ÂR2LÈP%6%"dÆ µ0úBÕô3ø5]ÍZÈÑAeE0ì#.+K­ªÂîù·¬ÿótz¼ü†}õC#††İ6Œ›‹”¨ƒÔ%ê%Ø\…š ìñz2{kAÓØ£ë8ù¯×JÊ•šÊ~ãğ62)¸t`×§áE÷Œİú%ì\°ª!_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎN«^˜“ÕM Òíz?»İO„íVÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø3kà69#±)Sá½g—ë—˜­Y%mYjV<Í.¦€Öp<S®SUÆ,;¶™«í4,q3Tír|ÊPŠÇce¹#ğ&ªıhÁùgäûR<N,#©ÒsZW‡wºG|Å+˜Q¤ãôî{¥
àvòTÁ[ôëöhÕµØòËuX¥5dĞc!ÊKÒHAcÑ.¢¦YÏ´<ÆB)>o˜cĞÖNµ/äø¬Œ`nr
œæP2÷ëã2ŠFÊûñ¸»^“»1Lâ‹+(l÷j;zæ’Ğ¤BOc¥]N÷\x2))ÖSP_š(ÌŸYÚ± ›æŒª‡	>p×‹ŸÔ¡êëßÉg¬q°[›ä ¹NØ·ù9~ƒŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡ßç¡Tà(ÏZë°–—Ôºá6RªÍ'xïÓÓ £#FqÍŠsTß¦€ËÔåL€’`-8ñk”Ü&;²¥ë—½V	‹<—MCÁfE‰Ú¢uİ'ÊüÅ–*¦¶5-8|áâ3iSÀ9·æŒÓt*ØÕŒÄj­èp&Y1´(ï.1jˆÎ+›†Ùê¥´fˆ4›8Õ»ÈáÇåç)"pfREÍ¶«Vx+¿„ãİùàúĞ°=té‚‘–ËÕØqG›€TR’Ï¢¯ÃÑ’/Ëé  !²¢Ô†÷Ü‹¦	U1èê“1©»Íª”°óŞ®¯Şô;4[§ÁÅOSÚ!$æG¿ˆä½xÕ õ'ù9}¬\c’Q6C¹*;/ŒßâìvãÚ
õ…[íY³FJeÔæ£?—Š‰nÎòKÓ’"SŞgº tßX©-GpÌ
©-Mq=”|ûB—°‘Ò€¢K't|xùüÛ!ApTe Ü…ê3öSù…½'^	²²	‘yÀ fxL˜vØÁmaĞp2›çÄ¨ëRlG¿”^Û¯à‹Ä¸›¼~&CZì3½ª•QÅüî2ª_…S¯æsvGÔosâj0ìãÂºc”UÈ!4çFùŞ#è¦0êÎÀ„~Å8Mâ’¿¶ijR@À¹N-ºr[ ”ì˜…¨”gÂŸ+ƒG1mBKŒ˜eU‰]=„¯œ¢ì6U¹`¡wt§‘tUÀúgtaî¦ËlÑ'î¦"í:, â-ş!û#3öJKy2ü‘' ï•óùo+•œ(0.ëƒ‡Ùôƒ	‡İÛ¦<·c±v?
YªØã%ö&|¬2¡ëŞŒ¢Ñ½äC2îK¢Ğ²éX±k½P½ƒÛŒ¤÷ ÜÜî–ˆ ƒ§üôÔO~7¥C„ÊË£a†?U¾†w¥-Û¥Zó~;}9otS¾rÚQTËÂ€Ä‘ìĞò»ŠxPÿğ¤ÛÌ„|€.(”v–uÙ+„èÖuÛg}±w»õŸ€“ÿa/ïş0é5Î«4`¸ºñik‰Ş©“{qã9ãa¹ÊL"zUæg¢®%#¨âu˜çÁ è4¬¨5²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A-§–EfÈ2.VgÍ¡;ß)h‰o³ÇŠ)|øqY?D»±7ßö(ŠEXÖ„atşÖ U§ÅÎ Ì‚d|ƒ…Ê¬Å¤Lí#IY% ñ$$Ïî‹´Ó“ÛÆ "z.UŸ@ğ¾úÜL=şÌ?_L¿êOğøûÜ¨¾Ïº¿\œ«6T¿¼¿¸Oöc— ¿™Ne	ôhëÏ^O‹‚È‘	EA0ûÇ.¯´kş$»®Ã»Ö³yùòµ\çS§ªö•Ú¿:¾mKŸÒ #HI‰¹ì'6fAòè3ëÜ¼º Ó>ıáöë¿hà›ñ{¼ŒX4äŠ›#ÎøéIşr·£Ï^®÷‚ñG…İ)jqÓñïZ7¹ã>øú^ü6¾\‹¾ætL[RqVx‚ÅíTvNP%¶%œé`½Î,k›Ğ¤“Ü†SJt"ufDÔ/øNº´ù>S›†ÎIJ1°ü¿ş¬úŒó¬(ñî+Ò¸»ÅÀ[|Èî)sœ+¦g@	KÁˆ8y•-Dæ\ û(IÑ9}­bwö9bÿúo{«Å–ê1ÇÍ¹¹/ö¯Ï2ÑxK½H"EJkˆ—“b&³¹ò‹Óæ½Àø‘hXôáÉ?¼N#Û½Ø¤©ÎâwÊ™lAlå“{lò;oŞCÚ©‚`®òÕ€'÷—‡Ò€@§VYKl¥_ÃsûécA7µãÈ¦¨y*¨bù$%ËÄ¸ÔÃa›—\Saq·”“Ğs›©€·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼“i´»N˜Š1LïğÛÒÌ­$¤y–LÑ°s97ZTœ†s½#ææT½ ˆ÷Ğ{Õıù=¨ı	H}¢™ß`¼é¶×­·æ ÏïÇŸîsñúœø–·]$;£®-Ø’yd£ _Ğw¤YÖA™ñº9ïÅ&³ZèfĞÁBê&°})¾`½•NkäÁÿÙ49+a&Ü†áw}ÍÀ[=tü”Ş/¹{Mª~¡Ïä3¿I|Q<iI%?‡¯¹C.O*Š ¸§Uu`FGíj=ÕÔ×C,vle¬têÈ3 nØëÀ—×ykê·h°ósñ†ÖA'™+sµšYºÏ(±Y,[šFÆ,+¢–v=öî{Â… ½<ƒ.cñ\åy´ä<–lBYÈÉILÑ+’æ{8|2cú"¼„m)› ‚Öşâ_oÃMºGLÏl"àÓÿï)­dúù·Å×Ûæèµ ¯ŒıXÙå1LÈ!QkT‘’¾#‡v{Å¤×8/M­’gĞÖA+Oc¬Ø,½ÃÎc+Ü™–‘"Ë«Ï³îjäÿ±~¿’“ª1nóÈ0ìdV(ûo$Ú¢Á‡mİF~½ VY9Q¶ii2áwäaeÏïÚà”¹Ôè
Ît¿?ËÜ·à€õÏÍu¨aÛ£¤€½ÛX7éÔqƒ»>°·iT¨ ˆS^fŞUì(Ş¯àÁ~şÏíÙÎpÎÏ†°œÏ‰0 İn×°ÎÓlÆ!æiºqXÚ ¨ÅÇ1ïÊÊbtXñ6û¶šŠf>¡5n8™ò8½UÒ`o’‡ú(£u/ø…@=Áÿì]*Äaj7–éRûB¢dÉº’W£Ô†Æı’Æê,|âb²yy%´g®7S)ÊXkºŠË²$¶D™Ñ4ÀÊ§÷Ö¼ë(bb÷@€Ã¼¹Œ€ë¯A½ïÛõ´ºõ­¬z@Ãˆ2ßÙ×ø¡EO›uªDŒ›€ë£kP.Ùã+´î„R\½g5?0èÛğ±«¹„º @¹ßØ'Ü´~6[§ôaìŠÑø&îä½\ôÙ{Õ¾ ò&ò<^aŞ¶R·C»!9¿®‡Â9ğtò°Š]ùUsìTâ2Ig¸Äı@2WÊÁzÊQ{Óˆ²Wr,bt–¡ç>İG*K€‡è]'[º„Ü±.Q×øZÓ«BTzúåuĞŞ!&¥ÕF€üÇâr÷#©’¹¹¢O[±°“Qšyu’TyÌÖu\™åe•ğ©«÷ä¬ipÿa–®ÿÛŸàáôŞ—©ÁBéÎ˜4˜‰•ØĞ Kş#?jgÁùë¢#õö?4Å5t
sFlÃğïc­ÒF!<gª—PÚÏ#k®0¡+Ÿè¥µÏ)$>3°iCPLË¹|»pªÎzø­…œáV.#Û£‡ç­	ÒK’j×IW!_?…'¼âş3±éhà¨w¦“eoÈú­ààÌ.?¬OÁ#Î¦´ÅblÀà§Öip;ÂjJßsøc~àïµóÓ2œg)™,ë•ßšİÔ§XODş³µF ¡ºö-=jµØá¥veİ¥0„êX¦÷XlÍB7Vkk9ÈèZA¿º