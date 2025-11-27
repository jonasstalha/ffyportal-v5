import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale/fr';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FilePlus, Printer, RefreshCw, Check, Save, ExternalLink } from 'lucide-react';
import logo from "../../../assets/icon.png"

const LOGO_PATH = logo

// Function to convert image to base64
const getBase64Image = async (url: string): Promise<string> => {
  const fallback = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  try {
    const response = await fetch(url);
    if (!response.ok) return fallback;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return fallback;
  }
};

// Define row type
interface ExpeditionRow {
  palletNo: number;
  palletPROD: string;
  nbrColis: string;
  produitVariete: string;
  calibre: string;
  temperatureProduit: string;
  etatPalette: string;
  conformiteEtiquettes: string;
  dessiccation: string;
}

interface HeaderData {
  date: string;
  heure: string;
  transporteur: string;
  matricule: string;
  tempCamion: string;
  hygiene: 'Bon' | 'Mauvais' | '';
  odeur: 'Bon' | 'Mauvais' | '';
  destination: string;
  thermokingEtat: 'Bon' | 'Mauvais' | '';
  lotClient: string;
  clientName: string;
}

interface ExpeditionFormData {
  id?: string;
  name: string;
  date: string;
  headerData: HeaderData;
  rows: ExpeditionRow[];
  createdAt?: string;
  updatedAt?: string;
  pdfURL?: string;
}

const productVarieties = ['Hass', 'Fuerte', 'Pinkerton', 'Reed', 'Zutano', 'Bacon', 'Gwen', 'Lamb Hass'];
const etatPaletteOptions = ['C', 'NC'];
const conformiteOptions = ['C', 'NC'];

const createEmptyRow = (index: number): ExpeditionRow => ({
  palletNo: index + 1,
  palletPROD: '',
  nbrColis: '',
  produitVariete: '',
  calibre: '',
  temperatureProduit: '',
  etatPalette: '',
  conformiteEtiquettes: '',
  dessiccation: ''
});

