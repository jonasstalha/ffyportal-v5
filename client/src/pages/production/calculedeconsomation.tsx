import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart } from 'recharts';
import { Calendar, User, Users, Package, Trash2, AlertTriangle, TrendingUp, Download, Plus, BarChart3, PieChart as PieChartIcon, Activity, FileText, Filter } from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp, 
  where, 
  setDoc, 
  getDoc, 
  deleteDoc,
  onSnapshot 
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../hooks/use-auth";
import { toast } from "sonner";
import FirebaseConnectionTest from "../../components/FirebaseConnectionTest";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import logo from "../../../assets/icon.png";
import { ReportData } from "../../types/reports";

interface AutoTableOptions {
  head?: any[][];
  body: any[][];
  startY?: number;
  margin?: { left: number; right: number };
  theme?: string;
  styles?: {
    fontSize?: number;
    cellPadding?: number;
    lineColor?: number[];
    lineWidth?: number;
  };
  columnStyles?: {
    [key: number]: {
      fontStyle?: string;
      cellWidth?: number;
      textColor?: number[];
      halign?: string;
      fontSize?: number;
    };
  };
  didParseCell?: (data: any) => void;
  willDrawCell?: (data: any) => void;
  didDrawCell?: (data: any) => void;
}

declare module "jspdf" {
  interface jsPDF {
    autoTable: typeof autoTable;
    lastAutoTable: { finalY: number };
  }
}

interface HistoricalTrend {
  period: string;
  avgEfficiency: number;
  avgWaste: number;
  avgLoss: number;
  totalVolume: number;
  qualityScore: number;
  trend: 'up' | 'down' | 'stable';
}

interface ShiftPerformance {
  shift: string;
  efficiency: number;
  volume: number;
  employees: number;
  quality: number;
}

