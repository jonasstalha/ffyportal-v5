import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as fs from 'fs/promises';  // Use fs/promises directly
import * as path from 'path';
import * as os from 'os';

admin.initializeApp();
const storage = admin.storage().bucket('fruitsforyou-10acc.appspot.com');

export const uploadFile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be logged in to upload files'
    );
  }

  const { base64String, fileName, contentType, path: filePath } = data;

  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(base64String, 'base64');

    // Create a temporary file
    const tempFilePath = path.join(os.tmpdir(), fileName);
    await fs.writeFile(tempFilePath, buffer);

    // Upload to Firebase Storage
    await storage.upload(tempFilePath, {
      destination: filePath,
      metadata: {
        contentType: contentType,
        metadata: {
          firebaseStorageDownloadTokens: admin.firestore.FieldValue.serverTimestamp().toString()
        }
      }
    });

    // Get the download URL
    const file = storage.file(filePath);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-09-2491' // Far future date
    });

    // Clean up temporary file
    await fs.unlink(tempFilePath);

    return { url };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error uploading file',
      error
    );
  }
});