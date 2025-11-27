import React from 'react';
import { Trash2, Download, File, Image, FileText, Archive } from 'lucide-react';

interface FileData {
  id: string;
  name: string;
  size: number;
  type: string;
  downloadURL: string;
  uploadedAt: any;
}

interface FileItemProps {
  file: FileData;
  onDelete: (fileId: string) => void;
  deleting: boolean;
}

export function FileItem({ file, onDelete, deleting }: FileItemProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (type?: string) => {
    if (!type) return File;
    if (type.startsWith('image/')) return Image;
    if (type.includes('pdf')) return FileText;
    if (type.includes('document') || type.includes('word')) return FileText;
    if (type.includes('zip') || type.includes('rar')) return Archive;
    return File;
  };

  const FileIcon = getFileIcon(file.type);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = file.downloadURL;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
            <FileIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-slate-900 truncate">{file.name}</h3>
            <div className="flex items-center space-x-2 text-sm text-slate-500 mt-1">
              <span>{formatFileSize(file.size)}</span>
              <span>•</span>
              <span>{formatDate(file.uploadedAt)}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={handleDownload}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Download file"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(file.id)}
            disabled={deleting}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="Delete file"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}