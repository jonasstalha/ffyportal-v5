import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Quagga from "quagga";

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
}

export default function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Initialize the scanner
    if (scannerRef.current) {
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            width: 480,
            height: 320,
            facingMode: "environment", // Use the rear camera if available
          },
        },
        locator: {
          patchSize: "medium",
          halfSample: true,
        },
        decoder: {
          readers: [
            "code_128_reader", // AV-YYMMDD-XXX is most likely a Code 128 format
            "ean_reader",
            "ean_8_reader",
            "code_39_reader",
            "code_39_vin_reader",
            "codabar_reader",
            "upc_reader",
            "upc_e_reader",
          ],
        },
        locate: true,
      }, (err) => {
        if (err) {
          setError("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.");
          setLoading(false);
          return;
        }
        
        setLoading(false);
        Quagga.start();
      });
      
      // Handle barcode detection
      Quagga.onDetected((result) => {
        if (result && result.codeResult) {
          onDetected(result.codeResult.code as string);
          Quagga.stop();
        }
      });
      
      // Cleanup
      return () => {
        Quagga.stop();
      };
    }
  }, [onDetected]);
  
  return (
    <div className="relative border bg-black rounded overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
          <div className="bg-white p-4 rounded max-w-xs text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-red-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-900">{error}</p>
            <p className="text-xs text-gray-500 mt-1">Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur.</p>
          </div>
        </div>
      )}
      
      <div 
        ref={scannerRef} 
        className="w-full h-72"
        style={{ position: 'relative', overflow: 'hidden' }}
      />
      
      <div className="absolute inset-0 pointer-events-none border-2 border-green-400 border-dashed z-10 flex items-center justify-center">
        <div className="w-3/4 h-1/4 border-2 border-red-500"></div>
      </div>
    </div>
  );
}
