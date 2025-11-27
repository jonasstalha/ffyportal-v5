import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart } from 'recharts';
import { Calendar, User, Users, Package, Trash2, AlertTriangle, TrendingUp, Download, Plus, BarChart3, PieChart as PieChartIcon, Activity, FileText, Filter } from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  doc, 
  deleteDoc,
  onSnapshot,
  DocumentChange,
  QuerySnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

type ReportData = {
  id: string;
  date: string;
  employee: string;
  shift: 'matin' | 'apres-midi' | 'nuit';
  notes?: string;
  entrants: number;
  emballes: number;
  dechets: number;
  unfound?: number;
  workerAllocations?: number;
  numberOfBeneficiaries?: number;
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
  // New fields for analytics and dashboard integration
  analyticsData?: {
    efficiency: string;
    wasteRate: string;
    qualityScore: number;
    productivityMetrics: {
      outputPerHour: number;
      wastePerHour: number;
    };
  };
  dashboardMetrics?: {
    shiftPerformance: {
      shift: 'matin' | 'apres-midi' | 'nuit';
      efficiency: number;
      wastage: number;
      productivity: number;
    };
  };
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

export const AvocadoProcessingDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reports, setReports] = useState<ReportData[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportData[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [timeFrame, setTimeFrame] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState({
    efficiency: { average: 0, trend: [] as number[] },
    waste: { average: 0, trend: [] as number[] },
    quality: { average: 0, distribution: { A: 0, B: 0, C: 0 } }
  });

  // Dashboard state
  const [dashboardMetrics, setDashboardMetrics] = useState({
    dailyStats: { input: 0, output: 0, waste: 0 },
    shiftPerformance: [] as ShiftPerformance[],
    trends: [] as HistoricalTrend[]
  });

  // Update functions for real-time synchronization
  const updateAnalyticsTab = (reports: ReportData[]) => {
    const analytics = {
      efficiency: {
        average: calculateAverageEfficiency(reports),
        trend: calculateEfficiencyTrend(reports)
      },
      waste: {
        average: calculateAverageWaste(reports),
        trend: calculateWasteTrend(reports)
      },
      quality: {
        average: calculateAverageQuality(reports),
        distribution: calculateQualityDistribution(reports)
      }
    };
    setAnalyticsData(analytics);
  };

  const updateDashboardTab = (reports: ReportData[]) => {
    const metrics = {
      dailyStats: calculateDailyStats(reports),
      shiftPerformance: calculateShiftPerformance(reports),
      trends: calculateHistoricalTrends(reports)
    };
    setDashboardMetrics(metrics);
  };

  const updateHistoryTab = (reports: ReportData[]) => {
    const sortedReports = [...reports].sort((a, b) => b.timestamp - a.timestamp);
    setFilteredReports(sortedReports);
  };

  // Calculation helpers
  const calculateAverageEfficiency = (reports: ReportData[]) => {
    return reports.reduce((acc, report) => acc + (report.emballes / report.entrants) * 100, 0) / reports.length;
  };

  const calculateEfficiencyTrend = (reports: ReportData[]) => {
    return reports.slice(-7).map(report => (report.emballes / report.entrants) * 100);
  };

  const calculateAverageWaste = (reports: ReportData[]) => {
    return reports.reduce((acc, report) => acc + (report.dechets / report.entrants) * 100, 0) / reports.length;
  };

  const calculateWasteTrend = (reports: ReportData[]) => {
    return reports.slice(-7).map(report => (report.dechets / report.entrants) * 100);
  };

  const calculateAverageQuality = (reports: ReportData[]) => {
    const scores = { A: 100, B: 75, C: 50 };
    return reports.reduce((acc, report) => acc + scores[report.qualityGrade], 0) / reports.length;
  };

  const calculateQualityDistribution = (reports: ReportData[]) => {
    return reports.reduce((acc, report) => {
      acc[report.qualityGrade]++;
      return acc;
    }, { A: 0, B: 0, C: 0 });
  };

  const calculateDailyStats = (reports: ReportData[]) => {
    const today = new Date().toISOString().split('T')[0];
    const todayReports = reports.filter(r => r.date === today);
    return {
      input: todayReports.reduce((acc, r) => acc + r.entrants, 0),
      output: todayReports.reduce((acc, r) => acc + r.emballes, 0),
      waste: todayReports.reduce((acc, r) => acc + r.dechets, 0)
    };
  };

  const calculateShiftPerformance = (reports: ReportData[]): ShiftPerformance[] => {
    const today = new Date().toISOString().split('T')[0];
    return ['matin', 'apres-midi', 'nuit'].map(shift => {
      const shiftReports = reports.filter(r => r.date === today && r.shift === shift);
      return {
        shift,
        efficiency: shiftReports.reduce((acc, r) => acc + (r.emballes / r.entrants) * 100, 0) / (shiftReports.length || 1),
        volume: shiftReports.reduce((acc, r) => acc + r.emballes, 0),
        employees: shiftReports.reduce((acc, r) => acc + (r.numberOfBeneficiaries || 0), 0),
        quality: calculateAverageQuality(shiftReports)
      };
    });
  };

  const calculateHistoricalTrends = (reports: ReportData[]): HistoricalTrend[] => {
    const periods = timeFrame === 'daily' ? 7 : timeFrame === 'weekly' ? 4 : 12;
    return [...Array(periods)].map((_, i) => ({
      period: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      avgEfficiency: calculateAverageEfficiency(reports),
      avgWaste: calculateAverageWaste(reports),
      avgLoss: reports.reduce((acc, r) => acc + r.pertes, 0) / reports.length,
      totalVolume: reports.reduce((acc, r) => acc + r.emballes, 0),
      qualityScore: calculateAverageQuality(reports),
      trend: 'stable'
    }));
  };

  // Enhanced Firebase functions with real-time updates
  const saveReportToFirebase = async (reportData: Omit<ReportData, 'id'>) => {
    try {
      setSaving(true);
      
      // Prepare the data with analytics metadata
      const enrichedData = {
        ...reportData,
        createdAt: new Date(),
        updatedAt: new Date(),
        analyticsData: {
          efficiency: ((parseFloat(formData.emballes) / parseFloat(formData.entrants)) * 100).toFixed(2),
          wasteRate: ((parseFloat(formData.dechets) / parseFloat(formData.entrants)) * 100).toFixed(2),
          qualityScore: formData.qualityGrade === 'A' ? 100 : formData.qualityGrade === 'B' ? 75 : 50,
          productivityMetrics: {
            outputPerHour: parseFloat(formData.emballes) / parseFloat(formData.processedHours),
            wastePerHour: parseFloat(formData.dechets) / parseFloat(formData.processedHours)
          }
        },
        // Add metadata for dashboard integration
        dashboardMetrics: {
          shiftPerformance: {
            shift: formData.shift,
            efficiency: ((parseFloat(formData.emballes) / parseFloat(formData.entrants)) * 100),
            wastage: ((parseFloat(formData.dechets) / parseFloat(formData.entrants)) * 100),
            productivity: parseFloat(formData.emballes) / parseFloat(formData.processedHours)
          }
        }
      };

      // Save to production_reports
      const docRef = await addDoc(collection(db, 'production_reports'), enrichedData);
      
      // Update analytics collection
      await addDoc(collection(db, 'analytics_data'), {
        reportId: docRef.id,
        timestamp: new Date(),
        metrics: enrichedData.analyticsData
      });

      // Update dashboard stats
      await addDoc(collection(db, 'dashboard_updates'), {
        reportId: docRef.id,
        timestamp: new Date(),
        metrics: enrichedData.dashboardMetrics
      });

      toast.success('Rapport et analyses sauvegardés avec succès!');
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
      
      // Subscribe to real-time updates
      const reportsQuery = query(collection(db, 'production_reports'), orderBy('timestamp', 'desc'));
      const analyticsQuery = query(collection(db, 'analytics_data'), orderBy('timestamp', 'desc'));
      const dashboardQuery = query(collection(db, 'dashboard_updates'), orderBy('timestamp', 'desc'));
      
      // Fetch all data in parallel
      const [reportsSnapshot, analyticsSnapshot, dashboardSnapshot] = await Promise.all([
        getDocs(reportsQuery),
        getDocs(analyticsQuery),
        getDocs(dashboardQuery)
      ]);
      
      // Process production reports
      const fetchedReports: ReportData[] = reportsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          analyticsData: analyticsSnapshot.docs
            .find(analytical => analytical.data().reportId === doc.id)?.data()?.metrics,
          dashboardMetrics: dashboardSnapshot.docs
            .find(dashboard => dashboard.data().reportId === doc.id)?.data()?.metrics
        } as ReportData;
      });
      
      setReports(fetchedReports);
      setFilteredReports(fetchedReports);
      
      // Update other tabs with new data
      updateAnalyticsTab(fetchedReports);
      updateDashboardTab(fetchedReports);
      updateHistoryTab(fetchedReports);
      
      toast.success(`${fetchedReports.length} rapports et analyses chargés depuis Firebase`);
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
      toast.success('Rapport supprimé avec succès');
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Erreur lors de la suppression du rapport');
    }
  };

  // Download individual daily report
  const downloadDailyReport = (report: ReportData) => {
    const reportContent = `
=== RAPPORT JOURNALIER DE CONSOMMATION GLOBALE ===
Fruit For You - Système de Gestion d'Avocats

Date: ${new Date(report.date).toLocaleDateString('fr-FR')}
Responsable: ${report.employee}
Équipe Principale: ${report.shift === 'matin' ? 'Matin (6h-14h)' : report.shift === 'apres-midi' ? 'Après-midi (14h-22h)' : 'Nuit (22h-6h)'}

=== DONNÉES DE PRODUCTION GLOBALE (Installation Complète) ===
• Avocats entrants: ${report.entrants.toLocaleString()} T (${(report.entrants*1000).toLocaleString()} kg)
• Avocats emballés: ${report.emballes.toLocaleString()} T (${(report.emballes*1000).toLocaleString()} kg)
• Déchets: ${report.dechets.toLocaleString()} T (${report.tauxDechets}%)
• Non trouvés/Perdus: ${(report.unfound || 0).toLocaleString()} T
• Pertes réelles: ${report.pertes.toLocaleString()} T (${report.tauxPertes}%)

=== DOTATIONS AUX EMPLOYÉS ===
• Allocations données: ${(report.workerAllocations || 0).toLocaleString()} kg
• Nombre de bénéficiaires: ${report.numberOfBeneficiaries || 0} employés
• Allocation moyenne: ${report.numberOfBeneficiaries ? ((report.workerAllocations || 0) / report.numberOfBeneficiaries).toFixed(1) : '0'} kg/employé

=== PERFORMANCE GLOBALE ===
• Efficacité globale: ${((report.emballes / report.entrants) * 100).toFixed(1)}%
• Grade qualité installation: ${report.qualityGrade}
• Heures opérationnelles: ${report.processedHours}h

=== CONDITIONS ENVIRONNEMENTALES ===
• Température: ${report.temperature}°C
• Humidité: ${report.humidity}%

=== OBSERVATIONS & NOTES ===
${report.notes || 'Aucune observation particulière'}

=== BILAN DE LA JOURNÉE ===
${report.tauxDechets <= 4 ? '✅' : report.tauxDechets <= 6 ? '⚠️' : '❌'} Taux de déchets: ${report.tauxDechets}% (Objectif: <6%)
${report.tauxPertes <= 7 ? '✅' : report.tauxPertes <= 10 ? '⚠️' : '❌'} Taux de pertes: ${report.tauxPertes}% (Objectif: <10%)
${((report.emballes / report.entrants) * 100) >= 88 ? '✅' : ((report.emballes / report.entrants) * 100) >= 85 ? '⚠️' : '❌'} Efficacité: ${((report.emballes / report.entrants) * 100).toFixed(1)}% (Objectif: >88%)

Rapport généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
    `.trim();

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rapport_journalier_${report.date}_${report.employee.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    toast.success('Rapport téléchargé avec succès!');
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
    notes: '',
    resto: '' // Updated field for 'Resto' to represent the current day's value, which will be subtracted from the total
  });
