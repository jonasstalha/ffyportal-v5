import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Plus, ArrowLeft, Upload, Folder, FileText, File, Calendar, Tag, Bell, Grid, List, ChevronDown, ExternalLink, Filter, Calculator, Receipt, DollarSign, FileCheck, Clock, FileSpreadsheet, MoreHorizontal, ChevronRight, Download, Archive, Info } from 'lucide-react';
import DocumentCard from '@/components/ui/document-card';
import TagBadge from '@/components/ui/tag-badge';
import StatCard from '@/components/ui/stat-card';
import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, updateDoc, serverTimestamp, Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from 'firebase/storage';
import { firestore, storage, auth } from '@/lib/firebase';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

interface ArchiveItem {
  name: string;
  date: string;
  type: string;
  id: string;
  category: string;
  amount?: number;
  validationDate?: string;
  validatedBy?: string;
  status: 'pending' | 'validated' | 'rejected';
  reference?: string;
  tags?: string[];
  notes?: string;
  lastModified: string;
  fileSize?: string;
  fileUrl?: string;
  folderPath?: string;
  boxWeights?: string[];
  paletteNumbers?: string[];
  boxTypes?: string[];
  calibers?: string[];
  avocadoCount?: number;
  packagingDate?: string;
  uploadedAt?: Timestamp;
  uploadedBy?: string;
  storagePath?: string;
}

