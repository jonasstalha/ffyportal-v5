import React from 'react';
import { LogOut, Archive, Bell, Loader2, CheckCircle, Eye } from 'lucide-react';
import { useLocation } from 'wouter';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { NotificationProvider, useNotification } from '../../../context/NotificationContext';

interface LayoutProps {
  children: React.ReactNode;
}

function NotificationBell() {
  const { unpaidDueSoon, loading, refreshNotifications } = useNotification();
  const [open, setOpen] = React.useState(false);
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);
  const [fileInputBoxId, setFileInputBoxId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  // Animate bell icon when new notifications arrive
  const bellRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (unpaidDueSoon.length > 0 && bellRef.current) {
      bellRef.current.classList.add('animate-shake');
      setTimeout(() => bellRef.current?.classList.remove('animate-shake'), 800);
    }
  }, [unpaidDueSoon.length]);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.notification-dropdown')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Facture upload and mark as paid
  const handleMarkAsPaid = (boxId: string) => {
    setFileInputBoxId(boxId);
    setTimeout(() => fileInputRef.current?.click(), 100); // open file dialog
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fileInputBoxId) return;
    setUploadingId(fileInputBoxId);
    try {
      // Upload facture to Firebase Storage
      const factureRef = ref(storage, `factures/${fileInputBoxId}/${file.name}`);
      await uploadBytes(factureRef, file);
      const url = await getDownloadURL(factureRef);
      // TODO: Implement markBoxAsPaidWithFacture logic
      // await markBoxAsPaidWithFacture(fileInputBoxId, url, file.name);
      refreshNotifications();
      alert('Invoice marked as paid and file uploaded successfully!');
    } catch (e) {
      alert('Failed to mark as paid or upload file. Please try again.');
    }
    setUploadingId(null);
    setFileInputBoxId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        ref={bellRef}
        className="relative p-2 rounded-full hover:bg-blue-50 focus:outline-none transition-transform duration-200"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        <Bell className={`h-6 w-6 text-blue-600 ${unpaidDueSoon.length > 0 ? 'animate-pulse' : ''}`} />
        {unpaidDueSoon.length > 0 && (
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white bg-red-500 animate-ping"></span>
        )}
      </button>
      {open && (
        <div className="notification-dropdown absolute right-0 mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-4 animate-fade-in">
          <div className="font-semibold mb-2 text-slate-800 flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-500" /> Unpaid invoices due soon
            <button onClick={refreshNotifications} className="ml-auto text-xs text-blue-500 hover:underline">Refresh</button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : unpaidDueSoon.length === 0 ? (
            <div className="text-center text-slate-500 py-6">No unpaid invoices due soon!</div>
          ) : (
            <ul className="space-y-3 max-h-72 overflow-y-auto">
              {unpaidDueSoon.map((box) => (
                <li key={box.id} className="bg-blue-50 rounded-lg p-3 flex flex-col gap-1 animate-slide-in">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-900">{box.title}</span>
                    {box.client && <span className="italic text-xs text-blue-700">for {box.client}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-700">
                    {box.dueDate && <span>Due: <span className="font-mono text-red-600">{box.dueDate}</span></span>}
                    {box.amount && <span>Amount: <span className="font-mono">${box.amount}</span></span>}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition disabled:opacity-50"
                      onClick={() => handleMarkAsPaid(box.id)}
                      disabled={uploadingId === box.id}
                    >
                      {uploadingId === box.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Mark as Paid
                    </button>
                    <button
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                      onClick={() => navigate(`/box/${box.id}`)}
                    >
                      <Eye className="h-4 w-4" /> View
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <style>{`
        @keyframes shake { 0% { transform: rotate(-10deg); } 20% { transform: rotate(10deg); } 40% { transform: rotate(-8deg); } 60% { transform: rotate(8deg); } 80% { transform: rotate(-4deg); } 100% { transform: rotate(0deg); } }
        .animate-shake { animation: shake 0.8s; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(-10px);} to { opacity: 1; transform: none; } }
        .animate-fade-in { animation: fade-in 0.3s; }
        @keyframes slide-in { from { opacity: 0; transform: translateX(30px);} to { opacity: 1; transform: none; } }
        .animate-slide-in { animation: slide-in 0.4s; }
      `}</style>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  // TODO: Implement logout and currentUser logic if needed
  // const handleLogout = async () => { ... }
  // const currentUser = ...
  return (
    <NotificationProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <header className="bg-white shadow-sm border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Archive className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">DocBox</h1>
              </div>
              <div className="flex items-center space-x-4">
                <NotificationBell />
                {/* <span className="text-sm text-slate-600">{currentUser?.email}</span> */}
                {/* <button onClick={handleLogout} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button> */}
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </NotificationProvider>
  );
}