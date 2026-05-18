import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Tooltip,
  LinearProgress,
  Collapse,
} from '@mui/material';
import {
  DatePicker,
  LocalizationProvider,
} from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Archive as ArchiveIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  Inventory as InventoryIcon,
  Inventory2 as Inventory2Icon,
  SwapHoriz as SwapIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CalendarToday as CalendarIcon,
  AddCircle as AddCircleIcon,
  RemoveCircle as RemoveCircleIcon,
  Warehouse as WarehouseIcon,
  AccountBalance as AccountBalanceIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  AttachMoney as MoneyIcon,
  PictureAsPdf as PdfIcon,
  Receipt as ReceiptIcon,
  Summarize as ReportIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  CompareArrows as DifferenceIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, Timestamp, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import autoTable from 'jspdf-autotable';

// Main theme colors
const PRIMARY_COLOR = 'rgb(31, 42, 56)';
const SECONDARY_COLOR = 'rgb(64, 78, 95)';
const ACCENT_COLOR = 'rgb(0, 122, 255)';
const TAKE_COLOR = 'rgb(220, 38, 38)';
const RETURN_COLOR = 'rgb(22, 163, 74)';
const BALANCE_COLOR = 'rgb(139, 92, 246)';
const INVENTORY_COLOR = 'rgb(234, 88, 12)';
const DIFFERENCE_COLOR = 'rgb(245, 158, 11)';

interface BoxTransaction {
  id?: string;
  transactionType: 'take' | 'return' | 'inventory_adjustment';
  date: Date;
  employeeName: string;
  boxes: number;
  notes?: string;
  status: 'active' | 'archived';
  createdAt: Timestamp;
  referenceId?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  originalTakeId?: string; // Links return to original take
}

interface BoxTransactionPair {
  take: BoxTransaction;
  return?: BoxTransaction;
  difference: number;
  status: 'pending' | 'partial' | 'completed';
}

interface InventoryBalance {
  id?: string;
  currentBalance: number;
  lastUpdated: Date;
  totalTaken: number;
  totalReturned: number;
  totalAdjustments: number;
}

interface BoxBalance {
  employeeName: string;
  totalTaken: number;
  totalReturned: number;
  balance: number;
  pendingReturns: number;
  transactionPairs: BoxTransactionPair[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const BoxTrackingComponent: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State
  const [activeTab, setActiveTab] = useState(0);
  const [transactions, setTransactions] = useState<BoxTransaction[]>([]);
  const [transactionPairs, setTransactionPairs] = useState<BoxTransactionPair[]>([]);
  const [inventoryBalance, setInventoryBalance] = useState<InventoryBalance>({
    currentBalance: 0,
    lastUpdated: new Date(),
    totalTaken: 0,
    totalReturned: 0,
    totalAdjustments: 0,
  });
  const [activeForm, setActiveForm] = useState<'take' | 'return' | 'adjustment'>('take');
  const [takeFormData, setTakeFormData] = useState<Omit<BoxTransaction, 'id' | 'createdAt' | 'referenceId' | 'balanceBefore' | 'balanceAfter'>>({
    transactionType: 'take',
    date: new Date(),
    employeeName: '',
    boxes: 0,
    notes: '',
    status: 'active',
  });
  const [returnFormData, setReturnFormData] = useState<{
    employeeName: string;
    boxes: number;
    notes: string;
    date: Date;
    originalTakeId?: string;
  }>({
    employeeName: '',
    boxes: 0,
    notes: '',
    date: new Date(),
    originalTakeId: '',
  });
  const [adjustmentFormData, setAdjustmentFormData] = useState<{
    adjustmentType: 'add' | 'remove';
    boxes: number;
    notes: string;
    date: Date;
  }>({
    adjustmentType: 'add',
    boxes: 0,
    notes: '',
    date: new Date(),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('all');
  const [filterType, setFilterType] = useState<'all' | 'take' | 'return' | 'inventory_adjustment'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [balances, setBalances] = useState<BoxBalance[]>([]);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [selectedPairForReturn, setSelectedPairForReturn] = useState<BoxTransactionPair | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Process transactions into pairs
  useEffect(() => {
    const takeTransactions = transactions.filter(t => 
      t.transactionType === 'take' && t.status === 'active'
    );
    
    const returnTransactions = transactions.filter(t => 
      t.transactionType === 'return' && t.status === 'active'
    );

    const pairs: BoxTransactionPair[] = [];
    const usedReturnIds = new Set<string>();

    // Match returns with takes
    takeTransactions.forEach(take => {
      const matchingReturn = returnTransactions.find(ret => 
        ret.originalTakeId === take.id && !usedReturnIds.has(ret.id!)
      );

      if (matchingReturn) {
        usedReturnIds.add(matchingReturn.id!);
        pairs.push({
          take,
          return: matchingReturn,
          difference: take.boxes - matchingReturn.boxes,
          status: take.boxes === matchingReturn.boxes ? 'completed' : 'partial',
        });
      } else {
        pairs.push({
          take,
          difference: take.boxes,
          status: 'pending',
        });
      }
    });

    // Add returns without matching takes (shouldn't happen but just in case)
    returnTransactions.forEach(ret => {
      if (!usedReturnIds.has(ret.id!)) {
        pairs.push({
          take: {
            ...ret,
            transactionType: 'take' as const,
            boxes: 0,
          },
          return: ret,
          difference: -ret.boxes,
          status: 'completed',
        });
      }
    });

    setTransactionPairs(pairs);
  }, [transactions]);

  // Calculate employee balances with transaction pairs
  useEffect(() => {
    const employeeBalances = new Map<string, BoxBalance>();
    
    transactionPairs.forEach(pair => {
      const employeeName = pair.take.employeeName;
      
      if (!employeeBalances.has(employeeName)) {
        employeeBalances.set(employeeName, {
          employeeName,
          totalTaken: 0,
          totalReturned: 0,
          balance: 0,
          pendingReturns: 0,
          transactionPairs: [],
        });
      }
      
      const balance = employeeBalances.get(employeeName)!;
      
      balance.totalTaken += pair.take.boxes;
      balance.totalReturned += pair.return?.boxes || 0;
      balance.balance = balance.totalTaken - balance.totalReturned;
      balance.pendingReturns = Math.max(0, balance.balance);
      balance.transactionPairs.push(pair);
    });
    
    setBalances(Array.from(employeeBalances.values()));
  }, [transactionPairs]);

  // Fetch inventory balance from Firebase
  const fetchInventoryBalance = async () => {
    try {
      const inventoryRef = collection(db, 'inventoryBalance');
      const snapshot = await getDocs(inventoryRef);
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as any;
        setInventoryBalance({
          id: snapshot.docs[0].id,
          currentBalance: data.currentBalance || 0,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          totalTaken: data.totalTaken || 0,
          totalReturned: data.totalReturned || 0,
          totalAdjustments: data.totalAdjustments || 0,
        });
      } else {
        // Create initial inventory balance if it doesn't exist
        const initialBalance = {
          currentBalance: 0,
          lastUpdated: new Date(),
          totalTaken: 0,
          totalReturned: 0,
          totalAdjustments: 0,
        };
        const docRef = await addDoc(collection(db, 'inventoryBalance'), initialBalance);
        setInventoryBalance({
          id: docRef.id,
          ...initialBalance,
        });
      }
    } catch (error) {
      console.error('Error fetching inventory balance:', error);
    }
  };

  // Fetch transactions from Firebase
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const transactionsRef = collection(db, 'boxTransactions');
      let q = query(transactionsRef, orderBy('date', 'desc'));
      
      if (filterStatus !== 'all') {
        q = query(transactionsRef, where('status', '==', filterStatus), orderBy('date', 'desc'));
      }
      
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => {
        const docData = d.data() as any;
        const rawDate = docData.date;
        let date = new Date();
        if (rawDate && typeof (rawDate as any).toDate === 'function') {
          date = (rawDate as any).toDate();
        } else if (rawDate instanceof Date) {
          date = rawDate;
        } else {
          date = new Date(rawDate);
        }

        return {
          id: d.id,
          ...docData,
          date,
          createdAt: docData.createdAt,
        } as BoxTransaction;
      });
      
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showSnackbar('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchInventoryBalance();
  }, [filterStatus]);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  // Update inventory balance
  const updateInventoryBalance = async (
    type: 'take' | 'return' | 'adjustment',
    boxes: number,
    adjustmentType: 'add' | 'remove' = 'add'
  ) => {
    try {
      if (!inventoryBalance.id) return;

      const batch = writeBatch(db);
      const inventoryRef = doc(db, 'inventoryBalance', inventoryBalance.id);
      
      let updates: any = {
        lastUpdated: Timestamp.now(),
      };

      if (type === 'take') {
        updates.currentBalance = inventoryBalance.currentBalance - boxes;
        updates.totalTaken = inventoryBalance.totalTaken + boxes;
      } else if (type === 'return') {
        updates.currentBalance = inventoryBalance.currentBalance + boxes;
        updates.totalReturned = inventoryBalance.totalReturned + boxes;
      } else if (type === 'adjustment') {
        if (adjustmentType === 'add') {
          updates.currentBalance = inventoryBalance.currentBalance + boxes;
        } else {
          updates.currentBalance = inventoryBalance.currentBalance - boxes;
        }
        updates.totalAdjustments = inventoryBalance.totalAdjustments + boxes;
      }

      batch.update(inventoryRef, updates);
      await batch.commit();

      // Update local state
      setInventoryBalance(prev => ({
        ...prev,
        ...updates,
        lastUpdated: new Date(),
      }));

      return updates.currentBalance;
    } catch (error) {
      console.error('Error updating inventory balance:', error);
      throw error;
    }
  };

