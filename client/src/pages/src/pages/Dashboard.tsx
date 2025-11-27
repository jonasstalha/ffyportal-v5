import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Layout } from '../components/Layout';
import { CreateBoxModal } from '../components/dashboard/CreateBoxModal';
import { BoxCard } from '../components/dashboard/BoxCard';
import { Plus, Search, Package } from 'lucide-react';

interface Box {
  id: string;
  title: string;
  description: string;
  createdAt: any;
  client?: string;
  dueDate?: string;
  amount?: number;
  status?: string;
  paymentStatus?: string;
}

// Helper to check if dueDate is within next 2 months
function isDueWithin2Months(dueDate: string | undefined) {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const now = new Date();
  const twoMonthsLater = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());
  return due >= now && due <= twoMonthsLater;
}

export function Dashboard() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [location, navigate] = useLocation();
  
  useEffect(() => {
    loadBoxes();
  }, []);

  const loadBoxes = async () => {
    try {
      const boxesRef = collection(db, 'boxes');
      const q = query(boxesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const boxesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Box[];
      setBoxes(boxesData);
    } catch (error) {
      console.error('Error loading boxes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBox = async ({
    title,
    description,
    boxType,
    paymentStatus,
    expiryDate,
    dueDate,
    amount,
    client,
    status
  }: {
    title: string;
    description: string;
    boxType: string;
    paymentStatus: string;
    expiryDate?: string;
    dueDate?: string;
    amount?: number;
    client?: string;
    status?: string;
  }) => {
    setCreating(true);
    try {
      const boxesRef = collection(db, 'boxes');
      await addDoc(boxesRef, {
        title,
        description: description ?? "",
        boxType,
        paymentStatus,
        ...(expiryDate ? { expiryDate } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(client ? { client } : {}),
        ...(status ? { status } : {}),
        createdAt: serverTimestamp()
      });
      setCreateModalOpen(false);
      loadBoxes();
    } catch (error) {
      console.error('Error creating box:', error);
    } finally {
      setCreating(false);
    }
  };

  const deleteBox = async (boxId: string) => {
    try {
      const boxRef = doc(db, 'boxes', boxId);
      await deleteDoc(boxRef);
      setBoxes(prevBoxes => prevBoxes.filter(box => box.id !== boxId));
    } catch (error) {
      console.error('Error deleting box:', error);
      alert('Failed to delete the box. Please try again.');
    }
  };

  const deleteAllBoxes = async () => {
    if (!window.confirm('Are you sure you want to delete ALL boxes? This cannot be undone.')) return;
    try {
      setLoading(true);
      const boxesRef = collection(db, 'boxes');
      const snapshot = await getDocs(boxesRef);
      const batchDeletes = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'boxes', docSnap.id)));
      await Promise.all(batchDeletes);
      setBoxes([]);
    } catch (error) {
      console.error('Error deleting all boxes:', error);
      alert('Failed to delete all boxes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredBoxes = boxes.filter(box =>
    (box.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (box.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unpaidDueSoon = boxes.filter(
    (box: any) =>
      (box.status === 'unpaid' || box.paymentStatus === 'pending') &&
      isDueWithin2Months(box.dueDate)
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Notification for unpaid invoices due soon */}
        {unpaidDueSoon.length > 0 && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded-lg mb-4">
            <div className="font-semibold mb-1">Unpaid invoices due within 2 months:</div>
            <ul className="list-disc pl-5">
              {unpaidDueSoon.map((box) => (
                <li key={box.id}>
                  <span className="font-medium">{box.title}</span>
                  {box.client && <> for <span className="italic">{box.client}</span></>}
                  {box.dueDate && <> — Due: <span className="font-mono">{box.dueDate}</span></>}
                  {box.amount && <> — Amount: <span className="font-mono">${box.amount}</span></>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Document Boxes</h1>
            <p className="text-slate-600">Organize and manage documents efficiently</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={deleteAllBoxes}
              disabled={boxes.length === 0}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Delete All
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Box
            </button>
          </div>
        </div>

        {boxes.length > 0 && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search boxes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {filteredBoxes.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-slate-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
              <Package className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {boxes.length === 0 ? 'No boxes yet' : 'No boxes found'}
            </h3>
            <p className="text-slate-600 mb-6">
              {boxes.length === 0 
                ? 'Create your first document box to get started'
                : 'Try adjusting your search terms'
              }
            </p>
            {boxes.length === 0 && (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Box
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBoxes.map((box) => (
              <BoxCard
                key={box.id}
                box={box}
                onClick={() => navigate(`/box/${box.id}`)}
                onDelete={() => deleteBox(box.id)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateBoxModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={createBox}
        loading={creating}
      />
    </Layout>
  );
}