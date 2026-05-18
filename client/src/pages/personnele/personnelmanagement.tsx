import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Users, 
  PlusCircle, 
  Edit2, 
  Trash2, 
  Filter, 
  Search, 
  ChevronDown,
  UserX,
  Save,
  FileText,
  Download,
  Calendar,
  Printer,
  Eye,
  FileSpreadsheet,
  Upload,
  FileUp,
  FileDown,
  RefreshCw,
  AlertCircle,
  X,
  CheckCircle2,
  DollarSign,
  Clock,
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
  orderBy,
  getDocs
} from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const mainColor = 'rgb(31, 42, 56)';
const lightMainColor = 'rgb(44, 58, 75)';

interface Worker {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  cin: string;
  cnss: string;
  dateOfBirth: string;
  hireDate: string;
  fonction: string;
  department: 'Production' | 'Quality Control' | 'Packaging' | 'Logistics' | 'Administration';
  position: string;
  paymentMethod: 'Espèce' | 'Virement' | 'Chèque';
  baseSalary: number;
  workingDaysPerMonth: number;
  cimr: boolean;
  cimrRate?: number;
  status: 'Active' | 'Inactive' | 'On Leave' | 'Fired' | 'Resigned';
  email?: string;
  phoneNumber: string;
  address?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  payrollHistory?: Array<{
    period: string;
    fromDate: string;
    toDate: string;
    workingDays: number;
    baseSalary: number;
    holidays: number;
    overtime25: number;
    overtime50: number;
    overtime100: number;
    seniorityBonus: number;
    performanceBonus: number;
    otherBonuses: number;
    grossSalary: number;
    cnssDeduction: number;
    amoDeduction: number;
    cimrDeduction: number;
    netSalary: number;
  }>;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface PaySlip {
  period: string;
  fromDate: string;
  toDate: string;
  workingDays: number;
  baseSalary: number;
  holidays: number;
  overtime25: number;
  overtime50: number;
  overtime100: number;
  seniorityBonus: number;
  performanceBonus: number;
  otherBonuses: number;
  grossSalary: number;
  cnssDeduction: number;
  amoDeduction: number;
  cimrDeduction: number;
  netSalary: number;
}

interface WorkHoursData {
  hours: number;
  salary: number;
  date: string;
}

const PersonnelManagement: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newWorker, setNewWorker] = useState<Omit<Worker, 'id'>>({
    matricule: '',
    firstName: '',
    lastName: '',
    cin: '',
    cnss: '',
    dateOfBirth: '',
    hireDate: '',
    fonction: '',
    department: 'Production',
    position: '',
    paymentMethod: 'Virement',
    baseSalary: 0,
    workingDaysPerMonth: 26,
    cimr: false,
    cimrRate: 0,
    status: 'Active',
    email: '',
    phoneNumber: '',
    address: '',
    emergencyContact: {
      name: '',
      phone: '',
      relationship: ''
    },
    notes: ''
  });

  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [paySlipData, setPaySlipData] = useState<PaySlip>({
    period: '',
    fromDate: '',
    toDate: '',
    workingDays: 0,
    baseSalary: 0,
    holidays: 0,
    overtime25: 0,
    overtime50: 0,
    overtime100: 0,
    seniorityBonus: 0,
    performanceBonus: 0,
    otherBonuses: 0,
    grossSalary: 0,
    cnssDeduction: 0,
    amoDeduction: 0,
    cimrDeduction: 0,
    netSalary: 0
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isFireModalOpen, setIsFireModalOpen] = useState(false);
  const [firingWorker, setFiringWorker] = useState<Worker | null>(null);
  const [fireReason, setFireReason] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Worker['status'] | ''>('');
  const [departmentFilter, setDepartmentFilter] = useState<Worker['department'] | ''>('');

  const [sortConfig, setSortConfig] = useState<{key: keyof Worker, direction: 'asc' | 'desc'}>({
    key: 'lastName',
    direction: 'asc'
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{worker: Worker, paySlip: PaySlip} | null>(null);

  // Fetch work hours from pointage page
  const [workHours, setWorkHours] = useState<{[key: string]: WorkHoursData}>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'personnel'), (snapshot) => {
      const workersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Worker[];
      setWorkers(workersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch work hours from pointage
  useEffect(() => {
    const fetchWorkHours = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const hoursQuery = query(
          collection(db, 'work_schedules'),
          where('date', '==', today),
          where('checked', '==', true)
        );
        
        const querySnapshot = await getDocs(hoursQuery);
        const hoursData: {[key: string]: WorkHoursData} = {};
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          hoursData[data.employeeId] = {
            hours: data.hoursWorked || 0,
            salary: data.salary || 0,
            date: data.date || today
          };
        });
        
        setWorkHours(hoursData);
      } catch (error) {
        console.error('Error fetching work hours:', error);
      }
    };

    fetchWorkHours();
  }, []);

  // Import from Excel
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData as any[]) {
        try {
          // Map Excel columns to Worker fields
          const workerData: Omit<Worker, 'id'> = {
            matricule: row['Matricule'] || row['matricule'] || '',
            firstName: row['Prénom'] || row['firstName'] || row['First Name'] || '',
            lastName: row['Nom'] || row['lastName'] || row['Last Name'] || '',
            cin: row['CIN'] || row['cin'] || '',
            cnss: row['CNSS'] || row['cnss'] || '',
            dateOfBirth: row['Date de Naissance'] || row['dateOfBirth'] || row['birthDate'] || '',
            hireDate: row['Date d\'Embauche'] || row['hireDate'] || row['startDate'] || '',
            fonction: row['Fonction'] || row['fonction'] || row['position'] || '',
            department: (row['Département'] || row['department'] || 'Production') as Worker['department'],
            position: row['Poste'] || row['position'] || row['fonction'] || '',
            paymentMethod: (row['Mode de Paiement'] || row['paymentMethod'] || 'Virement') as Worker['paymentMethod'],
            baseSalary: parseFloat(row['Salaire de Base'] || row['baseSalary'] || row['salary'] || 0),
            workingDaysPerMonth: parseInt(row['Jours/Mois'] || row['workingDaysPerMonth'] || row['daysPerMonth'] || '26'),
            cimr: row['CIMR'] === 'Oui' || row['cimr'] === true || row['CIMR'] === 'true',
            cimrRate: parseFloat(row['Taux CIMR'] || row['cimrRate'] || row['cimr'] || 0),
            status: (row['Statut'] || row['status'] || 'Active') as Worker['status'],
            email: row['Email'] || row['email'] || '',
            phoneNumber: row['Téléphone'] || row['phoneNumber'] || row['phone'] || '',
            address: row['Adresse'] || row['address'] || '',
            emergencyContact: {
              name: row['Contact Urgence Nom'] || row['emergencyContactName'] || '',
              phone: row['Contact Urgence Téléphone'] || row['emergencyContactPhone'] || '',
              relationship: row['Contact Urgence Relation'] || row['emergencyContactRelationship'] || ''
            },
            notes: row['Notes'] || row['notes'] || ''
          };

          // Validate required fields
          if (!workerData.matricule || !workerData.firstName || !workerData.lastName) {
            console.warn('Missing required fields for worker:', workerData);
            errorCount++;
            continue;
          }

          await saveWorkerToFirebase(workerData);
          successCount++;
        } catch (error) {
          console.error('Error importing row:', row, error);
          errorCount++;
        }
      }

      setImportSuccess(`${successCount} employés importés avec succès`);
      if (errorCount > 0) {
        setImportError(`${errorCount} lignes n'ont pas pu être importées`);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setImportError('Erreur lors du traitement du fichier. Vérifiez le format.');
    } finally {
      setImporting(false);
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      const dataToExport = workers.map(worker => ({
        'Matricule': worker.matricule,
        'Prénom': worker.firstName,
        'Nom': worker.lastName,
        'CIN': worker.cin,
        'CNSS': worker.cnss,
        'Date de Naissance': worker.dateOfBirth,
        'Date d\'Embauche': worker.hireDate,
        'Fonction': worker.fonction,
        'Département': worker.department,
        'Poste': worker.position,
        'Mode de Paiement': worker.paymentMethod,
        'Salaire de Base': worker.baseSalary,
        'Jours/Mois': worker.workingDaysPerMonth,
        'CIMR': worker.cimr ? 'Oui' : 'Non',
        'Taux CIMR': worker.cimrRate || 0,
        'Statut': worker.status,
        'Email': worker.email || '',
        'Téléphone': worker.phoneNumber,
        'Adresse': worker.address || '',
        'Contact Urgence Nom': worker.emergencyContact?.name || '',
        'Contact Urgence Téléphone': worker.emergencyContact?.phone || '',
        'Contact Urgence Relation': worker.emergencyContact?.relationship || '',
        'Notes': worker.notes || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Personnel");

      // Auto-size columns
      const maxWidth = dataToExport.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
      worksheet['!cols'] = Array(maxWidth).fill({ wch: 20 });

      XLSX.writeFile(workbook, `personnel_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Erreur lors de l\'exportation vers Excel');
    }
  };

  // Export payroll history to Excel
  const exportPayrollHistory = (worker: Worker) => {
    if (!worker.payrollHistory || worker.payrollHistory.length === 0) {
      alert('Aucun historique de paie disponible pour cet employé');
      return;
    }

    try {
      const dataToExport = worker.payrollHistory.map(payroll => ({
        'Période': payroll.period,
        'Du': payroll.fromDate,
        'Au': payroll.toDate,
        'Jours travaillés': payroll.workingDays,
        'Salaire de base': payroll.baseSalary,
        'Jours fériés': payroll.holidays,
        'Heures supp 25%': payroll.overtime25,
        'Heures supp 50%': payroll.overtime50,
        'Heures supp 100%': payroll.overtime100,
        'Prime ancienneté': payroll.seniorityBonus,
        'Prime rendement': payroll.performanceBonus,
        'Autres primes': payroll.otherBonuses,
        'Salaire brut': payroll.grossSalary,
        'Déduction CNSS': payroll.cnssDeduction,
        'Déduction AMO': payroll.amoDeduction,
        'Déduction CIMR': payroll.cimrDeduction,
        'Salaire net': payroll.netSalary
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Historique Paie");

      XLSX.writeFile(workbook, `historique_paie_${worker.lastName}_${worker.firstName}.xlsx`);
    } catch (error) {
      console.error('Error exporting payroll history:', error);
      alert('Erreur lors de l\'exportation de l\'historique de paie');
    }
  };

  // Import Excel template download
  const downloadImportTemplate = () => {
    const templateData = [
      {
        'Matricule': 'EMP001',
        'Prénom': 'Jean',
        'Nom': 'Dupont',
        'CIN': 'AB123456',
        'CNSS': '112252889',
        'Date de Naissance': '1990-01-15',
        'Date d\'Embauche': '2023-01-01',
        'Fonction': 'Ouvrier',
        'Département': 'Production',
        'Poste': 'Ouvrier Production',
        'Mode de Paiement': 'Virement',
        'Salaire de Base': 3500,
        'Jours/Mois': 26,
        'CIMR': 'Non',
        'Taux CIMR': 0,
        'Statut': 'Active',
        'Email': 'jean.dupont@example.com',
        'Téléphone': '0612345678',
        'Adresse': '123 Rue Principale, Kénitra',
        'Contact Urgence Nom': 'Marie Dupont',
        'Contact Urgence Téléphone': '0623456789',
        'Contact Urgence Relation': 'Épouse',
        'Notes': 'Exemple d\'employé'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    
    // Add instructions
    const instructions = [
      ['Instructions:'],
      ['1. Téléchargez ce template'],
      ['2. Remplissez les données'],
      ['3. Importez le fichier via le bouton "Importer Excel"'],
      ['4. Les champs marqués * sont obligatoires'],
      ['5. Formats de date: YYYY-MM-DD'],
      ['6. Valeurs CIMR: "Oui" ou "Non"'],
      ['7. Statuts possibles: Active, Inactive, On Leave, Fired, Resigned']
    ];
    
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionSheet, "Instructions");
    
    XLSX.writeFile(workbook, `template_import_personnel.xlsx`);
  };

  const saveWorkerToFirebase = async (workerData: Omit<Worker, 'id'>) => {
    try {
      const docData = {
        ...workerData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await addDoc(collection(db, 'personnel'), docData);
      return true;
    } catch (error) {
      console.error('Error adding worker:', error);
      throw error;
    }
  };

  const updateWorkerInFirebase = async (workerId: string, workerData: Partial<Worker>) => {
    try {
      const docData = {
        ...workerData,
        updatedAt: serverTimestamp()
      };
      await updateDoc(doc(db, 'personnel', workerId), docData);
    } catch (error) {
      console.error('Error updating worker:', error);
      alert('Error updating worker. Please try again.');
    }
  };

  const deleteWorkerFromFirebase = async (workerId: string) => {
    try {
      await deleteDoc(doc(db, 'personnel', workerId));
    } catch (error) {
      console.error('Error deleting worker:', error);
      alert('Error deleting worker. Please try again.');
    }
  };

  const fireWorker = async () => {
    if (!firingWorker) return;

    try {
      const fireData = {
        status: 'Fired' as const,
        notes: firingWorker.notes ? `${firingWorker.notes}\n\nFired on ${new Date().toLocaleDateString()}: ${fireReason}` : `Fired on ${new Date().toLocaleDateString()}: ${fireReason}`
      };
      
      await updateWorkerInFirebase(firingWorker.id, fireData);
      setIsFireModalOpen(false);
      setFiringWorker(null);
      setFireReason('');
    } catch (error) {
      console.error('Error firing worker:', error);
      alert('Error firing worker. Please try again.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const currentWorker = editingWorker ? editingWorker : newWorker;

    if (name.startsWith('emergencyContact.')) {
      const field = name.split('.')[1];
      const updatedWorker = {
        ...currentWorker,
        emergencyContact: {
          name: currentWorker.emergencyContact?.name || '',
          phone: currentWorker.emergencyContact?.phone || '',
          relationship: currentWorker.emergencyContact?.relationship || '',
          [field]: value
        }
      };

      if (editingWorker) {
        setEditingWorker(updatedWorker as Worker);
      } else {
        setNewWorker(updatedWorker);
      }
      return;
    }

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      const updatedWorker = {
        ...currentWorker,
        [name]: checked
      };

      if (editingWorker) {
        setEditingWorker(updatedWorker as Worker);
      } else {
        setNewWorker(updatedWorker);
      }
      return;
    }

    let processedValue: any = value;
    if (name === 'baseSalary' || name === 'workingDaysPerMonth' || name === 'cimrRate') {
      processedValue = value === '' ? 0 : Number(value);
    }

    const updatedWorker = {
      ...currentWorker,
      [name]: processedValue
    };

    if (editingWorker) {
      setEditingWorker(updatedWorker as Worker);
    } else {
      setNewWorker(updatedWorker);
    }
  };

  const calculatePayroll = (worker: Worker) => {
    if (!worker) return;

    setSelectedWorker(worker);
    
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const defaultPaySlip: PaySlip = {
      period: `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`,
      fromDate: firstDay.toISOString().split('T')[0],
      toDate: lastDay.toISOString().split('T')[0],
      workingDays: worker.workingDaysPerMonth || 26,
      baseSalary: worker.baseSalary || 0,
      holidays: 0,
      overtime25: 0,
      overtime50: 0,
      overtime100: 0,
      seniorityBonus: 0,
      performanceBonus: 0,
      otherBonuses: 0,
      grossSalary: 0,
      cnssDeduction: 0,
      amoDeduction: 0,
      cimrDeduction: 0,
      netSalary: 0
    };

    const dailySalary = worker.baseSalary / worker.workingDaysPerMonth;
    const baseSalaryForPeriod = dailySalary * defaultPaySlip.workingDays;
    const totalBonuses = defaultPaySlip.seniorityBonus + 
                        defaultPaySlip.performanceBonus + 
                        defaultPaySlip.otherBonuses;
    const overtimeTotal = (defaultPaySlip.overtime25 * 1.25 * dailySalary / 8) +
                         (defaultPaySlip.overtime50 * 1.5 * dailySalary / 8) +
                         (defaultPaySlip.overtime100 * 2 * dailySalary / 8);
    const grossSalary = baseSalaryForPeriod + totalBonuses + overtimeTotal;
    const cnssDeduction = grossSalary * 0.0448;
    const amoDeduction = grossSalary * 0.0226;
    const cimrDeduction = worker.cimr ? grossSalary * (worker.cimrRate || 0) / 100 : 0;
    const netSalary = grossSalary - cnssDeduction - amoDeduction - cimrDeduction;
    
    setPaySlipData({
      ...defaultPaySlip,
      grossSalary: Number(grossSalary.toFixed(2)),
      cnssDeduction: Number(cnssDeduction.toFixed(2)),
      amoDeduction: Number(amoDeduction.toFixed(2)),
      cimrDeduction: Number(cimrDeduction.toFixed(2)),
      netSalary: Number(netSalary.toFixed(2))
    });
    
    setIsPayrollModalOpen(true);
  };

  const previewPaySlip = () => {
    if (!selectedWorker) return;
    setPreviewData({ worker: selectedWorker, paySlip: paySlipData });
    setIsPreviewOpen(true);
  };

  const generatePaySlipPDF = () => {
    if (!selectedWorker || !paySlipData) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Generate PDF content
    doc.text(`Bulletin de Paie - ${selectedWorker.firstName} ${selectedWorker.lastName}`, 20, 20);
    doc.text(`Période: ${paySlipData.period}`, 20, 30);
    doc.text(`Salaire Net: ${paySlipData.netSalary} MAD`, 20, 40);

    const fileName = `Bulletin_${selectedWorker.lastName}_${selectedWorker.firstName}_${paySlipData.period}.pdf`;
    doc.save(fileName);
  };

  const savePaySlip = async () => {
    if (!selectedWorker) return;

    try {
      const newPayrollEntry = {
        period: paySlipData.period,
        fromDate: paySlipData.fromDate,
        toDate: paySlipData.toDate,
        workingDays: paySlipData.workingDays,
        baseSalary: paySlipData.baseSalary,
        holidays: paySlipData.holidays,
        overtime25: paySlipData.overtime25,
        overtime50: paySlipData.overtime50,
        overtime100: paySlipData.overtime100,
        performanceBonus: paySlipData.performanceBonus,
        otherBonuses: paySlipData.otherBonuses,
        grossSalary: paySlipData.grossSalary,
        cnssDeduction: paySlipData.cnssDeduction,
        amoDeduction: paySlipData.amoDeduction,
        cimrDeduction: paySlipData.cimrDeduction,
        netSalary: paySlipData.netSalary
      };

      const currentHistory = selectedWorker.payrollHistory || [];
      const updatedHistory = [...currentHistory, newPayrollEntry];

      await updateWorkerInFirebase(selectedWorker.id, {
        payrollHistory: updatedHistory
      });

      alert('Bulletin de paie enregistré avec succès!');
      setIsPayrollModalOpen(false);
    } catch (error) {
      console.error('Error saving pay slip:', error);
      alert('Erreur lors de l\'enregistrement du bulletin de paie.');
    }
  };

  const saveWorker = async () => {
    if (editingWorker) {
      await updateWorkerInFirebase(editingWorker.id, editingWorker);
      setEditingWorker(null);
    } else {
      await saveWorkerToFirebase(newWorker);
    }

    setNewWorker({
      matricule: '',
      firstName: '',
      lastName: '',
      cin: '',
      cnss: '',
      dateOfBirth: '',
      hireDate: '',
      fonction: '',
      department: 'Production',
      position: '',
      paymentMethod: 'Virement',
      baseSalary: 0,
      workingDaysPerMonth: 26,
      cimr: false,
      cimrRate: 0,
      status: 'Active',
      email: '',
      phoneNumber: '',
      address: '',
      emergencyContact: {
        name: '',
        phone: '',
        relationship: ''
      },
      notes: ''
    });
    setIsModalOpen(false);
  };

  const editWorker = (worker: Worker) => {
    setEditingWorker({...worker});
    setIsModalOpen(true);
  };

  const deleteWorker = async (workerId: string) => {
    if (window.confirm('Are you sure you want to delete this worker?')) {
      await deleteWorkerFromFirebase(workerId);
    }
  };

  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const key = sortConfig.key;
      if (a[key] === undefined || b[key] === undefined) return 0;
      if (a[key] < b[key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [workers, sortConfig]);

  const safeIncludes = (value: string | undefined | null, search: string): boolean => {
    return (value || '').toLowerCase().includes(search.toLowerCase());
  };

  const filteredWorkers = useMemo(() => {
    return sortedWorkers.filter(worker => {
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = 
        safeIncludes(worker.firstName, searchTerm) ||
        safeIncludes(worker.lastName, searchTerm) ||
        safeIncludes(worker.matricule, searchTerm) ||
        safeIncludes(worker.cin, searchTerm) ||
        safeIncludes(worker.cnss, searchTerm) ||
        safeIncludes(worker.phoneNumber, searchTerm) ||
        safeIncludes(worker.email, searchTerm);

      const matchesStatus = 
        !statusFilter || worker.status === statusFilter;

      const matchesDepartment = 
        !departmentFilter || worker.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [sortedWorkers, searchTerm, statusFilter, departmentFilter]);

  const handleSort = (key: keyof Worker) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  };

  // Get today's work hours for a specific worker
  const getTodayWorkHours = (workerId: string) => {
    return workHours[workerId] || { hours: 0, salary: 0, date: new Date().toISOString().split('T')[0] };
  };

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 md:p-6">
      <div className="bg-white shadow">
        {/* Enhanced Header with Stats and Import/Export */}
        <div className="p-4 sm:p-6" style={{ backgroundColor: mainColor }}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-2 sm:p-3 backdrop-blur-sm">
                <Users className="text-white w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Gestion du Personnel</h1>
                <p className="text-blue-100 text-sm">
                  <span className="font-semibold text-white">{workers.length}</span> employés au total
                  {filteredWorkers.length !== workers.length && (
                    <span className="ml-2">
                      (<span className="font-semibold text-white">{filteredWorkers.length}</span> filtrés)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <button 
                onClick={() => {
                  setEditingWorker(null);
                  setIsModalOpen(true);
                }}
                className="bg-white hover:bg-gray-100 transition-all duration-300 px-4 py-2 sm:px-5 sm:py-3 flex items-center justify-center space-x-2 font-semibold shadow-lg"
                style={{ color: mainColor }}
              >
                <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">Nouvel Employé</span>
              </button>
              
              <div className="flex gap-2">
                <button 
                  onClick={downloadImportTemplate}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 flex items-center justify-center space-x-2"
                >
                  <FileDown className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">Template Excel</span>
                  <span className="text-sm sm:hidden">Template</span>
                </button>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {importing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span className="text-sm hidden sm:inline">Importer Excel</span>
                  <span className="text-sm sm:hidden">Importer</span>
                </button>
                
                <button 
                  onClick={exportToExcel}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">Exporter Excel</span>
                  <span className="text-sm sm:hidden">Exporter</span>
                </button>
              </div>
            </div>
          </div>

          {/* Import Status Messages */}
          {(importError || importSuccess) && (
            <div className={`mb-4 p-3 rounded ${importError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
              <div className="flex items-center">
                {importError ? <AlertCircle className="w-5 h-5 mr-2" /> : <Eye className="w-5 h-5 mr-2" />}
                <span className="text-sm">{importError || importSuccess}</span>
              </div>
            </div>
          )}

          {/* Enhanced Search and Filters - Responsive */}
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
            <div className="flex-1 w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, matricule, CIN, CNSS..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-3 bg-white text-gray-800 border border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-300 outline-none transition-all duration-300 text-sm sm:text-base"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <div className="relative group flex-1 min-w-[140px]">
                <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as Worker['status'] | '')}
                  className="w-full pl-7 sm:pl-10 pr-6 sm:pr-8 py-2 text-sm sm:text-base bg-white text-gray-800 border border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-300 outline-none appearance-none transition-all duration-300 cursor-pointer"
                >
                  <option value="">Tous les Statuts</option>
                  <option value="Active">📗 Actif</option>
                  <option value="Inactive">📘 Inactif</option>
                  <option value="On Leave">📅 Congé</option>
                  <option value="Fired">📕 Licencié</option>
                  <option value="Resigned">📒 Démissionné</option>
                </select>
              </div>
              <div className="relative group flex-1 min-w-[140px]">
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-500 pointer-events-none" />
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value as Worker['department'] | '')}
                  className="w-full pl-3 sm:pl-4 pr-6 sm:pr-8 py-2 text-sm sm:text-base bg-white text-gray-800 border border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-300 outline-none appearance-none transition-all duration-300 cursor-pointer"
                >
                  <option value="">Tous Départements</option>
                  <option value="Production">🏭 Production</option>
                  <option value="Quality Control">🔍 Contrôle Qualité</option>
                  <option value="Packaging">📦 Emballage</option>
                  <option value="Logistics">🚚 Logistique</option>
                  <option value="Administration">💼 Administration</option>
                </select>
              </div>
            </div>
          </div>

          {/* Hidden file input for import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
        </div>

        {/* Workers Table - Responsive */}
        <div className="px-2 sm:px-4 md:px-6 pb-4 sm:pb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-t-2 border-b-2 border-blue-600"></div>
                <Users className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              <span className="mt-3 sm:mt-4 text-gray-600 font-medium text-sm sm:text-base">Chargement du personnel...</span>
            </div>
          ) : (
            <div className="bg-white overflow-hidden border border-gray-200">
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full min-w-[800px] sm:min-w-0">
                  <thead style={{ backgroundColor: mainColor }}>
                    <tr>
                      {['matricule', 'lastName', 'cin', 'cnss', 'fonction', 'department', 'baseSalary', 'status'].map((key) => (
                        <th 
                          key={key}
                          className="py-3 px-3 sm:py-4 sm:px-4 text-left text-white font-semibold cursor-pointer hover:bg-opacity-80 transition-colors duration-200 group border-r"
                          onClick={() => handleSort(key as keyof Worker)}
                          style={{ borderColor: lightMainColor }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm uppercase tracking-wider">
                              {key === 'matricule' ? 'Mat.' :
                               key === 'lastName' ? 'Nom et Prénom' :
                               key === 'cin' ? 'CIN' :
                               key === 'cnss' ? 'CNSS' :
                               key === 'fonction' ? 'Fonction' :
                               key === 'department' ? 'Dépt.' :
                               key === 'baseSalary' ? 'Salaire' : 'Statut'}
                            </span>
                            <ChevronDown 
                              className={`w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-50 transition-all duration-200 ${
                                sortConfig.key === key 
                                  ? 'text-white opacity-100 ' + (sortConfig.direction === 'asc' ? 'rotate-180' : '') 
                                  : ''
                              }`} 
                            />
                          </div>
                        </th>
                      ))}
                      <th className="py-3 px-3 sm:py-4 sm:px-4 text-left text-white font-semibold" style={{ backgroundColor: mainColor }}>
                        <span className="text-xs sm:text-sm uppercase tracking-wider">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredWorkers.map((worker) => (
                      <tr key={worker.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                        <td className="py-3 px-3 sm:py-4 sm:px-4">
                          <div className="font-mono font-bold text-xs sm:text-sm" style={{ color: mainColor }}>{worker.matricule || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-3 sm:py-4 sm:px-4">
                          <div className="font-semibold text-gray-900 text-sm sm:text-base">{`${worker.firstName} ${worker.lastName}`}</div>
                          <div className="text-xs text-gray-500">{worker.position}</div>
                          <div className="text-xs text-green-600 flex items-center mt-1">
                            <Clock className="w-3 h-3 mr-1" />
                            Aujourd'hui: {getTodayWorkHours(worker.id).hours.toFixed(1)}h - {getTodayWorkHours(worker.id).salary} MAD
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:py-4 sm:px-4 font-medium text-xs sm:text-sm">{worker.cin || '-'}</td>
                        <td className="py-3 px-3 sm:py-4 sm:px-4 font-medium text-xs sm:text-sm">{worker.cnss || '-'}</td>
                        <td className="py-3 px-3 sm:py-4 sm:px-4">
                          <span className="px-2 py-1 text-xs font-semibold" style={{ backgroundColor: `${mainColor}20`, color: mainColor }}>
                            {worker.fonction || worker.position}
                          </span>
                        </td>
                        <td className="py-3 px-3 sm:py-4 sm:px-4">
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold">
                            {worker.department}
                          </span>
                        </td>
                        <td className="py-3 px-3 sm:py-4 sm:px-4">
                          <div className="font-bold text-gray-900 text-sm sm:text-base">
                            {worker.baseSalary?.toLocaleString('fr-MA', {
                              style: 'currency',
                              currency: 'MAD'
                            })}
                          </div>
                          <div className="text-xs text-gray-500">par mois</div>
                        </td>
                        <td className="py-3 px-3 sm:py-4 sm:px-4">
                          <span className={`px-2 py-1 text-xs font-bold inline-flex items-center space-x-1
                            ${worker.status === 'Active' ? 'bg-green-100 text-green-800' : 
                              worker.status === 'Inactive' ? 'bg-gray-100 text-gray-800' : 
                              worker.status === 'On Leave' ? 'bg-yellow-100 text-yellow-800' :
                              worker.status === 'Fired' ? 'bg-red-100 text-red-800' :
                              'bg-orange-100 text-orange-800'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            <span>{worker.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 sm:py-4 sm:px-4">
                          <div className="flex items-center space-x-1 flex-wrap gap-1">
                            <button
                              onClick={() => editWorker(worker)}
                              className="p-1.5 sm:p-2 hover:bg-blue-100 transition-colors duration-200"
                              title="Modifier"
                              style={{ color: mainColor }}
                            >
                              <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => calculatePayroll(worker)}
                              className="p-1.5 sm:p-2 text-green-600 hover:bg-green-100 transition-colors duration-200"
                              title="Bulletin de Paie"
                            >
                              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => exportPayrollHistory(worker)}
                              className="p-1.5 sm:p-2 text-purple-600 hover:bg-purple-100 transition-colors duration-200"
                              title="Exporter historique de paie"
                            >
                              <FileDown className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => {
                                const win = window.open('', '_blank');
                                if (win) {
                                  win.document.write(`
                                    <h2>Historique de paie - ${worker.firstName} ${worker.lastName}</h2>
                                    <pre>${JSON.stringify(worker.payrollHistory || [], null, 2)}</pre>
                                  `);
                                }
                              }}
                              className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-100 transition-colors duration-200"
                              title="Voir historique"
                            >
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            {worker.status === 'Active' && (
                              <button
                                onClick={() => {
                                  setFiringWorker(worker);
                                  setIsFireModalOpen(true);
                                }}
                                className="p-1.5 sm:p-2 text-orange-600 hover:bg-orange-100 transition-colors duration-200"
                                title="Licencier"
                              >
                                <UserX className="w-3 h-3 sm:w-4 sm:h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteWorker(worker.id)}
                              className="p-1.5 sm:p-2 text-red-600 hover:bg-red-100 transition-colors duration-200"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredWorkers.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-8 sm:py-12">
                          <div className="flex flex-col items-center space-y-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 flex items-center justify-center">
                              <Users className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-semibold text-gray-700">Aucun personnel trouvé</p>
                              <p className="text-gray-500">Essayez de modifier vos critères de recherche</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Adding/Editing Worker */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-6xl mx-auto overflow-hidden h-[90vh] flex flex-col">
            <div className="p-4 sm:p-6 flex-shrink-0" style={{ backgroundColor: mainColor }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="bg-white/20 p-1.5 sm:p-2">
                    <Users className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">
                    {editingWorker ? '✏️ Modifier Employé' : '➕ Ajouter Nouvel Employé'}
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-white hover:bg-white/20 p-1.5 sm:p-2 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <form className="flex-1 overflow-y-auto p-4 sm:p-6" onSubmit={(e) => {
              e.preventDefault();
              saveWorker();
            }}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Informations Personnelles */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 p-4 sm:p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 sm:mb-6 flex items-center">
                      <div className="w-2 h-6 bg-blue-600 mr-2 sm:mr-3"></div>
                      Informations Personnelles
                      <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-1">Obligatoire</span>
                    </h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                          <span className="text-red-500 mr-1">*</span>
                          Matricule
                        </label>
                        <input
                          type="text"
                          name="matricule"
                          value={editingWorker ? editingWorker.matricule : newWorker.matricule}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 bg-white"
                          required
                          placeholder="ex: EMP001"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                            <span className="text-red-500 mr-1">*</span>
                            Prénom
                          </label>
                          <input
                            type="text"
                            name="firstName"
                            value={editingWorker ? editingWorker.firstName : newWorker.firstName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                            required
                            placeholder="Jean"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                            <span className="text-red-500 mr-1">*</span>
                            Nom
                          </label>
                          <input
                            type="text"
                            name="lastName"
                            value={editingWorker ? editingWorker.lastName : newWorker.lastName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                            required
                            placeholder="Dupont"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                          <span className="text-red-500 mr-1">*</span>
                          CIN
                        </label>
                        <input
                          type="text"
                          name="cin"
                          value={editingWorker ? editingWorker.cin : newWorker.cin}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 uppercase"
                          required
                          placeholder="ex: AB123456"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                          <span className="text-red-500 mr-1">*</span>
                          N° CNSS
                        </label>
                        <input
                          type="text"
                          name="cnss"
                          value={editingWorker ? editingWorker.cnss : newWorker.cnss}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                          required
                          placeholder="ex: 112252889"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                          <span className="text-red-500 mr-1">*</span>
                          Date de Naissance
                        </label>
                        <input
                          type="date"
                          name="dateOfBirth"
                          value={editingWorker ? editingWorker.dateOfBirth : newWorker.dateOfBirth}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Informations Professionnelles */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 p-4 sm:p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 sm:mb-6 flex items-center">
                      <div className="w-2 h-6 bg-emerald-600 mr-2 sm:mr-3"></div>
                      Informations Professionnelles
                      <span className="ml-2 text-xs text-emerald-600 bg-emerald-100 px-2 py-1">Obligatoire</span>
                    </h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                          <span className="text-red-500 mr-1">*</span>
                          Date d'Embauche
                        </label>
                        <input
                          type="date"
                          name="hireDate"
                          value={editingWorker ? editingWorker.hireDate : newWorker.hireDate}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-200"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                          <span className="text-red-500 mr-1">*</span>
                          Fonction
                        </label>
                        <input
                          type="text"
                          name="fonction"
                          value={editingWorker ? editingWorker.fonction : newWorker.fonction}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-200"
                          required
                          placeholder="ex: Ouvrier, Technicien, Cadre..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                          <span className="text-red-500 mr-1">*</span>
                          Département
                        </label>
                        <select
                          name="department"
                          value={editingWorker ? editingWorker.department : newWorker.department}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-200 bg-white cursor-pointer"
                          required
                        >
                          <option value="">Sélectionner un département</option>
                          <option value="Production">🏭 Production</option>
                          <option value="Quality Control">🔍 Contrôle Qualité</option>
                          <option value="Packaging">📦 Emballage</option>
                          <option value="Logistics">🚚 Logistique</option>
                          <option value="Administration">💼 Administration</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                          <span className="text-red-500 mr-1">*</span>
                          Mode de Paiement
                        </label>
                        <select
                          name="paymentMethod"
                          value={editingWorker ? editingWorker.paymentMethod : newWorker.paymentMethod}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-200 bg-white cursor-pointer"
                          required
                        >
                          <option value="">Choisir mode de paiement</option>
                          <option value="Espèce">💵 Espèce</option>
                          <option value="Virement">🏦 Virement bancaire</option>
                          <option value="Chèque">📝 Chèque</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                            <span className="text-red-500 mr-1">*</span>
                            Salaire de Base (MAD)
                          </label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">MAD</span>
                            <input
                              type="number"
                              name="baseSalary"
                              value={editingWorker ? editingWorker.baseSalary : newWorker.baseSalary}
                              onChange={handleInputChange}
                              className="w-full pl-10 sm:pl-12 pr-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-200"
                              required
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                            <span className="text-red-500 mr-1">*</span>
                            Jours/Mois
                          </label>
                          <div className="relative">
                            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">jours</span>
                            <input
                              type="number"
                              name="workingDaysPerMonth"
                              value={editingWorker ? editingWorker.workingDaysPerMonth : newWorker.workingDaysPerMonth}
                              onChange={handleInputChange}
                              className="w-full px-3 pr-10 sm:pr-12 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-200"
                              required
                              min="1"
                              max="31"
                              placeholder="26"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                          <span className="text-red-500 mr-1">*</span>
                          Statut
                        </label>
                        <select
                          name="status"
                          value={editingWorker ? editingWorker.status : newWorker.status}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-200 bg-white cursor-pointer"
                          required
                        >
                          <option value="">Sélectionner un statut</option>
                          <option value="Active">✅ Actif</option>
                          <option value="Inactive">⏸️ Inactif</option>
                          <option value="On Leave">🏖️ Congé</option>
                          <option value="Fired">❌ Licencié</option>
                          <option value="Resigned">👋 Démissionné</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Retraite et Contact */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 p-4 sm:p-6 border border-gray-200">
                    <div className="space-y-4 sm:space-y-8">
                      {/* CIMR Section */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                          <div className="w-2 h-6 bg-purple-600 mr-2 sm:mr-3"></div>
                          Retraite (CIMR)
                          <span className="ml-2 text-xs text-purple-600 bg-purple-100 px-2 py-1">Optionnel</span>
                        </h3>
                        <div className="space-y-3 sm:space-y-4">
                          <div className="flex items-center p-3 sm:p-4 bg-purple-50 border border-purple-200">
                            <input
                              type="checkbox"
                              name="cimr"
                              id="cimr"
                              checked={editingWorker ? editingWorker.cimr : newWorker.cimr}
                              onChange={handleInputChange}
                              className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 focus:ring-purple-500 border-gray-300 cursor-pointer"
                            />
                            <label htmlFor="cimr" className="ml-2 sm:ml-3 block text-sm font-medium text-gray-700 cursor-pointer">
                              Adhérent à la CIMR
                            </label>
                          </div>
                          
                          {(editingWorker?.cimr || newWorker.cimr) && (
                            <div className="p-3 sm:p-4 bg-purple-50/50 border border-purple-200">
                              <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                Taux de cotisation CIMR (%)
                              </label>
                              <div className="relative">
                                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
                                <input
                                  type="number"
                                  name="cimrRate"
                                  value={editingWorker ? editingWorker.cimrRate || 0 : newWorker.cimrRate || 0}
                                  onChange={handleInputChange}
                                  className="w-full px-3 pr-10 sm:pr-12 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all duration-200"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  placeholder="0.00"
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                Le taux standard est généralement entre 6% et 8%
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Contact Information */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                          <div className="w-2 h-6 bg-amber-600 mr-2 sm:mr-3"></div>
                          Informations de Contact
                          <span className="ml-2 text-xs text-amber-600 bg-amber-100 px-2 py-1">Important</span>
                        </h3>
                        <div className="space-y-3 sm:space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                              <span className="text-red-500 mr-1">*</span>
                              Téléphone
                            </label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">📱</span>
                              <input
                                type="text"
                                name="phoneNumber"
                                value={editingWorker ? editingWorker.phoneNumber : newWorker.phoneNumber}
                                onChange={handleInputChange}
                                className="w-full pl-8 sm:pl-10 pr-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all duration-200"
                                required
                                placeholder="ex: 0612345678"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                              Email
                            </label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">✉️</span>
                              <input
                                type="email"
                                name="email"
                                value={editingWorker ? editingWorker.email || '' : newWorker.email || ''}
                                onChange={handleInputChange}
                                className="w-full pl-8 sm:pl-10 pr-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all duration-200"
                                placeholder="ex: jean.dupont@entreprise.com"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                              Adresse complète
                            </label>
                            <textarea
                              name="address"
                              value={editingWorker ? editingWorker.address || '' : newWorker.address || ''}
                              onChange={handleInputChange}
                              rows={2}
                              className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all duration-200 resize-none"
                              placeholder="ex: 123 Rue Principale, Kénitra 14000"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Emergency Contact */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                          <div className="w-2 h-6 bg-rose-600 mr-2 sm:mr-3"></div>
                          Contact d'Urgence
                          <span className="ml-2 text-xs text-rose-600 bg-rose-100 px-2 py-1">Recommandé</span>
                        </h3>
                        <div className="space-y-3 sm:space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                              Nom du contact
                            </label>
                            <input
                              type="text"
                              name="emergencyContact.name"
                              value={editingWorker ? editingWorker.emergencyContact?.name || '' : newWorker.emergencyContact?.name || ''}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all duration-200"
                              placeholder="ex: Marie Dupont"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                Téléphone
                              </label>
                              <input
                                type="text"
                                name="emergencyContact.phone"
                                value={editingWorker ? editingWorker.emergencyContact?.phone || '' : newWorker.emergencyContact?.phone || ''}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all duration-200"
                                placeholder="ex: 0623456789"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                Relation
                              </label>
                              <input
                                type="text"
                                name="emergencyContact.relationship"
                                value={editingWorker ? editingWorker.emergencyContact?.relationship || '' : newWorker.emergencyContact?.relationship || ''}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all duration-200"
                                placeholder="ex: Épouse, Parent"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Notes Section */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                          <div className="w-2 h-6 bg-gray-600 mr-2 sm:mr-3"></div>
                          Notes & Observations
                        </h3>
                        <div>
                          <textarea
                            name="notes"
                            value={editingWorker ? editingWorker.notes || '' : newWorker.notes || ''}
                            onChange={handleInputChange}
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none transition-all duration-200 resize-none"
                            placeholder="Notes supplémentaires, observations, informations importantes..."
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            Ces notes seront visibles uniquement par l'administration.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 sm:space-x-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 sm:px-6 sm:py-3 border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all duration-300 hover:border-gray-400 active:scale-95 text-sm sm:text-base"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 sm:px-6 sm:py-3 text-white font-semibold hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 active:scale-95 text-sm sm:text-base"
                    style={{ backgroundColor: mainColor }}
                  >
                    <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>{editingWorker ? 'Mettre à jour' : 'Enregistrer l\'employé'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payroll Modal */}
      {isPayrollModalOpen && selectedWorker && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl mx-auto overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6" style={{ backgroundColor: mainColor }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="bg-white/20 p-1.5 sm:p-2">
                    <FileText className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      Bulletin de Paie
                    </h2>
                    <p className="text-white/80 text-xs sm:text-sm">
                      {selectedWorker.firstName} {selectedWorker.lastName} • {selectedWorker.matricule}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPayrollModalOpen(false)}
                  className="text-white hover:bg-white/20 p-1.5 sm:p-2 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                {/* Left Column - Period & Work Info */}
                <div className="space-y-4 sm:space-y-6">
                  {/* Period Card */}
                  <div className="bg-blue-50 p-4 sm:p-5 border border-blue-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
                      Période de paie
                    </h3>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Du</label>
                        <input
                          type="date"
                          value={paySlipData.fromDate}
                          onChange={(e) => setPaySlipData({...paySlipData, fromDate: e.target.value})}
                          className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Au</label>
                        <input
                          type="date"
                          value={paySlipData.toDate}
                          onChange={(e) => setPaySlipData({...paySlipData, toDate: e.target.value})}
                          className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Work Info Card */}
                  <div className="bg-green-50 p-4 sm:p-5 border border-green-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Informations de travail</h3>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Jours travaillés</label>
                        <input
                          type="number"
                          value={paySlipData.workingDays}
                          onChange={(e) => setPaySlipData({...paySlipData, workingDays: Number(e.target.value)})}
                          className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm border border-gray-300 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none transition-all"
                          min="0"
                          max="31"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Jours fériés</label>
                        <input
                          type="number"
                          value={paySlipData.holidays}
                          onChange={(e) => setPaySlipData({...paySlipData, holidays: Number(e.target.value)})}
                          className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm border border-gray-300 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none transition-all"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Bonuses & Overtime */}
                <div className="space-y-4 sm:space-y-6">
                  {/* Overtime Card */}
                  <div className="bg-orange-50 p-4 sm:p-5 border border-orange-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Heures supplémentaires</h3>
                    <div className="grid grid-cols-3 gap-1 sm:gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 sm:mb-2">+25% (h)</label>
                        <input
                          type="number"
                          value={paySlipData.overtime25}
                          onChange={(e) => setPaySlipData({...paySlipData, overtime25: Number(e.target.value)})}
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-orange-300 outline-none"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 sm:mb-2">+50% (h)</label>
                        <input
                          type="number"
                          value={paySlipData.overtime50}
                          onChange={(e) => setPaySlipData({...paySlipData, overtime50: Number(e.target.value)})}
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-orange-300 outline-none"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 sm:mb-2">+100% (h)</label>
                        <input
                          type="number"
                          value={paySlipData.overtime100}
                          onChange={(e) => setPaySlipData({...paySlipData, overtime100: Number(e.target.value)})}
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-orange-300 outline-none"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bonuses Card */}
                  <div className="bg-purple-50 p-4 sm:p-5 border border-purple-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Primes</h3>
                    <div className="grid grid-cols-3 gap-1 sm:gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 sm:mb-2">Ancienneté (%)</label>
                        <input
                          type="number"
                          value={paySlipData.seniorityBonus}
                          onChange={(e) => setPaySlipData({...paySlipData, seniorityBonus: Number(e.target.value)})}
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-purple-300 outline-none"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 sm:mb-2">Rendement (DHS)</label>
                        <input
                          type="number"
                          value={paySlipData.performanceBonus}
                          onChange={(e) => setPaySlipData({...paySlipData, performanceBonus: Number(e.target.value)})}
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-purple-300 outline-none"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 sm:mb-2">Autres (DHS)</label>
                        <input
                          type="number"
                          value={paySlipData.otherBonuses}
                          onChange={(e) => setPaySlipData({...paySlipData, otherBonuses: Number(e.target.value)})}
                          className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-purple-300 outline-none"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Card */}
              <div className="mt-6 sm:mt-8 p-4 sm:p-6 text-white" style={{ backgroundColor: mainColor }}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
                  <div className="text-center">
                    <div className="text-xs sm:text-sm text-gray-300">Salaire de base</div>
                    <div className="text-lg sm:text-2xl font-bold">
                      {selectedWorker.baseSalary?.toLocaleString('fr-MA', {
                        style: 'currency',
                        currency: 'MAD'
                      })}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs sm:text-sm text-gray-300">Salaire brut</div>
                    <div className="text-lg sm:text-2xl font-bold text-green-400">
                      {paySlipData.grossSalary.toLocaleString('fr-MA', {
                        style: 'currency',
                        currency: 'MAD'
                      })}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs sm:text-sm text-gray-300">Total déductions</div>
                    <div className="text-lg sm:text-2xl font-bold text-red-400">
                      {(paySlipData.cnssDeduction + paySlipData.amoDeduction + paySlipData.cimrDeduction).toLocaleString('fr-MA', {
                        style: 'currency',
                        currency: 'MAD'
                      })}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs sm:text-sm text-gray-300">Net à payer</div>
                    <div className="text-xl sm:text-3xl font-bold text-white">
                      {paySlipData.netSalary.toLocaleString('fr-MA', {
                        style: 'currency',
                        currency: 'MAD'
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <button
                    onClick={previewPaySlip}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 transition-colors duration-300 flex items-center justify-center space-x-2"
                  >
                    <Eye className="w-5 h-5" />
                    <span>Aperçu</span>
                  </button>
                  <button
                    onClick={generatePaySlipPDF}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 transition-colors duration-300 flex items-center justify-center space-x-2"
                  >
                    <Download className="w-5 h-5" />
                    <span>Télécharger PDF</span>
                  </button>
                  <button
                    onClick={generatePaySlipPDF}
                    className="flex-1 bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 px-4 transition-colors duration-300 flex items-center justify-center space-x-2"
                  >
                    <Printer className="w-5 h-5" />
                    <span>Imprimer</span>
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <button
                    onClick={() => setIsPayrollModalOpen(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-4 transition-colors duration-300"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={savePaySlip}
                    className="flex-1 text-white font-bold py-3 px-4 transition-colors duration-300 flex items-center justify-center space-x-2"
                    style={{ backgroundColor: mainColor }}
                  >
                    <Save className="w-5 h-5" />
                    <span>Enregistrer</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {isPreviewOpen && previewData && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-4xl mx-auto overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 flex justify-between items-center" style={{ backgroundColor: mainColor }}>
              <h3 className="text-white font-bold">Aperçu du Bulletin de Paie</h3>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="text-white hover:bg-white/10 p-2"
              >
                ✕
              </button>
            </div>
            <div className="p-4 sm:p-8 bg-gray-100">
              {/* PDF Preview Content */}
              <div className="bg-white p-4 sm:p-8 shadow-lg max-w-4xl mx-auto font-sans">
                {/* Company Header */}
                <div className="text-center mb-6 sm:mb-8">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
                    RAISON SOCIALE : FRUITS FOR YOU SARL AU
                  </h1>
                  <p className="text-base sm:text-lg font-bold text-gray-700 mb-1">
                    N° AFFILIATION CNSS : 112252889
                  </p>
                  <p className="text-gray-600 text-sm sm:text-base">
                    Adresse : LOT N°14 Rez De Chaussée Zone Industrielle<br />
                    14A Bir Rami Est Troisième Tranche - Kénitra
                  </p>
                </div>

                {/* Title and Period */}
                <div className="text-center mb-6 sm:mb-8 border-b pb-4">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">BULLETIN DE PAIE</h2>
                  <p className="text-gray-700">
                    Période {previewData.paySlip.period} (du {previewData.paySlip.fromDate} au {previewData.paySlip.toDate})
                  </p>
                </div>

                {/* Employee Information Table */}
                <div className="mb-6 sm:mb-8 overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-xs sm:text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 p-2 text-left">Matricule</th>
                        <th className="border border-gray-300 p-2 text-left">Nom et Prénom</th>
                        <th className="border border-gray-300 p-2 text-left">N° C.N.S.S</th>
                        <th className="border border-gray-300 p-2 text-left">N° C.I.N</th>
                        <th className="border border-gray-300 p-2 text-left">D.Naissance</th>
                        <th className="border border-gray-300 p-2 text-left">Dédu.</th>
                        <th className="border border-gray-300 p-2 text-left">D.Embauche</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 p-2">{previewData.worker.matricule || '-'}</td>
                        <td className="border border-gray-300 p-2 font-medium">{`${previewData.worker.firstName} ${previewData.worker.lastName}`}</td>
                        <td className="border border-gray-300 p-2">{previewData.worker.cnss || '-'}</td>
                        <td className="border border-gray-300 p-2">{previewData.worker.cin || '-'}</td>
                        <td className="border border-gray-300 p-2">{previewData.worker.dateOfBirth || '-'}</td>
                        <td className="border border-gray-300 p-2">-</td>
                        <td className="border border-gray-300 p-2">{previewData.worker.hireDate || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Function and Payment Table */}
                <div className="mb-6 sm:mb-8 overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-xs sm:text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 p-2 text-left">Fonction</th>
                        <th className="border border-gray-300 p-2 text-left">Paiement</th>
                        <th className="border border-gray-300 p-2 text-left">CIMR</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 p-2">{previewData.worker.fonction || previewData.worker.position}</td>
                        <td className="border border-gray-300 p-2">{previewData.worker.paymentMethod}</td>
                        <td className="border border-gray-300 p-2">{previewData.worker.cimr ? 'Oui' : 'Non'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Salary Details Table */}
                <div className="mb-6 sm:mb-8 overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-xs sm:text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 p-2 text-left">Libellé</th>
                        <th className="border border-gray-300 p-2 text-left">Base en DHS</th>
                        <th className="border border-gray-300 p-2 text-left">Taux / nombre</th>
                        <th className="border border-gray-300 p-2 text-left">Gain</th>
                        <th className="border border-gray-300 p-2 text-left">Retenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Salaire de base */}
                      <tr>
                        <td className="border border-gray-300 p-2">Salaire de base</td>
                        <td className="border border-gray-300 p-2 text-right">
                          {previewData.paySlip.baseSalary.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {previewData.paySlip.workingDays} J
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-medium">
                          {(
                            (previewData.paySlip.baseSalary / previewData.worker.workingDaysPerMonth) * 
                            previewData.paySlip.workingDays
                          ).toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400">****</td>
                      </tr>

                      {/* Prime Congé */}
                      <tr>
                        <td className="border border-gray-300 p-2">Prime Congé</td>
                        <td className="border border-gray-300 p-2 text-right">-</td>
                        <td className="border border-gray-300 p-2 text-center">0 J</td>
                        <td className="border border-gray-300 p-2 text-right">0.00</td>
                        <td className="border border-gray-300 p-2"></td>
                      </tr>

                      {/* Jour férié */}
                      <tr>
                        <td className="border border-gray-300 p-2">Jour férié</td>
                        <td className="border border-gray-300 p-2 text-right">-</td>
                        <td className="border border-gray-300 p-2 text-center">
                          {previewData.paySlip.holidays} J
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-medium">
                          {(
                            (previewData.paySlip.baseSalary / previewData.worker.workingDaysPerMonth) * 
                            previewData.paySlip.holidays
                          ).toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400">****</td>
                      </tr>

                      {/* Prime d'ancienneté */}
                      <tr>
                        <td className="border border-gray-300 p-2">Prime d'ancienneté</td>
                        <td className="border border-gray-300 p-2 text-right">-</td>
                        <td className="border border-gray-300 p-2 text-center">
                          {previewData.paySlip.seniorityBonus.toFixed(2)} %
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-medium">
                          {(
                            previewData.paySlip.baseSalary * 
                            (previewData.paySlip.seniorityBonus / 100)
                          ).toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400">****</td>
                      </tr>

                      {/* Heures supplémentaires */}
                      <tr>
                        <td className="border border-gray-300 p-2">Heures Sup +25%, 50%, 100%</td>
                        <td className="border border-gray-300 p-2 text-right">-</td>
                        <td className="border border-gray-300 p-2 text-center">
                          {(
                            previewData.paySlip.overtime25 + 
                            previewData.paySlip.overtime50 + 
                            previewData.paySlip.overtime100
                          )} H
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-medium">
                          {(
                            (previewData.paySlip.overtime25 * 1.25 + 
                             previewData.paySlip.overtime50 * 1.5 + 
                             previewData.paySlip.overtime100 * 2) * 
                            (previewData.paySlip.baseSalary / previewData.worker.workingDaysPerMonth / 8)
                          ).toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400">****</td>
                      </tr>

                      {/* Prime de rendement */}
                      <tr>
                        <td className="border border-gray-300 p-2">Prime de rendement</td>
                        <td className="border border-gray-300 p-2 text-right">-</td>
                        <td className="border border-gray-300 p-2 text-center">
                          {previewData.paySlip.performanceBonus > 0 ? 'Oui' : 'Non'}
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-medium">
                          {previewData.paySlip.performanceBonus.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400">****</td>
                      </tr>

                      {/* Autres primes */}
                      <tr>
                        <td className="border border-gray-300 p-2">Autre primes soumises</td>
                        <td className="border border-gray-300 p-2 text-right">-</td>
                        <td className="border border-gray-300 p-2 text-center">-</td>
                        <td className="border border-gray-300 p-2 text-right font-medium">
                          {previewData.paySlip.otherBonuses.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400">****</td>
                      </tr>

                      {/* Salaire brut - Separator row */}
                      <tr className="border-t-2 border-gray-400">
                        <td className="border border-gray-300 p-2 font-bold">Salaire brut</td>
                        <td className="border border-gray-300 p-2 text-right font-bold">
                          {previewData.paySlip.grossSalary.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">-</td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400 font-bold">****</td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400 font-bold">****</td>
                      </tr>

                      {/* Retenue CNSS */}
                      <tr>
                        <td className="border border-gray-300 p-2">Retenue CNSS</td>
                        <td className="border border-gray-300 p-2 text-right">-</td>
                        <td className="border border-gray-300 p-2 text-center">4.48%</td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400">****</td>
                        <td className="border border-gray-300 p-2 text-right font-medium text-red-600">
                          {previewData.paySlip.cnssDeduction.toFixed(2)}
                        </td>
                      </tr>

                      {/* Retenue AMO */}
                      <tr>
                        <td className="border border-gray-300 p-2">Retenue AMO</td>
                        <td className="border border-gray-300 p-2 text-right">-</td>
                        <td className="border border-gray-300 p-2 text-center">2.26%</td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400">****</td>
                        <td className="border border-gray-300 p-2 text-right font-medium text-red-600">
                          {previewData.paySlip.amoDeduction.toFixed(2)}
                        </td>
                      </tr>

                      {/* Retenue CIMR (if applicable) */}
                      {previewData.worker.cimr && (
                        <tr>
                          <td className="border border-gray-300 p-2">Retenue CIMR</td>
                          <td className="border border-gray-300 p-2 text-right">-</td>
                          <td className="border border-gray-300 p-2 text-center">
                            {previewData.worker.cimrRate}%
                          </td>
                          <td className="border border-gray-300 p-2 text-center text-gray-400">****</td>
                          <td className="border border-gray-300 p-2 text-right font-medium text-red-600">
                            {previewData.paySlip.cimrDeduction.toFixed(2)}
                          </td>
                        </tr>
                      )}

                      {/* Totals row */}
                      <tr className="bg-gray-100 font-bold">
                        <td colSpan={3} className="border border-gray-300 p-2">Totaux</td>
                        <td className="border border-gray-300 p-2 text-right">
                          {previewData.paySlip.grossSalary.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">
                          {(
                            previewData.paySlip.cnssDeduction + 
                            previewData.paySlip.amoDeduction + 
                            previewData.paySlip.cimrDeduction
                          ).toFixed(2)}
                        </td>
                      </tr>

                      {/* Net à payer row */}
                      <tr className="bg-green-50 font-bold border-t-2 border-gray-400">
                        <td colSpan={3} className="border border-gray-300 p-2 text-lg">
                          Net à payer
                        </td>
                        <td colSpan={2} className="border border-gray-300 p-2 text-right text-lg text-green-700">
                          {previewData.paySlip.netSalary.toFixed(2)} DHS
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Action Buttons for Preview */}
                <div className="flex justify-center space-x-4 mt-8 pt-6 border-t">
                  <button
                    onClick={generatePaySlipPDF}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 transition-colors duration-300 flex items-center space-x-2"
                  >
                    <Download className="w-5 h-5" />
                    <span>Télécharger PDF</span>
                  </button>
                  <button
                    onClick={() => setIsPreviewOpen(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-6 transition-colors duration-300"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fire Employee Modal */}
      {isFireModalOpen && firingWorker && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md mx-auto overflow-hidden">
            <div className="p-6" style={{ backgroundColor: mainColor }}>
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2">
                  <UserX className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Licencier Employé
                </h2>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <UserX className="w-10 h-10 text-red-600" />
                </div>
                <p className="text-lg font-medium text-gray-800 mb-2">
                  Confirmer le licenciement de
                </p>
                <p className="text-2xl font-bold text-gray-900 mb-2">
                  {firingWorker.firstName} {firingWorker.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  Matricule: {firingWorker.matricule}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="text-red-600">*</span> Motif du licenciement
                </label>
                <textarea
                  value={fireReason}
                  onChange={(e) => setFireReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 focus:ring-2 focus:ring-red-300 focus:border-red-500 outline-none transition-all"
                  placeholder="Veuillez indiquer le motif détaillé du licenciement..."
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  Cette information sera enregistrée dans le dossier de l'employé.
                </p>
              </div>

              <div className="flex justify-between space-x-4 pt-4">
                <button
                  onClick={() => {
                    setIsFireModalOpen(false);
                    setFiringWorker(null);
                    setFireReason('');
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 transition-colors duration-300"
                >
                  Annuler
                </button>
                <button
                  onClick={fireWorker}
                  disabled={!fireReason.trim()}
                  className="flex-1 text-white font-bold py-3 px-4 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: mainColor }}
                >
                  <UserX className="w-5 h-5" />
                  <span>Confirmer le licenciement</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelManagement;