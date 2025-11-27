// firebaseHelpers.ts - Fixed version
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { storage, auth, firestore } from '@/lib/firebase';

// Cloud Function URL - replace with your actual deployed function URL
const UPLOAD_FUNCTION_URL = 'https://us-central1-fruitsforyou-10acc.cloudfunctions.net/uploadFile';

export const uploadFileToStorage = async (
  file: File,
  boxId: string,
  itemName: string,
  type: string,
  userId: string
): Promise<string> => {
  try {
    if (!(file instanceof File)) {
      throw new Error("Invalid file object");
    }

    // Convert file to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert file to base64"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

    // Call the Cloud Function
    const response = await fetch(
      "https://us-central1-fruitsforyou-10acc.cloudfunctions.net/uploadFile",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          boxId,
          itemName,
          type,
          userId,
          fileData: base64Data,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to upload file");
  }
};


// Option 2: Cloud Function Upload (alternative implementation)
const CLOUD_FUNCTION_URL = 'https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/uploadFile';

export const uploadFileToCloudFunction = async (
  file: File,
  fileName: string,
  boxId: string
): Promise<string> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Convert file to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        fileData: base64Data,
        contentType: file.type,
        userId,
        boxId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file. Please try again.');
  }
};

// Fixed firebaseService.ts function
export const addItemToBox = async (
  boxId: string,
  itemName: string,
  type: string,
  file?: File,
  userId?: string
): Promise<void> => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    let fileURL = '';
    
    // If there's a file, upload it to Firebase Storage
    if (file) {
      fileURL = await uploadFileToStorage(file, boxId, itemName, type, userId);
      // Alternative: fileURL = await uploadFileToCloudFunction(file, itemName, boxId);
    }

    // Add the item data to Firestore
    const itemData = {
      name: itemName,
      type: type,
      userId: userId,
      boxId: boxId,
      fileURL: fileURL,
      createdAt: new Date(),
    };

    // Add to Firestore collection
    const docRef = await addDoc(collection(firestore, 'items'), itemData);
    
    console.log('Item added with ID:', docRef.id);
  } catch (error) {
    console.error('Error adding item to box:', error);
    throw error;
  }
};