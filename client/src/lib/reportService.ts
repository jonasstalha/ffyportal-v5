import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db, auth } from './firebase';
import { doc, updateDoc, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Types for the report system
export interface ReportData {
  id: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
  title?: string;
  description?: string;
}

/**
 * Step 1 - Upload Image to Firebase Storage
 * Uploads an image file to Firebase Storage under reports/{reportId}/{filename}
 * and saves the download URL to Firestore
 */
export const uploadImageToReport = async (
  file: File, 
  reportId: string
): Promise<string> => {
  try {
    console.log('🚀 UPLOAD STARTING');
    
    // 🔐 AUTHENTICATION CHECK
    const user = getAuth().currentUser;
    if (!user) {
      console.error('❌ User is not signed in!');
      throw new Error('Authentication required: User must be signed in to upload files');
    }
    console.log('✅ User authenticated:', { email: user.email, uid: user.uid });
    
    // 📋 FIREBASE INITIALIZATION CHECK
    console.log('� Firebase Storage initialization check...');
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }
    console.log('✅ Firebase Storage initialized');
    
    console.log('�📁 File:', { name: file.name, size: `${(file.size/1024/1024).toFixed(2)}MB`, type: file.type });
    console.log('📄 Report ID:', reportId);
    
    // Validate file
    if (!file || file.size === 0) {
      throw new Error('Invalid file: File is empty or undefined');
    }
    
    // Validate reportId
    if (!reportId || reportId.trim() === '') {
      throw new Error('Invalid reportId: ReportId cannot be empty');
    }
    
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${sanitizedName}`;
    
    // Create storage reference
    const storageRef = ref(storage, `reports/${reportId}/${fileName}`);
    console.log('📍 Storage path:', `reports/${reportId}/${fileName}`);
    
    // Upload the file
    console.log('📤 Uploading to Firebase Storage...');
    const snapshot = await uploadBytes(storageRef, file);
    console.log('✅ Upload successful:', snapshot.metadata.fullPath);
    
    // Get download URL
    console.log('🔗 Getting download URL...');
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('✅ Download URL generated:', downloadURL.substring(0, 80) + '...');
    
    // Save URL to Firestore
    console.log('💾 Saving URL to Firestore...');
    const reportDocRef = doc(db, 'reports', reportId);
    
    // Check if document exists, create if not
    const docSnap = await getDoc(reportDocRef);
    if (!docSnap.exists()) {
      console.log('📄 Creating new report document...');
      await setDoc(reportDocRef, {
        id: reportId,
        images: [downloadURL],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      console.log('📄 Updating existing report document...');
      // Update existing document
      await updateDoc(reportDocRef, {
        images: arrayUnion(downloadURL),
        updatedAt: new Date().toISOString()
      });
    }
    
    console.log('✅ SUCCESS! Image uploaded and saved to Firestore');
    console.log('🔗 Final URL:', downloadURL);
    
    return downloadURL;
    
  } catch (error) {
    console.error('❌ UPLOAD FAILED');
    console.error('🚨 Error details:', error);
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('📝 Error message:', error.message);
      
      if (error.message.includes('CORS')) {
        console.error('🔧 CORS ISSUE DETECTED!');
        console.error('Solution: Check CORS configuration on Firebase Storage bucket');
      }
      
      if (error.message.includes('Permission denied')) {
        console.error('🔐 PERMISSION ISSUE DETECTED!');
        console.error('Solution: Check Firebase Storage Rules and authentication');
      }
      
      if (error.message.includes('Network')) {
        console.error('🌐 NETWORK ISSUE DETECTED!');
        console.error('Solution: Check internet connection and Firebase configuration');
      }
    }
    
    throw error;
  }
};

/**
 * Step 2 - Retrieve Report Data
 * Fetches report data from Firestore including all image URLs
 */
export const getReportData = async (reportId: string): Promise<ReportData | null> => {
  try {
    console.log(`Fetching report data for ${reportId}`);
    
    const reportDocRef = doc(db, 'reports', reportId);
    const docSnap = await getDoc(reportDocRef);
    
    if (!docSnap.exists()) {
      console.log('Report not found');
      return null;
    }
    
    const data = docSnap.data();
    return {
      id: reportId,
      images: data.images || [],
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      title: data.title,
      description: data.description
    };
    
  } catch (error) {
    console.error('❌ Error fetching report data:', error);
    throw new Error(`Failed to fetch report: ${(error as Error).message}`);
  }
};

/**
 * Upload multiple images to a report
 */
export const uploadMultipleImages = async (
  files: File[], 
  reportId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> => {
  try {
    console.log(`Uploading ${files.length} images to report ${reportId}`);
    
    const uploadPromises = files.map(async (file, index) => {
      try {
        const url = await uploadImageToReport(file, reportId);
        if (onProgress) {
          onProgress(index + 1, files.length);
        }
        return url;
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        throw error;
      }
    });
    
    const urls = await Promise.all(uploadPromises);
    console.log(`✅ Successfully uploaded ${urls.length} images`);
    return urls;
    
  } catch (error) {
    console.error('❌ Error in batch upload:', error);
    throw error;
  }
};

/**
 * Update report metadata (title, description, etc.)
 */
export const updateReportMetadata = async (
  reportId: string, 
  metadata: Partial<Pick<ReportData, 'title' | 'description'>>
): Promise<void> => {
  try {
    const reportDocRef = doc(db, 'reports', reportId);
    await updateDoc(reportDocRef, {
      ...metadata,
      updatedAt: new Date().toISOString()
    });
    console.log('✅ Report metadata updated');
  } catch (error) {
    console.error('❌ Error updating report metadata:', error);
    throw error;
  }
};

/**
 * Delete an image from a report
 */
export const removeImageFromReport = async (
  reportId: string, 
  imageUrl: string
): Promise<void> => {
  try {
    const reportDocRef = doc(db, 'reports', reportId);
    const docSnap = await getDoc(reportDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const currentImages = data.images || [];
      const updatedImages = currentImages.filter((url: string) => url !== imageUrl);
      
      await updateDoc(reportDocRef, {
        images: updatedImages,
        updatedAt: new Date().toISOString()
      });
      
      console.log('✅ Image removed from report');
    }
  } catch (error) {
    console.error('❌ Error removing image from report:', error);
    throw error;
  }
};

/**
 * Get all reports for the current user (basic listing)
 */
export const getAllReports = async (): Promise<ReportData[]> => {
  try {
    // This is a simplified version - in production you'd want pagination
    // and user-based filtering
    console.log('Fetching all reports...');
    
    // For now, we'll need to implement a proper query
    // This is a placeholder that would need proper implementation
    console.warn('getAllReports not fully implemented - would need Firestore query');
    return [];
    
  } catch (error) {
    console.error('❌ Error fetching reports:', error);
    throw error;
  }
};

/**
 * Validate image file before upload
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 10MB.' };
  }
  
  return { valid: true };
};

/**
 * Generate a unique report ID
 */
export const generateReportId = (): string => {
  return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Export the service object
export const reportService = {
  uploadImageToReport,
  uploadMultipleImages,
  getReportData,
  updateReportMetadata,
  removeImageFromReport,
  getAllReports,
  validateImageFile,
  generateReportId
};

export default reportService;