interface ArchiveBox {
  id: string;
  title: string;
  description?: string;
  items: ArchiveItem[];
  color: string;
  icon: string;
  createdAt: string;
  lastModified: string;
  totalAmount?: number;
  tags?: string[];
  userId: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface Container {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  factures: ArchiveItem[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-indigo-500',
  'bg-orange-500', 'bg-teal-500', 'bg-rose-500', 'bg-violet-500'
];

// Accounting specific document categories
const DOCUMENT_CATEGORIES = [
  { id: 'client-invoices', name: 'Factures clients', icon: Receipt, color: 'text-blue-500', description: 'Factures émises aux clients' },
  { id: 'supplier-invoices', name: 'Factures fournisseurs', icon: FileText, color: 'text-red-500', description: 'Factures reçues des fournisseurs' },
  { id: 'bank-statements', name: 'Relevés bancaires', icon: FileSpreadsheet, color: 'text-green-500', description: 'Relevés et documents bancaires' },
  { id: 'expense-reports', name: 'Notes de frais', icon: Calculator, color: 'text-amber-500', description: 'Notes et rapports de dépenses' },
  { id: 'tax-documents', name: 'Documents fiscaux', icon: FileCheck, color: 'text-purple-500', description: 'Déclarations et avis fiscaux' },
  { id: 'pay-slips', name: 'Bulletins de paie', icon: DollarSign, color: 'text-teal-500', description: 'Bulletins et documents de paie' },
  { id: 'contracts', name: 'Contrats', icon: File, color: 'text-indigo-500', description: 'Documents contractuels' },
  { id: 'others', name: 'Autres', icon: Folder, color: 'text-gray-500', description: 'Autres documents comptables' }
];

const ICONS = [
  'Receipt', 'FileText', 'Calculator', 'Calendar'
];

interface StatCard {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const Archivagedesfacture: React.FC = () => {
  const [boxes, setBoxes] = useState<ArchiveBox[]>([]);
  const [newBoxTitle, setNewBoxTitle] = useState<string>('');
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newFileInput, setNewFileInput] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [notification, setNotification] = useState<{ message: string, type: string } | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('date');
  const [filterOpen, setFilterOpen] = useState<boolean>(false);
  const [isBoxHovered, setIsBoxHovered] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [selectedBoxWeights, setSelectedBoxWeights] = useState<string[]>([]);
  const [selectedPaletteNumbers, setSelectedPaletteNumbers] = useState<string[]>([]);
  const [selectedBoxTypes, setSelectedBoxTypes] = useState<string[]>([]);
  const [selectedCalibers, setSelectedCalibers] = useState<string[]>([]);
  const [avocadoCount, setAvocadoCount] = useState<number>(0);
  const [packagingDate, setPackagingDate] = useState<string>('');
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [newContainerName, setNewContainerName] = useState<string>('');
  const [isCreatingContainer, setIsCreatingContainer] = useState<boolean>(false);

  // Add these constants for the selection options
  const BOX_WEIGHTS = ['4kg', '10kg'];
  const PALETTE_NUMBERS = ['220', '264', '90'];
  const BOX_TYPES = ['Caisse plastique', 'Box'];
  const CALIBERS = ['12', '14', '16', '18', '20', '22', '24', '26', '28', '30'];

  // Initialize boxes from localStorage on component mount
  useEffect(() => {
    const savedBoxes = localStorage.getItem('archiveBoxes');
    if (savedBoxes) {
      try {
        const parsedBoxes = JSON.parse(savedBoxes);
        setBoxes(parsedBoxes);
      } catch (error) {
        console.error('Error parsing saved boxes:', error);
        setBoxes([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('archiveBoxes', JSON.stringify(boxes));
  }, [boxes]);

  // Load containers on component mount
  useEffect(() => {
    loadContainers();
  }, []);

  // Add authentication check
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('User is signed in:', user.uid);
        loadContainers();
      } else {
        console.log('No user is signed in');
        setContainers([]);
        showNotification('Veuillez vous connecter pour accéder aux conteneurs', 'error');
      }
    });

    return () => unsubscribe();
  }, []); // Empty dependency array means this runs once on mount

  const showNotification = (message: string, type: string) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadContainers = async () => {
    try {
      // Check if user is authenticated
      const user = auth.currentUser;
      if (!user) {
        console.error('No authenticated user found');
        showNotification('Vous devez être connecté pour accéder aux conteneurs', 'error');
        return;
      }

      console.log('Loading containers for user:', user.uid);
      
      const containersRef = collection(firestore, 'containers');
      // Query containers where userId matches the current user
      const q = query(
        containersRef,
        where('userId', '==', user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      console.log('Query snapshot size:', querySnapshot.size);
      
      const loadedContainers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate().toISOString() || new Date().toISOString(),
      })) as Container[];
      
      // Sort the containers client-side
      loadedContainers.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      console.log('Loaded containers:', loadedContainers);

      // If no containers exist, create a test container
      if (loadedContainers.length === 0) {
        console.log('No containers found, creating a test container...');
        const testContainer = {
          name: 'Test Container',
          description: 'A test container for factures',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          userId: user.uid,
          factures: []
        };

        const docRef = await addDoc(collection(firestore, 'containers'), testContainer);
        console.log('Test container created with ID:', docRef.id);

        // Add the new container to the state
        setContainers([{
          id: docRef.id,
          ...testContainer,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]);
      } else {
        setContainers(loadedContainers);
      }
    } catch (error) {
      console.error('Error loading containers:', error);
      // Log more details about the error
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      showNotification('Erreur lors du chargement des conteneurs', 'error');
    }
  };

  const createContainer = async () => {
    if (!newContainerName.trim()) {
      showNotification('Le nom du conteneur est requis', 'error');
      return;
    }

    const userId = auth.currentUser?.uid;
    if (!userId) {
      showNotification('Vous devez être connecté pour créer un conteneur', 'error');
      return;
    }

    try {
      const containerRef = await addDoc(collection(firestore, 'containers'), {
        name: newContainerName,
        description: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userId,
        factures: []
      });

      const newContainer: Container = {
        id: containerRef.id,
        name: newContainerName,
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId,
        factures: []
      };

      setContainers(prev => [newContainer, ...prev]);
      setNewContainerName('');
      setIsCreatingContainer(false);
      showNotification('Conteneur créé avec succès', 'success');
    } catch (error) {
      console.error('Error creating container:', error);
      showNotification('Erreur lors de la création du conteneur', 'error');
    }
  };

  const handleCreateBox = async () => {
    try {
      if (!auth.currentUser) {
        showNotification('Vous devez être connecté pour créer une boîte', 'error');
        return;
      }

      const newBox: Omit<ArchiveBox, 'id'> = {
        title: newBoxTitle,
        items: [],
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        icon: ICONS[Math.floor(Math.random() * ICONS.length)],
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        userId: auth.currentUser.uid
      };

      const boxRef = await addDoc(collection(firestore, 'boxes'), {
        ...newBox,
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp()
      });

      setBoxes((prevBoxes) => [...prevBoxes, { ...newBox, id: boxRef.id }]);
      setNewBoxTitle('');
      showNotification('Boîte créée avec succès', 'success');
    } catch (error) {
      console.error('Error creating box:', error);
      showNotification('Erreur lors de la création de la boîte', 'error');
    }
  };

  const handleAddItemToBox = async (boxId: string, file: File) => {
    if (!file || !file.name) {
      showNotification('Aucun fichier sélectionné ou fichier invalide', 'error');
      return;
    }
    try {
      console.log('Starting file upload for box:', boxId);
      console.log('File details:', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      if (!auth.currentUser) {
        console.error('No authenticated user found');
        throw new Error('User must be authenticated to upload files');
      }

      const userId = auth.currentUser.uid;
      console.log('User ID:', userId);

      // Generate a unique filename with sanitized name
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedFileName}`;
      const storagePath = `invoices/${userId}/${boxId}/${fileName}`;
      console.log('Storage path:', storagePath);

      // Upload file directly to Firebase Storage
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytes(storageRef, file);
      await uploadTask;
      const url = await getDownloadURL(storageRef);
      console.log('Download URL:', url);

      // Create facture document in the subcollection
      const factureData = {
        imageUrl: url,
        uploadedAt: serverTimestamp(),
        notes: '',
        originalName: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadedBy: userId
      };

      console.log('Creating facture document with data:', factureData);
      const factureRef = await addDoc(collection(firestore, 'Archifageboxes', boxId, 'factures'), factureData);
      console.log('Facture document created with ID:', factureRef.id);

      // Update local state
      setContainers(prev => prev.map(container => {
        if (container.id === boxId) {
          const newFacture: ArchiveItem = {
            id: factureRef.id,
            name: file.name,
            type: file.type,
            date: new Date().toLocaleDateString(),
            category: DOCUMENT_CATEGORIES[0].id,
            status: 'pending' as const,
            lastModified: new Date().toISOString(),
            fileSize: formatFileSize(file.size),
            fileUrl: url,
            uploadedAt: serverTimestamp() as unknown as Timestamp,
            uploadedBy: userId,
            storagePath: storagePath,
            notes: '',
            tags: [],
            reference: '',
            validationDate: '',
            validatedBy: '',
            folderPath: '',
            boxWeights: [],
            paletteNumbers: [],
            boxTypes: [],
            calibers: [],
            avocadoCount: 0,
            packagingDate: ''
          };
          return {
            ...container,
            factures: [...container.factures, newFacture]
          };
        }
        return container;
      }));

      console.log('Local state updated successfully');
      showNotification('Document ajouté avec succès', 'success');
      return true;
    } catch (error) {
      console.error('Error in handleAddItemToBox:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      showNotification('Erreur lors de l\'ajout du document', 'error');
      throw error;
    }
  };

  const handleFileSelection = async (boxIndex: number, e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        await handleAddItemToBox(boxes[boxIndex].id, file);
      }
    }
  };

  const getFilteredItems = (): ArchiveItem[] => {
    if (selectedBoxIndex === null || !boxes[selectedBoxIndex]) {
      return [];
    }
    
    const currentBox = boxes[selectedBoxIndex];
    if (!currentBox.items) {
      return [];
    }

    let items = [...currentBox.items];

    // Apply search filter
    if (searchTerm) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Apply sorting
    items.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'type') {
        return a.type.localeCompare(b.type);
      } else {
        // Default: sort by date (newest first)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });
    
    return items;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFolderUpload = async (boxIndex: number, folder: FileSystemDirectoryEntry): Promise<void> => {
    try {
      setIsUploading(true);
      const box = boxes[boxIndex];
      const files: File[] = [];

      // Recursively get all files from the folder
      const getAllFiles = async (entry: FileSystemEntry): Promise<void> => {
        if (entry.isFile) {
          const file = await new Promise<File>((resolve) => {
            (entry as FileSystemFileEntry).file(resolve);
          });
          files.push(file);
        } else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          const entries = await new Promise<FileSystemEntry[]>((resolve) => {
            reader.readEntries(resolve);
          });
          for (const entry of entries) {
            await getAllFiles(entry);
          }
        }
      };

      await getAllFiles(folder);

      // Upload each file with progress tracking
      for (const file of files) {
        const relativePath = file.webkitRelativePath || file.name;
        const folderPath = relativePath.split('/').slice(0, -1).join('/');
        
        try {
          // Create a unique file name
          const timestamp = Date.now();
          const uniqueFileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const storagePath = `boxes/${box.id}/${folderPath}/${uniqueFileName}`;
          const storageRef = ref(storage, storagePath);

          // Set initial progress
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: {
              fileName: file.name,
              progress: 0,
              status: 'uploading'
            }
          }));

          // Upload with progress tracking
          const uploadTask = uploadBytesResumable(storageRef, file, {
            contentType: file.type,
            customMetadata: {
              userId: auth.currentUser?.uid || '',
              boxId: box.id,
              fileName: file.name,
              folderPath: folderPath
            }
          });

          // Track upload progress
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(prev => ({
                ...prev,
                [file.name]: {
                  fileName: file.name,
                  progress,
                  status: 'uploading'
                }
              }));
            },
            (error) => {
              console.error('Upload error:', error);
              setUploadProgress(prev => ({
                ...prev,
                [file.name]: {
                  fileName: file.name,
                  progress: 0,
                  status: 'error',
                  error: error.message
                }
              }));
            },
            async () => {
              // Upload completed
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              // Create new item in Firestore
              const newItem: ArchiveItem = {
                name: file.name,
                date: new Date().toLocaleDateString(),
                type: file.type.split('/')[1] || 'unknown',
                id: generateId(),
                category: DOCUMENT_CATEGORIES[0].id,
                status: 'pending',
                validationDate: '',
                validatedBy: '',
                lastModified: new Date().toISOString(),
                fileUrl: downloadURL,
                fileSize: formatFileSize(file.size),
                folderPath: folderPath,
                boxWeights: selectedBoxWeights,
                paletteNumbers: selectedPaletteNumbers,
                boxTypes: selectedBoxTypes,
                calibers: selectedCalibers,
                avocadoCount,
                packagingDate
              };

              // Update Firestore
              const boxRef = doc(firestore, 'boxes', box.id);
              const updatedItems = [...box.items, newItem];
              await updateDoc(boxRef, {
                items: updatedItems,
                lastModified: serverTimestamp()
              });

              // Update local state
              setBoxes(prevBoxes => {
                const updatedBoxes = [...prevBoxes];
                updatedBoxes[boxIndex].items = updatedItems;
                return updatedBoxes;
              });

              // Update progress
              setUploadProgress(prev => ({
                ...prev,
                [file.name]: {
                  fileName: file.name,
                  progress: 100,
                  status: 'completed'
                }
              }));
            }
          );
        } catch (error) {
          console.error('Error uploading file:', error);
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: {
              fileName: file.name,
              progress: 0,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }));
        }
      }
    } catch (error) {
      console.error('Error handling folder upload:', error);
      showNotification('Erreur lors du téléchargement du dossier', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDrop = async (e: React.DragEvent, boxIndex: number): Promise<void> => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          if (entry.isDirectory) {
            await handleFolderUpload(boxIndex, entry as FileSystemDirectoryEntry);
          } else if (entry.isFile) {
            const file = item.getAsFile();
            if (file) {
              await handleAddItemToBox(boxes[boxIndex].id, file);
            }
          }
        }
      }
    }
  };

  const toggleItemSelection = (itemId: string): void => {
    setSelectedItems((prev: string[]) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const deleteSelectedItems = async () => {
    if (selectedBoxIndex === null) return;
    
    try {
      const box = boxes[selectedBoxIndex];
      const itemsToDelete = box.items.filter(item => selectedItems.includes(item.id));
      
      // Delete files from Storage
      for (const item of itemsToDelete) {
        if (item.fileUrl) {
          const storageRef = ref(storage, item.fileUrl);
          await deleteObject(storageRef);
        }
      }

      // Update Firestore
      const boxRef = doc(firestore, 'boxes', box.id);
      const updatedItems = box.items.filter(item => !selectedItems.includes(item.id));
      await updateDoc(boxRef, {
        items: updatedItems,
        lastModified: serverTimestamp()
      });

      // Update local state
      const updatedBoxes = [...boxes];
      updatedBoxes[selectedBoxIndex].items = updatedItems;
      setBoxes(updatedBoxes);
      setSelectedItems([]);
      
      showNotification(`${selectedItems.length} document(s) supprimé(s)`, 'warning');
    } catch (error) {
      console.error('Error deleting items:', error);
      showNotification('Erreur lors de la suppression des documents', 'error');
    }
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Folder': return <Folder className="h-6 w-6" />;
      case 'FileText': return <FileText className="h-6 w-6" />;
      case 'File': return <File className="h-6 w-6" />;
      case 'Calendar': return <Calendar className="h-6 w-6" />;
      default: return <Folder className="h-6 w-6" />;
    }
  };
  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) {
      if (type.includes('facture')) return <Receipt className="h-5 w-5 text-red-500" />;
      if (type.includes('releve') || type.includes('relevé')) return <FileText className="h-5 w-5 text-blue-500" />;
      if (type.includes('bulletin')) return <FileCheck className="h-5 w-5 text-green-500" />;
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    if (type.includes('excel') || type === 'xlsx' || type === 'xls') 
      return <Calculator className="h-5 w-5 text-green-500" />;
    if (type.includes('doc') || type === 'docx' || type === 'doc') 
      return <FileText className="h-5 w-5 text-indigo-500" />;
    if (type.includes('image') || ['jpg', 'png', 'gif', 'svg'].includes(type)) 
      return <File className="h-5 w-5 text-amber-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const UploadProgressIndicator = () => {
    const uploads = Object.values(uploadProgress);
    if (uploads.length === 0) return null;

    return (
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 w-80">
        <h3 className="font-medium mb-2">Upload Progress</h3>
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div key={upload.fileName} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="truncate">{upload.fileName}</span>
                <span>{upload.progress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    upload.status === 'error' ? 'bg-red-500' :
                    upload.status === 'completed' ? 'bg-green-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
              {upload.status === 'error' && (
                <p className="text-xs text-red-500">{upload.error}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleBoxWeightToggle = (weight: string) => {
    setSelectedBoxWeights(prev => 
      prev.includes(weight)
        ? prev.filter(w => w !== weight)
        : [...prev, weight]
    );
  };

  const handlePaletteNumberToggle = (number: string) => {
    setSelectedPaletteNumbers(prev => 
      prev.includes(number)
        ? prev.filter(n => n !== number)
        : [...prev, number]
    );
  };

  const handleBoxTypeToggle = (boxType: string) => {
    setSelectedBoxTypes(prev => 
      prev.includes(boxType)
        ? prev.filter(t => t !== boxType)
        : [...prev, boxType]
    );
  };

  const handleCaliberToggle = (caliber: string) => {
    setSelectedCalibers(prev => 
      prev.includes(caliber)
        ? prev.filter(c => c !== caliber)
        : [...prev, caliber]
    );
  };

  const uploadFacture = async (containerId: string, file: File) => {
    console.log('Starting uploadFacture:', { containerId, fileName: file.name, fileSize: file.size, fileType: file.type });
    
    if (!file) {
      console.error('No file provided to uploadFacture');
      return;
    }

    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.error('No authenticated user found during upload');
      showNotification('Vous devez être connecté pour télécharger une facture', 'error');
      return;
    }

    try {
      console.log('User authenticated:', userId);
      setIsUploading(true);
      const fileName = `${Date.now()}_${file.name}`;
      console.log('Generated storage path:', `containers/${containerId}/${fileName}`);
      
      const storageRef = ref(storage, `containers/${containerId}/${fileName}`);
      console.log('Storage reference created:', storageRef.fullPath);
      
      // Upload file to Firebase Storage
      console.log('Starting file upload to Firebase Storage...');
      const uploadTask = uploadBytes(storageRef, file);
      
      // Track upload progress
      setUploadProgress(prev => ({
        ...prev,
        [fileName]: {
          fileName,
          progress: 0,
          status: 'uploading'
        }
      }));

      console.log('Waiting for upload to complete...');
      const snapshot = await uploadTask;
      console.log('Upload completed, getting download URL...');
      
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Download URL obtained:', downloadURL);

      // Create facture document in Firestore
      console.log('Creating facture document in Firestore...');
      const factureRef = await addDoc(collection(firestore, 'factures'), {
        name: file.name,
        date: new Date().toISOString(),
        type: file.type,
        category: 'facture',
        status: 'pending',
        lastModified: new Date().toISOString(),
        fileSize: file.size,
        fileUrl: downloadURL,
        containerId,
        userId
      });
      console.log('Facture document created with ID:', factureRef.id);

      // Update container with new facture
      console.log('Updating container with new facture...');
      const containerRef = doc(firestore, 'containers', containerId);
      await updateDoc(containerRef, {
        updatedAt: serverTimestamp(),
        factures: arrayUnion({
          id: factureRef.id,
          name: file.name,
          date: new Date().toISOString(),
          type: file.type,
          category: 'facture',
          status: 'pending',
          lastModified: new Date().toISOString(),
          fileSize: file.size,
          fileUrl: downloadURL,
          containerId
        })
      });
      console.log('Container updated successfully');

      setUploadProgress(prev => ({
        ...prev,
        [fileName]: {
          fileName,
          progress: 100,
          status: 'completed'
        }
      }));

      showNotification('Facture téléchargée avec succès', 'success');
    } catch (error) {
      console.error('Error in uploadFacture:', error);
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Check for specific Firebase errors
        if (error.message.includes('storage/unauthorized')) {
          console.error('Storage unauthorized error - check storage rules');
        } else if (error.message.includes('storage/canceled')) {
          console.error('Upload was canceled');
        } else if (error.message.includes('storage/unknown')) {
          console.error('Unknown storage error');
        }
      }
      
      showNotification('Erreur lors du téléchargement de la facture', 'error');
      setUploadProgress(prev => ({
        ...prev,
        [file.name]: {
          fileName: file.name,
          progress: 0,
          status: 'error',
          error: 'Upload failed'
        }
      }));
    } finally {
      setIsUploading(false);
      console.log('Upload process completed');
    }
  };

  // Add this function to check Firebase configuration
  const checkFirebaseConfig = () => {
    console.log('Checking Firebase configuration...');
    console.log('Storage instance:', storage);
    console.log('Firestore instance:', firestore);
    console.log('Auth instance:', auth);
    console.log('Current user:', auth.currentUser);
    
    // Check if storage bucket is properly configured
    if (storage) {
      console.log('Storage bucket:', storage.app.options.storageBucket);
    }
    
    // Check if Firestore is properly configured
    if (firestore) {
      console.log('Firestore database:', firestore.type);
    }
  };

  // Call this when component mounts
  useEffect(() => {
    checkFirebaseConfig();
  }, []);

  if (selectedBoxIndex !== null && boxes[selectedBoxIndex]) {
    const currentBox = boxes[selectedBoxIndex];
    const filteredItems = getFilteredItems();

    return (
      <div className="w-full max-w-5xl mx-auto p-6 bg-gray-50 min-h-screen">
        {notification && (
          <div className={`fixed top-4 right-4 py-2 px-4 rounded-md shadow-md z-50 transition-all transform ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
            {notification.message}
          </div>
        )}
        
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => {
                setSelectedBoxIndex(null);
                setSearchTerm('');
                setSelectedItems([]);
              }}
              className="p-2 bg-white hover:bg-gray-100 rounded-full shadow-sm transition-all"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
            <div className="flex items-center">
              <div className={`p-2 rounded-lg mr-3 text-white ${currentBox.color}`}>
                {renderIcon(currentBox.icon)}
              </div>
              <h2 className="text-2xl font-bold text-gray-800">{currentBox.title}</h2>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 bg-white hover:bg-gray-100 rounded-full shadow-sm transition-all"
            >
              {viewMode === 'grid' ? 
                <List className="h-5 w-5 text-gray-700" /> : 
                <Grid className="h-5 w-5 text-gray-700" />
              }
            </button>
            <button 
              onClick={() => setFilterOpen(!filterOpen)}
              className="p-2 bg-white hover:bg-gray-100 rounded-full shadow-sm transition-all"
            >
              <Filter className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>

