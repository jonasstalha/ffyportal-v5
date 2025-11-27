import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Camera } from "lucide-react";
import { Lot } from "@shared/schema";

interface BarcodeDisplayProps {
  barcodeData: {
    barcodeImage: string;
    lotNumber: string;
    farmName: string;
    harvestDate: string;
  };
  lot: Lot;
  farmName: string;
}

export default function BarcodeDisplay({ barcodeData, lot, farmName }: BarcodeDisplayProps) {
  const [cameraActive, setCameraActive] = useState(false);
  
  const handleActivateCamera = () => {
    setCameraActive(true);
  };
  
  const handleDeactivateCamera = () => {
    setCameraActive(false);
  };
  
  // Build a landing URL that scanner apps can open on mobile
  const landingUrl = (() => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const params = new URLSearchParams();
      if (lot?.id) params.set('lotId', lot.id);
      if (barcodeData.lotNumber) params.set('lotNumber', barcodeData.lotNumber);
      return `${origin}/qr/lot-landing?${params.toString()}`;
    } catch (e) {
      return `/qr/lot-landing?lotId=${lot?.id || ''}`;
    }
  })();

  return (
    <>
      {/* Barcode Display */}
      <div className="bg-white border rounded p-6 mb-6 w-full text-center">
        {barcodeData.barcodeImage ? (
          <a href={landingUrl} target="_blank" rel="noopener noreferrer">
            <img 
              src={barcodeData.barcodeImage} 
              alt={`Code-barres pour ${barcodeData.lotNumber}`} 
              className="mx-auto mb-4"
            />
          </a>
        ) : (
          <div className="flex items-center justify-center h-24 mb-4">
            {/* generate a QR code image via external service as fallback */}
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(landingUrl)}`} alt="QR code" className="mx-auto mb-4" />
          </div>
        )}
        <div className="text-xs text-gray-500 mt-2 break-words">{landingUrl}</div>
        <div className="font-mono text-lg font-bold">{barcodeData.lotNumber}</div>
        <div className="text-neutral-500 text-sm">{farmName} · {barcodeData.harvestDate}</div>
      </div>
      
      {/* Scanner Interface */}
      <div className="border rounded p-4 bg-neutral-50 w-full mb-6">
        <h3 className="font-medium mb-4 text-center">Scanner un Code-barres</h3>
        
        {cameraActive ? (
          <div className="mb-4">
            <div className="bg-neutral-800 h-48 rounded flex items-center justify-center">
              <Camera className="text-white h-12 w-12 opacity-25" />
            </div>
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={handleDeactivateCamera}
            >
              Désactiver la Caméra
            </Button>
          </div>
        ) : (
          <div className="bg-neutral-800 h-48 rounded flex items-center justify-center mb-4">
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white"
              onClick={handleActivateCamera}
            >
              <Camera className="mr-2 h-4 w-4" />
              Activer la Caméra
            </Button>
          </div>
        )}
      </div>
      
      {/* Manual Entry */}
      <div className="w-full">
        <h3 className="font-medium mb-4">Ou Entrez le Code Manuellement</h3>
        <div className="flex">
          <input 
            type="text" 
            placeholder="AV-YYMMDD-XXX" 
            className="flex-grow p-2 border border-neutral-300 rounded-l focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
          <Button className="bg-primary-500 text-white rounded-r">
            Rechercher
          </Button>
        </div>
      </div>
    </>
  );
}
