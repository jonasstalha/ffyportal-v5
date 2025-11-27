import { Router } from 'express';
import { db } from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

// Track QR code scan
router.post('/track-scan', async (req, res) => {
  try {
    const { lotNumber, scanType, timestamp, userAgent } = req.body;

    if (!lotNumber || !scanType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Record the scan in Firestore
    await db.collection('scan_analytics').add({
      lotNumber,
      scanType,
      timestamp: timestamp || new Date().toISOString(),
      userAgent,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Update scan statistics
    const statsRef = db.collection('lot_scan_stats').doc(lotNumber);
    await statsRef.set({
      scanCount: FieldValue.increment(1),
      lastScanDate: timestamp || new Date().toISOString(),
      lastScanType: scanType,
    }, { merge: true });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error tracking scan:', error);
    res.status(500).json({ error: 'Failed to track scan' });
  }
});

// Get scan statistics for a lot
router.get('/scan-stats/:lotId', async (req, res) => {
  try {
    const { lotId } = req.params;
    
    const statsDoc = await db.collection('lot_scan_stats').doc(lotId).get();
    
    if (!statsDoc.exists) {
      return res.json({
        scanCount: 0,
        lastScanDate: null,
      });
    }

    const stats = statsDoc.data();
    res.json({
      scanCount: stats?.scanCount || 0,
      lastScanDate: stats?.lastScanDate || null,
    });
  } catch (error) {
    console.error('Error fetching scan stats:', error);
    res.status(500).json({ error: 'Failed to fetch scan statistics' });
  }
});

export default router; 