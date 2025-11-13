import React, { useState } from 'react';
import QRCode from 'qrcode';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

// Using shared Firebase instance from lib/firebase.ts

export default function GenerateQR() {
  const [lotId, setLotId] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      // Create URL for multi-lot-detail route
      const redirectUrl = `${window.location.origin}/multi-lot-detail/${lotId}`;
      const qrDataUrl = await QRCode.toDataURL(redirectUrl);
      const qrStorageRef = ref(storage, `qr-codes/${lotId}.png`);

      await uploadString(qrStorageRef, qrDataUrl, 'data_url');
      const uploadedQrUrl = await getDownloadURL(qrStorageRef);

      setQrUrl(uploadedQrUrl);
    } catch (error) {
      console.error('Error generating QR:', error);
      alert('Failed to generate QR code. Check the lot ID and try again.');
    }
    setLoading(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Generate QR Code for Traceability PDF</h2>
      <input
        type="text"
        placeholder="Enter Lot ID (e.g. lot_12345)"
        value={lotId}
        onChange={(e) => setLotId(e.target.value)}
        className="border p-2 w-full mb-4"
      />
      <button
        onClick={handleGenerate}
        className="bg-blue-600 text-white px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? 'Generating...' : 'Generate QR Code'}
      </button>

      {qrUrl && (
        <div className="mt-4">
          <p className="mb-2">QR Code (clients can scan this):</p>
          <img src={qrUrl} alt="QR Code" className="w-48 h-48" />
          <a href={qrUrl} target="_blank" rel="noopener noreferrer" className="block mt-2 text-blue-500 underline">
            Open QR Image
          </a>
        </div>
      )}
    </div>
  );
}
