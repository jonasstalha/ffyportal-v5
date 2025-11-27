import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  getDocs, getDoc, query, where, orderBy, Timestamp,
  onSnapshot, DocumentData, QuerySnapshot, Unsubscribe 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from "firebase/storage";
import { firestore, storage } from "./firebase";

// Types
export interface OrderData {
  orderNumber: string;
  client: string;
  description?: string;
  status: 'active' | 'archived';
}

export interface DocumentData {
  documentType: string;
  reference: string;
  description?: string;
  type: string;
}

export interface UploadedDocument {
  id: string;
  downloadURL: string;
  fileName: string;
  fileSize: number;
}

export interface Order extends OrderData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  documentCount: number;
}

export interface Document extends DocumentData {
  id: string;
  orderId: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  storagePath: string;
  mimeType: string;
  status: 'active' | 'archived';
  uploadedAt: Date;
  updatedAt: Date;
}

const ORDERS_COLLECTION = 'orders';
const DOCUMENTS_COLLECTION = 'documents';

export const firestoreService = {
  // ========== ORDERS ==========
  
  async createOrder(orderData: OrderData): Promise<string> {
    try {
      const orderRef = await addDoc(collection(firestore, ORDERS_COLLECTION), {
        ...orderData,
        status: 'active' as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        documentCount: 0
      });
      return orderRef.id;
    } catch (error) {
      throw new Error(`Error creating order: ${error.message}`);
    }
  },

  subscribeToOrders(callback: (orders: Order[]) => void): Unsubscribe {
    // Temporary fix: Remove orderBy to avoid index requirements
    const q = query(collection(firestore, ORDERS_COLLECTION));
    // const q = query(collection(firestore, ORDERS_COLLECTION), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Order[];
      
      // Manual sorting on client side
      orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(orders);
    });
  },

  async updateOrder(orderId: string, updates: Partial<OrderData>): Promise<void> {
    try {
      const orderRef = doc(firestore, ORDERS_COLLECTION, orderId);
      await updateDoc(orderRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      throw new Error(`Error updating order: ${error.message}`);
    }
  },

  async deleteOrder(orderId: string): Promise<void> {
    try {
      // First, delete all documents in this order
      const documentsQuery = query(
        collection(firestore, DOCUMENTS_COLLECTION), 
        where('orderId', '==', orderId)
      );
      const documentsSnapshot = await getDocs(documentsQuery);
      
      const deletePromises = documentsSnapshot.docs.map(async (docSnapshot) => {
        const document = docSnapshot.data();
        // Delete from storage
        if (document.fileUrl) {
          const storageRef = ref(storage, document.fileUrl);
          await deleteObject(storageRef);
        }
        // Delete from Firestore
        await deleteDoc(doc(firestore, DOCUMENTS_COLLECTION, docSnapshot.id));
      });

      await Promise.all(deletePromises);
      
      // Finally delete the order
      await deleteDoc(doc(firestore, ORDERS_COLLECTION, orderId));
    } catch (error) {
      throw new Error(`Error deleting order: ${error.message}`);
    }
  },

  // ========== DOCUMENTS ==========

  async uploadDocument(
    orderId: string, 
    documentData: DocumentData, 
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<UploadedDocument> {
    try {
      // Validate file size (150MB max)
      if (file.size > 150 * 1024 * 1024) {
        throw new Error('File size must be less than 150MB');
      }

      // Generate unique file name
      const fileExtension = file.name.split('.').pop();
      const fileName = `documents/${orderId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const storageRef = ref(storage, fileName);

      // Upload file with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            // Progress tracking
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) onProgress(progress);
          },
          (error) => {
            reject(new Error(`Upload failed: ${error.message}`));
          },
          async () => {
            try {
              // Get download URL
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

              // Save document metadata to Firestore
              const documentRef = await addDoc(collection(firestore, DOCUMENTS_COLLECTION), {
                orderId,
                ...documentData,
                fileName: file.name,
                fileSize: file.size,
                fileUrl: downloadURL,
                storagePath: fileName,
                mimeType: file.type,
                status: 'active' as const,
                uploadedAt: Timestamp.now(),
                updatedAt: Timestamp.now()
              });

              // Update order document count
              await this.incrementOrderDocumentCount(orderId);

              resolve({
                id: documentRef.id,
                downloadURL,
                fileName: file.name,
                fileSize: file.size
              });
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      throw new Error(`Error uploading document: ${error.message}`);
    }
  },

  subscribeToOrderDocuments(orderId: string, callback: (documents: Document[]) => void): Unsubscribe {
    // Temporary fix: Remove orderBy to avoid index requirements
    const q = query(
      collection(firestore, DOCUMENTS_COLLECTION), 
      where('orderId', '==', orderId)
    );
    // const q = query(
    //   collection(firestore, DOCUMENTS_COLLECTION), 
    //   where('orderId', '==', orderId),
    //   orderBy('uploadedAt', 'desc')
    // );
    
    return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const documents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Document[];
      
      // Manual sorting on client side
      documents.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      callback(documents);
    });
  },

  async deleteDocument(document: Document): Promise<void> {
    try {
      // Delete from storage
      if (document.storagePath) {
        const storageRef = ref(storage, document.storagePath);
        await deleteObject(storageRef);
      }

      // Delete from Firestore
      await deleteDoc(doc(firestore, DOCUMENTS_COLLECTION, document.id));

      // Update order document count
      await this.decrementOrderDocumentCount(document.orderId);
    } catch (error) {
      throw new Error(`Error deleting document: ${error.message}`);
    }
  },

  async updateDocument(documentId: string, updates: Partial<DocumentData>): Promise<void> {
    try {
      const docRef = doc(firestore, DOCUMENTS_COLLECTION, documentId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      throw new Error(`Error updating document: ${error.message}`);
    }
  },

  // ========== HELPER METHODS ==========

  async incrementOrderDocumentCount(orderId: string): Promise<void> {
    const orderRef = doc(firestore, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(orderRef);
    if (orderDoc.exists()) {
      const currentCount = orderDoc.data().documentCount || 0;
      await updateDoc(orderRef, {
        documentCount: currentCount + 1,
        updatedAt: Timestamp.now()
      });
    }
  },

  async decrementOrderDocumentCount(orderId: string): Promise<void> {
    const orderRef = doc(firestore, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(orderRef);
    if (orderDoc.exists()) {
      const currentCount = orderDoc.data().documentCount || 0;
      await updateDoc(orderRef, {
        documentCount: Math.max(0, currentCount - 1),
        updatedAt: Timestamp.now()
      });
    }
  },

  async searchOrdersAndDocuments(searchTerm: string): Promise<{ orders: Order[], documents: Document[] }> {
    try {
      // Search in orders
      const ordersQuery = query(
        collection(firestore, ORDERS_COLLECTION),
        where('orderNumber', '>=', searchTerm),
        where('orderNumber', '<=', searchTerm + '\uf8ff')
      );

      // Search in documents
      const documentsQuery = query(
        collection(firestore, DOCUMENTS_COLLECTION),
        where('reference', '>=', searchTerm),
        where('reference', '<=', searchTerm + '\uf8ff')
      );

      const [ordersSnapshot, documentsSnapshot] = await Promise.all([
        getDocs(ordersQuery),
        getDocs(documentsQuery)
      ]);

      const orders = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'order',
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Order[];

      const documents = documentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'document',
        uploadedAt: doc.data().uploadedAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Document[];

      return { orders, documents };
    } catch (error) {
      throw new Error(`Error searching: ${error.message}`);
    }
  }
};