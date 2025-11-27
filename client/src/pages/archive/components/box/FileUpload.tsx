import React, { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { storage, db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Upload, X, File, AlertCircle, Package } from 'lucide-react';

interface FileUploadProps {
  boxId: string;
  onUploadComplete: () => void;
}

interface FileWithPath {
  file: File;
  path: string;
}

declare global {
  interface HTMLInputElement {
    webkitdirectory: boolean;
  }
}

export function FileUpload({ boxId, onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const { currentUser } = useAuth();

  const handleFile = async (file: File) => {
    if (!currentUser) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    // Check if file already exists
    const fileExists = await checkFileExists(file.name);
    if (fileExists) {
      setError('A file with this name already exists. Please rename your file and try again.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      // Create a reference to the file in Firebase Storage
      const storageRef = ref(storage, `users/${currentUser.uid}/boxes/${boxId}/files/${file.name}`);
      
      // Start the upload
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          setError('Failed to upload file');
          setUploading(false);
        },
        async () => {
          // Upload completed successfully
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Save file metadata to Firestore
            const filesRef = collection(db, 'users', currentUser.uid, 'boxes', boxId, 'files');
            await addDoc(filesRef, {
              name: file.name,
              size: file.size,
              type: file.type,
              downloadURL,
              uploadedAt: serverTimestamp()
            });

            setUploading(false);
            setUploadProgress(0);
            onUploadComplete();
          } catch (error) {
            console.error('Error saving file metadata:', error);
            setError('Failed to save file information');
            setUploading(false);
          }
        }
      );
    } catch (error) {
      console.error('Error starting upload:', error);
      setError('Failed to start upload');
      setUploading(false);
    }
  };

  const checkFileExists = async (fileName: string) => {
    if (!currentUser) return false;
    
    try {
      const filesRef = collection(db, 'users', currentUser.uid, 'boxes', boxId, 'files');
      const q = query(filesRef, where('name', '==', fileName));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  };

  const processFileEntry = async (entry: FileSystemEntry): Promise<FileWithPath[]> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => {
        (entry as FileSystemFileEntry).file(resolve);
      });
      return [{
        file,
        path: entry.fullPath.substring(1) // Remove leading slash
      }];
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve) => {
        dirReader.readEntries(resolve);
      });
      
      const filePromises = entries.map(entry => processFileEntry(entry));
      const fileArrays = await Promise.all(filePromises);
      return fileArrays.flat();
    }
    return [];
  };

  const handleFolderUpload = async (items: DataTransferItemList | null) => {
    if (!items) return;
    setError('');
    
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          entries.push(entry);
        }
      }
    }

    try {
      const filePromises = entries.map(entry => processFileEntry(entry));
      const fileArrays = await Promise.all(filePromises);
      const files = fileArrays.flat();

      if (files.length === 0) {
        setError('No files found in the selected folders');
        return;
      }

      setUploading(true);
      let completedUploads = 0;

      for (const { file, path } of files) {
        const storageRef = ref(storage, `users/${currentUser?.uid}/boxes/${boxId}/files/${path}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const totalProgress = ((completedUploads + (snapshot.bytesTransferred / snapshot.totalBytes)) / files.length) * 100;
              setUploadProgress(totalProgress);
            },
            (error) => {
              console.error(`Error uploading ${path}:`, error);
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const filesRef = collection(db, 'users', currentUser?.uid || '', 'boxes', boxId, 'files');
                await addDoc(filesRef, {
                  name: file.name,
                  path: path,
                  size: file.size,
                  type: file.type,
                  downloadURL,
                  uploadedAt: serverTimestamp(),
                  isInFolder: path.includes('/')
                });
                completedUploads++;
                resolve();
              } catch (error) {
                console.error(`Error saving metadata for ${path}:`, error);
                reject(error);
              }
            }
          );
        });
      }

      setUploading(false);
      setUploadProgress(0);
      onUploadComplete();
    } catch (error) {
      console.error('Error processing folders:', error);
      setError('Failed to process some files or folders');
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError('');

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      // Handle folder upload
      await handleFolderUpload(items);
    } else if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Handle file upload
      for (const file of Array.from(e.dataTransfer.files)) {
        await handleFile(file);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {uploading ? (
        <div className="space-y-3">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-slate-600 text-center">
            Uploading... {Math.round(uploadProgress)}%
          </p>
        </div>
      ) : (
        <div
          onDragOver={handleDrag}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`relative ${dragActive ? 'bg-blue-50' : 'bg-white'}`}
        >
          <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg transition-colors duration-200">
            <div className="space-y-4 text-center">
              <Upload className="mx-auto h-12 w-12 text-slate-400" />
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer inline-flex items-center justify-center rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 px-4 py-2 border border-blue-600 hover:bg-blue-50"
                  >
                    <File className="h-4 w-4 mr-2" />
                    <span>Upload Files</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          Array.from(e.target.files).forEach(handleFile);
                        }
                      }}
                    />
                  </label>
                  <label
                    htmlFor="folder-upload"
                    className="relative cursor-pointer inline-flex items-center justify-center rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500 px-4 py-2 border border-green-600 hover:bg-green-50"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    <span>Upload Folders</span>
                    <input
                      id="folder-upload"
                      name="folder-upload"
                      type="file"
                      className="sr-only"
                      webkitdirectory="true"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          const dataTransfer = new DataTransfer();
                          Array.from(e.target.files).forEach(file => dataTransfer.items.add(file));
                          handleFolderUpload(dataTransfer.items);
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm text-slate-600">or drag and drop files and folders here</p>
                  <p className="text-xs text-slate-500">Up to 10MB per file</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}