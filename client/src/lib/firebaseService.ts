import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { sharedLotService } from './sharedLotService';
import { multiLotService } from './multiLotService';
import { deleteQualityControlLot } from './qualityControlService';
import { Farm, Lot, AvocadoTracking, StatsData } from "@shared/schema";
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { generateLotPDF } from './pdfGenerator';
import { uploadFileToStorage } from './firebaseHelpers';
import { PerformanceMonitor, NetworkMonitor, LotCache } from './performanceUtils';

// Helper function to convert Firestore timestamp to ISO string
const timestampToISOString = (timestamp: any) => {
  if (!timestamp) return new Date().toISOString();
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  return timestamp;
};

// Helper function to convert Firestore document to Farm type
const convertFarmDoc = (doc: any): Farm => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    location: data.location,
    description: data.description || "",
    code: data.code,
    active: data.active !== false, // Default to true if not specified
    createdAt: timestampToISOString(data.createdAt),
    updatedAt: timestampToISOString(data.updatedAt)
  };
};

// Helper function to convert Firestore document to Lot type
const convertLotDoc = (doc: any): Lot => {
  const data = doc.data();
  return {
    id: doc.id,
    lotNumber: data.lotNumber,
    farmId: data.farmId,
    harvestDate: timestampToISOString(data.harvestDate),
    initialQuantity: data.initialQuantity,
    currentStatus: data.currentStatus,
    createdAt: timestampToISOString(data.createdAt),
    updatedAt: timestampToISOString(data.updatedAt),
    notes: data.notes || ""
  };
};

// Helper function to convert Firestore document to AvocadoTracking type
const convertAvocadoTrackingDoc = (doc: any): AvocadoTracking => {
  const data = doc.data();
  return {
    id: doc.id,
    harvest: {
      harvestDate: timestampToISOString(data.harvest?.harvestDate) || "",
      farmLocation: data.harvest?.farmLocation || "Unknown Location",
      farmerId: data.harvest?.farmerId || "Unknown Farmer",
      lotNumber: data.harvest?.lotNumber || "Unknown Lot",
      variety: data.harvest?.variety || "Unknown Variety"
    },
    transport: {
      lotNumber: data.transport?.lotNumber || "Unknown Lot",
      transportCompany: data.transport?.transportCompany || "Unknown Company",
      driverName: data.transport?.driverName || "Unknown Driver",
      vehicleId: data.transport?.vehicleId || "Unknown Vehicle",
      departureDateTime: timestampToISOString(data.transport?.departureDateTime) || "",
      arrivalDateTime: timestampToISOString(data.transport?.arrivalDateTime) || "",
      temperature: data.transport?.temperature || 0
    },
    sorting: {
      lotNumber: data.sorting?.lotNumber || "Unknown Lot",
      sortingDate: timestampToISOString(data.sorting?.sortingDate) || "",
      qualityGrade: data.sorting?.qualityGrade || "Unknown Grade",
      rejectedCount: data.sorting?.rejectedCount || 0,
      notes: data.sorting?.notes || ""
    },
    packaging: {
      lotNumber: data.packaging?.lotNumber || "Unknown Lot",
      packagingDate: timestampToISOString(data.packaging?.packagingDate) || "",
      boxId: data.packaging?.boxId || "Unknown Box",
      workerIds: data.packaging?.workerIds || [],
      netWeight: data.packaging?.netWeight || 0,
      avocadoCount: data.packaging?.avocadoCount || 0,
      boxType: data.packaging?.boxType || "case"
    },
    storage: {
      boxId: data.storage?.boxId || "Unknown Box",
      entryDate: timestampToISOString(data.storage?.entryDate) || "",
      storageTemperature: data.storage?.storageTemperature || 0,
      storageRoomId: data.storage?.storageRoomId || "Unknown Room",
      exitDate: timestampToISOString(data.storage?.exitDate) || ""
    },
    export: {
      boxId: data.export?.boxId || "Unknown Box",
      loadingDate: timestampToISOString(data.export?.loadingDate) || "",
      containerId: data.export?.containerId || "Unknown Container",
      driverName: data.export?.driverName || "Unknown Driver",
      vehicleId: data.export?.vehicleId || "Unknown Vehicle",
      destination: data.export?.destination || "Unknown Destination"
    },
    delivery: {
      boxId: data.delivery?.boxId || "Unknown Box",
      estimatedDeliveryDate: timestampToISOString(data.delivery?.estimatedDeliveryDate) || "",
      actualDeliveryDate: timestampToISOString(data.delivery?.actualDeliveryDate) || "",
      clientName: data.delivery?.clientName || "Unknown Client",
      clientLocation: data.delivery?.clientLocation || "Unknown Location",
      notes: data.delivery?.notes || ""
    },
    createdAt: timestampToISOString(data.createdAt) || "",
    updatedAt: timestampToISOString(data.updatedAt) || ""
  };
};