export default function FichedExpidition() {
  const [rows, setRows] = useState<ExpeditionRow[]>([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessageText, setSuccessMessageText] = useState('');
  const [expeditionId, setExpeditionId] = useState<string | null>(null);
  const [headerData, setHeaderData] = useState<HeaderData>({
    date: format(new Date(), 'yyyy-MM-dd'),
    heure: format(new Date(), 'HH:mm'),
    transporteur: '',
    matricule: '',
    tempCamion: '',
    hygiene: '',
    odeur: '',
    destination: '',
    thermokingEtat: '',
    lotClient: '',
    clientName: ''
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (id) {
      loadExpeditionData(id);
    } else {
      const savedData = localStorage.getItem('ficheExpeditionData');
      if (savedData) {
        try {
          setRows(JSON.parse(savedData));
        } catch (e) {
          initializeEmptyRows();
        }
      } else {
        initializeEmptyRows();
      }
    }
  }, []);

  const loadExpeditionData = async (id: string) => {
    try {
      const savedExpeditions = localStorage.getItem('savedExpeditions');
      if (savedExpeditions) {
        const expeditionsArray: ExpeditionFormData[] = JSON.parse(savedExpeditions);
        const foundExpedition = expeditionsArray.find(exp => exp.id === id);
        if (foundExpedition) {
          setExpeditionId(id);
          setHeaderData(foundExpedition.headerData);
          setRows(foundExpedition.rows);
          setSuccessMessageText('Fiche d\'expédition chargée avec succès!');
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);
          const url = new URL(window.location.href);
          url.searchParams.set('id', id);
          window.history.replaceState({}, '', url);
        }
      }
    } catch (error) {
      alert('Erreur lors du chargement de la fiche d\'expédition.');
    }
  };

  useEffect(() => {
    if (rows.length > 0) {
      localStorage.setItem('ficheExpeditionData', JSON.stringify(rows));
    }
  }, [rows]);

  const initializeEmptyRows = () => {
    const emptyRows = Array(26).fill(null).map((_, index) => createEmptyRow(index));
    setRows(emptyRows);
  };

  const handleChange = (rowIndex: number, field: keyof ExpeditionRow, value: string) => {
    const updatedRows = [...rows];
    updatedRows[rowIndex] = { ...updatedRows[rowIndex], [field]: value };
    setRows(updatedRows);
  };

  const handleHeaderChange = (field: keyof HeaderData, value: string) => {
    setHeaderData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const hasAnyData = rows.some(row =>
      row.nbrColis || row.produitVariete || row.calibre || row.temperatureProduit ||
      row.etatPalette || row.conformiteEtiquettes || row.dessiccation || row.palletPROD
    );
    const hasHeaderData = headerData.transporteur && headerData.destination;
    return hasAnyData && hasHeaderData;
  };

const generatePDF = async () => {
  setIsGeneratingPDF(true);
  try {
    console.log('Generating PDF, expedition ID:', expeditionId);
    if (!validateForm()) {
      alert("Veuillez remplir au moins une ligne et les informations principales (transporteur et destination).");
      return;
    }

    // Generate the complete PDF with all the formatting and data
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const logoBase64 = await getBase64Image(LOGO_PATH);
    
    // Set up page and colors
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const lightGreen = [198, 224, 180];
    const darkGreen = [76, 175, 80];
    const gray = [75, 75, 75];

    // Add logo with simplified positioning and size
    doc.addImage(logoBase64, 'PNG', 10, 5, 20, 20);

    // Add header title section with minimal styling
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Fiche d\'expédition', 40, 15);

    // Add right section with MP ENR info in a simple box
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text('MP ENR 06', 160, 12);
    doc.text('Version : 01', 160, 17);
    doc.text('Date : 01/07/2023', 160, 22);

    // Add a simple line separator
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(10, 30, pageWidth - 10, 30);
    
    // Create the main form sections with improved spacing
    const startY = 35;
    doc.setFontSize(9);
    
    // First row of fields with enhanced styling
    // Date field
    doc.setFillColor(250, 250, 250);
    doc.rect(10, startY, 35, 12, 'F');
    doc.rect(10, startY, 35, 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]); // Green title
    doc.text('Date expédition :', 12, startY + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(headerData.date || '', 12, startY + 9);
    
    // Hour field with similar styling
    doc.setFillColor(250, 250, 250);
    doc.rect(45, startY, 25, 12, 'F');
    doc.rect(45, startY, 25, 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]); // Green title
    doc.text('Heure:', 47, startY + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(headerData.heure || '', 47, startY + 9);
    
    // Transporter field with enhanced styling
    doc.setFillColor(250, 250, 250);
    doc.rect(70, startY, 45, 12, 'F');
    doc.rect(70, startY, 45, 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]); // Green title
    doc.text('Nom du', 72, startY + 4);
    doc.text('transporteur :', 72, startY + 8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(headerData.transporteur || '', 72, startY + 11);
    
    // Registration field with enhanced styling
    doc.setFillColor(250, 250, 250);
    doc.rect(115, startY, 45, 12, 'F');
    doc.rect(115, startY, 45, 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]); // Green title
    doc.text('Matricule', 117, startY + 4);
    doc.text('camion :', 117, startY + 8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(headerData.matricule || '', 117, startY + 11);
    
    doc.rect(160, startY, 40, 12); // Temperature field
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]); // Green title
    doc.text('T° camion :', 162, startY + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(`${headerData.tempCamion || ''}°C`, 162, startY + 9);
    
    // Second row - Checkboxes section
    const checkY = startY + 12;
    const checkboxSize = 3;
    
    // Hygiene section
    doc.rect(10, checkY, 60, 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]); // Green title
    doc.text('Hygiène du camion :', 12, checkY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    
    // Draw checkboxes for Hygiene
    doc.rect(45, checkY + 3, checkboxSize, checkboxSize);
    doc.text('Bon', 50, checkY + 5);
    doc.rect(45, checkY + 7, checkboxSize, checkboxSize);
    doc.text('Mauvais', 50, checkY + 9);
    
    if (headerData.hygiene === 'Bon') {
      doc.line(45, checkY + 3, 48, checkY + 6);
      doc.line(48, checkY + 3, 45, checkY + 6);
    }
    if (headerData.hygiene === 'Mauvais') {
      doc.line(45, checkY + 7, 48, checkY + 10);
      doc.line(48, checkY + 7, 45, checkY + 10);
    }
    
    // Odeur section
    doc.rect(70, checkY, 45, 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]); // Green title
    doc.text('Odeur :', 72, checkY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    
    // Draw checkboxes for Odeur
    doc.rect(90, checkY + 3, checkboxSize, checkboxSize);
    doc.text('Bon', 95, checkY + 5);
    doc.rect(90, checkY + 7, checkboxSize, checkboxSize);
    doc.text('Mauvais', 95, checkY + 9);
    
    if (headerData.odeur === 'Bon') {
      doc.line(90, checkY + 3, 93, checkY + 6);
      doc.line(93, checkY + 3, 90, checkY + 6);
    }
    if (headerData.odeur === 'Mauvais') {
      doc.line(90, checkY + 7, 93, checkY + 10);
      doc.line(93, checkY + 7, 90, checkY + 10);
    }
    
    // Client Name
    doc.rect(115, checkY, 45, 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]); // Green title
    doc.text('Nom client :', 117, checkY + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(headerData.clientName || '', 117, checkY + 9);
    
    // Destination
    doc.rect(160, checkY, 40, 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]); // Green title
    doc.text('Destination :', 162, checkY + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(headerData.destination || '', 162, checkY + 9);
    
    // Thermo king status
    doc.rect(10, checkY + 12, 190, 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]); // Green title
    doc.text('État de fonctionnement du', 12, checkY + 18);
    doc.text('thermo king :', 12, checkY + 22);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray[0], gray[1], gray[2]);
    
    // Draw checkboxes for Thermo King
    doc.rect(70, checkY + 17, checkboxSize, checkboxSize);
    doc.text('Bon', 75, checkY + 19);
    doc.rect(90, checkY + 17, checkboxSize, checkboxSize);
    doc.text('Mauvais', 95, checkY + 19);
    
    if (headerData.thermokingEtat === 'Bon') {
      doc.line(70, checkY + 17, 73, checkY + 20);
      doc.line(73, checkY + 17, 70, checkY + 20);
    }
    if (headerData.thermokingEtat === 'Mauvais') {
      doc.line(90, checkY + 17, 93, checkY + 20);
      doc.line(93, checkY + 17, 90, checkY + 20);
    }
    
    // Data table with enhanced styling
    const tableY = checkY + 35;
    
    // Add a decorative separator before the table
    doc.setDrawColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.setLineWidth(0.5);
    doc.line(10, tableY - 5, pageWidth - 10, tableY - 5);
    
    const filteredRows = rows.filter(row => 
      row.nbrColis || row.produitVariete || row.calibre || 
      row.temperatureProduit || row.etatPalette || 
      row.conformiteEtiquettes || row.dessiccation || row.palletPROD
    );
    
    // Apply enhanced table styling using autoTable with the new column
    autoTable(doc, {
      startY: tableY,
      margin: { left: 10, right: 10 },
      head: [[
        'N° de palette',
        'N° Palette PROD', // NOUVELLE COLONNE AJOUTÉE
        'NBR de Colis',
        'Produit/Variété',
        'Calibre',
        'T° produit',
        'État de la palette',
        'Conformité étiquettes (C/NC)',
        'Décision (C/NC)'
      ]],
      body: filteredRows.map((row, index) => [
        (index + 1).toString(),
        row.palletPROD || '', // DONNÉE DE LA NOUVELLE COLONNE
        row.nbrColis || '',
        row.produitVariete || '',
        row.calibre || '',
        row.temperatureProduit ? `${row.temperatureProduit}°C` : '',
        row.etatPalette || '',
        row.conformiteEtiquettes || '',
        row.dessiccation || ''
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
        textColor: [0, 0, 0],
        minCellHeight: 6,
        valign: 'middle',
      },
      headStyles: {
        fillColor: lightGreen,
        textColor: [0, 0, 0],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 2,
      },
      columnStyles: {
        0: { fillColor: lightGreen, halign: 'center', fontStyle: 'bold', cellWidth: 15 },
        1: { halign: 'center', cellWidth: 20 }, // Style pour la nouvelle colonne N° Palette PROD
        2: { cellWidth: 15 }, // NBR de Colis
        3: { cellWidth: 25 }, // Produit/Variété
        4: { cellWidth: 15 }, // Calibre
        5: { cellWidth: 15 }, // T° produit
        6: { cellWidth: 20 }, // État de la palette
        7: { cellWidth: 25 }, // Conformité étiquettes
        8: { cellWidth: 35 }  // Décision
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255]
      },
      didDrawPage: function(data: any) {
        // Add page number
        doc.setFontSize(8);
        doc.text(
          `Page ${data.pageNumber}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        );
      }
    });
    
    // Add simple signature section
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    
    // Left signature
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text('Visa de Responsable de chargement', 15, finalY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text('Signature et cachet', 15, finalY + 5);
    
    // Right signature
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text('Visa de Responsable Qualité', pageWidth - 90, finalY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text('Signature et cachet', pageWidth - 90, finalY + 5);
    
    // Generate file name and download
    const fileName = `Fiche_Expedition_${format(new Date(), 'yyyyMMdd')}_${headerData.transporteur.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);

    setSuccessMessageText('PDF généré avec succès!');
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert("Une erreur s'est produite lors de la génération du PDF.");
  } finally {
    setIsGeneratingPDF(false);
  }
};
  const saveExpedition = async () => {
    if (!validateForm()) {
      alert("Veuillez remplir au moins une ligne et les informations principales (transporteur et destination).");
      return null;
    }

    setIsSaving(true);
    try {
      const newExpeditionId = expeditionId || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setExpeditionId(newExpeditionId);

      const expeditionData: ExpeditionFormData = {
        id: newExpeditionId,
        name: `Expedition_${headerData.transporteur}_${format(new Date(headerData.date), 'yyyy-MM-dd')}`,
        date: headerData.date,
        headerData,
        rows,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const savedExpeditions = localStorage.getItem('savedExpeditions');
      let expeditionsArray: ExpeditionFormData[] = savedExpeditions ? JSON.parse(savedExpeditions) : [];
      
      const existingIndex = expeditionsArray.findIndex(exp => exp.id === newExpeditionId);
      if (existingIndex >= 0) {
        expeditionsArray[existingIndex] = expeditionData;
      } else {
        expeditionsArray.push(expeditionData);
      }

      localStorage.setItem('savedExpeditions', JSON.stringify(expeditionsArray));

      const url = new URL(window.location.href);
      url.searchParams.set('id', newExpeditionId);
      window.history.pushState({}, '', url);

      setSuccessMessageText('Fiche d\'expédition sauvegardée avec succès!');
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);

      return newExpeditionId;
    } catch (error) {
      console.error('Error saving expedition:', error);
      alert("Une erreur s'est produite lors de la sauvegarde.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const goToHistory = () => {
    window.location.href = '/logistique/history';
  };

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-6 border-b border-gray-200">
          <div className="space-y-4 w-full">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <FilePlus className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Fiche d'Expédition</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>

            {/* Header Form - Organized in tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                    <input
                      type="date"
                      value={headerData.date}
                      onChange={(e) => handleHeaderChange('date', e.target.value)}
                      className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Heure *</label>
                    <input
                      type="time"
                      value={headerData.heure}
                      onChange={(e) => handleHeaderChange('heure', e.target.value)}
                      className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transporteur *</label>
                  <input
                    type="text"
                    value={headerData.transporteur}
                    onChange={(e) => handleHeaderChange('transporteur', e.target.value)}
                    placeholder="Nom du transporteur"
                    className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Matricule</label>
                  <input
                    type="text"
                    value={headerData.matricule}
                    onChange={(e) => handleHeaderChange('matricule', e.target.value)}
                    placeholder="Matricule du camion"
                    className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Température</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={headerData.tempCamion}
                        onChange={(e) => handleHeaderChange('tempCamion', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-10"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">°C</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
                    <input
                      type="text"
                      value={headerData.destination}
                      onChange={(e) => handleHeaderChange('destination', e.target.value)}
                      placeholder="Destination"
                      className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lot Client</label>
                    <input
                      type="text"
                      value={headerData.lotClient}
                      onChange={(e) => handleHeaderChange('lotClient', e.target.value)}
                      placeholder="Lot client"
                      className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom Client</label>
                    <input
                      type="text"
                      value={headerData.clientName}
                      onChange={(e) => handleHeaderChange('clientName', e.target.value)}
                      placeholder="Nom du client"
                      className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hygiène du camion</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="Bon"
                          checked={headerData.hygiene === 'Bon'}
                          onChange={(e) => handleHeaderChange('hygiene', e.target.value)}
                          className="form-radio text-green-600 focus:ring-green-500"
                        />
                        <span className="ml-2">Bon</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="Mauvais"
                          checked={headerData.hygiene === 'Mauvais'}
                          onChange={(e) => handleHeaderChange('hygiene', e.target.value)}
                          className="form-radio text-red-600 focus:ring-red-500"
                        />
                        <span className="ml-2">Mauvais</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Odeur</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="Bon"
                          checked={headerData.odeur === 'Bon'}
                          onChange={(e) => handleHeaderChange('odeur', e.target.value)}
                          className="form-radio text-green-600 focus:ring-green-500"
                        />
                        <span className="ml-2">Bon</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="Mauvais"
                          checked={headerData.odeur === 'Mauvais'}
                          onChange={(e) => handleHeaderChange('odeur', e.target.value)}
                          className="form-radio text-red-600 focus:ring-red-500"
                        />
                        <span className="ml-2">Mauvais</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">État Thermo King</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="Bon"
                          checked={headerData.thermokingEtat === 'Bon'}
                          onChange={(e) => handleHeaderChange('thermokingEtat', e.target.value)}
                          className="form-radio text-green-600 focus:ring-green-500"
                        />
                        <span className="ml-2">Bon</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="Mauvais"
                          checked={headerData.thermokingEtat === 'Mauvais'}
                          onChange={(e) => handleHeaderChange('thermokingEtat', e.target.value)}
                          className="form-radio text-red-600 focus:ring-red-500"
                        />
                        <span className="ml-2">Mauvais</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 mt-6 md:mt-0 md:ml-6">
            <button
              onClick={saveExpedition}
              disabled={isSaving}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all disabled:bg-gray-400"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save size={20} />
                  {expeditionId ? 'Mettre à jour' : 'Sauvegarder'}
                </>
              )}
            </button>

            <button
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all disabled:bg-gray-400"
            >
              {isGeneratingPDF ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Génération...
                </>
              ) : (
                <>
                  <FilePlus size={20} />
                  Générer PDF
                </>
              )}
            </button>

            <button
              onClick={goToHistory}
              className="flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-all"
            >
              <ExternalLink size={20} />
              Historique
            </button>

            <button
              onClick={() => {
                if (window.confirm("Réinitialiser le formulaire?")) {
                  initializeEmptyRows();
                  setHeaderData({
                    date: format(new Date(), 'yyyy-MM-dd'),
                    heure: format(new Date(), 'HH:mm'),
                    transporteur: '',
                    matricule: '',
                    tempCamion: '',
                    hygiene: '',
                    odeur: '',
                    destination: '',
                    thermokingEtat: '',
                    lotClient: '',
                    clientName: ''
                  });
                  setExpeditionId(null);
                  window.history.pushState({}, '', window.location.pathname);
                }
              }}
              className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-all"
            >
              <RefreshCw size={20} />
              Réinitialiser
            </button>
          </div>
        </div>

        {showSuccessMessage && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-r-lg flex items-center">
            <Check className="h-5 w-5 text-green-600 mr-3" />
            <span>{successMessageText}</span>
          </div>
        )}

        {/* Main Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">N° Palette</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">N° Palette PROD</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Nbr Colis</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Produit/Variété</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Calibre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Température</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">État Palette</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">Conf. Étiquettes</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Décision</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-4 py-2 border-r text-sm font-medium text-gray-900">{row.palletNo}</td>
                    <td className="px-4 py-2 border-r">
                      <input
                        type="number"
                        value={row.palletPROD}
                        onChange={(e) => handleChange(rowIndex, 'palletPROD', e.target.value)}
                        className="w-full p-1 rounded border border-gray-300 focus:ring-1 focus:ring-green-500"
                      />
                    </td>
                    <td className="px-4 py-2 border-r">
                      <input
                        type="number"
                        value={row.nbrColis}
                        onChange={(e) => handleChange(rowIndex, 'nbrColis', e.target.value)}
                        className="w-full p-1 rounded border border-gray-300 focus:ring-1 focus:ring-green-500"
                      />
                    </td>
                    <td className="px-4 py-2 border-r">
                      <select
                        value={row.produitVariete}
                        onChange={(e) => handleChange(rowIndex, 'produitVariete', e.target.value)}
                        className="w-full p-1 rounded border border-gray-300 focus:ring-1 focus:ring-green-500"
                      >
                        <option value="">Sélectionner</option>
                        {productVarieties.map((variety) => (
                          <option key={variety} value={variety}>{variety}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 border-r">
                      <input
                        type="text"
                        value={row.calibre}
                        onChange={(e) => handleChange(rowIndex, 'calibre', e.target.value)}
                        className="w-full p-1 rounded border border-gray-300 focus:ring-1 focus:ring-green-500"
                      />
                    </td>
                    <td className="px-4 py-2 border-r">
                      <div className="relative">
                        <input
                          type="number"
                          value={row.temperatureProduit}
                          onChange={(e) => handleChange(rowIndex, 'temperatureProduit', e.target.value)}
                          className="w-full p-1 rounded border border-gray-300 focus:ring-1 focus:ring-green-500 pr-6"
                        />
                        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">°C</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 border-r">
                      <select
                        value={row.etatPalette}
                        onChange={(e) => handleChange(rowIndex, 'etatPalette', e.target.value)}
                        className="w-full p-1 rounded border border-gray-300 focus:ring-1 focus:ring-green-500"
                      >
                        <option value="">Sélectionner</option>
                        {etatPaletteOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 border-r">
                      <select
                        value={row.conformiteEtiquettes}
                        onChange={(e) => handleChange(rowIndex, 'conformiteEtiquettes', e.target.value)}
                        className="w-full p-1 rounded border border-gray-300 focus:ring-1 focus:ring-green-500"
                      >
                        <option value="">Sélectionner</option>
                        {conformiteOptions.map((option) => (
                          <option key={option} value={option} className={option === 'C' ? 'text-green-600' : 'text-red-600'}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.dessiccation}
                        onChange={(e) => handleChange(rowIndex, 'dessiccation', e.target.value)}
                        className="w-full p-1 rounded border border-gray-300 focus:ring-1 focus:ring-green-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span>Sauvegarde automatique activée</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
              {rows.filter(r => r.nbrColis || r.produitVariete || r.palletPROD).length} palettes avec données
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}