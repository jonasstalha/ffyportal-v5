import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  DollarSign, 
  Calendar, 
  Download, 
  Search, 
  Filter,
  FileText,
  Clock,
  TrendingUp,
  Eye,
  Printer
} from 'lucide-react';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Employee interface
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  hourlyRate: number;
  status: string;
  email?: string;
  phone?: string;
  hireDate?: string;
}

interface PayrollData {
  employeeId: string;
  employee: Employee;
  totalHours: number;
  totalDays: number;
  grossSalary: number;
  deductions: {
    socialSecurity: number;
    taxes: number;
    insurance: number;
    other: number;
  };
  netSalary: number;
  workDays: Array<{
    date: string;
    entryTime: string;
    exitTime: string;
    pauseDuration: number;        // Minutes
    machineCollapseDuration: number; // Minutes
    hours: number;
    salary: number;
    status: string;
    notes: string;
  }>;
}

interface WorkSchedule {
  id: string;
  employeeId: string;
  date: string;
  entryTime: string;
  exitTime: string;
  pauseDuration: number;        // Minutes - unpaid break
  machineCollapseDuration: number; // Minutes - half-paid breakdown
  hoursWorked: number;
  salary: number;
  status: string;
  notes?: string;
  checked: boolean;
  createdAt?: any;
  updatedAt?: any;
}