const AvocadoProcessingDashboard = () => {
  const { user } = useAuth();
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

  // Enhanced data management with Firebase Firestore persistence and real-time analytics
  const saveReport = async (reportData: Omit<ReportData, 'id'>) => {
    try {
      setSaving(true);

      // Check authentication
      if (!user?.uid) {
        throw new Error('User must be authenticated to save reports');
      }

      // Calculate analytics data
      const efficiency = ((reportData.emballes / reportData.entrants) * 100).toFixed(2);
      const wasteRate = ((reportData.dechets / reportData.entrants) * 100).toFixed(2);
      const qualityScore = reportData.qualityGrade === 'A' ? 100 : reportData.qualityGrade === 'B' ? 75 : 50;
      
      // Prepare enriched data for Firestore
      const processedHours = reportData.processedHours || 1; // Default to 1 hour if not provided
      const firestoreData = {
        ...reportData,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        analyticsData: {
          efficiency,
          wasteRate,
          qualityScore,
          productivityMetrics: {
            outputPerHour: reportData.emballes / processedHours,
            wastePerHour: reportData.dechets / processedHours
          }
        },
        dashboardMetrics: {
          shiftPerformance: {
            shift: reportData.shift,
            efficiency: parseFloat(efficiency),
            wastage: parseFloat(wasteRate),
            productivity: reportData.emballes / processedHours
          }
        }
      };

      // Save to main collection
      const docRef = await addDoc(collection(db, 'consumption_reports'), firestoreData);
      
      // Save analytics data
      await setDoc(doc(db, 'analytics_data', docRef.id), {
        reportId: docRef.id,
        timestamp: serverTimestamp(),
        metrics: firestoreData.analyticsData
      });

      // Save dashboard updates
      await setDoc(doc(db, 'dashboard_updates', docRef.id), {
        reportId: docRef.id,
        timestamp: serverTimestamp(),
        metrics: firestoreData.dashboardMetrics
      });

      console.log('✅ Rapport et analyses sauvegardés dans Firestore avec ID:', docRef.id);

      // Update local state with the new report
      const newReport: ReportData = {
        id: docRef.id,
        ...firestoreData
      };

      const updatedReports = [newReport, ...reports];
      setReports(updatedReports);

      console.log('✅ Rapport sauvegardé avec succès!');
      return docRef.id;
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // Load reports from Firestore
  const loadReportsFromFirebase = async () => {
    try {
      setLoading(true);
      console.log('📥 Chargement des rapports depuis Firestore...');

      const q = query(
        collection(db, 'consumption_reports'),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const firebaseReports: ReportData[] = [];



      console.log(`✅ ${firebaseReports.length} rapports chargés depuis Firestore`);
      setReports(firebaseReports);
      setFilteredReports(firebaseReports);

    } catch (error) {
      console.error('❌ Erreur lors du chargement des rapports:', error);
      // Fallback to sample data if Firebase fails
      const wasCleared = localStorage.getItem('calculedeconsomation_cleared');
      if (!wasCleared) {
        try {
          const sampleData = await regenerateSampleData();
          if (Array.isArray(sampleData)) {
            setReports(sampleData);
            setFilteredReports(sampleData);
          }
        } catch (error) {
          console.error('Failed to generate sample data:', error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Save user preferences to Firebase
  const saveUserPreferences = async () => {
    try {
      if (!user?.uid) {
        console.log('User not authenticated, skipping preferences save');
        return;
      }

      const userPreferencesData = {
        activeTab,
        dateRange,
        employeeFilter,
        timeFrame,
        updatedAt: serverTimestamp(),
        userId: user.uid
      };

      await setDoc(doc(db, 'user_preferences', user.uid), userPreferencesData);
      console.log('✅ Préférences utilisateur sauvegardées dans Firebase');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des préférences:', error);
    }
  };

  // Load user preferences from Firebase
  const loadUserPreferences = async () => {
    try {
      if (!user?.uid) {
        console.log('User not authenticated, skipping preferences load');
        return;
      }

      const docRef = doc(db, 'user_preferences', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveTab(data.activeTab || 'dashboard');
        setDateRange(data.dateRange || { start: '', end: '' });
        setEmployeeFilter(data.employeeFilter || '');
        setTimeFrame(data.timeFrame || 'daily');
        console.log('✅ Préférences utilisateur chargées depuis Firebase');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des préférences:', error);
    }
  };

  // Save form data to Firebase (auto-save draft)
  const saveFormDraft = async (formData: any) => {
    try {
      if (!user?.uid) {
        console.log('User not authenticated, skipping draft save');
        return;
      }

      const draftData = {
        formType: 'consumption_report',
        draftData: formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userId: user.uid
      };

      await setDoc(doc(db, 'form_drafts', `consumption_${user.uid}`), draftData);
      console.log('✅ Brouillon sauvegardé automatiquement');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde du brouillon:', error);
    }
  };

  // Load form draft from Firebase
  const loadFormDraft = async () => {
    try {
      if (!user?.uid) {
        console.log('User not authenticated, skipping draft load');
        return null;
      }

      const docRef = doc(db, 'form_drafts', `consumption_${user.uid}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const lastSaved = data.updatedAt?.toDate();
        const now = new Date();
        const hoursDiff = (now.getTime() - lastSaved?.getTime()) / (1000 * 60 * 60);

        // Only load drafts that are less than 1 hour old
        if (hoursDiff <= 1) {
          console.log('✅ Brouillon récent chargé depuis Firebase');
          toast.info('📝 Brouillon récupéré', {
            description: 'Un brouillon récent a été trouvé et chargé.'
          });
          return data.draftData;
        } else {
          console.log('ℹ️ Brouillon trop ancien, ignoré');
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur lors du chargement du brouillon:', error);
      return null;
    }
  };

  // Save application state to Firebase
  const saveAppState = async (stateData: any) => {
    try {
      if (!user?.uid) {
        console.log('User not authenticated, skipping app state save');
        return;
      }

      const appStateData = {
        stateData,
        updatedAt: serverTimestamp(),
        userId: user.uid
      };

      await setDoc(doc(db, 'app_state', user.uid), appStateData);
      console.log('✅ État de l\'application sauvegardé dans Firebase');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde de l\'état:', error);
    }
  };

  // Load application state from Firebase
  const loadAppState = async () => {
    try {
      if (!user?.uid) {
        console.log('User not authenticated, skipping app state load');
        return;
      }

      const docRef = doc(db, 'app_state', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const stateData = data.stateData;
        console.log('✅ État de l\'application chargé depuis Firebase');
        return stateData;
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement de l\'état:', error);
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      // Delete from Firebase
      await deleteDoc(doc(db, 'consumption_reports', reportId));
      // Local state will update automatically via onSnapshot
      toast.success('🗑️ Rapport supprimé', {
        description: 'Le rapport a été supprimé avec succès de Firebase'
      });
      console.log('✅ Rapport supprimé avec succès de Firebase');
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      toast.error('❌ Erreur de suppression', {
        description: 'Impossible de supprimer le rapport. Veuillez réessayer.'
      });
    }
  };

  const clearAllReports = async () => {
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir supprimer tous les ${reports.length} rapports historiques ?\n\nCette action est irréversible et effacera toutes les données de consommation globale enregistrées.`
    );

    if (confirmed) {
      try {
        setLoading(true);

        // Clear local state
        setReports([]);
        setFilteredReports([]);

        // Save cleared state to Firebase
        await saveAppState({ cleared: true });

        // Clear form draft
        if (user?.uid) {
          await setDoc(doc(db, 'form_drafts', `consumption_${user.uid}`), {});
        }

        console.log('✅ Tous les rapports ont été supprimés');

        toast.success('🗑️ Données supprimées', {
          description: 'Tous les rapports historiques ont été supprimés avec succès!'
        });
      } catch (error) {
        console.error('❌ Erreur lors de la suppression:', error);
        toast.error('❌ Erreur de suppression', {
          description: 'Impossible de supprimer les données. Veuillez réessayer.'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const generateSampleDataSet = () => {
    const employees = [
      'Hassan Alami',
      'Fatima Benjelloun',
      'Ahmed El Fassi',
      'Leila Mansouri',
      'Karim Belhaj',
      'Sanaa Tazi'
    ];

    const shifts: Array<'matin' | 'apres-midi' | 'nuit'> = ['matin', 'apres-midi', 'nuit'];
    const qualityGrades: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];

    const data: ReportData[] = [];

    // Generate 6 months of data
    for (let i = 180; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      shifts.forEach((shift, shiftIndex) => {
        // Target volumes: ~1.7T per shift
        const baseProduction = shift === 'matin' ? 1.8 : shift === 'apres-midi' ? 1.7 : 1.5;
        const seasonalFactor = Math.sin((date.getMonth() + 1) * Math.PI / 6) * 0.2 + 1;
        const dailyVariation = 0.95 + Math.random() * 0.1;
        const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.8 : 1;

        const entrants = Number((baseProduction * seasonalFactor * dailyVariation * weekendFactor).toFixed(3));
        const resto = Number((0.05 + Math.random() * 0.1).toFixed(3));
        const totalAvailable = Number((entrants + resto).toFixed(3));

        const efficiency = 0.88 + Math.random() * 0.04;
        const wasteFactor = 0.04 + Math.random() * 0.02;
        const processLossFactor = 0.06 + Math.random() * 0.03;

        const emballes = Number((entrants * efficiency).toFixed(3));
        const dechets = Number((entrants * wasteFactor).toFixed(3));
        const unfound = Number((totalAvailable * processLossFactor).toFixed(3));

        const processedHours = 7 + Math.random();
        const temperature = 14 + Math.random() * 3;
        const humidity = 65 + Math.random() * 10;

        data.push({
          id: `sample-${i}-${shiftIndex}`,
          date: dateStr,
          employee: employees[Math.floor(Math.random() * employees.length)],
          shift,
          entrants,
          emballes,
          dechets,
          pertes: Number((totalAvailable * 0.015).toFixed(3)),
          resteAuj: resto,
          retour: unfound,
          consommation: emballes + dechets,
          dechetMachine: Number((dechets * 0.7).toFixed(3)),
          dechetPetit: Number((dechets * 0.3).toFixed(3)),
          tauxDechets: Number((wasteFactor * 100).toFixed(2)),
          tauxPertes: Number((processLossFactor * 100).toFixed(2)),
          efficiency: Number((efficiency * 100).toFixed(2)),
          qualityGrade: efficiency >= 0.88 ? 'A' : efficiency >= 0.85 ? 'B' : 'C',
          timestamp: date.getTime() + (shiftIndex * 8 * 60 * 60 * 1000),
          userId: 'sample_data',
          processedHours,
          temperature,
          humidity,
          unfound,
          workerAllocations: Math.round(40 + Math.random() * 40),
          numberOfBeneficiaries: Math.round(20 + Math.random() * 15),
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          week: Math.ceil((date.getDate() + date.getDay()) / 7),
          analyticsData: {
            efficiency: (efficiency * 100).toFixed(2),
            wasteRate: (wasteFactor * 100).toFixed(2),
            qualityScore: efficiency >= 0.88 ? 100 : efficiency >= 0.85 ? 75 : 50,
            productivityMetrics: {
              outputPerHour: Number((emballes / processedHours).toFixed(2)),
              wastePerHour: Number((dechets / processedHours).toFixed(2))
            }
          },
          dashboardMetrics: {
            shiftPerformance: {
              shift,
              efficiency: Number((efficiency * 100).toFixed(2)),
              wastage: Number((wasteFactor * 100).toFixed(2)),
              productivity: Number((emballes / processedHours).toFixed(2))
            }
          }
        });
      });
    }

    return data;
  };

  const regenerateSampleData = async () => {
    const confirmed = window.confirm(
      `Voulez-vous régénérer les données d'exemple ?\n\nCela créera environ 473 rapports historiques pour les tests et la démonstration.`
    );

    if (confirmed) {
      try {
        setLoading(true);
        const generatedData = generateSampleDataSet();
        
        // Update state with generated data
        setReports(generatedData);
        setFilteredReports(generatedData);

        // Save each sample report to Firebase
        for (const report of generatedData) {
          const firestoreData = {
            ...report,
            createdBy: user?.uid || 'sample_data',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          await addDoc(collection(db, 'consumption_reports'), firestoreData);
        }

        // Update app state to not cleared
        await saveAppState({ cleared: false });

        console.log('✅ Données d\'exemple régénérées et sauvegardées dans Firebase');

        toast.success('📊 Données d\'exemple créées', {
          description: `${generatedData.length} rapports historiques générés et sauvegardés dans Firebase!`
        });
      } catch (error) {
        console.error('❌ Erreur lors de la régénération:', error);
        toast.error('❌ Erreur de génération', {
          description: 'Impossible de créer les données d\'exemple. Veuillez réessayer.'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // Comprehensive backup system - saves all user data to Firebase
  const createBackup = async () => {
    try {
      if (!user?.uid) {
        toast.error('❌ Authentification requise', {
          description: 'Vous devez être connecté pour créer une sauvegarde'
        });
        return;
      }

      const backupData = {
        reports: reports,
        userPreferences: {
          activeTab,
          dateRange,
          employeeFilter,
          timeFrame
        },
        formData: formData,
        createdAt: serverTimestamp(),
        userId: user.uid,
        backupType: 'manual',
        version: '1.0'
      };

      await setDoc(doc(db, 'backups', `consumption_backup_${user.uid}_${Date.now()}`), backupData);

      toast.success('💾 Sauvegarde créée', {
        description: 'Une sauvegarde complète de vos données a été créée dans Firebase'
      });

      console.log('✅ Sauvegarde complète créée dans Firebase');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      toast.error('❌ Erreur de sauvegarde', {
        description: 'Impossible de créer la sauvegarde. Veuillez réessayer.'
      });
    }
  };

  // Real-time data synchronization
  const syncWithFirebase = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadReportsFromFirebase(),
        loadUserPreferences(),
        saveUserPreferences()
      ]);

      toast.success('🔄 Synchronisation réussie', {
        description: 'Vos données sont maintenant synchronisées avec Firebase'
      });
    } catch (error) {
      console.error('❌ Erreur de synchronisation:', error);
      toast.error('❌ Erreur de synchronisation', {
        description: 'Impossible de synchroniser avec Firebase'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadDailyReport = (report: ReportData) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPos = 20;

    // Professional Industrial Color Palette
    const colors = {
      // Primary Brand Colors
      primary: [0, 102, 204],           // Industrial Blue
      primaryDark: [0, 71, 143],        // Darker Blue
      accent: [255, 152, 0],            // Safety Orange

      // Grayscale Hierarchy
      textPrimary: [26, 32, 44],        // Almost Black
      textSecondary: [71, 85, 105],     // Slate Gray
      textTertiary: [148, 163, 184],    // Light Gray

      // Background & Surfaces
      bgPrimary: [255, 255, 255],       // White
      bgSecondary: [248, 250, 252],     // Off-White
      bgAccent: [241, 245, 249],        // Light Blue-Gray

      // Borders & Dividers
      border: [226, 232, 240],          // Light Border
      divider: [203, 213, 225],         // Medium Border

      // Status Colors
      success: [16, 185, 129],          // Green
      warning: [245, 158, 11],          // Amber
      danger: [239, 68, 68],            // Red
      info: [59, 130, 246],             // Blue
    };

    const MARGIN = 15;
    const CONTENT_WIDTH = pageWidth - (MARGIN * 2);
    const SECTION_SPACING = 10;

    // === HELPER FUNCTIONS ===

    const addBox = (x: number, y: number, w: number, h: number, fillColor: number[], borderColor?: number[]) => {
      pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
      pdf.rect(x, y, w, h, 'F');

      if (borderColor) {
        pdf.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        pdf.setLineWidth(0.3);
        pdf.rect(x, y, w, h, 'D');
      }
    };

    const addGradientBox = (x: number, y: number, w: number, h: number) => {
      // Simulate gradient with multiple rectangles
      const steps = 20;
      const stepHeight = h / steps;

      for (let i = 0; i < steps; i++) {
        const ratio = i / steps;
        const r = colors.primary[0] + (colors.primaryDark[0] - colors.primary[0]) * ratio;
        const g = colors.primary[1] + (colors.primaryDark[1] - colors.primary[1]) * ratio;
        const b = colors.primary[2] + (colors.primaryDark[2] - colors.primary[2]) * ratio;

        pdf.setFillColor(r, g, b);
        pdf.rect(x, y + (i * stepHeight), w, stepHeight, 'F');
      }
    };

    const addText = (text: string, x: number, y: number, options: any = {}) => {
      const {
        size = 10,
        color = colors.textPrimary,
        bold = false,
        align = 'left',
        maxWidth = CONTENT_WIDTH
      } = options;

      pdf.setFontSize(size);
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');

      const lines = pdf.splitTextToSize(text, maxWidth);

      if (align === 'center') {
        pdf.text(lines, x, y, { align: 'center' });
      } else if (align === 'right') {
        pdf.text(lines, x, y, { align: 'right' });
      } else {
        pdf.text(lines, x, y);
      }

      return lines.length * size * 0.4;
    };

    const addSectionHeader = (title: string) => {
      yPos += SECTION_SPACING;

      // Left accent bar
      pdf.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      pdf.rect(MARGIN, yPos, 3, 8, 'F');

      // Section title
      addText(title, MARGIN + 6, yPos + 6, {
        size: 12,
        bold: true,
        color: colors.textPrimary
      });

      yPos += 12;

      // Bottom border
      pdf.setDrawColor(colors.divider[0], colors.divider[1], colors.divider[2]);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN, yPos, pageWidth - MARGIN, yPos);

      yPos += 8;
    };

    const addMetricCard = (x: number, y: number, w: number, h: number, data: any) => {
      // Card background with shadow effect
      pdf.setFillColor(245, 245, 245);
      pdf.rect(x + 1, y + 1, w, h, 'F');

      // Main card
      addBox(x, y, w, h, colors.bgPrimary, colors.border);

      // Status indicator bar
      pdf.setFillColor(data.statusColor[0], data.statusColor[1], data.statusColor[2]);
      pdf.rect(x, y, w, 4, 'F');

      // Label
      addText(data.label, x + 6, y + 14, {
        size: 8,
        color: colors.textSecondary
      });

      // Value
      addText(data.value, x + 6, y + 26, {
        size: 16,
        bold: true,
        color: data.statusColor
      });

      // Target/Benchmark
      addText(data.target, x + 6, y + h - 6, {
        size: 7,
        color: colors.textTertiary
      });
    };

    // === DOCUMENT HEADER ===
    addGradientBox(0, 0, pageWidth, 35);

    // Company logo area (placeholder)
    pdf.setFillColor(colors.bgPrimary[0], colors.bgPrimary[1], colors.bgPrimary[2]);
    pdf.circle(MARGIN + 8, 17.5, 8, 'F');
    addText('FFY', MARGIN + 8, 19, {
      size: 8,
      bold: true,
      color: colors.primary,
      align: 'center'
    });

    // Company name
    addText('FRUIT FOR YOU', MARGIN + 22, 15, {
      size: 16,
      bold: true,
      color: colors.bgPrimary
    });

    addText('Système de Traçabilité Intégré', MARGIN + 22, 22, {
      size: 8,
      color: colors.bgSecondary
    });

    // Document type
    addText('RAPPORT QUOTIDIEN', pageWidth - MARGIN, 15, {
      size: 10,
      bold: true,
      color: colors.bgPrimary,
      align: 'right'
    });

    addText('Production & Qualité', pageWidth - MARGIN, 22, {
      size: 8,
      color: colors.bgSecondary,
      align: 'right'
    });

    yPos = 50;

    // === DOCUMENT TITLE ===
    addText('ANALYSE JOURNALIÈRE DE PRODUCTION', pageWidth / 2, yPos, {
      size: 18,
      bold: true,
      color: colors.textPrimary,
      align: 'center'
    });

    yPos += 8;

    addText('Traçabilité & Performance des Avocats', pageWidth / 2, yPos, {
      size: 11,
      color: colors.textSecondary,
      align: 'center'
    });

    yPos += 15;

    // === INFORMATION GRID ===
    const infoBoxY = yPos;
    const infoBoxH = 45;

    addBox(MARGIN, infoBoxY, CONTENT_WIDTH, infoBoxH, colors.bgSecondary, colors.border);

    const colW = CONTENT_WIDTH / 4;
    const infoY = infoBoxY + 12;

    // Date
    addText('DATE DU RAPPORT', MARGIN + 8, infoY, {
      size: 7,
      color: colors.textTertiary
    });
    addText(new Date(report.date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }), MARGIN + 8, infoY + 8, {
      size: 10,
      bold: true,
      color: colors.textPrimary
    });

    // Shift
    const shiftText = report.shift === 'matin' ? 'Matin (06h-14h)' :
      report.shift === 'apres-midi' ? 'Après-midi (14h-22h)' :
        'Nuit (22h-06h)';
    addText('ÉQUIPE', MARGIN + colW + 8, infoY, {
      size: 7,
      color: colors.textTertiary
    });
    addText(shiftText, MARGIN + colW + 8, infoY + 8, {
      size: 10,
      bold: true,
      color: colors.textPrimary
    });

    // Employee
    addText('RESPONSABLE', MARGIN + colW * 2 + 8, infoY, {
      size: 7,
      color: colors.textTertiary
    });
    addText(report.employee, MARGIN + colW * 2 + 8, infoY + 8, {
      size: 10,
      bold: true,
      color: colors.textPrimary
    });

    // Quality Grade
    addText('GRADE QUALITÉ', MARGIN + colW * 3 + 8, infoY, {
      size: 7,
      color: colors.textTertiary
    });
    addText(report.qualityGrade, MARGIN + colW * 3 + 8, infoY + 8, {
      size: 10,
      bold: true,
      color: colors.textPrimary
    });

    // Operating Hours
    addText('HEURES OPÉRATION', MARGIN + 8, infoY + 20, {
      size: 7,
      color: colors.textTertiary
    });
    addText(`${report.processedHours}h`, MARGIN + 8, infoY + 28, {
      size: 10,
      bold: true,
      color: colors.textPrimary
    });

    // Temperature
    const temperature = report.temperature || 0;
    const tempColor = temperature >= 10 && temperature <= 20 ?
      colors.success : colors.warning;
    addText('TEMPÉRATURE', MARGIN + colW + 8, infoY + 20, {
      size: 7,
      color: colors.textTertiary
    });
    addText(`${report.temperature}°C`, MARGIN + colW + 8, infoY + 28, {
      size: 10,
      bold: true,
      color: tempColor
    });

    // Humidity
    const humidity = report.humidity || 0;
    const humidityColor = humidity >= 60 && humidity <= 80 ?
      colors.success : colors.warning;
    addText('HUMIDITÉ', MARGIN + colW * 2 + 8, infoY + 20, {
      size: 7,
      color: colors.textTertiary
    });
    addText(`${report.humidity}%`, MARGIN + colW * 2 + 8, infoY + 28, {
      size: 10,
      bold: true,
      color: humidityColor
    });

    // Report Generation
    addText('GÉNÉRÉ LE', MARGIN + colW * 3 + 8, infoY + 20, {
      size: 7,
      color: colors.textTertiary
    });
    addText(new Date().toLocaleDateString('fr-FR'), MARGIN + colW * 3 + 8, infoY + 28, {
      size: 10,
      bold: true,
      color: colors.textPrimary
    });

    yPos = infoBoxY + infoBoxH;

    // === KPI METRICS ===
    addSectionHeader('INDICATEURS CLÉS DE PERFORMANCE');

    const totalAvailable = report.entrants + (report.resto || 0);
    const efficiency = totalAvailable > 0 ? ((report.emballes / totalAvailable) * 100) : 0;
    const efficiencyColor = efficiency >= 88 ? colors.success :
      efficiency >= 85 ? colors.warning : colors.danger;

    const totalAccountedOutput = report.emballes + report.dechets +
      ((report.workerAllocations || 0) / 1000);
    const accountedPercentage = totalAvailable > 0 ? (totalAccountedOutput / totalAvailable) * 100 : 0;
    const accountColor = accountedPercentage >= 98 ? colors.success :
      accountedPercentage >= 95 ? colors.warning : colors.danger;

    const unfoundPercentage = totalAvailable > 0 ? ((report.unfound || 0) / totalAvailable) * 100 : 0;
    const unfoundColor = unfoundPercentage <= 3 ? colors.success :
      unfoundPercentage <= 5 ? colors.warning : colors.danger;

    const wasteColor = report.tauxDechets <= 6 ? colors.success :
      report.tauxDechets <= 10 ? colors.warning : colors.danger;

    const metrics = [
      {
        label: "Efficacité d'Emballage",
        value: `${efficiency.toFixed(1)}%`,
        target: 'Objectif: >88%',
        statusColor: efficiencyColor
      },
      {
        label: 'Taux de Déchets',
        value: `${report.tauxDechets}%`,
        target: 'Objectif: <6%',
        statusColor: wasteColor
      },
      {
        label: 'Traçabilité Totale',
        value: `${accountedPercentage.toFixed(1)}%`,
        target: 'Objectif: >98%',
        statusColor: accountColor
      },
      {
        label: 'Produits Non Localisés',
        value: `${unfoundPercentage.toFixed(2)}%`,
        target: 'Objectif: <3%',
        statusColor: unfoundColor
      }
    ];

    const cardW = (CONTENT_WIDTH - 12) / 4;
    const cardH = 45;

    for (let i = 0; i < metrics.length; i++) {
      addMetricCard(
        MARGIN + (i * (cardW + 4)),
        yPos,
        cardW,
        cardH,
        metrics[i]
      );
    }

    yPos += cardH;

    // === PRODUCTION FLOW VISUALIZATION ===

    // === DETAILED METRICS ===
    addSectionHeader('DONNÉES DÉTAILLÉES');

    const detailBoxH = 60;
    const detailColW = CONTENT_WIDTH / 2 - 4;

    // Left column
    addBox(MARGIN, yPos, detailColW, detailBoxH, colors.bgPrimary, colors.border);

    let detailY = yPos + 10;
    const detailItems1 = [
      { label: 'Avocats Entrants (Total)', value: `${totalAvailable.toFixed(1)} KG`, color: colors.textPrimary },
      { label: '  - Dont Entrants', value: `${(report.entrants || 0).toFixed(1)} KG`, color: colors.textSecondary },
      { label: '  - Resto (précédent)', value: `${(report.resto || 0).toFixed(2)} KG`, color: colors.textSecondary },
      { label: 'Avocats Emballés', value: `${report.emballes.toFixed(1)} KG`, color: colors.success },
      { label: 'Déchets Totaux', value: `${report.dechets.toFixed(1)} KG`, color: colors.danger },
      { label: 'Produits Perdus', value: `${(report.unfound || 0).toFixed(3)} T`, color: colors.warning }
    ];

    for (const item of detailItems1) {
      addText(item.label, MARGIN + 8, detailY, {
        size: 9,
        color: colors.textSecondary
      });
      addText(item.value, MARGIN + detailColW - 8, detailY, {
        size: 10,
        bold: true,
        color: item.color,
        align: 'right'
      });
      detailY += 12;
    }

    // Right column
    addBox(MARGIN + detailColW + 8, yPos, detailColW, detailBoxH, colors.bgPrimary, colors.border);

    detailY = yPos + 10;
    const avgAllocation = report.numberOfBeneficiaries ?
      ((report.workerAllocations || 0) / report.numberOfBeneficiaries).toFixed(1) : '0';

    const detailItems2 = [
      { label: 'Dotations Employés', value: `${((report.workerAllocations || 0) / 1000).toFixed(3)} KG`, color: colors.textPrimary },
      { label: 'Nombre de Bénéficiaires', value: `${report.numberOfBeneficiaries || 0}`, color: colors.info },
      { label: 'Allocation Moyenne', value: `${avgAllocation} kg`, color: colors.info },
      { label: 'Total Tracé', value: `${totalAccountedOutput.toFixed(2)} KG`, color: accountColor }
    ];

    for (const item of detailItems2) {
      addText(item.label, MARGIN + detailColW + 16, detailY, {
        size: 9,
        color: colors.textSecondary
      });
      addText(item.value, pageWidth - MARGIN - 8, detailY, {
        size: 10,
        bold: true,
        color: item.color,
        align: 'right'
      });
      detailY += 12;
    }

    yPos += detailBoxH;

    // === OBSERVATIONS ===
    addSectionHeader('OBSERVATIONS & CONTEXTE');

    const notesContent = report.notes || 'Aucune observation particulière n\'a été enregistrée pour cette période.';
    const notesLines = pdf.splitTextToSize(notesContent, CONTENT_WIDTH - 16);
    const notesH = Math.max(35, notesLines.length * 5 + 16);

    addBox(MARGIN, yPos, CONTENT_WIDTH, notesH, colors.bgSecondary, colors.border);

    pdf.setFillColor(colors.info[0], colors.info[1], colors.info[2]);
    pdf.rect(MARGIN, yPos, 4, notesH, 'F');

    addText(notesContent, MARGIN + 12, yPos + 10, {
      size: 9,
      color: colors.textSecondary,
      maxWidth: CONTENT_WIDTH - 24
    });

    yPos += notesH;

    // === FOOTER ===
    const footerY = pageHeight - 25;

    // Footer background
    addBox(0, footerY, pageWidth, 25, colors.bgAccent);

    pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    pdf.setLineWidth(0.5);
    pdf.line(0, footerY, pageWidth, footerY);

    addText(`Document confidentiel - Fruit For You © ${new Date().getFullYear()}`, MARGIN, footerY + 10, {
      size: 7,
      color: colors.textTertiary
    });

    addText(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      pageWidth - MARGIN, footerY + 10, {
      size: 7,
      color: colors.textTertiary,
      align: 'right'
    });

    addText('Page 1/1', pageWidth / 2, footerY + 18, {
      size: 7,
      color: colors.textTertiary,
      align: 'center'
    });

    // === SAVE PDF ===
    const reportDate = new Date(report.date).toISOString().split('T')[0];
    const filename = `FruitForYou_Production_${reportDate}_${report.employee.replace(/\s+/g, '_')}.pdf`;
    pdf.save(filename);

    toast.success('📄 Rapport PDF généré avec succès!', {
      description: `${filename} téléchargé`
    });

    console.log('✅ Rapport PDF professionnel généré:', filename);
  };


  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    employee: '',
    shift: 'matin' as 'matin' | 'apres-midi' | 'nuit',
    entrants: '',
    resto: '',
    emballes: '',
    dechets: '',
    unfojund: '',
    workerAllocations: '',
    numberOfBeneficiaries: '',
    qualityGrade: 'B' as 'A' | 'B' | 'C',
    temperature: '',
    humidity: '',
    processedHours: '',
    notes: ''
  });

  const [cachedCoords, setCachedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [weatherInfo, setWeatherInfo] = useState<{
    condition?: string;
    temperature?: string;
    humidity?: string;
    precipitation?: string;
    wind?: string;
  } | null>(null);

  const mapWeatherCodeToFrench = (code: number) => {
    if (code === 0) return 'Clair';
    if (code === 1 || code === 2 || code === 3) return 'Partiellement ensoleillé';
    if (code >= 45 && code <= 48) return 'Brouillard';
    if (code >= 51 && code <= 57) return 'Bruine';
    if (code >= 61 && code <= 67) return 'Pluie';
    if (code >= 71 && code <= 77) return 'Neige';
    if (code >= 80 && code <= 82) return 'Averses';
    if (code >= 95 && code <= 99) return 'Orage';
    return 'Inconnu';
  };

  const DEFAULT_LATITUDE = 31.63;
  const DEFAULT_LONGITUDE = -8.0;

  const getLocationCoordinates = async (): Promise<{ lat: number; lon: number }> => {
    if (cachedCoords) return cachedCoords;

    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        resolve({ lat: DEFAULT_LATITUDE, lon: DEFAULT_LONGITUDE });
        return;
      }

      const options: PositionOptions = { enableHighAccuracy: false, timeout: 5000, maximumAge: 1000 * 60 * 5 };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setCachedCoords(coords);
          resolve(coords);
        },
        () => {
          resolve({ lat: DEFAULT_LATITUDE, lon: DEFAULT_LONGITUDE });
        },
        options
      );
    });
  };

  const fetchWeatherForDate = async (date: string, lat: number = DEFAULT_LATITUDE, lon: number = DEFAULT_LONGITUDE) => {
    try {
      // Use noon as default hour for daily consumption reports when no specific time is provided
      const hour = '12';
      const startDate = date;
      const endDate = date;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relativehumidity_2m,relative_humidity_2m,weathercode,precipitation,precipitation_probability,windspeed_10m&start_date=${startDate}&end_date=${endDate}&timezone=auto`;

      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();

      const times: string[] = json.hourly?.time || [];
      const temps: number[] = json.hourly?.temperature_2m || [];
      // Open-Meteo naming varies; try both
      const hums: number[] = json.hourly?.relative_humidity_2m || json.hourly?.relativehumidity_2m || [];
      const codes: number[] = json.hourly?.weathercode || [];
      const precips: number[] = json.hourly?.precipitation || [];
      const precipProbs: number[] = json.hourly?.precipitation_probability || [];
      const winds: number[] = json.hourly?.windspeed_10m || [];

      if (!times.length) return null;

      const targetPrefix = `${date}T${hour}:00`;
      let idx = times.findIndex(t => t.startsWith(targetPrefix));
      if (idx === -1) idx = times.findIndex(t => t.includes(`T${hour}:`));
      if (idx === -1) idx = 0;

      const temperature = temps[idx];
      const humidity = hums[idx];
      const weathercode = codes[idx];
      const precipitation = precipProbs[idx] !== undefined ? precipProbs[idx] : (precips[idx] !== undefined ? Math.round(precips[idx] * 100) / 100 : undefined);
      const wind = winds[idx];

      return {
        temperature: temperature !== undefined ? Math.round(temperature * 10) / 10 : undefined,
        humidity: humidity !== undefined ? Math.round(humidity * 10) / 10 : undefined,
        condition: weathercode !== undefined ? mapWeatherCodeToFrench(weathercode) : undefined,
        precipitation: precipitation !== undefined ? Math.round(precipitation * 10) / 10 : undefined,
        wind: wind !== undefined ? Math.round(wind * 10) / 10 : undefined
      };
    } catch (error) {
      console.error('fetchWeatherForDate error', error);
      return null;
    }
  };

  // Auto-calculate unfound/lost quantity
  useEffect(() => {
    const entrants = parseFloat(formData.entrants) || 0;
    const resto = parseFloat((formData as any).resto) || 0;
    const emballes = parseFloat(formData.emballes) || 0;
    const dechets = parseFloat(formData.dechets) || 0;
    const workerAllocations = parseFloat(formData.workerAllocations) || 0;

    // Total available raw material = entrants + resto (rest from previous day)
    const totalAvailable = entrants + resto;

    // Deduct packaged, wastes and employee allocations (convert kg to tonnes)
    const deductions = emballes + dechets + (workerAllocations / 1000);

    const calculatedUnfound = totalAvailable - deductions;

    // Only update if the calculated value is different and valid
    if (calculatedUnfound >= 0 && calculatedUnfound.toFixed(1) !== formData.unfojund) {
      setFormData(prev => ({
        ...prev,
        unfojund: calculatedUnfound.toFixed(1)
      }));
    } else if (calculatedUnfound < 0) {
      // If negative, set to 0 as we can't have negative unfound
      setFormData(prev => ({
        ...prev,
        unfojund: '0.0'
      }));
    }
  }, [formData.entrants, formData.emballes, formData.dechets, (formData as any).resto, formData.workerAllocations]);

  // Initialize by loading all data from Firebase backend
  useEffect(() => {
    const initializeApp = async () => {
      // Load reports data (this is public)
      await loadReportsFromFirebase();

      // Only load user-specific data if authenticated
      if (user?.uid) {
        await loadUserPreferences();
        await loadFormDraft();

        // Check if data was previously cleared (using Firebase instead of localStorage)
        const wasCleared = await loadAppState();
        if (wasCleared) {
          console.log('📊 Données précédemment effacées - démarrage avec une base vide');
        }
      } else {
        console.log('ℹ️ Utilisateur non authentifié - chargement des données publiques uniquement');
      }
    };

    initializeApp();
  }, [user?.uid]); // Re-run when authentication status changes

  // Auto-save user preferences when they change
  useEffect(() => {
    if (!user?.uid) return; // Only save preferences for authenticated users

    const timeoutId = setTimeout(() => {
      saveUserPreferences();
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [activeTab, dateRange, employeeFilter, timeFrame, user?.uid]);

  // Auto-save form data as user types (draft functionality)
  useEffect(() => {
    if (!user?.uid) return; // Only save drafts for authenticated users

    const timeoutId = setTimeout(() => {
      if (formData.employee || formData.entrants || formData.emballes) {
        saveFormDraft(formData);
      }
    }, 3000); // Auto-save every 3 seconds if there's content

    return () => clearTimeout(timeoutId);
  }, [formData, user?.uid]);

  // Auto-fill temperature and humidity from Open-Meteo when date changes and fields are empty
  useEffect(() => {
    let mounted = true;
    const tryAutoFill = async () => {
      if (!formData.date) return;
      // If user already entered temp/humidity, don't override
      if (formData.temperature || formData.humidity) return;

      try {
        const coords = await getLocationCoordinates();
        const weather = await fetchWeatherForDate(formData.date, coords.lat, coords.lon);
        if (!mounted || !weather) return;

        setFormData(prev => ({
          ...prev,
          temperature: weather.temperature !== undefined ? String(weather.temperature) : prev.temperature,
          humidity: weather.humidity !== undefined ? String(weather.humidity) : prev.humidity
        }));
      } catch (e) {
        console.debug('Auto-fill weather failed', e);
      }
    };

    tryAutoFill();

    return () => { mounted = false; };
  }, [formData.date]);

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
        const avgEfficiency = totalEntrants > 0 ? (totalEmballes / totalEntrants) * 100 : 0;
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
          const prevEfficiency = prevTotalEntrants > 0 ? (prevTotalEmballes / prevTotalEntrants) * 100 : 0;

          if (avgEfficiency > prevEfficiency + 1) trend = 'up';
          else if (avgEfficiency < prevEfficiency - 1) trend = 'down';
        }

        trends.push({
          period: `Sem ${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
          avgEfficiency: Number(avgEfficiency.toFixed(1)),
          avgWaste: Number(avgWaste.toFixed(1)),
          avgLoss: Number(avgLoss.toFixed(1)),
          totalVolume: Math.round(totalEntrants / 1000),
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
      const efficiency = totalEntrants > 0 ? (totalEmballes / totalEntrants) * 100 : 0;
      const uniqueEmployees = new Set(shiftReports.map(r => r.employee)).size;
      const qualityA = shiftReports.filter(r => r.qualityGrade === 'A').length / shiftReports.length * 100;

      return {
        shift: shift.charAt(0).toUpperCase() + shift.slice(1),
        efficiency: Number(efficiency.toFixed(1)),
        volume: Math.round(totalEntrants / 1000),
        employees: uniqueEmployees,
        quality: Number(qualityA.toFixed(1))
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const entrants = parseFloat(formData.entrants);
    const resto = parseFloat((formData as any).resto) || 0;
    const emballes = parseFloat(formData.emballes);
    const dechets = parseFloat(formData.dechets);
    const unfound = parseFloat(formData.unfojund) || 0;
    const workerAllocations = parseFloat(formData.workerAllocations) || 0;
    const numberOfBeneficiaries = parseInt(formData.numberOfBeneficiaries) || 0;

    // Validate inputs
    if (!entrants || entrants <= 0) {
      toast.error('❌ Données invalides', {
        description: 'Veuillez saisir un volume d\'entrants valide'
      });
      return;
    }

    if (emballes < 0 || dechets < 0 || unfound < 0 || workerAllocations < 0) {
      toast.error('❌ Valeurs négatives', {
        description: 'Les valeurs ne peuvent pas être négatives'
      });
      return;
    }

    // With simplified calculation: unfound = entrants - emballes - dechets
    // So we need to check that emballes + dechets <= entrants
    if (emballes + dechets > entrants) {
      toast.error('❌ Erreur de calcul', {
        description: 'La somme des emballés et déchets dépasse les entrants. Vérifiez vos données.'
      });
      return;
    }

    // For reporting purposes, calculate any additional small losses
    const pertes = Math.max(0, workerAllocations / 1000); // Convert worker allocations to tonnes for reporting

    const reportDate = new Date(formData.date);

    const totalAvailable = entrants + resto;

    const newReportData: Omit<ReportData, 'id'> = {
      date: formData.date,
      employee: formData.employee,
      shift: formData.shift,
      entrants,
      resteAuj: resto,
      retour: unfound,
      consommation: emballes + dechets,
      dechetMachine: dechets * 0.7,
      dechetPetit: dechets * 0.3,
      efficiency: ((emballes / entrants) * 100),
      userId: user?.uid || 'system',
      resto,
      emballes,
      dechets,
      unfound: unfound,
      workerAllocations,
      numberOfBeneficiaries,
      pertes,
      tauxDechets: Number(((dechets / (totalAvailable || 1)) * 100).toFixed(2)),
      tauxPertes: Number(((pertes / (totalAvailable || 1)) * 100).toFixed(2)),
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
      await saveReport(newReportData);

      // Clear the form draft since report was saved successfully
      if (user?.uid) {
        await setDoc(doc(db, 'form_drafts', `consumption_${user.uid}`), {});
      }

      toast.success('✅ Rapport sauvegardé avec succès!', {
        description: `Rapport pour ${newReportData.employee} du ${new Date(newReportData.date).toLocaleDateString('fr-FR')} enregistré dans Firebase.`
      });
      resetForm();
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Failed to save report:', error);
      toast.error('❌ Erreur lors de la sauvegarde', {
        description: 'Le rapport n\'a pas pu être sauvegardé. Veuillez réessayer.'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      employee: '',
      shift: 'matin',
      entrants: '',
      resto: '',
      emballes: '',
      dechets: '',
      unfojund: '',
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
    const totalEntrants = filteredReports.reduce((sum, report) => sum + report.entrants + (report.resto || 0), 0);
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
      efficiency: totalEntrants > 0 ? (totalEmballes / totalEntrants) * 100 : 0
    };
  };
  // Load previous return value from localStorage when component mounts
  React.useEffect(() => {
    const previousRetour = localStorage.getItem('previousRetour');
    if (previousRetour) {
      setForm(prev => ({
        ...prev,
        resteHier: previousRetour
      }));
    }
  }, []);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    responsable: "",
    entrant: "",
    resteHier: "",
    consommation: "",
    emballage: "",
    resteAuj: "",
    dechetMachine: "",
    dechetPetit: "",
    retour: "",
  });

  const [results, setResults] = useState({ totalDispo: 0, totalDechet: 0, perte: 0, totalUtilise: 0 });
  const [isCalculated, setIsCalculated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load reports from Firestore
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const loadReports = async () => {
      try {
        setLoading(true);
        const reportsCollection = collection(db, 'consumption_reports');
        const q = query(reportsCollection, orderBy('createdAt', 'desc'));
        unsubscribe = onSnapshot(q, (snapshot) => {
          const loadedReports = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ReportData[];
          setReports(loadedReports);
          setLoading(false);
          console.log(`✅ ${loadedReports.length} rapports chargés depuis Firestore`);
        });
      } catch (error) {
        setLoading(false);
        toast.error('Erreur lors du chargement des rapports');
      }
    };
    loadReports();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setIsCalculated(false);
  };

  const saveReportToFirestore = async (reportData: any) => {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    const reportsRef = collection(db, 'consumption_reports');
    await addDoc(reportsRef, {
      ...reportData,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };

  const calculate = async () => {
    setIsSaving(true);
    try {
      if (!auth.currentUser) {
        toast.error('Veuillez vous connecter pour sauvegarder le rapport');
        return;
      }

      // Parse all input values, default to 0 if empty
      const entrant = parseFloat(form.entrant) || 0; // input only
      const resteHier = parseFloat(form.resteHier) || 0; // input only
      const consommation = parseFloat(form.consommation) || 0; // production total
      const emballage = parseFloat(form.emballage) || 0; // avocat embales
      const resteAuj = parseFloat(form.resteAuj) || 0; // rest produit feni
      const dechetMachine = parseFloat(form.dechetMachine) || 0;
      const dechetPetit = parseFloat(form.dechetPetit) || 0;
      const retour = parseFloat(form.retour) || 0;

      // Calculate totals
      const totalDispo = entrant + resteHier;
      const totalDechet = dechetMachine + dechetPetit;
      const totalUtilise = consommation;

      // Calculate perte (perdu/pert) using the requested formula
      // perte = production total - avocat embales - rest produit feni - dechet machine - petit calibre - retour
      const perte = consommation - emballage - resteAuj - dechetMachine - dechetPetit - retour;
      const tauxDechets = totalDispo > 0 ? (totalDechet / totalDispo) * 100 : 0;
      const tauxPertes = totalDispo > 0 ? (perte / totalDispo) * 100 : 0;
      const efficiency = totalDispo > 0 ? (emballage / totalDispo) * 100 : 0;

      // Update results
      setResults({
        totalDispo,
        totalDechet,
        perte,
        totalUtilise
      });
      setIsCalculated(true);

      // Save current return value for next day's stock precedent
      localStorage.setItem('previousRetour', form.retour);

      try {
        const reportData = {
          date: form.date,
          employee: form.responsable,
          shift: new Date().getHours() < 14 ? 'matin' : new Date().getHours() < 22 ? 'apres-midi' : 'nuit',
          entrants: entrant,
          resto: resteHier,
          emballes: emballage,
          dechets: totalDechet,
          pertes: perte,
          resteAuj: resteAuj,
          retour: retour,
          consommation: consommation,
          dechetMachine: dechetMachine,
          dechetPetit: dechetPetit,
          tauxDechets: Number(tauxDechets.toFixed(1)),
          tauxPertes: Number(tauxPertes.toFixed(1)),
          efficiency: Number(efficiency.toFixed(1)),
          qualityGrade: efficiency >= 88 ? 'A' : efficiency >= 85 ? 'B' : 'C',
        };

        await saveReportToFirestore(reportData);
        toast.success('Rapport sauvegardé avec succès');
      } catch (error) {
        console.error('Error saving report:', error);
        toast.error('Erreur lors de la sauvegarde du rapport');
        throw error; // Re-throw to be caught by outer try-catch
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error('Erreur lors de la sauvegarde du rapport');
      setIsCalculated(false);
    } finally {
      setIsSaving(false);
    }
  };

  const generatePDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Fruits For You Brand Colors
    const colors = {
      primary: [139, 195, 74] as [number, number, number],      // Green
      primaryDark: [104, 159, 56] as [number, number, number],  // Dark Green
      primaryLight: [220, 237, 200] as [number, number, number], // Light Green
      accent: [244, 67, 54] as [number, number, number],        // Red (from "for")
      accentLight: [255, 235, 238] as [number, number, number], // Light Red
      yellow: [255, 235, 59] as [number, number, number],       // Yellow (lemon)
      yellowLight: [255, 249, 196] as [number, number, number], // Light Yellow
      gray50: [250, 250, 250] as [number, number, number],
      gray100: [245, 245, 245] as [number, number, number],
      gray200: [238, 238, 238] as [number, number, number],
      gray300: [224, 224, 224] as [number, number, number],
      gray500: [158, 158, 158] as [number, number, number],
      gray600: [117, 117, 117] as [number, number, number],
      gray700: [97, 97, 97] as [number, number, number],
      gray900: [33, 33, 33] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
      black: [0, 0, 0] as [number, number, number]
    };

    // Simple header bar
    doc.setFillColor(...colors.primaryDark);
    doc.rect(0, 0, pageWidth, 45, "F");

    // Add logo and header content
    let hasLogo = true; // Flag to track if logo was successfully added
    const logoSize = 40; // Slightly larger size for better visibility
    const refNumber = `${form.date.replace(/-/g, "")}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    try {
      // Add logo first with improved quality settings
      doc.addImage(logo, "PNG", 14, 5, logoSize, logoSize, undefined, 'FAST', 0);
    } catch (error) {
      console.error("Error adding logo:", error);
      hasLogo = false;
    }

    // Add header text - positioned based on logo presence
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.white);
    doc.text("fruitsforyou", hasLogo ? logoSize + 20 : 14, 25);

    // Report title
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.white);
    doc.text("RAPPORT JOURNALIER", hasLogo ? logoSize + 20 : 14, 35);

    // Reference number
    doc.setFontSize(8);
    doc.text(`REF: ${refNumber}`, pageWidth - 14, 15, { align: "right" });

    // Date and responsible - minimal info boxes
    let currentY = 45; // Moved up by 10px

    doc.setFillColor(...colors.gray100);
    doc.rect(14, currentY, 90, 20, "F");
    doc.rect(108, currentY, 88, 20, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.gray700);
    doc.text("DATE", 18, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...colors.gray900);
    doc.text(new Date(form.date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }), 18, currentY + 14);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.gray700);
    doc.text("RESPONSABLE", 112, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...colors.gray900);
    doc.text(form.responsable || "Non spécifié", 112, currentY + 14);

    currentY = 70; // Moved down for better spacing

    // INPUT SECTION
    doc.setFillColor(...colors.primary);
    doc.rect(14, currentY, 3, 6, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.primaryDark);
    doc.text("ENTRÉES", 20, currentY + 4.5);

    const inputData = [
      ["Matière Entrante", `${parseFloat(form.entrant || "0").toFixed(2)}`, "kg"],
      ["Stock Précédent", `${parseFloat(form.resteHier || "0").toFixed(2)}`, "kg"],
      ["TOTAL DISPONIBLE", `${results.totalDispo.toFixed(2)}`, "kg"]
    ];

    autoTable(doc, {
      head: [], // Empty header
      body: inputData,
      startY: currentY + 8,
      margin: { left: 14, right: 14 },
      theme: "plain",
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        lineColor: colors.gray300,
        lineWidth: 0.1
      },
      columnStyles: {
        0: { fontStyle: "normal", cellWidth: 120, textColor: colors.gray700 },
        1: { halign: "right", cellWidth: 42, fontStyle: "normal", textColor: colors.gray900 },
        2: { halign: "left", cellWidth: 13, textColor: colors.gray600, fontSize: 8 }
      },
      didParseCell: function (data: any) {
        if (data.row.index === inputData.length - 1) {
          data.cell.styles.fillColor = colors.primaryLight;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = colors.primaryDark;
          data.cell.styles.fontSize = 10;
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // UTILIZATION SECTION
    doc.setFillColor(...colors.primary);
    doc.rect(14, currentY, 3, 6, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.primaryDark);
    doc.text("UTILISATION", 20, currentY + 4.5);

    const utilisationData = [
      ["Avocats Emballés", `${parseFloat(form.emballage || "0").toFixed(2)}`, "kg"],
      ["Reste Produit Fini", `${parseFloat(form.resteAuj || "0").toFixed(2)}`, "kg"]
    ];

    autoTable(doc, {
      body: utilisationData,
      startY: currentY + 8,
      margin: { left: 14, right: 14 },
      theme: "plain",
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        lineColor: colors.gray300,
        lineWidth: 0.1
      },
      columnStyles: {
        0: { fontStyle: "normal", cellWidth: 120, textColor: colors.gray700 },
        1: { halign: "right", cellWidth: 42, fontStyle: "normal", textColor: colors.gray900 },
        2: { halign: "left", cellWidth: 13, textColor: colors.gray600, fontSize: 8 }
      },
      didParseCell: function (data: any) {
        // No special styling needed since we removed the total row
      }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // WASTE SECTION
    doc.setFillColor(...colors.accent);
    doc.rect(14, currentY, 3, 6, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.accent);
    doc.text("DÉCHETS", 20, currentY + 4.5);

    const dechetsData = [
      ["Déchets Machine", `${parseFloat(form.dechetMachine || "0").toFixed(2)}`, "kg"],
      ["Déchets Petit Calibre", `${parseFloat(form.dechetPetit || "0").toFixed(2)}`, "kg"],
      ["TOTAL DÉCHETS", `${(parseFloat(form.dechetMachine || "0") + parseFloat(form.dechetPetit || "0")).toFixed(2)}`, "kg"]
    ];

    autoTable(doc, {
      body: dechetsData,
      startY: currentY + 8,
      margin: { left: 14, right: 14 },
      theme: "plain",
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        lineColor: colors.gray300,
        lineWidth: 0.1
      },
      columnStyles: {
        0: { fontStyle: "normal", cellWidth: 120, textColor: colors.gray700 },
        1: { halign: "right", cellWidth: 42, fontStyle: "normal", textColor: colors.gray900 },
        2: { halign: "left", cellWidth: 13, textColor: colors.gray600, fontSize: 8 }
      },
      didParseCell: function (data: any) {
        if (data.row.index === dechetsData.length - 1) {
          data.cell.styles.fillColor = colors.accentLight;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = colors.accent;
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // RETOUR SECTION
    doc.setFillColor(...colors.primary);
    doc.rect(14, currentY, 3, 6, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.primaryDark);
    doc.text("RETOUR", 20, currentY + 4.5);

    const stockRetourData = [
      ["Retour Stock", `${parseFloat(form.retour || "0").toFixed(2)}`, "kg"]
    ];

    autoTable(doc, {
      body: stockRetourData,
      startY: currentY + 8,
      margin: { left: 14, right: 14 },
      theme: "plain",
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        lineColor: colors.gray300,
        lineWidth: 0.1
      },
      columnStyles: {
        0: { fontStyle: "normal", cellWidth: 120, textColor: colors.gray700 },
        1: { halign: "right", cellWidth: 42, fontStyle: "normal", textColor: colors.gray900 },
        2: { halign: "left", cellWidth: 13, textColor: colors.gray600, fontSize: 8 }
      }
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // BALANCE - Minimalist industrial design
    const isPerte = results.perte > 0;
    const statusColor = isPerte ? colors.accent : colors.primary;
    const statusBg = isPerte ? colors.accentLight : colors.primaryLight;

    doc.setFillColor(...statusBg);
    doc.rect(14, currentY, pageWidth - 28, 32, "F");

    doc.setDrawColor(...statusColor);
    doc.setLineWidth(2);
    doc.line(14, currentY, pageWidth - 14, currentY);



    // Simple calculation display
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.gray600);
    const formula = `${parseFloat(form.consommation || "0").toFixed(2)} - ` +
      `${parseFloat(form.emballage || "0").toFixed(2)} - ` +
      `${parseFloat(form.resteAuj || "0").toFixed(2)} - ` +
      `${parseFloat(form.dechetMachine || "0").toFixed(2)} - ` +
      `${parseFloat(form.dechetPetit || "0").toFixed(2)} - ` +
      `${parseFloat(form.retour || "0").toFixed(2)}`;
    doc.text(formula, 18, currentY + 15);

    // Result
    const statusText = isPerte ? "PERTE" : "OK";
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...statusColor);
    doc.text(statusText, 18, currentY + 23);

    doc.setFontSize(16);
    doc.text(`${results.perte.toFixed(2)} kg`, pageWidth - 18, currentY + 23, { align: "right" });


    // Minimal footer with signatures
    currentY = pageHeight - 30;

    doc.setDrawColor(...colors.gray300);
    doc.setLineWidth(0.3);
    doc.line(14, currentY, pageWidth - 14, currentY);

    currentY += 6;


    // Minimal footer bar
    doc.setFillColor(...colors.gray900);
    doc.rect(0, pageHeight - 15, pageWidth, 15, "F");

    doc.setFontSize(7);
    doc.setTextColor(...colors.white);
    doc.setFont("helvetica", "normal");
    doc.text("fruitsforyou", 14, pageHeight - 8);

    doc.setFontSize(6);
    doc.setTextColor(...colors.gray500);
    doc.text(`${new Date().toLocaleDateString("fr-FR")} ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, pageWidth - 14, pageHeight - 8, { align: "right" });

    const fileName = `Rapport_${form.date}_${(form.responsable || "FruitsForYou").replace(/\s+/g, "_")}.pdf`;
    doc.save(fileName);
  };

  const kpis = getKPIs();
  const historicalTrends = getHistoricalTrends();
  const shiftPerformance = getShiftPerformance();

  // Enhanced chart data with different time frames
  const getChartData = () => {
    let dataSource = filteredReports;
    let dataPoints = 15;

    if (timeFrame === 'weekly') {
      dataPoints = 12;
    } else if (timeFrame === 'monthly') {
      dataPoints = 6;
    }

    if (timeFrame === 'daily') {
      return dataSource.slice(-dataPoints).reverse().map(report => ({
        date: new Date(report.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        entrants: Math.round(report.entrants * 100) / 100,
        emballes: Math.round(report.emballes * 100) / 100,
        dechets: Math.round(report.dechets * 100) / 100,
        pertes: Math.round(report.pertes * 100) / 100,
        tauxDechets: report.tauxDechets,
        tauxPertes: report.tauxPertes,
        efficiency: (report.entrants + (report.resto || 0)) > 0 ? (report.emballes / (report.entrants + (report.resto || 0))) * 100 : 0,
        temperature: report.temperature,
        humidity: report.humidity,
        qualityGrade: report.qualityGrade
      }));
    }

    // For weekly and monthly, we'll use simplified aggregation
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
        week.resto = (week.resto || 0) + (report.resto || 0);
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
          entrants: Math.round(week.entrants * 10) / 10,
          resto: Number((week.resto || 0).toFixed(2)),
          emballes: Math.round(week.emballes * 10) / 10,
          dechets: Math.round(week.dechets * 10) / 10,
          pertes: Math.round(week.pertes * 10) / 10,
          tauxDechets: (week.entrants + (week.resto || 0)) > 0 ? Number(((week.dechets / (week.entrants + (week.resto || 0))) * 100).toFixed(1)) : 0,
          tauxPertes: (week.entrants + (week.resto || 0)) > 0 ? Number(((week.pertes / (week.entrants + (week.resto || 0))) * 100).toFixed(1)) : 0,
          efficiency: (week.entrants + (week.resto || 0)) > 0 ? Number(((week.emballes / (week.entrants + (week.resto || 0))) * 100).toFixed(1)) : 0,
          temperature: Number((week.tempSum / week.count).toFixed(1)),
          humidity: Number((week.humiditySum / week.count).toFixed(1)),
          qualityScore: Number(((week.qualityA / week.count) * 100).toFixed(1))
        }));
    }

    // Monthly aggregation
    const monthlyData = new Map();
    dataSource.forEach(report => {
      const monthKey = `${report.year || new Date().getFullYear()}-${(report.month || 1).toString().padStart(2, '0')}`;
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          date: monthKey,
          entrants: 0,
          resto: 0,
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
      month.resto += (report.resto || 0);
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
        entrants: Math.round(month.entrants),
        resto: Number((month.resto || 0).toFixed(1)),
        emballes: Math.round(month.emballes),
        dechets: Math.round(month.dechets),
        pertes: Math.round(month.pertes),
        tauxDechets: (month.entrants + (month.resto || 0)) > 0 ? Number(((month.dechets / (month.entrants + (month.resto || 0))) * 100).toFixed(1)) : 0,
        tauxPertes: (month.entrants + (month.resto || 0)) > 0 ? Number(((month.pertes / (month.entrants + (month.resto || 0))) * 100).toFixed(1)) : 0,
        efficiency: (month.entrants + (month.resto || 0)) > 0 ? Number(((month.emballes / (month.entrants + (month.resto || 0))) * 100).toFixed(1)) : 0,
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
    acc[report.employee].totalEntrants += report.entrants + (report.resto || 0);
    acc[report.employee].totalEmballes += report.emballes;
    acc[report.employee].reports += 1;
    return acc;
  }, {} as Record<string, { totalEntrants: number; totalEmballes: number; reports: number }>);

  const employeeChartData = Object.entries(employeeStats).map(([name, stats]) => ({
    employee: name,
    efficiency: stats.totalEntrants > 0 ? (stats.totalEmballes / stats.totalEntrants) * 100 : 0,
    reports: stats.reports
  }));
 const inputFields = [
  { label: "Date", name: "date", type: "date", icon: "📅" },
  { label: "Responsable", name: "responsable", type: "text", icon: "👤" },
  { label: "Avocat Entrant (Réception)", name: "entrant", type: "number", icon: "📥" }, // input only
  { label: "Reste d'hier (Stock)", name: "resteHier", type: "number", icon: "📦" }, // input only
  { label: "Production totale (Consommation)", name: "consommation", type: "number", icon: "⚙️" },
  { label: "Avocats Emballés", name: "emballage", type: "number", icon: "📦" },
  { label: "Reste Produit Fini", name: "resteAuj", type: "number", icon: "📊" },
  { label: "Déchets Machine", name: "dechetMachine", type: "number", icon: "🔧" },
  { label: "Déchets Petit Calibre", name: "dechetPetit", type: "number", icon: "🔍" },
  { label: "Retour", name: "retour", type: "number", icon: "↩️" },
  ];
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50">
      {/* Authentication Status */}
      {!user?.uid && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Mode lecture seule:</strong> Vous pouvez consulter les rapports, mais vous devez être connecté pour sauvegarder des données, créer des rapports ou accéder aux préférences personnalisées.
              </p>
            </div>
          </div>
        </div>
      )}

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
              { id: 'history', label: 'Historique', icon: FileText },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
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
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${timeFrame === frame.id
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
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <input
                  type="date"
                  placeholder="Date fin"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
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

            {/* Shift Performance Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Shift Efficiency */}



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


            </div>
          </div>
        )}

        {activeTab === 'form' && (

          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl shadow-lg p-6 mb-6">
                <h1 className="text-3xl font-bold text-center flex items-center justify-center gap-3">
                  🏭 Rapport Journalier Industriel
                </h1>
                <p className="text-center text-blue-100 mt-2">
                  Calcul de consommation et pertes journalières
                </p>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h2 className="text-xl font-semibold mb-6 text-gray-800 flex items-center gap-2">
                      📝 Données Journalières
                    </h2>

                    <div className="grid md:grid-cols-2 gap-4">
                      {inputFields.map((field) => (
                        <div key={field.name} className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                            <span>{field.icon}</span>
                            {field.label}
                          </label>
                          <input
                            type={field.type}
                            name={field.name}
                            value={form[field.name as keyof typeof form]}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                            placeholder={field.type === "number" ? "0" : ""}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-4 mt-8">
                      <button
                        onClick={calculate}
                        disabled={isSaving}
                        className={`flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all transform hover:scale-105 active:scale-95 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isSaving ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Sauvegarde...
                          </span>
                        ) : (
                          '🧮 Calculer et Sauvegarder'
                        )}
                      </button>
                      <button
                        onClick={generatePDF}
                        disabled={!isCalculated || isSaving}
                        className={`flex-1 ${isCalculated && !isSaving
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gray-400 cursor-not-allowed"
                          } text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all ${isCalculated && !isSaving ? "transform hover:scale-105 active:scale-95" : ""
                          }`}
                      >
                        📄 Générer PDF
                      </button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
                    <h2 className="text-xl font-semibold mb-6 text-gray-800 flex items-center gap-2">
                      📊 Résultats
                    </h2>

                    <div className="space-y-4">
                      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-1">Total Disponible</div>
                        <div className="text-2xl font-bold text-blue-700">
                          {results.totalDispo.toFixed(2)}
                        </div>
                      </div>

                      <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-1">Déchets Total</div>
                        <div className="text-2xl font-bold text-orange-700">
                          {results.totalDechet.toFixed(2)}
                        </div>
                      </div>

                      <div
                        className={`${results.perte > 0
                          ? "bg-red-50 border-red-500"
                          : "bg-green-50 border-green-500"
                          } border-l-4 rounded-lg p-4`}
                      >
                        <div className="text-sm text-gray-600 mb-1">Perte Totale</div>
                        <div
                          className={`text-2xl font-bold ${results.perte > 0 ? "text-red-700" : "text-green-700"
                            }`}
                        >
                          {results.perte.toFixed(2)}
                        </div>
                        {results.perte > 0 && (
                          <div className="text-xs text-red-600 mt-2">
                            ⚠️ Attention: Perte détectée
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="text-xs font-semibold text-gray-700 mb-2">
                        📐 Formules appliquées:
                      </h3>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>• Total Disponible = Entrant + Reste Hier</div>
                        <div>• Total Déchets = Déchets Machine + Déchets Petit Calibre</div>
                        <div>• Perte =  Avocats Emballés - Reste Produit Fini - Déchets Machine - Déchets Petit Calibre - Retour</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center text-sm text-gray-500">
                <p>© 2025 Industrial Report System • Rapport Journalier Automatisé</p>
              </div>
            </div>
          </div>

        )}


        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Historique des Rapports</h2>
                <p className="text-gray-600 mt-1">Rapports journaliers créés et sauvegardés</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={clearAllReports}
                  className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm bg-white text-sm font-medium text-red-700 hover:bg-red-50 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Effacer Tout
                </button>
                <button
                  onClick={regenerateSampleData}
                  className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm bg-white text-sm font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Régénérer Données
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
                  <p className="text-gray-600">Récupération des données...</p>
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
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${report.shift === 'matin'
                              ? 'bg-yellow-100 text-yellow-800'
                              : report.shift === 'apres-midi'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                              }`}>
                              {report.shift === 'matin' ? 'Matin' : report.shift === 'apres-midi' ? 'Après-midi' : 'Nuit'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(((report.entrants || 0) + (report.resto || 0)) / 1000).toFixed(1)} T
                            {(report.resto || 0) > 0 && (
                              <div className="text-xs text-gray-500">(+{(report.resto || 0).toFixed(2)} T rest)</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(report.emballes / 1000).toFixed(1)} T
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${report.qualityGrade === 'A'
                              ? 'bg-green-100 text-green-800'
                              : report.qualityGrade === 'B'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                              }`}>
                              Grade {report.qualityGrade}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${report.tauxDechets > 6
                              ? 'bg-red-100 text-red-800'
                              : report.tauxDechets > 4
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                              }`}>
                              {report.tauxDechets}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${report.tauxPertes > 10
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
                                  <span className={`text-xs font-bold ${((report.emballes / ((report.entrants || 0) + (report.resto || 0))) * 100) > 88
                                    ? 'text-green-600'
                                    : ((report.emballes / ((report.entrants || 0) + (report.resto || 0))) * 100) > 85
                                      ? 'text-yellow-600'
                                      : 'text-red-600'
                                    }`}>
                                    {((report.emballes / ((report.entrants || 0) + (report.resto || 0))) * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center space-x-2">

                              <button
                                onClick={() => deleteReport(report.id)}
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
            )}
          </div>
        )}

        {activeTab === 'debug' && (
          <div className="space-y-8">
            <FirebaseConnectionTest />
          </div>
        )}
      </main>
    </div>
  );
};

export default AvocadoProcessingDashboard;