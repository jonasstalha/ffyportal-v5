import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Snackbar,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemText,
  Divider,
  Fab,
  Zoom
} from '@mui/material';
import {
  Search,
  Add,
  Visibility,
  Download,
  Delete,
  PictureAsPdf,
  Image,
  Folder,
  Description,
  LocalShipping,
  Inventory,
  Receipt,
  Agriculture,
  AttachFile,
  CloudUpload,
  GetApp
} from '@mui/icons-material';
import { firestoreService } from '../../lib/firestoreService';
import type { Order, Document, OrderData, DocumentData } from '../../lib/firestoreService';

// Document types configuration
const DOCUMENT_TYPES = {
  INVOICE: { 
    label: 'Invoice', 
    icon: <Receipt color="primary" />,
    retentionYears: 10,
    color: '#1976d2'
  },
  SHIPPING_SLIP: { 
    label: 'Fiche Expédition', 
    icon: <LocalShipping color="secondary" />,
    retentionYears: 3,
    color: '#dc004e'
  },
  PHYTO_CERTIFICATE: { 
    label: 'Phyto Certificate', 
    icon: <Agriculture color="success" />,
    retentionYears: 5,
    color: '#2e7d32'
  },
  BILL_OF_LADING: { 
    label: 'Bill of Lading', 
    icon: <Description color="info" />,
    retentionYears: 3,
    color: '#0288d1'
  },
  CUSTOMS_DECLARATION: { 
    label: 'Customs Declaration', 
    icon: <Inventory color="warning" />,
    retentionYears: 5,
    color: '#ed6c02'
  },
  QUALITY_CERTIFICATE: { 
    label: 'Quality Certificate', 
    icon: <Folder color="success" />,
    retentionYears: 2,
    color: '#2e7d32'
  },
  PACKING_LIST: { 
    label: 'Packing List', 
    icon: <Inventory color="primary" />,
    retentionYears: 2,
    color: '#1976d2'
  },
  CERTIFICATE_OF_ORIGIN: { 
    label: 'Certificate of Origin', 
    icon: <Description color="secondary" />,
    retentionYears: 5,
    color: '#dc004e'
  },
  OTHER: { 
    label: 'Other Document', 
    icon: <AttachFile color="default" />,
    retentionYears: 1,
    color: '#666'
  }
};

// Type for document type key
type DocumentTypeKey = keyof typeof DOCUMENT_TYPES;

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

interface CreateOrderFormData {
  orderNumber: string;
  client: string;
  description: string;
  status: 'active' | 'archived';
}

interface UploadDocumentFormData {
  documentType: DocumentTypeKey;
  reference: string;
  description: string;
}

interface DocumentsState {
  [orderId: string]: Document[];
}

