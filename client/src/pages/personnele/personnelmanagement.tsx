import React, { useState, useEffect, useMemo } from 'react';
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
  Save
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
  Timestamp 
} from 'firebase/firestore';

// Worker interface to define worker structure
interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  position: 'Operator' | 'Supervisor' | 'Manager' | 'Quality Controller' | 'Packer' | 'Driver';
  department: 'Production' | 'Quality Control' | 'Packaging' | 'Logistics' | 'Administration';
  phoneNumber: string;
  address?: string;
  hireDate: string;
  fireDate?: string;
  salary?: number;
  hourlyRate?: number;
  status: 'Active' | 'Inactive' | 'On Leave' | 'Fired' | 'Resigned';
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const PersonnelManagement: React.FC = () => {
  // State to manage workers
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  // State for new worker form
  const [newWorker, setNewWorker] = useState<Omit<Worker, 'id'>>({
    firstName: '',
    lastName: '',
    email: '',
    position: 'Operator',
    department: 'Production',
    phoneNumber: '',
    address: '',
    hireDate: '',
    fireDate: '',
    status: 'Active',
    salary: 0,
    hourlyRate: 0,
    emergencyContact: {
      name: '',
      phone: '',
      relationship: ''
    },
    notes: ''
  });

  // State for modal visibility and edit mode
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isFireModalOpen, setIsFireModalOpen] = useState(false);
  const [firingWorker, setFiringWorker] = useState<Worker | null>(null);
  const [fireReason, setFireReason] = useState('');

  // State for search and filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Worker['status'] | ''>('');
  const [departmentFilter, setDepartmentFilter] = useState<Worker['department'] | ''>('');

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{key: keyof Worker, direction: 'asc' | 'desc'}>({
    key: 'lastName',
    direction: 'asc'
  });

  // Firebase functions
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

  // Save worker to Firebase
  const saveWorkerToFirebase = async (workerData: Omit<Worker, 'id'>) => {
    try {
      const docData = {
        ...workerData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await addDoc(collection(db, 'personnel'), docData);
    } catch (error) {
      console.error('Error adding worker:', error);
      alert('Error saving worker. Please try again.');
    }
  };

  // Update worker in Firebase
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

  // Delete worker from Firebase
  const deleteWorkerFromFirebase = async (workerId: string) => {
    try {
      await deleteDoc(doc(db, 'personnel', workerId));
    } catch (error) {
      console.error('Error deleting worker:', error);
      alert('Error deleting worker. Please try again.');
    }
  };

  // Fire worker
  const fireWorker = async () => {
    if (!firingWorker) return;

    try {
      const fireData = {
        status: 'Fired' as const,
        fireDate: new Date().toISOString().split('T')[0],
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

  // Handle input changes for new worker
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const currentWorker = editingWorker ? editingWorker : newWorker;

    // Handle nested emergency contact fields
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

    const updatedWorker = {
      ...currentWorker,
      [name]: name === 'salary' || name === 'hourlyRate' ? Number(value) : value
    };

    if (editingWorker) {
      setEditingWorker(updatedWorker as Worker);
    } else {
      setNewWorker(updatedWorker);
    }
  };

  // Add or update worker
  const saveWorker = async () => {
    if (editingWorker) {
      // Update existing worker
      await updateWorkerInFirebase(editingWorker.id, editingWorker);
      setEditingWorker(null);
    } else {
      // Add new worker
      await saveWorkerToFirebase(newWorker);
    }

    // Reset form and close modal
    setNewWorker({
      firstName: '',
      lastName: '',
      email: '',
      position: 'Operator',
      department: 'Production',
      phoneNumber: '',
      address: '',
      hireDate: '',
      fireDate: '',
      status: 'Active',
      salary: 0,
      hourlyRate: 0,
      emergencyContact: {
        name: '',
        phone: '',
        relationship: ''
      },
      notes: ''
    });
    setIsModalOpen(false);
  };

  // Edit worker
  const editWorker = (worker: Worker) => {
    setEditingWorker({...worker});
    setIsModalOpen(true);
  };

  // Delete worker
  const deleteWorker = async (workerId: string) => {
    // Confirm before deletion
    if (window.confirm('Are you sure you want to delete this worker?')) {
      await deleteWorkerFromFirebase(workerId);
    }
  };

  // Sorting function
  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const key = sortConfig.key;
      if (a[key] === undefined || b[key] === undefined) return 0; // Type guard to handle undefined keys
      if (a[key] < b[key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [workers, sortConfig]);

  // Filtered and sorted workers
  const filteredWorkers = useMemo(() => {
    return sortedWorkers.filter(worker => {
      const matchesSearch = 
        worker.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        worker.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        worker.phoneNumber.includes(searchTerm) ||
        (worker.email && worker.email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = 
        !statusFilter || worker.status === statusFilter;

      const matchesDepartment = 
        !departmentFilter || worker.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [sortedWorkers, searchTerm, statusFilter, departmentFilter]);

  // Handle sorting
  const handleSort = (key: keyof Worker) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Enhanced Export all users to Excel
  const exportAllUsersToExcel = () => {
    if (workers.length === 0) {
      alert('No users to export.');
      return;
    }
    // Prepare data for Excel
    const data = workers.map(worker => ({
      ID: worker.id,
      'First Name': worker.firstName,
      'Last Name': worker.lastName,
      Email: worker.email || '',
      Position: worker.position,
      Department: worker.department,
      'Phone Number': worker.phoneNumber,
      Address: worker.address || '',
      'Hire Date': worker.hireDate,
      'Fire Date': worker.fireDate || '',
      Status: worker.status,
      Salary: worker.salary || '',
      'Hourly Rate': worker.hourlyRate || '',
      'Emergency Contact Name': worker.emergencyContact?.name || '',
      'Emergency Contact Phone': worker.emergencyContact?.phone || '',
      'Emergency Contact Relationship': worker.emergencyContact?.relationship || '',
      Notes: worker.notes || ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    // Set column widths
    worksheet['!cols'] = [
      { wch: 10 }, // ID
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 25 }, // Email
      { wch: 18 }, // Position
      { wch: 18 }, // Department
      { wch: 16 }, // Phone Number
      { wch: 20 }, // Address
      { wch: 12 }, // Hire Date
      { wch: 12 }, // Fire Date
      { wch: 12 }, // Status
      { wch: 10 }, // Salary
      { wch: 12 }, // Hourly Rate
      { wch: 20 }, // Emergency Contact Name
      { wch: 18 }, // Emergency Contact Phone
      { wch: 22 }, // Emergency Contact Relationship
      { wch: 30 }, // Notes
    ];
    // Style header row: bold, background color, borders
    const range = XLSX.utils.decode_range(worksheet['!ref']!);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (cell) {
        cell.s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '2563EB' } }, // blue-600
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } },
          },
          alignment: { horizontal: 'center' },
        };
      }
    }
    // Add borders to all data cells
    for (let R = 1; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell) {
          cell.s = {
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } },
            },
            alignment: { horizontal: 'left' },
          };
        }
      }
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    // Enable styles (requires xlsx-style or SheetJS Pro, but will not error if not present)
    XLSX.writeFile(workbook, 'all_users.xlsx', { cellStyles: true });
  };

  // Import users from Excel (robust, with loading and error handling)
  const [importing, setImporting] = useState(false);
  const [removingDuplicates, setRemovingDuplicates] = useState(false);

  // Function to detect and remove duplicate workers
  const removeDuplicateWorkers = async () => {
    if (workers.length === 0) {
      alert('No workers to check for duplicates.');
      return;
    }

    setRemovingDuplicates(true);
    
    try {
      // Create a map to track unique workers and duplicates
      const uniqueWorkers = new Map<string, Worker>();
      const duplicatesToRemove: Worker[] = [];

      // Sort workers by creation date (keep the oldest record)
      const sortedWorkers = [...workers].sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

      sortedWorkers.forEach(worker => {
        // Create a unique key based on multiple criteria
        const normalizedFirstName = worker.firstName.toLowerCase().trim();
        const normalizedLastName = worker.lastName.toLowerCase().trim();
        const normalizedPhone = worker.phoneNumber.replace(/\D/g, ''); // Remove non-digits
        const normalizedEmail = worker.email?.toLowerCase().trim() || '';

        // Check for duplicates based on different criteria
        let isDuplicate = false;
        let duplicateKey = '';

        // Check by full name + phone
        const namePhoneKey = `${normalizedFirstName}_${normalizedLastName}_${normalizedPhone}`;
        
        // Check by email (if email exists and is not empty)
        const emailKey = normalizedEmail ? `email_${normalizedEmail}` : '';
        
        // Check by full name only (if names are identical)
        const nameOnlyKey = `name_${normalizedFirstName}_${normalizedLastName}`;

        // Priority check: email match (strongest indicator)
        if (emailKey && uniqueWorkers.has(emailKey)) {
          isDuplicate = true;
          duplicateKey = emailKey;
        }
        // Second priority: name + phone match
        else if (uniqueWorkers.has(namePhoneKey)) {
          isDuplicate = true;
          duplicateKey = namePhoneKey;
        }
        // Third priority: exact name match (with phone difference - possible typo)
        else if (uniqueWorkers.has(nameOnlyKey)) {
          const existingWorker = uniqueWorkers.get(nameOnlyKey);
          // Only consider duplicate if names match exactly and either phone is similar or email matches
          if (existingWorker && (
            Math.abs(normalizedPhone.length - existingWorker.phoneNumber.replace(/\D/g, '').length) <= 2 ||
            (normalizedEmail && existingWorker.email?.toLowerCase() === normalizedEmail)
          )) {
            isDuplicate = true;
            duplicateKey = nameOnlyKey;
          }
        }

        if (isDuplicate) {
          duplicatesToRemove.push(worker);
        } else {
          // Store in all relevant keys
          uniqueWorkers.set(namePhoneKey, worker);
          if (emailKey) uniqueWorkers.set(emailKey, worker);
          uniqueWorkers.set(nameOnlyKey, worker);
        }
      });

      if (duplicatesToRemove.length === 0) {
        alert('No duplicate workers found.');
        setRemovingDuplicates(false);
        return;
      }

      // Show confirmation with details
      const duplicateDetails = duplicatesToRemove.map(worker => 
        `• ${worker.firstName} ${worker.lastName} (${worker.phoneNumber})`
      ).join('\n');

      const confirmMessage = `Found ${duplicatesToRemove.length} duplicate worker(s):\n\n${duplicateDetails}\n\nDo you want to remove these duplicates? This action cannot be undone.`;
      
      if (window.confirm(confirmMessage)) {
        // Remove duplicates from Firebase
        const deletePromises = duplicatesToRemove.map(worker => 
          deleteWorkerFromFirebase(worker.id)
        );
        
        await Promise.all(deletePromises);
        
        alert(`Successfully removed ${duplicatesToRemove.length} duplicate worker(s).`);
      }
    } catch (error) {
      console.error('Error removing duplicates:', error);
      alert('Error removing duplicates. Please try again.');
    } finally {
      setRemovingDuplicates(false);
    }
  };
  const importUsersFromExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const data = evt.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        let added = 0;
        let skipped = 0;
        const duplicatesList: string[] = [];
        
        for (const row of json) {
          // Always fill all fields, even if missing or mismatched
          const positionVal = typeof row['Position'] === 'string' && [
            'Operator', 'Supervisor', 'Manager', 'Quality Controller', 'Packer', 'Driver'
          ].includes(row['Position']) ? row['Position'] as Worker['position'] : 'Operator';
          const departmentVal = typeof row['Department'] === 'string' && [
            'Production', 'Quality Control', 'Packaging', 'Logistics', 'Administration'
          ].includes(row['Department']) ? row['Department'] as Worker['department'] : 'Production';
          const statusVal = typeof row['Status'] === 'string' && [
            'Active', 'Inactive', 'On Leave', 'Fired', 'Resigned'
          ].includes(row['Status']) ? row['Status'] as Worker['status'] : 'Active';
          
          const firstName = typeof row['First Name'] === 'string' ? row['First Name'].trim() : '';
          const lastName = typeof row['Last Name'] === 'string' ? row['Last Name'].trim() : '';
          const email = typeof row['Email'] === 'string' ? row['Email'].trim() : '';
          const phone = typeof row['Phone Number'] === 'string' ? row['Phone Number'].trim() : '';
          
          // Skip if both first and last name are missing
          if (!firstName && !lastName) {
            continue;
          }
          
          // Check for duplicates in existing workers
          const isDuplicate = workers.some(existingWorker => {
            const normalizedExistingFirstName = existingWorker.firstName.toLowerCase().trim();
            const normalizedExistingLastName = existingWorker.lastName.toLowerCase().trim();
            const normalizedExistingPhone = existingWorker.phoneNumber.replace(/\D/g, '');
            const normalizedExistingEmail = existingWorker.email?.toLowerCase().trim() || '';
            
            const normalizedFirstName = firstName.toLowerCase();
            const normalizedLastName = lastName.toLowerCase();
            const normalizedPhone = phone.replace(/\D/g, '');
            const normalizedEmail = email.toLowerCase();
            
            // Check for duplicate by email (strongest indicator)
            if (normalizedEmail && normalizedExistingEmail && normalizedEmail === normalizedExistingEmail) {
              return true;
            }
            
            // Check for duplicate by name + phone
            if (normalizedFirstName === normalizedExistingFirstName && 
                normalizedLastName === normalizedExistingLastName && 
                normalizedPhone === normalizedExistingPhone) {
              return true;
            }
            
            // Check for duplicate by exact name match
            if (normalizedFirstName === normalizedExistingFirstName && 
                normalizedLastName === normalizedExistingLastName) {
              return true;
            }
            
            return false;
          });
          
          if (isDuplicate) {
            skipped++;
            duplicatesList.push(`${firstName} ${lastName}`);
            continue;
          }
          
          const worker: Omit<Worker, 'id'> = {
            firstName,
            lastName,
            email,
            position: positionVal,
            department: departmentVal,
            phoneNumber: phone,
            address: typeof row['Address'] === 'string' ? row['Address'] : '',
            hireDate: typeof row['Hire Date'] === 'string' ? row['Hire Date'] : '',
            fireDate: typeof row['Fire Date'] === 'string' ? row['Fire Date'] : '',
            status: statusVal,
            salary: !isNaN(Number(row['Salary'])) ? Number(row['Salary']) : 0,
            hourlyRate: !isNaN(Number(row['Hourly Rate'])) ? Number(row['Hourly Rate']) : 0,
            emergencyContact: {
              name: typeof row['Emergency Contact Name'] === 'string' ? row['Emergency Contact Name'] : '',
              phone: typeof row['Emergency Contact Phone'] === 'string' ? row['Emergency Contact Phone'] : '',
              relationship: typeof row['Emergency Contact Relationship'] === 'string' ? row['Emergency Contact Relationship'] : '',
            },
            notes: typeof row['Notes'] === 'string' ? row['Notes'] : '',
            createdAt: serverTimestamp() as unknown as Timestamp,
            updatedAt: serverTimestamp() as unknown as Timestamp,
          };
          
          await addDoc(collection(db, 'personnel'), worker);
          added++;
        }
        setImporting(false);
        
        let message = `Import complete! ${added} users added.`;
        if (skipped > 0) {
          message += `\n${skipped} duplicates were skipped: ${duplicatesList.slice(0, 5).join(', ')}${duplicatesList.length > 5 ? '...' : ''}`;
        }
        alert(message);
        // The UI will auto-refresh due to onSnapshot
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setImporting(false);
      alert('Import failed: ' + (err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      {/* Download All Users Button */}
      <div className="flex justify-end mb-4 space-x-2">
        <button
          onClick={removeDuplicateWorkers}
          disabled={removingDuplicates || workers.length === 0}
          className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-semibold shadow transition-colors"
        >
          {removingDuplicates ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Removing Duplicates...
            </>
          ) : (
            <>
              <UserX className="h-5 w-5 mr-2" />
              Remove Duplicates
            </>
          )}
        </button>
        <button
          onClick={exportAllUsersToExcel}
          className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
          Download All Users (Excel)
        </button>
        <label className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition-colors cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Import Users (Excel)
          <input type="file" accept=".xlsx,.xls" onChange={importUsersFromExcel} className="hidden" />
        </label>
      </div>
      <div className="container mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Users className="text-white w-10 h-10" />
              <div>
                <h1 className="text-3xl font-bold text-white">Personnel Management</h1>
                <p className="text-blue-100 text-sm">
                  Total Workers: <span className="font-semibold text-white">{workers.length}</span>
                  {filteredWorkers.length !== workers.length && (
                    <span className="ml-2">
                      (Showing: <span className="font-semibold text-white">{filteredWorkers.length}</span>)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                setEditingWorker(null);
                setIsModalOpen(true);
              }}
              className="bg-white text-blue-600 hover:bg-blue-50 transition-colors duration-300 px-4 py-2 rounded-full flex items-center space-x-2 font-semibold"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Add Employee</span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2 bg-white bg-opacity-20 rounded-lg px-3 py-2">
              <Search className="w-5 h-5 text-white" />
              <input
                type="text"
                placeholder="Search personnel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-white placeholder-white placeholder-opacity-70 outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Worker['status'] | '')}
              className="bg-white bg-opacity-20 text-white rounded-lg px-3 py-2 outline-none"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="On Leave">On Leave</option>
              <option value="Fired">Fired</option>
              <option value="Resigned">Resigned</option>
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value as Worker['department'] | '')}
              className="bg-white bg-opacity-20 text-white rounded-lg px-3 py-2 outline-none"
            >
              <option value="">All Departments</option>
              <option value="Production">Production</option>
              <option value="Quality Control">Quality Control</option>
              <option value="Packaging">Packaging</option>
              <option value="Logistics">Logistics</option>
              <option value="Administration">Administration</option>
            </select>
          </div>
        </div>

        {/* Workers Table */}
        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading personnel...</span>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {(['lastName', 'department', 'position', 'phoneNumber', 'status', 'salary', 'hireDate'] as (keyof Worker)[]).map((key) => (
                        <th 
                          key={key}
                          onClick={() => handleSort(key)}
                          className="py-4 px-4 text-left text-gray-600 font-semibold cursor-pointer hover:bg-gray-100 transition-colors duration-300 group"
                        >
                          <div className="flex items-center">
                            {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                            <ChevronDown 
                              className={`ml-2 w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-300 ${
                                sortConfig.key === key 
                                  ? 'text-blue-600 opacity-100 ' + (sortConfig.direction === 'asc' ? 'rotate-180' : '') 
                                  : 'text-gray-400'
                              }`} 
                            />
                          </div>
                        </th>
                      ))}
                      <th className="py-4 px-4 text-left text-gray-600 font-semibold">
                        Fire Date
                      </th>
                      <th className="py-4 px-4 text-left text-gray-600 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkers.map((worker) => (
                      <tr key={worker.id} className="border-b hover:bg-gray-50 transition-colors duration-200">
                        <td className="py-4 px-4 font-medium">{`${worker.firstName} ${worker.lastName}`}</td>
                        <td className="py-4 px-4">{worker.department}</td>
                        <td className="py-4 px-4">{worker.position}</td>
                        <td className="py-4 px-4">{worker.phoneNumber}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold
                            ${worker.status === 'Active' ? 'bg-green-100 text-green-700' : 
                              worker.status === 'Inactive' ? 'bg-gray-100 text-gray-700' : 
                              worker.status === 'On Leave' ? 'bg-yellow-100 text-yellow-700' :
                              worker.status === 'Fired' ? 'bg-red-100 text-red-700' :
                              'bg-orange-100 text-orange-700'}`}>
                            {worker.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {worker.salary?.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD'
                          })}
                        </td>
                        <td className="py-4 px-4">{worker.hireDate}</td>
                        <td className="py-4 px-4">
                          {worker.fireDate ? (
                            <span className="text-red-600 text-sm">{worker.fireDate}</span>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 flex space-x-2">
                          <button
                            onClick={() => editWorker(worker)}
                            className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition-colors duration-300"
                            title="Edit"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          {worker.status === 'Active' && (
                            <button
                              onClick={() => {
                                setFiringWorker(worker);
                                setIsFireModalOpen(true);
                              }}
                              className="text-orange-500 hover:bg-orange-50 p-2 rounded-full transition-colors duration-300"
                              title="Fire Employee"
                            >
                              <UserX className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteWorker(worker.id)}
                            className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors duration-300"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredWorkers.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-gray-500">
                          <div className="flex flex-col items-center">
                            <Users className="w-12 h-12 text-gray-300 mb-4" />
                            <p className="text-lg">No personnel found</p>
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

        {/* Modal for Adding/Editing Worker */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-auto overflow-hidden h-[95vh] flex flex-col">
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 flex-shrink-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {editingWorker ? 'Edit Employee' : 'Add New Employee'}
                </h2>
              </div>
              <form className="flex-1 overflow-y-auto p-4 sm:p-6" onSubmit={(e) => {
                e.preventDefault();
                saveWorker();
              }}>
                {/* Personal Information */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="lg:col-span-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3">Personal Information</h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">First Name</label>
                          <input
                            type="text"
                            name="firstName"
                            value={editingWorker ? editingWorker.firstName : newWorker.firstName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Last Name</label>
                          <input
                            type="text"
                            name="lastName"
                            value={editingWorker ? editingWorker.lastName : newWorker.lastName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          name="email"
                          value={editingWorker ? editingWorker.email || '' : newWorker.email || ''}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input
                          type="text"
                          name="phoneNumber"
                          value={editingWorker ? editingWorker.phoneNumber : newWorker.phoneNumber}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Address</label>
                        <textarea
                          name="address"
                          value={editingWorker ? editingWorker.address || '' : newWorker.address || ''}
                          onChange={handleInputChange}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Employment Information */}
                  <div className="lg:col-span-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3">Employment Information</h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Department</label>
                          <select
                            name="department"
                            value={editingWorker ? editingWorker.department : newWorker.department}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                            required
                          >
                            <option value="Production">Production</option>
                            <option value="Quality Control">Quality Control</option>
                            <option value="Packaging">Packaging</option>
                            <option value="Logistics">Logistics</option>
                            <option value="Administration">Administration</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Position</label>
                          <select
                            name="position"
                            value={editingWorker ? editingWorker.position : newWorker.position}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                            required
                          >
                            <option value="Operator">Operator</option>
                            <option value="Supervisor">Supervisor</option>
                            <option value="Manager">Manager</option>
                            <option value="Quality Controller">Quality Controller</option>
                            <option value="Packer">Packer</option>
                            <option value="Driver">Driver</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Salary (Annual)</label>
                          <input
                            type="number"
                            name="salary"
                            value={editingWorker ? editingWorker.salary : newWorker.salary}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Hourly Rate</label>
                          <input
                            type="number"
                            name="hourlyRate"
                            value={editingWorker ? editingWorker.hourlyRate : newWorker.hourlyRate}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                          <input
                            type="date"
                            name="hireDate"
                            value={editingWorker ? editingWorker.hireDate : newWorker.hireDate}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Status</label>
                          <select
                            name="status"
                            value={editingWorker ? editingWorker.status : newWorker.status}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                            required
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="On Leave">On Leave</option>
                            <option value="Fired">Fired</option>
                            <option value="Resigned">Resigned</option>
                          </select>
                        </div>
                      </div>
                      {(editingWorker?.status === 'Fired' || newWorker.status === 'Fired') && (
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Fire Date</label>
                          <input
                            type="date"
                            name="fireDate"
                            value={editingWorker ? editingWorker.fireDate || '' : newWorker.fireDate || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Emergency Contact & Notes */}
                  <div className="lg:col-span-1">
                    <div className="space-y-4">
                      {/* Emergency Contact */}
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3">Emergency Contact</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                            <input
                              type="text"
                              name="emergencyContact.name"
                              value={editingWorker ? editingWorker.emergencyContact?.name || '' : newWorker.emergencyContact?.name || ''}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                            <input
                              type="text"
                              name="emergencyContact.phone"
                              value={editingWorker ? editingWorker.emergencyContact?.phone || '' : newWorker.emergencyContact?.phone || ''}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Relationship</label>
                            <input
                              type="text"
                              name="emergencyContact.relationship"
                              value={editingWorker ? editingWorker.emergencyContact?.relationship || '' : newWorker.emergencyContact?.relationship || ''}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                              placeholder="e.g., Spouse, Parent"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                          name="notes"
                          value={editingWorker ? editingWorker.notes || '' : newWorker.notes || ''}
                          onChange={handleInputChange}
                          rows={4}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 transition-all duration-300"
                          placeholder="Additional notes about the employee..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="border-t pt-4 mt-6 flex-shrink-0">
                  <div className="flex flex-col sm:flex-row justify-between space-y-2 sm:space-y-0 sm:space-x-4">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 sm:py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center space-x-2"
                    >
                      <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-sm sm:text-base">{editingWorker ? 'Update Employee' : 'Save Employee'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 sm:py-3 px-4 rounded-lg transition-colors duration-300 text-sm sm:text-base"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Fire Employee Modal */}
        {isFireModalOpen && firingWorker && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-500 p-6">
                <h2 className="text-2xl font-bold text-white">
                  Fire Employee
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-center">
                  <UserX className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-800">
                    Are you sure you want to fire
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    {firingWorker.firstName} {firingWorker.lastName}?
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason for termination</label>
                  <textarea
                    value={fireReason}
                    onChange={(e) => setFireReason(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 transition-all duration-300"
                    placeholder="Please provide a reason for termination..."
                    required
                  />
                </div>

                <div className="flex justify-between space-x-4 pt-4">
                  <button
                    onClick={fireWorker}
                    disabled={!fireReason.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center space-x-2"
                  >
                    <UserX className="w-5 h-5" />
                    <span>Fire Employee</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsFireModalOpen(false);
                      setFiringWorker(null);
                      setFireReason('');
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg transition-colors duration-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonnelManagement;