// Placeholder for archive types
export interface ArchiveItem {
  id: string;
  name: string;
  date: string;
  type: string;
  fileUrl?: string;
}

// Updated ArchiveBox type to include the title property
export interface ArchiveBox {
  id: string;
  title: string;
  items: ArchiveItem[];
  color: string;
  icon: string;
}

export interface Notification {
  type: 'success' | 'error' | 'warning';
  message: string;
}
