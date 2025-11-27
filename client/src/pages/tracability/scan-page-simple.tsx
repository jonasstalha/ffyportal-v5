import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AvocadoTracking } from "@shared/schema";
import { Loader2, Download, FileText, ExternalLink, QrCode } from "lucide-react";
import { apiRequest } from '../../lib/queryClient';
import { useMultiLots } from "@/hooks/useMultiLots";
import { MultiLot } from "@/lib/multiLotService";

// Simple QR code component for PNG download
const SimpleQRCode = ({ lotNumber }: { lotNumber: string }) => {
  const downloadQRCode = async () => {
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/multi-lot-detail/${lotNumber}`)}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-code-lot-${lotNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download QR code:', error);
    }
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/multi-lot-detail/${lotNumber}`)}`;

  return (
    <div className="text-center space-y-3">
      <img 
        src={qrUrl}
        alt={`QR Code for lot ${lotNumber}`}
        className="mx-auto border rounded"
      />
      <Button onClick={downloadQRCode} variant="outline" size="sm">
        <Download className="h-4 w-4 mr-2" />
        Télécharger QR Code PNG
      </Button>
    </div>
  );
};

export default function ScanPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [lotNumber, setLotNumber] = useState("");
  const [scannedLot, setScannedLot] = useState<AvocadoTracking | null>(null);
  const [scannedMultiLot, setScannedMultiLot] = useState<MultiLot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { lots: multiLots } = useMultiLots();

  // Search for lot
  const handleLookupLot = async () => {
    if (!lotNumber.trim()) return;

    setIsLoading(true);
    setScannedLot(null);
    setScannedMultiLot(null);

    try {
      // Try legacy lot first
      try {
        const result = await apiRequest<AvocadoTracking>('GET', `/api/avocado-tracking/${lotNumber.trim()}`);
        if (result) {
          setScannedLot(result);
          toast({
            title: "Lot trouvé",
            description: `Lot ${lotNumber} chargé avec succès`,
          });
          return;
        }
      } catch (legacyError) {
        console.log('Legacy lot not found, trying multi-lot...');
      }

      // Try multi-lot
      try {
        const multiLot = multiLots.find(lot => 
          lot.lotNumber === lotNumber.trim() || 
          lot.harvest?.lotNumber === lotNumber.trim() ||
          lot.id === lotNumber.trim()
        );
        if (multiLot) {
          setScannedMultiLot(multiLot);
          toast({
            title: "Multi-lot trouvé",
            description: `Multi-lot ${lotNumber} chargé avec succès`,
          });
          return;
        }
      } catch (multiLotError) {
        console.log('Multi-lot not found');
      }

      // If neither found
      toast({
        title: "Lot introuvable",
        description: `Aucun lot trouvé avec le numéro ${lotNumber}`,
        variant: "destructive"
      });

    } catch (error) {
      console.error('Error looking up lot:', error);
      toast({
        title: "Erreur de recherche",
        description: "Impossible de rechercher le lot. Veuillez réessayer.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Download PDF rapport
  const downloadPDF = async () => {
    if (!scannedLot && !scannedMultiLot) return;

    setIsDownloading(true);
    try {
      const lotId = scannedLot 
        ? scannedLot.harvest.lotNumber 
        : (scannedMultiLot?.lotNumber || scannedMultiLot?.harvest?.lotNumber || scannedMultiLot?.id);

      // Try direct PDF download
      const pdfUrl = `${window.location.origin}/api/pdf/download/${lotId}`;
      const response = await fetch(pdfUrl);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rapport-lot-${lotId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast({
          title: "PDF téléchargé",
          description: `Rapport du lot ${lotId} téléchargé avec succès`,
        });
      } else {
        throw new Error('PDF not available');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Erreur PDF",
        description: "Impossible de télécharger le rapport PDF",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // View lot details
  const viewDetails = () => {
    if (scannedLot) {
      setLocation(`/lots/${encodeURIComponent(scannedLot.harvest.lotNumber)}`);
    } else if (scannedMultiLot) {
      const target = scannedMultiLot.lotNumber || scannedMultiLot.harvest?.lotNumber || scannedMultiLot.id;
      setLocation(`/multi-lot-detail/${encodeURIComponent(target)}`);
    }
  };

  const currentLot = scannedLot || scannedMultiLot;
  const lotDisplayNumber = scannedLot 
    ? scannedLot.harvest.lotNumber 
    : (scannedMultiLot?.lotNumber || scannedMultiLot?.harvest?.lotNumber || scannedMultiLot?.id);

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Scan & Rapport PDF</h1>
          <p className="text-muted-foreground">Entrez un numéro de lot pour générer le rapport</p>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Recherche de Lot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Ex: LOT001, AV2024-001..."
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleLookupLot()}
              />
              <Button 
                onClick={handleLookupLot} 
                disabled={isLoading || !lotNumber.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Rechercher'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {currentLot && (
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="text-green-800">
                Lot {lotDisplayNumber}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Lot Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Type:</span> {scannedLot ? 'Legacy' : 'Multi-Lot'}
                </div>
                <div>
                  <span className="font-medium">Date:</span> {
                    scannedLot 
                      ? new Date(scannedLot.harvest.harvestDate).toLocaleDateString()
                      : scannedMultiLot?.harvest?.harvestDate 
                        ? new Date(scannedMultiLot.harvest.harvestDate).toLocaleDateString()
                        : 'Non définie'
                  }
                </div>
                {scannedLot && (
                  <div className="col-span-2">
                    <span className="font-medium">Poids:</span> {scannedLot.packaging.netWeight} kg
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button 
                  onClick={downloadPDF} 
                  disabled={isDownloading}
                  className="w-full"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Télécharger PDF
                </Button>

                <Button 
                  onClick={viewDetails} 
                  variant="outline"
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Voir Détails
                </Button>

                <Button 
                  variant="secondary"
                  className="w-full"
                  disabled
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  QR Code
                </Button>
              </div>

              {/* QR Code Section */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">QR Code pour ce lot</h3>
                <SimpleQRCode lotNumber={lotDisplayNumber || ''} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!currentLot && !isLoading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Entrez un numéro de lot pour commencer</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}