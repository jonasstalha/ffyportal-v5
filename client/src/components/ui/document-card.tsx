import React from 'react';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent } from './card';
import { Calendar, ExternalLink, Tag } from 'lucide-react';

interface DocumentCardProps {
  item: {
    id: string;
    name: string;
    type: string;
    date: string;
    status: 'pending' | 'validated' | 'rejected';
    fileUrl?: string;
    category?: string;
    amount?: number;
    validationDate?: string;
  };
  isSelected: boolean;
  viewMode: 'grid' | 'list';
  onSelect: () => void;
  icon: React.ReactNode;
}

const DocumentCard: React.FC<DocumentCardProps> = ({ item, isSelected, viewMode, onSelect, icon }) => {
  return (
    <Card
      className={`group hover:shadow-lg transition-all ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${viewMode === 'list' ? 'flex items-center justify-between p-4' : ''}`}
      onClick={onSelect}
    >
      <div className={viewMode === 'list' ? 'flex items-center flex-1' : 'p-4'}>
        <div className="flex items-center">
          <div className="h-10 w-10 flex items-center justify-center mr-3">
            {icon}
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

        {viewMode === 'list' ? (
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
        ) : (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              {item.category && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium">{item.category}</span>
                </div>
              )}
              <Badge variant={
                item.status === 'validated' ? 'success' :
                item.status === 'rejected' ? 'destructive' : 'default'
              }>
                {item.status === 'validated' ? 'Validé' :
                 item.status === 'rejected' ? 'Rejeté' : 'En attente'}
              </Badge>
            </div>
            
            {item.amount && (
              <div className="mt-2 text-sm text-gray-600">
                <span className="font-medium">{item.amount.toFixed(2)} €</span>
              </div>
            )}
            
            {item.validationDate && (
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <Calendar className="h-3 w-3 mr-1" />
                <span>Date limite: {item.validationDate}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default DocumentCard;