useEffect(() => {
  // Initial data load
  fetchReportsFromFirebase();

  // Set up real-time listeners
  const reportsListener = onSnapshot(
    query(collection(db, 'production_reports'), orderBy('timestamp', 'desc')),
    (snapshot) => {
      const changes = snapshot.docChanges();
      
      changes.forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          // Update reports state
          setReports(prevReports => {
            const updatedReports = [...prevReports];
            const index = updatedReports.findIndex(r => r.id === change.doc.id);
            const newData = { id: change.doc.id, ...change.doc.data() } as ReportData;
            
            if (index === -1) {
              updatedReports.unshift(newData);
            } else {
              updatedReports[index] = newData;
            }
            
            return updatedReports;
          });
          
          // Trigger updates for other tabs
          updateAnalyticsTab(reports);
          updateDashboardTab(reports);
          updateHistoryTab(reports);
        }
      });
    }
  );

  // Cleanup function
  return () => {
    reportsListener();
  };
}, []); // Empty dependency array for initial setup

// Form calculations effect
useEffect(() => {
  const entrants = parseFloat(formData.entrants) || 0;
  const resto = parseFloat(formData.resto) || 0;
  const emballes = parseFloat(formData.emballes) || 0;
  const dechets = parseFloat(formData.dechets) || 0;

  // Calculate unfound value
  const unfound = entrants - resto - emballes - dechets;

  // Avoid infinite re-renders
  if (formData.unfound !== unfound.toString()) {
    setFormData(prev => ({ ...prev, unfound: unfound.toString() }));
  }
}, [formData.entrants, formData.resto, formData.emballes, formData.dechets]);

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
      "Qualité excellente - avocats premium",
      "Légère augmentation des déchets due à la maturité",
      "Rendement optimal",
      "Contrôle qualité renforcé",
      "Tri plus sélectif aujourd'hui",
      "Bonne cadence de production",
      "Température idéale pour le traitement",
      "Humidité contrôlée",
      "Équipe très efficace aujourd'hui",
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
        const temperature = 12 + Math.random() * 6; // 12-18°C optimal for avocado processing
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

  const entrants = parseFloat(formData.entrants) || 0;
  const emballes = parseFloat(formData.emballes) || 0;
  const dechets = parseFloat(formData.dechets) || 0;
  const workerAllocations = parseFloat(formData.workerAllocations) || 0;
  const numberOfBeneficiaries = parseInt(formData.numberOfBeneficiaries) || 0;
  const resto = parseFloat(formData.resto) || 0;

  // ✅ Corrected calculations
  const pertes = entrants - resto - emballes - dechets;
  const unfound = pertes; // 🔥 recalculate unfound automatically

  const reportDate = new Date(formData.date);

  const newReportData: Omit<ReportData, 'id'> = {
    date: formData.date,
    employee: formData.employee,
    shift: formData.shift,
    entrants,
    emballes,
    dechets,
    unfound, // ✅ now it’s auto-calculated, not the old formData value
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

    const newReport: ReportData = { id: docId, ...newReportData };
    const updatedReports = [newReport, ...reports];
    setReports(updatedReports);

    resetForm();
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
      notes: '',
      resto: ''
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
    { name: 'Emballés', value: kpis.totalEmballes, color: '#10B981' },
    { name: 'Déchets', value: kpis.totalDechets, color: '#EF4444' },
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
                <p className="text-sm text-gray-500">Système de Gestion d'Avocats</p>
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
                  <span className="text-sm font-medium text-gray-700">Filtres & Période:</span>
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
                  placeholder="Date début"
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
                  placeholder="Employé..."
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
                  Réinitialiser
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            {kpis && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">Volume Traité</p>
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
                      <p className="text-yellow-100 text-sm">Taux Déchets</p>
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
                    Évolution de la Production {timeFrame === 'daily' ? '(Journalière)' : timeFrame === 'weekly' ? '(Hebdomadaire)' : '(Mensuelle)'}
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
                      name="Emballés"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Efficiency & Quality Trend */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Efficacité & Qualité</h3>
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
                      name="Efficacité (%)"
                    />
                    {timeFrame !== 'daily' && (
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="qualityScore" 
                        stroke="#8B5CF6" 
                        strokeWidth={2}
                        name="Score Qualité (%)"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Historical Trends */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendances Historiques (12 Dernières Semaines)</h3>
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
                    name="Efficacité (%)"
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="qualityScore" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    name="Qualité A (%)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Shift Performance Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Shift Efficiency */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance par Équipe</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={shiftPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="shift" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="efficiency" fill="#10B981" name="Efficacité (%)" />
                    <Bar dataKey="quality" fill="#8B5CF6" name="Qualité A (%)" />
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
                      name="Température (°C)"
                    />
                    <Line 
                      yAxisId="humidity"
                      type="monotone" 
                      dataKey="humidity" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      name="Humidité (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Additional Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Waste Trends */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Évolution des Pertes</h3>
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
                      name="Déchets (%)"
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance par Employé</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={employeeChartData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="employee" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="efficiency" fill="#10B981" name="Efficacité (%)" />
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
                <p className="text-gray-600">Saisissez les données de consommation globale de l'installation</p>
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
                      Équipe Principale
                    </label>
                    <select
                      value={formData.shift}
                      onChange={(e) => setFormData({...formData, shift: e.target.value as 'matin' | 'apres-midi' | 'nuit'})}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    >
                      <option value="matin">Équipe du Matin (6h-14h)</option>
                      <option value="apres-midi">Équipe de l'Après-midi (14h-22h)</option>
                      <option value="nuit">Équipe de Nuit (22h-6h)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Grade Qualité Global
                    </label>
                    <select
                      value={formData.qualityGrade}
                      onChange={(e) => setFormData({...formData, qualityGrade: e.target.value as 'A' | 'B' | 'C'})}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    >
                      <option value="A">Grade A - Premium ({'>'}90% efficacité globale)</option>
                      <option value="B">Grade B - Standard (85-90% efficacité globale)</option>
                      <option value="C">Grade C - Basique ({'<'}85% efficacité globale)</option>
                    </select>
                  </div>
                </div>

                {/* Global Production Data */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Package className="h-5 w-5 mr-2" />
                    Données de Production Globale (Installation Complète)
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
                      <p className="text-xs text-gray-500 mt-1">Volume total reçu dans l'installation</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Avocats Emballés (tonnes)
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
                      <p className="text-xs text-gray-500 mt-1">Volume total prêt pour expédition</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Déchets (tonnes)
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
                      <p className="text-xs text-gray-500 mt-1">Volume total de déchets produits</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Non Trouvés/Perdus (tonnes)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 250 (250T)"
                        value={formData.unfound || ''}
                        onChange={(e) => setFormData({...formData, unfound: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Volume manquant/non comptabilisé</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resto (tonnes)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 200 (200T)"
                        value={formData.resto || ''}
                        onChange={(e) => setFormData({...formData, resto: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Reste de production provenant du jour précédent</p>
                    </div>
                  </div>
                </div>

                {/* Worker Allocations */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Dotations aux Employés
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dotations Données (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 500 (dotations aux employés)"
                        value={formData.workerAllocations || ''}
                        onChange={(e) => setFormData({...formData, workerAllocations: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Avocats donnés aux employés</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre d'Employés Bénéficiaires
                      </label>
                      <input
                        type="number"
                        step="1"
                        placeholder="ex: 25"
                        value={formData.numberOfBeneficiaries || ''}
                        onChange={(e) => setFormData({...formData, numberOfBeneficiaries: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Nombre d'employés ayant reçu des dotations</p>
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
                        Température (°C)
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
                        Humidité (%)
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
                        Heures Opérationnelles
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ex: 8.0"
                        value={formData.processedHours}
                        onChange={(e) => setFormData({...formData, processedHours: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Heures d'opération de l'installation</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes & Observations (optionnel)
                  </label>
                  <textarea
                    placeholder="Notes sur les conditions de travail, incidents, allocations spéciales aux employés, problèmes techniques, etc..."
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Mentionnez les dotations spéciales aux employés, les incidents, les conditions particulières, etc.
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
                    Réinitialiser
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyses Avancées</h2>
              <p className="text-gray-600">Insights détaillés sur votre production</p>
            </div>

            {/* Efficiency Trend */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendance d'Efficacité</h3>
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
                    name="Efficacité (%)"
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
                  <Bar dataKey="emballes" fill="#3B82F6" name="Emballés (T)" />
                  <Bar dataKey="dechets" fill="#EF4444" name="Déchets (T)" />
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
                <p className="text-gray-600 mt-1">Rapports journaliers créés et sauvegardés dans Firebase</p>
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
                  <p className="text-gray-600">Récupération des données depuis Firebase...</p>
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
                        Employé
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Équipe
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entrants (T)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Emballés (T)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qualité
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Déchets (%)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pertes (%)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Efficacité
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredReports.map((report, index) => (
                      <tr key={report.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(report.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.employee}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            report.shift === 'matin' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : report.shift === 'apres-midi' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {report.shift === 'matin' ? 'Matin' : report.shift === 'apres-midi' ? 'Après-midi' : 'Nuit'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(report.entrants / 1000).toFixed(1)} T
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(report.emballes / 1000).toFixed(1)} T
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            report.qualityGrade === 'A' 
                              ? 'bg-green-100 text-green-800' 
                              : report.qualityGrade === 'B' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            Grade {report.qualityGrade}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            report.tauxDechets > 6 
                              ? 'bg-red-100 text-red-800' 
                              : report.tauxDechets > 4 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {report.tauxDechets}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            report.tauxPertes > 10 
                              ? 'bg-red-100 text-red-800' 
                              : report.tauxPertes > 7 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {report.tauxPertes}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 w-10 h-10">
                              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                <span className={`text-xs font-bold ${
                                  (report.emballes / report.entrants) * 100 > 88 
                                    ? 'text-green-600' 
                                    : (report.emballes / report.entrants) * 100 > 85 
 
 
                                    ? 'text-yellow-600' 
                                    : 'text-red-600'
                                }`}>
                                  {((report.emballes / report.entrants) * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => downloadDailyReport(report)}
                              className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                              title="Télécharger le rapport journalier"
                            >
                              <Download className="h-3 w-3" />
                              <span>PDF</span>
                            </button>
                            <button
                              onClick={() => deleteReportFromFirebase(report.id)}
                              className="flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
                              title="Supprimer le rapport"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {filteredReports.length === 0 && !loading && (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun rapport trouvé</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Commencez par créer un nouveau rapport journalier ou vérifiez vos filtres.
                  </p>
                  <button
                    onClick={() => setActiveTab('form')}
                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Créer un Rapport
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AvocadoProcessingDashboard;