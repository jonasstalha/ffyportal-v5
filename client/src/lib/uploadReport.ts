import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, firestore } from './firebase';

/**
 * Uploads a PDF report to Firebase Storage and saves metadata to Firestore.
 *
 * @param {string} lotId - The ID of the lot.
 * @param {Blob} pdfBlob - The PDF file as a Blob.
 * @returns {Promise<string>} - The public URL of the uploaded PDF.
 */
export async function uploadReport(lotId: string, pdfBlob: Blob): Promise<string> {
  try {
    // Define the storage path
    const storagePath = `reports/${lotId}.pdf`;
    const storageRef = ref(storage, storagePath);

    // Upload the PDF to Firebase Storage
    await uploadBytes(storageRef, pdfBlob);

    // Get the public download URL
    const pdfUrl = await getDownloadURL(storageRef);

    // Save metadata to Firestore under quality_reports
    const reportsCollection = collection(firestore, 'quality_reports');
    await addDoc(reportsCollection, {
      lotId,
      pdfUrl,
      createdAt: serverTimestamp(),
    });

    // Return the public URL
    return pdfUrl;
  } catch (error) {
    console.error('Error uploading report:', error);
    throw new Error('Failed to upload report. Please try again.');
  }
}