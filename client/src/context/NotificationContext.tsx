import React, { createContext, useContext, useState, useCallback } from 'react';

interface Box {
  id: string;
  title: string;
  client?: string;
  dueDate?: string;
  amount?: number;
  status?: string;
  paymentStatus?: string;
}

interface NotificationContextType {
  unpaidDueSoon: Box[];
  loading: boolean;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unpaidDueSoon, setUnpaidDueSoon] = useState<Box[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual fetch logic for unpaidDueSoon
      setUnpaidDueSoon([]); // Example: set to empty or fetch from Firestore
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider value={{ unpaidDueSoon, loading, refreshNotifications: fetchNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within a NotificationProvider');
  return ctx;
}
