import { useRoute } from "wouter";
import { useEffect, useState } from "react";

export default function LotBarcodePage() {
  const [match, params] = useRoute("/lots/:id/barcode");
  const [lot, setLot] = useState<any>(null);
  const lotId = params?.id;

  useEffect(() => {
    // Fetch lot data if needed, or just use the id for barcode
    // Example: fetch(`/api/lots/${lotId}`)
    setLot({ id: lotId });
  }, [lotId]);

  if (!lotId) return <div>Lot ID not found in URL.</div>;

  return (
    <div style={{ padding: 32 }}>
      <h1>Impression du code-barres pour le lot {lotId}</h1>
      {/* Replace with your barcode component or image */}
      <div style={{ margin: '32px 0', fontSize: 32, letterSpacing: 8, border: '1px solid #ccc', padding: 16 }}>
        [Barcode for Lot {lotId}]
      </div>
      <button onClick={() => window.print()}>Imprimer</button>
    </div>
  );
}