const Archive: React.FC = () => {
  // State management
  const [orders, setOrders] = useState<Order[]>([]);
  const [documents, setDocuments] = useState<DocumentsState>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  
  // Modal states
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState<boolean>(false);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  
  // Upload states
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  
  // Notification state
  const [snackbar, setSnackbar] = useState<SnackbarState>({ 
    open: false, 
    message: '', 
    severity: 'success' 
  });

  // Real-time subscriptions
  useEffect(() => {
    const unsubscribeOrders = firestoreService.subscribeToOrders((ordersData: Order[]) => {
      setOrders(ordersData);
      setLoading(false);
    });

    return () => {
      unsubscribeOrders();
      // Unsubscribe from all document listeners
      Object.values(documents).forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, []);

  // Subscribe to documents when orders change
  useEffect(() => {
    const newDocumentSubscriptions: { [key: string]: () => void } = {};
    
    orders.forEach(order => {
      const unsubscribe = firestoreService.subscribeToOrderDocuments(order.id, (docs: Document[]) => {
        setDocuments(prev => ({
          ...prev,
          [order.id]: docs
        }));
      });
      newDocumentSubscriptions[order.id] = unsubscribe;
    });

    return () => {
      Object.values(newDocumentSubscriptions).forEach(unsubscribe => unsubscribe());
    };
  }, [orders]);

  const showSnackbar = (message: string, severity: SnackbarState['severity'] = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Filter and sort orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchTerm === '' || 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === '' || order.status === statusFilter;
    const matchesClient = clientFilter === '' || order.client === clientFilter;

    return matchesSearch && matchesStatus && matchesClient;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'documentCount':
        return (b.documentCount || 0) - (a.documentCount || 0);
      default:
        return 0;
    }
  });

  // Order management
  const handleCreateOrder = async (orderData: OrderData) => {
    try {
      await firestoreService.createOrder(orderData);
      showSnackbar('Order created successfully!');
      setCreateOrderModalOpen(false);
    } catch (error) {
      showSnackbar(`Error creating order: ${(error as Error).message}`, 'error');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm('Are you sure you want to delete this order and all its documents? This action cannot be undone.')) {
      try {
        await firestoreService.deleteOrder(orderId);
        showSnackbar('Order deleted successfully');
      } catch (error) {
        showSnackbar(`Error deleting order: ${(error as Error).message}`, 'error');
      }
    }
  };

  // Document management
  const handleUploadDocument = async (orderId: string, documentData: DocumentData, file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      await firestoreService.uploadDocument(
        orderId, 
        documentData, 
        file, 
        (progress: number) => setUploadProgress(progress)
      );
      showSnackbar('Document uploaded successfully!');
      setUploadModalOpen(false);
    } catch (error) {
      showSnackbar(`Error uploading document: ${(error as Error).message}`, 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (document: Document) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await firestoreService.deleteDocument(document);
        showSnackbar('Document deleted successfully');
      } catch (error) {
        showSnackbar(`Error deleting document: ${(error as Error).message}`, 'error');
      }
    }
  };

  // Download functions
  const downloadWithFetch = async (fileUrl: string, fileName: string): Promise<boolean> => {
    try {
      const response = await fetch(fileUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Check if blob is valid
      if (blob.size === 0) {
        throw new Error('Empty file received');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      
      return true;
    } catch (error) {
      console.error('Fetch download failed:', error);
      return false;
    }
  };

  const downloadWithAnchor = (fileUrl: string, fileName: string): boolean => {
    try {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.target = '_blank';
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return true;
    } catch (error) {
      console.error('Anchor download failed:', error);
      return false;
    }
  };

  const openInNewTab = (url: string): void => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('New tab open failed:', error);
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      console.log('Starting download:', {
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        fileSize: document.fileSize
      });

      // Method 1: Direct download with fetch (most reliable)
      const success = await downloadWithFetch(document.fileUrl, document.fileName);
      
      if (success) {
        showSnackbar(`✅ Downloaded: ${document.fileName}`, 'success');
        return;
      }

      // Method 2: Try using the download attribute
      const success2 = downloadWithAnchor(document.fileUrl, document.fileName);
      if (success2) {
        showSnackbar(`✅ Downloaded: ${document.fileName}`, 'success');
        return;
      }

      // Method 3: Open in new tab as last resort
      openInNewTab(document.fileUrl);
      showSnackbar('📄 Opening file in new tab', 'info');

    } catch (error) {
      console.error('All download methods failed:', error);
      showSnackbar('❌ Error downloading file. Please try again.', 'error');
    }
  };

  const validateFileUrl = async (fileUrl: string): Promise<{ isValid: boolean; error?: string }> => {
    try {
      // Basic URL validation
      if (!fileUrl) {
        return { isValid: false, error: 'No file URL provided' };
      }

      if (!fileUrl.startsWith('https://')) {
        return { isValid: false, error: 'Invalid URL protocol' };
      }

      // Check if URL is accessible
      const response = await fetch(fileUrl, { method: 'HEAD' });
      
      if (!response.ok) {
        return { 
          isValid: false, 
          error: `File not accessible: ${response.status} ${response.statusText}` 
        };
      }

      // Check content type and size
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      console.log('File validation:', {
        contentType,
        contentLength,
        headers: Object.fromEntries(response.headers.entries())
      });

      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Validation failed: ${(error as Error).message}` 
      };
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get document type info
  const getDocumentTypeInfo = (documentType: string) => {
    return DOCUMENT_TYPES[documentType as DocumentTypeKey] || DOCUMENT_TYPES.OTHER;
  };

  // Order Card Component
  const OrderCard: React.FC<{ order: Order }> = ({ order }) => {
    const orderDocuments = documents[order.id] || [];
    const documentTypeInfo = getDocumentTypeInfo('INVOICE');

    return (
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: 3, overflow: 'visible' }}>
        <CardContent sx={{ p: 0 }}>
          {/* Order Header */}
          <Box 
            sx={{ 
              p: 3, 
              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              color: 'white',
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              position: 'relative'
            }}
          >
            <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'white', color: '#1976d2' }}>
                    {orderDocuments.length > 0 ? orderDocuments.length : '0'}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {order.orderNumber}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      {order.client} • {order.description}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box display="flex" justifyContent={{ xs: 'flex-start', md: 'flex-end' }} gap={1} flexWrap="wrap">
                  <Chip 
                    label={order.status} 
                    color={order.status === 'active' ? 'success' : 'default'}
                    sx={{ color: 'white', backgroundColor: order.status === 'active' ? '#2e7d32' : '#666' }}
                  />
                  <Chip 
                    label={`${orderDocuments.length} documents`}
                    variant="outlined"
                    sx={{ color: 'white', borderColor: 'white' }}
                  />
                  <Typography variant="body2" sx={{ opacity: 0.9, alignSelf: 'center' }}>
                    Created: {new Date(order.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Quick Actions */}
            <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1 }}>
              <Tooltip title="Upload Document">
                <IconButton 
                  size="small" 
                  sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.2)' }}
                  onClick={() => {
                    setSelectedOrder(order);
                    setUploadModalOpen(true);
                  }}
                >
                  <CloudUpload />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Order">
                <IconButton 
                  size="small" 
                  sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.2)' }}
                  onClick={() => handleDeleteOrder(order.id)}
                >
                  <Delete />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Documents List */}
          <Box sx={{ p: 3 }}>
            {orderDocuments.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Description sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  No documents yet
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  Upload the first document for this order
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<CloudUpload />}
                  onClick={() => {
                    setSelectedOrder(order);
                    setUploadModalOpen(true);
                  }}
                >
                  Upload First Document
                </Button>
              </Box>
            ) : (
              <>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Order Documents ({orderDocuments.length})
                </Typography>
                <Grid container spacing={2}>
                  {orderDocuments.map((document) => {
                    const docTypeInfo = getDocumentTypeInfo(document.documentType);
                    return (
                      <Grid item xs={12} key={document.id}>
                        <Paper 
                          sx={{ 
                            p: 2, 
                            borderRadius: 2,
                            border: '2px solid',
                            borderColor: 'grey.200',
                            '&:hover': {
                              backgroundColor: 'grey.50',
                              borderColor: docTypeInfo.color,
                              transform: 'translateY(-2px)',
                              transition: 'all 0.2s ease-in-out'
                            }
                          }}
                        >
                          <Grid container alignItems="center" spacing={2}>
                            <Grid item>
                              <Avatar sx={{ bgcolor: docTypeInfo.color }}>
                                {docTypeInfo.icon}
                              </Avatar>
                            </Grid>
                            <Grid item xs>
                              <Typography variant="body1" fontWeight="600">
                                {docTypeInfo.label}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {document.reference} • {document.fileName}
                              </Typography>
                              <Box display="flex" gap={2} mt={1}>
                                <Typography variant="caption" color="textSecondary">
                                  Size: {formatFileSize(document.fileSize)}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  Uploaded: {new Date(document.uploadedAt).toLocaleDateString()}
                                </Typography>
                                <Chip 
                                  label={`${docTypeInfo.retentionYears} years retention`}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                            </Grid>
                            <Grid item>
                              <Box display="flex" gap={1}>
                                <Tooltip title="Preview">
                                  <IconButton 
                                    size="small" 
                                    color="primary"
                                    onClick={() => {
                                      setSelectedDocument(document);
                                      setPreviewModalOpen(true);
                                    }}
                                  >
                                    <Visibility />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Download">
                                  <IconButton 
                                    size="small" 
                                    color="secondary"
                                    onClick={() => handleDownload(document)}
                                  >
                                    <Download />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton 
                                    size="small" 
                                    color="error"
                                    onClick={() => handleDeleteDocument(document)}
                                  >
                                    <Delete />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Grid>
                          </Grid>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  // Create Order Modal
  const CreateOrderModal: React.FC<{
    open: boolean;
    onClose: () => void;
    onSubmit: (data: OrderData) => void;
  }> = ({ open, onClose, onSubmit }) => {
    const [formData, setFormData] = useState<CreateOrderFormData>({
      orderNumber: '',
      client: '',
      description: '',
      status: 'active'
    });
    const [loading, setLoading] = useState<boolean>(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        await onSubmit(formData);
        setFormData({ orderNumber: '', client: '', description: '', status: 'active' });
      } catch (error) {
        // Error handled in parent
      } finally {
        setLoading(false);
      }
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Order</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Order Number"
                  value={formData.orderNumber}
                  onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                  required
                  placeholder="e.g., ORD-2024-001"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Client"
                  value={formData.client}
                  onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                  required
                  placeholder="e.g., Global Fruits Import"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  multiline
                  rows={3}
                  placeholder="Order description or notes..."
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'archived' })}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="archived">Archived</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    );
  };

  // Upload Document Modal
  const UploadDocumentModal: React.FC<{
    open: boolean;
    onClose: () => void;
    order: Order | null;
    onSubmit: (orderId: string, documentData: DocumentData, file: File) => void;
  }> = ({ open, onClose, order, onSubmit }) => {
    const [formData, setFormData] = useState<UploadDocumentFormData>({
      documentType: 'INVOICE',
      reference: '',
      description: ''
    });
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState<boolean>(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file || !order) return;

      const documentData: DocumentData = {
        documentType: formData.documentType,
        reference: formData.reference || `${formData.documentType}-${order.orderNumber}`,
        description: formData.description,
        type: DOCUMENT_TYPES[formData.documentType].label
      };

      await onSubmit(order.id, documentData, file);
      
      // Reset form
      setFormData({ documentType: 'INVOICE', reference: '', description: '' });
      setFile(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    };

    const handleDragLeave = () => {
      setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        setFile(droppedFile);
      }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        // Validate file size (150MB)
        if (selectedFile.size > 150 * 1024 * 1024) {
          showSnackbar('File size must be less than 150MB', 'error');
          return;
        }
        setFile(selectedFile);
      }
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Upload Document to {order?.orderNumber}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Document Type</InputLabel>
                  <Select
                    value={formData.documentType}
                    label="Document Type"
                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value as DocumentTypeKey })}
                  >
                    {Object.entries(DOCUMENT_TYPES).map(([key, value]) => (
                      <MenuItem key={key} value={key}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {value.icon}
                          {value.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Reference Number"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  sx={{ mb: 2 }}
                  placeholder="Auto-generated if empty"
                />

                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  multiline
                  rows={3}
                  placeholder="Document description or notes..."
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper
                  sx={{
                    p: 4,
                    border: '2px dashed',
                    borderColor: dragOver ? 'primary.main' : 'grey.300',
                    backgroundColor: dragOver ? 'primary.light' : 'grey.50',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    hidden
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  />
                  
                  {file ? (
                    <Box>
                      <Description sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        {file.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Size: {formatFileSize(file.size)}
                      </Typography>
                      <Button 
                        variant="outlined" 
                        sx={{ mt: 2 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                      >
                        Change File
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Drop file here or click to browse
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Supports PDF, Images, Word, Excel (Max 150MB)
                      </Typography>
                    </Box>
                  )}
                </Paper>

                {isUploading && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Uploading: {Math.round(uploadProgress)}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={uploadProgress} 
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={!file || isUploading}
              startIcon={isUploading ? <CircularProgress size={20} /> : <CloudUpload />}
            >
              {isUploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    );
  };

  // Preview Modal
  const PreviewModal: React.FC<{
    open: boolean;
    onClose: () => void;
    document: Document | null;
  }> = ({ open, onClose, document }) => {
    if (!document) return null;

    const docTypeInfo = getDocumentTypeInfo(document.documentType);

    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: docTypeInfo.color }}>
              {docTypeInfo.icon}
            </Avatar>
            <Box>
              <Typography variant="h6">{document.reference}</Typography>
              <Typography variant="body2" color="textSecondary">
                {docTypeInfo.label}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, textAlign: 'center', minHeight: 400, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Document Preview
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  height: 300,
                  backgroundColor: 'grey.100',
                  borderRadius: 2,
                  border: '2px dashed',
                  borderColor: 'grey.300'
                }}>
                  {document.mimeType?.includes('pdf') ? (
                    <PictureAsPdf sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                  ) : document.mimeType?.includes('image') ? (
                    <Image sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  ) : (
                    <Description sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  )}
                  <Typography variant="body1" color="textSecondary" gutterBottom>
                    {document.fileName}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {formatFileSize(document.fileSize)}
                  </Typography>
                </Box>
                <Button 
                  variant="contained" 
                  startIcon={<GetApp />}
                  onClick={() => handleDownload(document)}
                  sx={{ mt: 2 }}
                >
                  Download File
                </Button>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom color="primary">
                Document Details
              </Typography>
              <List>
                <ListItem>
                  <ListItemText 
                    primary="Reference" 
                    secondary={document.reference} 
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText 
                    primary="Type" 
                    secondary={docTypeInfo.label} 
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText 
                    primary="File Name" 
                    secondary={document.fileName} 
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText 
                    primary="File Size" 
                    secondary={formatFileSize(document.fileSize)} 
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText 
                    primary="Upload Date" 
                    secondary={new Date(document.uploadedAt).toLocaleString()} 
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText 
                    primary="Retention Period" 
                    secondary={`${docTypeInfo.retentionYears} years`} 
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText 
                    primary="Description" 
                    secondary={document.description || 'No description'} 
                  />
                </ListItem>
              </List>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
          <Button 
            variant="contained" 
            startIcon={<GetApp />}
            onClick={() => handleDownload(document)}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom fontWeight="bold" color="primary">
          Logistics Archive
        </Typography>
        <Typography variant="h6" color="textSecondary">
          Manage orders and documents with real-time Firebase integration
        </Typography>
      </Box>

      {/* Statistics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p: 2 }}>
            <Typography variant="h4" fontWeight="bold" color="primary">
              {orders.length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Total Orders
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p: 2 }}>
            <Typography variant="h4" fontWeight="bold" color="secondary">
              {Object.values(documents).flat().length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Total Documents
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p: 2 }}>
            <Typography variant="h4" fontWeight="bold" color="success.main">
              {orders.filter(o => o.status === 'active').length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Active Orders
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p: 2 }}>
            <Typography variant="h4" fontWeight="bold" color="warning.main">
              {orders.filter(o => o.status === 'archived').length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Archived Orders
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Controls */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search orders, clients, or documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="newest">Newest First</MenuItem>
                <MenuItem value="oldest">Oldest First</MenuItem>
                <MenuItem value="documentCount">Document Count</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Client</InputLabel>
              <Select
                value={clientFilter}
                label="Client"
                onChange={(e) => setClientFilter(e.target.value)}
              >
                <MenuItem value="">All Clients</MenuItem>
                {Array.from(new Set(orders.map(order => order.client))).map(client => (
                  <MenuItem key={client} value={client}>{client}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateOrderModalOpen(true)}
              fullWidth
              sx={{ height: '56px' }}
            >
              New Order
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Folder sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography variant="h5" gutterBottom color="textSecondary">
            No orders found
          </Typography>
          <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
            {searchTerm || statusFilter || clientFilter 
              ? 'Try adjusting your filters' 
              : 'Create your first order to get started'
            }
          </Typography>
          {!searchTerm && !statusFilter && !clientFilter && (
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => setCreateOrderModalOpen(true)}
            >
              Create First Order
            </Button>
          )}
        </Box>
      ) : (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
          </Typography>
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </Box>
      )}

      {/* Floating Action Button */}
      <Zoom in={true}>
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
          }}
          onClick={() => setCreateOrderModalOpen(true)}
        >
          <Add />
        </Fab>
      </Zoom>

      {/* Modals */}
      <CreateOrderModal
        open={createOrderModalOpen}
        onClose={() => setCreateOrderModalOpen(false)}
        onSubmit={handleCreateOrder}
      />
      
      <UploadDocumentModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        order={selectedOrder}
        onSubmit={handleUploadDocument}
      />
      
      <PreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        document={selectedDocument}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Archive;