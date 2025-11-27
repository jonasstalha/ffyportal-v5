import { 
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { waitForAuth } from './qualityControlService';

// Types mirrored from the Reception page with minimal duplication
export interface ReceptionQualityControlData {
  header: {
    ref: string;
    version: string;
    date: string;
    deliveryDate: string;
    productRange: string;
    provider: string;
    protocol: string;
    conventionnel: boolean;
    bio: boolean;
    deliveryBonNumber: string;
    receptionBonNumber: string;
    receptionTime: string;
    boxState: string;
    matricule: string;
    variety: string;
    producer: string;
    truckQuality: string;
    totalPallets: string;
    netWeight: string;
    productLotNumber: string;
  };
  qualityChecks: {
    diseaseTraces: { count: string; weight: string; percentage: string };
    ripeFruit: { count: string; weight: string; percentage: string };
    dirtyFruit: { count: string; weight: string; percentage: string };
    sunBurns: { count: string; weight: string; percentage: string };
    withoutStem: { count: string; weight: string; percentage: string };
  };
  totalDefects: string;
  color: string;
  odor: string;
  decision: string;
  responsibleSignature: string;
}

export interface ReceptionQualityControlLot {
  id: string; // document id
  lotNumber: string;
  status: 'brouillon' | 'en_cours' | 'termine';
  data: ReceptionQualityControlData;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  archived?: boolean;
  archivedAt?: string; // ISO
  createdBy?: string;
}

const COLLECTION = 'reception_controls';

const tsToIso = (v: any): string => {
  if (!v) return new Date().toISOString();
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return typeof v === 'string' ? v : new Date(v).toISOString();
};

export const saveReceptionControl = async (
  lot: Omit<ReceptionQualityControlLot, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> => {
  const isAuth = await waitForAuth();
  if (!isAuth) throw new Error('Utilisateur non authentifié');

  const now = serverTimestamp();
  const payload = {
    lotNumber: lot.lotNumber,
    status: lot.status || 'brouillon',
    data: lot.data,
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

export const archiveReceptionControl = async (
  lot: Omit<ReceptionQualityControlLot, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> => {
  const isAuth = await waitForAuth();
  if (!isAuth) throw new Error('Utilisateur non authentifié');

  const now = serverTimestamp();
  const base = {
    lotNumber: lot.lotNumber,
    status: lot.status || 'termine',
    data: lot.data,
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

export const getReceptionArchives = async (): Promise<ReceptionQualityControlLot[]> => {
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
        data: data.data,
        createdAt: tsToIso(data.createdAt),
        updatedAt: tsToIso(data.updatedAt),
        archived: !!data.archived,
        archivedAt: data.archivedAt ? tsToIso(data.archivedAt) : undefined,
        createdBy: data.createdBy || undefined,
      } as ReceptionQualityControlLot;
    });
  } catch (err: any) {
    // Fallback when composite index is missing
    if (typeof err?.message === 'string' && err.message.includes('index')) {
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
          data: data.data,
          createdAt: tsToIso(data.createdAt),
          updatedAt: tsToIso(data.updatedAt),
          archived: !!data.archived,
          archivedAt: data.archivedAt ? tsToIso(data.archivedAt) : undefined,
          createdBy: data.createdBy || undefined,
        } as ReceptionQualityControlLot;
      });
      // Sort client-side by archivedAt desc
      items.sort((a, b) => new Date(b.archivedAt || b.updatedAt).getTime() - new Date(a.archivedAt || a.updatedAt).getTime());
      return items;
    }
    throw err;
  }
};

export const deleteReceptionArchive = async (id: string): Promise<void> => {
  const isAuth = await waitForAuth();
  if (!isAuth) throw new Error('Utilisateur non authentifié');
  await deleteDoc(doc(db, COLLECTION, id));
};
