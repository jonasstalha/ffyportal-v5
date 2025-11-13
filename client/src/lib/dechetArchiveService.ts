import { 
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Data model for waste tracking
export interface DechetRow {
  numeroPalette: string;     // N° palette
  nombreCaisses: string;     // Nombre de caisses
  poidsBrut: string;         // Poids Brut
  poidsNet: string;          // Poids Net
  natureDechet: string;      // Nature de déchet
  variete: string;           // Variété
}

export interface DechetFormData {
  header: {
    code: string;              // F.S.D
    date: string;              // Date creation
    version: string;           // version
    dateTraitement: string;    // Date traitement
    responsableTracabilite: string; // Responsable Traçabilité
    produit: string;           // AVOCAT
    conventionnel: boolean;
    biologique: boolean;
  };
  rows: DechetRow[];
}

export interface DechetArchive {
  id: string;
  lotNumber: string;
  data: DechetFormData;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CreateDechetArchive {
  lotNumber: string;
  data: DechetFormData;
}

export interface UpdateDechetArchive {
  lotNumber?: string;
  data?: DechetFormData;
}

class DechetArchiveService {
  private collectionName = 'dechet_archives';

  async add(archiveData: CreateDechetArchive): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...archiveData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async update(id: string, updates: UpdateDechetArchive): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  subscribe(
    onUpdate: (archives: DechetArchive[]) => void,
    onError: (error: Error) => void
  ): () => void {
    const q = query(
      collection(db, this.collectionName),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(
      q,
      (querySnapshot) => {
        const archives: DechetArchive[] = [];
        querySnapshot.forEach((doc) => {
          archives.push({
            id: doc.id,
            ...(doc.data() as any),
          } as DechetArchive);
        });
        onUpdate(archives);
      },
      (error) => {
        console.error('Archive subscription error:', error);
        onError(error as Error);
      }
    );
  }
}

export const dechetArchiveService = new DechetArchiveService();
