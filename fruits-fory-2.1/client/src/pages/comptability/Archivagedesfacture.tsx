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
  { id: 'client-invoices', name: 'Factures clients', icon: Receipt, color: 'text-blue-500', description: 'Factures Ã©mises aux clients' },
  { id: 'supplier-invoices', name: 'Factures fournisseurs', icon: FileText, color: 'text-red-500', description: 'Factures reÃ§ues des fournisseurs' },
  { id: 'bank-statements', name: 'RelevÃ©s bancaires', icon: FileSpreadsheet, color: 'text-green-500', description: 'RelevÃ©s et documents bancaires' },
  { id: 'expense-reports', name: 'Notes de frais', icon: Calculator, color: 'text-amber-500', description: 'Notes et rapports de dÃ©penses' },
  { id: 'tax-documents', name: 'Documents fiscaux', icon: FileCheck, color: 'text-purple-500', description: 'DÃ©clarations et avis fiscaux' },
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
        showNotification('Veuillez vous connecter pour accÃ©der aux conteneurs', 'error');
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
        showNotification('Vous devez Ãªtre connectÃ© pour accÃ©der aux conteneurs', 'error');
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
      showNotification('Vous devez Ãªtre connectÃ© pour crÃ©er un conteneur', 'error');
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
      showNotification('Conteneur crÃ©Ã© avec succÃ¨s', 'success');
    } catch (error) {
      console.error('Error creating container:', error);
      showNotification('Erreur lors de la crÃ©ation du conteneur', 'error');
    }
  };

  const handleCreateBox = async () => {
    try {
      if (!auth.currentUser) {
        showNotification('Vous devez Ãªtre connectÃ© pour crÃ©er une boÃ®te', 'error');
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
      showNotification('BoÃ®te crÃ©Ã©e avec succÃ¨s', 'success');
    } catch (error) {
      console.error('Error creating box:', error);
      showNotification('Erreur lors de la crÃ©ation de la boÃ®te', 'error');
    }
  };

  const handleAddItemToBox = async (boxId: string, file: File) => {
    if (!file || !file.name) {
      showNotification('Aucun fichier sÃ©lectionnÃ© ou fichier invalide', 'error');
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
      showNotification('Document ajoutÃ© avec succÃ¨s', 'success');
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
      showNotification('Erreur lors du tÃ©lÃ©chargement du dossier', 'error');
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
      
      showNotification(`${selectedItems.length} document(s) supprimÃ©(s)`, 'warning');
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
      if (type.includes('releve') || type.includes('relevÃ©')) return <FileText className="h-5 w-5 text-blue-500" />;
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
      showNotification('Vous devez Ãªtre connectÃ© pour tÃ©lÃ©charger une facture', 'error');
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

      showNotification('Facture tÃ©lÃ©chargÃ©e avec succÃ¨s', 'success');
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
      
      showNotification('Erreur lors du tÃ©lÃ©chargement de la facture', 'error');
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
                <TabsTrigger value="recent">RÃ©cents</TabsTrigger>
                <TabsTrigger value="pending">En attente</TabsTrigger>
                <TabsTrigger value="validated">ValidÃ©s</TabsTrigger>
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
                    <Label>CatÃ©gorie</Label>
                    <Select
                      onValueChange={(value) => setSearchTerm(value)}
                      defaultValue="all"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Toutes les catÃ©gories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les catÃ©gories</SelectItem>
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
                        <SelectItem value="validated">ValidÃ©s</SelectItem>
                        <SelectItem value="rejected">RejetÃ©s</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>PÃ©riode</Label>
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
                            <span className="mx-2">â€¢</span>
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
                            {item.status === 'validated' ? 'ValidÃ©' :
                             item.status === 'rejected' ? 'RejetÃ©' : 'En attente'}
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
                            {item.status === 'validated' ? 'ValidÃ©' :
                             item.status === 'rejected' ? 'RejetÃ©' : 'En attente'}
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
                              <span className="mx-2">â€¢</span>
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
                              {item.status === 'validated' ? 'ValidÃ©' :
                               item.status === 'rejected' ? 'RejetÃ©' : 'En attente'}
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
                              {item.status === 'validated' ? 'ValidÃ©' :
                               item.status === 'rejected' ? 'RejetÃ©' : 'En attente'}
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
                              <span className="mx-2">â€¢</span>
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
                              {item.status === 'validated' ? 'ValidÃ©' :
                               item.status === 'rejected' ? 'RejetÃ©' : 'En attente'}
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
                              {item.status === 'validated' ? 'ValidÃ©' :
                               item.status === 'rejected' ? 'RejetÃ©' : 'En attente'}
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
                              <span className="mx-2">â€¢</span>
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
                              {item.status === 'validated' ? 'ValidÃ©' :
                               item.status === 'rejected' ? 'RejetÃ©' : 'En attente'}
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
                              {item.status === 'validated' ? 'ValidÃ©' :
                               item.status === 'rejected' ? 'RejetÃ©' : 'En attente'}
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
            <span className="text-sm font-medium">{selectedItems.length} Ã©lÃ©ments sÃ©lectionnÃ©s</span>
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
                <span>DÃ©posez vos fichiers ici</span>
              </div>
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="mx-auto h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <File className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun document trouvÃ©</h3>
              <p className="text-gray-500 max-w-sm mx-auto mb-4">
                {searchTerm 
                  ? "Essayez de modifier vos critÃ¨res de recherche."
                  : "Commencez par ajouter des documents Ã  cette boÃ®te d'archives."}
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
                        {item.status === 'validated' ? 'ValidÃ©' :
                         item.status === 'rejected' ? 'RejetÃ©' :
                         'En attente'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">CatÃ©gorie:</span>
                        <span className="font-medium">{item.category}</span>
                      </div>
                      {item.amount && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Montant:</span>
                          <span className="font-medium">{item.amount.toFixed(2)} â‚¬</span>
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
                        showNotification(`"${item.name}" supprimÃ©`, 'warning');
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
                        <span className="mx-2">â€¢</span>
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
                        window.op¨ƒh‹Å0‰[Şl¨4”ŒH–x‹
ÒR2LÈĞ%6%"dÆ µ0ú‰BÑô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîñ·®ûótz¼ü–}õC£††İvŒ›‹”¨‚Ô%â%Ø\…š(ìñz²{kEÑØ£ë8ù¯÷JÊ•šÂ~ãğ6M2)¸t`×§áE÷Œİú%ì\°ª)_Uê}@Şç¿÷Hè\D6pG¡<…¿3CÎN«^“ÔM Òíz?:İG„ívÂFM‰ú2düØ‚aKpÉöæiØâäÏ•ˆø3kà69'±)Sáœ½g—ë·˜­Y%mjV8Í.¢€Ôp<S&WUÆ,;¶™«­$,q3Tír|ÊPšÇce¹#r&*ıhÁùgäûR<N>#©ÒsZG‡wºG|Å+˜Q¤ãôì1{¥
àvòPÁ[ôëöèÕµØòË5H^¥5dÑcaÊKÒHACQ>¢¦YÏ”4ÆB)¾o˜cPÖNµäø¬¬b.np
œæP2÷«ç2ŠFÊûñø»^“º1Lâ‹+(l÷j;z}æ’À¤BOc9¥]N÷\x;2))ÖSPWš(ÌŸYÚ± ›æŒª‡	>p×‹ŸÔ¡êëßÉg¬q°[›ä ¸NØ·é9~ƒŸ®„«CE¨ …EÛ¿añEH@õÏ"…‡ËQç Tà(ÏÚë°–—Ôºá6RªÍ'yîÓÓ £#FqÍŠsTß¤ ËÔål€’`-8ñk´Ü&;²¥ë—½V	‹<—MCÁfEˆÚ(¢uİeÊüÄ–*¦¶5-8|áâ3m[à9§äŒÓt*ØÕœÄj­èp&Y1´(ï.1jˆÎ+“‚Ùê¥´fˆ4›8Õ»ÈáÇåç)"rFREÏ¶«Vx+¿„ãİıàúĞ²=tí‚‘–ËÕØqG›€T:R–Ï¢¯ÃĞ’/Ëé  !² ô÷Ü‰¦	U1èê“9©»Íª”°óŞ®¯Şô;4§ÁÅOSÚ#$æG¿ˆäxÕ õ'ù=}®\c’Q6C¹*;/ŒßâìvãÚ
õ…[íY³FJeÔæ£?—Š‰nòKÓ’"SŞwº"tßX©-GpÌ
)-•
Mq=–|ûB—°‘Ò€¢K't|xùüÓ!ApTe Ü…ê3öSù½'^	²²I‘yÀ fxL˜vØÁmaTĞp2›§Ä¨ëRlG¿”~Û¯àÄ¸›¼~&CZì3Š¨•QÅüî2:ªO…S¯æsvGÔfsâj0ìãÂªc”UÈ4çFÙŞ#è¦0êÎÀ„~Å8Lâ¿¶ijR@À½N-ºr[~ ”ìœ…¨”gÂ—)ƒG1mBKŒ˜mU‰]=€/¢ì6U¹`¡7v'‘tUÀúgtaî¦KlÑ'î¦"í*,¢â-ş¡û#3öJKy2ş‘' ï•óùo+•œ(0*ë‡Ùtƒ	‡İÛ¦<·`±v?
YªØã%ö&x­2¡ëŞŒ¢Ñ½äC2îO‚Ğ“iX±j½X½£Ûœ¤÷ ÜÜî–
 ƒ§üôÔO~3¥C„ÊË£a?U¾†w¥-Û¥Zó~3m¹ot[¾rÚqPÊÂ€Ä‘ìò»‹pPÿ°¤ÛÌ„|„(”v¶uÙ+”èÖuÛg}’±w»õŸ€“ÿQ/ëş0é5Î«4`¸ºñik‰Ş©“{qã9ãa¹ÊL2zUæg¢®#¨âu™çÁ È´¬¨5²˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-¦–EfÀ2.TgÍ¡;Ş©h‰o³ÇŠ)|úqY?D»±7Ïö(ŠAXÖ„AtşÖ U§ÅÎ(Ì‚t|Ã…Ê,Í¥Lí"IY% ñ$$Ïî›´€Ó“ÛÆ &z.UŸ@ô>ûİL=şÌ?_L¿êOğøûÜ¨¾Ïº¿\Œ«6T»¼¿¸Oög— ¿™Ne	ôHëÏNN‹‚À‘	EA0ûÇ.§ôÿş$¹®Ã»Ş³yùòµ\ç~S§ªöÕZ?:¾mKŸÒ #HI‰?¹ì&6faòè3ëÜ¼º Ó>ıáöë¿hà›ñ{¼ŒX4äŠ›#ÆøéIş2·£Ï^®÷‚ñG…İ)jqÃñï5¹ã>øú^ü6¾\‹¾ætL[RqVx‚ÅíTöNP%6%œù`½Î,k›Ğ¤“Ü†SJt"ufEÕ/øNº´ù6S›†ŞIJ1°ü»ş©úŒó¬(ñî+Ò¸»Åà[|Èî)sœ+¦gH	IÁˆ8y•-Dæ] û(IÑ9}­bwö9bÿúo{«Å–ê ÇÍ¹¹+ö¯Ïœ2”ÑxK½H"EJkˆ—“b&³”½ò‹Ó¦½Àø‘hXôáÙ>½N'Û½Ø¤©ÆâwÊlAlå“{lò;oŞCÚ©‚`®òÕ€%÷—‡Ò€B§VY_l¥_ÃsûécA7µãÈ¶¨y*¨bí$'ËÅ¸ÔÃ`Û—\Saq·”“Ps›©ˆ·û}Ûõïz?­O–Ns	·»Ém)xØíNDU Qû¡ù¬.Ø¼“i¤»N˜Š1LïğÛÒì­$¤y–LÑ s97ZTœ†s½#ææT½ ˆ÷Ğ{Õıù=¨ıH}ª™ß`¼é¶×­·çÏoÅŸîsñúœø–·]$£®-NØ’{d£ ˜_Ğw¦YÖA™
ñ:9ïÅ&³ZèfĞÁBê&°}8¾`½•¯N{äÁçÙ4)+a&Ü†áW}ÍÀ[=tü”Ş/¹{Íª~¡Ïä#¿I|Q<iI%?‡¯¹C.O*Š ¸§Uu`FGí j=ÕÔ×C,vÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†×VA'™+cµZšYºÏ*±Y,[šFÆ,+¢–v=öî[Â…°¿<ƒ.cñ\åy´ì<–lBYHÉILÑ+’f{8|2cú"´Ìm)› ‚Òşb_WoÃM¸GÌßl"àÓÿï)­dúù·å×Ûfè• ¬ıXÙå1LÈ!QkŸT‘’¾"‡v{Å¤Ö8/M­’gĞÖA+Og®Ø,½ÃNk+Ü™–‘"Ë«Ï³îJäÿ±~¯’“ª1nóÈ0ìdV*ûo$Ú Á‡mİFz½ VI9Q¶ii2áwäaeÏïÛà”¹ô,è
Ît¿?ËÜ·à€õÏÍu¨áÛ£¤€½ÛX7éÔqƒ»>°¿iV¨ ˆS_fÚEì(Ş¯àA~şÏÍÎpÎÍ„°œ‰0 İn×°ÎÓlÆ!æyºqXÚ  ÅÇ1ïÊÊ™btXñ6û¾Šf>¡5n8™ò(½UÒ`o’‡ú(£u/øİ@=Ãÿì]*Àaj7–ùRûB’dÉº’W£Ô†Æı’Æê,|âc²yy%´g®?S)ÊXkºŠË²$¶D™Ñ4ÀÊ§÷Öœ«(bb÷@€Ã¼¹Œ€ë¯A½ïÛõ´²õ­¬z@Ãˆ2ßÙ×øEO›uªDŒÛ€ë£kP.Ùã+¤î„R\½'57pèÛğ³«¹„º @±ßØ'Ü´~6[§ôaìŠÑø¦îd½\ôÙ{Õ¾ ò'ò<¯^aÖ¶R·C»!9»®‡Â9ğtò°Š]	ùUsìÔâ2Ig¸ÄıÄ²WÊÁzÉQ{Óˆ²×r,bt–¡ã<İG*K€‡è]'[º„Ü³.Q×øXÓ«BT=zúåuĞŞ%&¥ÕF„üÇârç+©’‘¹¢o[±°“QšyĞu’TyÌÖu\™ee•ğ©£÷ä¬ipÿa–®ÿÛà¡ôÎ—©ÁBéÊ˜4˜‰•ØĞ Kş#?jgÁùë¢#õ¶?4Å5t
sFmÃğïc­ÒF!<gª—RÚÎ#k®0¡+Ÿè¥µÏ)$>3°iCĞLË¹|»pªÎz%ø¬…œáV.#Ó£‡ç­	ÒK’h×IW!_…'¼âş3±éhà¨w¦“eoÈú­äáÌ.?¬oÁ#Î¦´ÅblÀğ§Öip;ÂjJĞßsøc~àïµóÓ2œg=™,ë•ßšİÔ§XODş³<•F ¡ºö-=jµXá¥veİ¥2„êX’¦÷xlÍB3VkkÈèZAŸºV‡Ëîä§¤HŒÎ”²ãnúvÊ#åÅÄÆl©¢†}YwÎfõ`qxö^ı†-F~]ƒóÚÔT{ ¼ŸÉ—lİvÚzºx°ÛÄ´­œ‚ÜM¶qs+ èŸ÷×¸`%aS›ÈVŸ˜›Y¹wëTBÙå*9äê·ğYë‰¼©rÏ#0¡¯C0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&åÉTqKe¿JÌY\höÂ*É'²c‹v)@n'³V.bb/V{…³1wË©ˆT»‡ª_h¶Ax1…¼oó³2xˆdX²ÁÁX§&5]c‚%\îb­B6«X…oÆ²hA"fi-	%ı}/Îd˜T”°0‡Şò"	fæq€ğßkì½÷şï¿Ê§ğûğõÿ/³»ÌÄ£<öÏÙ>üÏúÛ¯ê¼ÁO÷õø³<ENÊCˆÈ™$@ûºúşæ=¿®M³ÿş„²û
ğú­{®^s*3BnËí
Ì4µo_‚	RH @c:y*İ&"fšq·óÌ¹ªm[š8‹ö‚ı´¹øƒ!Õ ?8¸šŸ¬´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øû[ıÀ>8¢™Æôm8#ğVX—µ-~Ò ÎÂaHqı`9“a*›’“"“F"•§ƒåGğ˜œŸN.OÛ˜¸Úü¼¹ú =øÄÛë4ğøã½ºÌòL´èŠ©s¨ª‡÷½H¼IK‹Û8¥9òM³9Ñ1}-œëw–_U¼ü?‹ûŒ¤ê"{¯y@™ÍÆ{ïÜ€™8“©F>{Š×Ùn ¹« ŒƒØ&¶d8¨	zğÍü®=cæK>˜³‹ÀÇ«y„’­zLÉl¥lW’lÈ2;GíŞ$†—× _"p}AÖ	%4{h‹C1î™kÁ/4§Ü¶)IKï°g$Ú$¨ğÕpŸ•ß‘ak—–¡“êç¿Û>½:ø»ôKK7¹Yí0ù8İ)f›\	á‰ûåÎşOôûÉ­W¨ƒx‹Å0‰KŞl($”ŒH–x«
ÒR2LˆĞ%6%"dÆ$µ0úBÕô3ø5]ÍZÈÑAeE0ì#.+K­ªÂîù·®ÿótz¼ü†}õC£††İ6Œ›‹”¨‚Ô%â%Ø\…š(ìñz2{kAÓØ£ë8ù¯÷JÊ…šÂ~£ğ6M2)¸t`×§áE÷Œİú%ì\°ª)_Uª}@Şç¿÷
Hè\E6p	G¡<…¿3CÎN«^˜“ÕM Òíz?ºİG„­vÂNM‰ú2düØ‚aKpÉöæiØâìÏ•ˆø3kà6=#±)Sáœ½g—ë·˜­Y%mjV<Í.¢€Öp<S®SUÆ,;¶™«í$,q1Tír|ÊPŠÆce¹#r&*ıhÁùgäûR<^.#©ÒqZW‡wºG|Å+˜Q¤ãõì1{¥
àvóPÁ[ôëÖèÕµØòËuX¥5dĞc!ÊKÒHAãÑ.¢¦YÏ´4ÆB)¾o˜gĞÖNµäø¬¬bnr
œÆP2÷«ç2ŠFÊûñø»^“º±Lê‹+(l÷j;z}æ’Ğ¤BOc9¥]N÷\x2))ÒSPWš(ÌŸYÚ± ›æŒª‡	>p×‹ŸÔ¡êëÏ‰g¬q°[›ä ¹NØ·í9~ƒŸ®„»‹CE¨ …EÛ¿aóEH@õÍ"…‡ßç¡Tà(ÏRë0–—Ôºá6RªÍ'xïÓÓ £#FqÍŠsTİ¤ ËÔåL€’`-8ñi´Ü&;²¥ë—½V	‹<—MoCÁfE‰Ú¢uİ%ÊüÄ–*¦¶µ-8|áâ3iSğ9§äŒÓt*ØÕœÄj­èp&Y1´(ï.1jˆÎ+—‚Ùê¥´fˆ4™8Õ»ÈáÇåç)"rFREÏ¶«x+¿„ãİùàúĞ²=tí‚‘–ËÕØqG›€TR–Ï¢¯ÃÑ–/Ëé  !² Ô†÷Ü‰¦U1ìî“1©»İª°óŞ®¯Şô;4Y§ÁÅOSÚ#$æG¿ˆ¤xÕ õ'ù}®\c’Q6C¹*;/ŒßâävãÚ
õ…[íY³fBeÔæ£?—Š‰nîòKÓ’"SŞwº"tßX©-GpÌ
©-•Mq=–|ûB—°‘Ò€¢K't|xùüÛ!ApTe È…ê3öSù½'^	²²	“yÀ fxL˜vØÁmaØp²›§Ä¨ëRlG¿”~Û«à‹Ì¸›¼~&CZì3Š½¨•QÅüî2ªO…S¯æsvGÔos¢j0ìãÂªc”UÈ!4çŸFÙŞ#è¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[ ”ìœ…¨”gÂ—+ƒG1-BKŒ˜}U©]=„¯œ¢ì6U¹`¡7v/‘tUÀúgtaî¦ËlÑ'î¦"í., Â-ş!û#3öJKY2ş‘' ï•óùo#•œ(0*ë‡ÙTƒ	‡×Û¦<·a±v?ŠYªØã%ö&|­2¡ëŞŒ¢Ñ½äC2îK’Ğ“éZ±j½P½ƒÓœ¤÷ ÜÜÎ–Š “§üôÔ_~7¥C„ÊË£a†?U¾†w¥-Û¥Zóv3}¹otS¾rÚQTËÂ€Ä‘ìĞò»ŠpP÷ğ¤ÛÌ„|€(”v—uÙ+„èÖuÛg}’±w»õŸ€“ÿq/ëş0é5Î«4`¸ºñik‰Ş©“{qã9£`¹ÊL"zUîg¢®%#¨êu™çÁ Ê4¬¨4²˜·¶ô
ÅYnÅ,’'¿{,Q¶s‚^ A)-§–EfÀ2nVg¡;Ş©h‰o³Ç‹)|øqY ?D»±7Ïö(ŠEXÖ„atşÖ U§ÅÎ(Ì‚t|ƒ…Ê,Í¤LíbIY% ±$$Ïî›´”Ó“ÛÆ "z.UŸ@ğ¾ûİL=şÌ?_L¿êOğøûÜ¨¾Îº¿\Ì«6T»<»¸Oöc— ¿™Ne	ôhëÏN‹‚È‘	EA0ûÇ.§õÿş$¹®Ã»Ö³yùòµ\ç~S£ª	öÕÒ¿:¾mKŸÒ€#HI‰?¹ì&6faòè3ëÜ¼º Ó>ıáöë¿èà›q{¼ŒX4äŠ›#ÆøéIşr·£Ï^®ó‚ñG…İ)jqÓñï
7¹ã>øú^ü6¾\‹¾ætL[RqVx‚ÅíTöNP%¶%œù`½Î,k›Ğ¤“Ü†SJt"ufFÕ/øNº´ù>S›†îIJ1°ü»ş
©úŒó¬(qî+Ò¸»Åá[|Èî)sœ+¦gH	KÁˆ8y•-Dæ]àû(IÑ¹}­bwö9bÿúo{«Å–ê4ÇÍ¹½+ö¯Ïœ2ÑxC½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hXôáÙ>¼N#Ù½Ø¤©Æ?æwÊİlAlå“{lò;oÌCÚ©‚a®öÕ‚%×—‡Ò€B§VQKl¥_ÃsûécA7µãÈ¶¨y*¨bù$%ËÔ¸ÔÃa™—^Saq·”“Ñó›©ˆ·ûÛõïz?­N–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼“i´»N˜Š1LïğœÛÒì­$¤y–LÓ¡s97ZT†s½#ææT½ ˆ÷Ğ{Õıù=¨ıH}¢™ß ¼é¶×­·æ€ÎoÇ›îsñúœø–µ]$£®=NØ²yd£ Ğw®YÖA™
ñºïÅ&£ZèfĞÁBê&°}(¾`½•N{äÁ÷™49+a&Ü†áW}ÍÀ[=tü”Ş/¹{Mª~¡Ïä#¿I|Q<iI%?‡¯¹C.O* ¸§Uu`FGåj=ÕÔ×C,vÎle¬ĞtêØ3 nØëÀ—×9kê·h°ósñ†ÖVA'™+sµÚšYºÏ(±Y,[šFÆ.+¢–v=öîÚÂ¥°½<ƒ.có\åy´ì<–lÂYÈÉIMñ+‚f{8|2cú"¼Ìm)› ‚Òöâ_oÃMºGÄÏl"àÓÿï)dúù·Å×Ûfè• ¯ŒıXÙå1Lˆ!QkT‘‚¾"v{Å¤Ö8/M­’gĞÖ
A+Oe¬Ø,=ÃNk+Ü™–±"Ë«Ï³îJäÿ±~¯’“ª1nóÈ0ìd*ûo$Û¢Á‡mİFz½•@VI9Qöii2áTwäaeÏïÛà”¹Ôè
”Ît¿?Ëœ·à€õÏÍu¨aÛ£¤€¼ÛX7éTqƒ»>°¿iU¨ ˆS_fŞEì(Ş¯àÁ~şÏíÙÎpÎÍŒ°œ‰0 İn×°ÎÓlÆ!æiºqXÚ ¨ÄÇ1ïÊÊbtXñ7»¾šŠf>¡5n8™ò8½UÒ`o’‡ú(£u/øİ…@=Áÿì]:Àaj7–ùRûB²dÉº’W£Ô†Æı’Æê,|âc²yù%´g®?S)ÊXkºŠË²$¶E™Ñ0ÀÊ§÷Ôœ«(bf÷@€Ã¼¹Œ€ë¯A½ïÚõ´²õ­¬z@Ãˆ²ßÙ×ø¡EO“uªDŒÛ€ë#kP.Ùã+¤î„R\½g570èÛğ°£¹„Dº @±ßØ'Ü´~6[§üaìŠÑø'îä½\ôÙ{Õ¾¤ò'ò<^aÖ¶R·C»!9¿¦Â9°tò°Š]	ù]säÔâ2Ig¸Äı@²WÊÁzËQ{Óˆ²×r,bt–¡ã:İG*k€‡è]'_º„Ü³.Q×øZÓ«BT=zúåuĞŞ%&¥ÕF€üÇâr÷#©’¹¹¢O[±°“QšyĞuTyÌÖu\™ee•ğ©£õä¬ipÿa–®ÿÛàáôÎ—©ÁBéÎ˜4˜‰•ØĞ Kş?jgÁùë¢#õö>4Å5t
sFìÃğï#­ÒF!<gê—RÚÎ#k®0¡+Ÿè¥µÏ-d>3°iCĞLË¹|»pªÎzø¬…œáV.#Ë£Gç­	ÒKÒh×IW!_…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?¬oÁ#Îæ´ÅblÀà§Öip;ÂjJßsøÃ~àï½óÓ2œg9™,ë•ÛšİÔ£xODş³5F ¡ºö-=j½Xá¥veİ¥2„êX¦÷xlÍB3Vkk9ÈèZA¿ºVÇËîä§¤HÌÎ”ãnúvÊ#åÅÄÆl©¢†y]wîvõhqYxö^ı†-F~]ƒóÚÔT{¼ŸÉ—lİvÚzºx°ÛÄ´­œ‚ÜM¾qs+àè÷×¸`%aS›ÉVŸ˜›Y¹wûTBÙå*9äî—ğYë‰¼©rß#0¡«C0¹gÌj\P”ÃÖ‡(æu>¿çÔsèÛ&åÉTqKe¿JÌY\hòÂ*Ë'²c‹v)@n'³V.bb/V{…»1wË©HTŸ³‡ª]h&Ax1…¼oó³2xˆd²ÁÁX§&5]c‚%\îbC6«X…n\Æ²hA"	fi-	%ı„}/Îd˜T”°0‡Şò"	fæq€ğßkì½÷îï¿Ê§ğûğõÿ/³»ÌÄ£<öÏÙ>ìÏúÛ¿ê¼ÁO÷
uø³<ENÊCˆÈ™$@ûºúş}ö9¿®M³ÿş”²û
ğú­{®^s*3JnÊìÌ4µo_‚	RH @C:y*İ&"fšñ·óÌ¸ªm[š8‹ö‚ı´½ø‹!Õ ?8¸šŸ¬´¸¸™áUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«ğû[ıÀ>8‹¢™Æôm8£ğ^X—µ-~Ò(ÎÂEHuù`9“áª›’“"“F"•§ƒåGğ˜œŸN.OÛ˜¸Úü½¹ú =øÄÛë4ğøã½ºÌrL´èŠ)s¨ª‡÷½H½IK‹Û8¥9òM³8Ñ1}-œëw–_U¼ü?‹ûŒ¤j {ëù@™ÍÆ{ïÜ€™8“©F>{Š×Ùn ¹« ŒƒØ&¶d0¨	z<ôÍÜ®=cæK>˜³ËÀÅ«i„’­zLÉl¥dW’lÈ2;GíŞd†“×¡_¢p]A‚Ö	%4{h‹C1î™kÁ/°§Ü¶)IKï°‘g$Ú$¨ĞÑpŸ•ß‘ak—–¡“êç¿Û>½8ø»ÔKK7©Yí0ù8İ)f›\	á‰ûåÎúOôûÉ$­G¨ƒx‹Åp‰[Şl¨$”ŒH–x‹
ÂR2LÈĞ%6%"dÆ µ0úBÕô3ø5]ÍRÈÑAeE0ì#.+O­ªÂîı·®ûótz¼ü–uõC£††…İvŒ›‹”¨‚Ô%â%Ø\…š(ìñz²{kAÓØ£ë8ù¯÷JÊ•šÂ~ãğ6M2)¸t`×§áE÷Ìİú%è\°ª9_Tª}@Şç¿÷Hè\Evp	G¡<…¿3CÎN«^˜“ÕM Òíz?ºİG„ívÂFMZ‰úrdüØ‚aKpIöæiØâäÏ•ˆø3ià&9#±)Sáœ½g—ë—™­Y%mjV<Í.¢€Ôp<S®SUÆ,;¶™«í$,q3Tír|ÊPŠÇce¹#ò&*ıhÁÙgäùR<N.#©ÒsZG‡wºG|Å+˜Q¤ãõì{¥
àvòPÁ[ôëöèÕµØòËuX¥5dQc!êKÒHAcÑ>¢¦ÙÏ”<Æ)>o˜gĞÖ–Nµäø¬¬bnr
œæP0÷ëçU2ŠFÊûñø»^“º±L£‹+(l÷j;z}Æ’Ğ¤BOc¹¥]N÷\x2))ÂSWš(ÌŸYú±¨›æŒª‡	>p×‹ŸÔ¡êëßÉg¬q[›ä ¹NØ¶é9~ÃŸ®„»‹cE¨ …EÛ¿aóEH@õÏ"…‡Ïç¡Tà*ÏZë°–—Ôšá6RªÍ'|ïÓÓ £#VyÍŠsTß¦ ËÕåL€’`-8ñk´ş&;²¥ë—½V	‹<—MCÁfE‰Ú¢uİ%ÊüÄ–*¦¶5-8|áâ3iSà9·äŒÓt*ØÕŒÄz­èp&Y1´(ï.1jˆÎ+—€‚Ùê¥´fˆ4™8Õ»ÈáÇåç	"sFREÏ¶«x+¿„çİıàúĞ²=tí‚‘–ËÕØqG›€TR–Ï¢¯ÃÙ’/Ëé  !² ´†÷Ü‰¦	U1èî“1©»Åª”°òŞ®¯Şõ;4[§ÁÅOSÚ#$æG¿ˆd½xÕ õ'ù=}®\c’Q6C¹*;/ŒßâìrãÚ
õ…[í³fBeÔæ£?—Š‰nÎòKÓ’"SŞwº"tßX©-GtÌ
©-•M1=–|ûB—°‘Ò€¢K't|xùüÛ!ApTe Ü…ê3öSù½'^	²²	‘yÀ fxL˜vØÁmaĞp2›çÄ¨ïRlG¿”~[¯à«Ô¸›¼~&CZì3Š¨•QÅüî2ªO…S¯æ3vGÔosâj ìãÂªc–UÈ!4çFÙŞ#è¦0êÎÀ„~Å8Lâ¿¶ijR@À¹N-ºr[ ”ì˜…¨”gÂ—+ŸƒG1mBKŒ˜eU©]=„/¢ì6U¹`¡7t¯‘tUÀúgtaî¦ËlÑ'î¦"íj, â-ş!û#3öJKY2ü‘' í•óùo+•œ(0*ë‡ÙTƒ	‡İÛ¦,·a±v?
YªØã¥ö"|­2¡êŞŒ¢Ñ½ä#2îK’Ğ“éZ±kP½ƒÓœ„ó ÜÜÎ– ƒ§üôÔ_~7¥C„ÊË£a†?U¾†w¥-Û¥Zó~;}¹opS¾rÚQTËÂ€ÙÄ‘Ìò»ŠpPÿğ¤ÛÌ„t
(”v–uÙ+„èÖuÛg}’±w»õŸ€—ÿQ/ëş0é5Î«4`¸ºñik‰Ş©“{qã9ãa¹ÊL2zUîg¢®%#¨âu˜çá Ê4¬¨4²˜·¶ô
ÅYnÅ,’'¿Û,Q¶s‚^ A)-¦–EfÀ2>ÖgÍ¡;Ş©h‰o³ÅŠ)|øqY?D»±3Ïö(ŠAYÖ„avşÖ U§ÅÎ(Ì‚||ƒ…Ê,Í¤Lí"IY% ñ$&Ïî»´€Ó“ÛÆ "z.UŸ@ğ¾ûİL=şÌ?_L¿êOğ¸ûÜ¨¾Ïº¿\Œ«6T»¼Ÿ¸Oöc— ¿™Ne	ôhëÏN‹‚È‘	EA0ûÇ.‡ôûş$¹®Ã»Ş»yùòµ\çnS§ªöÕÚ¿:¾mJŸÒ #HI‰?¹ì&6faòê3ëÜ¾º Ó>ıáöë¿hà›ñ{¼ŒX4äŠ›#ÆúéIşv·#Ï^®÷‚ñG…İ!jqÃñï7¹ã>øú^ü6¾\‹¾ætL[RqVx‚ÅéTvNP%¶%œû`½Ï$k›Ğ¤“Ü†SJt"ufDÕ/øNº´ù>S›†ÎIJ1°ü»ş­úŒó¬(ñî+Ò¸»ÁÁ[|Hî)s%œ+¦gI	KÁˆ8y•¬Dæ\ û(IÑ9}­bwö9bÿúo{«Å–ê8ÇÍ¹¹/ö¯Ïœ2ÑxC½H"EJkˆ—“b&³¹òËÓ¦½Àø‘hXôáÉ>¼N#Ù½Øä©ÆâwÊ™lAlå“{lò;kÜCÚ©‚`®öÕ€%×—‡Ò€B§VYOl¥_ÃsûècA7µãÈ¶¨y*¨bñ$/ËÄ¸ÔË`›—\Saq·”“Pó›©€·û}Ûõîz?­O–Ns	·¹Ém)xÙíFDU Qû¡ù¬.Ø¼é´»N˜Š1LïğÛÒÌ­$¤y–NÑ¡s97ZTœ†s½#ææT½ ¨÷Ğ{Õıù=¨ı	H}ª™ß@<É¶×­·æ ÎoÇŸîsñúœø–·]$£®.-NØ²yä£ Ğw®YÖA™
ñ:ïÅ&³ZèfğÁBê&°}(®`½•N{äÁ÷Ù4)+a&Ü†áW}ÍÀZ=tü”Ş/¹ûÍª~¡Ïä3¾I|Q<iI$?‡¯¹C.O*Š ¸§Uu`FGíj=ÕÔ×C,vÎ™le¬ĞtêØ3 nØëÀ—×9kê·h°ósñ†ÖVA'™+wµZšYºÏ(±Y,[šFÆ,+¢—v=öî[Â¥°½Ÿ<ƒ.có\åy´ì<–lBYÈÉILÑ+‚f{8|2cú¢¼Ìm)› ‚Òşb_oÃMºGÌßl"àÓÿï)¥dúù·Å×Ûfà• ¯ŒıXÙå1LÈ%QkT‘’¾"‡v{Å¤Ö8/M©’gĞÖ
A+Og¬Ø,½ÃNk+Ì™–‘"Ë«Ï³îJäÿ±~¯’“ª1nóÀ0ìäV*ûo$Û¢Á‡mİFz½ VIQ¶ii2áwäaeÏïÛà”¹Ôè
Ît¿?ëÜ·à€õÏ1¨aÛ£¤€½ÛX7éTqƒ»>´¿iT¨ ˆS_fÚUì(Ş¯àÁ~şÏíÎpÎÍ„°œ‰0 İn×°ÌÓlÆaæiºqXÚ ¨ÅÇ1ïÊÊ™b4Xñ6û¾‹f>¡5n¸‰ò8¼UÒ`o’‡ú(£u/øİ…@=Áÿì]*Äaj7–àRûB²dÉº’W£Ô†Æı’Æê,|âb²9y	%´g®7)ÊXkºŠË²$¶D™Ñ4ÀÊ§ç×¼«(bf÷@€Ã¼¹Œ€ë/A½ïÚÕ´²u­¬z@Ãˆ²ßÙ×øEo›õªDŒ›€ë£kP.Ùã{¤î„R\½'˜570èÛğ±«¹„º @¹ßØ'\´~6[§ôaìŠñú&îd½Tô™{Õ¾ ò'ò<¯^aÖ¶R¶C»!9¿¦‡Â9ğtò°Š]	éUsìÔâ2Ig¸Äı@³WÊÁzÉQ{Óˆ²×r,bt–¡ã>İG:K€‡è]'[º„Ü³.Q×øXÓ«BTzúåuĞŞ%&¥ÕF€üÇâr÷'©’1¹¢O[±°“Qšyu²TyÌÖu\™ee•ğ©£÷ä¬ipÿa–®ÿÚà¡ôŞ—©ÁBéÎ˜4ˆ‰•ØĞ Kş#?jgÁùë¢#õö?4Å5t
sFìÃğïc­’F!<gª—RÚÎ#k®0¡+Ÿà¥µÏ)$>3°iCPLË¹|»pªÎz%ø¬…œáV.#Û£‡ç­	ÒK’h×IW!_…'¼âş2±éhà¨w¦“eoÈú­àáÌ.?®oÁ#Î¦´ÅblÀà§Öip;ÂjJŸsøc~àïµûÓ2œg)™,ë•ÛšİÔ£XODş³µF ¡ºö-=jµxá¥vu]¥„êX–¦÷xhÍB#Vkk9ÈèA¿ºV†Ëîä§´HŒÌ”2ãnú$|Ê#åÅÄÆh«¢†}]wîvõhqxö^ı†-F~]ƒóÚÔT{ ¼ŸÉ—lİvÚzºx°ÛÄ´­†ÜM¶qs+ èŸö×¸`%iS›ÉVŸ˜›Y¹wëTBÙÅ*9äê·ğYë‰¼©r×#0¡¯Ã0¹gÌj\P”ÃÖ•‡(æu>¿çÔsèÛ&õÉTqKe¿JÌY\hòÂ*É'²c‹v)@n'³V.bb.VK…³1uË©HTŸ³‡ª]h¶Ax1…¼oó³2xˆdX’AÁX§&5]c‚%\Tîb­B6«X…nÆ²hA"	fi-	%ı„}/Îd˜T”°0‡Úò"	fæq€ğßëì½÷şï¿Ê§ğëòõÿ/³»ÌÄ£<öÏÙ>üÏúÛ¿ê¼ÁO÷
õø³<ENÊC‰È™$@ûºúşö=¿®M³ÿş„²û
ğú©{®^S*3BnËíÌ4±o_‚	RH @C:Y*İ&"fšñ·óÍ¸ªm[š8‹ö‚ı´¹ø‹!Õ ?8¸š¬´¸¸™ãUR\úEíëp¿‹Ê‚ç ¹×éÏhú[¶î
!¸«øû[ıÀ~8¢™Æôí8£ğ^X—µ-~Ò ÎÂeuù`9“aŠ›’›"“F"•§ƒåGğ˜œŸN.OÛ˜¸Úü¼¹ú =øÄÛë4ğøã½ºÌòL´èŠ)s ª‡÷½H¼IK‹Û8¥9ò]³9Ñ1}-œëw–_U¼ü?‹ûŒ¤j"{«ù@™ÍÆ{ïİ€™8“©F>{Š×Ùl ¹« œƒØ&¶d8¨	z<ôÍü®=cæK:˜³À×«y„’­zLÉl¥dW’lÈ2;GíŞ$†—×!‚p]A‚Ö	%4{h‹C1î™kÁ?´¥Ü¶)ÉKï²g$Ú$¨ğÕpŸ•ß‘ak—–¡“êç¿Û>½:ø»ÔKK7©Yí0ù8İ)f›\	á©ûåÎşOôûÉ$­Gªƒx‹Å0‰[Şl¨$”ŒH–x‹
 ÒR2LÈĞ%6%"dÆ$µ0úBÕô3ø5]ÍZÈÑAeE0ì#.+O­ªÂîñ·®ÿótz¼ü†}õC£††İ6Œ›‹”¨¢Ô%â9%Ø\…š(ìñz²{kAÑØ ë8ù­×JÊ•šÂ~ãğ6M2)¸t`×§áE÷ˆİú%è\°ª)_Uª}AŞç¿÷Hè\Up	G¡<…¿3CÎN«^“ÕM Òíz?ºİG„­vÂFM‰ú6düØ‚aKpÉöæiØ¢äÏ•ˆø3kà68#±)Sáœ½g—ë—˜­Y%mjV<Í.¢€Ôp<S®[UÆ,;¶™«­$,q3Tír|ÊPšÇce¹#r&*ıhÁÙgäûR<N.#¹ÒqZG‡wºG|Å+˜Q¤ãõì1{¥
àvòPÁ[ôëöéÕµØrËuXZ¥5dĞc!ÊKÒHAãÑ>¢¦YÇ”4ÆB)>kØcĞÖNµäğ¬¬`nr
œæP2÷§ç2ŠFÊûñø»^“º1Lâ‹+(l÷j;zyä’Ğ¤BOc9¥]N÷\x2))ÂSPWš(ÌŸYÚ± ›æŒª‡	>p×‹ŸÔ¡êëßÉg¬q°[›ä ¹NØ¶é9~ƒŸ®„»‹CE¨ …EÛ¿añEH@õÏ"…‡Ëç¡Tà(ÏZë°–—Ôºá6RªÍ'xëÓÓ £#F{ÍŠsTß¤ ËÔåL€’`-8ñi´ü&;²¥ë—ıV	‹<—MCÁfE‰Ú¢uİ'ÊüÄ–*¦¶5-8|áâ3iSğ9·äŒÓt*ØÕœÄj­èp&Y1´(ï.1jˆÎ+“‚Ùê¥´fˆ4›˜Õ»ÈáÇåç)"pfREÏ¶«Fx+¿„çİùàúĞ²=ví‚‘–ËÕØqG›€TR–Ï¢¯ÃÑ’/Ëé  !² ô÷Ü‰¦	U1èê1­»Íª”°óŞ®¯Şô;4[§ÁÄOSÚ#$æG¿ˆä½xÕ õ'ù=}¬\c’QvC¹*;/ŒßâìvãÚ
õÅ[íY³fBeÔö£?—Š‰nÎòKÑ’"SŞwº"tßX©-GpÌ*©-•Mq=–|ûB‡°‘Ò€¢K't|xùüÛ!ApTe Ü…ê3öSù½'^	²²	“yÀ fxL˜vØÁmaĞp2›çÄ¨ëRlG¿”~Û¯à‹Ô¸›¼~&CZì3Š½¨•QÅüî2:ªW…S¯æsvGÄOs¢j0ìãÂªc”UÈ!4ç‹FÙŞ#è¦0êÎÀ„>Å8Lâ¿¶ijR@À¹N-ºr[ ”ì˜…¨”gÂ—+ŸƒG1BKŒ˜mU‰]=„/œ¢ì6U¹`¡7t§‘tUÀúgtaî¦ËlÑ'î¦"í.$ â-ş!û#3öJKY2ü‘' ï•óùo+•œ(0*ë‡Ùtƒ	‡İÛ¦<·a±w=ŠYªØã%ö&|­2¡ëŞŒ¢KÑ½äC2îK’Ğ³ÉX±kP½ƒÓœ¤÷ ÜÜN–
 ƒ§üôÔ_~3¥C„ÊË£A†?U¾†w¥-Û¥Vó~;}¹ot[¾rÚQTËÂ€Ä‘Ìò»ŠxPÿğ¤ÛÌ„|„(”v–uÙ+„èÖuÛw}’±w»õŸ€“ÿA/ëş0é5Î«4`¸ºñik	©“{qã9ãa¹ÊL2zUîg¢®5¨âu™åÁ È4¬¨4¶˜·¶ô
ÅYnÅ,’'¿[,Q¶s‚^ A)-§–EfÈ2.Ög¡;Ş©h‰o³ÇŠ)|úqY?D»±7Ïö(ŠAXÖ„atşÖ U§ÅÎ Ì¢||ƒ…Ê,Í¤Lí"IQ% ñ$$Ïî›´Ó“ÛÆ "z.UŸ@ğ¾ûÜL9şÌ?_L½êOğøûÜ¸¾Ïº¿TÌ«6p»¼¿¸Oöc— ¿™Ne	ôhëÏNN‹‚È‘	EA4ûÇ.‡ôëş$¹®ã»Ö³yùòµ\ç~S£ªöÕÚ¿:¾mKŸ’ #HI‰?¹ì&6faòè3ëÜ¼º ’>ıáöë¿hà›ñ{¼ŒX4äŠ›#ÆøéIşv·§Ï^®÷‚ñG…Ü)jqÃñï
5¹ã>øúü6¾\‹¾ætL[RqVx‚ÅéTvNP%¶%œù`½Î$k›Ğ¤“Ü†SJt"ufDÕ/øNº´ù>S›†ÎIJ1°ü¿ş­úŒó¬(ñî/Ò¸»ÅÁ[|Èï)sœ+¦gH	KÁÈ8y•-Dæ\ û(IÑ9}­bwö9bÿúo{¯Å–ê0ÇÍ¹¹/ö¯Ïœ2ÑxC½H"EJkˆ—“b&³¹ò‹Ó¦½Àø‘hXæáÙ>¼N#Û½Ø¤©ÄâwÊ™lAlå“{mò4;oÜCÚ©‚`®öÕ€%÷—‡Ò€B§VYOl¥_ÃsûécA7µãÈ¦¨y*¨bù$'ËÄ¸ÔÃ`™—\Saq·”“Ps›©˜·û}Ûõïz?­O–Ns	·¹ém	xÙíFDU Qû¡ù¬.Ø¼“i´»N˜Š5LïğœÛÒì­$¤y–LÑ s97ZTœ†s½#ææT½ˆ÷Ğ{Õıù=¨ı	H}ª™ß`¼É¶×­·æÏoÇŸîsñúœø–µ]£®-NØ’yd£ Ğ÷¦YÖA™ñ:ïÅ³ZèfĞÁBê&°}(®`½•N{äÁ÷Ø69+a&Ü†áwyÍÀ[=tü•Ş/¹{Íª~¡Ïä#¿I|Q<iI$?‡¯¹C.O*Š ¸§Uu`FGíj=ÕÔ×ClvÎle¬ĞtêØ3 nØëÀ—×ykê·h°ósñ†×VA'™+óµZšºÏ(±Y,[šFÆ.+¢–v=öî[Â…°½<ƒ.cñ\åy”ì<–lBYÈÉILÑ+‚f{8|2cú"¼Œm)› ‚Ööâ_oÃM¸GÌÏl"àÓÿï)­dúù·Å×[fè•0¯ŒıZÙå1LÈ!QoT‘‚¾"v{Å¤Ö8/M­’gĞÖA+Kg®Ø,½ÃNk+Ü™–±"Ë«Ï³îJäÿ±z¯’“ª1nóÈ0ìdV*ûo$Ú¢Á‡mİFz½VI9Q¶ii2áwäaeÏïÛá”¹ôè
Ît¿?ËÜ·à€õÏÍu¨aÛ£¤€½ûX7éDqƒ»>°¿iT¨ ˆS_fÚEì(Ş¯àA~şÏíÎpÎÍ„°œ‰0 İn×°ÎÓlÆ!æiÍºqXš  ÅÇ1ïÊÊbtXñ7û¾Šf>¡5n8™ò8½UÒ`o’‡úh£u/øİ…@=Áÿì] *Àaj7–øRûB²dÉº’W£Ô†Æı’Æê,|âc²yy%´e®7)ÊXkºŠË²$¶L™Ñ4ÀÊ§÷Ôœ«(bf÷@€Ã¼¹Œ€é/A½ïÚõ´²õ­¬z@Ãˆ²ßÙ×ø¡EO›u¨DŒÛ€ë£kP.YÃ=+¤î†R\½g570èÛğ±«¹„º @¹ßØ'Ü´~6[§ôaìŠñø¦îd½\ôÙ{Õ¾ ò'ò<^aŞ¶P·C»!9·®‡Â9ğtò°Š]ùUsèÔâ2Ig¸Äı@²WÊÁzÉQ{Óˆ²ßr,
bt–¡ã:İG*K€‡è]'[º„Ü³.A×øXÓ«BTzúåuĞŞ%&¥ÕF€üÇâr÷#©’¹¹¢o[±°“QºyĞu’TyÌÖu\™ee•ğ©£÷ä¬Ipÿa–®ÿÛà¡ôŞ—©ÁBéÊ˜4˜‰•ØĞ Kş#?jgÁùë¢#õö?4Å5t
sFlÃğïc­ÒF!<g«—RÚÏ#k®0¡+Ÿè¥¥Ï)$>3°iCĞLË¹|»pªÎ:%ø¬…œáV.#Û£‡ç­	ÒK’h×IW!_?…'¼âş3±éhà¨w¦“eoÈú­àáÌ.?¬oÁ#Î¦´ÅblÀà§Öip:ÂjJßsøC~àïµóÓ2g)™,ë•ßšİÔ¢XOÄş³<µF ¡šö-=jµØá¥veİ”¥0„úX¦‹÷xlÍB3Vkk9ÈèZA¿ºR‡Ëîô¥¤HÌÎ„2ãnú6ÊcåÅÄÆl©¢†}]wîvõhqxö^ı†-F~]ƒóÚÔTz ¼ŸÉ—lßvÚzºx°ÛÄ±­œ‚ÜM¶qs+€¨÷×¸`%aS›ÈVŸ˜›Y¹wëTBÙå*9äê·ğYë‰¼©r×#0¡¯C0¹oÌj\P”ÁÖ‡(æu>¿çÔsèÛ&åÉTqKe¿JÌY\xòÂ"É'²cƒv)@n'³V.bb/V[…»1wË©HT³‡ª]h¶Ax1…½oó³2xˆdX’ÁÁX§&5]c‚%\\îb­F6«X…oÆ²hA"	bi-	%ı„}/Î`˜T”°0‡Úò"	fæq€ğßk•ì½÷îï¿Ê§ğûğõÿ/³»ÌÄ£<öÏÙ>üÏúÛ¿ê¼ÁO÷uø³<ENÊKˆÈ™$@ûºò7ş¶=¿®M³ÿş„²û
ğú­{®^s"3BnËìÌ4µo_‚	RH @C:y*İ&"fšñ·óÎ¸ªmSš8‹v‚ı´½øƒ!Õ ?8¸ŠŸ¬´¸¸™ãUR\úEíëp¾‹Ê‚ç ¹×©Ïhú[¶î
!¸«øû[ıÀ>)¢™Æôm8£ğ^X—µ-~Ò(ÎÂEHuù`9“aª›’“"“N"•§‡åGØ˜œŸN.OÛ˜¸Úü¼¹ú =øÄÛë4ğøã½ºÌòL´èŠ)s¨ª‡ç½H¼IK‹Û8¥9òI³)Ñ1}-œûw–_U¼ü?‹ûŒ¤ê {«y@™ÍÆ{ïÜ€™8“©V>{Š×Ùn ¹« ŒƒØ&¶d8¨	zôÍü®=cçK>˜³KÀÇëi„’­zLÉl¥QdW’2lÈ2;GíŞ’d†——!¢p]A‚–	%4{h‹G1î™kÁ/´§Ü¶)IKÏ²g$Ú$¨ğÑpŸ•ß‘ak–¡“êç¿Û>½:ø»+ÔKK7©Yí0ù8İ)f›\	á‰ûåÎşOôûÉ4­Gªƒx‹Å0‰KŞl¨$C”ŒH–x‹
ÒR2LÈĞ%6%"dÆ$50ú‰BÕô3ø5]ÍZÈÁIeE0ì#.+O­ªÂîù·®ÿótz¼ü„}åC£††İvŒ›‹”¨ƒÔ%â%Ø\…š(ìñz2{kAÓØ£ë8ù¯ÆJÊ•šÂ~ãğ6M2)¸t`W§áE÷Œİú%ì\0ª)_Tª}@Şç¿÷Hè\E6pG¡<…¿3CÎN«^˜“ÅM Ò“íz?ºİW„­vÂFM‰ú2dìØ‚aKpÉöæiØâäÏ•ˆø3kà69'±)Sáœ½gŸë—˜­Y%mjV<Í.¢€Ôp<S®[UÆ,;¶™«­$,q3Tír|ÊPŠÇcu¹#p&*ıhÁùgäûR<N.#©ÒsZG‡wºGtÅ+˜Q¤ãõì0{¥‹àvòPÁ[ôëöèÕµØòËuX¥5dĞc!ÊKÒHACÑ>¢¦YÏ”<ÆB)¾oØcĞÖ–Nµäø¬¬bnp
œæP2wëç:ŠFÊûñø«^“º±Lâ‹+(l÷j;z}æ’À¥BOc9¥]N÷\x))ÒSRWš(ÌŸYÚ± ›æª‡	>p×‹ŸÔ¡Ú