Tools: upload-save-generate

This folder contains a small Node script to demonstrate the workflow:
1) Upload an image to Firebase Storage (Admin SDK)
2) Save returned URL to Firestore under `reports/{reportId}`
3) Generate a PDF containing the images by fetching their HTTP URLs

Setup
1. Create folder and move here (already in repo: tools/)
2. Add your service account JSON as `tools/serviceAccountKey.json` (keep it secret)
3. Run:

```powershell
npm init -y
npm install firebase-admin pdfkit axios
```

Usage
```powershell
node tools/upload-save-generate.js .\path\to\image.jpg my-report-id
```

Notes
- The script marks uploaded files public (calls file.makePublic()). If you prefer signed URLs, edit the script and use `file.getSignedUrl(...)` instead and then save that URL to Firestore.
- For client uploads from the browser, you still need correct bucket CORS; server-side uploads avoid browser CORS.
- Do NOT commit your service account JSON. Add it to .gitignore.
