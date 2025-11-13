const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true }); // Allow all origins temporarily for MVP

admin.initializeApp();

// Reception Days Functions
exports.createReceptionDay = functions.https.onRequest((req: any, res: any) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { date, category, totalLots, totalWeight } = req.body;
      
      const receptionDay = {
        date,
        category,
        totalLots: totalLots || 0,
        totalWeight: totalWeight || 0,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await admin.firestore().collection('receptionDays').add(receptionDay);
      
      return res.status(200).json({ 
        id: docRef.id,
        ...receptionDay
      });
    } catch (error) {
      console.error('Error creating reception day:', error);
      return res.status(500).json({ error: 'Failed to create reception day' });
    }
  });
});

exports.getReceptionDays = functions.https.onRequest((req: any, res: any) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { category, status } = req.query;
      let query = admin.firestore().collection('receptionDays');
      
      if (category) {
        query = query.where('category', '==', category);
      }
      
      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.orderBy('date', 'desc').get();
      const receptionDays = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return res.status(200).json(receptionDays);
    } catch (error) {
      console.error('Error fetching reception days:', error);
      return res.status(500).json({ error: 'Failed to fetch reception days' });
    }
  });
});

exports.updateReceptionDay = functions.https.onRequest((req: any, res: any) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { id } = req.params;
      const updateData = req.body;
      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      await admin.firestore().collection('receptionDays').doc(id).update(updateData);
      
      return res.status(200).json({ message: 'Reception day updated successfully' });
    } catch (error) {
      console.error('Error updating reception day:', error);
      return res.status(500).json({ error: 'Failed to update reception day' });
    }
  });
});

interface Request {
  method: string;
  body: {
    file: string;
    path: string;
    metadata?: {
      contentType?: string;
      [key: string]: any;
    };
  };
}

interface Response {
  status: (code: number) => Response;
  send: (body: string) => Response;
  json: (body: any) => Response;
}

exports.uploadFile = functions.https.onRequest((req: Request, res: Response) => {
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

export {};