const FicheDePaie: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfStyle, setPdfStyle] = useState<'programmatic' | 'template'>('programmatic');
  const [pageImageBase64, setPageImageBase64] = useState<string>('');

  // Load employees
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'personnel'), where('status', '==', 'Active')),
      (snapshot) => {
        const employeesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Employee[];
        
        console.log('👥 Employees loaded for payroll:', employeesData.length);
        setEmployees(employeesData);
      },
      (error) => {
        console.error('❌ Error loading employees:', error);
      }
    );

    return unsubscribe;
  }, []);

  // Load work schedules for selected month
  useEffect(() => {
    if (!selectedMonth) return;

    const startDate = format(startOfMonth(parseISO(selectedMonth + '-01')), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(parseISO(selectedMonth + '-01')), 'yyyy-MM-dd');

    console.log('📅 Loading schedules for month:', selectedMonth, 'from', startDate, 'to', endDate);

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'work_schedules'),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      ),
      (snapshot) => {
        const schedulesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WorkSchedule[];
        
        console.log('📊 Work schedules loaded:', schedulesData.length);
        setSchedules(schedulesData);
        setLoading(false);
      },
      (error) => {
        console.error('❌ Error loading work schedules:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [selectedMonth]);

  // Calculate payroll data
  useEffect(() => {
    if (employees.length === 0 || schedules.length === 0) {
      setPayrollData([]);
      return;
    }

    const payroll = employees.map(employee => {
      // FETCH ALL SAVED SCHEDULES - Remove checked filter to show all salary data
      const employeeSchedules = schedules.filter(s => s.employeeId === employee.id);
      
      console.log(`💰 CALCULATING PAYROLL for ${employee.firstName} ${employee.lastName}:`, {
        employeeId: employee.id,
        totalSchedules: employeeSchedules.length,
        checkedSchedules: employeeSchedules.filter(s => s.checked).length,
        hourlyRate: employee.hourlyRate,
        scheduleBreakdown: employeeSchedules.map(s => ({
          date: s.date,
          entryTime: s.entryTime,
          exitTime: s.exitTime,
          pauseDuration: s.pauseDuration,
          machineCollapseDuration: s.machineCollapseDuration,
          hoursWorked: s.hoursWorked,
          calculatedSalary: s.salary
        }))
      });
      
      const totalHours = employeeSchedules.reduce((sum, s) => sum + (s.hoursWorked || 0), 0);
      const totalDays = employeeSchedules.length;
      const grossSalary = employeeSchedules.reduce((sum, s) => sum + (s.salary || 0), 0);

      // Enhanced salary breakdown logging
      console.log(`💵 SALARY BREAKDOWN for ${employee.firstName}:`, {
        totalHours,
        totalDays,
        grossSalary,
        averageDailySalary: totalDays > 0 ? grossSalary / totalDays : 0,
        averageHourlyEarned: totalHours > 0 ? grossSalary / totalHours : 0
      });

      // Calculate deductions (approximate percentages)
      const socialSecurity = grossSalary * 0.096; // 9.6% social security
      const taxes = grossSalary > 2500 ? (grossSalary - 2500) * 0.1 : 0; // 10% tax above 2500 MAD
      const insurance = grossSalary * 0.015; // 1.5% insurance
      const totalDeductions = socialSecurity + taxes + insurance;

      const netSalary = grossSalary - totalDeductions;

      const workDays = employeeSchedules.map(s => ({
        date: s.date,
        entryTime: s.entryTime,
        exitTime: s.exitTime,
        pauseDuration: s.pauseDuration || 0,          // Minutes
        machineCollapseDuration: s.machineCollapseDuration || 0, // Minutes  
        hours: s.hoursWorked,
        salary: s.salary,
        status: s.status,
        notes: s.notes || ''
      }));

      return {
        employeeId: employee.id,
        employee,
        totalHours,
        totalDays,
        grossSalary,
        deductions: {
          socialSecurity,
          taxes,
          insurance,
          other: 0
        },
        netSalary,
        workDays
      };
    });

    console.log('🔍 PAYROLL CALCULATION COMPLETE:', {
      totalEmployees: payroll.length,
      totalPayrollAmount: payroll.reduce((sum, p) => sum + p.grossSalary, 0),
      totalHours: payroll.reduce((sum, p) => sum + p.totalHours, 0),
      monthlyBreakdown: payroll.map(p => ({
        employee: `${p.employee.firstName} ${p.employee.lastName}`,
        workDays: p.totalDays,
        grossSalary: p.grossSalary,
        netSalary: p.netSalary
      }))
    });

    setPayrollData(payroll);
  }, [employees, schedules]);

  // Filter employees
  const filteredPayroll = useMemo(() => {
    return payrollData.filter(payroll => {
      const employee = payroll.employee;
      const matchesSearch = !searchTerm || 
        `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.position?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDepartment = !departmentFilter || employee.department === departmentFilter;
      
      return matchesSearch && matchesDepartment;
    });
  }, [payrollData, searchTerm, departmentFilter]);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = employees.map(emp => emp.department).filter(Boolean);
    return Array.from(new Set(depts));
  }, [employees]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredPayroll.reduce((acc, payroll) => ({
      totalEmployees: acc.totalEmployees + 1,
      totalHours: acc.totalHours + payroll.totalHours,
      totalGrossSalary: acc.totalGrossSalary + payroll.grossSalary,
      totalNetSalary: acc.totalNetSalary + payroll.netSalary,
      totalDeductions: acc.totalDeductions + Object.values(payroll.deductions).reduce((sum, val) => sum + val, 0)
    }), {
      totalEmployees: 0,
      totalHours: 0,
      totalGrossSalary: 0,
      totalNetSalary: 0,
      totalDeductions: 0
    });
  }, [filteredPayroll]);

  const generatePayrollPDF = async (payroll: PayrollData) => {
    try {
      console.log('🔄 Starting PDF generation matching template for:', payroll.employee.firstName, payroll.employee.lastName);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const colors = {
        black: [0, 0, 0],
        white: [255, 255, 255],
        border: [0, 0, 0],
        tableBg: [240, 240, 240]
      };
      
      const drawRect = (x: number, y: number, w: number, h: number, fillColor?: number[], strokeColor?: number[], lineWidth: number = 0.5) => {
        if (strokeColor) {
          pdf.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
          pdf.setLineWidth(lineWidth);
          pdf.rect(x, y, w, h, fillColor ? 'FD' : 'S');
        } else if (fillColor) {
          pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
          pdf.rect(x, y, w, h, 'F');
        }
      };
      
      const drawText = (text: string, x: number, y: number, options: { 
        fontSize?: number, 
        align?: 'left' | 'center' | 'right', 
        fontStyle?: 'normal' | 'bold' 
      } = {}) => {
        pdf.setFontSize(options.fontSize || 10);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('times', options.fontStyle || 'normal');
        pdf.text(text, x, y, { align: options.align || 'left' });
      };
      
      let yPos = 15;
      
      // Title
      drawText('BULLETIN DE PAIE', 105, yPos, { fontSize: 16, fontStyle: 'bold', align: 'center' });
      
      yPos += 10;
      
      // Company info
      drawText('Raison sociale : FRUITS FOR YOU SARL AU', 15, yPos, { fontSize: 10 });
      drawText('N° AFFILIATION CNSS : 4555301', 120, yPos, { fontSize: 10 });
      
      yPos += 6;
      drawText('Adresse : LOT N°14 Rez De Chaussée Zone Industrielle 14A Bir', 15, yPos, { fontSize: 9 });
      
      yPos += 5;
      drawText('Rami Est Troisième Tranche - Kénitra', 15, yPos, { fontSize: 9 });
      
      yPos += 10;
      
      // Period
      const currentYear = selectedMonth.split('-')[0];
      const currentMonth = selectedMonth.split('-')[1];
      const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                         'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const lastDay = new Date(parseInt(currentYear), parseInt(currentMonth), 0).getDate();
      
      drawText(`Période : ${monthNames[parseInt(currentMonth)]} ${currentYear} (du 01/${currentMonth}/${currentYear} au ${lastDay}/${currentMonth}/${currentYear})`, 
               15, yPos, { fontSize: 10 });
      
      yPos += 10;
      
      // Employee info table
      const tableStartY = yPos;
      const rowHeight = 7;
      
      drawRect(10, tableStartY, 190, rowHeight * 2, undefined, colors.border);
      
      // Vertical lines
      pdf.line(35, tableStartY, 35, tableStartY + rowHeight * 2);
      pdf.line(85, tableStartY, 85, tableStartY + rowHeight * 2);
      pdf.line(115, tableStartY, 115, tableStartY + rowHeight * 2);
      pdf.line(145, tableStartY, 145, tableStartY + rowHeight * 2);
      pdf.line(165, tableStartY, 165, tableStartY + rowHeight * 2);
      
      // Horizontal line
      pdf.line(10, tableStartY + rowHeight, 200, tableStartY + rowHeight);
      
      // Headers
      drawText('Matricule', 12, tableStartY + 5, { fontSize: 8 });
      drawText('Nom et Prénom', 37, tableStartY + 5, { fontSize: 8 });
      drawText('N° C.N.S.S', 87, tableStartY + 5, { fontSize: 8 });
      drawText('N° C.I.N', 117, tableStartY + 5, { fontSize: 8 });
      drawText('Dédu.', 147, tableStartY + 5, { fontSize: 8 });
      drawText('D.Embauche', 167, tableStartY + 5, { fontSize: 8 });
      
      // Data
      const matricule = payroll.employee.id.substring(0, 8).toUpperCase();
      const fullName = `${payroll.employee.firstName} ${payroll.employee.lastName}`;
      const cnss = payroll.employee.id || '-';
      const cin = payroll.employee.id || '-';
      
      drawText(matricule, 12, tableStartY + rowHeight + 5, { fontSize: 8 });
      drawText(fullName, 37, tableStartY + rowHeight + 5, { fontSize: 8 });
      drawText(cnss, 87, tableStartY + rowHeight + 5, { fontSize: 8 });
      drawText(cin, 117, tableStartY + rowHeight + 5, { fontSize: 8 });
      drawText('0/0', 147, tableStartY + rowHeight + 5, { fontSize: 8 });
      drawText('-', 167, tableStartY + rowHeight + 5, { fontSize: 8 });
      
      yPos = tableStartY + rowHeight * 2 + 8;
      
      // Function row
      const infoStartY = yPos;
      drawRect(10, infoStartY, 190, rowHeight, undefined, colors.border);
      
      pdf.line(60, infoStartY, 60, infoStartY + rowHeight);
      pdf.line(110, infoStartY, 110, infoStartY + rowHeight);
      pdf.line(150, infoStartY, 150, infoStartY + rowHeight);
      
      drawText('Fonction', 12, infoStartY + 5, { fontSize: 8 });
      drawText('Paiement', 62, infoStartY + 5, { fontSize: 8 });
      drawText('CIMR', 112, infoStartY + 5, { fontSize: 8 });
      drawText('D.Naissance', 152, infoStartY + 5, { fontSize: 8 });
      
      yPos = infoStartY + rowHeight + 1;
      
      drawRect(10, yPos, 190, rowHeight, undefined, colors.border);
      pdf.line(60, yPos, 60, yPos + rowHeight);
      pdf.line(110, yPos, 110, yPos + rowHeight);
      pdf.line(150, yPos, 150, yPos + rowHeight);
      
      drawText('Ouvrier', 12, yPos + 5, { fontSize: 8, fontStyle: 'bold' });
      drawText('Espèce', 62, yPos + 5, { fontSize: 8, fontStyle: 'bold' });
      drawText('Jours fériés', 112, yPos + 5, { fontSize: 8 });
      drawText('-', 152, yPos + 5, { fontSize: 8 });
      
      yPos += rowHeight + 10;
      
      // Salary table
      const salaryTableStartY = yPos;
      const salaryRowHeight = 8;
      
      drawRect(10, salaryTableStartY, 190, salaryRowHeight, colors.tableBg, colors.border);
      
      const col1X = 10;
      const col2X = 90;
      const col3X = 125;
      const col4X = 155;
      const col5X = 175;
      
      pdf.line(col2X, salaryTableStartY, col2X, salaryTableStartY + salaryRowHeight);
      pdf.line(col3X, salaryTableStartY, col3X, salaryTableStartY + salaryRowHeight);
      pdf.line(col4X, salaryTableStartY, col4X, salaryTableStartY + salaryRowHeight);
      pdf.line(col5X, salaryTableStartY, col5X, salaryTableStartY + salaryRowHeight);
      
      drawText('Libellé', col1X + 2, salaryTableStartY + 5.5, { fontSize: 9, fontStyle: 'bold' });
      drawText('Base en DHS', col2X + 2, salaryTableStartY + 5.5, { fontSize: 9, fontStyle: 'bold' });
      drawText('Taux / nombre', col3X + 2, salaryTableStartY + 5.5, { fontSize: 9, fontStyle: 'bold' });
      drawText('Gain', col4X + 5, salaryTableStartY + 5.5, { fontSize: 9, fontStyle: 'bold' });
      drawText('Retenue', col5X + 2, salaryTableStartY + 5.5, { fontSize: 9, fontStyle: 'bold' });
      
      yPos = salaryTableStartY + salaryRowHeight;
      
      // Calculate values
      const hourlyRate = payroll.employee.hourlyRate;
      const workedDays = payroll.totalDays;
      const workedHours = payroll.totalHours;
      const baseSalaryAmount = payroll.grossSalary;
      const cnssAmount = baseSalaryAmount * 0.0448;
      const amoAmount = baseSalaryAmount * 0.0226;
      
      // Salary rows
      const salaryRows = [
        { label: 'Salaire de base', base: hourlyRate.toFixed(2), taux: `${workedDays} J`, gain: baseSalaryAmount.toFixed(2), retenue: '****' },
        { label: 'Prime d\'ancienneté', base: '', taux: '0 J', gain: '0.00', retenue: '****' },
        { label: 'Heures Sup +25%, 50%, 100%', base: '', taux: '0 %', gain: '0.00', retenue: '****' },
        { label: 'Prime de rendement', base: '', taux: '0 H', gain: '0.00', retenue: '****' },
        { label: 'Autre primes soumises', base: '', taux: 'J', gain: '0.00', retenue: '****' },
        { label: '', base: '', taux: 'J', gain: '0.00', retenue: '****' },
        { label: 'Salaire brut', base: '', taux: '', gain: baseSalaryAmount.toFixed(2), retenue: '****', isBold: true },
        { label: 'Retenue CNSS', base: '', taux: '4.48 %', gain: '****', retenue: cnssAmount.toFixed(2) },
        { label: 'Retenue AMO', base: '', taux: '2.26 %', gain: '****', retenue: amoAmount.toFixed(2) }
      ];
      
      salaryRows.forEach((row, index) => {
        const rowY = yPos + (index * salaryRowHeight);
        
        drawRect(col1X, rowY, 190, salaryRowHeight, undefined, colors.border);
        
        pdf.line(col2X, rowY, col2X, rowY + salaryRowHeight);
        pdf.line(col3X, rowY, col3X, rowY + salaryRowHeight);
        pdf.line(col4X, rowY, col4X, rowY + salaryRowHeight);
        pdf.line(col5X, rowY, col5X, rowY + salaryRowHeight);
        
        const fontStyle = (row as any).isBold ? 'bold' : 'normal';
        drawText(row.label, col1X + 2, rowY + 5.5, { fontSize: 8, fontStyle });
        drawText((row as any).base, col2X + 2, rowY + 5.5, { fontSize: 8, fontStyle });
        drawText((row as any).taux, col3X + 2, rowY + 5.5, { fontSize: 8, fontStyle });
        drawText((row as any).gain, col4X + 2, rowY + 5.5, { fontSize: 8, fontStyle, align: 'right' });
        drawText((row as any).retenue, col5X + 10, rowY + 5.5, { fontSize: 8, fontStyle, align: 'center' });
      });
      
      yPos += salaryRows.length * salaryRowHeight;
      
      // Totaux
      drawRect(col1X, yPos, 190, salaryRowHeight, colors.tableBg, colors.border);
      pdf.line(col2X, yPos, col2X, yPos + salaryRowHeight);
      pdf.line(col3X, yPos, col3X, yPos + salaryRowHeight);
      pdf.line(col4X, yPos, col4X, yPos + salaryRowHeight);
      pdf.line(col5X, yPos, col5X, yPos + salaryRowHeight);
      
      drawText('Totaux', col1X + 2, yPos + 5.5, { fontSize: 9, fontStyle: 'bold' });
      drawText(baseSalaryAmount.toFixed(2), col4X + 2, yPos + 5.5, { fontSize: 9, fontStyle: 'bold', align: 'right' });
      drawText((cnssAmount + amoAmount).toFixed(2), col5X + 10, yPos + 5.5, { fontSize: 9, fontStyle: 'bold', align: 'center' });
      
      yPos += salaryRowHeight + 5;
      
      // Net à payer
      const netSalary = baseSalaryAmount - cnssAmount - amoAmount;
      drawRect(col1X, yPos, 190, salaryRowHeight + 2, undefined, colors.border);
      pdf.line(col5X, yPos, col5X, yPos + salaryRowHeight + 2);
      
      drawText('Net à payer', col1X + 2, yPos + 7, { fontSize: 11, fontStyle: 'bold' });
      drawText(netSalary.toFixed(2), col5X + 10, yPos + 7, { fontSize: 11, fontStyle: 'bold', align: 'center' });
      
      yPos += salaryRowHeight + 15;
      
      // Signature
      drawText('A Kénitra, Le ' + new Date().toLocaleDateString('fr-FR').replace(/\//g, '/'), 15, yPos, { fontSize: 9 });
      
      yPos += 3;
      
      const sigBoxX = 110;
      const sigBoxY = yPos;
      const sigBoxW = 90;
      const sigBoxH = 40;
      
      drawRect(sigBoxX, sigBoxY, sigBoxW, sigBoxH, undefined, colors.border);
      
      drawText('Signature de l\'employé', sigBoxX + sigBoxW/2, sigBoxY + 8, { 
        fontSize: 10, 
        fontStyle: 'bold', 
        align: 'center' 
      });
      
      const fileName = `Bulletin_Paie_${payroll.employee.firstName.replace(/\s+/g, '_')}_${payroll.employee.lastName.replace(/\s+/g, '_')}_${selectedMonth}.pdf`;
      console.log(`✅ PDF built successfully for ${payroll.employee.firstName} ${payroll.employee.lastName}`);
      return { pdf, fileName } as { pdf: any; fileName: string };
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      alert(`Error generating PDF. Please try again.`);
      throw error;
    }
  };

  // Download wrapper that respects selected PDF style and shows generation state
  const downloadPayrollPDF = async (payroll: PayrollData) => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      if (pdfStyle === 'template') {
        // Template generator handles its own save
        await generatePayslipTemplate(payroll);
      } else {
        const result = await generatePayrollPDF(payroll);
        if (result && result.pdf && result.fileName) {
          result.pdf.save(result.fileName);
        }
      }
    } catch (err) {
      console.error('Download failed', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      // strip data url prefix if present
      const base64 = result.includes('base64,') ? result.split('base64,')[1] : result.replace(/^data:image\/png;base64,/, '');
      setPageImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // --- Template-based payslip generator (background image + precise positions) ---
  const ptToMm = (pt: number) => pt * 0.3527777777777778;
  const getByPath = (obj: any, path: string) => {
    const parts = path.split('.'); let cur = obj; for (const p of parts) { if (cur == null) return ''; cur = cur[p]; } return cur == null ? '' : String(cur);
  };

  const fieldSpecsPt: Array<{ path: string; xPt: number; yPt: number; fontSizePt?: number; align?: 'left'|'right'|'center' }> = [
    { path: 'company.name', xPt: 319.63, yPt: 51.02, fontSizePt: 9.96, align: 'left' },
    { path: 'company.cnss', xPt: 468.0, yPt: 51.02, fontSizePt: 9.96, align: 'left' },
    { path: 'period', xPt: 380.0, yPt: 60.0, fontSizePt: 9.0, align: 'left' },

    { path: 'employee.matricule', xPt: 32.16, yPt: 131.82, fontSizePt: 9.96, align: 'left' },
    { path: 'employee.name', xPt: 99.74, yPt: 131.82, fontSizePt: 9.96, align: 'left' },
    { path: 'employee.cnss', xPt: 181.46, yPt: 131.82, fontSizePt: 9.96, align: 'left' },
    { path: 'employee.cin', xPt: 256.01, yPt: 131.82, fontSizePt: 9.96, align: 'left' },
    { path: 'employee.job', xPt: 99.74, yPt: 143.80, fontSizePt: 9.96, align: 'left' },

    { path: 'totals.salaireBrut', xPt: 360.0, yPt: 567.0, fontSizePt: 9.96, align: 'right' },
    { path: 'totals.totalRetenue', xPt: 520.0, yPt: 567.0, fontSizePt: 9.96, align: 'right' },
    { path: 'totals.netAPayer', xPt: 520.0, yPt: 605.0, fontSizePt: 14.0, align: 'right' },

    { path: 'company.city', xPt: 70.0, yPt: 780.0, fontSizePt: 9.0, align: 'left' },
    { path: 'date', xPt: 170.0, yPt: 780.0, fontSizePt: 9.0, align: 'left' }
  ];

  const generatePayslipTemplate = (payroll: PayrollData) => {
    if (!pageImageBase64 || pageImageBase64.includes('PLACE_FULL_BASE64_HERE') || pageImageBase64.length < 50) {
      alert('Background base64 image missing. Paste the full PNG base64 into pageImageBase64 variable in the component to use the template.');
      return;
    }

    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' as any });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const data = {
        company: {
          name: 'FRUITS FOR YOU SARL AU',
          addressLine1: 'LOT N°14 Rez De Chaussée Zone Industrielle ' +
                       '14A Bir Rami Est Troisième Tranche - Kénitra',
          cnss: '4555301',
          city: 'Kénitra'
        },
        period: `${format(parseISO(selectedMonth + '-01'), 'MMMM yyyy')} (${selectedMonth})`,
        date: new Date().toLocaleDateString('fr-FR'),
        employee: {
          matricule: payroll.employee.id || payroll.employee.id.substring(0,6),
          name: `${payroll.employee.firstName} ${payroll.employee.lastName}`,
          cnss: payroll.employee?.id || '',
          cin: payroll.employee?.id || '',
          job: payroll.employee.position || ''
        },
        totals: {
          salaireBrut: payroll.grossSalary.toFixed(2),
          totalRetenue: Object.values(payroll.deductions).reduce((s, v) => s + v, 0).toFixed(2),
          netAPayer: payroll.netSalary.toFixed(2)
        }
      };

      // draw background
      const dataUrl = 'data:image/png;base64,' + pageImageBase64;
      pdf.addImage(dataUrl, 'PNG' as any, 0, 0, pageW, pageH, undefined, 'FAST');

      pdf.setFont('times', 'normal');

      for (const spec of fieldSpecsPt) {
        const txt = getByPath(data, spec.path);
        if (!txt) continue;
        const xMm = ptToMm(spec.xPt);
        const yMm = ptToMm(spec.yPt);
        const fontSize = spec.fontSizePt || 10;
        pdf.setFontSize(fontSize);
        const align = spec.align || 'left';
        pdf.text(txt, xMm, yMm, { align: align as any });
      }

      const filename = `${payroll.employee.firstName.replace(/\s+/g, '_')}_payslip.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Error generating template payslip', err);
      alert('Erreur lors de la génération de la fiche de paie (template). Voir la console.');
    }
  };

  const exportPayrollCSV = () => {
    const csvData = filteredPayroll.map(payroll => 
      `${payroll.employee.firstName} ${payroll.employee.lastName},${payroll.employee.department},${payroll.totalDays},${payroll.totalHours},${payroll.grossSalary.toFixed(2)},${Object.values(payroll.deductions).reduce((sum, val) => sum + val, 0).toFixed(2)},${payroll.netSalary.toFixed(2)}`
    ).join('\n');
    
    const header = 'Employee Name,Department,Days Worked,Hours Worked,Gross Salary (MAD),Total Deductions (MAD),Net Salary (MAD)\n';
    const blob = new Blob([header + csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${selectedMonth}.csv`;
    a.click();
  };

  const downloadAllPDFs = async () => {
    if (filteredPayroll.length === 0) {
      alert('Aucune donnée de paie à télécharger');
      return;
    }
    setIsGenerating(true);
    try {
      for (let i = 0; i < filteredPayroll.length; i++) {
        const payroll = filteredPayroll[i];
        await downloadPayrollPDF(payroll);
        // small delay
        await new Promise(r => setTimeout(r, 600));
      }
      alert(`Tous les PDFs ont été téléchargés! (${filteredPayroll.length} fichiers)`);
    } catch (err) {
      console.error('Error downloading batch PDFs', err);
      alert('Une erreur est survenue lors du téléchargement des PDFs. Voir la console.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-lg text-gray-600">Loading payroll data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-green-600 to-green-500 p-3 rounded-full">
              <FileText className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Fiches de Paie</h1>
              <p className="text-gray-600">Employee payroll management and salary calculations</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Payroll Month</p>
            <p className="text-2xl font-bold text-green-600">
              {format(parseISO(selectedMonth + '-01'), 'MMMM yyyy')}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          {/* Month Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payroll Month</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Employees</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Name or position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-500" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-800">Total Employees</h3>
              <p className="text-3xl font-bold text-blue-600">{totals.totalEmployees}</p>
              <p className="text-sm text-gray-500">active workers</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-purple-500">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-purple-500" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-800">Total Hours</h3>
              <p className="text-3xl font-bold text-purple-600">{totals.totalHours.toFixed(1)}</p>
              <p className="text-sm text-gray-500">hours worked</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-yellow-500" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-800">Gross Payroll</h3>
              <p className="text-3xl font-bold text-yellow-600">{totals.totalGrossSalary.toFixed(0)} MAD</p>
              <p className="text-sm text-gray-500">before deductions</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-green-500" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-800">Net Payroll</h3>
              <p className="text-3xl font-bold text-green-600">{totals.totalNetSalary.toFixed(0)} MAD</p>
              <p className="text-sm text-gray-500">final payment</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Quick Actions</h3>
            <p className="text-gray-600">Download payslips for all employees or individual ones</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={downloadAllPDFs}
              disabled={filteredPayroll.length === 0}
              className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
                filteredPayroll.length === 0
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>Download All PDFs ({filteredPayroll.length})</span>
            </button>
            <button
              onClick={exportPayrollCSV}
              disabled={filteredPayroll.length === 0}
              className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
                filteredPayroll.length === 0
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              <Download className="w-5 h-5" />
              <span>Export CSV</span>
            </button>
            {/* PDF style selector and background upload */}
            <div className="flex items-center space-x-3 ml-4">
              <select
                value={pdfStyle}
                onChange={(e) => setPdfStyle(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
                title="Choose PDF style"
              >
                <option value="programmatic">Programmatic</option>
                <option value="template">Template (background)</option>
              </select>
              <label className="flex items-center space-x-2 text-sm text-gray-600">
                <input type="file" accept="image/png" onChange={handleBackgroundUpload} className="hidden" id="bgUpload" />
                <button
                  onClick={() => document.getElementById('bgUpload')?.click()}
                  className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm"
                  title="Upload PNG background for template"
                  disabled={isGenerating}
                >
                  {pageImageBase64 ? 'Background uploaded' : 'Upload background PNG'}
                </button>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Employee Payroll Details</h2>
          <p className="text-gray-600">Detailed salary breakdown for {format(parseISO(selectedMonth + '-01'), 'MMMM yyyy')}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Employee</th>
                <th className="text-left p-4 font-semibold text-gray-700">Department</th>
                <th className="text-left p-4 font-semibold text-gray-700">Days</th>
                <th className="text-left p-4 font-semibold text-gray-700">Hours</th>
                <th className="text-left p-4 font-semibold text-gray-700">Gross Salary</th>
                <th className="text-left p-4 font-semibold text-gray-700">Deductions</th>
                <th className="text-left p-4 font-semibold text-gray-700">Net Salary</th>
                <th className="text-left p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPayroll.map((payroll) => (
                <tr key={payroll.employeeId} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                        {payroll.employee.firstName.charAt(0)}{payroll.employee.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          {payroll.employee.firstName} {payroll.employee.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{payroll.employee.position}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600">{payroll.employee.department}</td>
                  <td className="p-4">
                    <span className="font-semibold text-blue-600">{payroll.totalDays}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-purple-600">{payroll.totalHours.toFixed(1)}h</span>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-yellow-600">{payroll.grossSalary.toFixed(0)} MAD</span>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-red-600">
                      -{Object.values(payroll.deductions).reduce((sum, val) => sum + val, 0).toFixed(0)} MAD
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-green-600 text-lg">{payroll.netSalary.toFixed(0)} MAD</span>
                  </td>
                  <td className="p-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedEmployee(selectedEmployee === payroll.employeeId ? null : payroll.employeeId)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                                <button
                                  onClick={() => downloadPayrollPDF(payroll)}
                                  className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors shadow-sm hover:shadow-md"
                                  title="Download PDF for this Employee"
                                  disabled={isGenerating}
                                >
                                  {isGenerating ? (
                                    <svg className="animate-spin w-4 h-4 text-green-600" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 11-8 8z"></path>
                                    </svg>
                                  ) : (
                                    <Download className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => { setPdfStyle('template'); downloadPayrollPDF(payroll); }}
                                  className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors shadow-sm hover:shadow-md"
                                  title="Download Template Payslip"
                                  disabled={isGenerating}
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPayroll.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Payroll Data</h3>
            <p className="text-gray-500">No employees found for the selected month and filters.</p>
          </div>
        )}
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {(() => {
              const payroll = filteredPayroll.find(p => p.employeeId === selectedEmployee);
              if (!payroll) return null;

              return (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      Payroll Details - {payroll.employee.firstName} {payroll.employee.lastName}
                    </h2>
                    <button
                      onClick={() => setSelectedEmployee(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Employee Info */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-3">Employee Information</h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Name:</span> {payroll.employee.firstName} {payroll.employee.lastName}</p>
                        <p><span className="font-medium">Position:</span> {payroll.employee.position}</p>
                        <p><span className="font-medium">Department:</span> {payroll.employee.department}</p>
                        <p><span className="font-medium">Hourly Rate:</span> {payroll.employee.hourlyRate} MAD/hour</p>
                      </div>
                    </div>

                    {/* Salary Breakdown */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-3">Salary Breakdown</h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Gross Salary:</span> {payroll.grossSalary.toFixed(2)} MAD</p>
                        <p><span className="font-medium">Total Deductions:</span> -{Object.values(payroll.deductions).reduce((sum, val) => sum + val, 0).toFixed(2)} MAD</p>
                        <p className="font-bold text-green-600"><span className="font-medium">Net Salary:</span> {payroll.netSalary.toFixed(2)} MAD</p>
                      </div>
                    </div>
                  </div>

                  {/* Work Days Table - Enhanced with Complete Salary Breakdown */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-800 mb-3">
                      Détail des Journées de Travail ({payroll.workDays.length} jours)
                    </h3>
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-200 sticky top-0">
                          <tr>
                            <th className="text-left p-2">Date</th>
                            <th className="text-left p-2">Entrée</th>
                            <th className="text-left p-2">Sortie</th>
                            <th className="text-left p-2">Pause</th>
                            <th className="text-left p-2">Machine</th>
                            <th className="text-left p-2">Heures</th>
                            <th className="text-left p-2">Salaire</th>
                            <th className="text-left p-2">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {payroll.workDays.map((day, index) => (
                            <tr key={index} className="hover:bg-gray-100">
                              <td className="p-2 font-medium">{format(parseISO(day.date), 'dd/MM')}</td>
                              <td className="p-2">{day.entryTime}</td>
                              <td className="p-2">{day.exitTime}</td>
                              <td className="p-2 text-orange-600">{day.pauseDuration}min</td>
                              <td className="p-2 text-red-600">{day.machineCollapseDuration}min</td>
                              <td className="p-2 font-semibold">{day.hours.toFixed(2)}h</td>
                              <td className="p-2 font-bold text-green-600">{day.salary} MAD</td>
                              <td className="p-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  day.status === 'present' ? 'bg-green-100 text-green-800' :
                                  day.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                  day.status === 'overtime' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {day.status === 'present' ? 'Présent' :
                                   day.status === 'late' ? 'Retard' :
                                   day.status === 'overtime' ? 'H.Sup' : 'Absent'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Salary Calculation Methodology */}
                  <div className="bg-blue-50 p-4 rounded-lg mt-4">
                    <h3 className="font-semibold text-blue-800 mb-3">📊 Méthode de Calcul du Salaire</h3>
                    <div className="text-sm text-blue-700 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium">Calcul des Heures:</h4>
                          <ul className="list-disc list-inside text-xs space-y-1">
                            <li>Heures Travaillées = Sortie - Entrée - Pause</li>
                            <li>Salaire Normal = Heures × {payroll?.employee?.hourlyRate || 12} MAD/h</li>
                            <li>Déduction Machine = Minutes Arrêt × {((payroll?.employee?.hourlyRate || 12) / 2 / 60).toFixed(2)} MAD/min</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium">Déductions & Bonus:</h4>
                          <ul className="list-disc list-inside text-xs space-y-1">
                            <li>Sécurité Sociale: 9.6% du salaire brut</li>
                            <li>Impôts: 10% au-dessus de 2500 MAD</li>
                            <li>Bonus Transport: 10 MAD/jour</li>
                            <li>Bonus Présence: 200 MAD (≥20 jours)</li>
                          </ul>
                        </div>
                      </div>
                      <div className="border-t border-blue-200 pt-2 mt-3">
                        <p className="text-xs font-medium">
                          💡 <strong>Pause:</strong> Temps non payé • 
                          <strong> Machine Arrêtée:</strong> Payé à 50% du taux horaire • 
                          <strong> Heures Sup:</strong> +50% après 8h/jour
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );;
}

export default FicheDePaie;