  const handleTakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (takeFormData.boxes <= 0) {
      showSnackbar('Please enter a valid number of boxes', 'error');
      return;
    }

    if (takeFormData.boxes > inventoryBalance.currentBalance) {
      showSnackbar(`Insufficient inventory! Only ${inventoryBalance.currentBalance} boxes available`, 'error');
      return;
    }

    setLoading(true);
    try {
      const balanceBefore = inventoryBalance.currentBalance;
      const balanceAfter = await updateInventoryBalance('take', takeFormData.boxes);

      const transactionData = {
        ...takeFormData,
        date: Timestamp.fromDate(new Date(takeFormData.date)),
        createdAt: Timestamp.now(),
        balanceBefore,
        balanceAfter,
      };

      if (editingId) {
        const docRef = doc(db, 'boxTransactions', editingId);
        await updateDoc(docRef, transactionData);
        showSnackbar('Box take updated successfully', 'success');
      } else {
        await addDoc(collection(db, 'boxTransactions'), transactionData);
        showSnackbar('Box take recorded successfully', 'success');
      }

      resetTakeForm();
      fetchTransactions();
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving transaction:', error);
      showSnackbar('Error saving transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (returnFormData.boxes <= 0) {
      showSnackbar('Please enter a valid number of boxes', 'error');
      return;
    }

    setLoading(true);
    try {
      const balanceBefore = inventoryBalance.currentBalance;
      const balanceAfter = await updateInventoryBalance('return', returnFormData.boxes);

      const transactionData: BoxTransaction = {
        transactionType: 'return',
        date: new Date(returnFormData.date),
        employeeName: returnFormData.employeeName,
        boxes: returnFormData.boxes,
        notes: returnFormData.notes,
        status: 'active',
        createdAt: Timestamp.now(),
        originalTakeId: returnFormData.originalTakeId,
        balanceBefore,
        balanceAfter,
      };

      await addDoc(collection(db, 'boxTransactions'), {
        ...transactionData,
        date: Timestamp.fromDate(transactionData.date),
      });

      showSnackbar('Box return recorded successfully', 'success');
      resetReturnForm();
      fetchTransactions();
      setSelectedPairForReturn(null);
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving transaction:', error);
      showSnackbar('Error saving transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustmentFormData.boxes <= 0) {
      showSnackbar('Please enter a valid number of boxes', 'error');
      return;
    }

    if (adjustmentFormData.adjustmentType === 'remove' && adjustmentFormData.boxes > inventoryBalance.currentBalance) {
      showSnackbar(`Cannot remove more boxes than available! Current balance: ${inventoryBalance.currentBalance}`, 'error');
      return;
    }

    setLoading(true);
    try {
      const balanceBefore = inventoryBalance.currentBalance;
      const balanceAfter = await updateInventoryBalance(
        'adjustment', 
        adjustmentFormData.boxes, 
        adjustmentFormData.adjustmentType
      );

      const transactionData: BoxTransaction = {
        transactionType: 'inventory_adjustment',
        date: new Date(adjustmentFormData.date),
        employeeName: 'System',
        boxes: adjustmentFormData.adjustmentType === 'add' ? adjustmentFormData.boxes : -adjustmentFormData.boxes,
        notes: `${adjustmentFormData.adjustmentType === 'add' ? 'Added' : 'Removed'} ${adjustmentFormData.boxes} boxes. ${adjustmentFormData.notes}`,
        status: 'active',
        createdAt: Timestamp.now(),
        balanceBefore,
        balanceAfter,
      };

      await addDoc(collection(db, 'boxTransactions'), {
        ...transactionData,
        date: Timestamp.fromDate(transactionData.date),
      });

      showSnackbar(`Inventory ${adjustmentFormData.adjustmentType === 'add' ? 'increased' : 'decreased'} successfully`, 'success');
      resetAdjustmentForm();
      fetchTransactions();
      setInventoryDialogOpen(false);
    } catch (error) {
      console.error('Error saving adjustment:', error);
      showSnackbar('Error saving adjustment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transaction: BoxTransaction) => {
    if (transaction.transactionType === 'take') {
      setTakeFormData({
        transactionType: 'take',
        date: new Date(transaction.date),
        employeeName: transaction.employeeName,
        boxes: transaction.boxes,
        notes: transaction.notes || '',
        status: transaction.status,
      });
      setActiveForm('take');
      setDialogOpen(true);
    }
    setEditingId(transaction.id || null);
  };

  const handleArchive = async (id: string, archive: boolean) => {
    try {
      const docRef = doc(db, 'boxTransactions', id);
      await updateDoc(docRef, { status: archive ? 'archived' : 'active' });
      showSnackbar(`Transaction ${archive ? 'archived' : 'restored'}`, 'success');
      fetchTransactions();
    } catch (error) {
      showSnackbar('Error updating status', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      try {
        // Get transaction before deleting
        const transaction = transactions.find(t => t.id === id);
        if (transaction) {
          // Reverse the inventory effect
          if (transaction.transactionType === 'take') {
            await updateInventoryBalance('return', transaction.boxes);
          } else if (transaction.transactionType === 'return') {
            await updateInventoryBalance('take', transaction.boxes);
          }
        }

        await deleteDoc(doc(db, 'boxTransactions', id));
        showSnackbar('Transaction deleted and inventory adjusted', 'success');
        fetchTransactions();
      } catch (error) {
        showSnackbar('Error deleting transaction', 'error');
      }
    }
  };

  const resetTakeForm = () => {
    setTakeFormData({
      transactionType: 'take',
      date: new Date(),
      employeeName: '',
      boxes: 0,
      notes: '',
      status: 'active',
    });
    setEditingId(null);
  };

  const resetReturnForm = () => {
    setReturnFormData({
      employeeName: '',
      boxes: 0,
      notes: '',
      date: new Date(),
      originalTakeId: '',
    });
  };

  const resetAdjustmentForm = () => {
    setAdjustmentFormData({
      adjustmentType: 'add',
      boxes: 0,
      notes: '',
      date: new Date(),
    });
  };

  const handleRowExpand = (pairId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(pairId)) {
      newExpandedRows.delete(pairId);
    } else {
      newExpandedRows.add(pairId);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleReturnForPair = (pair: BoxTransactionPair) => {
    setSelectedPairForReturn(pair);
    setReturnFormData({
      employeeName: pair.take.employeeName,
      boxes: Math.min(pair.difference, pair.take.boxes),
      notes: `Return for take on ${pair.take.date.toLocaleDateString()}`,
      date: new Date(),
      originalTakeId: pair.take.id,
    });
    setDialogOpen(true);
  };

  const generatePDFReport = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add company header
    doc.setFontSize(20);
    doc.setTextColor(PRIMARY_COLOR);
    doc.text('BOX INVENTORY MANAGEMENT SYSTEM', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text('Transaction Status Report', 105, 30, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 105, 38, { align: 'center' });

    // Add summary section
    doc.setFontSize(14);
    doc.setTextColor(PRIMARY_COLOR);
    doc.text('SUMMARY OVERVIEW', 20, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(60);
    
    const summaryData = [
      ['Current Inventory Balance', inventoryBalance.currentBalance.toString()],
      ['Total Boxes Taken', inventoryBalance.totalTaken.toString()],
      ['Total Boxes Returned', inventoryBalance.totalReturned.toString()],
      ['Total Adjustments', inventoryBalance.totalAdjustments.toString()],
      ['Pending Returns', balances.reduce((sum, b) => sum + b.pendingReturns, 0).toString()],
      ['Report Date', new Date().toLocaleDateString()],
    ];

    (doc as any).autoTable({
      startY: 55,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [31, 42, 56], textColor: 255 },
      styles: { fontSize: 10 },
      margin: { left: 20, right: 20 },
    });

    // Add employee balances section
    doc.setFontSize(14);
    doc.setTextColor(PRIMARY_COLOR);
    doc.text('EMPLOYEE BALANCES', 20, (doc as any).lastAutoTable.finalY + 15);

    const employeeData = balances.map(balance => [
      balance.employeeName,
      balance.totalTaken.toString(),
      balance.totalReturned.toString(),
      balance.balance.toString(),
      balance.pendingReturns.toString(),
    ]);

    (doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Employee', 'Taken', 'Returned', 'Balance', 'Pending Returns']],
      body: employeeData,
      theme: 'grid',
      headStyles: { fillColor: [31, 42, 56], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 35 },
      },
      styles: { fontSize: 9 },
      margin: { left: 20, right: 20 },
    });

    // Add detailed transactions section
    doc.setFontSize(14);
    doc.setTextColor(PRIMARY_COLOR);
    doc.text('DETAILED TRANSACTIONS', 20, (doc as any).lastAutoTable.finalY + 15);

    const transactionData = transactionPairs.map(pair => [
      pair.take.date.toLocaleDateString(),
      pair.take.employeeName,
      pair.take.boxes.toString(),
      pair.return?.boxes?.toString() || '0',
      pair.difference.toString(),
      pair.status.toUpperCase(),
    ]);

    (doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Date', 'Employee', 'Taken', 'Returned', 'Difference', 'Status']],
      body: transactionData,
      theme: 'grid',
      headStyles: { fillColor: [31, 42, 56], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
      },
      styles: { fontSize: 9 },
      margin: { left: 20, right: 20 },
    });

    // Add footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, 105, 287, { align: 'center' });
      doc.text(`Generated by Box Management System`, 105, 292, { align: 'center' });
    }

    // Save the PDF
    doc.save(`box-inventory-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateInvoicePDF = (pair: BoxTransactionPair) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Invoice header
    doc.setFontSize(24);
    doc.setTextColor(PRIMARY_COLOR);
    doc.text('INVOICE / RECEIPT', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text('Box Transaction Document', 105, 30, { align: 'center' });
    
    // Invoice details
    doc.setFontSize(10);
    doc.setTextColor(60);
    
    const invoiceDetails = [
      ['Invoice Number', `INV-${pair.take.id?.slice(-8) || 'N/A'}`],
      ['Invoice Date', new Date().toLocaleDateString()],
      ['Employee', pair.take.employeeName],
      ['Transaction Date', pair.take.date.toLocaleDateString()],
      ['Status', pair.status.toUpperCase()],
    ];

    (doc as any).autoTable({
      startY: 40,
      body: invoiceDetails,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 5 },
      margin: { left: 20, right: 20 },
    });

    // Transaction details table
    doc.setFontSize(14);
    doc.setTextColor(PRIMARY_COLOR);
    doc.text('TRANSACTION DETAILS', 20, (doc as any).lastAutoTable.finalY + 15);

    const transactionDetails = [
      ['Description', 'Quantity', 'Unit', 'Total'],
      ['Boxes Taken', pair.take.boxes.toString(), 'pcs', pair.take.boxes.toString()],
      ['Boxes Returned', (pair.return?.boxes || 0).toString(), 'pcs', (pair.return?.boxes || 0).toString()],
      ['Difference', pair.difference.toString(), 'pcs', pair.difference.toString()],
    ];

    (doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Description', 'Quantity', 'Unit', 'Total']],
      body: transactionDetails,
      theme: 'grid',
      headStyles: { fillColor: [31, 42, 56], textColor: 255 },
      styles: { fontSize: 10 },
      margin: { left: 20, right: 20 },
    });

    // Summary section
    doc.setFontSize(12);
    doc.setTextColor(PRIMARY_COLOR);
    const summaryY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.text('SUMMARY', 20, summaryY);
    doc.setFontSize(10);
    doc.setTextColor(60);
    
    const summaryText = [
      `Status: ${pair.status.toUpperCase()}`,
      `Balance Remaining: ${pair.difference} boxes`,
      pair.return ? `Return Date: ${pair.return.date.toLocaleDateString()}` : 'Awaiting Return',
      `Notes: ${pair.take.notes || 'No additional notes'}`,
    ];

    summaryText.forEach((text, index) => {
      doc.text(text, 20, summaryY + 10 + (index * 5));
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('This is an official transaction document.', 105, 280, { align: 'center' });
    doc.text('Generated by Box Management System', 105, 285, { align: 'center' });

    doc.save(`invoice-${pair.take.employeeName}-${pair.take.date.toLocaleDateString().replace(/\//g, '-')}.pdf`);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      transactionPairs.map(pair => ({
        'Take Date': pair.take.date.toLocaleDateString(),
        'Employee Name': pair.take.employeeName,
        'Boxes Taken': pair.take.boxes,
        'Boxes Returned': pair.return?.boxes || 0,
        'Difference': pair.difference,
        'Status': pair.status.toUpperCase(),
        'Take Notes': pair.take.notes || '',
        'Return Notes': pair.return?.notes || '',
        'Take ID': pair.take.id,
        'Return ID': pair.return?.id || '',
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transaction Pairs');
    
    // Add inventory summary sheet
    const inventorySheet = XLSX.utils.json_to_sheet([
      {
        'Current Balance': inventoryBalance.currentBalance,
        'Total Taken': inventoryBalance.totalTaken,
        'Total Returned': inventoryBalance.totalReturned,
        'Total Adjustments': inventoryBalance.totalAdjustments,
        'Last Updated': inventoryBalance.lastUpdated.toLocaleDateString(),
      }
    ]);
    XLSX.utils.book_append_sheet(workbook, inventorySheet, 'Inventory Summary');
    
    // Add employee balances sheet
    const employeeSheet = XLSX.utils.json_to_sheet(
      balances.map(b => ({
        'Employee': b.employeeName,
        'Total Taken': b.totalTaken,
        'Total Returned': b.totalReturned,
        'Balance': b.balance,
        'Pending Returns': b.pendingReturns,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Employee Balances');
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `box-transaction-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const importFromExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        for (const item of jsonData) {
          const transaction: Omit<BoxTransaction, 'id' | 'createdAt'> = {
            transactionType: (item as any).Type === 'Return' ? 'return' : (item as any).Type === 'Adjustment' ? 'inventory_adjustment' : 'take',
            date: Timestamp.fromDate(new Date((item as any).Date)),
            employeeName: (item as any)['Employee Name'],
            boxes: Number((item as any).Boxes),
            status: 'active',
            notes: (item as any).Notes || '',
            referenceId: (item as any)['Reference ID'] || '',
            balanceBefore: Number((item as any)['Balance Before']) || 0,
            balanceAfter: Number((item as any)['Balance After']) || 0,
          };

          await addDoc(collection(db, 'boxTransactions'), {
            ...transaction,
            createdAt: Timestamp.now(),
          });
        }

        showSnackbar('Data imported successfully', 'success');
        fetchTransactions();
      } catch (error) {
        showSnackbar('Error importing data', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredPairs = transactionPairs.filter(pair =>
    pair.take.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pair.take.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pair.return?.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'partial': return 'warning';
      case 'pending': return 'error';
      default: return 'default';
    }
  };

  const getBalanceColor = (balance: number) => {
    if (balance === 0) return 'text.secondary';
    if (balance > 100) return 'success.main';
    if (balance > 50) return 'warning.main';
    return 'error.main';
  };

  const getBalancePercentage = () => {
    const maxCapacity = Math.max(inventoryBalance.currentBalance, 100);
    return (inventoryBalance.currentBalance / maxCapacity) * 100;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ 
        minHeight: '100vh', 
        bgcolor: '#f5f6f8',
        p: isMobile ? 1 : 3 
      }}>
        <Paper sx={{ 
          borderRadius: 1, 
          overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        }}>
          {/* Header */}
          <Box sx={{ 
            bgcolor: PRIMARY_COLOR, 
            color: 'white', 
            p: 3,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? 2 : 0
          }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptIcon /> Box Transaction & Invoice System
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                Track Takes, Returns, Differences & Generate Invoices
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<PdfIcon />}
                onClick={generatePDFReport}
                sx={{ bgcolor: '#B91C1C' }}
              >
                PDF Report
              </Button>
              <Button
                variant="contained"
                startIcon={<UploadIcon />}
                component="label"
                sx={{ bgcolor: SECONDARY_COLOR, '&:hover': { bgcolor: '#4a5a6e' } }}
              >
                Import Excel
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls"
                  onChange={importFromExcel}
                />
              </Button>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={exportToExcel}
                sx={{ bgcolor: ACCENT_COLOR }}
              >
                Export Excel
              </Button>
            </Box>
          </Box>

          {/* Inventory Summary Card */}
          <Box sx={{ p: 2 }}>
            <Card sx={{ bgcolor: 'white', border: `2px solid ${BALANCE_COLOR}` }}>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ 
                        bgcolor: BALANCE_COLOR, 
                        p: 2, 
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <AccountBalanceIcon sx={{ fontSize: 40, color: 'white' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" color="text.secondary">
                          Current Inventory Balance
                        </Typography>
                        <Typography variant="h2" sx={{ 
                          color: getBalanceColor(inventoryBalance.currentBalance),
                          fontWeight: 700 
                        }}>
                          {inventoryBalance.currentBalance}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Last updated: {inventoryBalance.lastUpdated.toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={5}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Inventory Status
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={getBalancePercentage()} 
                        sx={{ 
                          height: 10, 
                          borderRadius: 5,
                          bgcolor: '#e0e0e0',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: getBalancePercentage() > 50 ? '#4caf50' : 
                                     getBalancePercentage() > 20 ? '#ff9800' : '#f44336'
                          }
                        }} 
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          Low
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {Math.round(getBalancePercentage())}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          High
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={3}>
                    <Button
                      variant="contained"
                      startIcon={<AddCircleIcon />}
                      onClick={() => setInventoryDialogOpen(true)}
                      sx={{ 
                        bgcolor: INVENTORY_COLOR,
                        '&:hover': { bgcolor: '#ea580ce6' },
                        width: '100%'
                      }}
                    >
                      Adjust Inventory
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>

          {/* Quick Action Buttons */}
          <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<TrendingDownIcon />}
              onClick={() => { setActiveForm('take'); resetTakeForm(); setDialogOpen(true); }}
              disabled={inventoryBalance.currentBalance <= 0}
              sx={{ 
                bgcolor: TAKE_COLOR,
                '&:hover': { bgcolor: '#dc2626e6' },
                '&.Mui-disabled': {
                  bgcolor: '#ccc',
                }
              }}
            >
              Record New Take
            </Button>
            
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
              <Tooltip title="Total boxes taken from inventory">
                <Chip 
                  icon={<TrendingDownIcon />}
                  label={`Taken: ${inventoryBalance.totalTaken}`}
                  color="error"
                  variant="outlined"
                />
              </Tooltip>
              <Tooltip title="Total boxes returned to inventory">
                <Chip 
                  icon={<TrendingUpIcon />}
                  label={`Returned: ${inventoryBalance.totalReturned}`}
                  color="success"
                  variant="outlined"
                />
              </Tooltip>
              <Tooltip title="Total pending returns">
                <Chip 
                  icon={<DifferenceIcon />}
                  label={`Pending: ${balances.reduce((sum, b) => sum + b.pendingReturns, 0)}`}
                  color="warning"
                  variant="outlined"
                />
              </Tooltip>
            </Box>
          </Box>

          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={activeTab} 
              onChange={(_, newValue) => setActiveTab(newValue)}
              sx={{ 
                '& .MuiTab-root': { 
                  fontWeight: 500,
                  textTransform: 'none',
                  fontSize: '0.875rem'
                }
              }}
            >
              <Tab label="Transaction Pairs" />
              <Tab label="Employee Balances" />
              <Tab label="Inventory Details" />
              <Tab label="Archived" />
            </Tabs>
          </Box>

          {/* Search and Filter */}
          <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search by employee or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
              }}
              sx={{ minWidth: 200 }}
            />
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value as any)}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </Select>
            </FormControl>
            
            <Chip
              icon={<FilterIcon />}
              label={`${filteredPairs.length} Records`}
              variant="outlined"
            />
          </Box>

          {/* Main Content */}
          <TabPanel value={activeTab} index={0}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Take Date</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Taken</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Returned</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Difference</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPairs.map((pair, index) => {
                      const pairId = `${pair.take.id}-${index}`;
                      const isExpanded = expandedRows.has(pairId);
                      
                      return (
                        <React.Fragment key={pairId}>
                          <TableRow 
                            hover
                            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                          >
                            <TableCell>
                              <IconButton
                                aria-label="expand row"
                                size="small"
                                onClick={() => handleRowExpand(pairId)}
                              >
                                {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                              </IconButton>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <CalendarIcon fontSize="small" />
                                {pair.take.date.toLocaleDateString()}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography fontWeight={500}>
                                {pair.take.employeeName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography fontWeight={600} color={TAKE_COLOR}>
                                {pair.take.boxes}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography fontWeight={600} color={RETURN_COLOR}>
                                {pair.return?.boxes || 0}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={pair.difference}
                                color={pair.difference === 0 ? "success" : pair.difference > 0 ? "warning" : "error"}
                                size="small"
                                icon={<DifferenceIcon />}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={pair.status.toUpperCase()} 
                                color={getStatusColor(pair.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {pair.difference > 0 && (
                                  <Tooltip title="Record Return">
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleReturnForPair(pair)}
                                      sx={{ color: RETURN_COLOR }}
                                    >
                                      <TrendingUpIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="Generate Invoice">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => generateInvoicePDF(pair)}
                                    sx={{ color: '#B91C1C' }}
                                  >
                                    <PdfIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit Take">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleEdit(pair.take)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Archive">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleArchive(pair.take.id!, true)}
                                  >
                                    <ArchiveIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                          
                          {/* Expanded Details Row */}
                          <TableRow>
                            <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                <Box sx={{ margin: 2 }}>
                                  <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                      <Card variant="outlined">
                                        <CardContent>
                                          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <TrendingDownIcon /> Take Details
                                          </Typography>
                                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                              <Typography variant="caption" color="text.secondary">Date:</Typography>
                                              <Typography variant="body2">{pair.take.date.toLocaleDateString()}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                              <Typography variant="caption" color="text.secondary">Boxes:</Typography>
                                              <Typography variant="body2" fontWeight={600} color={TAKE_COLOR}>
                                                {pair.take.boxes}
                                              </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                              <Typography variant="caption" color="text.secondary">Notes:</Typography>
                                              <Typography variant="body2">{pair.take.notes || 'No notes'}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                              <Typography variant="caption" color="text.secondary">Transaction ID:</Typography>
                                              <Typography variant="caption" color="text.secondary">
                                                {pair.take.id?.slice(-8) || 'N/A'}
                                              </Typography>
                                            </Box>
                                          </Box>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                    
                                    <Grid item xs={12} md={6}>
                                      <Card variant="outlined">
                                        <CardContent>
                                          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <TrendingUpIcon /> Return Details
                                          </Typography>
                                          {pair.return ? (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="caption" color="text.secondary">Date:</Typography>
                                                <Typography variant="body2">{pair.return.date.toLocaleDateString()}</Typography>
                                              </Box>
                                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="caption" color="text.secondary">Boxes:</Typography>
                                                <Typography variant="body2" fontWeight={600} color={RETURN_COLOR}>
                                                  {pair.return.boxes}
                                                </Typography>
                                              </Box>
                                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="caption" color="text.secondary">Notes:</Typography>
                                                <Typography variant="body2">{pair.return.notes || 'No notes'}</Typography>
                                              </Box>
                                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="caption" color="text.secondary">Transaction ID:</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                  {pair.return.id?.slice(-8) || 'N/A'}
                                                </Typography>
                                              </Box>
                                            </Box>
                                          ) : (
                                            <Typography variant="body2" color="text.secondary" align="center">
                                              Awaiting return
                                            </Typography>
                                          )}
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                    
                                    <Grid item xs={12}>
                                      <Card variant="outlined" sx={{ bgcolor: '#f8f9fa' }}>
                                        <CardContent>
                                          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <DifferenceIcon /> Summary
                                          </Typography>
                                          <Grid container spacing={2}>
                                            <Grid item xs={12} md={3}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="caption" color="text.secondary">Taken</Typography>
                                                <Typography variant="h6" color={TAKE_COLOR}>
                                                  {pair.take.boxes}
                                                </Typography>
                                              </Box>
                                            </Grid>
                                            <Grid item xs={12} md={3}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="caption" color="text.secondary">Returned</Typography>
                                                <Typography variant="h6" color={RETURN_COLOR}>
                                                  {pair.return?.boxes || 0}
                                                </Typography>
                                              </Box>
                                            </Grid>
                                            <Grid item xs={12} md={3}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="caption" color="text.secondary">Difference</Typography>
                                                <Typography variant="h6" color={DIFFERENCE_COLOR}>
                                                  {pair.difference}
                                                </Typography>
                                              </Box>
                                            </Grid>
                                            <Grid item xs={12} md={3}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="caption" color="text.secondary">Status</Typography>
                                                <Chip 
                                                  label={pair.status.toUpperCase()} 
                                                  color={getStatusColor(pair.status)}
                                                  size="small"
                                                />
                                              </Box>
                                            </Grid>
                                          </Grid>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                  </Grid>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <VisibilityIcon /> Employee Balance Overview
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                            <TableCell sx={{ fontWeight: 600 }} align="right">Total Taken</TableCell>
                            <TableCell sx={{ fontWeight: 600 }} align="right">Total Returned</TableCell>
                            <TableCell sx={{ fontWeight: 600 }} align="right">Balance</TableCell>
                            <TableCell sx={{ fontWeight: 600 }} align="right">Pending Returns</TableCell>
                            <TableCell sx={{ fontWeight: 600 }} align="center">Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {balances.map((balance, index) => (
                            <TableRow key={index} hover>
                              <TableCell>
                                <Typography fontWeight={500}>
                                  {balance.employeeName}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip 
                                  label={balance.totalTaken} 
                                  color="error" 
                                  variant="outlined"
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Chip 
                                  label={balance.totalReturned} 
                                  color="success" 
                                  variant="outlined"
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Chip 
                                  label={balance.balance} 
                                  color={balance.balance > 0 ? "error" : "success"}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Chip 
                                  label={balance.pendingReturns} 
                                  color={balance.pendingReturns > 0 ? "warning" : "success"}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Chip 
                                  label={balance.pendingReturns > 0 ? "PENDING" : "CLEARED"} 
                                  color={balance.pendingReturns > 0 ? "warning" : "success"}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Summary Cards */}
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <WarehouseIcon sx={{ color: BALANCE_COLOR }} /> Current Inventory
                    </Typography>
                    <Typography variant="h3" sx={{ color: BALANCE_COLOR }}>
                      {inventoryBalance.currentBalance}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Boxes in stock
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <TrendingDownIcon sx={{ color: TAKE_COLOR }} /> Total Taken
                    </Typography>
                    <Typography variant="h3" sx={{ color: TAKE_COLOR }}>
                      {inventoryBalance.totalTaken}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total boxes taken
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <TrendingUpIcon sx={{ color: RETURN_COLOR }} /> Total Returned
                    </Typography>
                    <Typography variant="h3" sx={{ color: RETURN_COLOR }}>
                      {inventoryBalance.totalReturned}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total boxes returned
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <DifferenceIcon sx={{ color: DIFFERENCE_COLOR }} /> Pending
                    </Typography>
                    <Typography variant="h3" sx={{ color: DIFFERENCE_COLOR }}>
                      {balances.reduce((sum, b) => sum + b.pendingReturns, 0)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Boxes pending return
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InventoryIcon /> Detailed Transactions
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Boxes</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Inventory Before</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Inventory After</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {transactions
                            .filter(t => t.status === 'active')
                            .map((transaction) => (
                              <TableRow key={transaction.id} hover>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <CalendarIcon fontSize="small" />
                                    {transaction.date.toLocaleDateString()}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Chip 
                                    label={
                                      transaction.transactionType === 'take' ? 'TAKE' : 
                                      transaction.transactionType === 'return' ? 'RETURN' : 'ADJUST'
                                    } 
                                    color={
                                      transaction.transactionType === 'take' ? "error" : 
                                      transaction.transactionType === 'return' ? "success" : "warning"
                                    }
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {transaction.employeeName}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography 
                                    variant="body2"
                                    fontWeight={600}
                                    color={
                                      transaction.transactionType === 'take' ? TAKE_COLOR : 
                                      transaction.transactionType === 'return' ? RETURN_COLOR :
                                      transaction.boxes > 0 ? RETURN_COLOR : TAKE_COLOR
                                    }
                                  >
                                    {transaction.transactionType === 'inventory_adjustment' ? 
                                      `${transaction.boxes > 0 ? '+' : ''}${transaction.boxes}` : 
                                      transaction.boxes}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" color="text.secondary">
                                    {transaction.balanceBefore || 'N/A'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" color="text.secondary">
                                    {transaction.balanceAfter || 'N/A'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption" color="text.secondary">
                                    {transaction.notes || '-'}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Boxes</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions
                    .filter(t => t.status === 'archived')
                    .map((transaction) => (
                      <TableRow key={transaction.id} hover>
                        <TableCell>
                          <Chip 
                            label={
                              transaction.transactionType === 'take' ? 'TAKE' : 
                              transaction.transactionType === 'return' ? 'RETURN' : 'ADJUST'
                            } 
                            color={
                              transaction.transactionType === 'take' ? "error" : 
                              transaction.transactionType === 'return' ? "success" : "warning"
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{transaction.date.toLocaleDateString()}</TableCell>
                        <TableCell>{transaction.employeeName}</TableCell>
                        <TableCell>{transaction.boxes}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleArchive(transaction.id!, false)}>
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </Paper>

        {/* Form Dialogs */}
        {/* Take Form Dialog */}
        <Dialog 
          open={dialogOpen && activeForm === 'take'} 
          onClose={() => setDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ bgcolor: TAKE_COLOR, color: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingDownIcon /> {editingId ? 'Edit Box Take' : 'Record Box Take'}
            </Box>
          </DialogTitle>
          <form onSubmit={handleTakeSubmit}>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Take Date"
                      value={takeFormData.date}
                      onChange={(newValue) => setTakeFormData({ ...takeFormData, date: newValue || new Date() })}
                      slotProps={{ 
                        textField: { 
                          fullWidth: true, 
                          required: true,
                          InputProps: {
                            startAdornment: <CalendarIcon sx={{ mr: 1, color: TAKE_COLOR }} />,
                          }
                        } 
                      }}
                    />
                  </LocalizationProvider>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    label="Employee Name"
                    fullWidth
                    required
                    value={takeFormData.employeeName}
                    onChange={(e) => setTakeFormData({ ...takeFormData, employeeName: e.target.value })}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    label="Number of Boxes Taken"
                    type="number"
                    fullWidth
                    required
                    value={takeFormData.boxes}
                    onChange={(e) => setTakeFormData({ ...takeFormData, boxes: parseInt(e.target.value) || 0 })}
                    InputProps={{ 
                      inputProps: { min: 1, max: inventoryBalance.currentBalance },
                      startAdornment: <InventoryIcon sx={{ mr: 1, color: TAKE_COLOR }} />,
                    }}
                    helperText={`Available inventory: ${inventoryBalance.currentBalance} boxes`}
                    error={takeFormData.boxes > inventoryBalance.currentBalance}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    label="Notes (Optional)"
                    fullWidth
                    multiline
                    rows={2}
                    value={takeFormData.notes}
                    onChange={(e) => setTakeFormData({ ...takeFormData, notes: e.target.value })}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || takeFormData.boxes > inventoryBalance.currentBalance}
                sx={{ bgcolor: TAKE_COLOR }}
              >
                {loading ? <CircularProgress size={24} /> : editingId ? 'Update Take' : 'Record Take'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Return Form Dialog */}
        <Dialog 
          open={dialogOpen && selectedPairForReturn !== null} 
          onClose={() => {
            setDialogOpen(false);
            setSelectedPairForReturn(null);
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ bgcolor: RETURN_COLOR, color: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon /> Record Box Return
            </Box>
          </DialogTitle>
          <form onSubmit={handleReturnSubmit}>
            <DialogContent>
              {selectedPairForReturn && (
                <Box sx={{ mb: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Returning boxes for:
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Employee:</Typography>
                      <Typography variant="body2">{selectedPairForReturn.take.employeeName}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Taken:</Typography>
                      <Typography variant="body2" color={TAKE_COLOR}>
                        {selectedPairForReturn.take.boxes} boxes
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Already Returned:</Typography>
                      <Typography variant="body2" color={RETURN_COLOR}>
                        {selectedPairForReturn.return?.boxes || 0} boxes
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Remaining:</Typography>
                      <Typography variant="body2" color={DIFFERENCE_COLOR} fontWeight={600}>
                        {selectedPairForReturn.difference} boxes
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
              
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Return Date"
                      value={returnFormData.date}
                      onChange={(newValue) => setReturnFormData({ ...returnFormData, date: newValue || new Date() })}
                      slotProps={{ 
                        textField: { 
                          fullWidth: true, 
                          required: true,
                          InputProps: {
                            startAdornment: <CalendarIcon sx={{ mr: 1, color: RETURN_COLOR }} />,
                          }
                        } 
                      }}
                    />
                  </LocalizationProvider>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    label="Number of Boxes Returned"
                    type="number"
                    fullWidth
                    required
                    value={returnFormData.boxes}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      const maxReturn = selectedPairForReturn?.difference || 0;
                      setReturnFormData({ 
                        ...returnFormData, 
                        boxes: Math.min(value, maxReturn)
                      });
                    }}
                    InputProps={{ 
                      inputProps: { 
                        min: 1, 
                        max: selectedPairForReturn?.difference || 0 
                      },
                      startAdornment: <Inventory2Icon sx={{ mr: 1, color: RETURN_COLOR }} />,
                    }}
                    helperText={`Maximum returnable: ${selectedPairForReturn?.difference || 0} boxes`}
                    error={returnFormData.boxes > (selectedPairForReturn?.difference || 0)}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    label="Notes (Optional)"
                    fullWidth
                    multiline
                    rows={3}
                    value={returnFormData.notes}
                    onChange={(e) => setReturnFormData({ ...returnFormData, notes: e.target.value })}
                    placeholder="Add any notes about the return condition or details..."
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={() => {
                setDialogOpen(false);
                setSelectedPairForReturn(null);
              }}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || returnFormData.boxes > (selectedPairForReturn?.difference || 0)}
                sx={{ bgcolor: RETURN_COLOR }}
              >
                {loading ? <CircularProgress size={24} /> : 'Record Return'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Inventory Adjustment Dialog */}
        <Dialog 
          open={inventoryDialogOpen} 
          onClose={() => setInventoryDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ bgcolor: INVENTORY_COLOR, color: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SwapIcon /> Adjust Inventory Balance
            </Box>
          </DialogTitle>
          <form onSubmit={handleAdjustmentSubmit}>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">
                      Current Balance: {inventoryBalance.currentBalance}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Adjustment Date"
                      value={adjustmentFormData.date}
                      onChange={(newValue) => setAdjustmentFormData({ ...adjustmentFormData, date: newValue || new Date() })}
                      slotProps={{ 
                        textField: { 
                          fullWidth: true, 
                          required: true,
                        } 
                      }}
                    />
                  </LocalizationProvider>
                </Grid>
                
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Adjustment Type</InputLabel>
                    <Select
                      value={adjustmentFormData.adjustmentType}
                      label="Adjustment Type"
                      onChange={(e) => setAdjustmentFormData({ ...adjustmentFormData, adjustmentType: e.target.value as 'add' | 'remove' })}
                    >
                      <MenuItem value="add">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AddCircleIcon sx={{ color: RETURN_COLOR }} /> Add to Inventory
                        </Box>
                      </MenuItem>
                      <MenuItem value="remove">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <RemoveCircleIcon sx={{ color: TAKE_COLOR }} /> Remove from Inventory
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    label="Number of Boxes"
                    type="number"
                    fullWidth
                    required
                    value={adjustmentFormData.boxes}
                    onChange={(e) => setAdjustmentFormData({ ...adjustmentFormData, boxes: parseInt(e.target.value) || 0 })}
                    InputProps={{ inputProps: { min: 1 } }}
                    helperText={
                      adjustmentFormData.adjustmentType === 'remove' 
                        ? `Maximum removable: ${inventoryBalance.currentBalance}` 
                        : undefined
                    }
                    error={adjustmentFormData.adjustmentType === 'remove' && adjustmentFormData.boxes > inventoryBalance.currentBalance}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    label="Reason for Adjustment"
                    fullWidth
                    multiline
                    rows={3}
                    value={adjustmentFormData.notes}
                    onChange={(e) => setAdjustmentFormData({ ...adjustmentFormData, notes: e.target.value })}
                    placeholder="Explain why you're adjusting the inventory (e.g., new stock, damaged boxes, etc.)"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Adjustment Preview
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2">
                          Current Balance
                        </Typography>
                        <Typography variant="h6">
                          {inventoryBalance.currentBalance}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                        <Typography variant="body2">
                          {adjustmentFormData.adjustmentType === 'add' ? 'Addition' : 'Removal'}
                        </Typography>
                        <Typography 
                          variant="h6" 
                          color={adjustmentFormData.adjustmentType === 'add' ? RETURN_COLOR : TAKE_COLOR}
                        >
                          {adjustmentFormData.adjustmentType === 'add' ? '+' : '-'}{adjustmentFormData.boxes}
                        </Typography>
                      </Box>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" fontWeight="bold">
                          New Balance
                        </Typography>
                        <Typography variant="h5" fontWeight="bold">
                          {adjustmentFormData.adjustmentType === 'add' 
                            ? inventoryBalance.currentBalance + adjustmentFormData.boxes
                            : inventoryBalance.currentBalance - adjustmentFormData.boxes}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button onClick={() => setInventoryDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || 
                  (adjustmentFormData.adjustmentType === 'remove' && adjustmentFormData.boxes > inventoryBalance.currentBalance)
                }
                sx={{ bgcolor: INVENTORY_COLOR }}
              >
                {loading ? <CircularProgress size={24} /> : 'Apply Adjustment'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default BoxTrackingComponent;