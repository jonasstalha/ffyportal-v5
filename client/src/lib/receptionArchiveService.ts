import { firestore } from './firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

export interface ReceptionArchive {
  id: string;
  lotNumber: string;
  data: any; // ReceptionFormData shape
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION = 'reception_archives';

export const receptionArchiveService = {
  subscribe(cb: (items: ReceptionArchive[]) => void, onError?: (e: Error) => void) {
    const q = query(collection(firestore, COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: ReceptionArchive[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
        cb(items);
      },
      (err) => {
        console.error('reception_archives subscribe error:', err);
        if (onError) onError(err as unknown as Error);
      }
    );
  },

  async add(item: Omit<ReceptionArchive, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = await addDoc(collection(firestore, COLLECTION), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, updates: Partial<ReceptionArchive>): Promise<void> {
    await updateDoc(doc(firestore, COLLECTION, id), {
      ...updates,
      updatedAt: serverTimestamp(),
    } as any);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(firestore, COLLECTION, id));
  },
  
};
