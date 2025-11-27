/*
Simple tool: upload a local image to Firebase Storage (Admin SDK), save URL into Firestore under reports/{reportId}, then generate a PDF using the stored URLs.
Usage:
  1) Place your service account JSON as tools/serviceAccountKey.json
  2) npm init -y && npm install firebase-admin pdfkit axios
  3) node tools/upload-save-generate.js ./path/to/image.jpg my-report-id

Notes:
- This script makes uploaded files public (file.makePublic()). If you prefer signed URLs, uncomment the getSignedUrl block.
- Do NOT commit your service account JSON to git. Add tools/serviceAccountKey.json to .gitignore.
*/

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const axios = require('axios');

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

async function uploadFileAndSaveUrl(localFilePath, reportId) {
  const fileName = path.basename(localFilePath);
  const dest = `reports/${reportId}/${Date.now()}_${fileName}`;
  console.log('Uploading to', dest);

  await bucket.upload(localFilePath, {
    destination: dest,
    metadata: {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000'
    }
  });

  const file = bucket.file(dest);

  // Option A: Make public and use public URL
  await file.makePublic();
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(dest)}`;
  console.log('Public URL:', publicUrl);

  // Option B: Get signed URL (uncomment if you prefer signed URLs)
  // const expiresAt = Date.now() + 7 * 24 * 3600 * 1000; // 7 days
  // const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: expiresAt });
  // console.log('Signed URL:', signedUrl);

  // Save to Firestore
  const docRef = db.collection('reports').doc(reportId);
  await docRef.set({ images: admin.firestore.FieldValue.arrayUnion(publicUrl) }, { merge: true });

  return publicUrl;
}

async function generatePDF(reportId, outPath = 'report.pdf') {
  const docSnap = await db.collection('reports').doc(reportId).get();
  if (!docSnap.exists) throw new Error('Report not found: ' + reportId);
  const data = docSnap.data() || {};
  const images = data.images || [];

  if (!images.length) throw new Error('No images found for report: ' + reportId);

  const doc = new PDFDocument({ autoFirstPage: false });
  doc.pipe(fs.createWriteStream(outPath));

  doc.addPage({ margin: 50 });
  doc.fontSize(20).text(`Report ${reportId}`, { align: 'center' });
  doc.moveDown();

  for (const url of images) {
    try {
      const resp = await axios.get(url, { responseType: 'arraybuffer' });
      const imgBuffer = Buffer.from(resp.data, 'binary');

      // Add a page per image
      doc.addPage();
      doc.image(imgBuffer, { fit: [500, 700], align: 'center', valign: 'center' });
      doc.moveDown();
      doc.fontSize(8).text(url, { align: 'center' });
    } catch (err) {
      console.error('Failed to fetch or insert image:', url, err.message);
    }
  }

  doc.end();
  console.log('PDF generated at', outPath);
}

(async () => {
  try {
    const localFile = process.argv[2];
    const reportId = process.argv[3] || 'test-report-1';
    if (!localFile) {
      console.error('Usage: node tools/upload-save-generate.js <localFilePath> [reportId]');
      process.exit(1);
    }
    if (!fs.existsSync(localFile)) {
      console.error('Local file not found:', localFile);
      process.exit(1);
    }

    const url = await uploadFileAndSaveUrl(localFile, reportId);
    console.log('Uploaded and saved URL:', url);

    await generatePDF(reportId, `report-${reportId}.pdf`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
