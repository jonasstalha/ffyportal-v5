import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';

const LotLanding: React.FC = () => {
  // Use window.location.search to read query params (wouter doesn't parse queries)
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const params = new URLSearchParams(search || '');
  const lotId = params.get('lotId');
  const lotNumber = params.get('lotNumber');
  const [, setLocation] = useLocation();

  const handleOpenLot = () => {
    if (!lotId) return;
    // Navigate to the lot detail route used in the app
    setLocation(`/lots/${lotId}`);
  };

  const handleDownloadRapport = async () => {
    if (!lotId) return;
    const url = `${window.location.origin}/production/public/rapport/${lotId}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-xl w-full bg-white rounded-lg shadow p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Rapport du Lot</h1>
        <p className="text-sm text-gray-600 mb-6">{lotNumber ? `Lot: ${lotNumber}` : 'Lot non spécifié'}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleDownloadRapport} className="bg-green-600 text-white">
            Télécharger le rapport
          </Button>
          <Button onClick={handleOpenLot} className="bg-blue-600 text-white">
            Ouvrir la fiche du lot
          </Button>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Scannez ce QR depuis l'application de scan de votre entreprise pour accéder rapidement au rapport ou à la fiche du lot.
        </div>
      </div>
    </div>
  );
};

export default LotLanding;