// Farms API
export const getFarms = async (): Promise<Farm[]> => {
  try {
    console.log("Fetching farms from Firestore");
    const farmsRef = collection(db, "farms");

    let querySnapshot;
    try {
      const q = query(farmsRef, orderBy("createdAt", "desc"));
      querySnapshot = await getDocs(q);
    } catch (indexError) {
      console.warn("Index error, falling back to unsorted query:", indexError);
      querySnapshot = await getDocs(farmsRef);
    }

    const farms = querySnapshot.docs.map(convertFarmDoc);
    console.log("Fetched farms:", farms);
    return farms;
  } catch (error) {
    console.error("Error getting farms:", error);
    throw error;
  }
};

export const addFarm = async (data: Omit<Farm, 'id' | 'createdAt' | 'updatedAt'>): Promise<Farm> => {
  try {
    console.log("Adding farm to Firestore:", data);
    
    // Validate required fields
    if (!data.name || !data.location || !data.code) {
      console.error("Missing required fields:", { data });
      throw new Error("Missing required fields: name, location, and code are required");
    }
    
    // Validate field types
    if (typeof data.name !== 'string' || typeof data.location !== 'string' || typeof data.code !== 'string') {
      console.error("Invalid field types:", { data });
      throw new Error("Invalid field types: name, location, and code must be strings");
    }
    
    // Validate boolean field
    if (typeof data.active !== 'boolean') {
      console.error("Invalid active field type:", { data });
      throw new Error("Invalid field type: active must be a boolean");
    }
    
    const farmsRef = collection(db, "farms");
    const newFarm = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log("Creating farm document with data:", newFarm);
    const docRef = await addDoc(farmsRef, newFarm);
    console.log("Farm document created with ID:", docRef.id);
    
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.error("Document not found after creation:", docRef.id);
      throw new Error("Failed to create farm document");
    }
    
    const farm = convertFarmDoc(docSnap);
    console.log("Created farm:", farm);
    
    return farm;
  } catch (error) {
    console.error("Error adding farm:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to add farm: ${error.message}`);
    }
    throw error;
  }
};

