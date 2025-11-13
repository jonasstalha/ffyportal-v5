import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, Download } from "lucide-react";
import QRCode from "react-qr-code"; // ✅

const STATIC_REPORTS = [
  {
    id: 1,
    title: "Rapport Mensuel - Mars 2024",
    type: "monthly",
    date: "2024-03-31",
    description: "Rapport mensuel des activités et des statistiques",
    downloadUrl: "https://firebasestorage.googleapis.com/v0/b/fruitsforyou-10acc.firebasestorage.app/o/files%2FlSD90IUAsbamktZSNJWT8xuUgNm1%2FRapport_Production_Avocats_2025-05-17.pdf?alt=media&token=23b0300d-525c-4647-b601-cc73dead5fe7",
  },
  {
    id: 2,
    title: "Rapport de Traçabilité - Lot 001",
    type: "traceability",
    date: "2024-03-15",
    description: "Rapport détaillé de traçabilité pour le lot 001",
    downloadUrl: "#",
  },
  {
    id: 3,
    title: "Rapport de Qualité - Avril 2024",
    type: "quality",
    date: "2024-04-01",
    description: "Rapport d'analyse de qualité des produits",
    downloadUrl: "#",
  },
];

const SAMPLE_LOTS = [
  { id: 1, lotNumber: "LOT-001" },
  { id: 2, lotNumber: "LOT-002" },
  { id: 3, lotNumber: "LOT-003" },
];

const GenerateQR = ({ lotId }: { lotId: string }) => (
  <div className="flex flex-col items-center p-4 bg-gray-100 rounded">
    <QRCode value={lotId} size={100} />
    <span className="mt-2 text-sm text-gray-600">QR: {lotId}</span>
  </div>
);

const ReportsPage = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredReports = STATIC_REPORTS.filter(
    (report) =>
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Rapports</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            placeholder="Rechercher un rapport..."
            className="pl-10 w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.map((report) => (
          <Card key={report.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{report.title}</CardTitle>
                <FileText className="h-5 w-5 text-neutral-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-neutral-500">{report.description}</p>
                <div className="flex items-center justify-between text-sm text-neutral-500">
                  <span>{new Date(report.date).toLocaleDateString()}</span>
                  <span className="capitalize">{report.type}</span>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(report.downloadUrl, "_blank")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Lots avec QR Codes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SAMPLE_LOTS.map((lot) => (
            <Card key={lot.id}>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="font-medium">Lot Number: {lot.lotNumber}</div>
                  <GenerateQR lotId={lot.lotNumber} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
