import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface EmballageRow {
  dateConditionnement: string;
  produit: string;
  typeEmballage: string;
  numeroLot: string;
  quantite: string;
  fournisseur: string;
}

export interface EmballageFormData {
  header: {
    code: string;
    version: string;
    date: string;
    responsableEmballage: string;
    responsableQualite: string;
  };
  rows: EmballageRow[];
}

export interface EmballageLotDoc {
  id: string;
  lotNumber: string;
  status: 'brouillon' | 'en_cours' | 'termine';
  emballageData: EmballageFormData;
  archived: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  archivedAt?: string; // ISO
  createdBy?: string;
}

const COLLECTION = 'packaging_traces';

export const waitForAuth = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(true);
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(!!user);
    });
  });
};

const tsToIso = (v: any): string => {
  if (!v) return new Date().toISOString();
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return typeof v === 'string' ? v : new Date(v).toISOString();
};

export const saveEmballageLot = async (
  lot: Omit<EmballageLotDoc, 'id' | 'createdAt' | 'updatedAt' | 'archived'> & { id?: string }
): Promise<string> => {
  const isAuth = await waitForAuth();
  if (!isAuth) throw new Error('Utilisateur non authentifié');

  const now = serverTimestamp();
  const payload = {
    lotNumber: lot.lotNumber,
    status: lot.status || 'brouillon',
    emballageData: lot.emballageData,
    updatedAt: now,
    createdAt: now,
    archived: false,
    createdBy: auth.currentUser?.uid || null,
  };

  if (lot.id) {
    const d = doc(db, COLLECTION, lot.id);
    const snap = await getDoc(d);
    if (snap.exists()) {
      await updateDoc(d, { ...payload, createdAt: snap.data().createdAt || now });
      return lot.id;
    }
  }

  const newDoc = await addDoc(collection(db, COLLECTION), payload);
  return newDoc.id;
};

export const archiveEmballageLot = async (
  lot: Omit<EmballageLotDoc, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> => {
  const isAuth = await waitForAuth();
  if (!isAuth) throw new Error('Utilisateur non authentifié');

  const now = serverTimestamp();
  const base = {
    lotNumber: lot.lotNumber,
    status: lot.status || 'termine',
    emballageData: lot.emballageData,
    updatedAt: now,
    createdAt: now,
    archived: true,
    archivedAt: now,
    createdBy: auth.currentUser?.uid || null,
  };

  if (lot.id) {
    const d = doc(db, COLLECTION, lot.id);
    const snap = await getDoc(d);
    if (snap.exists()) {
      await updateDoc(d, { ...base, createdAt: snap.data().createdAt || now });
      return lot.id;
    }
  }

  const newDoc = await addDoc(collection(db, COLLECTION), base);
  return newDoc.id;
};

export const getEmballageArchives = async (): Promise<EmballageLotDoc[]> => {
  const isAuth = await waitForAuth();
  if (!isAuth) throw new Error('Utilisateur non authentifié');

  try {
    const q = query(
      collection(db, COLLECTION),
      where('archived', '==', true),
      orderBy('archivedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        lotNumber: data.lotNumber,
        status: data.status,
        emballageData: data.emballageData,
        createdAt: tsToIso(data.createdAt),
        updatedAt: tsToIso(data.updatedAt),
        archived: !!data.archived,
        archivedAt: data.archivedAt ? tsToIso(data.archivedAt) : undefined,
        createdBy: data.createdBy || undefined,
      } as EmballageLotDoc;
    });
  } catch (err: any) {
    // Fallback when composite index is missing
    const qSimple = query(
      collection(db, COLLECTION),
      where('archived', '==', true)
    );
    const snap = await getDocs(qSimple);
    const items = snap.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        lotNumber: data.lotNumber,
        status: data.status,
        emballageData: data.emballageData,
        createdAt: tsToIso(data.createdAt),
        updatedAt: tsToIso(data.updatedAt),
        archived: !!data.archived,
        archivedAt: data.archivedAt ? tsToIso(data.archivedAt) : undefined,
        createdBy: data.createdBy || undefined,
      } as EmballageLotDoc;
    });
    items.sort((a, b) => new Date(b.archivedAt || b.updatedAt).getTime() - new Date(a.archivedAt || a.updatedAt).getTime());
    return items;
  }
};

export const deleteEmballageArchive = async (id: string): Promise<void> => {
  const isAuth = await waitForAuth();
  if (!isAuth) throw new Error('Utilisateur non authentifié');
  await deleteDoc(doc(db, COLLECTION, id));
};

export const renameEmballageArchive = async (id: string, lotNumber: string): Promise<void> => {
  const isAuth = await waitForAuth();
  if (!isAuth) throw new Error('Utilisateur non authentifié');
  await updateDoc(doc(db, COLLECTION, id), { lotNumber, updatedAt: serverTimestamp() });
};
