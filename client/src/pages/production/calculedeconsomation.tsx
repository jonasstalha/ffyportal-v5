import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Download, 
  Trash2, 
  Calendar, 
  User, 
  Package, 
  Factory, 
  Scale, 
  AlertTriangle,
  BarChart,
  History,
  Save,
  FileDown,
  Database,
  Settings
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  onSnapshot 
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../hooks/use-auth";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import logo from "../../../assets/icon.png";
import { ReportData } from "../../types/reports";

const PRIMARY_COLOR = [31, 42, 56]; // rgb(31, 42, 56) - Dark blue/gray
const SECONDARY_COLOR = [16, 185, 129]; // Emerald green for highlights
const ACCENT_COLOR = [59, 130, 246]; // Blue for interactive elements
const WARNING_COLOR = [245, 158, 11]; // Amber for warnings
const DANGER_COLOR = [239, 68, 68]; // Red for errors/danger
const SUCCESS_COLOR = [16, 185, 129]; // Green for success
const LIGHT_BG = [249, 250, 251]; // Light gray background
const BORDER_COLOR = [229, 231, 235]; // Light border

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

const AvocadoProcessingDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('form');
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);

  // Form state
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

  const [results, setResults] = useState({ 
    totalDispo: 0, 
    totalDechet: 0, 
    perte: 0, 
    totalUtilise: 0 
  });

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

  // Load previous return value from localStorage when component mounts
  useEffect(() => {
    const previousRetour = localStorage.getItem('previousRetour');
    if (previousRetour) {
      setForm(prev => ({
        ...prev,
        resteHier: previousRetour
      }));
    }
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

  const deleteReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'consumption_reports', reportId));
      toast.success('Rapport supprimé', {
        description: 'Le rapport a été supprimé avec succès'
      });
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      toast.error('Erreur de suppression', {
        description: 'Impossible de supprimer le rapport'
      });
    }
  };

  const calculate = async () => {
    setIsSaving(true);
    try {
      if (!auth.currentUser) {
        toast.error('Authentification requise', {
          description: 'Veuillez vous connecter pour sauvegarder'
        });
        return;
      }

      // Parse all input values, default to 0 if empty
      const entrant = parseFloat(form.entrant) || 0;
      const resteHier = parseFloat(form.resteHier) || 0;
      const consommation = parseFloat(form.consommation) || 0;
      const emballage = parseFloat(form.emballage) || 0;
      const resteAuj = parseFloat(form.resteAuj) || 0;
      const dechetMachine = parseFloat(form.dechetMachine) || 0;
      const dechetPetit = parseFloat(form.dechetPetit) || 0;
      const retour = parseFloat(form.retour) || 0;

      // Validate inputs
      if (!entrant || entrant <= 0) {
        toast.error('Validation', {
          description: 'Veuillez saisir un volume d\'entrants valide'
        });
        setIsSaving(false);
        return;
      }

      // Calculate totals
      const totalDispo = entrant + resteHier;
      const totalDechet = dechetMachine + dechetPetit;
      const totalUtilise = consommation;

      // Calculate perte (perdu/pert) using the requested formula
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
        toast.success('Rapport sauvegardé', {
          description: 'Le rapport a été enregistré avec succès'
        });
        
        // Reset form after successful save
        setForm({
          date: new Date().toISOString().split("T")[0],
          responsable: form.responsable, // Keep the same responsible
          entrant: "",
          resteHier: form.retour, // Set rest from today's return
          consommation: "",
          emballage: "",
          resteAuj: "",
          dechetMachine: "",
          dechetPetit: "",
          retour: "",
        });
        setIsCalculated(false);
      } catch (error) {
        console.error('Error saving report:', error);
        toast.error('Erreur de sauvegarde', {
          description: 'Le rapport n\'a pas pu être sauvegardé'
        });
        throw error;
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error('Erreur de traitement', {
        description: 'Une erreur est survenue lors du calcul'
      });
      setIsCalculated(false);
    } finally {
      setIsSaving(false);
    }
  };

  const generatePDF = async (report?: ReportData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    const colors = {
      primary: PRIMARY_COLOR as [number, number, number],
      secondary: SECONDARY_COLOR as [number, number, number],
      accent: ACCENT_COLOR as [number, number, number],
      warning: WARNING_COLOR as [number, number, number],
      danger: DANGER_COLOR as [number, number, number],
      success: SUCCESS_COLOR as [number, number, number],
      lightBg: LIGHT_BG as [number, number, number],
      border: BORDER_COLOR as [number, number, number],
      gray50: [250, 250, 250] as [number, number, number],
      gray100: [245, 245, 245] as [number, number, number],
      gray200: [229, 231, 235] as [number, number, number],
      gray300: [209, 213, 219] as [number, number, number],
      gray400: [156, 163, 175] as [number, number, number],
      gray500: [107, 114, 128] as [number, number, number],
      gray600: [75, 85, 99] as [number, number, number],
      gray700: [55, 65, 81] as [number, number, number],
      gray900: [17, 24, 39] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
      black: [0, 0, 0] as [number, number, number]
    };

    // Professional header with gradient
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 50, "F");

    // Company logo and name
    try {
      doc.addImage(logo, "PNG", 20, 10, 30, 30, undefined, 'FAST', 0);
    } catch (error) {
      // If logo fails, use text placeholder
    }

    // Company name
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.white);
    doc.text("FRUITS FOR YOU", 60, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Système de Traçabilité Industrielle", 60, 33);

    // Report title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RAPPORT DE CONSOMMATION", pageWidth - 20, 25, { align: "right" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Document Officiel de Production", pageWidth - 20, 32, { align: "right" });

    // Reference number
    const refNumber = `FFY-${(report?.date || form.date).replace(/-/g, "")}-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
    doc.setFontSize(8);
    doc.text(`Réf: ${refNumber}`, pageWidth - 20, 40, { align: "right" });

    let currentY = 60;

    // Header info boxes
    doc.setFillColor(...colors.lightBg);
    doc.roundedRect(20, currentY, pageWidth - 40, 30, 3, 3, 'F');
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(20, currentY, pageWidth - 40, 30, 3, 3, 'S');

    // Date
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.gray600);
    doc.text("DATE DU RAPPORT", 25, currentY + 10);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.gray900);
    doc.text(new Date(report?.date || form.date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }), 25, currentY + 20);

    // Responsible
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.gray600);
    doc.text("RESPONSABLE", pageWidth / 2 - 20, currentY + 10);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.gray900);
    doc.text(report?.employee || form.responsable || "Non spécifié", pageWidth / 2 - 20, currentY + 20);

    // Shift
    const shift = report?.shift || (new Date().getHours() < 14 ? 'matin' : new Date().getHours() < 22 ? 'apres-midi' : 'nuit');
    const shiftText = shift === 'matin' ? 'Équipe Matin (06h-14h)' :
                     shift === 'apres-midi' ? 'Équipe Après-midi (14h-22h)' :
                     'Équipe Nuit (22h-06h)';
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.gray600);
    doc.text("ÉQUIPE", pageWidth - 45, currentY + 10, { align: "right" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.gray900);
    doc.text(shiftText, pageWidth - 45, currentY + 20, { align: "right" });

    currentY += 40;

    // Use report data if provided, otherwise use form data
    const reportData = report ? {
      entrant: report.entrants,
      resteHier: report.resto,
      emballage: report.emballes,
      resteAuj: report.resteAuj,
      dechetMachine: report.dechetMachine,
      dechetPetit: report.dechetPetit,
      retour: report.retour,
      consommation: report.consommation,
      totalDechet: report.dechets,
      perte: report.pertes,
      totalDispo: report.entrants + report.resto
    } : {
      entrant: parseFloat(form.entrant || "0"),
      resteHier: parseFloat(form.resteHier || "0"),
      emballage: parseFloat(form.emballage || "0"),
      resteAuj: parseFloat(form.resteAuj || "0"),
      dechetMachine: parseFloat(form.dechetMachine || "0"),
      dechetPetit: parseFloat(form.dechetPetit || "0"),
      retour: parseFloat(form.retour || "0"),
      consommation: parseFloat(form.consommation || "0"),
      totalDechet: results.totalDechet,
      perte: results.perte,
      totalDispo: results.totalDispo
    };

    // INPUT SECTION with professional styling
    doc.setFillColor(...colors.primary);
    doc.roundedRect(20, currentY, pageWidth - 40, 15, 2, 2, 'F');
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.white);
    doc.text("MATIÈRES PREMIÈRES", 25, currentY + 10);

    const inputData = [
      ["Avocats entrants (Réception)", `${reportData.entrant.toFixed(2)}`, "kg"],
      ["Stock précédent (Reste hier)", `${reportData.resteHier.toFixed(2)}`, "kg"],
      ["TOTAL DISPONIBLE", `${reportData.totalDispo.toFixed(2)}`, "kg"]
    ];

    autoTable(doc, {
      head: [],
      body: inputData,
      startY: currentY + 20,
      margin: { left: 20, right: 20 },
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 4,
        lineColor: colors.border,
        lineWidth: 0.5,
        fontStyle: "normal",
        textColor: colors.gray700
      },
      columnStyles: {
        0: { cellWidth: 140, fontStyle: "normal" },
        1: { halign: "right", cellWidth: 50, fontStyle: "bold", textColor: colors.gray900 },
        2: { halign: "left", cellWidth: 15, textColor: colors.gray600, fontSize: 9 }
      },
      didParseCell: function (data: any) {
        if (data.row.index === inputData.length - 1) {
          data.cell.styles.fillColor = colors.gray100;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = colors.primary;
          data.cell.styles.fontSize = 11;
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // PRODUCTION SECTION
    doc.setFillColor(...colors.secondary);
    doc.roundedRect(20, currentY, pageWidth - 40, 15, 2, 2, 'F');
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.white);
    doc.text("PRODUCTION", 25, currentY + 10);

    const productionData = [
      ["Production totale (Consommation)", `${reportData.consommation.toFixed(2)}`, "kg"],
      ["Avocats emballés", `${reportData.emballage.toFixed(2)}`, "kg"],
      ["Reste produit fini", `${reportData.resteAuj.toFixed(2)}`, "kg"]
    ];

    autoTable(doc, {
      body: productionData,
      startY: currentY + 20,
      margin: { left: 20, right: 20 },
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 4,
        lineColor: colors.border,
        lineWidth: 0.5,
        fontStyle: "normal",
        textColor: colors.gray700
      },
      columnStyles: {
        0: { cellWidth: 140 },
        1: { halign: "right", cellWidth: 50, fontStyle: "bold", textColor: colors.gray900 },
        2: { halign: "left", cellWidth: 15, textColor: colors.gray600, fontSize: 9 }
      }
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // WASTE SECTION
    doc.setFillColor(...colors.warning);
    doc.roundedRect(20, currentY, pageWidth - 40, 15, 2, 2, 'F');
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.white);
    doc.text("DÉCHETS & PERTES", 25, currentY + 10);

    const wasteData = [
      ["Déchets machine", `${reportData.dechetMachine.toFixed(2)}`, "kg"],
      ["Déchets petit calibre", `${reportData.dechetPetit.toFixed(2)}`, "kg"],
      ["TOTAL DÉCHETS", `${reportData.totalDechet.toFixed(2)}`, "kg"]
    ];

    autoTable(doc, {
      body: wasteData,
      startY: currentY + 20,
      margin: { left: 20, right: 20 },
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 4,
        lineColor: colors.border,
        lineWidth: 0.5,
        fontStyle: "normal",
        textColor: colors.gray700
      },
      columnStyles: {
        0: { cellWidth: 140 },
        1: { halign: "right", cellWidth: 50, fontStyle: "bold", textColor: colors.gray900 },
        2: { halign: "left", cellWidth: 15, textColor: colors.gray600, fontSize: 9 }
      },
      didParseCell: function (data: any) {
        if (data.row.index === wasteData.length - 1) {
          data.cell.styles.fillColor = [255, 247, 237];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = colors.warning;
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // STOCK SECTION
    doc.setFillColor(...colors.accent);
    doc.roundedRect(20, currentY, pageWidth - 40, 15, 2, 2, 'F');
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.white);
    doc.text("GESTION DES STOCKS", 25, currentY + 10);

    const stockData = [
      ["Retour stock", `${reportData.retour.toFixed(2)}`, "kg"]
    ];

    autoTable(doc, {
      body: stockData,
      startY: currentY + 20,
      margin: { left: 20, right: 20 },
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 4,
        lineColor: colors.border,
        lineWidth: 0.5,
        fontStyle: "normal",
        textColor: colors.gray700
      },
      columnStyles: {
        0: { cellWidth: 140 },
        1: { halign: "right", cellWidth: 50, fontStyle: "bold", textColor: colors.gray900 },
        2: { halign: "left", cellWidth: 15, textColor: colors.gray600, fontSize: 9 }
      }
    });

    currentY = doc.lastAutoTable.finalY + 20;

    // BALANCE ANALYSIS - Professional summary
    const isPerte = reportData.perte > 0;
    const balanceBg = isPerte ? [254, 226, 226] : [220, 252, 231];
    const balanceBorder = isPerte ? colors.danger : colors.success;
    const balanceText = isPerte ? colors.danger : colors.success;
    const balanceStatus = isPerte ? "DÉFICIT" : "ÉQUILIBRE";

    doc.setFillColor(...balanceBg);
    doc.roundedRect(20, currentY, pageWidth - 40, 40, 4, 4, 'F');
    
    doc.setDrawColor(...balanceBorder);
    doc.setLineWidth(1);
    doc.roundedRect(20, currentY, pageWidth - 40, 40, 4, 4, 'S');

    // Status
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...balanceText);
    doc.text(`ANALYSE: ${balanceStatus}`, 25, currentY + 15);

    // Loss calculation
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.gray600);
    const formula = `${reportData.consommation.toFixed(2)} - ${reportData.emballage.toFixed(2)} - ${reportData.resteAuj.toFixed(2)} - ${reportData.dechetMachine.toFixed(2)} - ${reportData.dechetPetit.toFixed(2)} - ${reportData.retour.toFixed(2)}`;
    doc.text(`Calcul: ${formula} = ${reportData.perte.toFixed(2)} kg`, 25, currentY + 25);

    // Loss amount
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...balanceText);
    doc.text(`${reportData.perte.toFixed(2)} kg`, pageWidth - 25, currentY + 25, { align: "right" });

    // Footer
    currentY = pageHeight - 35;

    // Separator line
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.line(20, currentY, pageWidth - 20, currentY);

    currentY += 5;

    // Footer content
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.gray500);
    doc.text("Document confidentiel - Fruits For You ©", 20, currentY);
    doc.text("Système de Traçabilité Automatisé", pageWidth / 2, currentY, { align: "center" });
    doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, pageWidth - 20, currentY, { align: "right" });

    // Page number
    currentY += 8;
    doc.setFontSize(7);
    doc.setTextColor(...colors.gray400);
    doc.text("Page 1/1", pageWidth / 2, currentY, { align: "center" });

    const fileName = `FFY_Rapport_${report?.date || form.date}_${refNumber}.pdf`;
    doc.save(fileName);

    toast.success('PDF généré', {
      description: `Le rapport ${refNumber} a été téléchargé`
    });
  };

  const inputFields = [
    { label: "Date du rapport", name: "date", type: "date", icon: Calendar },
    { label: "Responsable", name: "responsable", type: "text", icon: User },
    { label: "Avocats entrants (kg)", name: "entrant", type: "number", icon: Package },
    { label: "Reste précédent (kg)", name: "resteHier", type: "number", icon: Scale },
    { label: "Production totale (kg)", name: "consommation", type: "number", icon: Factory },
    { label: "Avocats emballés (kg)", name: "emballage", type: "number", icon: Package },
    { label: "Reste produit fini (kg)", name: "resteAuj", type: "number", icon: Scale },
    { label: "Déchets machine (kg)", name: "dechetMachine", type: "number", icon: Factory },
    { label: "Déchets petit calibre (kg)", name: "dechetPetit", type: "number", icon: AlertTriangle },
    { label: "Retour stock (kg)", name: "retour", type: "number", icon: Database },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div 
                  className="h-12 w-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `rgb(${PRIMARY_COLOR.join(',')})` }}
                >
                  <Factory className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Fruits For You</h1>
                <p className="text-sm text-gray-600">Système de Traçabilité Industrielle</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {new Date().toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.email || 'Connectez-vous'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1">
            {[
              { id: 'form', label: 'Nouveau Rapport', icon: FileText },
              { id: 'history', label: 'Historique', icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-3 py-4 px-6 text-sm font-medium transition-all duration-200
                  ${activeTab === tab.id 
                    ? `text-white border-b-2` 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
                style={activeTab === tab.id ? { 
                  backgroundColor: `rgb(${PRIMARY_COLOR.join(',')})`,
                  borderBottomColor: `rgb(${SECONDARY_COLOR.join(',')})`
                } : {}}
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
        {activeTab === 'form' && (
          <div className="space-y-8">
            {/* Page Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <FileText className="h-6 w-6" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} />
                    Rapport de Consommation Journalier
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Saisissez les données de production pour générer le rapport officiel
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>Connecté à la base de données</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Form Section */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    {inputFields.map((field) => (
                      <div key={field.name} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                          <field.icon className="h-4 w-4" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} />
                          {field.label}
                        </label>
                        <input
                          type={field.type}
                          name={field.name}
                          value={form[field.name as keyof typeof form]}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:border-transparent transition-all outline-none text-gray-900"
                          placeholder={field.type === "number" ? "0.00" : ""}
                          style={{ 
                            borderColor: `rgb(${BORDER_COLOR.join(',')})`,
                            focusRingColor: `rgb(${PRIMARY_COLOR.join(',')})`
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-gray-200">
                    <button
                      onClick={calculate}
                      disabled={isSaving}
                      className={`
                        flex items-center justify-center gap-3 px-6 py-3 rounded-md font-medium transition-all duration-200
                        ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}
                      `}
                      style={{ 
                        backgroundColor: `rgb(${PRIMARY_COLOR.join(',')})`,
                        color: 'white'
                      }}
                    >
                      {isSaving ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Traitement en cours...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5" />
                          <span>Calculer & Enregistrer</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => generatePDF()}
                      disabled={!isCalculated || isSaving}
                      className={`
                        flex items-center justify-center gap-3 px-6 py-3 rounded-md font-medium transition-all duration-200
                        ${!isCalculated || isSaving ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500' : 'hover:opacity-90'}
                      `}
                      style={!isCalculated || isSaving ? {} : { 
                        backgroundColor: `rgb(${SECONDARY_COLOR.join(',')})`,
                        color: 'white'
                      }}
                    >
                      <FileDown className="h-5 w-5" />
                      <span>Générer PDF</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Results Panel */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <BarChart className="h-5 w-5" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} />
                    Résultats du Calcul
                  </h3>

                  <div className="space-y-4">
                    <div className="p-4 rounded-md border border-gray-200">
                      <div className="text-sm font-medium text-gray-600 mb-1">Matière Totale Disponible</div>
                      <div className="text-2xl font-bold" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }}>
                        {results.totalDispo.toFixed(2)} <span className="text-lg">kg</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-md border border-gray-200" style={{ borderColor: `rgb(${WARNING_COLOR.join(',')})` }}>
                      <div className="text-sm font-medium text-gray-600 mb-1">Déchets Totaux</div>
                      <div className="text-2xl font-bold" style={{ color: `rgb(${WARNING_COLOR.join(',')})` }}>
                        {results.totalDechet.toFixed(2)} <span className="text-lg">kg</span>
                      </div>
                    </div>

                    <div className={`
                      p-4 rounded-md border ${results.perte > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}
                    `}>
                      <div className="text-sm font-medium text-gray-600 mb-1">Analyse de Balance</div>
                      <div className={`text-2xl font-bold ${results.perte > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {results.perte.toFixed(2)} <span className="text-lg">kg</span>
                      </div>
                      {results.perte > 0 && (
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span className="text-red-600">Déficit détecté</span>
                        </div>
                      )}
                      {results.perte === 0 && (
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <span className="text-green-600">Équilibre parfait</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Formules Appliquées</h4>
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 mt-1.5 rounded-full bg-gray-400"></div>
                        <span>Total Disponible = Entrants + Reste Précédent</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 mt-1.5 rounded-full bg-gray-400"></div>
                        <span>Total Déchets = Déchets Machine + Petit Calibre</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 mt-1.5 rounded-full bg-gray-400"></div>
                        <span>Balance = Production - Emballés - Reste Fini - Déchets - Retour</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* History Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <History className="h-6 w-6" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} />
                    Archives des Rapports
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Consultez l'historique complet des rapports de consommation
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm px-3 py-1 bg-gray-100 rounded-full">
                    <span className="font-medium" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }}>
                      {reports.length} document{reports.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center">
                    <svg className="animate-spin h-8 w-8" style={{ color: `rgb(${PRIMARY_COLOR.join(',')})` }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">Chargement des données</h3>
                  <p className="mt-2 text-gray-600">Récupération des rapports archivés...</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Responsable
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Entrants
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Emballés
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Déchets
                        </th>
                        <th className="px6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Balance
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {reports.map((report, index) => (
                        <tr key={report.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {new Date(report.date).toLocaleDateString('fr-FR')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {report.shift === 'matin' ? 'Matin' : report.shift === 'apres-midi' ? 'Après-midi' : 'Nuit'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{report.employee}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {report.entrants.toFixed(2)} kg
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium" style={{ color: `rgb(${SECONDARY_COLOR.join(',')})` }}>
                              {report.emballes.toFixed(2)} kg
                            </div>
                            <div className="text-xs text-gray-500">
                              {report.efficiency?.toFixed(1)}% rendement
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium" style={{ color: `rgb(${WARNING_COLOR.join(',')})` }}>
                              {report.dechets.toFixed(2)} kg
                            </div>
                            <div className="text-xs text-gray-500">
                              {report.tauxDechets?.toFixed(1)}% taux
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${report.pertes > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {report.pertes.toFixed(2)} kg
                            </div>
                            <div className="text-xs text-gray-500">
                              {report.tauxPertes?.toFixed(1)}% taux
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => generatePDF(report)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors hover:opacity-90"
                                style={{ 
                                  backgroundColor: `rgb(${SECONDARY_COLOR.join(',')})`,
                                  color: 'white'
                                }}
                                title="Télécharger PDF"
                              >
                                <Download className="h-3 w-3" />
                                PDF
                              </button>
                              <button
                                onClick={() => deleteReport(report.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-md transition-colors hover:bg-red-100"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3 w-3" />
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {reports.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Aucun rapport archivé</h3>
                    <p className="mt-2 text-gray-600">
                      Commencez par créer un nouveau rapport de consommation
                    </p>
                    <button
                      onClick={() => setActiveTab('form')}
                      className="mt-6 px-6 py-2 rounded-md font-medium transition-colors hover:opacity-90"
                      style={{ 
                        backgroundColor: `rgb(${PRIMARY_COLOR.join(',')})`,
                        color: 'white'
                      }}
                    >
                      Créer un Rapport
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              © {new Date().getFullYear()} Fruits For You. Système de Traçabilité.
            </div>
            <div className="text-xs text-gray-400">
              Version 2.0 • Base de données connectée
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AvocadoProcessingDashboard;