        <div className="mb-6">
          <Tabs defaultValue="all" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="all">Tous les documents</TabsTrigger>
                <TabsTrigger value="recent">Récents</TabsTrigger>
                <TabsTrigger value="pending">En attente</TabsTrigger>
                <TabsTrigger value="validated">Validés</TabsTrigger>
              </TabsList>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                >
                  {viewMode === 'grid' ? 
                    <List className="h-4 w-4 mr-2" /> : 
                    <Grid className="h-4 w-4 mr-2" />
                  }
                  {viewMode === 'grid' ? 'Vue liste' : 'Vue grille'}
                </Button>
                
                <Button variant="outline" onClick={() => setFilterOpen(!filterOpen)}>
                  <Filter className="h-4 w-4 mr-2" />
                  Filtres
                  {searchTerm && (
                    <Badge variant="secondary" className="ml-2">1</Badge>
                  )}
                </Button>

                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau document
                </Button>
              </div>
            </div>

            {filterOpen && (
              <div className="p-4 mb-4 border rounded-lg bg-gray-50 animate-fadeIn space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Catégorie</Label>
                    <Select
                      onValueChange={(value) => setSearchTerm(value)}
                      defaultValue="all"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Toutes les catégories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les catégories</SelectItem>
                        {DOCUMENT_CATEGORIES.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center">
                              {React.createElement(category.icon, { 
                                className: `h-4 w-4 mr-2 ${category.color}` 
                              })}
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Statut</Label>
                    <Select
                      onValueChange={(value) => setSearchTerm(value)}
                      defaultValue="all"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tous les statuts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        <SelectItem value="pending">En attente</SelectItem>
                        <SelectItem value="validated">Validés</SelectItem>
                        <SelectItem value="rejected">Rejetés</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Période</Label>
                    <Select
                      onValueChange={(value) => setSearchTerm(value)}
                      defaultValue="all"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Toutes les dates" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les dates</SelectItem>
                        <SelectItem value="today">Aujourd'hui</SelectItem>
                        <SelectItem value="week">Cette semaine</SelectItem>
                        <SelectItem value="month">Ce mois</SelectItem>
                        <SelectItem value="overdue">En retard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <TabsContent value="all" className="mt-0">
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'}>
                {filteredItems.map((item, index) => (
                  <Card
                    key={index}
                    className={`group hover:shadow-lg transition-all ${
                      selectedItems.includes(item.id) ? 'ring-2 ring-blue-500' : ''
                    } ${viewMode === 'list' ? 'flex items-center justify-between p-4' : ''}`}
                    onClick={() => toggleItemSelection(item.id)}
                  >
                    <div className={viewMode === 'list' ? 'flex items-center flex-1' : 'p-4'}>
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex items-center justify-center mr-3">
                          {getFileIcon(item.type)}
                        </div>
                        <div>
                          <h3 className="font-medium truncate" title={item.name}>
                            {item.name}
                          </h3>
                          <div className="flex items-center text-xs text-gray-500">
                            <Tag className="h-3 w-3 mr-1" />
                            <span>{item.type}</span>
                            <span className="mx-2">•</span>
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{item.date}</span>
                          </div>
                        </div>
                      </div>

                      {viewMode === 'list' && (
                        <div className="flex items-center space-x-2">
                          <Badge variant={
                            item.status === 'validated' ? 'success' :
                            item.status === 'rejected' ? 'destructive' : 'default'
                          }>
                            {item.status === 'validated' ? 'Validé' :
                             item.status === 'rejected' ? 'Rejeté' : 'En attente'}
                          </Badge>
                          
                          <Button variant="ghost" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            if (item.fileUrl) {
                              window.open(item.fileUrl, '_blank');
                            }
                          }}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {viewMode === 'grid' && (
                      <div className="p-4 border-t bg-gray-50">
                        <div className="flex items-center justify-between">
                          <Badge variant={
                            item.status === 'validated' ? 'success' :
                            item.status === 'rejected' ? 'destructive' : 'default'
                          }>
                            {item.status === 'validated' ? 'Validé' :
                             item.status === 'rejected' ? 'Rejeté' : 'En attente'}
                          </Badge>
                          
                          <Button variant="ghost" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            if (item.fileUrl) {
                              window.open(item.fileUrl, '_blank');
                            }
                          }}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="recent">
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'}>
                {filteredItems
                  .filter(item => {
                    const itemDate = new Date(item.date);
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                    return itemDate >= oneWeekAgo;
                  })
                  .map((item, index) => (
                    <Card
                      key={index}
                      className={`group hover:shadow-lg transition-all ${
                        selectedItems.includes(item.id) ? 'ring-2 ring-blue-500' : ''
                      } ${viewMode === 'list' ? 'flex items-center justify-between p-4' : ''}`}
                      onClick={() => toggleItemSelection(item.id)}
                    >
                      <div className={viewMode === 'list' ? 'flex items-center flex-1' : 'p-4'}>
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex items-center justify-center mr-3">
                            {getFileIcon(item.type)}
                          </div>
                          <div>
                            <h3 className="font-medium truncate" title={item.name}>
                              {item.name}
                            </h3>
                            <div className="flex items-center text-xs text-gray-500">
                              <Tag className="h-3 w-3 mr-1" />
                              <span>{item.type}</span>
                              <span className="mx-2">•</span>
                              <Calendar className="h-3 w-3 mr-1" />
                              <span>{item.date}</span>
                            </div>
                          </div>
                        </div>

                        {viewMode === 'list' && (
                          <div className="flex items-center space-x-2">
                            <Badge variant={
                              item.status === 'validated' ? 'success' :
                              item.status === 'rejected' ? 'destructive' : 'default'
                            }>
                              {item.status === 'validated' ? 'Validé' :
                               item.status === 'rejected' ? 'Rejeté' : 'En attente'}
                            </Badge>
                            
                            <Button variant="ghost" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              if (item.fileUrl) {
                                window.open(item.fileUrl, '_blank');
                              }
                            }}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {viewMode === 'grid' && (
                        <div className="p-4 border-t bg-gray-50">
                          <div className="flex items-center justify-between">
                            <Badge variant={
                              item.status === 'validated' ? 'success' :
                              item.status === 'rejected' ? 'destructive' : 'default'
                            }>
                              {item.status === 'validated' ? 'Validé' :
                               item.status === 'rejected' ? 'Rejeté' : 'En attente'}
                            </Badge>
                            
                            <Button variant="ghost" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              if (item.fileUrl) {
                                window.open(item.fileUrl, '_blank');
                              }
                            }}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="pending">
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'}>
                {filteredItems
                  .filter(item => item.status === 'pending')
                  .map((item, index) => (
                    <Card
                      key={index}
                      className={`group hover:shadow-lg transition-all ${
                        selectedItems.includes(item.id) ? 'ring-2 ring-blue-500' : ''
                      } ${viewMode === 'list' ? 'flex items-center justify-between p-4' : ''}`}
                      onClick={() => toggleItemSelection(item.id)}
                    >
                      <div className={viewMode === 'list' ? 'flex items-center flex-1' : 'p-4'}>
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex items-center justify-center mr-3">
                            {getFileIcon(item.type)}
                          </div>
                          <div>
                            <h3 className="font-medium truncate" title={item.name}>
                              {item.name}
                            </h3>
                            <div className="flex items-center text-xs text-gray-500">
                              <Tag className="h-3 w-3 mr-1" />
                              <span>{item.type}</span>
                              <span className="mx-2">•</span>
                              <Calendar className="h-3 w-3 mr-1" />
                              <span>{item.date}</span>
                            </div>
                          </div>
                        </div>

                        {viewMode === 'list' && (
                          <div className="flex items-center space-x-2">
                            <Badge variant={
                              item.status === 'validated' ? 'success' :
                              item.status === 'rejected' ? 'destructive' : 'default'
                            }>
                              {item.status === 'validated' ? 'Validé' :
                               item.status === 'rejected' ? 'Rejeté' : 'En attente'}
                            </Badge>
                            
                            <Button variant="ghost" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              if (item.fileUrl) {
                                window.open(item.fileUrl, '_blank');
                              }
                            }}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {viewMode === 'grid' && (
                        <div className="p-4 border-t bg-gray-50">
                          <div className="flex items-center justify-between">
                            <Badge variant={
                              item.status === 'validated' ? 'success' :
                              item.status === 'rejected' ? 'destructive' : 'default'
                            }>
                              {item.status === 'validated' ? 'Validé' :
                               item.status === 'rejected' ? 'Rejeté' : 'En attente'}
                            </Badge>
                            
                            <Button variant="ghost" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              if (item.fileUrl) {
                                window.open(item.fileUrl, '_blank');
                              }
                            }}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="validated">
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'}>
                {filteredItems
                  .filter(item => item.status === 'validated')
                  .map((item, index) => (
                    <Card
                      key={index}
                      className={`group hover:shadow-lg transition-all ${
                        selectedItems.includes(item.id) ? 'ring-2 ring-blue-500' : ''
                      } ${viewMode === 'list' ? 'flex items-center justify-between p-4' : ''}`}
                      onClick={() => toggleItemSelection(item.id)}
                    >
                      <div className={viewMode === 'list' ? 'flex items-center flex-1' : 'p-4'}>
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex items-center justify-center mr-3">
                            {getFileIcon(item.type)}
                          </div>
                          <div>
                            <h3 className="font-medium truncate" title={item.name}>
                              {item.name}
                            </h3>
                            <div className="flex items-center text-xs text-gray-500">
                              <Tag className="h-3 w-3 mr-1" />
                              <span>{item.type}</span>
                              <span className="mx-2">•</span>
                              <Calendar className="h-3 w-3 mr-1" />
                              <span>{item.date}</span>
                            </div>
                          </div>
                        </div>

                        {viewMode === 'list' && (
                          <div className="flex items-center space-x-2">
                            <Badge variant={
                              item.status === 'validated' ? 'success' :
                              item.status === 'rejected' ? 'destructive' : 'default'
                            }>
                              {item.status === 'validated' ? 'Validé' :
                               item.status === 'rejected' ? 'Rejeté' : 'En attente'}
                            </Badge>
                            
                            <Button variant="ghost" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              if (item.fileUrl) {
                                window.open(item.fileUrl, '_blank');
                              }
                            }}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {viewMode === 'grid' && (
                        <div className="p-4 border-t bg-gray-50">
                          <div className="flex items-center justify-between">
                            <Badge variant={
                              item.status === 'validated' ? 'success' :
                              item.status === 'rejected' ? 'destructive' : 'default'
                            }>
                              {item.status === 'validated' ? 'Validé' :
                               item.status === 'rejected' ? 'Rejeté' : 'En attente'}
                            </Badge>
                            
                            <Button variant="ghost" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              if (item.fileUrl) {
                                window.open(item.fileUrl, '_blank');
                              }
                            }}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {selectedItems && selectedItems.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white py-3 px-6 rounded-lg shadow-lg z-10 flex items-center space-x-4 animate-slideUp">
            <span className="text-sm font-medium">{selectedItems.length} éléments sélectionnés</span>
            <button
              onClick={deleteSelectedItems}
              className="py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              Supprimer
            </button>
            <button
              onClick={() => setSelectedItems([])}
              className="py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Annuler
            </button>
          </div>
        )}

        <div 
          className="mb-8 bg-white rounded-xl shadow-sm overflow-hidden border"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, selectedBoxIndex)}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-10 border-2 border-blue-500 border-dashed rounded-xl flex items-center justify-center z-10">
              <div className="text-blue-500 font-medium flex flex-col items-center">
                <Upload className="h-12 w-12 mb-2" />
                <span>Déposez vos fichiers ici</span>
              </div>
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="mx-auto h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <File className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun document trouvé</h3>
              <p className="text-gray-500 max-w-sm mx-auto mb-4">
                {searchTerm 
                  ? "Essayez de modifier vos critères de recherche."
                  : "Commencez par ajouter des documents à cette boîte d'archives."}
              </p>
              <button
                onClick={() => setIsFormOpen(true)}
                className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un document
              </button>
            </div>
          ) : viewMode === 'grid' ? (            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              {filteredItems.map((item, itemIndex) => (
                <Card
                  key={itemIndex}
                  className={`group hover:shadow-lg transition-all ${
                    selectedItems.includes(item.id) ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => toggleItemSelection(item.id)}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex items-center justify-center mr-3">
                          {getFileIcon(item.type)}
                        </div>
                        <div>
                          <h3 className="font-medium truncate" title={item.name}>
                            {item.name}
                          </h3>
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{item.date}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === 'validated' ? 'bg-green-100 text-green-800' :
                        item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.status === 'validated' ? 'Validé' :
                         item.status === 'rejected' ? 'Rejeté' :
                         'En attente'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Catégorie:</span>
                        <span className="font-medium">{item.category}</span>
                      </div>
                      {item.amount && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Montant:</span>
                          <span className="font-medium">{item.amount.toFixed(2)} €</span>
                        </div>
                      )}
                      {item.validationDate && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Date limite:</span>
                          <span className="font-medium">{item.validationDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2 flex justify-between border-t">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const file = new Blob([item.name], { type: item.type });
                        const fileURL = URL.createObjectURL(file);
                        window.open(fileURL, '_blank');
                      }}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Ouvrir
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updatedBoxes = [...boxes];
                        updatedBoxes[selectedBoxIndex].items.splice(itemIndex, 1);
                        setBoxes(updatedBoxes);
                        showNotification(`"${item.name}" supprimé`, 'warning');
                      }}
                      className="px-3 py-1 text-xs bg-transparent hover:bg-gray-200 text-gray-600 rounded-md"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-4 divide-y">
              {filteredItems.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className={`flex items-center justify-between p-3 hover:bg-gray-50 transition-colors ${
                    selectedItems.includes(item.id) ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => toggleItemSelection(item.id)}
                >
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex items-center justify-center mr-3">
                      {getFileIcon(item.type)}
                    </div>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-gray-500 flex items-center">
                        <Tag className="h-3 w-3 mr-1" />
                        <span>{item.type}</span>
                        <span className="mx-2">•</span>
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>{item.date}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const file = new Blob([item.name], { type: item.type });
                        const fileURL = URL.createObjectURL(file);
                        window.open(fileURL, '_blank');
                      }}
                      className="py-1.5 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Ouvrir
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updatedBoxes = [...boxes];
                        updatedBoxes[selectedBoxIndex].items.splice(itemIndex, 1);
                        setBoxes(updatedBoxes);
                        showNotification(`"${item.name}" supprimé`, 'warning');
                      }}
                      className="py-1.5 px-3 bg-transparent hover:bg-gray-100 text-red-500 text-sm rounded-md transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8">
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center mb-4 text-blue-600 font-medium"
          >
            {isFormOpen ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Fermer le formulaire
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un document
              </>
            )}
          </button>
          
          {isFormOpen && (
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Ajouter un nouveau document</DialogTitle>
                  <DialogDescription>
                    Remplissez les informations du document à archiver.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  const newItem = {
                    name: formData.get('fileTitle') as string,
                    category: formData.get('fileCategory') as string,
                    type: (formData.get('fileUpload') as File)?.type || 'unknown',
                    status: 'pending' as const,
                    date: new Date().toLocaleDateString(),
                    id: generateId(),
                    amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : undefined,
                    validationDate: formData.get('validationDate') as string || undefined,
                    validatedBy: '',
                    lastModified: new Date().toISOString(),
                    boxWeights: selectedBoxWeights,
                    paletteNumbers: selectedPaletteNumbers,
                    boxTypes: selectedBoxTypes,
                    calibers: selectedCalibers,
                    avocadoCount,
                    packagingDate
                  };

                  handleAddItemToBox(
                    selectedBoxIndex!,
                    newItem.name,
                    newItem.type,
                    formData.get('fileUpload') as File
                  );

                  form.reset();
                  setIsFormOpen(false);
                }} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="fileTitle">Titre du document</Label>
                      <Input
                        id="fileTitle"
                        name="fileTitle"
                        placeholder="Ex: Facture N°12345..."
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="fileCategory">Catégorie</Label>
                      <Select name="fileCategory" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_CATEGORIES.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className="flex items-center">
                                {React.createElement(category.icon, { className: `h-4 w-4 mr-2 ${category.color}` })}
                                {category.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="amount">Montant</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          type="number"
                          id="amount"
                          name="amount"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="validationDate">Date de validation requise</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          type="date"
                          id="validationDate"
                          name="validationDate"
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="fileUpload">Document</Label>
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          type="file"
                          id="fileUpload"
                          name="fileUpload"
                          ref={fileInputRef}
                          className="hidden"
                          onChange={(e) => handleFileSelection(selectedBoxIndex!, e)}
                        />
                        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">
                          Cliquez pour sélectionner un fichier ou glissez-déposez-le ici
                        </p>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit">
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter le document
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <UploadProgressIndicator />
      </div>
    );
  }

  const statsCards = [
    {
      title: "Documents totaux",
      value: boxes.reduce((acc, box) => acc + box.items.length, 0),
      icon: <FileText className="h-5 w-5 text-blue-600" />,
      description: "Documents archivés",
      color: "bg-blue-100"
    },
    {
      title: "En attente",
      value: boxes.reduce((acc, box) => acc + box.items.filter(item => item.status === 'pending').length, 0),
      icon: <Clock className="h-5 w-5 text-yellow-600" />,
      description: "Documents à valider",
      color: "bg-yellow-100"
    },
    {
      title: "Validés",
      value: boxes.reduce((acc, box) => acc + box.items.filter(item => item.status === 'validated').length, 0),
      icon: <FileCheck className="h-5 w-5 text-green-600" />,
      description: "Documents approuvés",
      color: "bg-green-100"
    },
    {
      title: "Rejetés",
      value: boxes.reduce((acc, box) => acc + box.items.filter(item => item.status === 'rejected').length, 0),
      icon: <X className="h-5 w-5 text-red-600" />,
      description: "Documents rejetés",
      color: "bg-red-100"
    }
  ];

  return (      
    <div className="w-full max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      {notification && (
        <div className={`fixed top-4 right-4 py-2 px-4 rounded-md shadow-md z-50 animate-fadeIn ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {notification.message}
        </div>
      )}
    
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Archives Comptables</h1>
            <p className="text-gray-500 mt-1">Gérez et organisez vos documents comptables</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              {viewMode === 'grid' ? <List className="h-4 w-4 mr-2" /> : <Grid className="h-4 w-4 mr-2" />}
              {viewMode === 'grid' ? 'Vue liste' : 'Vue grille'}
            </Button>
            
            <Button variant="secondary" onClick={() => setFilterOpen(!filterOpen)}>
              <Filter className="h-4 w-4 mr-2" />
              Filtres
              <Badge variant="secondary" className="ml-2">
                {searchTerm ? '1' : '0'}
              </Badge>
            </Button>

            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau document
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <Card key={index} className="hover:shadow-lg transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{stat.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.description}</p>
                  </div>
                  <div className={`h-10 w-10 ${stat.color} rounded-full flex items-center justify-center`}>
                    {stat.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">Tous les documents</TabsTrigger>
            <TabsTrigger value="recent">Récents</TabsTrigger>
            <TabsTrigger value="pending">En attente</TabsTrigger>
            <TabsTrigger value="validated">Validés</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    
    <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Créer une nouvelle boîte d'archives comptables</h2>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Titre de la boîte..."
          value={newBoxTitle}
          onChange={(e) => setNewBoxTitle(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={handleCreateBox}
          className="py-2 px-4 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center shadow-sm"
        >
          <Plus className="h-5 w-5 mr-2" />
          Créer une boîte
        </button>
      </div>
    </div>

    {boxes.length === 0 ? (
      <div className="text-center py-16 bg-white rounded-xl border border-dashed">
        <div className="mx-auto h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Folder className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune boîte d'archives</h3>
        <p className="text-gray-500 max-w-md mx-auto mb-6">
          Créez votre première boîte d'archives pour commencer à organiser vos documents.
        </p>
        <button
          onClick={() => document.querySelector('input')?.focus()}
          className="py-2 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Créer maintenant
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {boxes.map((box, index) => (
          <div 
            key={index} 
            className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all ${
              isBoxHovered === index ? 'transform scale-105' : ''
            }`}
            onMouseEnter={() => setIsBoxHovered(index)}
            onMouseLeave={() => setIsBoxHovered(null)}
          >
            <div className="p-6 flex justify-between items-start">
              <div className="flex items-start">
                <div className={`p-3 rounded-lg mr-4 text-white ${box.color}`}>
                  {renderIcon(box.icon)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{box.title}</h3>
                  <p className="text-sm text-gray-500">
                    {box.items.length} document{box.items.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const updatedBoxes = [...boxes];
                  updatedBoxes.splice(index, 1);
                  setBoxes(updatedBoxes);
                  showNotification(`Boîte "${box.title}" supprimée`, 'warning');
                }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {box.items.length > 0 && (
              <div className="px-6 pb-4">
                <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {box.items.slice(0, 3).map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center py-1.5 text-sm">
                      {getFileIcon(item.type)}
                      <span className="ml-2 truncate">{item.name}</span>
                    </div>
                  ))}
                  {box.items.length > 3 && (
                    <div className="text-sm text-center mt-2 text-gray-500 font-medium">
                      + {box.items.length - 3} document{box.items.length - 3 > 1 ? 's' : ''} supplémentaire{box.items.length - 3 > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="p-4 border-t">
              <button
                onClick={() => setSelectedBoxIndex(index)}
                className="py-2 px-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg flex items-center justify-center transition-colors"
              >
                Ouvrir
                <ArrowLeft className="h-4 w-4 ml-2 transform rotate-180" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
    
    <style>{`
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideUp {
        from { transform: translate(-50%, 20px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
      }
      
      .animate-fadeIn {
        animation: fadeIn 0.3s ease-in-out;
      }
      
      .animate-slideUp {
        animation: slideUp 0.3s ease-out;
      }
    `}</style>
  </div>
  );
};

export default Archivagedesfacture;