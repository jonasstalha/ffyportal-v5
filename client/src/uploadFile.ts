// functions/src/uploadFile.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';

admin.initializeApp();

export const uploadFile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be logged in to upload files'
    );
  }

  const { base64String, fileName, contentType } = data;
  const bucket = admin.storage().bucket('fruitsforyou-10acc.appspot.com');
  const filePath = `logistiqarchifage/${fileName}`;
  const tempFilePath = path.join(os.tmpdir(), fileName);

  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(base64String, 'base64');
    await fs.writeFile(tempFilePath, buffer);

    // Upload to Firebase Storage
    await bucket.upload(tempFilePath, {
      destination: filePath,
      metadata: {
        contentType: contentType,
        metadata: {
          firebaseStorageDownloadTokens: admin.firestore.FieldValue.serverTimestamp().toString()
        }
      }
    });

    // Get the public URL
    const [url] = await bucket.file(filePath).getSignedUrl({
      action: 'read',
      expires: '03-09-2491' // Far future date
    });

    return { url };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error uploading file',
      error
    );
  } finally {
    // Clean up temp file
    await fs.unlink(tempFilePath).catch(console.error);
  }
});