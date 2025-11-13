const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true }); // Allow all origins temporarily for MVP

admin.initializeApp();

exports.uploadFile = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }

      const { file, path, metadata } = req.body;
      if (!file || !path) {
        return res.status(400).send("Missing required fields");
      }

      const buffer = Buffer.from(file, "base64");
      const bucket = admin.storage().bucket();
      const fileRef = bucket.file(path);

      await fileRef.save(buffer, {
        metadata: {
          contentType: metadata?.contentType || "application/octet-stream",
          metadata: {
            ...metadata,
          },
        },
      });

      const [url] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-01-2030",
      });

      return res.status(200).json({ url });
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).send("Internal Server Error");
    }
  });
}); 