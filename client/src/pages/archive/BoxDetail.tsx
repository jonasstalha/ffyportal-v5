import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { doc, getDoc, collection, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { firestore as db, storage, auth } from '@/lib/firebase';
import { Layout } from '@/components/layout/main-layout';
import { FileUpload } from './components/box/FileUpload';
import { FileItem } from './components/box/FileItem';
import { ArrowLeft, Package, Upload, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface BoxDetailProps {
  boxId: string;
}

interface Box {
  title: string;
  description: string;
  createdAt: any;
}

interface FileData {
  id: string;
  name: string;
  url: string;
  createdAt: any;
  size: number;
  type: string;
}

const BoxDetail: React.FC<BoxDetailProps> = ({ boxId }) => {
  const [, setLocation] = useLocation();
  const [box, setBox] = useState<Box | null>(null);
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBoxAndFiles();
  }, [boxId]);

  const loadBoxAndFiles = async () => {
    try {
      setLoading(true);
      const boxDoc = await getDoc(doc(db, 'archive-boxes', boxId));
      
      if (!boxDoc.exists()) {
        setError('Box not found');
        return;
      }

      setBox(boxDoc.data() as Box);

      const filesQuery = query(
        collection(db, 'archive-boxes', boxId, 'files'),
        orderBy('createdAt', 'desc')
      );
      
      const filesSnapshot = await getDocs(filesQuery);
      const loadedFiles = filesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FileData[];
      
      setFiles(loadedFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load box');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string, fileUrl: string) => {
    try {
      // Delete from Storage
      const storageRef = ref(storage, fileUrl);
      await deleteObject(storageRef);

      // Delete from Firestore
      await deleteDoc(doc(db, 'archive-boxes', boxId, 'files', fileId));

      // Update local state
      setFiles(files.filter(f => f.id !== fileId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div>
        <Button className="mt-4" onClick={() => setLocation('/archive')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Archives
        </Button>
      </div>
    );
  }

  if (!box) {
    return (
      <div className="p-4">
        <div className="bg-yellow-100 text-yellow-700 p-4 rounded-lg">Box not found</div>
        <Button className="mt-4" onClick={() => setLocation('/archive')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Archives
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Button variant="outline" onClick={() => setLocation('/archive')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Archives
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center mb-4">
          <Package className="h-6 w-6 text-blue-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{box.title}</h1>
            {box.description && (
              <p className="text-gray-500 mt-1">{box.description}</p>
            )}
          </div>
        </div>

        <FileUpload boxId={boxId} onFileUploaded={loadBoxAndFiles} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map(file => (
          <FileItem
            key={file.id}
            file={file}
            onDelete={() => handleDelete(file.id, file.url)}
          />
        ))}
      </div>

      {files.length === 0 && (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center">
            <Folder className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No files yet</h3>
            <p className="text-gray-500">Upload files to get started</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default BoxDetail;