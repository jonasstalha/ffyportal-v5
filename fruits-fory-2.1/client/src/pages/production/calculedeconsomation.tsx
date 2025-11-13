import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart } from 'recharts';
import { Calendar, User, Users, Package, Trash2, AlertTriangle, TrendingUp, Download, Plus, BarChart3, PieChart as PieChartIcon, Activity, FileText, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, serverTimestamp, where, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../hooks/use-auth";
import { toast } from "sonner";
import FirebaseConnectionTest from "../../components/FirebaseConnectionTest";

type ReportData = {
  id: string;
  date: string;
  employee: string;
  shift: 'matin' | 'apres-midi' | 'nuit';
  notes?: string;
  entrants: number;
  resto?: number;
  emballes: number;
  dechets: number;
  unfojund?: number;
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reports, setReports] = useState<ReportData[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportData[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [timeFrame, setTimeFrame] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Enhanced data management with Firebase Firestore persistence
  const saveReport = async (reportData: Omit<ReportData, 'id'>) => {
    try {
      setSaving(true);
      
      // Check authentication
      if (!user?.uid) {
        throw new Error('User must be authenticated to save reports');
      }
      
      // Prepare data for Firestore
      const firestoreData = {
        ...reportData,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Save to Firestore
      const docRef = await addDoc(collection(db, 'consumption_reports'), firestoreData);
      console.log('âœ… Rapport sauvegardÃ© dans Firestore avec ID:', docRef.id);
      
      // Update local state with the new report
      const newReport: ReportData = {
        id: docRef.id,
        ...reportData
      };
      
      const updatedReports = [newReport, ...reports];
      setReports(updatedReports);
      
      console.log('âœ… Rapport sauvegardÃ© avec succÃ¨s!');
      return docRef.id;
    } catch (error) {
      console.error('âŒ Erreur lors de la sauvegarde:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // Load reports from Firestore
  const loadReportsFromFirebase = async () => {
    try {
      setLoading(true);
      console.log('ğŸ“¥ Chargement des rapports depuis Firestore...');
      
      const q = query(
        collection(db, 'consumption_reports'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const firebaseReports: ReportData[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        firebaseReports.push({
          id: doc.id,
          date: data.date,
          employee: data.employee,
          shift: data.shift,
          entrants: data.entrants,
          resto: data.resto || 0,
          emballes: data.emballes,
          dechets: data.dechets,
          unfojund: data.unfojund || 0,
          workerAllocations: data.workerAllocations || 0,
          numberOfBeneficiaries: data.numberOfBeneficiaries || 0,
          pertes: data.pertes,
          tauxDechets: data.tauxDechets,
          tauxPertes: data.tauxPertes,
          qualityGrade: data.qualityGrade,
          temperature: data.temperature,
          humidity: data.humidity,
          processedHours: data.processedHours,
          notes: data.notes,
          timestamp: data.timestamp,
          week: data.week,
          month: data.month,
          year: data.year
        });
      });
      
      console.log(`âœ… ${firebaseReports.length} rapports chargÃ©s depuis Firestore`);
      setReports(firebaseReports);
      setFilteredReports(firebaseReports);
      
    } catch (error) {
      console.error('âŒ Erreur lors du chargement des rapports:', error);
      // Fallback to sample data if Firebase fails
      const wasCleared = localStorage.getItem('calculedeconsomation_cleared');
      if (!wasCleared) {
        const sampleData = generateSampleData();
        setReports(sampleData);
        setFilteredReports(sampleData);
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
      console.log('âœ… PrÃ©fÃ©rences utilisateur sauvegardÃ©es dans Firebase');
    } catch (error) {
      console.error('âŒ Erreur lors de la sauvegarde des prÃ©fÃ©rences:', error);
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
        console.log('âœ… PrÃ©fÃ©rences utilisateur chargÃ©es depuis Firebase');
      }
    } catch (error) {
      console.error('âŒ Erreur lors du chargement des prÃ©fÃ©rences:', error);
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
      console.log('âœ… Brouillon sauvegardÃ© automatiquement');
    } catch (error) {
      console.error('âŒ Erreur lors de la sauvegarde du brouillon:', error);
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
          console.log('âœ… Brouillon rÃ©cent chargÃ© depuis Firebase');
          toast.info('ğŸ“ Brouillon rÃ©cupÃ©rÃ©', {
            description: 'Un brouillon rÃ©cent a Ã©tÃ© trouvÃ© et chargÃ©.'
          });
          return data.draftData;
        } else {
          console.log('â„¹ï¸ Brouillon trop ancien, ignorÃ©');
        }
      }
      return null;
    } catch (error) {
      console.error('âŒ Erreur lors du chargement du brouillon:', error);
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
      console.log('âœ… Ã‰tat de l\'application sauvegardÃ© dans Firebase');
    } catch (error) {
      console.error('âŒ Erreur lors de la sauvegarde de l\'Ã©tat:', error);
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
        console.log('âœ… Ã‰tat de l\'application chargÃ© depuis Firebase');
        return stateData;
      }
    } catch (error) {
      console.error('âŒ Erreur lors du chargement de l\'Ã©tat:', error);
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      // Delete from Firebase
      await deleteDoc(doc(db, 'consumption_reports', reportId));
      
      // Update local state
      const updatedReports = reports.filter(r => r.id !== reportId);
      setReports(updatedReports);
      setFilteredReports(updatedReports.filter(report => {
        let filtered = true;
        if (dateRange.start) filtered = filtered && report.date >= dateRange.start;
        if (dateRange.end) filtered = filtered && report.date <= dateRange.end;
        if (employeeFilter) filtered = filtered && report.employee.toLowerCase().includes(employeeFilter.toLowerCase());
        return filtered;
      }));
      
      toast.success('ğŸ—‘ï¸ Rapport supprimÃ©', {
        description: 'Le rapport a Ã©tÃ© supprimÃ© avec succÃ¨s de Firebase'
      });
      
      console.log('âœ… Rapport supprimÃ© avec succÃ¨s de Firebase');
    } catch (error) {
      console.error('âŒ Erreur lors de la suppression:', error);
      toast.error('âŒ Erreur de suppression', {
        description: 'Impossible de supprimer le rapport. Veuillez rÃ©essayer.'
      });
    }
  };

  const clearAllReports = async () => {
    const confirmed = window.confirm(
      `ÃŠtes-vous sÃ»r de vouloir supprimer tous les ${reports.length} rapports historiques ?\n\nCette action est irrÃ©versible et effacera toutes les donnÃ©es de consommation globale enregistrÃ©es.`
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
        
        console.log('âœ… Tous les rapports ont Ã©tÃ© supprimÃ©s');
        
        toast.success('ğŸ—‘ï¸ DonnÃ©es supprimÃ©es', {
          description: 'Tous les rapports historiques ont Ã©tÃ© supprimÃ©s avec succÃ¨s!'
        });
      } catch (error) {
        console.error('âŒ Erreur lors de la suppression:', error);
        toast.error('âŒ Erreur de suppression', {
          description: 'Impossible de supprimer les donnÃ©es. Veuillez rÃ©essayer.'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const regenerateSampleData = async () => {
    const confirmed = window.confirm(
      `Voulez-vous rÃ©gÃ©nÃ©rer les donnÃ©es d'exemple ?\n\nCela crÃ©era environ 473 rapports historiques pour les tests et la dÃ©monstration.`
    );
    
    if (confirmed) {
      try {
        setLoading(true);
        
        const sampleData = generateSampleData();
        setReports(sampleData);
        setFilteredReports(sampleData);
        
        // Save each sample report to Firebase
        for (const report of sampleData) {
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
        
        console.log('âœ… DonnÃ©es d\'exemple rÃ©gÃ©nÃ©rÃ©es et sauvegardÃ©es dans Firebase');
        
        toast.success('ğŸ“Š DonnÃ©es d\'exemple crÃ©Ã©es', {
          description: `${sampleData.length} rapports historiques gÃ©nÃ©rÃ©s et sauvegardÃ©s dans Firebase!`
        });
      } catch (error) {
        console.error('âŒ Erreur lors de la rÃ©gÃ©nÃ©ration:', error);
        toast.error('âŒ Erreur de gÃ©nÃ©ration', {
          description: 'Impossible de crÃ©er les donnÃ©es d\'exemple. Veuillez rÃ©essayer.'
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
        toast.error('âŒ Authentification requise', {
          description: 'Vous devez Ãªtre connectÃ© pour crÃ©er une sauvegarde'
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
      
      toast.success('ğŸ’¾ Sauvegarde crÃ©Ã©e', {
        description: 'Une sauvegarde complÃ¨te de vos donnÃ©es a Ã©tÃ© crÃ©Ã©e dans Firebase'
      });
      
      console.log('âœ… Sauvegarde complÃ¨te crÃ©Ã©e dans Firebase');
    } catch (error) {
      console.error('âŒ Erreur lors de la sauvegarde:', error);
      toast.error('âŒ Erreur de sauvegarde', {
        description: 'Impossible de crÃ©er la sauvegarde. Veuillez rÃ©essayer.'
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
      
      toast.success('ğŸ”„ Synchronisation rÃ©ussie', {
        description: 'Vos donnÃ©es sont maintenant synchronisÃ©es avec Firebase'
      });
    } catch (error) {
      console.error('âŒ Erreur de synchronisation:', error);
      toast.error('âŒ Erreur de synchronisation', {
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
    
    addText('SystÃ¨me de TraÃ§abilitÃ© IntÃ©grÃ©', MARGIN + 22, 22, {
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
    
    addText('Production & QualitÃ©', pageWidth - MARGIN, 22, {
      size: 8,
      color: colors.bgSecondary,
      align: 'right'
    });

    yPos = 50;

    // === DOCUMENT TITLE ===
    addText('ANALYSE JOURNALIÃˆRE DE PRODUCTION', pageWidth / 2, yPos, {
      size: 18,
      bold: true,
      color: colors.textPrimary,
      align: 'center'
    });
    
    yPos += 8;
    
    addText('TraÃ§abilitÃ© & Performance des Avocats', pageWidth / 2, yPos, {
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
                      report.shift === 'apres-midi' ? 'AprÃ¨s-midi (14h-22h)' : 
                      'Nuit (22h-06h)';
    addText('Ã‰QUIPE', MARGIN + colW + 8, infoY, {
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
    addText('GRADE QUALITÃ‰', MARGIN + colW * 3 + 8, infoY, {
      size: 7,
      color: colors.textTertiary
    });
    addText(report.qualityGrade, MARGIN + colW * 3 + 8, infoY + 8, {
      size: 10,
      bold: true,
      color: colors.textPrimary
    });
    
    // Operating Hours
    addText('HEURES OPÃ‰RATION', MARGIN + 8, infoY + 20, {
      size: 7,
      color: colors.textTertiary
    });
    addText(`${report.processedHours}h`, MARGIN + 8, infoY + 28, {
      size: 10,
      bold: true,
      color: colors.textPrimary
    });
    
    // Temperature
    const tempColor = report.temperature >= 10 && report.temperature <= 20 ? 
                      colors.success : colors.warning;
    addText('TEMPÃ‰RATURE', MARGIN + colW + 8, infoY + 20, {
      size: 7,
      color: colors.textTertiary
    });
    addText(`${report.temperature}Â°C`, MARGIN + colW + 8, infoY + 28, {
      size: 10,
      bold: true,
      color: tempColor
    });
    
    // Humidity
    const humidityColor = report.humidity >= 60 && report.humidity <= 80 ? 
                          colors.success : colors.warning;
    addText('HUMIDITÃ‰', MARGIN + colW * 2 + 8, infoY + 20, {
      size: 7,
      color: colors.textTertiary
    });
    addText(`${report.humidity}%`, MARGIN + colW * 2 + 8, infoY + 28, {
      size: 10,
      bold: true,
      color: humidityColor
    });
    
    // Report Generation
    addText('GÃ‰NÃ‰RÃ‰ LE', MARGIN + colW * 3 + 8, infoY + 20, {
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
    addSectionHeader('INDICATEURS CLÃ‰S DE PERFORMANCE');

  const totalAvailable = report.entrants + (report.resto || 0);
  const efficiency = totalAvailable > 0 ? ((report.emballes / totalAvailable) * 100) : 0;
    const efficiencyColor = efficiency >= 88 ? colors.success : 
                            efficiency >= 85 ? colors.warning : colors.danger;
    
    const totalAccountedOutput = report.emballes + report.dechets + 
                                  ((report.workerAllocations || 0) / 1000);
  const accountedPercentage = totalAvailable > 0 ? (totalAccountedOutput / totalAvailable) * 100 : 0;
    const accountColor = accountedPercentage >= 98 ? colors.success : 
                         accountedPercentage >= 95 ? colors.warning : colors.danger;
    
  const unfoundPercentage = totalAvailable > 0 ? ((report.unfojund || 0) / totalAvailable) * 100 : 0;
    const unfoundColor = unfoundPercentage <= 3 ? colors.success : 
                         unfoundPercentage <= 5 ? colors.warning : colors.danger;
    
    const wasteColor = report.tauxDechets <= 6 ? colors.success : 
                       report.tauxDechets <= 10 ? colors.warning : colors.danger;

    const metrics = [
      {
        label: "EfficacitÃ© d'Emballage",
        value: `${efficiency.toFixed(1)}%`,
        target: 'Objectif: >88%',
        statusColor: efficiencyColor
      },
      {
        label: 'Taux de DÃ©chets',
        value: `${report.tauxDechets}%`,
        target: 'Objectif: <6%',
        statusColor: wasteColor
      },
      {
        label: 'TraÃ§abilitÃ© Totale',
        value: `${accountedPercentage.toFixed(1)}%`,
        target: 'Objectif: >98%',
        statusColor: accountColor
      },
      {
        label: 'Produits Non LocalisÃ©s',
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
    addSectionHeader('DONNÃ‰ES DÃ‰TAILLÃ‰ES');

    const detailBoxH = 60;
    const detailColW = CONTENT_WIDTH / 2 - 4;
    
    // Left column
    addBox(MARGIN, yPos, detailColW, detailBoxH, colors.bgPrimary, colors.border);
    
    let detailY = yPos + 10;
    const detailItems1 = [
      { label: 'Avocats Entrants (Total)', value: `${totalAvailable.toFixed(1)} KG`, color: colors.textPrimary },
      { label: '  - Dont Entrants', value: `${(report.entrants || 0).toFixed(1)} KG`, color: colors.textSecondary },
      { label: '  - Resto (prÃ©cÃ©dent)', value: `${(report.resto || 0).toFixed(2)} KG`, color: colors.textSecondary },
      { label: 'Avocats EmballÃ©s', value: `${report.emballes.toFixed(1)} KG`, color: colors.success },
      { label: 'DÃ©chets Totaux', value: `${report.dechets.toFixed(1)} KG`, color: colors.danger },
      { label: 'Produits Perdus', value: `${(report.unfojund || 0).toFixed(3)} T`, color: colors.warning }
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
      { label: 'Dotations EmployÃ©s', value: `${((report.workerAllocations || 0) / 1000).toFixed(3)} KG`, color: colors.textPrimary },
      { label: 'Nombre de BÃ©nÃ©ficiaires', value: `${report.numberOfBeneficiaries || 0}`, color: colors.info },
      { label: 'Allocation Moyenne', value: `${avgAllocation} kg`, color: colors.info },
      { label: 'Total TracÃ©', value: `${totalAccountedOutput.toFixed(2)} KG`, color: accountColor }
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

    const notesContent = report.notes || 'Aucune observation particuliÃ¨re n\'a Ã©tÃ© enregistrÃ©e pour cette pÃ©riode.';
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
    
    addText(`Document confidentiel - Fruit For You Â© ${new Date().getFullYear()}`, MARGIN, footerY + 10, {
      size: 7,
      color: colors.textTertiary
    });
    
    addText(`GÃ©nÃ©rÃ© le ${new Date().toLocaleDateString('fr-FR')} Ã  ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 
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

    toast.success('ğŸ“„ Rapport PDF gÃ©nÃ©rÃ© avec succÃ¨s!', {
      description: `${filename} tÃ©lÃ©chargÃ©`
    });

    console.log('âœ… Rapport PDF professionnel gÃ©nÃ©rÃ©:', filename);
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
    if (code === 1 || code === 2 || code === 3) return 'Partiellement ensoleillÃ©';
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
// Auto-calculate unfound/lost quantity
useEffect(() => {
  const entrants = parseFloat(formData.entrants) || 0;
  const resto = parseFloat((formData as any).resto) || 0;
  const emballes = parseFloat(formData.emballes) || 0;
  const dechets = parseFloat(formData.dechets) || 0;
  const workerAllocations = parseFloat(formData.workerAllocations) || 0;

  // âœ… Correct: resto should be subtracted, not added
  const totalAvailable = entrants - resto;

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
}, [
  formData.entrants,
  formData.emballes,
  formData.dechets,
  (formData as any).resto,
  formData.workerAllocations
]);

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
          console.log('ğŸ“Š DonnÃ©es prÃ©cÃ©demment effacÃ©es - dÃ©marrage avec une base vide');
        }
      } else {
        console.log('â„¹ï¸ Utilisateur non authentifiÃ© - chargement des donnÃ©es publiques uniquement');
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

  const generateSampleData = (): ReportData[] => {
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

  // Simulate a small 'resto' carried from previous day (0-0.5 tonnes)
  const resto = Number((Math.random() * 0.5).toFixed(2));

  // Global consumption tracking - simplified calculation
  // totalAvailable = entrants + resto
  const totalAvailable = Number((entrants + resto).toFixed(1));
  // unfound = totalAvailable - emballes - dechets (this is what user wants auto-calculated)
  const unfound = Number((totalAvailable - emballes - dechets).toFixed(1));
        const workerAllocations = Math.round(50 + Math.random() * 100); // 50-150 kg per shift
        const numberOfBeneficiaries = Math.round(15 + Math.random() * 20); // 15-35 workers
        
        // For historical compatibility, keep pertes as a separate small value
        const pertes = Number((Math.random() * 0.5).toFixed(1)); // Small additional losses
        
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
          resto,
          emballes,
          dechets,
          unfojund: unfound,
          workerAllocations,
          numberOfBeneficiaries,
          pertes,
          tauxDechets: Number(((dechets / (totalAvailable || 1)) * 100).toFixed(2)),
          tauxPertes: Number(((pertes / (totalAvailable || 1)) * 100).toFixed(2)),
          qualityGrade,
          temperature: Number(temperature.toFixed(1)),
          humidity: Number(humidity.toFixed(1)),
          processedHours: Number(processedHours.toFixed(1)),
          notes: Math.random() > 0.7 ? notes[Math.floor(Math.random() * notes.length)] : "",
          timestamp: date.getTime() + (shiftIndex * 8 * 60 * 60 * 1000),
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
      toast.error('âŒ DonnÃ©es invalides', {
        description: 'Veuillez saisir un volume d\'entrants valide'
      });
      return;
    }
    
    if (emballes < 0 || dechets < 0 || unfound < 0 || workerAllocations < 0) {
      toast.error('âŒ Valeurs nÃ©gatives', {
        description: 'Les valeurs ne peuvent pas Ãªtre nÃ©gatives'
      });
      return;
    }

    // With simplified calculation: unfound = entrants - emballes - dechets
    // So we need to check that emballes + dechets <= entrants
    if (emballes + dechets > entrants) {
      toast.error('âŒ Erreur de calcul', {
        description: 'La somme des emballÃ©s et dÃ©chets dÃ©passe les entrants. VÃ©rifiez vos donnÃ©es.'
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
      resto,
      emballes,
      dechets,
      unfojund: unfound,
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
      
      toast.success('âœ… Rapport sauvegardÃ© avec succÃ¨s!', {
        description: `Rapport pour ${newReportData.employee} du ${new Date(newReportData.date).toLocaleDateString('fr-FR')} enregistrÃ© dans Firebase.`
      });
      resetForm();
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Failed to save report:', error);
      toast.error('âŒ Erreur lors de la sauvegarde', {
        description: 'Le rapport n\'a pas pu Ãªtre sauvegardÃ©. Veuillez rÃ©essayer.'
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
      const monthKey = `${report.year}-${report.month.toString().padStart(2, '0')}`;
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
    { name: 'EmballÃ©s', value: kpis.totalEmballes, color: '#10B981' },
    { name: 'DÃ©chets', value: kpis.totalDechets, color: '#EF4444' },
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
                <strong>Mode lecture seule:</strong> Vous pouvez consulter les rapports, mais vous devez Ãªtre connectÃ© pour sauvegarder des donnÃ©es, crÃ©er des rapports ou accÃ©der aux prÃ©fÃ©rences personnalisÃ©es.
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
              { id: 'history', label: 'Historique', icon: FileText },
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
                    { id: 'monthly', label: 'Men¨ƒx‹Å0‰[Şl¨$C”ŒH–x‹
ÒR2LÈĞ%6%"dÆ$µ0úBÕô3ğ5]ÍZÈÑAeE0ì#.+O­ªÂîñ·®ÿótzŸ¼ü†}õC£†Æİ6Œ›‹”¨‚Ô%â%Ø\…š(ìñz²{kAÓØ£ë8ù¯÷JÊ•šÂ~ãğ6M2)¸t`×§áE÷Œİú%ì\°ª!_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎN«^˜“ÕM Òíz?»İG„­vÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø#kà68#±)Sá½g—ë·˜­Y%mjV<Í.¢€Ôp<S¯SUÆ,;¶™«­$$q3Tír|ÊŠÇce¹#ò&*ıhÁùgäûR<N#©ÒqZO‡wºG|Å+˜Q¤ãõÌ{¥àvòPÁ[ôëöhÕµØòËuX§5dĞc!ÈÒHACÑ.¢¦ÙÇ”<Æ)>oØgĞÖNµäø¬¬bnr
œÆP2ÿëç2ŠFÊûñø»^“»±Lâ‹+(l÷jz}æ’Ğ¤BOc9¥]N÷\x2))ÒP_š(ÌŸYÚ± ›æŒª‡>p×‹ŸÔ¡êëÿ‰g¬q°[›ä ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿aóEH@õÍ"…‡ßç¡Tà(ËZë°–—Ôºá6R¨Í&xïÓÓ £#FyÍŠsTß¦ ËÔåL€’`-8ñi´ü&;²¥ê—½R	‹<—MCÁfE	Ú¢uXİ%ÊüÄ–*¦¶5-8|áâ3iSà9·äŒÓt*ØÕŒÄj­èp&Y1´(ï.1jˆÎ/—‚Ùê¥´fˆ4™8Õ»ÈàÇåç)"pFREÏ¶«Fx+¿„ç]ıàúĞ²=tíŠ‘–ËÕØqG›€TR’Ï¢­ÃÑ’/Ëé  !² ô†÷Ü‹¦	U1èê“1©»İª”°òŞ®¯Şô;4S§ÁÅOSÚ#$æG¿ˆä½xÕ õ'ù=}®\c’Q6C¹*;/ŒŞâìvãÚ
õ…[íY³fBeÔæ£?—Š‰nÎòKÓ’"SŞgº"tßX©-GpÌ
©-•Mq=–|ûB—°‘Ò€¢K't| xùüÛ!ApTe ¼…ë3öSÙ½7^	²²	“yÀ fxL˜vØÁmaTĞp2›çÄ¨ëRlG¿”~Û¯àÔ¸›¾~&CZì3Š½ª•QÅüî2«_…S­æsvGÔgsâj0ìãÊºc”UÈ!4çFÙŞ#è¦±êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[~ ”ì˜…¨”gÂ—+ƒG1-BKŒ˜eU‰]=€/œ¢ì6U¹`¡7t¯‘tUÀúgtaî¦ËlQ'î¦"í*$ Â-ş¡û#3¶JKY2¼‘' ï•óyo+•œ(0*ë‡ÙTƒ	‡İÛ¦<·c±v?
YªØã%ö&|¬2±ãŞŒ¢Ñ½äC2îK’Ğ“éX±j½P½ƒÛœ¤ó ÜÜî– ƒ£üôÔ_~7¥CÄÊË³A†?U¾†w¥-Û¥Zó~3}¹otS¾rÚQTËÂ€Ä‘ìò»‹pP÷ô¤ÛÌ„|„
(”v–uÙ+„èÖuÛg|’µw»	õŸ€“ÿQ/ëş0é5Î«4`¸ºqik‰Ş©“{qã;ãa¹ÊL"zUîg¢®e#¨âu™åÁ È4¬¨4²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÈ2.VgÍ¡;Ş©h‰o³ÇŠ)|øqQ?D»±7Ïö(ŠAX×„AtşÒ UçÅÎ Ì‚t|ƒ…Ê,Í¤Lí"IQ% ñ$&Ïî›´”Ó“ÛÆ  z.ŸBğ¾úİL=şÌ?_L¿êOğøûÜ¨¾Îº¿\Œ«6T»<¿¸Oöc— ¿™Nm	ôhëÏNN‹‚È‘	E@4ûÇ.§ôÿş$»®Ã»Ö³yùòµ\ç~S¦ªö•Ş¿:mKŸÒ #H6IÉ?9ì66faòè3ëÜ¼º Ó>ïáöë¿èà›ñ{¼ŒX4äŠ›#ÆøéIşr·£Ï^®ó‚ñG…İ)bqÃñïJ7¹ã>øú^ü6¾\‹¾æ|L[RqVx‚ÅíTöNP%¶%œù`½Î,k›Ğ¤“Ü†SJt"ufDÕ/øNº´ù6S›†ÎIJ1°ü»ş­úŒó¬ñî+Ö¸»ÅÁ[|Èî)sœ+¦fH	KÁˆ8y‘-Dà\¨û(IÑ=}­bwö8bÿúo{«Å–ê0ÇÍ¹˜¹+ö¯Ïœ2ÑxK½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hXôáÉ>¼N#Ù½Øä©ÎâwÊlAlå“{lò;oŞCÚé‚`®öõ€%÷—‡Ò€B§VYKl¥_ÃsûécA7µãÈ¦¨y*¨bù$%ËÄ¸ÔÃ`›—^Saq·”“pc›©€§û}Ûõïz?­ONs	·¹ém)xÙíFDU Qû¡ù¬.Ø¼—i´ûN˜Ê1LïğÛÒì­¤y–LÑ s97ZTœ†s½#ææT½ˆ÷Ğ{Õıù=¨ı	H}ª™ß %¼é¶×­·æ ÎoÇŸîsñúœø–·]$£.-Ø’yd£ ˜Ğw¦YÖA™
ñº¹ïÅ&£ZèfĞÑRê&°}8¾`½•N{äÁ÷Ù69+a&Ü†áW}ÍÀ[=tü”Ş/¹{Mª~¡Ïä3¿I|Q<iI%?‡¯»C.O*Š ¸§Uu`FGíj=ÕÔ×ClvÎle¬têÈ3 nØëÀ—×9kê·h°ósñ†ÖVA'™+cµZšYºÏ(±Y,[šFÆ,+¢–v=öî[Â… ½<ƒ.có\åx´ä<–LBYÈÉILÑ+’f>{8|2cº"¼Ìm©› ‚Öşb_WoÃ MºGÌßl"àÓÿï9­dúù·Å×Ûfè• ¯ŒıXÙå1LÈ!QkT‘’¾"v{Å$Ö8/M­’gĞÖA+Kg¬Ø,½ÃÎk+Ì™–‘"Ë«Ï³îhäÿ±~¯’“ª1nóÈ0ìdV*ûo$Ú¢Á…mİFz½ VI9Q¶ii2áwäaeÏïÛä”¹Tè
Ìt¿?ËÜ·à€õÏÍu¨aÛ£¤€½ÛX7éTqƒ»>°¿iT¨ ŠS^fÚEì(Ş¯àÀ~şÏíYÎpÎÍ„°œ‰0 Õn×°ÎÓlÆ!æi»aXÚ  ÅÇ1ïÊÊ™bôXñ6û¾šŠf>¡5n¸™ò8½UÒ`o’‡ú(£u/øİ…@=Åÿì]:Äaj7–éRûB¢dÉº’W£Ô†Æı’Æê,|âb²yy%¼g®7)ÊZkºŠË²$¶D™‘4ÀÊ§÷Ô¼ë(bb÷@€Ã¼¹Œ€û¯A½ïÚõ´ºõ­¬z@Ãˆ²ßÙ×ø EO›uªÄŒ›€ë"kP.Ùã=+¤î„R\½g570èÛğ±«¹„º @¹ßØ'Ü´~6[§ôaìŠÑø¦îd½\ôÙsÕ¾ ò'ò<^aŞ¶R·C»a9¿¦‡Â9ğtò°Š]	ùUsìÔâ2Ig¸Äı@²WÊÁzËU{Óˆ²ßb,bt–¡ã>İG*K€‡è]'_ú„Ü³.Q×øXÓ«BTzúåuĞŞ%&¥ÕF€üÇær÷'©’¹¹¢O[±°“Qšyu’TùÌÖu\™ea•ğ©£wä¬ipÿa–®ÿÛà¡ğŞ—©ÁBéÎ˜4ˆ‰•ØĞ Kş#?jgÁùë¢#õ¶>5Å5t
sFìÃğïc­ÒF!<g«—RÚÎ#k®0á+Ÿh¥µÏ)$>3°iCĞLË¹|»pªîzø¬…œáW.Û£ƒç­	ÒK’j×IW!_…'¼âş3±éhà¨w¦“åoÈú­àáÌ.?¬oÁ#Î¦´ÁblÀà§Öip;ÀjJßsøC~àïµóÓ2œe)™,ë•ÛšİÔ£XODş³7F ¡ºö-=j½Øá¥veİ¥„êX¦÷xlÍB3Vkk9èèJA¿šW‡Ëîä¥¤HŒÌ”2ãnú$ÿtÊ#åÅÆÆl©¢†Y]wîvõ(qxö^½†-F~]ƒóÚÔTz¼ŸÉ—lİvÚ:ºx°ÛÄµ­œ‚ÜM¶qs+ èŸ÷×¸`%iS›ÉV›˜›_¹wëTBÙå*9äî·ğYë‰¼«rÇ#0¡¯C0¹gÌjÜP”ÃÖ‡(æ}>ŸçÔsèÛ&åÉTqKe¿JÌY\hòÂªÉ'²C‹v)@n'³V>bb.V{…»1wË©HT³‡ª_h¶Cx1…¼oó³2xˆdX²ÁÁX§&5]c‚%\Tnb­J6«X…nÆ²hA"f)-	%ı„}/Îd˜T”°0‡Şò"	fæq€ğßëì½÷şï¿Ê§ğûğõÿ/³»ÌÄ£<öÏÙ>üÏúÛ¿ê¼ÁO÷
õø³<ENÊCˆÈ™d@ûºúşoÖ=¿®M³ÿş„²ûğú­{®^s*3BnËì
Ì4µo_‚	RH HC:i*İ&"fšñ·óÌ¸ªm[š8‹ö‚ı´½ø‹!Õ ?8¸šŸ¬´º¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øû[üĞ~(¢™Æôi8#ğ^H—µ-~Ò ÎÂeHuù`9“aª›’“"“N"•§ƒåGğ˜œŸN.OÛ˜¸Úü¼¹ú =øÄÛË4ğøã½ºÌòL´èŠ)s¨ª‡÷½H½IK‹Û8¥9òM³8Ñ1}-œëw–_U¼ü?‹ûŒ¤ê {«ù@™ÍÆ{çÜ€™8“©F>{Š×Ùn ¹« ŒƒØ&¶d8¨	zôMü®=cçNK>˜³[ÀÇ«y„’­zLÉl¥dW’lÈ2;GíŞd†—×!_¢p}@‚Ö	%4{h‹C1î™kÁ/´§Ü¶)IKÏ°g$Ú$¨ğÑpŸ•ßak—–±“êç¿û>½:ø»ÔKK7©Yí0ù8İ)f›\	á©ûåÎşOôûÉ4­G¨ƒx‹Á0‰[Şl¨$C”ŒH–x‹
ÒR2LˆĞ%6%"dÆ$µ0úBÕô3ø5]ÍZÈÑAeA0ì#.+O­ªÂîñ·®ÿótz¼ü–}õC#††İ6Œ›‹”¨‚Ô%â%Ø\…š ìñz²{kaÑØ¡ë8ù¯÷JÊ•šB~ã°6M2)¸t`×§áE÷ˆİz%í\°ª)_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎN«^“ÕM Òíz?ºİG„ívÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø3kà68#±)Sáœ½g—ë—™­Y%mjV<Í.¢€Ôp<S®SUÆ,;¶™«­4,q3Tír|ÊšÇce¹#ò&*ıhÁùgäûR<N,#¹ÒsZW‡wºG|Å+˜Q¤ãõÌq{%
àvòPÁ[ôëÖhÕµØòËuX¥5dĞc!ÊÒHAcÑ>¢¦Ùß”<Æ)>o˜cĞÖNµäø¬¬`.nr
œæP2ÿëç2ŠFÊûñ¸»^“º±L¢‹+(n÷j;z}æ’Ğ¥BOc9¥]N÷\x2))ÒP_š(ÌŸYú± ›æŒª‡	>r×‹ŸÔ¡êëßÉg¬p°[›ä ¹NØ·é9zÃŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡ßç¡Tà(ÏRë°–—Ôºá6Â¨Í&yïÓÓ £#FyÍŠsTß¦€ËÔåL€’`-0ñk´ü&;²¥ë—½V‹<—OCÅfE‰Ú¢uİ%ÊüÄ–*¦¶5-8\óâ3iSà9§äŒÓt*ØÕŒÄj­èp&Y1´(ï.1jˆÎ…+—‚Ùê¥´fˆ4›8Õ»ÈáÇåç)"pFREÏ–»Fx+¿„çİùàúĞ²=tí‚‘–ËÕØqG›€TR–Ï¢¯ÃĞ’/Ëé  !² ô†÷Ü¦)U1èî“1©»Íª”°óŞ®¯Şô;4[§ÁÅOSÚ!$æG¿ˆä½xÕ õ'ù=}¬\c’Q6C¹*;/ŒŞâìrãÚ
õ…[íY³fJeÔæ£?—Š‰nÎòËÓ’"SŞwº"tßX©-GpÌ(©-•Oq=”†|{B—°‘Ò€¢Ë't|xùüÛ1ApTe Ì•ê3öSù½'Z	²²	‘yÀ fxL˜vØÁmaĞp2›çÄ¨ëRlF¿”Û¯à‹Ä¸›¼~&CZì3Š½ª•QÅüî2:ª_…S¯æsvGÔorâj0ìãÊºc”UÈatçFYŞ#è¦0êÎÈ„~Å8â¿¶ijR@À¹N-ºr[ ”ì˜…¨”gÂ—+ƒG1-BKŒ˜eU‰]=„/œ¢ì6U¹b¡7t§‘tUÀúGtaî¦ËlÑ'î¦"í*, â-ş¡û#3öJKY2ü‘'"ïóùo+•œ(0*ë‡Ùvƒ	‡İÓ¦<·a±v?
YªØã%ö&x­2¡ãŞŒ¢Q½ä2ïK’Ğ“ÉXµj½P½ƒÓ¤÷ ÜÜî–
`ƒ§üôÖ_~7¥C„ÊË£A†?U¾†w¥-Û¥Ró~3}¹otS¾rÚQTËÂ€Ä‘Ìò»ŠxPÿĞ¤ÛÌ„|„(”v–uÙ+„èÖuÛg}’µw»õŸ€“ÿQ/ëş0é5Î«4`¸ºñik‰Ş©“{qã9ãa¹ÊL2zUæg¢®%#¨âu˜åá È4¬¨4¶˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÈ2.PgÍ¡;Ş©h‰1o³ÇŠ)|øqY?D»±3Ïö(ŠAXÖ„atşÖ U§ÅÎ Ì‚||ƒ…Ê,Í¥Lí"IY% ±$$Ïî‹´Ó“ÛÆ "z.UŸ@ğ¾ûÜL9şÌ?_L¿êOğ¸ûÜ¨¾Îº¿\Œ«6T»¼¿¸Oög— ¿™Ne	ôhëÏNN‹‚È‘	EA4ûÇ.‡ôûş$¹®Â»Ş³yùòµXç~Q§ªöÕÚ¿:¾mKŸÒ #HI‰?¹ì&6faòè3ëÜ¼º Ó>íá¶ë¿èà›ñ{¼ŒX4äŠ›#ÆøéIşr·£Ï^®ó‚ñG…ı)*qÃñïZ7¹ã>øú^ü6¾Ü‹¾ætN[RqVx€ÅíTöNP%¶%œù`½Î,k›Ğ¤“Ü†S
t"ufGÕ?øNº´ù>S›¦ÏIJ1°ü»ş­úŒó¬(ñê+Ò¸»ÅÁ[|Èî)sœ+¦gH–	ËÁˆ8y•-Dä\ û(IÑ9}­bwö9bÿúo{©Å–ê0ÇÍ¹¹+ò¯Ïœ2ÑxC½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘èXôáÙ>¼N#Û½Øä©ÎâwÊ™lAlå“{nò;oÜCÚ©‚`®òÕ€%÷—‡Ò€B§VÙKl¥_ÃsûécA7µãÈ¦¨y*¨bù$%ËÅ¸ÔÃ`›—\Saq·”“Ğs›©ˆ·û}Ûõîz?­O–Ns	·¹Éo)xÙíFDU Qû¡ù¬.Ø¼“i´»N˜Š5LïğÛÒì­¤Ÿy–LÑ s97ZTœ†s½#ææT½ ˆ÷Ğ{Õıù=¨ı	H}ª™_@¼É¶×­·æ ÎoÇŸîsóú‹œø–·]£-Ø’yd£ Ğw¦YÖA™ñ:9ïÅ&£ZèfĞÁbê&°}8¾`½•N{äÁÿÙ69+q&Ü†áW}ÍÀZ=tü”Ş/¹{Íª~¡Ïä3¿I|Q<éI%?‡¯½C.O*Š ¸§Uu`FGíj=ÕÔ×ClvÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†ÖA'™+cµZšYºÏ(±Y,[šFÆ,+¢–v=öî[Â¥ ½<ƒ.cñ\¥y´ì<–lBYÈÉILÑ«’f{8|2cú"¼Ìm)›¤Öşâ_WoÃMºGÌÏl"àÓÿï)-dúù·Å×Ûfà• H¯ŒıXÙå1DÈ!QkT‘’¾"v{Å¤Ö8/O¥’gĞöA*Og¬Ø,½ÃÎk+Ü™–‘"Ë«Ï³îJäÿ±^¯’“ª1nóÈ0ìd*ûo$Ú Á…mİV:½ VI9Qöii2áwäaeÏïÛà”¹Ôê
Ît¿?ËÜ·à€õÏÍt¨aÛ£¤€½ÛX7áTqƒ»>Ï°¿iT¨ ˆS_fŞUì(Ş¯àA~şÏíÎpÎ[Í„°œ‰0 İ.×°ÎÓlÆ!æi»qXÚ ¨ÅÇ1ïÊÊbtXñ6û¾Šf>¡5n¨‰ò8½UÒ`o’‡ú(£u/øİ…@=ÿì]*Äaj7–aRúB²dÉº’W£Ô†Æı’Æê,|âc²yy%´g®?)ÊXkºŠË²$¶D™•Ñ4ÀÊ§÷Ô¼«(bb÷@€Ã¼¹Œ€ë/A½ïÚõ´ºõ­®z@Ãˆ²ßİ×ø¡EO›uªLŒ›€ë£kP.Ùã+¤î„R\½g570èÛğ±£¹„º @¹ßØ'Ü´~6[§ôaìŠÑø¦êd½\ôÙ{Õ¾ ò'ò<^aŞ¶R·C»!9·®‡Â9ğ|ğ°Š]	û]sìÔâ2Ig¼ÄıÄ²WÊÁzËQ{Óˆ²×r,bt–¡ç>İG*K€‡è]'[º„Ü³.Q×øXÓ«BTzúåeĞŞ%&¥ÕF€üÇâr÷#©’¹¹¢O[±°“QšyĞu’TyÌÖu\™eg…ğ©£÷ä¬ipÿa–®ÿÛà¡äŞ—©ÁBéÎ“˜4ˆ‰•ØĞ Kş#?jgÁùë¢#õ¶?4Å5t
sFìÃğïc­ÒF!<g«—RÚÎ#k®0á+Ÿè¥µÏ)$>3°iCĞLË¹|»pªÎz%ø¬œáV.#Ë£§­	ÒK’j×IW!_?…'´âş3±éhà¨w¦“e/Èº­àáÌ.?¬oÁ#Î¦´ÅblÀà§Öid:ÂjJŸsøc~àïµóÓ2œg)™,ë•ÛšİÔ£XODş»<µF ¡šö-=j½Xå¥veİ¥0„êX¦÷xlÍB#VkkÈèZA¿ºW‡Ëîä§¤HŒÌ”2ãnútÊ#åÅÄÆ|©¢†yYwîvõhqxö^ı†-N~]ƒóÚÔT{ ¼ŸÉ—lİvÚ:ºx°ÛÄµ­œ‚ÜM¾qs# èŸ÷×¸`%#aS™ÉV›˜›Y¹vëPBÙå*9äê·ğYê‰¼©rÏ#0¡¯G0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&åÉTqKe¿JÍYThòÂªË'²#‹v)@n'³V>bâ.Vk…»1wË©HT£‡ª]h¶Ax1…¼oó³2xˆdY²ÁÁX§&5]c‚%\Tîb­B6«X…nÆºhA"fi-	%ı„}/Î`˜T”°0‡Úò"	fæq€ğßëì¾÷şï¿Ê§Ğûğõÿ/³»ÌÄ£<öÏÙ>üÏú›¿ê¼ÁOÿ
uø³<ENÊCˆÈ™$Hûºúşö=¿ªM³ÿş„²û
ğú­{®^s*3bnËì
Ì4µk_‚	R@ @C:Y*İ&"fšñ·óÌ¸ªm[š8‹ö‚ı´¹ø‹!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øû[ıÀ~(¢™Æõm8#ğ^X–µ-~Ò ÎÂeHu¹`9“aª›’“"“N*•§ƒågğ˜œŸN.OÛ˜¸Ú$ü¼¹ú=xÄÙë6ğøã½ºÌòL´èŠ©s¨ª‡÷½HüIK‹Û8¥9òM³9Ñ1}-œëw_UU¼ü?‹ûŒ¤ê {ëù@™ÍÆ{ïÔ€™8“©F>{Š×Ùn ¹« ŒƒØ&¶d8¨	~ôÍü®=c¦K>˜³KÀÅ«i„’­zlÉl¥lW’lÈ2;GíŞ’d†“×¡1_‚p}A‚Ö	%4{h‹C1î™kÁ/´§Ü¶)IKÏ´g$Ú$¨ğÑpŸ•ß‘ac—–¡“êç¿û>½:ø»ÔKK7©Yí0ù8İ)f›\X	á©{åÎşOôÛÉ4­G¨ƒx‹Å0‰[Şl¨$”ŒH–x‹
ÒR2LÈĞ%6%"dÆ$µ0úBÕô3ø7]ÍZÈÑAeE0ì#.+O­ªÂîñ·®ÿótz¼ü†}õC£††İ6Œ›‹”¨‚Ô%â%Ø\…š(ìñz²{kAÓØ£ë8ù¯÷JÊ•šÂ~£ğ&M2)¸t`×§áE÷Œİúeì\°ª!_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎN«^˜“ÕM Òíz?»İG„­vÂFM‰ú2düØ‚aKpÉöæiØâäß•ˆø3kà6K9'±)Sáœ½g—ë·˜­Y%mjV<Í.¢ Ôp¼S®SUÆ,;¶™«­4,q3TírxÊPŠÇce©#r&*ıhÁùgäûR<N,#¹Ò{sZG‡wºG|Å+˜Q¤ãõî1{¥
àvòPÁ[ôëöèÕµØòËuX¥5dĞc!ÊIÒHACÑ.¢¦YÇ”<ÆC)>oØcĞÖNµäø¬¬bnp
œæP2÷ëç2ŠFÊûñø»^“º±Lâ‹+(l÷j;z}Æ’Ğ¤BOc9¥]N÷\x2))ÒSRWš(ÌŸYÚ± ›æŒª‡	>p×‹ŸÔ¡êëÏÉg¬q°[Ûä ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡Ïç¡Tà(ÏÒë°–—Ô»á6RªÍ'xïÓÓ £F}ÍŠsTß¦ ËÔåL€’`-8ñk´ü&;²¥ë—½V	‹<—OCÁfEˆÚ8¢uİ%ÊüÄ–*¦¶5-8\áâ3iSğ9·äŒÓt*ØÕœÄj­èp&I1´*ï.1jˆÎ+—‘‚Ùê¥´fˆ4™8Õ»ÈáÇåç)"pfRE7Ï¶«x)ÿ„çİıàú…Ğ²=tí‚‘–ËÕØqG›€TR–Ï¢¯ÃÑ’/Ëé  !² ô†÷Ü‰¦	U1èê“1©»Íª”°óŞ®¯Şô;4§ÁÅOSÚ!$æG¿ˆä=xÕ õ'ù9}¬\c’S6C¹*;/ŒßâävãÚ
õ…[íY³fBeÔæ£?—Š‰nÎòKÛ’"SŞwº"tßX©-GpÌ
©-Mq=”|ûB—°‘Ò€¢Ë't|xùşÛ1ApTe Ì•ê3öSù½'^	²²	‘yÀ fxL˜vÜÁmaĞp2›çÄ¨ëRlG¿”~Û¯à‹Ä¸›¼~&CZì3Š½ª•QÅüî2ª_…S®æsvGÔOsâj0ìãÂºc”UÈ!4çFÙŞ#è¦0êÎÀ„~Å8Lâ¿¶IjR@À¹N-ºr[ ”ì˜…¨”gÂ—+ƒG1mBKŒ˜eU‰]=„¯œ¢ì6U¹`¡7t'‘tUÀúgtAn¦ËlÑ'î¦"í*, â-ş!û#3öJKy2ü‘' ï•óùo+•œ(0*ë‡ÙĞƒ	‡İÛ¦<·a±v?ŠYªØã%ö&|­6¡ëŞŒ¢Ñ½äc2îO’Ğ“éXµjP½£ÛŒ¤÷ œÜî–ŠP §üôÔ_~7¥C„ÊËƒA†?U¾†w¥-Û¥Zó~;}¹o4S¾rÚQTËÂ€İÄ‘ìò»ŠpPÿğ¤ÛÌ„|„(”~–uÙ+„éÖuÛg}’±w»õ€ƒÿQ/ëş0é5Ï«4`¸ºñik‰Ş©“{qã9ãa¹ÊL2zUîg¢ª%#¨êu˜çÁ è4¬¨4²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÈ2.TgÍ¡;Ş©h‰o³ÇŠ)|øqY?D»±7Ïö(ŠAXÖ„AvşÖ UçÅÎ(Ì‚t|ƒÊ¬Å¤Lí"I% ñ$&Ïî»´€Ó“ÛÆ "z.UŸ@ğ¾ûİL=şÌ_L½êOğøûÜ¨¾Îº¿\Œ«6T»¼¿¼Oöc— ¿™Fe	ôhëÏNN‹‚È‘	EApëÇ.§ôÿş$¹®Ã»Ö³yùòµØç~S§ªöÕÚ¿:¾mKŸÒ #HiÉ¹ì&6faòè3ëÜ¼º “>ıáöë»hà›ñ{¸ŒX4äŠ›#ÆøéIşv·£Ï^®ó‚óG…Ü)jqÓñï
7¹ã>øú^ü6¾\‹¾ætL[RqVx‚ÅéTvNP%¶%œù`½Î,k›Ğ¤“ÜSJt"ufDÕ/øN:´ù>S›¦ÏIJ1°ü»ş­úŒó¬(ñî+Ò¸»ÅÁ[|Èî)sœ+¦gI	KÁè8y•-Dæ\¨û(IÑ9}­bwö8bÿúo{®Ä–ê0ÇÍ¹¹+ò¯Ïœ2ÑxK½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hXôáÉ>¼N#Ù½Ø¤©âwÊİlAlå“{lò;oÎCÚ©‚d®öÕ %÷—‡Ò€B§VYKl¥_ÃsûécA7µãÈ¦¨y*¨bù$%ËÄ¸ÔÃ`›—\Saq·”“Ğs›©·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼“i´»N˜Š1LïğœÛÒÌ­$¤y†LÑ¡s97ZTœ†s½#ææT½ ˆ÷Ğ{Õıù¨½H}ª™ß`¼I¶Ö­·æ ÎoÇŸìsñúœø–·]$£-Ø’yd£ Ğ÷¦YÖA™
ñ:ïÅ&³ZèfĞÁBê&°}(¾`½•N{äÁ÷Ù69+a&Ü†áw}ÍÀ[=tü”Ş
/¹{Íª~¡Ïä3¿I|Q<iI%?‡¯¹C&O*Š ¸§Uu`FGmj=ÕÖ×C,vÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†ÖVA'™+cµZšYºÏ(±Y,[šFÆ,+¢–v=öî[Â‡ ½<ƒ.có\åy´ì<–lBYÈÉILÑ+’f{8|2cú"¼Ìm)› ‚Öşâ[WoÃMºGÌÏl"àÓÿï)­dúù·Å×Ûfèµ ¯ŒıZÙå1LÈ!QkV‘‚¾"v{Õ$Ö8/M­’gĞÖA+Og¬Ø,½ÃNk+Ü™–‘"Ë«Ï³îJäÿ±~¯’“ª1nóÀ0ìdV(ûo$Ú¢Á‡mİF~½ VÉ9Q¶ii2áwäaåÏïÛà”¹ôè
Ît¿ËÜ·à€õÏÍu¨aÛ£¤€½ÛX6éÔqƒ»>°¿iT¨ ˆS^fŞEì(Ş¯àÁ~şÏíÎrÎÍ„°œ‰0 ÙnW°ÎÓlÆ)æiºqXÚ ¨ÅÇïÊÊbtXñ6û¾‹f>¡5n¸™ò8½UÒ`o’ú(£u/øİ…@=Áÿì]*Äaj7–áRûB²dÉº’W£Ô†Æı’Æê,|âb²yy%´e¬?S)ÊXkºŠË²$¶D™Ñ4ÀÊ§÷Ô¼£(bb÷@€Ã¼¹Œ€ë¯I½ïÚõ´ºõ­¬z@ÃˆºßÙ×ø¡eo›uªÄŒ›€ë£kP.Ùã+¤î„R\½g570èÛğ±£¹º @±ßØ'Ü´~6[§ôaìŠÑø¦îd½\ôÙ{Õ¾ ò'ò<^aŞ¶R·C»!9¿¦‡Â9ğtò°Š]	ùUsìÔâ2Ig¸ÄıÀ²WÊÁzÉQ{Óˆ²×r,bt–¡ç:İG*K€‡è]'_º„Ü³.Q×øXÓ«1BT{úåuĞŞ%&¥ÕF„üÇâr÷#©’¹¹¢O[±°“QšyĞu’TyÎÖu\™ea•ğ©£÷à¬ipÿa–®ÿÛà¡ôŞ—©ÁBéÎ˜4ˆ‰•ØĞ Kş#?jgÁùë¢#õ6>4Å5t
sFìÃğïc­ÒFa<gª—RÚÏ#k®0¡+Ÿà¥¥Ï)D>3°iCĞLË¹|»pªîz%ø¼…œáW.#Û£‡§­	ÒK’h×IW!_?…'¼âş3±éhà¨w¦“eoÈú­ààÌ.?¬oÁ#Î¦´ÅblÀà§Öip‘;@jJßsøC~àïõóÓ2œg)™,ë•ßšİÔ§XODş³µF€¡ºö-=jµXá¥veİ¥0„êX¦÷xhÍB3Vkk9ÈèJAŸšV‡Ëîä§¤HÌÌ”2ãnúvÊ#åÅÄÆ|©¢†yYwîvõhqxö^ı†-N~]ƒóÚÔU{ ¼É—lßvÊzºx°ÛÄµ­œ‚ÜM¶qs+ ÈŸ÷×¸`%iSÛÉVŸ˜›Y¹wëTBÙÅ*9äê—ğYë‰¼©r×#0¡¯C0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&åÉTqKe¿JÌY\hòÂ*Ë'²cƒv)@n'³V.bb/v{…³1wË©HT³‡ª]h¶Ax1…¼oóó2x‰dX²AÁX§&5]c‚%\Tîb­B6«X…nÆ²hA"	fi-	%ıÄ}/Î`˜T”°0‡Úò"	fæq€pßkì½÷şï¿Ê§ğ{ğõÿ/³»ÌÄ£<öÏÙ>üÏúÛ¿ê¼ÁOõuø³<ENÊCˆÈÙ$@ûºúşö=¿®M³ÿş„²û
ğú­{®^s*3BnËìÌ4µo_‚	RH @C:y*İ&"fšq·óÌ¸ªm[š(‹ö‚ı´½ø‹!Õ ?8¸šŸ¬´¸¸™áUR\úEíër¿‹Ê‚ç ¹×éÏhş{¶î
!¸«ğû[ıĞ>(¢™Æôm8³ğ^X—µ-~Ğ ÎÂaHuù`9“aª›’“"“N"•§ƒåGğ˜œŸN.OÛ˜°Úü¼¹ú =øÄÛë4ğxã½º-ÌòL´èŠ©s¨ª‡÷½H¼IK‹Û8¥9òM³9Ñ1}-œëw–_U¼ü?‰ûŒ¤ê {ëû@™ÍÆ{ïÜ€™8“©F'>{Š×Ùl¹« ŒƒØ&¶d8¨	z<ôÍü®=cæK:˜³ÀÅ«i„’­zLÉl¥dW’lÈ2;GíŞ$†—×!_¢p]A‚Ö	%4{h‹C1î™kÁ/´§Ü¶)IKÏºg$Ú$¨ğÑpŸß‘ak–¡“êHç¿Û>½:ù»ÔKK7©Yí0ù8İ)f›\	á©ëåÎşOôûÉ4­G¨ƒx‹Å0‰[Şl¨$C”œH–x‹
ÒR2LÈĞ%6%"dÆ$µ4úBÕô3ø7]ÍZÈÑAeE0ì#.+G­ªÂîù·®ûótzŸ¼ü–uõC£††İ6Œ›‹•¨‚Ô%â%Ø\…š(ìñz2{kAÓØ£ë¸ù¯÷JÊ•šÊ~ãğ6M2)¸t`W§áE÷ŒÍú%ì\°ª)_Uª}AŞç¿÷
Hè\Etp	G <…¿3CÎN«^˜“ÕM Òí‘z?ºİO„­vÂFM‰ú2düØ‚aKpÉöæ)ØâäÏ•‰ø3kà69#±)Sáœ½g—ë—˜­Y%mjV<Í.¢ Ôp¼S®SUÆ,;¶™«í$,q3Tír|ÊPŠÇce¹#ò&*ıhÁùgäûR<N>#©ÒsZG‡wºG|Å+˜Q¤ãõî1{¥
àvòPÁ[ôëöiÕµØòËux:¥5dÀC!ÊKÒHAcÑ.¢¦YÏ´<ÆB)¾o˜cĞÔNµäø¬¬`nr
œÆP2óëç2ŠFÊûñø»^„“º1Lâ‹+(,÷j;z}ä’Ğ¤BOc9¥]N÷\x2))ÖSP_š(ÌŸYÚ± ›æŒª‡>pÕ‹ŸÔ¡êëÿÉg¬q°[›ä 9NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡Ïç¡Tà(ÏZë°–—Ôºá6RªÍ'yïÓÓ £#yÍŠsTß¦ KÔåL€’`-8ñk´Ü&;²¥ê—½V	‹<—MCÁfE‰Ú¢uİ%ÊüÄ–*®¶5=8|áâ3iSĞ9·äŒÓt*ØÕŒÄj­èp&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4™8Õ»ÈáÇåç)"pfREÏ¶«x+¿„çÍùàúĞò=tí‚‘–ËÕØqG›€TR–Ï¢¯ÃÙ’/Ëé  !² ô†÷Ü‰¦U1øî“1©»İª”°òŞ®¯Şô;4[§ÃÅOSÚ!dæG¿ˆäxÕ õ'ù=}¬\c’Q6C¹*;/ŒßâävãÚ
õ…[íY³fBeÔæ£?—Š‰nÎòKÓ’"SŞgº"tßX©-GpÌ*©-•Mq=–|ûB—°‘Ò€¢K't|xùüÛ!ArTe Ø…ê3öSù½'^	2²	“yÀ fxL˜vØÁmaĞp2›çÄ¨ë
RlG¿”Û¯è‹Ô¸›¼~&CZì3Š½¨•QÅüîª_…S¯æsvGÔosâj0ìçÂºc”UÈ!4çFÙÖ"è¦0êÎÀ„~Å8Lâ¿¶IjR@À¹N-ºr[~ ”ì˜…¨”gÂ—)ƒG1oBKŒ˜eU‰]=„/œ¢ì6U¹`¡7v¯‘tUÀúgtaî¦ËlÑ'î¦"í*,€â-ş!û#;¶JKy2ü‘' ï•óùo+•œ(0"ë‡ÙVƒ	‡İÛ¦<·a±v?
YªØã%ö&x­2¡ëŞŒ¢Q½äC2îK‚Ğ“éX±"jP½ƒÛœ¤ó œÜî–
 ƒ§üôÔ_~3¥C€ÊË£A†?U¾†w¥-Û¥Ró~3}9otS¾rÚQTËÂ€Ä‘Ìò»
xPÿğ¤ÛÌ„|„(”v–uù+„èÖuÛg}’±w»õ€“ÿQ/ëş0é5Î«4`¸ºñik‰Ş©“{qã;ãa¹ÊL"zUæg¢®%#¨êu™çÁ Ê4¬¨4²˜·¶ô
ÇYnÅ,’'¿[,Q¶s‚^ E)-§–EfÀ2.VgÍ¡;Ş©h‰o³ÇŠ)|úqY?D»±7Îö(ŠEXÖŒavşÖ U§ ÅÎ Ì‚t|ƒ…î,Í¤Lí"IX% ñ$Ïî›´Ó“ÛÆ "z.UŸ@ğ¾ûİL=şÌ?_L¿êOğøûÜ¨¾Ïº¿\Œ«6T»¼¿»Oöc— ¿™Ne	ôhëÏNN‹‚È‘	EA0ûÇ.‡õëş$»¦Ã»Ö³yùò•\ç~S§ªöÕÚ¿:¾mKŸÒ #Hi‰¹ì&6farè3ëÜ¼º Ó>íáöë¿èà›ñ{¼ŒX4äŠ›#ÆøéIşr·£Ï^®÷‚óG…İ)jqÓñï7¹ã>øú^ü6¾\‹¾ætL[RqVx‚ÅíTvNP%¶%œù`½Î,k›Ğ¤“Ü†SJt"ufDÕ/øNº´ù>S›†ÎIJ1°ü¿ş­úŒó¬,ñî+Ò¸»ÅÁ[|Èî)sœ+¦gH	KÁˆ8y•-Dæ\ û(IÑ=}­bwö9bÿúo{©Ç–ê0ÇÍ¹¹+ö¯ÏœrÑ8K½H"EJkˆ—“b&³”±ò«Ó¦½Àø‘hXôáÉ>¼N#ÛŸıØ¤©ÆâwÊ™lAlå“{mò4;{ÜCÚ©‚ ®öÕ€%×—‡Ò€B§VY[l¥_ÃsûécA7µãÈ¶¨y*¨bù$%ËÄ¸ÔÃ`›—\Saq·”“Ps›©€·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU QÛ¡ù¬.Ø¼“i´»N˜Š1LïğÛÒÌ­¤y–LÑ s97ZTœ†s½#ææT½ ˆ÷Ğ{Õıù=¨ı	H}ªÙß@¼É¶×­7æ ÎoÇŸîsñúœø–·]$£Š.-Ø’yd£ Ğw¦YÖA™
ñ:9ïÅ&£ZèfĞÃBê&°}8¾`½µ¯NkäÁ÷Ù69+a&Ü†áw}ÍÀ[=tü”Ş/¹{Íª~¡Ïä3¿I|Q<iI3%?‡¯¹C.O*Š ¸§Uu`FWåj=ÕÔ×C,vÎle¬Ğtê˜3 nØëÀ—×ykê·h°ósñ†ÖAg™+cµZšYºÏ(±Y,[šFÆ,+¢–v=öî[Â… ½<ƒ.có\åz´ì<–lBYÈÉILÑ+‚f{8|2cú"¼Ìm)› ‚Òşâ_oÃMºGÌÏd"àÓÿï)­dúù·Å×[fè• ¯ıXÙå1LÈ!QkT‘’¾"v{Å¤V8/M­’gPÖA+kg¬Ø,=ÃNk+Ü‘–‘"Ë«Ï³îJäÿ±z¯’“Š1nóÈ0ìdV(ûo$Ú¢Á…mİF:ı VÉ9Q¶ii"áwäaeÏïÛà”¹Ôè
Ît¿?ËÜ·à€õÏÍuªaÛ£¤€½ÛX7aÔq‡»>Ï°·iT¨ ˆS_fÚEì(Ş¯àÁ~şÏíÎpÎÍ„°œ‰0 n×°ÎÓlÆ!æiºaZÚ ¨ÅÇ1ïÊÊbtXñ6û¾Šf>¡5n¨™ò8½UÒ`o’‡ø(£u/øİ…@=Áÿì]:Àaj7–éRúB²dÉº’W£Ô†Æí’Æê,|âc¢yy%´e®7S)ÊXk²ÊË²$¶D™‘4ÀÊ¯÷Öœ«(bb÷@€Ã¼¹Ìë¯A½ïÚõ´²õ­¬z@Ãˆ2ßİ×ø¡EO›uªDŒÛ€ë£kP.Ùã=+¤î†R]½g5?0èÛğ±«¹„º @±ßØ'Ü´~6[§ôaìŠÑø¦êd½\ôÙ{Õ¾ ò'ò<¯^aŞ¶R·C»a9·®‡Â9ğtğ°Š]ùUsìÔâ2If¸Äı@²WÊÁzËQ{Óˆ²×r,bt–¡ç>İG*K€‡è]'º„Ü³.QÓøXÓ«BDzúåuĞŞ!&µÕF„üÇâr÷#©’¹¹¢O[±°“QšyĞu²TyÎÖu\™eu•ğ©£÷ä¬Ipÿa–®ÿßà¡äÎ—©ÁBéÎ˜4˜‰•ØĞ Kş#?jgÁùë¢#õ6>4Å5t
sFlÃğïc­ÒFa<g«—RÚÏ#k®0¡+Ÿà¥µÏ)$>3°iCĞLË¹|»pªîz%ø¼…œáW.#Û£‡ç­	ÒKj×IW!_…'¼âş3±éjà¨w¦“eoÈº­àáÌ.7¬oÁ#Î¦´ÅbLÀà§ÖipQ;ÂjJßsøc~àïµûÓ2œg)™,ë•ßšİÔ£YODş³µF ¡ºö-=jµØá¥veİ¥0„êX¦
÷xhÍB3Vkk9ÈèZAŸºV‡Ëîä§¤‰HÌÎ”2ãnúvÈ#åÅÆÆ|©¢†]]wîvõhqxö^ı†-N~]ƒóÚÔT{ ¼ŸÉ—lÍvÊzºx°ÛÄ´­œ‚ÜM¶qs+ è÷×¸`!aSÛÉVŸ˜›Y¹wëTBÙÅ*9äê·ğYê‰¼©r×#0¡«C0¹oÌj\P”ÃÒ‡(æu>¾çÔsèÛ&åÉTqKe¿JÌY\hòÂ*Ë'²c‹v)@n'3V.bb/V{…»1wË©HT³‡ª]h¦Ax1…½oó³2xˆdX²ÁÁX§&5]c‚%\TîB­B6«X…nÆºhA"fi-	%ı„}/Îd˜T”°0‡Şò"	fæq€ğßkì½÷îï¿Ê§ğëòõÿ/³»ÌÄ£<öOÙ>üÏúÛ¿ê¼ÁO÷
õø³<ENÊCˆÈ™$@ûºúş¦=¿®M³ÿş”²û
ğú©{®^S*3BnËìÌ4µo_‚	RH @C:y*İ&"fšñ·óÌ¸ªmSš8‹ö‚ı´¹ø‹!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸»øû[ı€>(¢™Æôo8£ğ^X—µ-~Ø ÎÂeHuù`9“aª›’“"“F"•§ƒåGğ˜œŸN.OÛ˜°Úü¼¹ú =øÄÛë4ôøã½ºÌòL´hŠ)s¨ª‡÷½H¼IK‹Ûx¥9òM³9Ñ1}-¼ëw–_U¼ü‹ûŒ¤ê {ëù@™ÍÆ{ïÜ€™8“©F>{Š×Ùn ¹« ŒƒØ&¶d8¨	zôÍü®=gæK>˜³ÀÕ«y„’­zLÉl¥lW’lØ2;GíŞ’d†“×!_€p}A‚Ö	%4{h‹C1î™kÁ/´§Ü¶)IKÏ°g$Ú$¬ğÑpŸ•ß“ak—–!¡“êç¿Û>½:ù»ÔKK7©yí0ù8İ)f›\	á©ûåÎşOôûÉ4­G¨ƒx‹Å0‰[Şl¨$C”ŒH–x‹
Â-R2LÈĞ%6%"dÆ µ0HúBÕô3ø7]ÍZÈÑAeE0ì#.+O­ªÂîñ·®ÿótz¼ü–}õC£†ÆİvŒ›‹”¨‚Ô%ê%Ø\¥š(ì±z2{kAÓØƒë8ù¯çJÊ•šÊ~ã²6M2)¸t`×§áE÷Œİú%ì\°ª)_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎN«^˜“ÔM Òíz?ºÙG„ívÂNM‰ú2düØ‚aKpAöæiØâìÏ•ˆø3kà69±)Sá½g—ë—™­Y%mjV<Í.¢š Ôp<S®SUÆl;¶™«í$,q3Tír|ÊPŠÇce¹#ò&*ıhÁÙgäûR<N.#¹ÒsZG‡gºG|Å+˜Q¤ãõî1{¥
àvòTÁ[ôëöhÕµØòËuX¥5dPc!ÊKÒHAcÑ?¢¦YÏ”<Æ)>o˜cĞÖNµäø¬¬bnr
œæP2ÿ«ç2ŠFÊûñø»^“º1L¢‹+(l÷j;z}ä“Ğ¤BOc9¥]N÷\x2))ÒSPWš(ÌŸQÚ± ›æŒª‡>p×‹ŸÔ¡êëßÉg¬q°Û›ä ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡ßç¡Tà(ÏZë°–—Ôºá6RªÍ'xïÓÓ £#FqÍŠsTß¦ ËÔåL€’`-8ñk´ü&;²¥ë—½V)‰<—MCÑfE‰Ú¢uİ'ÊüÄ–*¦¶5-8|áâ3iSà9·äŒÓt*ØÕŒÄz­\èp&Y1°(ï.1jˆÎ+“‚Ùê¥´fˆ4Ÿ8Õ»ÈáÇáç)"pFREÏ¶«x	¿„çİùàúĞ²=té‚‘–ËÕØqG›€TR–Ï¢¯ÃØ–/Ëé  !² ô†÷Ü‰¦U1èê“1­»Íª”°²Ş®¯Şô;4§ÁÅOSÚ#$æG¿ˆä½xÕ õ'ù=}¬\c’Q6C¹*;/ŒßâìvãÚ
õ…[íY³fBeÔæ£?—Š‰nÎòKÓ’"SŞwº"tßX©-G°pÌ*©-•Mq=”|ûB—°‘Ò€¢K't|xùüÛ!ApTe Ì…ê3öSù½'^	²ò	“yÀ fxL˜vØÁmaĞp2›çÄ¨ëRlG¿”~Û¯à‹Ä¸›¼~&CZì3Š½ª•QÅüî3:«OµS¯æsvGÔosâj0ìãÂºc”UÈ!4çFÙŞ#è¦0êÎÀ„~Åxâ¿¶ijR@À¹N-ºr[ ”ì˜Å¨”gÂ—+ƒG1oBKŒ˜eU‰]=€/œ¢ì6U¹`¡7t¯‘tUÀúgtaî¦ËlÑ'î¦"í*, â-ş!û#3¶JKY2¼‘' ï•óùo+•œ(0*ê‡Ùvƒ	‡İÛ¦<·c±v?ŠYªØã%Ö&|­2¡ëÜŒ¢Ñ½äC2îK’Ğ“éZ±"j½P½£Óœ¤ó ÜÜî– ƒ§üôÔ_~7¥C„ÊË£A†?U¾w¥-Û%YZó~;m¹otS¾rÚQTËÂ€Ä‘¬ò»ŠpPÿğ¤ÛÌ„|„
(”v–uÙ+„èÖuÛg}’±w»õŸ€“ÿQ/ëş0é5Î«4`¸ºñik‰Ş©“{qã9ãa¹ÊL2zUîg¢®%#¨âu˜çÁ È4¬¨4²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÀ2.Vg¡;Ş©h‰o³ÇŠ)|øsY?D»±7Ïö(ŠAXÖ„atşÖ U§ÅÎ(Ì‚l|ƒ…Î,Å¤Ní"IY% ñ$$Ïî‹´Ó“ÛÆ "z.UŸ@ğ¾ûL=şÌ?_L¿êOğøûÜ¨¾Ïº¿\Œª2T»¼¿¹Oöc— ¿™Fe	ôhëÏNN‹‚È‘	EA4ûÇ.§ôëş$¹®ƒ»Ö³yùò½Xç~S§ªöÕÛ¿:mKŸÒ #HI‰?¹ì&6faòè3ëÜ¼º “>ıáöë¿èà›ñ{¼ŒX4æŠ”›#ÆøéIşr·£Ï^×‚óG…İ)jqÃñï7¹ã>øúü6¾\‹¾ætL[RqVx‚ÅíTvNP-¶%œù`½Î,k›Ğ¤“Ü„SJt"ufDÕ/øNº´ù>S›†ÎIJ1°ü»ş­úŒó¬(ñî+Ò¸»ÅÁ[|Èî)sœ+¦gH	KÁÈ9y•-Dæ\ û(IÑ9}­bwö8bÿúo{«Ä–ê0ÇÍ¹¹+ö¯Ïœ2ÑxK½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hXüáÙ?¼N#Ù½Øä©ÎâwÊ™lAlå“{lò;oÜCÚ©`®öÕ€%÷—‡Ò€B§VÙKm¥_ÃsûécA7µãÈ¦¨y*¨jù$%ËÄ¸ÔÃ`›—^Saq³”“Pó›©ˆ·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬/Ø¼“i´»N˜Š1LïğÛÒì­$¤y–LÑ s97ZTœ†s½#ææT½ ˆ÷Ğ{Õıù=ªıH}ª™ß@<É¶×­·æ ÏoÅŸîsñúœø–·]$£-Ø’yd£ ŸĞw®YÖA
ñ:ïÅ&³ZèfĞÁBê&°}8¾`½µN{äÁ÷Ù49+a&Ü†áW}ÍÀ[=tü”Ş/¹ûÍª~¡Ïä3¿I|Q<iI$?‡¯¹A.O*Š ¸§Uu`FGíj=ÕÔ×C,vÎLe¬ÀtêÜ3 nØëÀ—×ykê·h°ósñÖA'™+cµZšYºÏ(±Y,[šFÆ,+¢–6=öî[Â… ½<ƒ.cñ\åy´ì<–lBYÌÉILÑ+’f{8|2cú"¼Ìm)› ‚Òşb_WoÃmºGÌÏl"àÓÿï)­"dúù·Å×[fè•`ŒıZÙå1Dˆ!QkT‘’¾"v{Å$Ö8/M­šgPÖA+Og®Ø,½ÃNk+Ü™–±#Ë«Ï³îJäÿ±~¯’—Š1nóÈ0ìdV*ûo$Ú¢Á…mİF~½VI9Q¶ii2áwäaåÏïÛà”±Ôè
Ît¿?«Ü·à€õÏÍu¨aÛ£¤€½ÛX6éÔq‡»>°¿iT¨ ˆS_fŞEì(^¯àÁ~şOíÎpÎÍ„°œ‰0 Ùn×°ÎÓlÆ!æyºqZÚ  ÅÇ1ïÊÊbtXñ6û®Šf>¡5n¸™òƒ8¼UÖ`o’‡ú(£u/üİ…@=Áÿì]:Æaj7–éRûB²dÉº’W£Ô†Æı’Æê,|âc¢yy%´g®?S)ÊXkºŠË²$¶D™Ñ4ÀÊ§÷Ö¼ë(bb÷@€Ã¼¹Œ€ë¯A½ïÚõ´²õ­¬~@Ãˆ2ßÙ×ø¡EO›uªÄŒ›€ë#kP.Ùã+¤î„R\½g570èÛğ±¯¹„² @±ßØ'İ´~6[§ôaìŠÑø¦îd½\ôÙ{Õ¾ ò'ò<^aÖ¶R¶C»!9»¦‡Â9ğtò°Š]	ùUsìÔâ2Ig¸Äı@²WÊÁzÊQ{Óˆ²Ör,bt–¡ã>İC*K€‡è]'[º„Ü³.Á×øXÓ«1BTrúåuĞŞ%&µÕF€üÇâr÷/©’¹¹¢o[±°“QšyĞuTyÎÖu\™ee•ğ©£õä¬ipÿa”®ÿÚà¡ôÎ—©ÁBéÎ˜4ˆ‰•ØĞ Kü?jgÁùë¢#õ6>5Å5t
sFlÃğïc­ÒF!<g«—RÚÏ#k®0¡+Ÿè¥µÏ)$>3°iCĞLË¹|»pªîz%ø¬…œáW.#Û£‡ç­	ÒK’j×IW!_?…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?¬gÁ#Î¦´ÅblÀà§Öip{ÂjJßsøC~ğçµóÓ2œg)™,ë•ßšİÔ£xODş³µF€¡ºö-=jµØá¥vuİ¥0„êX¦÷xlÍB7Vkk9ÈèZAŸºV‡Ëîä§¤‰HŒÌ”2ãnútÊ#åÅÆÆl©¢†yYwîvõhqyö_ı†-F~]ƒóÚÔT{¼É—lÍvÚzºx°ÛÄµ­œ‚ÜM¶qs+ èŸö×¸`!aS›ÉVŸ˜›Y¹wëTBÙÅ*9ìêµğYë‰¼©rß#0¡¯C0¹oÌj\P”ÃÖ‡(æu>¿çÔsèÛ&åÉTqKe¿JÌY\hòÂ*É'²c‹v)@n'³V.bb/V{…³1wË©T³‡ª]l¶Ax1…¼oó³2xˆdX²ÁÁX¯&5]c‚%\Tîb­B6«X…nÆ²hA"	fi-	%ı„}/Îä˜T”°0‡Şò"	fæq€ğßkì½÷şï¿Ê§ğëğõÿo³»ÌÄ£<öÏÙ>şÏúÛ¿ê¼ÁO÷
uø³<ENÊCˆÈÙ$@ûºú7ş¶9¿®M³ÿş„²û
ğú­{®^s*3BnËì
Ì4µo_‚	RH @C:y*İ&"fšq·óÌ¸ªm[š8‹ö‚ı´¸ø‹!Õ ?8¸š®´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!˜«øû[ıÀ~ ¢™Æôm8£ğ^H—µ-~Ò(ÎÂeHuù`9“aª›’“"“N"•§ƒågà˜œŸN.OÛ˜°Úü¼¹ú =øÄÛë4ğøã½ºÌòL´èŠ©s¨ª‡÷½H¼IK‹Û8¥9òM³9Ñ1}-œëw_U¼ü?‹ûŒ¤ê {ëù@™ÍÆ[ïİ€™8“©F>{
×Ùl ¹« œƒØ&¶d8¨	z<ôÍ|®=cæK>˜³ÀÅ«i„’­zÉl¥dW’lÈ2{GíŞ’d†“×!_¢p}A‚Ö	'4{h‹C1î™kÁ/´§Ü¶)IKÏ°g$Ú$¬ğÓpŸ•ßak—–¡“ê>ç¿Û>½:ø»ÔKK7©Yí0ù9İ)f›\	ñ©ûåÎşOôûÉ4­G¨ƒx‹Å0‰[Şl¨$”H–x‹
ÒR2LÈĞ%6%"dÆ$µ0HúBÕô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîq·®ÿótz¼ü†uõC£††İ6Œ›‹”¨‚Ô%â%Ø\…š(ìñz2{kAÓØ£«8ù¯÷JÊ•šÂ~ãò6M2)¸t`W§áE÷Œİú%è\°ª)_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎN«^˜“ÕM Òízº–İG„­vÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø3kà69#±)Sáœ¼g—«—˜­Y%mjV<Í.¢ Ôp<S®SUÆ,;¶™«­$,q3Tír|ÊPŠÇce¹#r&*ıhÁñgàûR<N,#¹ÒqZO‡wºG|Å+˜Q¤ãõî1{¥
àvòPÁ[ôëöhÕµØòËuX¥5dĞc!ÊKÒÈAcÑ.¢¦YÇ”<ÆB)>o˜cĞÔNµäø¬¬bnr
œ¾æP2÷ëç2ŠFÊûñø»^“º1L¢‹+(l÷j;z}ä’Ğ¤BOc9¥]N÷\x2))ÒSPWšÌŸYZ± ›æŒª‡>p×‹ŸÔ¡êëßÉg¬p°[›ä ¹NØ·é9~ƒŸ®„»‹CE¨ EÛ¿áñEH@õÏ"…‡ßç¡Tà(ÏZë°–—Ôºá6RªÍ'yïÓÑ £#FyÍŠsTß¦ ËÔål€’`-8ñk´ü&;²¥ë—½V	‹<—MCÑfE‰Ú¢uİ%ÊüÅ–*¦¶5-8\áâ3iSà9·äŒÓt*ØÕŒÄj­èp&Y1´(ï.±jˆÎ+—‚Ùê¥´bˆ4™8Õ»ÊáÇåç)"pFREÏ¶«x+¿„çİùàúĞ²=tí‚‘–ËÕØqG›€TR–Ï¢¯ÃÑ’/Ëé  !² ô÷Ü‰¦	U1èê“1­»Íª”°ó®¯Şô»4[§ÁÅOSÚ#$æG¿ˆäxÕ õ'ù-}Œ\c’Q6C¹*;/ŒßâìvãÚ
õ…[íY³fBeÔæ£?—Š‰nÎòKÓ’"sŞwº"tßX©-G°pÌ
©-•Mp=”|ûB—°‘Â€¢Ë't|xùüÛaApTe œ…ê³öSù½'^	²²	‘yÀ fxL˜vØÁmaĞq2›çÆ¨ë‚RlG¿”~Û¯àÌ¸›¼~&CZì3Š¼ª•QÅüî2:ê_…S¯æ3vGÔosâj
0ìãÂªc”UÈ!4çFÙŞ#è¦0êÎÀ„şÅ8Lâ¿¶ijR@À¹N-ºr[ ”ì˜…¨”gÂ—+ƒG1mBKŒ˜eU‰]=„/œ¢ì6U¹`¡7t§‘tUÀúgtan¦ËlÑ'î¦"í*, â-ş!û#3öJKy2ş‘' ï•óùo+•œ(0*ë‡ÙÔƒ	‡ßÛ¦<·a±v=
YªØã%ö&|­2¡ëŞŒ¢KQ½äC2îK’Ğ“éZ±j½P½£Ûœ¤÷ ÌÜî– ƒ§üÔÔO~7¥C„ÊËƒa†?U¾†w%-Û¥Jû~3$}9ot[¾rÚQTËÂ€Ä‘ìò»‹pPÿğ¤ÉÌ„|¤(”v–uÙ+„èÖuÛg}’±w»õŸ€ƒÿQ/ëş0é5Î«4`¸ºñikˆŞ©“{qã9ãa¹ÊL2zUîg¢®%¨âu™çÁ È4¬¨4°˜·¶ô
ÁYnÅ,’'¿[,Q¶s‚^ A)-§–EfÈ2.Vg¡;Ş©h‰o³ÇŠ)|øqY?D»±7Ïö(ŠEXÖ„avşÖ U§ÅÎ Ì‚t|ƒ…Ê,Í¤Lí"IX% ñ$$Ïî›´Ó“ÛÆ "z.UŸ@ğ¾ûL=şÌ?_L½êOğøûÜ¨¾Ïº¿\Œ«6T»¼¿ùOöc— ¿™NeIôhé•ÎNN‹ƒÈ‘	EA0ûÇ.§ôûş$¹®Ã»Ö³yùòµ\çnS§ªöÕÚ¿:¾mKŸÒ #H6É‰?¹ì§6faòè7ë\¼º Ó>ıáöë¿hà›ñ{´ŒH4äŠ›#ÆøéIşv·£Ï^®÷‚óG…İ)jqÃñïZ7¹ã¾øz^ü6¾\‹¾æ|L[RqVx‚ÅéTvNP%¶%œù`½Î,kĞ¤“Ü†SJt"ufDÕ/øNº´ù>S›†ÎIJ1°ü»ş­úŒó¬(ñî+Ò¸»Åá[|Hî)sœ+¦gI	KÁˆ8y•-Dæ\ û(IÑ9}­bwö9bÿúo{«Ä†ê0ÅÍ±¹+ö¯ÏÜ2ÑxK½H"EJkˆ—“b&3¹ò‹Ó¦½Àø‘hXüáÉ>¼N#Ù½Úä©ÎâwÊ™lAlåÓ{lò;ÜCÚ©‚`®öÕ€%×—‡Ò€@§VYKl¥_ÃsûécA®7µãÈ¦¨y*¨bù$!ËÄ¸ÔÃ`›—\Scq·”“Ğs›©€·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼“i´»N˜Š1LïñÛÒì­$¤y–LÑ sy7ZT†s½#ææT½ˆ÷Ğ{Õıù=¨ıH}ª™ß ¼É¶	×­·æ ÏoÇŸîsñúœø–·]$£/Ø’yd£ Ğ÷¦YÖAñ:¹ïÅ&£ZèfĞÁRê&°}8®`½•N{äÁ×Ù49+a&œ†áW}ÍÀK=|ü”Ş/¹{Mª~¡Ïäc¿I|Q<iI%?‡¯¹C.O"Š ¸§Uu`FGíj=ÕÖ×C,vÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†ÖA'™+cµZšYºÏ(±Y,[šFÆ,+¢–v=öî[Â… ½<ƒ.có\åy´ì<–lBYÈÉALñ+’æ{8|2cú"¼Lm)› ŠVşb_oÃMºÇÌÏl"àÓÿï)­‚dúù·…×Ûfà• ¯ıXÙå1DÈ!QkT‘’¾"v{Å¤Ö8/M­’eĞÖA+Kg¬Ø,½ÃÎc+Ì™–‘"Ë«Ï³îHäÿ±~¯’“ª1nóÀ0ìdV(ûo$Ú¢Á‡mİFz½ VI9Q¶ii2áTwäaeÏïÛà”¹Ôè
Ît¿?Ëœ·àÀõÏÍu¨aÛ¡¤€½ÛX7iÔqƒ»>°¿iU¨ ˆS_fúEì(Ş¯àA~şÏÍYÎpÎÍ„°œ‰0 Ùn×°ÎÓlÆ!æiºqXš ¨ÅÇ1ïÊÊbtXñ6û¾š‹f>¡5n¸™ò8½UÒ`o’‡ú(£u/øİ…@=Áÿì]*Äaj7–éRûB²dÉº’W£Ô†Îí’Æê,xâc²yy%´g®7S)ÊXkºŠ€Ë²$´D™•Ñ4ÀÊ§çÖ¼ë(bb÷@€Ã¼¹Œ€ë¯A½ïÚõ´²õ­¬z@Ãˆ2ßÙ×øEO›uªDŒÛ€ë£kP.Ùã+¤î„R\½g570èÛñ±«¹„º @¹ßØ'Ü´~6[§ôaìŠÑø&îd½\ôÙkÕ¾ ò'ò<^aÖ¶R·C»!9»¦‡Â9ğtò°Š]
ùUsìTâ2Ig¸Äı@rWÊÁzËQ{Ó‰²×r,bd–¡ã>İG*K€‡è]'[º„Ü³.Q×øXÓ«1BTzúåuĞŞ%&µÕF€üÇâr÷#©’¹¹¢O[±°“QšyĞu’TyÌÔu\™ee•ğ©£÷ä¬ipÿa–®ÿÚà¡ôŞ—©ÁBéÊ˜4ˆ•ØĞ Kş#?jgÁùë¢#õ¶?4Å5t
sFìÃğïc­ÒF!<g«—RÚÎ#k®0á+à¡µÏ)$>3°iCĞLË¹|»pªî:%ø¬…œáV.#Û£‡ç­	ÒK’h×IW!_?…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?¬OÁ#Î¦´ÅblÀğ§Öip;ÂjJŸsøc~ğïµóÓ2œe)™,ë•ßšİÔ£xODş³•F ¡ºö-=jµØá¥vuİ¥0„êX¦÷xlÍB3Vkk9È–èZA¿:V‡Ëîä§¤HŒÜ”2ãnútÊ#åÅÄÆl©¢†}]wîvõhqxö^ı†-D~]ƒóÚÔT{ ¼ŸÉ—lÍvÚzºx°ÛÄ´­œ‚ÜM¾qs+ èó×¸`%iS›ÉVŸ˜›X½wëPBÙå*9äê·ğYë‰¼©r×#0¡¯C0¹gÌjÜP”ÃÖ(æu>¿çÔsèÛ&åÁTqke¿JÌY\hòÂ*É'²cƒv)@n'³V.bb>V{…³1wË©ÈT³‡ª]h¶Ax1…½oó³2xˆdX²ÁÁX§&5]c‚%\Tîb­B6«X…nÆºhA"	fi-	%ı„}/Î$˜T”°0‡Şò"	fæq€ğßkì½÷şï¿Ê§ğûğõÿ/³»ÌÄ£<öÏÙ>ìÏúÛ¿ê¼ÁO÷
uø³<ENÊCˆÈ™$@ûºúşö=¿®M³ÿş„²û
ğú­{®^s*3B~ËíÌ4µo_‚	RH @C	:i*İ&"fšq·óÌ¸ªm[’8‹ö‚ı´½ø‹!Õ ?8¸šŸ¬´¸¸™ãUR\úEíë0¾‹Ê‚ç ¹×éÏhú{¶î
!¸«ğû[ıÀ>(¢™Æôm8£ğVX—µ-~Ò ÎÂeHuù`9“aª›’“"“N*•§ƒåGğ˜œŸN.OÛ˜°Úü¼¹ú =xÄÛë6ğøã½ºÌòL´èŠ!s¨ª‡÷½H¼IK‹Û8¥9òM³9Ñ1}-œëw–_U¼ü?‹ûŒ¤ê {ëù@™ÍÆ{ïÜ€™8“©F>{
×Ùl ¹« ŒƒØ&¶d8¨	~<ôÍ|®=cæK:˜³ÀÅ«i„’­zlÉl¥dW’lÈ2;GíŞd†“×¡!‚p}A‚Ö	'4{h‹C1î™kÃ/´§Ü¶)IKÏ²g$Ú$¨ğÓpŸ•ß‘ak—–¡“êç¿Û>½:ø»ÔKK7©Yí0ù8Õ)b›\	á©ûåÎşOôûË4­G¨ƒx‹Å0‰[Şl¨$”ŒH–x
ÒR2LÈĞ%6%"dÆ$µ0HúBÑô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîñ·®ÿótz¼ü†}õC#††İ6Œ›‹”¨‚Ô%â%Ø\…š(ìñz²{kAÓØ£«8ù¯×JÊ•šÂ~ã°&M2)¸t`×¯áE÷Œİú%í\°ª)_Uª}@Şç¿÷Hè\E6pG¡<…¿3CÎN«^˜“ÕM Ò“íz?ºİG„ívÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø3kà69#±)Sá½g—ë·˜­Y%mjV<Í.¢š Ôp<S®SUÆ,;¶™«­$,q3Tír|ÊPŠÇce©#r&jılÁùgäûR<N,#©ÒsZG‡wºG|Å+˜Q¤ãõî1{¥àvòPÁ[ôëÖèÕµØòËuXZ¥5dĞc!ÈKÒHAcÑ>¢¦YÏ”<ÆB)?o˜gĞ–Nµäø¬¬bnr
œ¾æP2ÿãç2ŠFÂûñø»^“º1Lâ‹+(l÷j+zyä’Ğ¤BOc9¥]N÷\x2))ÒSPWš(ÌŸ]Ú± ›æŒª‡	<t×‹ŸÔ¡êëßÉe¬q°[›ä ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡ßç¡Tà(ÏZë°–—Ôºá6RªÍ'xïÓó £FyÍŠsTß¦ ËÔåL€’`-xñi´Ü&;²¥ë—½T	‹<—GoCÑfE‰Ú"uİ%ÊüÄ–*¦¶5-8\áâ#iSĞ)·äŒÓ|*ØÕŒÄz½ép&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4™8Õ»Èáçåç)"pFREÏ¶«x+¿„ç]¹ÀúĞ²=tí‚‘–ËÕÙqG€TR–Ï¢¯ÃÑ’/Ëé  !² ô÷Ü‹¦	U1èê“9©»Íª”°óŞ®¯ßô;4§ÁÅOSÚ#$æG¿ˆäxÕ ô'ù=}¬|C’Q6C¹*;/ŒßâìvãÚ
õ…[íY³fBeÔæ£?·Š‰nÎòKÓ’"SŞwº"tßX©-GpÌ
©-•Mq=”|ûB‡°‘Ò€¢K't|xùüÓ!I0Te È•ê3öSù½'^	²²R	‘yÀ"fxLœvÙÁmaĞp²›çÄ¨ëRlG¿”~Û¯à‹Ô¸›<~&SZì3Š½¨•QÅüî2:ª_…S¯æ3vGÔOsâj0ìãÂºc–UÌ!4çFYŞ"è¦0êÎÀ„~Å8Lâ¿¶kjR@À¹N-ºrK ”ì˜…¨”gÂ—)ƒG1mBKŒ˜eU‰]=„¯œ¢ì6U¹`¡7v§‘tUÀúgtaî¦ËlÑ'î¦"í*, â-ş!û#3öJKy2ü‘'(ïóùo+•œ(0"ë‡Ùtƒ	‡İÛ6<·c±v?
YªØã%ö&|­2¡ëŞŒ¢Ñ½äC2îK’Ğ“éX±k½P½ƒÓœ¤÷ ÌÜî–‹ ƒ§üôÔ_~7¥C„ÊËƒA†?U¾†w¥-Û¥Zó~3}¹otS¾rÚQTËÂ€Ä‘Ìò»ŠpPÿ°¤ÛÌ„|€(”v–uÙ+„èÔuÛg}’±w»õŸ€“ÿQ¯ëş0é5Î«4`¸ºñik‰Ş©“{qã9ãa¹ÊD2:Uîg¢®%#¨âu™çÁ È4¬¨<²˜·¶ô
ÇYnÅ,’'¿[,Q¶s‚^ A)-§–EfÀ2.Vg¡;Ş©h‰o³ÇŠ)|úqY?D»±7Ïö(ŠEXÖ„atşÖ U§ÅÎ Ì‚tlƒ…Ê,Å¥Lí"IY% ñ$&Ïî›´€Ó“ÛÆ "z.UŸ@ğ¾ûL=şÌ?_L¿êOğøûÜ¨¾Îº¿\«6T»<¿¹Oöc— ¿™Ne	ôhïÏNN‹‚È‘	EA0ûÇ.§õ{ş$¹Ã»Ö³yùòµ\ç~S§ªöÕÚ¿:¾mKŸÒ #HI‰?¹ì66faòè3ëÜ<º Ó>ıáöë?hà›ñ{¼ŒX4äŠš#ÆøéIşv·£Ï^®÷‚óGİ)jqÃñïš7¹ã>øú^ü6¾\‹¾ætL[RqVxÅíTöNP%¶%œù`½Î$k›Ğ¤“Ü†SJt"ufDÕ/øNº´ù>ZS›†ÎIJ1°ü»ş
­úŒó¬ñî+Ò¸»Åá[|Èî)sœ+¦gI	IÁˆ8y•-Dæ\ û(IÑ9}­bwö9bÿúo{«Ä–ê0ÇÍ¹¹+ò¯Ïœ2ÑxC½HEJkˆ—“b&³¹ò‹Ó¦½Àø‘hXöáÙ>¼N#ÛıØä©Æâwê™lAlå“{mò;iÜCÚ©‚`®öÕ€%÷—‡Ò€B§VYKl¥_ÃsûécA7µãÈ¦¨y*¨bù$%ËÄ¸ÔÃ`›—^Saq·”“Ts›©€·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼“i´»N˜Š1LïğÛÒì­ ¤y–LÑ s97ZTœ†s½#ææT½ ˆ÷Ğ{Õıù=ªı	H}ª™ß`¼É¶×­·æ ÎoÇŸîsóúœø–·]$;£-Ø’yd£ _Ğ÷¦YÖA™
ñº9ïÅ&³ZèfĞÁRê&°}¨¾`½µN{äÁ·Ù49+q&Ü†áW}ÍÀ[=tü”Ş/¹{Íª~¡Ïä3¿I|Q<iI$?‡¯¹C.K*Š ¸§Uu`FW­ j=ÕÔ×C,vÎle¬ÀtêØ3 nÜëÀ—×ykê·h°ósñ†ÖVA'™+cµZšYºÏ(±Y,[šFÆ,+¢–v=öî{Â… ½<ƒ.cû\åx´ì<–lBYÈÉILÑ«‚f{<|0cú&¼Œm)› ŠÒşâ_oÃEºGÌÏl"àÓÿï)2­dúù·Å×Ûfè• ¯ŒıXÙå1Lˆ!QkT‘’¾"‡v{Å$Ö8/M­’gĞÖ
A+Og¬Ø,½ÃNk+Ü™–‘"Ë«Ï³îJäÿ±^¯’“ŠqnóÈ0ìdV(ûo$Ú¢Á‡mÜFz½ VI=Q¶ii"áwäaåÏïÛà”¹Ôè
Ît¿?Ëœ·àõÏÍ5¨aÛ£¤€½ûX7éÔqƒ»>°¿iT¨ ˆS_gŞEì(Ş¯àÁ~şÏíYÎpÎÍ„°œ‰0 Õn×°ÎÓlÆ!æyºqXÚ ¨ÅÇ1ïÊÊbtXñ7û¾šŠf>¡5n¨™ò8½UÒ`o’‡ú(£u/øİ…@=Áÿì]:Âaj7–áRûB²dÉº’W£Ô†Æı’Æê,|âc²yy%´e®7S)ÂXkºŠË²$¶D™Ñ4ÀÊ§÷Ö¼«(bb÷@€Ã¼¹Œ€é/A½ïÚõ´°õ­¼z@Ãˆ²ßÙ×ø¡O›uªDŒ›€ë#kP.Ùã+¤î„R\½g5?0èÛñ±©¹„º @±ßÈ'Ü´~6[¯ôa¬ŠÑø¦êd½\ôÙ{Õ¾ ò'ò<^aŞ·R·C»a9³¦‡Â9ğtò°Š]	ùUsìÔâ2Ig¸Äÿ@²WÊÁzÊQ{Óˆ²×r,bt–¡ç>İG*K€‡è]'[º„Ü³*Q×øXÓ«1BTzúåuĞŞ%&¥ÕF„üÇâr÷#©’¹¹¢O[±°“QšyĞu’TyÌÖu\™ee…ğ©£÷äìi2ÿa–®ÿÛà¡ôÎ—©ÁBéÊ˜4ˆ‰•ØĞ Kş#?jGÁùë¢#õ6>4Å5t
sFìÃğ¯c­ÒF!gª—RÚÏ#k®0¡+Ÿà¥¥Ï)$>3°yCĞLË¹|»pªîz%ø¼…œáW.#Û£ÇÇ­	ÒK’h×IW!_…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?¬oÁ#Î¦´ÅblÀà§Öip{ÂjJßsøC~àïµóÓ2œe)™,ë•ÛšİÔ·xODŞ³F€¡ºö-=jµØá¥vuİ¥0„êX¦
÷XlÍB3Vkk9ÈèZA¿ºV‡Ëîä§¤HŒÌ”2ãnø,6Ê#åÅÄÆ|©¢†}]wîvõhqxö^ı†-N~]ƒóÚÔT{ ¼ŸÉ—lİvÚzºx°›Ä´©œ‚ÜM¶qs+ è÷×¸`%aS›ÉVŸ˜›Y¹wëTBÙå*9ìê·ğYë‰¼©r×#0!Ã0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&õÉTqKe¿JÌY\hòÂ*Ë'²c‹v)@n'³V.bb/V{…³1wË©T³‡º]i¶Ax1…¼oó³2xˆdX²ÁÁX'&5]c‚%\nb­B6«X…nÆ²hA"fi-	%ıÄm/Îd˜T”°1‡Şò"	fæq€ğßkì½÷şï¿Ê§ğûğõÿ/³»ÌÄ£<öOÙ>üÏúÛ¿ê¼ÁO÷
õø³<ENÊCˆÈ™$Hûºú7ÿæ=¿®M³ÿş„²û
ğú­{®^s*3B~Ëì
Ì4µo_‚	RH @Ã:y*İ&"fšá·óÌ¸ªmSš8‹ö‚ı´½ø‹!Õ ?8¸šŸ®´¸¸™ãUR\úEíãp¿‹ŒÊÂç ¹×éÏhú[¶î
!¸«Ğû[ıÀ>(¢™Æôo8£ğ^X—µ-vĞ(ÎÂeHuù`9“aª›’“"“N"•§ƒÅGğ˜œŸN,OÛ˜¸Úü¼¹ú =øÄÛË0ğøã½ºÌòL´èŠ)s¨ª‡÷½H¼IK‹Û8¥²M³9Ñ1}-¼ëw–_U¼ü?‹ûŒ¤ê {ëé@™ÍÆ{îÜ€™8“©F>;Š×Ùn ¹« ŒƒØ'¶d8¨	zôÍü®=cçK>˜³KÀÇ«i„’­zLÉl¥LW’lÈ2;GíŞ’$†“×!_¢p}A‚Ö	%4{h‹C1î™kÁ/´§Ü¶)IKÏ´g$Ú$¨ğÓpŸ•ß‘ak—–!¡“êç¿Û>½:ø»+ÔKK7©Yí0ù8İ)&›\	á©ûåÎşOôûÉ4Gªƒx‹Å0‰[Şl¨$”ŒH–p‹
 ÂR2LˆĞ%6%"dÆ µ0úBÕô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîñ·®ÿótz¼ü}õC£††İvŒ›‹”˜¨‚Ô%â%Ø\…š(ìñz2{kAÓØ£ë8ù¯÷JÊ•šJ~ã°6M²)¸t`×§áE÷Œİú%è\°¨)_Uª}@Şç¿÷Hè\E6p	G <…¿3CÎN«^“ÅM Òíz?»İG„vÂDM‰ş2düØ‚`KpÉöæiØâäÏ•ˆø3kà69±)Sá½g—ë—˜­Y%mjV<Í.¢@Ôp8S®SUÆ,;¶™«í$$q3Tír|ÊPŠÇge¹#ò&*ıhÁùgäûR<N.#¹ÒsZW‡wºG|Å+˜Q¤ãõî{¥
àvòPÁ[ôëöhÕµÜòËuX§5dĞc!ÊKÒH@cÑ>¢¦YÏ”<ÆB)>o˜gĞÔNµäø¬¬bnr
œæTP2÷«§2ŠFÊÿñø»^“º1Lâ‹+(l÷j;:yä’Ğ¤BOc9¥]N÷\x2))ÒSPWš(ÌŸYû± ›æŒª‡	>p×‹ŸÔ¡êëßÉg¬q°[›ä 9NØ·é9~ƒŸ®„»‹CE¨ EÛ¿añEH@õÏ"…‡Ïç¡à(ÏZë°–—Ôºá6RªÍ'yïÓÓ ƒ#FyÍŠsTß¦ ËÔål€’`-8ñi´Ü&;²¥ê—½V	‹<—MoCÁfE‰Ú¢uİ%ÊüÄ–*¦¶5-8|áâ3iSà9·äŒÓt*ØÕŒÄj½èp&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4›8Õ»ÈáÇåç)"pFREÍ¶«Fx+¿„ãİùàúĞ²=té‚‘–ËÕØqGŸ€TR–Ï¢¯ÃÙ’/Ëé  !² ô†÷Ü‰¦	U1èê“1©»åª”°óŞ®¯Şô;4§ÁÅÏWÚ!$æG¿ˆä½xÕ õ'ù=}Œ\c’Q6C¹*;/Œßâì~ãÚ
õ…[íY³fJeÔæ£?—Š‰nÎòËÓ’"SŞwº"tßX)-GpÌ*©-•Mq=–|{B—°‘Ò€¢I't|xùüÛ1ApTe Œ…ê3öSù½'Z	²²	‘yÀ fxL˜vØÁmaĞp2›§Ä¨ëRlG¿”^Û¯àÔ¸›¼~&CZì3Š½¨•QÅ#üî2ª_…S¯æsvGÔosâj0ìãÊºc”UÈ!4çFÙŞ#è¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[ ”ì˜…¨”gÂ—)ƒG1mBKŒ˜eU©]=„/¢ì6U¹`!7v§‘tUÀúgtaî¦ËlÑ'î¦bí*$ â-ş!û#3öJKy2ü‘' ï•óùo+•œ(0*ë‡Ùtƒ	‡İÛ¦<·a±v?ŠYªØã%ö&x½2¡ëŞŒ¢ÑôC2îK’Ğ“éX±j½T½ƒÛœ¤÷ ÜÜî–
 ƒ£üôÔ_~3§C„ÊË£a†?U¾†w¥-Û¥Zó~3}¹otS¾rÚQTËÂ€Ä‘ìò»ŠxP÷ğ¤ÛÌ„|„(”v–uÙ+„èÖ5Ûg}’±w»õŸ€“ÿQ/ëş0í5Î«4`¸ºñik‰ş©“{qã;ãa½ÊL2zTîg¢®%#¨âu™çÁ È4¬¨4²˜·¶ô
ÅYnÅ,’'¿[,Q¶sƒ^ A)-§–EfÈ2.Rg¡;Ş©h‰o³ÇŠ)|øqY ?D»±7Ïö(ŠEXÖ„atşÖ W§ÅÎ Ì‚t|ƒ…Ê,Å¤Lí"IQ% ñ$&Ïî»´Ó“ÛÆ "z.uŸ@ğ¾ûİL9şÌ?_L½êOğøûÜ¨¾Îº¿\Œ«6T»<¿¸Oöc— ¿™Ne	ôhëÏNN‹‚È‘	EA0ûÇ.·ôÿş$¹®Ã»Ş³yùòµ\ç~S§ªöÕÚ¿:¾mKŸ’ #HI‰¹ì&6fa.òh3ëÜ¼º Ó>ıáöë¿èà›ñ{¼ŒX4dŠ›#ÆøéIşr·#Ï^®ó‚óG…İ)jqÓñï5¹ã>øú^ü6¾\‹¾ætL[RqVx‚ÅíTvNP%¶%œù`½Î,kĞ¤“Ü†SJt"ufDÕ/øNº´ù6S›†ÎIJ1°ü»ş­úŒó¬(ñî+Ò¸»Åá[|Èî)sœ+¦gH	KÁˆ8y•,Dâ\ û(IÑ9=­bwö9bÿúo{«Å–ê0ÇÍ¹¹/ö¯Ïœ2Ñ8[½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hXôáÉ>¼N#Û½X¤©ÎâwÊ™lQlå“{lò;oÜCÚ©‚`®öÕ€'÷—‡Ò€B§VY[l¥_ÃsûécA7µãÈ¦¨y*¨bù$'ËÄ¸ÔÃ`›—\Saq·”“Ps›©ˆ·û}Ûõîz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼“I´»Î˜Š1LïğÛÂì­$¤y–LÑ s97ZTœ†s½#ææT½ˆ÷Ğ{Õıù=¨ı	Hmª™ß`<É¶×­·æ ÎoÇŸîsñúœø–·]$£-NØ’yd£ Ğw¦YÖA™
ñ:™ïÅ&£ZèfĞÁBê&°}(¾`½µN{äÁ÷Ù4)+q&Ü†áW}ÍÀ[=tü”Ş/¹ûÍª~¡Ïä3¿I|Q<iI%/‡¯¹C.K"Š ¸§Uu`FWíjÕÔ×C,vÎle¼ĞtêØ3 nØëÀ—×ykê·h°ósñ†ÖA'™+cµZšYºÏ(±Y,[šFÆ.+¢–v=öî[Â… ¿<ƒ.có\åy´ì<–lBYÈÉILÑ+’æ{8|2cú"¼Ìm)› ‚Òşâ_WoÃEºGÌÏl"àÓÿï)­dúù7Å×Ûgà• ¯ÌıXÙå1DÈ!QkT‘’¾#v{Å¤Ö8/M­’gĞÖA*Og¬Ø,½ÃNk+Ì™–‘#Ë«Í³îJäÿ±~¯’“ª1nóÀ0ìdV(ûo$Û¢Á‡mİFz½ VI9Qöii"áwäaeÏïÛà”¹ôè
Ît¿?Ëœ·àõÏÍq¨aÛ£¤€½ûX7éÔqƒ»> ´¿iD¨ ˆS_fŞEì(Ş¯àÁ~şÏí™ÎpÎÍ†°œ‰0 İn×°ÎÓlÆ#æiºaXš  ÅÇ1ïÊÊ™btXñ7û¾šŠf>¡5n¨™òƒ8½UÒ`o’‡úh£u/øİ…@=Áÿì]*Äaj7–éRûB²dÉº’W£Ô†Æı’Æê,|âb²yy%´g®7S)ÊXkºŠË²$¶D™‘4ÀÊ§÷Öœ«(bb÷@€Ã´¹Œ€é¯A½ïÚõ´²õ­¬z@Ãˆ²ßÙ×øEO›uªDŒ›€ë£kP.Ùã=k¤î†R\½g570èÛğ±«™„º @¹ßØ'Ü´~6[çtaìŠÑø&îd½\ôÙ{Õ¾ ò'ò<^aŞ¶R·»!9»¦‡Â9ğtò°Š]	éUsìÔâ2Ig¸ÄÿÄ²WÊÁzÈQ{Óˆ²×r,bt–¡ç>İG*K€ƒè]'[º„Ü³.Q×øXÓ«BT{úåuĞŞ%&¥ÕF€üÇâr÷#©’±¹¢O[±°“QšyĞõ’TyÌÖu\™ee•ğ©£õä¬ipÿa–®¿Ûà¡ôÎ—©ÁBéÊ˜4ˆ‰•ØĞ Kş#?jgÁùë¢#õ¶?4Å5t
sFìÃğïc­’F!<gª—RÚÏ#k®0¡+Ÿè¥¥Ï)&>3°iCĞLË¹|»pªîz%ø¼…ˆœáV.#ë³ÇÇ­	ÒK’h×IW!_…'¼æş3±éhà¨w¦“eoÈú­àáÌ.?¬oÁ#Î¦´ÅbLÀà§Öip;ÂjJßsøC~àïõóÓ2œg)™,ë•ÛšİÔ£xOÄş³•F ¡ºö-=jµØá¥vuİ”¥0„êX¦
÷xlÍB3Vkk9ÈèZAŸºV‡Ëîä§¤HŒÎ”2ãnúvÊ#åÅÆÆ|«¢†]Ywîvõ`qxö^ı†-Nş]ƒóÚÔT{ ¼ŸÉ—lİvÚzºx°ÛÄµ­œ‚ÜM¾qs+àèŸó×¸`%iS›ÉVŸ˜›Y¹wëPBÙå*9äêµğYë‰¼©r×#0¡¯C0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&åÉTqKe¿JÌY\hòÂ*Ë'²c‹v9@f'³V.bb/V{³1wË©JT³‡ª]h¶Ax1‡¼oó³2xˆdX²AÁX§&4]c‚%\Tîb­B6«X…nÆ²hA"	fi-	%ı„}/Îd˜T”°0‡Şò"	fæq€ğßk•ì½÷şï¿Ê§ğûòõÿ/³»ÌÄ£<æÏÙ>üÏúÛ¯ê¼ÁOÿ
uø³<UNÊCˆÈ™d@ûºúşoÖ=¿®M³ÿş„²û
ğú­{®^S*3B~ËìÌ4µo_‚	RH @C:y*İ&"fšá·óÌ¸ªmSš8Šö‚ı´½ø‹!Õ ?8¸šŸ¬´¸¸™£UR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øû[ıÀ>(¢™Æôm8£ğ^X—µ-~Ò ÎÂeHuù`9ƒLaªÛ’‘“"“N"•§ƒåGğ˜œŸN.OÛ˜¸Úü¼¹û =øÄÙë4ğøã½ºÌòL´èŠ)s¨ª‡ç½H¼IK‹Û8¥9²M³8Ñ1}-œëw–_U¼ü?‰ûŒ¤ê {ëù@™ÍÆ{ïÜ€™8“©F>{
×Ù~, ¹« ŒƒØ&¶d8¨	z<ğÍü®=cæK>˜³KÀÇ«i„š­zLÉl¥dW’lÈ2;GíŞd†—×¡!_‚pyAÖ	%4{h‹C1î™kÁ/´§Ü¶)IKÏ°g$Ú$¨ğÓpŸ•ß‘ak–¡“êHç¿Û>½:ø»ÔKK7©Yí0ù8İ)f›\	á©ûåÎşOôûÉ4­G¨ƒx‹Å0‰[Şl¨$”ŒH–x‹
ÒR2LÀĞ%6%"dÆ µ0ú‰BÕô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîñ·®ÿótz¼ü†}õC£¦†İ6Œ›‹”¨‚Ô%â%Ø\…š(ìñz2{kAÓØ£ë8ù¯÷JÊ•šB~áğ6M²)¸t`W§áE÷Œİú%ì\°ª)_Uª}@Şç¿÷Hè\E6pG¡<…¿3CÎN«^˜“ÕM Òíz?»–İO…­vÂFM‰ş2düØ‚aKpÉöæiØ¢äÏ•ˆø3kà69'±)Óá½g—ë—˜­Y%mjV<Í.¢ Ôp<S®SUÆl;¶™«­$,q3Tír|ÊPŠÇce¹#ò&*ıhÁùgäûR<N,#©ÒqZO‡wºG|Å+˜Q¤ãõî1{¥
àvóTÁ[ôëöhÕµØòËuX¥5dĞc)ÊKÒHAcÑ.¢¦YÇ”¼ÎB)¿o˜gĞÖNµäø¬¬bnr
œ¾ÆP2÷ë§2ŠFÊûñø»^“¾±Lâ‹+(l÷nz}æ’À¤BOc9¥]N÷\x2))ÖSP_š(ÌŸYÚ± ›æŒª‡>p×‹ŸÔ¡êëß‰g¬q°[›ä ¹NØ·é9~ƒŸ®„»‹cE¨ …EÛ¿aóEH@õÏ"…‡Ûç¡Tà(ÏZë°–—Ôºá6ÒªÍ'xïÓÓ £#FyÍŠsTß¦ ËÔåh€’`-8ñk´ü&;²¥ë—½V	‹<—MoCÑfE‰Ú¢uİ%ÊüÄ¶*¦¶5-8\ãâ3iSà9·äŒÓt*ØÕŒÄj­\èp&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4›8Õ»ÈáÇåç)"pFREÏ¶«Fx+¿„çİùàúĞ¢=té‚‘–‹ÕØqG›€TR–Ï¢¯ÃÙ’/Ëé  !² ô†÷Ô‰¦	U1èê“1©¹Íª”°óŞ®¯Şô;4§ÁÅOSÚc$æG¿ˆ¤½xÕ ô'ù=}¬\B’Q6C¹*;/ŒßâìvãÚ
õ…[íY³fBeÔæ£?—ŠÉnÎòKÓ’"SŞwº"tßX©-GpÌ
©-•Mq=”|ûB—°‘Ò€¢K't|xùüÛ!ApTe¡ì…ê3öSù½'^	²ò	‘yÀ fxL˜vØÁmaĞp2›§Ä¨ëRlG¿”~Û¯à‹Ì¸›¼~&SZì3‹½ª•QÅüî2ª_…S¯æ3vGÔosâj:0ìãÂºcUÈ!4çFÙŞ#è¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[~ „ìØ…¨”gÂ—+ƒG1mBKŒ˜eU‰]=„/¢ì6U¹`¡7v§‘tUÀúgtaî¦ËlÑ'î¦"í*,€â-Ş!û#3¶JKY2¼‘' ï•óùo+•œ(0*ë‰‡ÙÔƒ	‡İÛ¶<§c±v?
YªØã%ö&x­2¡ëŞŒ¢Ñ½ôC2îK‚Ğ’iX±kP½ƒÛœ¤ó ÜÜn–Š “§üôÔ_~7§C„ÊËƒa†?U¾†w…-Û¥Zó~;}¹otS¾rÚQTËÂ€Ä‘ìĞò»‹xPï°¤ÛÌ„|„(”v–uÙ+„èÖuÛw}’±w»	õŸ€ƒÿQ¯ëş0éµÎ«4`¨ºñik‰Ş©“{qã9ãa¹ÊD2zUæg¢®%#¨âu™çÁ È4¬¨<²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÈ2.Vg¡;Ş©h‰o³ÇŠ)|øqY?D»±3Ïö(ŠEXÖ„atşÖ U§ÅÎ Ì‚t|ƒÊ,Å¤Lí"I% ñ$$Ïî›´Ó“ÛÆ &z.WŸ@ğ¾úİL=şÌ_L¿êOğøûÜ¨¾Ïº¿\Œ«6T»¼¿¹Oöc— ¿™Ne	ôhëÏN‹‚È‘	EA2ûÇ§ôÿş$»®Ã»Ş³yùòµ\ç~S§ª	öÕÚ¿:¾mKŸÒ #HI‰?¹ì&6faòè3ë\¼² Ó<ıáöë¿hà›ñ{¼ŒX4äŠ›#ÆøéIş2·£Ï^®÷‚ñG…İ)jqÃñï7¹ã>øú^ü6¾\‹¾ætL[RqVx‚ÅíTvNP%¶%œù`½Î,k›Ğ¤“Ü†SJt"ufEÕ/øNº´ù>S›†ÎIJ1°ü»ş­úŒó¬¨ñî+Ò¸»Åà[|Èî)sœ+¦fI	KÁˆ8y•-Dæ\ û(IÑ9}­bwö9bÿúo{«Å–ê4ÇÍ¹¹+ö¯Îœ2ÑxC½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hXôáÉ>¼ N#Û½Øä©ÎâwÊ™lQlå“{lò;oÜCÚ©‚`®öÕ€%÷—‡Ò€B§VY[l¥_ÃsûécA7±âÈ¶¨y*¨bı$%ÉÄ¸ÔÃ`›—\Saq·”“Ps›©€·û}Ûõïz?­O–Ns	·¹Ém)xÙíFDU Qù¡ù¬/Ø¼“i´»N˜Š9LïğÛÂì­$¤y–LÑ s97ZDœ†s½#ææT½ ˆ÷Ğ{Õıù=¨ıH}ª™ß $¼É¶×­·æ ÏoÇ—îsñz+œø–·]$£.-Ø’yd£ ŸĞ÷¦YÖA™ñ:ïÅ&£ZèfĞÁBê¦°}(¾`½•¯N{äÁ÷Ù49+a&Ü†áW}ÍÀ[=tü”Ş/¹{ÍŠ~¡Ïäc¿I|Q<iI$?‡¯¹C.O*Š ¸§Uu`FW­j=ÕÔ×ClvÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósõ†ÖA'™+cµZšYºÏ(±Y,[šFÆ,+¢–v=öî[Â… ½<ƒ.có\åy´ä<–lBYÈÉALñ+’f{8|"cú"¼Äm-› ‚Öşb_WoÃMºGÌÏl"àÓÿï)­dúù7Å×Ûfè ¯ŒİXÙå1LÈ!QkT‘’¾"v{Å$Ö8/M­’gĞVA+Og¬Ø$½ÃNk+Ü™–‘"ËëÏ³îJäÿ±~¯’“ª1nóÀ0ìdV*ûo$Ú¢Á‡mİFz½ VIQ¶ii2áwäaeÏïÛà”¹ÔêÎt¿?ËÜ·à€õßÍu¨áÛ£¤€½ÛX7iDqƒ»>°¿iT¨ ˆS_fŞEì(Ş¯àÁ~şÏíÎpÎÍ„²œš‰0 Õn×°ÎÓlÆ!æiºqXÚ  ÅÇ1ïÊÊbtXñ6ù¾šŠf>¡5n¸™òƒ8½UÖ`o’‡ú(£u/øİ@=Áÿì]*Åaj7–éRûB²dÉº’W£ÔÆı’Æê,|âc²y}%´g®?s)ÊXkºŠË²$¶D™•Ñ4ÀÊ§÷Ö¼«(bb÷@€Ã¼¹Œ€é¯A½ïÛõ´ºõ­¬~@Ãˆ²ßÙ×ø¡EO›uªÄŒ›€ë#kP.Ùã+¤î„R\½'570èÛğ±«¹„º€@±ßØ'Ü´~6[§ôaìŠÑø§îd½\ôÙ{Õ¾ ò'Ò<^aŞ¶V·C»!9?¦‡Â9ğtò°Š]	ùUsìTâ2If¼Äÿ@³WÊÁzÊQ{Óˆ²×r,bt–¡ã>İG*k€‡è]'[º„Ü³.QÓøXÓ«BTrûåuĞŞ%&¥ÕF€üÇâr÷#©’¹¹¢O[±°“QºyĞu’TyÌÖu\™ee•ğ©£÷ä¬Ipÿa–®ÿÛà¡ôŞ—©ÁBéÊ˜6˜‰•ØĞ Kş#?jgÁùë¢#õ¶64Å5t
sFìÃğïc­ÒF!<gª—RÚÎ#k®p¡+Ÿè¥µÏ)$>3°iCĞLË¹|»pªîz%ø¬…œáV.#Û£‡ç­ÒK’j×IW!_…'¼âş3±éhà¨w¦“e/Èú­àáÌ.?¬oÁ#Î¦´ÅblÀà§Öip;ÂjJßsøc~àïµóÓ2œg)™,ë•ÛšİÔ£XODş³µF ¡ºö-=jµøá¥ve]¥0„êX¦÷xlÍB3Vkk9ÈèJAŸš^‡Ëîä§¤HŒÎ”2ãnúvÊ#åÅÄÆl©¢†}]wìvõhqxö^ı†-N~]ƒóÚÔU{ ¼ŸÉ—lİvÚzºx°ÛÄ´­œ‚ÜM¶qs+ èŸ÷×¸`%iS›ÈVŸ˜›Y¹wëPBÙå*9äê·ğYë‰¼©r×#0¡¯C0¹gÌjÜP”ÃÖ‡(æu>¿çÔsèÛ&åÉTqKe¿JÌ¯Y\hòÂ*Ë'²c‹v)@n'»V.bboV{³1wË©HT³‡º]h¶Ax1…¼kó³2xˆdY²ÁÁX§&5]c‚%\Tîb­B6«X…nÆ²hA"f)-	%ı„}/Îd˜T”°1‡Şò"	fæq€ğßëì½÷şï…¿Ê§ğûğõÿ/³»ÌÄ£<öÏÙ>üÏúÛ¿ê¼ÁO÷
õø³<ENÊKˆÈ™$Hûºúşö9¿®M³ÿş„²û
ğú{®^s*3BnËíÌ4µo_	RH @C:y*İ&"fšñ·óÌ¸ªm[š8Ëö‚ı´½ø‹!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øû_üÀ>(¢™Æüm8£ğ^X—µ->Ò(ÎÂeHuù`9“aŠÛ’“"“N*•§ƒçGğ˜œŸN.OÛ˜¸Úüœ¹ú =øÄÛë4ğøã½ºÌòL´èŠ)s¨ª‡÷½HœIK‹Û8…9²]³9Ñ1}-œëw–_U¼ü?‹ûŒ¤ê {ëù@™ÍÆ[ïÜ€™8“©F>{Š×Ùn ¹« Œ‹Ø'6d8¨	zôÍü®=cæK>˜³[ÀÇ«i„’­zLÉl¥dW’lÈ2;GíŞd†“×¡!_¢pYA‚Ö	%4{h‹C1î™kÁ/´§Ü¶)IKï°g$Ú$¨ĞÓpŸ•ß‘ak—–¡“êç¿Û>½:ù»ÔKK7©[í0ù8İ)&›\)á©ûåÎşOôûÉ$­G¨ƒx‹Å°‰[Şl¨$”ŒH–x‹
Ò-R2LÈĞ%6%"dÆ$µ0ú‰BÕô3ø5]ÍZÈÑAeE0ì#.+C­ªÂîñ·®ûótz¼ü–}õCã††İ6Œ›‹”¨‚Ô%â%Ø\…š(ìñz²{iAÓØ£ë8ù¯÷JÊ•šB~ãğ6M2)¸t`×§áE÷Œİú%ì\°ª)_Uª}@Şç¿÷Hè\E6p	G¡<…¿3CÎN»	^˜“ÕM Òíz?ºİG„­vÂFM‰ú2düØ€aKpÉöæiØ¢äÏ•ˆø3kà69#±)Sá½gë—™­Y%mjV<Í.¦€Ôp<S®SUÆ,;¶™«­$$q3Tír|ÊPŠÇce¹#ú&*ıhÁùgäùR<N#©ÒsZG‡wºG|Å+˜Q´ãõÌ1{¥
àvòPÁ[ôëöèÕµØòËuXZ¥5dÑc!ÊKÒH@cÑ>¢¦YÏ”<Æ)>o˜gĞÖNµäø¬¬`.nr
œæP2÷ã§2ŠFÊûñø»^“ú±L¢‹+(l÷j;z}äĞ¤BOc¹¥]N÷\x2))ÒSPWš(ÌŸYÚ± ›æŒª‡	>p×‹ŸÔ¡êëß‰g¬q°[›ä ¹NØ·é9~ƒŸ®„»‹CE¨ EÛ¿añE@uÏ"…‡ßç¡Tà(ÏZë²–—Ôºá6RªÍ'yïÓÓ £#FyÍŠsTİ¦ ËÔål€’`-8ñk´Ü&;²¥ë—½V	‹<—MoCÁæE	Ú¢uİ%ÊüÄ–*¦¶5-8\áâ3iSà9·äŒÓd*ØÕŒÄj­èq&Y1°(ï.1jˆÎ+—‚Ùê¥´fˆ4›8Õ»ÈáÇåç)"pFREÏ¶«Vx+¿„ÍâİùàúĞ²=tí‚‘–ËÕØqGŸ€TR—Ï¢¯ÃÑ’/Ëé  !² ô†÷Ü‰¦	U1èê’9©»Íª”°óŞ®ïŞô;4§ÁÅOSÚ#$æG¿ˆä½xÕ õ'ù=}®\c’Q6C¹*;/Œßâìvãú
å…[í³fBeÔæ£?—Š‰nÎòKÓ’"sŞwº"tßX©-G”pÌ
©-•Mq=”|ûB—°‘Ò€¢K't|xùüÓ!ApTe Ì…ê3öSù½'^	²¶“yÀ fxL˜vØÁmaĞp2›§„¨ë‚RlG¿”Û¯è‹Ä¸›¼~&CZì3Š½ª•QÅüî2«_…S¯æsvGÔOsâj0ìãÂºc”UÈ!4çFÙŞ#h¦0êÎÀ„~Å8Lâ’¿¶ijR@À¹O-ºr[ ”ìœ…¨”gÂ—+ƒG1oBKŒ˜eU©™]=Œ/œ¢ì6U¹`¡7t§‘tUÀúgtaî¦ËlÑ'î¦"í*, Â-ş!û#3¶JKy2ş‘' ï•óùo+•œ(0*ë‡‹Ùtƒ	‡İÛ¶<·a±v?
YªØã%ö&|­2¡ëÌŒ¢KÑ½ä2îO’Ğ“iX±j­P½£ÛŒ¤ó ÜÜn–
 ‚§üôÔ_~7¥C„ËË£A†/Uş†w¥-›¥^ó~3}¹otS¾rÚQTËÂ€™Ä‘Íò»ªpPÿÔ¤ÛÌ„|„(”v–uÙ+„èÖuûg}’±w»õ€“ÿP/ëş0é5Ï«4`¸ºñik‰Ş©“{qó9ãa¹ÊL2zUîg¢®%#¨âu™çÁ È4¬¨4°˜·¶ô
ÅQnÅ,’'¿[,Q¶s‚^ A)-§–EfÀ2.VgÍ¡;Ş©h‰o³ÃŠ)|øqY?D»±7Ïö(ŠEXÖ„AvşÖ U§ÅÎ(Ì‚||ƒ…Ê(Í¤Ní"IY% ñ$&Ïî«´Ó“ÛÆ "z.WŸ@ğ¾ûİL=şÌ?_L½êOğøûŞ¨¾Îº¿\Œ«6T»¼¿ùOös—¿™Fe	ôhëÏNN‹‚È‘	EA0ûÇ.§ôûş$»®Ã»Ö³yùòµ\ç~S¦ªöÕÛ¿:¾mKŸÒ #HI‰?¹ì66fqúè3ëÜ¼º Ó>ıáöë¿hà›á{¼ŒX4äŠ›#ÆøéIşr·£Ï^®÷‚óG…İ)juÃğïZ7™â>øú^ü6¾\‹¾æ|L[RqVx‚ÅéTvP%¶%œù`½Ï,k›Ğ¤“Ü„SJt"ufGÕ/øNº´ù6S›†ÎIJ1°ü¿ş­úŒó¬(ñî+Ò¸»ÅÁ[|Èï)sœ+¦fA	KÁˆ9y•-Dæ\ û(IÑ9}­bwö9bÿúo{«Ä–ê0ÇÍ¹¹+ö¯Ïœ2ÑxK½H"EJoˆ—ƒb&3øò‹Ó¦½Àø‘hXôáÉ>¼N#Ù½Øä©ÆâwÊ™lAlå“{lò;kÜAÚ©¢`®öÕ€%w—‡Ò€@§VYKl¥_ÃsûécA7µãÈ¦¨y*¨bù$%ËÄ¸ÕÃ`›—\Saq·”“Ps›©€·û}Ûõïz?­O–Ns	·1ém)xÙíFDU Qù¡ù¬/Ø¼“i´»N˜Š1LïğÛÒì­$‰¤y–LÑ s97ZDœ†s½#ææT½ ˆ÷Ğ{Õıù=¨ıH}ª™ß`¼É¶×­·æ ÎoÇŸîsñúœø–·]$£-Ø’yd£ _Ğw¦YÖA™
ñ:9ïÅ&£ZèfÀÁBê&°}(¾`=µ¯N{äÁçÙ49+`&Ü†áW}ÍÀ[=tü”Ş/¹{Mª~¡Ïäc¿I|Q<iI%?‡¯¹C.O*Š ¹§Uu`FGíj=ÕÔ×C,vÎleŒĞtêØ3 nØëÀ—×ykê·h°ósñ†ÖVA§™+cµZšYºÏ(±Y,[šFÆ,+¢–v=öî[Â… ½4ƒ.có\åy´ì<–lBYÈÉILÑ+‚f>û8|2cê"¼Ìm)› ‚Öşâ_WoÃMºGÄÏl"àÓÿï)­dúù·Å×Ûfè• ¯ŒıXÙå1DÈ!QkV‘’¾"‡v{Å¤Ö8/M¬’gĞVA+Og¬Ø.½ÃNk+Ü‰–‘"Ë«Ï³îJäÿ¹~¯’“ª1.óÀ0ìd*ûo$ÚâÁ‡mİF>½ VÉ9Q¶ii"áTwäaeÏïÛà”¹Ôê
Ît¿?‹Ü·à€õÏİq¨aÛ£¤€½ûX7èÔqƒ»>Ï°¿iT¨ ˆS_‡fŞEì*Ş¯àÁ~şÏíÎpÎÍ„°œ‰0 İn×°ŞÓlÆ!æiÍºqXÚ  ÄÇ1ïÊÊ™btXñ6û¾ŠF>¡5n¸™ò8½UÒ`o’‡úh£u/øİ…@=Åÿì]:Àaj7–éRúB²dÉº’W£Ô†Æı’Æê,|âc²yy%´g®7S)ÊXkºŠË²$¶D™•Ñ4ÀÊ§÷Ôœ«(bb÷@€Ã¼¹Œ€é/A½ïÛõ´²õ­¬z@Ãˆ²ßÙ×ø¡eO›uªDŒ›€ë£kP.Ùã+¤î„R\½g57pèÛğ±«±„º @±ÿØ'Ü´~6[§ôaìŠÑø¦îd½\ôÙ{Õ¾ ò'ò<^aŞ·R§C»!9¿®‡Â9ğtö°Š]	ùUsüÄâ2If¸Äß@³WÊÁzÊQ{Óˆ²×r,bt–¡ã>İG*K€‡è]'[º„Ü³.ÑÓøXÓ«9BTrúåuĞŞ%&¥ÕF€üÇær÷#©’9¹¢O[±°“QšyĞu’TyÌÖu\™ea•ğ©£÷äìipÿa–®ÿÛà¡ôŞ—©ÁBéÎ˜6˜‰•ØĞ Kş#?jgÁùë¢#õö?4Å5t
sFlÃğïc­ÒFa<gª—RÚÎ#k®0á+Ÿè¤µÏ)$>3°iBĞLË¹|»pªîz!ø¬…œáV.#Û£‡ç­	ÒK’h×IW!_…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?¬oÁ#Î¦´ÅbdÀà§Öip;ÂjJŸsøC~àïµóÓ2œg)™,ë•ÛšİÔ£XODşóµF ¡ºö-=jµØá¥vuİ¥0„êX¦÷hlB7Vkk9ÈèÚAŸºVÇËîä§¤HŒÌ”2ãnú7Ê#åÅÆÆl©¢†y]wîvõhqxö^ı†-F~]ƒóÚÔU{ ¼ŸÉ—lİv“Ú{ºx°ÛÄ´­œ‚ÜM¶qs+ èŸ÷Ó¸`%aSÛÉVŸ˜›Y¹wëTBÙå*9ìê·ğYë‰¼©rß#0¡¯C0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&õÉTqKe¿JÌY\hòÂ*Ë'²c‹v)@n§³V.bb/V{ó1wË©T³‡º]h¶Ax1…¼oó³2xˆd²AÁX§$5]c‚%\Tîb­B6«X…nÆ2hA"	fi-	%ı„}/Îl˜T”°0‡Şò"	fæq ğßcì½÷şï¿Ê§°ûğõÿ/³»ÌÄ£<öÏÙ>üÏú›¿ê¼ÁO÷
uø³<ENÊCˆÈ™$@ûºúşæ=¿¦M³ÿş„²û
ğú­{®^C*3B.ËìÌ4µo_‚	RH @C:y*İ&"fšñ·óÌ¸ªm[š8‹ö‚ı´½øƒ!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸»øû[ıÀ>8¢™Æôm8£ğ^X—µ-~Ğ ÎÂaHuù`9“aª›’“"“N"•§ƒågğ˜œŸN.OÛ˜°Úü¼¹ú =øÄÛë4ğøã½ºÌòL´èŠ)s¨ª…÷½H¼IK‹Û8¥9òM³9Ñ1}-œëw–_¼ü?‹ûŒ¤ê {«ù@™ÍÆ{ïÜ€™8“©F>;
×Ùn ¹« ŒƒØ¦¶f=¨zôÍ|®=cæK>˜³ÀÕ«i„’­zLÉl¥LW’lÈ2;GíŞ’d†“×¥1‚p]A‚Ö	%4{h‹C1î™kÁ/´§Ü¶iIKÏ°g$Ú$¨ğÓpŸ•ßak–¡“úHç¿Û>½:ø»ÔKK7©yí0ù8İ)f›\	á©ûçÎşOôûÉ$­Gªƒx‹Å0‰[Şl¨$”ŒH–x‹
ÒR2LˆĞ%6%"dÆ$µ0úBÕô3ø5]ÍZÈÑeE0ì#.+O­ªÂîù·®ßótz¼ü†}õCã††İvŒ›‹”¨¢Ô%â%Ú\…š ìñz²{kAÑØ§ë8ù­÷JÊ•šÂ~ãğ&M2)¸t`W§áE÷Œİú%ì\°ª)_Uª}@Şç¿÷Hè\E6pG¡<…¿3CÎN»^“ÕM Òíz?ºİG„ívÂFM‰ú2dıØ‚apÉöæiØâäÏ•ˆøskà6=#±)Sáœ½g—ë—™­Y%mjV<Í.¦€Ôp<S®SUÆ,;¶™«­4,qTír|ÊPŠÇce¹#ò&*ıhÁùgä»R<N.#ùÒsZG‡wºG|Å+˜Q¤çõî1{¥
àvòTÁ[ôëöèÕµØòËuX¥5dĞc!ÈKÒHAcÑ.¢¦YÏ”<ÆB)oØgĞÒNµäø¬¬b.nr
œæP2÷ëç2ŠFÊûñø«^“º1L¢‹+(l÷jz}æ’Ğ¤BOc¹¥]N÷\x2))ÒSPWš(ÌŸYÚ± ›æª‡	>p×‹ŸÔ¡êûßÉg¬q°ZÛä ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡ßç¡Tà(ÏÚë°–—Ôºá2ÒªÍ'xïÓÓ ÃFyÍŠsTß¦ ËÔåL€’`-8ñi´ü&;²¥ë—½V	‹<—MoCÁfEˆÚ¢uİ'ÊüÄ–*¦¶5-8|ãà3iSà9·åŒÓt*ØÕŒÄj­\èp&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4™8Õ»ÈáÇåç)"pfREÏ¶«Vx+¿„ãİùàú…Ğ²=tí‚‘–ËÕØqG›€TR’Ï¢ÃÙ’/Ëé  !² ô†÷Ü‰¦U1øê“1©»Íª”°³Ş®¯Şô;<§ÁÅOSÚ#$æG¿ˆä½xÕ õ'ù=}®\c’QvC¹*;/ŒßâürãÚ
õ…[íY³fBeÔæ£?—Š‰nÎòKÓ’"SŞgº"tßX©-GpÌ*©-Mp=”|ûB—°‘Ò€¢K'tüxùüÛ!ApTe Ì…ê3öSù½'^	²²	‘yÀ fxL˜vØÁmaĞp2›§Ä¨ëRlG¿”~Û¯àÄ¸›œ~&SZì3Š=€ª•AÅüî2ª_…S¯æsvGÔosâj0ìãBªc”UÊa4çFÙÖ#è¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[ ”ì˜…¨”gÂ—+ƒG1mBKŒ˜eU‰]=„/œ¢ì6U¹`¡7v§‘tUÀúgtaî¦ËlÑ'î¦"ì*, â-ş¡û#3¶JKY2ü‘'(ï•óéo+•œ(0*ë‡Ùtƒ	‡İÛ¦<·a±v?ÊYªØã%ö&|½2¡ëŞŒ¢Ñ½ä2îK’Ğ“éX±j½P½ƒÓœ¤÷ ÜÜn–
 ƒ£üôÔ_~7¥C„ÊMË£A†/U¾†w¥-Û¥	Ró~;}¹otS¾rÚQTËÂ€Ä‘ìò»ŠxPÿğ¤ÛÌ„|„(”v–uÙ#„èÖußg}’±w»õ€“ÿQ/ëş0é5Î«4`¸ºñik‰Ş©“{qã;ãa½ÊLL2zUîg¢®%#¨êu™çÁ è´¬¨4°˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A--¥–EfÈ2.RgÍ¡;Ş©h©o³ÃŠ)|øqY?D»±7Ïö(ŠEXÖ„atşÖ U§ÅÎ Ì‚dlƒ…Ê,Í¤Lí"IY% ñ$&Ïî‹´Ó“ÛÆ "z.UŸ@ğ>ûİL=şÌ_L¿êOğØûÜ¨¾Î¾¿\Œ«6T»¼¿¸Oög— ¿™Ne	ôhëÏNN‹‚È‘	EA0ûÇ.§ôÿş$¹®Ã»Ş»yùò•\ç~R§ªöÕÚ¿:¾mKŸÒ #HI‰/¹ì&faòè3ëÜ¼º Ó>ıáöë¿hà›á{¼ŒX4äŠ›#ÆøéIşr·£Ï^®÷‚ñG…Ì-jqÓñÏ7¹ã>øú^ü6¾\›¾âtL[RqVx‚ÅíTöNP%¶%œù`½Î,k›Ğ¤“Ü†SJt"ufDÕ/øNº´ù>S›†ÏIJ1°ü»ş©úŒó¬(ñî+Ò¸»ÅÀ[|Èî)sœ+¦gI	KÁˆ8y•-Dæ\ û(IÑ9}­bwö9bÿúo{«Å–ê0ÇÍ¹¹)ö¯ÏœrÑxK½H"EJkˆ—“b&“½ò‹Ó¦½Àø‘hXôáÉ>¼N#Û½Ø¤©ÆâwÊl@l¥“{lò;oÜCÚ©‚a®öÕ€%÷×‡Ò€B§VYKl¥_ÃsûécA7µãÈ¦¨y*¨bù$%ËÄ¸ÔÃ`“—\Saq·”“Ps›©ˆ·û}Ûõîz?­O–Ns	·¹Ém)xÙíFDU QÛ¡ù¬.Ø¼“i´»N˜Ê1LïğÛÒÌ­$¤y–LÑ s97ZTœ†s½#æäT½ˆ÷Ğ{Õıù=¨ı	H}ª™ß`¼É¶×­·æ ÎoÇŸîsñúœø–·]$£-Ø’yd£ ˜Ğw¦YÖA™
ñ:9ïÅ&³zèfĞÁBê&°}8®`½5N{äÁ×Ù49+a&Ü†áW}ÍÀ[=tü”Ş/¹{Íª~¡Ïä#¿I|Q<iI%?‡¯¹C.O*Š ¸§Uu`FGí j=ÕÔ×ClvÎle¬têÜ3 nØëÀ—×ykê·l°ósñ†ÖA'™+cµšºÏ(±Y,[šFÆ,+¢–v=öî[Â… ½<ƒ.có\åY´ì<†lFYÈÉILÑ)’f>{8|2cz"¼Œm©›¤Òşâ_oÃEºGÌÏl"àÓÿï)­dúù·Ä×[fè• ŒıXÉå1LÈ!QkT‘’¾"v{…$Ö8/M­’gĞÖA+Og¬Ø,½ÃNk+Ü™–‘"Ë«Ï³îJäÿ±^¯’“ª±nóÈ0ìdV*ûo$Ú¢Á‡mİF~½ VI9QX¶ki2áwäaeÏïÛà”¹Ôè
Ît¿?ËÜµà€õÏÍq¨aÛ£¤€½ÛX7éÄq‡»>°¿iT¨ ˆS_fŞEì(Ş¯àÁ~şÏíYÎ`ÎÍ„°œ‰0 İn×°ÎÓlÆ!æiÍ»qXÚ ¨Å‡1ïÊÊ™btXñ6û¾šŠf>¡5n¸™òƒ8½UÒ`o’‡ú(£u/øİ…@=Áÿä]*äaj7–éRûB²dÉº’W³Ô†Æı’Æë,|âc¢yy	%´g®7S)ÊZkºŠ˜Ë²$¶L™Ñ4ÀÊ§÷Öœ«(bb÷@€Ã¼¹Œ€é/A½ïÚõ´ºõ­¬z@Ãˆ2ßÙ×ø¡EO›uªÄŒ›€ë"kP.Ùã=+¤î†R\½570èÛğ±«¹„º @¹ßØ'Ü´~6[§ôaìŠÕø¦îd½\ôÙ{Õ¾ ò'ò<^aŞ¶R·C»!9¿¦‡Â9ğtò°Š]ùUsìÔâ2Ig¸Äı@²WÊÁzÊQ{Óˆ²×r,bt–¡ãİG*K€‡è]'[º„Ü³.Q×øØÓ©BTzúåuĞÜ%&¥ÕF€üÇær÷#©’9¹¢[±°“QšyĞu²TyÌÖu\™ea…ğ©£õä¬ipÿa–®ÿÛà¡ôÎ—©ÁBéÎ˜4ˆ•ØĞ Kş#?jgÁyë¢#õö>4Å5t
sFìÇğïc­òF!<g«—RÚÎ#k®0á;Ÿè¥µÏ)$>3°iCĞLË¹|»pªîz%ø¬…œáV.#Û£‡æí	ÒK’h×IW!_?…'¼âş3±éhà¨w¢“eo Èú­àáÌ.?®oÁ#Î¦´ÅblÀà§Öip;ÂjJĞŸsøC~ğïµóÓ2œg)™,ë•ÛšİÔ£XODş³µF ¡ºö-=jµØå¥veİ¥0„êX¦÷xlÍB7Vkk9ÈèZA¿’R‡Ëîä§¤HŒÌ”2ãnêvÊ#åÅÄÆl©¢†]]wîvõhqxö^ı†-Nş]ƒóÚÔT{¼ŸÉ—lİvÊzºp°ÛÄ´­œ‚ÜM¶qs+ è—÷×¸`%iS›ÉVŸ˜›[¹wëPBÑÅ*9äê·ğYë‰¼©r×#0!C0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&áÉTqKe¿JÌY\hòÂ*Ë'²c‹v)@n'³V.bb/V{…³1wË©HT³‡ª]h¶Ax1…¼oó³2xˆdX’ÁÁX§&5]c‚%\TîB­B6«X…nÆºhA"	fi-	%ı„}/Î`˜T”°0‡Şò"	bæq€ğßëì½÷şï¿Ê§ğûğõÿ/³»ÌÄ£<æOÙ>üÎúÛ¿ê¼ÁO÷õø³<ENÊCˆÈ™$@ûºúşo¶¹¿®M³ÿş„²û
ğú­{¯^s*3BnËì
Ì4µo_‚	RH DC;y*İ&"fšñ·óÌ¸®m[š8‹ö‚ı´¹ùƒ!Õ ?8¸š­´¸¸™ãUR\úDíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øû[ıÀ>(¢™Æôm8£ğ^X—µ-~Ò ÎÂeHqù`9“aª›’“"“N*•§ƒåGğ˜œŸN.OÛ˜¸Ú5 ü¼¹û =øÄÛë4ğøã½ºÌòL´èŠ!s¨ª‡÷½H¼IK‹Û8¥9òM³9Ñ1}-œëw–_U¼ü†?‹ûŒ´ê {«y@™ÍÆûïÜ€™8“©F>{
×Ùn ¹« ŒƒØ&6d8¨	~ôÍ|®=kæK>˜³KÀÇ«i„’­zLÉl¥dW’lÈ2;GíŞd†—×¡!_¢p]A‚Ö	%4{h‹G1î™kÁ/´§Ü¶iIKÏ°‘g$Ú$¨ğÓpŸ•ß‘ak—–¡“êç¿û>½:ø»#ÔKK7©Yí0ù8İ)f›\	á©ûåÎşOôû‰4­G¨ƒx‹Å0‰[Şl¨$”ŒH–x‹
ÒR2LÈĞ%6%"dÆ µ0úBÕô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîù·®ÿótz¼ü–}õC£††İ6Œ›‹”¨‚Ô%â9%Ø\…š ìñz²{kAÓØ¢ë8ù¯÷JÊ•šB~ãğ6M²	¸t`×§áE÷Œİú%ì\°ª!_Uª}@Şç¿÷Hè\E6pG¡<…¿3CÎN«K^“ÕM Òíz?º–İG„ívÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø#kà68#±)Sá½g—ê—˜­Y%mjV<Í.¢€Ôp<S®SUÆ,;¶™«í4,q3Tír|ÊPŠÆce©#ò&*ıhÁùgäûR<L<#©ÒsZG‡wºG|Å+˜Q¤çõî1{¥
àvòTÁ[ôëöhÕµØòËuX¥1dĞc!èKÒHACÑ.¢¦YÏ”<ÆB)>oØgPÔNµäø¬¬`nr
œæP2÷ãç2ŠFÊûñø»^“º±L¢‹+(l÷j;z}ä’Ğ¤BOc9¥]Nw\x2))ÒSPwš)ÌŸ]Ú± ›æŒª‡	<p×‹ŸÔ¡êëß‰g¬q°Z›ä ¹NØ·é9~ƒŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡ßç¡Tà(ÏZë°–—Ôºá6RªÍ'xïÓÓ £#ÆùÍªsTİ¦ ËÔåL€’`-8ñk´ü&;²¥ë—½T	‹<—MoCÁfEˆÚ¢uİ%ÊüÄ–*¦¶5-8|áâ3iSà9·äŒÓd*ØÕŒÄz­èp&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4™¸Õ»ÈáÇåç)"pFRDÏ¶«x)¿„ãİùàúĞ²=tí‚‘–ËÕÈqG›€TR–Ï¢¯ÃÑ’/Ëé  !² ô÷Ü‰¦	U1èê“1©»İ¢”°óŞ®¯Şô;4[§ÁÅOSÚ#$æG¿ˆäxÕ õ'ù9u¬\c’Q6C¹*;/ŒßâävãÚ
õ…[ïY³FBeÔæ£?“Š‰nÎòKÓ’"SŞgº"tßX©-GpÌ*©-•Mp=”|ûB—°‘Ò€¢K't|xùüÛ!ApTm œ…ê3öSù½'^	²²	“yÀ fxH˜vøÁmaTĞp2›çÄ¨ëRlG¿”~Û¯à‹Ô¸›¼~&CZì3Š½ª•QÅüî2:ªO…S¯æsvGÔgsâê0ìãÂºc”UÈ!4çFÙŞ"è¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[~ ”ì˜…¨”fÂ—)ƒG1iBKŒ˜uU‰]=„/œ¢ì6U¹b¡7t'‘tUÀúgtaî¦ËlÑ'î¦"í*, â-ş!û#3öJKY2¾‘' ïóùo+•œ(0*ë‡ÙTƒ	‡ßÛ¦·a±v/
YªØã%Ö&x­2¡ëŞŒ¢Ñ½äC2îK‚Ğ“éZ¹j½P½£Ó¤ó ÜÜî– ƒ#üôÔ_~7¥C„ÊË£A†?U¾†w¥/Ó¥Zó~3}¹otS¾rÚQTÊÂ€Ä‘ìò»ŠxPÿğ¤ÛÌ„|„
(”v–uÙ+„èÔuÛg}’±w;õŸ€“ÿq/ïş0éµÎ«4`¸ºñik	Ş©“{qã9ãa¹ÊL2zUîg¢®%#¨âu˜çÁ È4¬¨4°˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÈ2.VgÍ¡;Ş©h‰o³ÇŠ)|øqY?D»±7Ïö(ŠEHÖ„atşÖ U§ÅÎ Ì‚t|ƒ…Î,Å¤Lí"IY% ñ$$Ïî›´€Ó“ÛÆ "z.UŸ@ğ¾ûİL9şÌ?_L¿êOğøûÜ¨¾Ïº¿\Œ«6T»<¿¹Oöc— ¿™Ne	ôhëÏNN‹‚È	EA0ûÇ.‡ôûş$¹®Ã»Ş³yùòµ\ç~S§ªöÕZ¿:¾mKŸÒ #HA‰?¹ì&6fAòè³ëÜ¼º “>íáöë¿èà›ñ{¼ŒX4äŠ›#ÆøéIşr·£Ï^®÷‚ñG…İ)jqÃñïZ7¹ã>øú^ü6¾\‹¾ætl[RsVx‚ÅíTvNP%¶%œù`½—Î,k“Ğ¤‘Ü†SJt"ufDÕ/øNº´ù>^S›†ÎIJ1°ü»ş­úŒó¬ñî+Ò¸»ÅÀ[|Èî)sEœ+¦gH	KÁˆ8y•-Dæ\ û(IÑ9}­`wö9fûúo{«Ä–ê4ÇÍ¹¹+ö¯Ëœ2ÑxC½H"EJkˆ—“b&³¹ò‹Ó¦½Àø™hXôáÙ>¬N#Û½Øä©ÆâwÊ™lAlå“{lò4;oÜCÚ©‚`®öÕ€%÷—‡Ò€B¯VY[l¥_ÃsûécA7µãÈ¶¨y*¨bù$5ËÄ¸ÔÃ`›—\Saq·”“Pó›©ˆ·û}Ûõïz?­O–Nr