export const updateFarm = async (id: string, data: Partial<Omit<Farm, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Farm> => {
  try {
    console.log("Updating farm in Firestore:", { id, data });
    
    // Validate required fields if they are being updated
    if (data.name === "" || data.location === "" || data.code === "") {
      throw new Error("Required fields cannot be empty");
    }
    
    const farmRef = doc(db, "farms", id);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    console.log("Updating farm document with data:", updateData);
    await updateDoc(farmRef, updateData);
    
    const docSnap = await getDoc(farmRef);
    const farm = convertFarmDoc(docSnap);
    console.log("Updated farm:", farm);
    
    return farm;
  } catch (error) {
    console.error("Error updating farm:", error);
    throw error;
  }
};

export const deleteFarm = async (id: string): Promise<void> => {
  try {
    console.log("Deleting farm from Firestore:", id);
    const farmRef = doc(db, "farms", id);
    await deleteDoc(farmRef);
    console.log("Farm deleted successfully");
  } catch (error) {
    console.error("Error deleting farm:", error);
    throw error;
  }
};

// Lots API
export const getLots = async (): Promise<Lot[]> => {
  try {
    const lotsRef = collection(db, "lots");
    const q = query(lotsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertLotDoc);
  } catch (error) {
    console.error("Error getting lots:", error);
    throw error;
  }
};

export const addLot = async (data: Omit<Lot, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lot> => {
  try {
    const lotsRef = collection(db, "lots");
    const newLot = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(lotsRef, newLot);
    const docSnap = await getDoc(docRef);
    return convertLotDoc(docSnap);
  } catch (error) {
    console.error("Error adding lot:", error);
    throw error;
  }
};

export const updateLot = async (id: string, data: Partial<Omit<Lot, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Lot> => {
  try {
    const lotRef = doc(db, "lots", id);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    await updateDoc(lotRef, updateData);
    const docSnap = await getDoc(lotRef);
    return convertLotDoc(docSnap);
  } catch (error) {
    console.error("Error updating lot:", error);
    throw error;
  }
};

export const deleteLot = async (id: string): Promise<void> => {
  try {
    const lotRef = doc(db, "lots", id);
    await deleteDoc(lotRef);
  } catch (error) {
    console.error("Error deleting lot:", error);
    throw error;
  }
};

// Avocado Tracking API
export const getAvocadoTrackingData = async (): Promise<AvocadoTracking[]> => {
  try {
    const trackingRef = collection(db, "avocado-tracking");
    const q = query(trackingRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertAvocadoTrackingDoc);
  } catch (error) {
    console.error("Error getting avocado tracking data:", error);
    throw error;
  }
};

// Get specific avocado tracking data by lot number (optimized for lot details page)
export const getAvocadoTrackingByLotNumber = async (lotNumber: string): Promise<AvocadoTracking | null> => {
  try {
    // Check cache first
    const cached = LotCache.get(lotNumber);
    if (cached) {
      return cached;
    }

    NetworkMonitor.logConnectionInfo();
    
    return await PerformanceMonitor.measure(`fetch-lot-${lotNumber}`, async () => {
      console.log("Searching for lot number:", lotNumber);
      const trackingRef = collection(db, "avocado-tracking");
      
      // Try to query by exact lot number first (without orderBy to avoid composite index requirement)
      const exactQuery = query(
        trackingRef, 
        where("harvest.lotNumber", "==", lotNumber)
      );
      
      let querySnapshot = await getDocs(exactQuery);
      
      if (!querySnapshot.empty) {
        console.log("Found exact match for lot number:", lotNumber);
        // If multiple documents match, get the most recent one by sorting in memory
        const docs = querySnapshot.docs.map(doc => ({
          doc,
          createdAt: doc.data().createdAt
        }));
        
        // Sort by createdAt in memory (most recent first)
        docs.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
          return timeB - timeA;
        });
        
        const result = convertAvocadoTrackingDoc(docs[0].doc);
        LotCache.set(lotNumber, result);
        return result;
      }
      
      // If no exact match, try case-insensitive search by fetching all and filtering
      // This is a fallback for cases where lot numbers might have different casing
      console.log("No exact match found, trying fallback search");
      const allQuery = query(trackingRef);
      querySnapshot = await getDocs(allQuery);
      
      const foundDoc = querySnapshot.docs.find(doc => {
        const data = doc.data();
        const docLotNumber = data.harvest?.lotNumber;
        if (!docLotNumber) return false;
        
        return docLotNumber.toLowerCase() === lotNumber.toLowerCase() ||
               docLotNumber.toUpperCase() === lotNumber.toUpperCase() ||
               docLotNumber === lotNumber;
      });
      
      if (foundDoc) {
        console.log("Found match with fallback search:", foundDoc.data().harvest?.lotNumber);
        const result = convertAvocadoTrackingDoc(foundDoc);
        LotCache.set(lotNumber, result);
        return result;
      }
      
      console.log("No lot found with number:", lotNumber);
      return null;
    });
  } catch (error) {
    console.error("Error getting avocado tracking by lot number:", error);
    throw error;
  }
};

export const addAvocadoTracking = async (data: Omit<AvocadoTracking, 'id' | 'createdAt' | 'updatedAt'>): Promise<AvocadoTracking> => {
  try {
    const trackingRef = collection(db, "avocado-tracking");
    
    // Convert empty strings to null and ensure proper types
    const cleanData = {
      harvest: {
        harvestDate: data.harvest?.harvestDate || "",
        farmLocation: data.harvest?.farmLocation || "",
        farmerId: data.harvest?.farmerId || "",
        lotNumber: data.harvest?.lotNumber || "",
        variety: data.harvest?.variety || "hass"
      },
      transport: {
        lotNumber: data.transport?.lotNumber || "",
        transportCompany: data.transport?.transportCompany || "",
        driverName: data.transport?.driverName || "",
        vehicleId: data.transport?.vehicleId || "",
        departureDateTime: data.transport?.departureDateTime || "",
        arrivalDateTime: data.transport?.arrivalDateTime || "",
        temperature: data.transport?.temperature || 0
      },
      sorting: {
        lotNumber: data.sorting?.lotNumber || "",
        sortingDate: data.sorting?.sortingDate || "",
        qualityGrade: data.sorting?.qualityGrade || "A",
        rejectedCount: data.sorting?.rejectedCount || 0,
        notes: data.sorting?.notes || ""
      },
      packaging: {
        lotNumber: data.packaging?.lotNumber || "",
        packagingDate: data.packaging?.packagingDate || "",
        boxId: data.packaging?.boxId || "",
        workerIds: data.packaging?.workerIds || [],
        netWeight: data.packaging?.netWeight || 0,
        avocadoCount: data.packaging?.avocadoCount || 0,
        boxType: data.packaging?.boxType || "case"
      },
      storage: {
        boxId: data.storage?.boxId || "",
        entryDate: data.storage?.entryDate || "",
        storageTemperature: data.storage?.storageTemperature || 0,
        storageRoomId: data.storage?.storageRoomId || "",
        exitDate: data.storage?.exitDate || ""
      },
      export: {
        boxId: data.export?.boxId || "",
        loadingDate: data.export?.loadingDate || "",
        containerId: data.export?.containerId || "",
        driverName: data.export?.driverName || "",
        vehicleId: data.export?.vehicleId || "",
        destination: data.export?.destination || ""
      },
      delivery: {
        boxId: data.delivery?.boxId || "",
        estimatedDeliveryDate: data.delivery?.estimatedDeliveryDate || "",
        actualDeliveryDate: data.delivery?.actualDeliveryDate || "",
        clientName: data.delivery?.clientName || "",
        clientLocation: data.delivery?.clientLocation || "",
        notes: data.delivery?.notes || ""
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(trackingRef, cleanData);
    const docSnap = await getDoc(docRef);
    return convertAvocadoTrackingDoc(docSnap);
  } catch (error) {
    console.error("Error adding avocado tracking:", error);
    throw error;
  }
};

export const updateAvocadoTracking = async (id: string, data: Partial<Omit<AvocadoTracking, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AvocadoTracking> => {
  try {
    const trackingRef = doc(db, "avocado-tracking", id);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    await updateDoc(trackingRef, updateData);
    const docSnap = await getDoc(trackingRef);
    return convertAvocadoTrackingDoc(docSnap);
  } catch (error) {
    console.error("Error updating avocado tracking:", error);
    throw error;
  }
};

export const deleteAvocadoTracking = async (id: string): Promise<void> => {
  try {
    const trackingRef = doc(db, "avocado-tracking", id);
    await deleteDoc(trackingRef);
  } catch (error) {
    console.error("Error deleting avocado tracking:", error);
    throw error;
  }
};

// Stats API
export const getStats = async (): Promise<StatsData> => {
  try {
    // Get active farms count
    const farmsRef = collection(db, "farms");
    const activeFarmsQuery = query(farmsRef, where("active", "==", true));
    const activeFarmsSnapshot = await getDocs(activeFarmsQuery);
    const activeFarmsCount = activeFarmsSnapshot.size;
    
    // Get total lots count
    const lotsRef = collection(db, "lots");
    const lotsSnapshot = await getDocs(lotsRef);
    const totalLotsCount = lotsSnapshot.size;
    
    // Get in transit lots count
    const inTransitQuery = query(lotsRef, where("currentStatus", "==", "shipped"));
    const inTransitSnapshot = await getDocs(inTransitQuery);
    const inTransitCount = inTransitSnapshot.size;
    
    // Get delivered today lots count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const deliveredTodayQuery = query(
      lotsRef, 
      where("currentStatus", "==", "delivered"),
      where("updatedAt", ">=", Timestamp.fromDate(today)),
      where("updatedAt", "<", Timestamp.fromDate(tomorrow))
    );
    const deliveredTodaySnapshot = await getDocs(deliveredTodayQuery);
    const deliveredTodayCount = deliveredTodaySnapshot.size;
    
    return {
      totalLots: totalLotsCount,
      activeFarms: activeFarmsCount,
      inTransit: inTransitCount,
      deliveredToday: deliveredTodayCount
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    throw error;
  }
};

// PDF Generation and Storage
export const generateAndStorePDF = async (lotId: string): Promise<string> => {
  try {
    // Get the lot data
    const entries = await getAvocadoTrackingData();
    const lot = entries.find(entry => entry.harvest.lotNumber === lotId);
    
    if (!lot) {
      throw new Error(`Lot ${lotId} not found`);
    }

    // Generate PDF
    const pdfBlob = await generateLotPDF(lot);

    // Upload to Firebase Storage
    const storageRef = ref(storage, `reports/${lotId}.pdf`);
    await uploadBytes(storageRef, pdfBlob, {
      contentType: 'application/pdf'
    });

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Error generating and storing PDF:", error);
    throw error;
  }
};

// Add a function to create a new archive box in Firestore
export const createArchiveBox = async (title: string, color: string, icon: string, userId: string): Promise<string> => {
  if (!userId) {
    throw new Error('User ID is required to create a box.');
  }

  const docRef = await addDoc(collection(db, 'boxes'), {
    title,
    color,
    icon,
    userId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

// Add a function to add an item to an archive box
export const addItemToBox = async (
  boxId: string,
  itemName: string,
  type: string,
  file: File | undefined,
  userId: string
): Promise<string> => {
  if (!userId) {
    throw new Error('User ID is required to add an item to a box.');
  }

  let fileUrl = '';
  if (file) {
    try {
      const timestamp = Date.now();
      const randomId = Math.floor(Math.random() * 10000000000000);
      const safeFileName = `${timestamp}_${randomId}.${file.name.split('.').pop()}`;
      
      // Upload file to storage
      fileUrl = await uploadFileToStorage(file, boxId, itemName, type, userId);
      console.log('File uploaded successfully:', fileUrl);
    } catch (error) {
      console.error('Storage upload error:', error);
      throw new Error('Failed to upload file. Please try again.');
    }
  }

  try {
    const docRef = await addDoc(collection(db, 'boxItems'), {
      boxId,
      name: itemName,
      type,
      fileUrl,
      userId,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Firestore add error:', error);
    if (fileUrl && file) {
      try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
      } catch (deleteError) {
        console.error('Failed to clean up orphaned file:', deleteError);
      }
    }
    throw error;
  }
};

// Messages API
export interface Message {
  id: string;
  senderEmail: string;
  senderName: string;
  recipientEmail?: string; // If specific user, otherwise it's a broadcast
  recipientName?: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  read: boolean;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationNotification {
  id: string;
  content: string;
  timestamp: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

// Helper function to convert Firestore document to Message type
const convertMessageDoc = (doc: any): Message => {
  const data = doc.data();
  return {
    id: doc.id,
    senderEmail: data.senderEmail || "",
    senderName: data.senderName || "",
    recipientEmail: data.recipientEmail || null,
    recipientName: data.recipientName || null,
    content: data.content || "",
    priority: data.priority || "medium",
    read: data.read || false,
    timestamp: timestampToISOString(data.timestamp),
    createdAt: timestampToISOString(data.createdAt),
    updatedAt: timestampToISOString(data.updatedAt)
  };
};

// Helper function to convert Firestore document to Notification type
const convertCommunicationNotificationDoc = (doc: any): CommunicationNotification => {
  const data = doc.data();
  return {
    id: doc.id,
    content: data.content || "",
    timestamp: timestampToISOString(data.timestamp),
    read: data.read || false,
    createdAt: timestampToISOString(data.createdAt),
    updatedAt: timestampToISOString(data.updatedAt)
  };
};

// Get all messages for a specific user (either as sender or recipient)
export const getMessagesForUser = async (userEmail: string): Promise<Message[]> => {
  try {
    const messagesRef = collection(db, "messages");
    // Get messages where user is recipient OR messages that are broadcasts (recipientEmail is null)
    const q1 = query(
      messagesRef,
      where("recipientEmail", "==", userEmail),
      orderBy("createdAt", "desc")
    );
    const q2 = query(
      messagesRef,
      where("recipientEmail", "==", null),
      orderBy("createdAt", "desc")
    );
    
    const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    
    const userMessages = snapshot1.docs.map(convertMessageDoc);
    const broadcastMessages = snapshot2.docs.map(convertMessageDoc);
    
    // Combine and sort by creation date
    return [...userMessages, ...broadcastMessages].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("Error getting messages for user:", error);
    throw error;
  }
};

// Get all messages (for admin/broadcast view)
export const getAllMessages = async (): Promise<Message[]> => {
  try {
    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertMessageDoc);
  } catch (error) {
    console.error("Error getting all messages:", error);
    throw error;
  }
};

// Send a message
export const sendMessage = async (data: {
  senderEmail: string;
  senderName: string;
  recipientEmail?: string;
  recipientName?: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
}): Promise<Message> => {
  try {
    const messagesRef = collection(db, "messages");
    const newMessage = {
      senderEmail: data.senderEmail,
      senderName: data.senderName,
      recipientEmail: data.recipientEmail || null,
      recipientName: data.recipientName || null,
      content: data.content,
      priority: data.priority,
      read: false,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(messagesRef, newMessage);
    const docSnap = await getDoc(docRef);
    return convertMessageDoc(docSnap);
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

// Mark message as read
export const markMessageAsRead = async (messageId: string): Promise<void> => {
  try {
    const messageRef = doc(db, "messages", messageId);
    await updateDoc(messageRef, {
      read: true,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error marking message as read:", error);
    throw error;
  }
};

// Delete message
export const deleteMessageFromDB = async (messageId: string): Promise<void> => {
  try {
    const messageRef = doc(db, "messages", messageId);
    await deleteDoc(messageRef);
  } catch (error) {
    console.error("Error deleting message:", error);
    throw error;
  }
};

// Get all notifications
export const getCommunicationNotifications = async (): Promise<CommunicationNotification[]> => {
  try {
    const notificationsRef = collection(db, "communication-notifications");
    const q = query(notificationsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertCommunicationNotificationDoc);
  } catch (error) {
    console.error("Error getting notifications:", error);
    throw error;
  }
};

// Add notification
export const addCommunicationNotification = async (content: string): Promise<CommunicationNotification> => {
  try {
    const notificationsRef = collection(db, "communication-notifications");
    const newNotification = {
      content,
      timestamp: serverTimestamp(),
      read: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(notificationsRef, newNotification);
    const docSnap = await getDoc(docRef);
    return convertCommunicationNotificationDoc(docSnap);
  } catch (error) {
    console.error("Error adding notification:", error);
    throw error;
  }
};

// Mark notification as read
export const markCommunicationNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, "communication-notifications", notificationId);
    await updateDoc(notificationRef, {
      read: true,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

// Delete notification
export const deleteCommunicationNotification = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, "communication-notifications", notificationId);
    await deleteDoc(notificationRef);
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
};

// Get all users (for sending messages to specific users)
export const getUsers = async (): Promise<{ email: string; name: string }[]> => {
  try {
    // This could be from a users collection if you have one, 
    // or extracted from existing messages
    const messagesRef = collection(db, "messages");
    const querySnapshot = await getDocs(messagesRef);
    
    const users = new Set<string>();
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.senderEmail) {
        users.add(JSON.stringify({ email: data.senderEmail, name: data.senderName || data.senderEmail }));
      }
      if (data.recipientEmail) {
        users.add(JSON.stringify({ email: data.recipientEmail, name: data.recipientName || data.recipientEmail }));
      }
    });
    
    return Array.from(users).map(user => JSON.parse(user));
  } catch (error) {
    console.error("Error getting users:", error);
    throw error;
  }
};

// Orders API
export interface ClientOrder {
  id: string;
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  products: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    totalPrice: number;
  }>;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: string;
  requestedDeliveryDate: string;
  actualDeliveryDate?: string;
  totalAmount: number;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  selected?: boolean;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: string;
  updatedAt: string;
  // Linked lot IDs for cross-system synchronization
  linkedProductionLotId?: string;
  linkedQualitySharedLotId?: string;
  linkedQualityLotId?: string;
  linkedWasteTrackingLotId?: string;
  linkedNewEntryLotId?: string;
}

// Helper function to convert Firestore document to ClientOrder type
const convertClientOrderDoc = (doc: any): ClientOrder => {
  const data = doc.data();
  return {
    id: doc.id,
    orderNumber: data.orderNumber || '',
    clientName: data.clientName || '',
    clientEmail: data.clientEmail || '',
    clientPhone: data.clientPhone || '',
    products: data.products || [],
    status: data.status || 'pending',
    orderDate: timestampToISOString(data.orderDate),
    requestedDeliveryDate: timestampToISOString(data.requestedDeliveryDate),
    actualDeliveryDate: data.actualDeliveryDate ? timestampToISOString(data.actualDeliveryDate) : undefined,
    totalAmount: data.totalAmount || 0,
    priority: data.priority || 'medium',
    notes: data.notes || '',
    selected: false,
    shippingAddress: data.shippingAddress || {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    },
    paymentStatus: data.paymentStatus || 'pending',
    createdAt: timestampToISOString(data.createdAt),
    updatedAt: timestampToISOString(data.updatedAt),
    linkedProductionLotId: data.linkedProductionLotId,
    linkedQualitySharedLotId: data.linkedQualitySharedLotId,
    linkedQualityLotId: data.linkedQualityLotId,
    linkedWasteTrackingLotId: data.linkedWasteTrackingLotId,
    linkedNewEntryLotId: data.linkedNewEntryLotId
  };
};

// Get all client orders
export const getClientOrders = async (): Promise<ClientOrder[]> => {
  try {
    console.log("Fetching client orders from Firestore");
    const ordersRef = collection(db, "client-orders");
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const orders = querySnapshot.docs.map(convertClientOrderDoc);
    console.log("Fetched client orders:", orders);
    return orders;
  } catch (error) {
    console.error("Error getting client orders:", error);
    throw error;
  }
};

// Add new client order
export const addClientOrder = async (data: Omit<ClientOrder, 'id' | 'createdAt' | 'updatedAt' | 'selected'>): Promise<ClientOrder> => {
  try {
    console.log("Adding client order to Firestore:", data);
    
    const ordersRef = collection(db, "client-orders");
    const newOrder = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log("Creating order document with data:", newOrder);
    const docRef = await addDoc(ordersRef, newOrder);
    console.log("Order document created with ID:", docRef.id);
    
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.error("Document not found after creation:", docRef.id);
      throw new Error("Failed to create order document");
    }
    
    const order = convertClientOrderDoc(docSnap);
    console.log("Created order:", order);
    
    return order;
  } catch (error) {
    console.error("Error adding client order:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to add order: ${error.message}`);
    }
    throw error;
  }
};

// Update client order
export const updateClientOrder = async (id: string, data: Partial<Omit<ClientOrder, 'id' | 'createdAt' | 'updatedAt' | 'selected'>>): Promise<ClientOrder> => {
  try {
    console.log("Updating client order in Firestore:", { id, data });
    
    const orderRef = doc(db, "client-orders", id);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    console.log("Updating order document with data:", updateData);
    await updateDoc(orderRef, updateData);
    
    const docSnap = await getDoc(orderRef);
    const order = convertClientOrderDoc(docSnap);
    console.log("Updated order:", order);
    
    return order;
  } catch (error) {
    console.error("Error updating client order:", error);
    throw error;
  }
};

// Delete client order
export const deleteClientOrder = async (id: string): Promise<void> => {
  try {
    console.log("Deleting client order from Firestore:", id);
    const orderRef = doc(db, "client-orders", id);

    // Fetch order first to get linked lot IDs and orderNumber
    let orderSnapshot;
    try {
      orderSnapshot = await getDoc(orderRef);
    } catch (err) {
      console.warn('Could not read order before deletion:', err);
    }

    const orderData: any = orderSnapshot?.exists() ? orderSnapshot.data() : undefined;
    const orderNumber = orderData?.orderNumber;

    // Delete the Firestore order document
    await deleteDoc(orderRef);
    console.log("Order deleted from Firestore");

    // If order had linked shared lots (production/quality/dechets), try to delete them
    const linkedProductionLotId = orderData?.linkedProductionLotId;
    const linkedQualitySharedLotId = orderData?.linkedQualitySharedLotId;
    const linkedWasteTrackingLotId = orderData?.linkedWasteTrackingLotId;
    const linkedNewEntryLotId = orderData?.linkedNewEntryLotId;
    const linkedQualityLotId = orderData?.linkedQualityLotId; // QC lot in quality_control_lots

    const deletionPromises: Promise<any>[] = [];

    if (linkedQualityLotId) {
      try {
        deletionPromises.push(deleteQualityControlLot(linkedQualityLotId));
      } catch (err) {
        console.warn('Failed to schedule QC lot deletion:', err);
      }
    }

    if (linkedProductionLotId) {
      try {
        deletionPromises.push(sharedLotService.deleteLot(linkedProductionLotId));
      } catch (err) {
        console.warn('Failed to schedule production shared lot deletion:', err);
      }
    }

    if (linkedQualitySharedLotId) {
      try {
        deletionPromises.push(sharedLotService.deleteLot(linkedQualitySharedLotId));
      } catch (err) {
        console.warn('Failed to schedule quality shared lot deletion:', err);
      }
    }

    if (linkedWasteTrackingLotId) {
      try {
        deletionPromises.push(sharedLotService.deleteLot(linkedWasteTrackingLotId));
      } catch (err) {
        console.warn('Failed to schedule waste tracking lot deletion:', err);
      }
    }

    if (linkedNewEntryLotId) {
      try {
        deletionPromises.push(multiLotService.deleteLot(linkedNewEntryLotId));
      } catch (err) {
        console.warn('Failed to schedule multi-lot deletion:', err);
      }
    }

    // Also clean up any localStorage entries created at order creation time (packing_lists, production_lots)
    try {
      if (typeof window !== 'undefined' && orderNumber) {
        // Remove from packing_lists
        const packingKey = 'packing_lists';
        const rawPacking = localStorage.getItem(packingKey);
        if (rawPacking) {
          try {
            const parsed = JSON.parse(rawPacking);
            const filtered = parsed.filter((p: any) => p.lotNumber !== orderNumber && p.lotNumber !== orderNumber);
            localStorage.setItem(packingKey, JSON.stringify(filtered));
            console.log('Removed packing list entries for order:', orderNumber);
            try {
              // storage events do not fire in the same tab - dispatch a synthetic event to notify listeners
              const evt = new StorageEvent('storage', { key: packingKey, newValue: JSON.stringify(filtered) });
              window.dispatchEvent(evt);
            } catch (e) {
              // Some browsers may restrict StorageEvent construction; ignore silently
            }
          } catch (e) {
            console.warn('Failed to parse packing_lists during cleanup:', e);
          }
        }

        // Remove matching entries from production_lots localStorage if present
        const productionKey = 'production_lots';
        const rawProd = localStorage.getItem(productionKey);
        if (rawProd) {
          try {
            const parsed = JSON.parse(rawProd || '[]');
            const filtered = parsed.filter((p: any) => p.lotNumber !== orderNumber && p.productionData?.headerData?.numeroLotClient !== orderNumber);
            localStorage.setItem(productionKey, JSON.stringify(filtered));
            console.log('Removed production_lots entries for order:', orderNumber);
            try {
              const evt = new StorageEvent('storage', { key: productionKey, newValue: JSON.stringify(filtered) });
              window.dispatchEvent(evt);
            } catch (e) {
              // ignore
            }
          } catch (e) {
            console.warn('Failed to parse production_lots during cleanup:', e);
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage cleanup skipped (non-browser environment):', e);
    }

    // Await all scheduled deletions, but don't fail the whole operation if one fails
    try {
      await Promise.allSettled(deletionPromises);
      console.log('Linked lot deletions attempted');
    } catch (e) {
      console.warn('Error during linked lot deletions:', e);
    }

    console.log("Order deletion cleanup completed");
  } catch (error) {
    console.error("Error deleting client order:", error);
    throw error;
  }
};

// Bulk update client orders status
export const bulkUpdateOrderStatus = async (orderIds: string[], status: ClientOrder['status']): Promise<void> => {
  try {
    console.log("Bulk updating order status:", { orderIds, status });
    const promises = orderIds.map(id => {
      const orderRef = doc(db, "client-orders", id);
      return updateDoc(orderRef, {
        status,
        updatedAt: serverTimestamp()
      });
    });
    await Promise.all(promises);
    console.log("Bulk update completed successfully");
  } catch (error) {
    console.error("Error bulk updating orders:", error);
    throw error;
  }
};

// Get order statistics
export const getOrderStats = async (): Promise<{
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  totalRevenue: number;
  averageOrderValue: number;
}> => {
  try {
    const ordersRef = collection(db, "client-orders");
    const querySnapshot = await getDocs(ordersRef);
    const orders = querySnapshot.docs.map(convertClientOrderDoc);
    
    const stats = {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      processing: orders.filter(o => o.status === 'processing').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      totalRevenue: orders.filter(o => o.status !== 'cancelled').reduce((sum, order) => sum + order.totalAmount, 0),
      averageOrderValue: 0
    };
    
    stats.averageOrderValue = stats.total > 0 ? stats.totalRevenue / stats.total : 0;
    
    return stats;
  } catch (error) {
    console.error("Error getting order stats:", error);
    throw error;
  }
};
