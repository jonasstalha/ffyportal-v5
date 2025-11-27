import React, { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useLocation, Link } from 'wouter';
import { doc, getDoc, collection, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Layout } from '../components/Layout';
import { FileUpload } from '../components/box/FileUpload';
import { FileItem } from '../components/box/FileItem';
import { ArrowLeft, Package, Upload, Folder } from 'lucide-react';

interface Box {
  title: string;
  description: string;
  createdAt: any;
  paymentFacture?: {
    paidAt?: any;
    paidBy?: string;
    factureUrl?: string;
    factureName?: string;
  };
}

interface FileData {
  id: string;
  name: string;
  size: number;
  type: string;
  downloadURL: string;
  uploadedAt: any;
}

export function BoxDetail() {
  const { boxId } = useParams<{ boxId: string }>();
  const [, setLocation] = useLocation();
  const [box, setBox] = useState<Box | null>(null);
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!boxId) {
      console.log('No boxId found in params');
      return;
    }
    setLoading(true);
    const fetchData = async () => {
      try {
        console.log('Fetching box with id:', boxId);
        // Load box data
        const boxRef = doc(db, 'boxes', boxId);
        const boxSnap = await getDoc(boxRef);
        if (boxSnap.exists()) {
          const boxData = boxSnap.data() as Box;
          setBox(boxData);
          console.log('Box found:', boxData);
          // Load files
          const filesRef = collection(db, 'boxes', boxId, 'files');
          const q = query(filesRef, orderBy('uploadedAt', 'desc'));
          const snapshot = await getDocs(q);
          const filesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as FileData[];
          setFiles(filesData);
          console.log('Files loaded:', filesData);
        } else {
          setBox(null);
          setFiles([]);
          console.log('Box not found for id:', boxId);
        }
      } catch (error) {
        console.error('Error loading box or files:', error);
        setBox(null);
        setFiles([]);
      } finally {
        setLoading(false);
        console.log('Loading set to false');
      }
    };
    fetchData();
  }, [boxId, setLocation]);

  // Helper to reload files only (for upload/delete)
  const reloadFiles = async () => {
    if (!boxId) return;
    try {
      const filesRef = collection(db, 'boxes', boxId, 'files');
      const q = query(filesRef, orderBy('uploadedAt', 'desc'));
      const snapshot = await getDocs(q);
      const filesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FileData[];
      setFiles(filesData);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!boxId) return;
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    setDeleting(fileId);
    try {
      await deleteDoc(doc(db, 'boxes', boxId, 'files', fileId));
      const storageRef = ref(storage, `boxes/${boxId}/files/${file.name}`);
      await deleteObject(storageRef);
      setFiles(files.filter(f => f.id !== fileId));
    } catch (error) {
      console.error('Error deleting file:', error);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!box) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="bg-slate-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
            <Package className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Box not found</h3>
          <p className="text-slate-600 mb-6">The box you're looking for doesn't exist.</p>
          <a
            href="#"
            onClick={e => { e.preventDefault(); setLocation('/dashboard'); }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <a
            href="#"
            onClick={e => { e.preventDefault(); setLocation('/dashboard'); }}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{box.title}</h1>
              {box.description && (
                <p className="text-slate-600">{box.description}</p>
              )}
              <p className="text-sm text-slate-500">Created {formatDate(box.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          {/* Show payment facture if exists */}
          {box.paymentFacture && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200 flex items-center gap-4">
              <div>
                <span className="font-semibold text-green-800">Payment Proof:</span>{' '}
                <a
                  href={box.paymentFacture.factureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline"
                >
                  {box.paymentFacture.factureName || 'Download'}
                </a>
                {box.paymentFacture.paidAt && (
                  <span className="ml-4 text-xs text-green-700">
                    Paid on: {box.paymentFacture.paidAt.toDate ? box.paymentFacture.paidAt.toDate().toLocaleDateString() : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Files</h2>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </button>
          </div>

          {showUpload && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <FileUpload
                boxId={boxId!}
                onUploadComplete={() => {
                  reloadFiles();
                  setShowUpload(false);
                }}
              />
            </div>
          )}

          {files.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-slate-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                <Folder className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No files yet</h3>
              <p className="text-slate-600 mb-6">Upload your first file to get started</p>
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <FileItem
                  key={file.id}
                  file={file}
                  onDelete={deleteFile}
                  deleting={deleting === file.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}