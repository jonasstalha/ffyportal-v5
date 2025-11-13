import React from 'react';
import { Package, Calendar, FileText } from 'lucide-react';

interface Box {
  id: string;
  title: string;
  description: string;
  createdAt: any;
}

interface BoxCardProps {
  box: Box;
  onClick: () => void;
  onDelete: (id: string) => Promise<void>;
}

export function BoxCard({ box, onClick, onDelete }: BoxCardProps) {
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition-colors">
          <Package className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-xs text-slate-500">
            <Calendar className="h-3 w-3 mr-1" />
            {formatDate(box.createdAt)}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Are you sure you want to delete this box?')) {
                onDelete(box.id);
              }
            }}
            className="text-red-500 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
        {box.title}
      </h3>

      {box.description && (
        <div className="flex items-start space-x-2 text-sm text-slate-600">
          <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p className="line-clamp-2">{box.description}</p>
        </div>
      )}
    </div>
  );
}