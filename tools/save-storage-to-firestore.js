/*
Script: save-storage-to-firestore.js

Purpose: scan Firebase Storage under a prefix, produce public or signed download URLs for all files found, and save the array of URLs into Firestore at `reports/{reportId}`.

Usage:
  1) Place your service account JSON at tools/serviceAccountKey.json
  2) npm install firebase-admin
  3) node tools/save-storage-to-firestore.js <prefix> <reportId> [makePublic]

Examples:
  node tools/save-storage-to-firestore.js "reports/my-report-123/" my-report-123 true
  node tools/save-storage-to-firestore.js "quality_control/calibres/KWuGBT0FJw9RNTuaBBNF/12/" my-report-123 false

Note: If makePublic is true, files will be made public (file.makePublic()). If false, script attempts to generate signed URLs (7 days).
*/

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const svcPath = path.resolve(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(svcPath)) {
  console.error('Missing service account JSON at tools/serviceAccountKey.json');
  process.exit(1);
}
const serviceAccount = require(svcPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: serviceAccount.project_id + '.appspot.com'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function getFilesUrls(prefix, makePublic = false) {
  console.log('Listing files with prefix:', prefix);
  const [files] = await bucket.getFiles({ prefix });
  console.log(`Found ${files.length} file(s)`);

  const urls = [];
  for (const file of files) {
    try {
      let url;
      if (makePublic) {
        console.log('Making public:', file.name);
        await file.makePublic();
        url = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(file.name)}`;
      } else {
        // Signed URL valid for 7 days
        const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
        try {
          const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: expiresAt });
          url = signedUrl;
        } catch (signedErr) {
          console.warn('Signed URL failed for', file.name, signedErr.message);
          // Fallback to public URL (may not work if not public)
          url = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(file.name)}`;
        }
      }
      urls.push({ path: file.name, url });
      console.log('->', file.name, url);
    } catch (err) {
      console.error('Error processing file', file.name, err.message);
    }
  }

  return urls;
}

async function saveUrlsToFirestore(reportId, urls) {
  const docRef = db.collection('reports').doc(reportId);
  const urlStrings = urls.map(u => u.url);
  await docRef.set({ images: urlStrings }, { merge: true });
  console.log(`Saved ${urlStrings.length} URLs to reports/${reportId}`);
}

(async () => {
  try {
    const prefix = process.argv[2];
    const reportId = process.argv[3];
    const makePublicArg = process.argv[4];
    if (!prefix || !reportId) {
      console.error('Usage: node tools/save-storage-to-firestore.js <prefix> <reportId> [makePublic]');
      process.exit(1);
    }
    const makePublic = !!(makePublicArg && (makePublicArg === 'true' || makePublicArg === '1'));

    const urls = await getFilesUrls(prefix, makePublic);
    if (urls.length === 0) {
      console.warn('No files found for prefix, nothing to save');
      process.exit(0);
    }

    await saveUrlsToFirestore(reportId, urls);
    console.log('Done');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
