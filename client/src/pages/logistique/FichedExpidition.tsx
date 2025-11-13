import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale/fr';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FilePlus, Printer, RefreshCw, Check, Save, ExternalLink } from 'lucide-react';
import logo from "../../../assets/icon.png"
// Add logo import
const LOGO_PATH = logo

// Function to convert image to base64
const getBase64Image = async (url: string): Promise<string> => {
  // Fallback: 1x1 transparent PNG base64
  const fallback = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  try {
    // try fetch first (works when dev server or asset server is available)
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('getBase64Image: fetch not ok', response.status, response.statusText);
      return fallback;
    }
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    // If fetch fails (dev server down or CORS), try to create an Image element and draw to canvas
    try {
      return await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width || 1;
            canvas.height = img.height || 1;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } else {
              resolve(fallback);
            }
          } catch (e) {
            resolve(fallback);
          }
        };
        img.onerror = () => {
          resolve(fallback);
        };
        // try to set src; this may still fail if asset not reachable
        try { img.src = url; } catch (e) { resolve(fallback); }
        // safety: if neither onload/onerror fire after 2s, return fallback
        setTimeout(() => resolve(fallback), 2000);
      });
    } catch (e) {
      console.warn('getBase64Image: fallback failed', e);
      return fallback;
    }
  }
};

// Define row type
interface ExpeditionRow {
  palletNo: number;
  nbrColis: string;
  produitVariete: string;
  calibre: string;
  temperatureProduit: string;
  etatPalette: string;
  conformiteEtiquettes: string;
  dessiccation: string;
}

// Add new form data interface
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

// Add expedition form data interface for saving
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

// Product varieties options
const productVarieties = ['Hass', 'Fuerte', 'Pinkerton', 'Reed', 'Zutano', 'Bacon', 'Gwen', 'Lamb Hass'];

// Define dropdown options
const etatPaletteOptions = ['C', 'NC'];
const conformiteOptions = ['C', 'NC'];

// Initial empty row structure
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
  const [userId] = useState('USER123');
  const [companyName] = useState('Fruits For You ');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessageText, setSuccessMessageText] = useState('');
  const [expeditionDate, setExpeditionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
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

  // Initialize rows on component mount
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
          console.error('Error parsing saved data:', e);
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

          return;
        }
      }

      alert('Aucune fiche d\'expédition trouvée avec cet identifiant.');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (error) {
      console.error('Error loading expedition data:', error);
      alert('Erreur lors du chargement de la fiche d\'expédition.');
      window.history.replaceState({}, '', window.location.pathname);
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

    if (field === 'produitVariete' && rowIndex === 0) {
      updatedRows.forEach((row, index) => {
        const hasData = row.nbrColis || row.calibre || row.temperatureProduit ||
          row.etatPalette || row.conformiteEtiquettes || row.dessiccation || row.palletprod  ;

        if (index === 0 || hasData) {
          updatedRows[index] = {
            ...row,
            [field]: value
          };
        }
      });
    } else if (field === 'nbrColis' && value && updatedRows[0].produitVariete) {
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        [field]: value,
        produitVariete: updatedRows[0].produitVariete
      };
    } else if (field !== 'produitVariete' && value && updatedRows[0].produitVariete && !updatedRows[rowIndex].produitVariete) {
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        [field]: value,
        produitVariete: updatedRows[0].produitVariete
      };
    } else {
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        [field]: value
      };
    }

    setRows(updatedRows);
  };

  const handleHeaderChange = (field: keyof HeaderData, value: string) => {
    setHeaderData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    const hasAnyData = rows.some(row =>
      row.nbrColis || row.produitVariete || row.calibre || row.temperatureProduit ||
      row.etatPalette || row.conformiteEtiquettes || row.dessiccation
    );

    const hasHeaderData = headerData.transporteur && headerData.destination;

    return hasAnyData && hasHeaderData;
  };

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      if (!validateForm()) {
        alert("Veuillez remplir au moins une ligne et les informations principales (transporteur et destination).");
        return;
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const logoBase64 = await getBase64Image(LOGO_PATH);

      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const lightGreen: [number, number, number] = [198, 224, 180];
      const darkGreen: [number, number, number] = [76, 175, 80];
      const gray: [number, number, number] = [75, 75, 75];
  // Unified table/border styling for consistent appearance
  const tableLineColor: [number, number, number] = [0, 0, 0];
  const tableLineWidth = 0.4; // thickness in mm for all table-like borders
  // Unified left content X so all table-like elements align on the same vertical x-axis
  const contentLeft = 6;
      // Helper to apply unified stroke style
      const applyTableStroke = () => {
        doc.setDrawColor(...tableLineColor);
        doc.setLineWidth(tableLineWidth);
      };

  // HEADER - left logo, center title (green), right meta box
  const HEADER_H = 28;
  const headerY = 5;
  const leftBoxX = 10;
  const leftBoxW = 36;
  const rightBoxW = 66;
  const rightBoxX = pageWidth - 10 - rightBoxW;
  const centerBoxX = leftBoxX + leftBoxW;
  const centerBoxW = rightBoxX - centerBoxX;

  // Left logo box (white background with border)
  doc.setFillColor(255, 255, 255);
  doc.rect(leftBoxX, headerY, leftBoxW, HEADER_H, 'F');
  doc.setDrawColor(...tableLineColor);
  doc.setLineWidth(tableLineWidth);
  doc.rect(leftBoxX, headerY, leftBoxW, HEADER_H);
  // draw logo centered in left box (fit within 30x24)
  const logoW = Math.min(24, leftBoxW - 6);
  const logoH = Math.min(24, HEADER_H - 6);
  const logoX = leftBoxX + (leftBoxW - logoW) / 2;
  const logoY = headerY + (HEADER_H - logoH) / 2;
  try { doc.addImage(logoBase64, 'PNG', logoX, logoY, logoW, logoH); } catch (e) { /* ignore image errors */ }

  // Center title box (green background)
  doc.setFillColor(lightGreen[0], lightGreen[1], lightGreen[2]);
  doc.rect(centerBoxX, headerY, centerBoxW, HEADER_H, 'F');
  applyTableStroke();
  doc.rect(centerBoxX, headerY, centerBoxW, HEADER_H);
  // Title - draw with a wide/expanded Latin-like style by spacing letters
  // Helper to draw text with extra inter-character spacing so it looks "wide" without embedding a custom font
  const drawWideLatinText = (text: string, centerX: number, y: number, opts?: { fontSize?: number; spacing?: number; font?: string; fontStyle?: string }) => {
    const fontSize = opts?.fontSize ?? 16;
    const spacing = opts?.spacing ?? 1.4; // extra space in mm between characters
    const font = opts?.font ?? 'times';
    const fontStyle = opts?.fontStyle ?? 'italic';

    doc.setFont(font as any, fontStyle as any);
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);

    // Split into characters and measure widths
    const chars = text.split('');
    const charWidths = chars.map(ch => doc.getTextWidth(ch));
    const totalWidth = charWidths.reduce((a, b) => a + b, 0) + Math.max(0, chars.length - 1) * spacing;

    // Starting X to center the stretched text
    let x = centerX - totalWidth / 2;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      // draw each character; use baseline alignment
      doc.text(ch, x, y, { baseline: 'middle' as any });
      x += charWidths[i] + spacing;
    }
  };

  // center text vertically within header
  const titleX = centerBoxX + centerBoxW / 2;
  const titleY = headerY + HEADER_H / 2 ; // tweak for optical centering
  drawWideLatinText("Fiche d'expédition", titleX, titleY, { fontSize: 16, spacing: 1.6, font: 'times', fontStyle: 'italic' });

  // Right meta box (divided into three rows)
  doc.setFillColor(255, 255, 255);
  doc.rect(rightBoxX, headerY, rightBoxW, HEADER_H, 'F');
  applyTableStroke();
  doc.rect(rightBoxX, headerY, rightBoxW, HEADER_H);
  // Draw three horizontal separators to create rows
  const rowH = HEADER_H / 3;
  doc.setDrawColor(...tableLineColor);
  doc.setLineWidth(tableLineWidth);
  doc.line(rightBoxX, headerY + rowH, rightBoxX + rightBoxW, headerY + rowH);
  doc.line(rightBoxX, headerY + 2 * rowH, rightBoxX + rightBoxW, headerY + 2 * rowH);
  // Fill meta texts
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('MP.ENR 06', rightBoxX + 4, headerY + rowH / 2 + 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Version : 01', rightBoxX + 4, headerY + rowH + rowH / 2 + 3);
  doc.text('Date : 01/07/2023', rightBoxX + 4, headerY + 2 * rowH + rowH / 2 + 3);

  
      const startY = 35;
      doc.setFontSize(9);

  // Date field (moved slightly left)
  doc.setFillColor(250, 250, 250);
  applyTableStroke();
  doc.rect(contentLeft, startY, 35, 12, 'F');
  doc.rect(contentLeft, startY, 35, 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.text('Date expédition :', 8, startY + 4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(headerData.date || '', 8, startY + 9);

  // Hour field (moved left)
  doc.setFillColor(250, 250, 250);
  applyTableStroke();
  doc.rect(contentLeft + 35, startY, 25, 12, 'F');
  doc.rect(contentLeft + 35, startY, 25, 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.text('Heure:', 43, startY + 4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(headerData.heure || '', 43, startY + 9);

  // Transporter field (moved left)
  doc.setFillColor(250, 250, 250);
  applyTableStroke();
  doc.rect(contentLeft + 60, startY, 45, 12, 'F');
  doc.rect(contentLeft + 60, startY, 45, 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.text('Nom du transporteur:', 68, startY + 4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(headerData.transporteur || '', 68, startY + 9);

  // Registration field (moved left)
  doc.setFillColor(250, 250, 250);
  applyTableStroke();
  doc.rect(contentLeft + 105, startY, 45, 12, 'F');
  doc.rect(contentLeft + 105, startY, 45, 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.text('Matricule camion :', 113, startY + 4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(headerData.matricule || '', 113, startY + 9);

  applyTableStroke();
  doc.rect(contentLeft + 150, startY, 40, 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.text('T° camion :', 158, startY + 4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(`${headerData.tempCamion || ''}°C`, 158, startY + 9);

  // Draw a clear outer border around the first header row to avoid collapsed/overlapped borders
  try {
  const headerRowX = contentLeft;
    const headerRowY = startY;
    const headerRowW = (156 + 40) - headerRowX; // rightmost of the small boxes (156 + 40)
    const headerRowH = 12;
    doc.setDrawColor(...tableLineColor);
    doc.setLineWidth(tableLineWidth);
    doc.rect(headerRowX, headerRowY, headerRowW, headerRowH);
  } catch (e) {
    // drawing border should not break PDF generation
    console.warn('Failed to draw header outer border', e);
  }

      // Second row - Checkboxes section (moved left)
      const checkY = startY + 12;
      const checkboxSize = 3;

  // Hygiene section
  applyTableStroke();
  doc.rect(6, checkY, 60, 12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
      doc.text('Hygiène du camion :', 8, checkY + 6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(gray[0], gray[1], gray[2]);

  applyTableStroke();
  doc.rect(41, checkY + 3, checkboxSize, checkboxSize);
      doc.text('Bon', 46, checkY + 5);
  applyTableStroke();
  doc.rect(41, checkY + 7, checkboxSize, checkboxSize);
      doc.text('Mauvais', 46, checkY + 9);

      if (headerData.hygiene === 'Bon') {
        doc.line(41, checkY + 3, 44, checkY + 6);
        doc.line(44, checkY + 3, 41, checkY + 6);
      }
      if (headerData.hygiene === 'Mauvais') {
        doc.line(41, checkY + 7, 44, checkY + 10);
        doc.line(42, checkY + 7, 41, checkY + 10);
      }

  // Odeur section (moved left)
  applyTableStroke();
  doc.rect(66, checkY, 45, 12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
      doc.text('Odeur :', 68, checkY + 7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(gray[0], gray[1], gray[2]);

  applyTableStroke();
  doc.rect(86, checkY + 3, checkboxSize, checkboxSize);
      doc.text('Bon', 91, checkY + 5);
  applyTableStroke();
  doc.rect(86, checkY + 7, checkboxSize, checkboxSize);
      doc.text('Mauvais', 91, checkY + 9);

      if (headerData.odeur === 'Bon') {
        doc.line(86, checkY + 3, 89, checkY + 6);
        doc.line(89, checkY + 3, 86, checkY + 6);
      }
      if (headerData.odeur === 'Mauvais') {
        doc.line(86, checkY + 7, 89, checkY + 10);
        doc.line(89, checkY + 7, 86, checkY + 10);
      }

  // Lot Client (moved left)
  applyTableStroke();
  doc.rect(111, checkY, 45, 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.text('Lot Client :', 113, checkY + 4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(headerData.lotClient || '', 113, checkY + 9);

  // Client Name (moved left)
  applyTableStroke();
  doc.rect(156, checkY, 40, 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.text('Nom Client :', 158, checkY + 4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(headerData.clientName || '', 158, checkY + 9);

  // Thermo king status (moved left)
  applyTableStroke();
  doc.rect(6, checkY + 12, 95, 12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
      doc.text('État de fonctionnement du', 8, checkY + 18);
      doc.text('thermo king :', 8, checkY + 22);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(gray[0], gray[1], gray[2]);

  applyTableStroke();
  doc.rect(50, checkY + 17, checkboxSize, checkboxSize);
      doc.text('Bon', 55, checkY + 19);
  applyTableStroke();
  doc.rect(78, checkY + 17, checkboxSize, checkboxSize);
      doc.text('Mauvais', 85, checkY + 19);

      if (headerData.thermokingEtat === 'Bon') {
        doc.line(66, checkY + 17, 69, checkY + 20);
        doc.line(69, checkY + 17, 66, checkY + 20);
      }
      if (headerData.thermokingEtat === 'Mauvais') {
        doc.line(86, checkY + 17, 89, checkY + 20);
        doc.line(89, checkY + 17, 86, checkY + 20);
      }

  // Destination field (moved left)
  applyTableStroke();
  doc.rect(101, checkY + 12, 95, 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
  doc.text('Destination :', 103, checkY + 18);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text(headerData.destination || '', 103, checkY + 22);

      const tableY = checkY + 35;

  // Separator line above the table: use unified table border style
  doc.setDrawColor(...tableLineColor);
  doc.setLineWidth(tableLineWidth);
  doc.line(contentLeft, tableY - 5, pageWidth - 10, tableY - 5);

      const filteredRows = rows.filter(row =>
        row.nbrColis || row.produitVariete || row.calibre ||
        row.temperatureProduit || row.etatPalette ||
        row.conformiteEtiquettes || row.dessiccation
      );

      // Use dynamic import of jspdf-autotable and call the exported function
      const { default: autoTable } = await import('jspdf-autotable');

      autoTable(doc as any, {
        startY: tableY,
        margin: { left: contentLeft, right: 10 },
        head: [[
          { content: 'N° de\npalette', styles: { cellWidth: 15 } },
          { content: 'N° prod\npalette', styles: { cellWidth: 20 } },
          { content: 'NBR\nColis', styles: { cellWidth: 15 } },
          { content: 'Produit / Variété', styles: { cellWidth: 30 } },
          { content: 'Calibre', styles: { cellWidth: 15 } },
          { content: 'T° produit', styles: { cellWidth: 15 } },
          { content: 'État palette', styles: { cellWidth: 25 } },
          { content: 'Conformité\n(C / NC)', styles: { cellWidth: 25 } },
          { content: 'Décision', styles: { cellWidth: 30 } }
        ]],
        body: filteredRows.map((row, index) => [
          { content: row.palletNo || index + 1, styles: { halign: 'center' } },
          { content: (row as any).palletPROD || '', styles: { halign: 'center' } },
          { content: row.nbrColis || '', styles: { halign: 'center' } },
          { content: row.produitVariete || '', styles: { halign: 'left' } },
          { content: row.calibre || '', styles: { halign: 'center' } },
          { content: row.temperatureProduit ? `${row.temperatureProduit}°C` : '', styles: { halign: 'center' } },
          { content: row.etatPalette || '', styles: { halign: 'center' } },
          { content: row.conformiteEtiquettes || '', styles: { halign: 'center' } },
          { content: row.dessiccation || '', styles: { halign: 'center' } }
        ]),
        styles: {
          fontSize: 7, // smaller font fits more text
          cellPadding: { top: 2, right: 1, bottom: 2, left: 1 },
          // unified border thickness/color for autoTable to match header boxes
          lineWidth: tableLineWidth,
          lineColor: tableLineColor,
          textColor: [0, 0, 0],
          minCellHeight: 5,
          valign: 'middle',
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [204, 255, 204], // light green
          textColor: [0, 0, 0],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          minCellHeight: 7,
        },
        alternateRowStyles: {
          fillColor: [255, 255, 255],
        },
        theme: 'grid',
        tableWidth: 'auto', // auto adjusts to page width
        didDrawPage: function (data: any) {
          doc.setFontSize(8);
          doc.text(
            `Page ${data.pageNumber}`,
            doc.internal.pageSize.getWidth() - 25,
            doc.internal.pageSize.getHeight() - 10
          );
        },
      });


      const finalY = (doc as any).lastAutoTable.finalY + 20;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text('Visa de Responsable de chargement', 15, finalY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text('Signature et cachet', 15, finalY + 5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text('Visa de Responsable Qualité', pageWidth - 90, finalY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text('Signature et cachet', pageWidth - 90, finalY + 5);

      const pdfOutput = doc.output('arraybuffer');
      const pdfBlob = new Blob([pdfOutput], { type: 'application/pdf' });
      const fileName = `Fiche_Expedition_${format(new Date(), 'yyyyMMdd')}_${headerData.transporteur.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

      const fileId = expeditionId || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const localPdfUrl = `local_${fileId}_expedition.pdf`;

      try {
        const reader = new FileReader();
        reader.onloadend = function () {
          try {
            const base64data = this.result as string;
            localStorage.setItem(`pdf_${expeditionId || fileId}`, base64data);
          } catch (e) {
            console.error('Error saving PDF data to localStorage:', e);
          }
        };
        reader.readAsDataURL(pdfBlob);

        if (expeditionId) {
          const savedExpeditions = localStorage.getItem('savedExpeditions');
          if (savedExpeditions) {
            let expeditionsArray = JSON.parse(savedExpeditions);
            expeditionsArray = expeditionsArray.map((exp: ExpeditionFormData) => {
              if (exp.id === expeditionId) {
                return { ...exp, pdfURL: localPdfUrl };
              }
              return exp;
            });
            localStorage.setItem('savedExpeditions', JSON.stringify(expeditionsArray));
          }
        }

        setSuccessMessageText('PDF généré et sauvegardé localement');
      } catch (error) {
        console.error('Error handling PDF storage:', error);
      }

      const link = document.createElement('a');
      link.href = URL.createObjectURL(pdfBlob);
      link.download = fileName;
      link.click();

      setSuccessMessageText('Fiche d\'expédition générée avec succès!');
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Une erreur s'est produite lors de la génération du PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const saveExpedition = async (generatePdfAfterSave = false) => {
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
        pdfURL: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const savedExpeditions = localStorage.getItem('savedExpeditions');
      let expeditionsArray: ExpeditionFormData[] = [];

      if (savedExpeditions) {
        expeditionsArray = JSON.parse(savedExpeditions);
        const existingIndex = expeditionsArray.findIndex(exp => exp.id === newExpeditionId);
        if (existingIndex >= 0) {
          const existingPdfURL = expeditionsArray[existingIndex].pdfURL;
          if (existingPdfURL && existingPdfURL.length > 0 && !generatePdfAfterSave) {
            expeditionData.pdfURL = existingPdfURL;
          }
          expeditionsArray[existingIndex] = expeditionData;
        } else {
          expeditionsArray.push(expeditionData);
        }
      } else {
        expeditionsArray = [expeditionData];
      }

      localStorage.setItem('savedExpeditions', JSON.stringify(expeditionsArray));

      const archiveItem = {
        id: newExpeditionId,
        name: expeditionData.name,
        date: expeditionData.date,
        type: 'expedition',
        pdfURL: expeditionData.pdfURL
      };

      const savedArchiveBoxes = localStorage.getItem('archiveBoxes');
      let archiveBoxes: any[] = [];

      if (savedArchiveBoxes) {
        archiveBoxes = JSON.parse(savedArchiveBoxes);
        const existingIndex = archiveBoxes.findIndex(item => item.id === newExpeditionId);
        if (existingIndex >= 0) {
          archiveBoxes[existingIndex] = archiveItem;
        } else {
          archiveBoxes.push(archiveItem);
        }
      } else {
        archiveBoxes = [archiveItem];
      }

      localStorage.setItem('archiveBoxes', JSON.stringify(archiveBoxes));

      const url = new URL(window.location.href);
      url.searchParams.set('id', newExpeditionId);
      window.history.pushState({}, '', url);

      if (generatePdfAfterSave) {
        await generatePDF();
      }

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
          <div className="space-y-4 w-full md:w-auto">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl mt-6">
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date d'Expédition
                  </label>
                  <input
                    type="date"
                    value={headerData.date}
                    onChange={(e) => handleHeaderChange('date', e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Heure
                  </label>
                  <input
                    type="time"
                    value={headerData.heure}
                    onChange={(e) => handleHeaderChange('heure', e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du Transporteur
                  </label>
                  <input
                    type="text"
                    value={headerData.transporteur}
                    onChange={(e) => handleHeaderChange('transporteur', e.target.value)}
                    placeholder="Entrer le nom du transporteur"
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Matricule Camion
                  </label>
                  <input
                    type="text"
                    value={headerData.matricule}
                    onChange={(e) => handleHeaderChange('matricule', e.target.value)}
                    placeholder="Entrer le matricule du camion"
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Température Camion
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={headerData.tempCamion}
                      onChange={(e) => handleHeaderChange('tempCamion', e.target.value)}
                      placeholder="Température"
                      className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">°C</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lot Client
                  </label>
                  <input
                    type="text"
                    value={headerData.lotClient}
                    onChange={(e) => handleHeaderChange('lotClient', e.target.value)}
                    placeholder="Entrer le lot client"
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom Client
                  </label>
                  <input
                    type="text"
                    value={headerData.clientName}
                    onChange={(e) => handleHeaderChange('clientName', e.target.value)}
                    placeholder="Entrer le nom du client"
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination
                  </label>
                  <input
                    type="text"
                    value={headerData.destination}
                    onChange={(e) => handleHeaderChange('destination', e.target.value)}
                    placeholder="Entrer la destination"
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Hygiène
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="Bon"
                        checked={headerData.hygiene === 'Bon'}
                        onChange={(e) => handleHeaderChange('hygiene', e.target.value)}
                        className="form-radio text-green-600 focus:ring-green-500 h-4 w-4"
                      />
                      <span className="ml-2">Bon</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="Mauvais"
                        checked={headerData.hygiene === 'Mauvais'}
                        onChange={(e) => handleHeaderChange('hygiene', e.target.value)}
                        className="form-radio text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <span className="ml-2">Mauvais</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Odeur
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="Bon"
                        checked={headerData.odeur === 'Bon'}
                        onChange={(e) => handleHeaderChange('odeur', e.target.value)}
                        className="form-radio text-green-600 focus:ring-green-500 h-4 w-4"
                      />
                      <span className="ml-2">Bon</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="Mauvais"
                        checked={headerData.odeur === 'Mauvais'}
                        onChange={(e) => handleHeaderChange('odeur', e.target.value)}
                        className="form-radio text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <span className="ml-2">Mauvais</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    État Thermo King
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="Bon"
                        checked={headerData.thermokingEtat === 'Bon'}
                        onChange={(e) => handleHeaderChange('thermokingEtat', e.target.value)}
                        className="form-radio text-green-600 focus:ring-green-500 h-4 w-4"
                      />
                      <span className="ml-2">Bon</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="Mauvais"
                        checked={headerData.thermokingEtat === 'Mauvais'}
                        onChange={(e) => handleHeaderChange('thermokingEtat', e.target.value)}
                        className="form-radio text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <span className="ml-2">Mauvais</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-6 md:mt-0">
            <button
              onClick={() => saveExpedition(false)}
              disabled={isSaving}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105 disabled:bg-gray-400 disabled:transform-none shadow-lg hover:shadow-xl"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin h-5 w-5 border-3 border-white border-t-transparent rounded-full"></div>
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
              onClick={() => {
                const saveAndGeneratePDF = async () => {
                  try {
                    await saveExpedition(false);
                    await generatePDF();
                  } catch (error) {
                    console.error('Error in save and generate PDF flow:', error);
                  }
                };
                saveAndGeneratePDF();
              }}
              disabled={isGeneratingPDF || isSaving}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 disabled:bg-gray-400 disabled:transform-none shadow-lg hover:shadow-xl"
            >
              {isGeneratingPDF ? (
                <>
                  <div className="animate-spin h-5 w-5 border-3 border-white border-t-transparent rounded-full"></div>
                  Génération PDF...
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
              className="flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <ExternalLink size={20} />
              Voir historique
            </button>

            <button
              onClick={() => {
                if (window.confirm("Êtes-vous sûr de vouloir réinitialiser le formulaire? Toutes les données seront perdues.")) {
                  initializeEmptyRows();
                  setExpeditionId(null);
                  window.history.pushState({}, '', window.location.pathname);
                }
              }}
              className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <RefreshCw size={20} />
              Réinitialiser
            </button>
          </div>
        </div>

        {showSuccessMessage && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-r-lg animate-fade-in flex items-center">
            <div className="bg-green-100 rounded-full p-1 mr-3">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <span>{successMessageText}</span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">
                    N° Palette
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">
                    N° Palette PROD
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">
                    Nbr Colis
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">
                    Produit/Variété
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">
                    Calibre
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">
                    Température
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">
                    État Palette
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">
                    Conf. Étiquettes
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Décision
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}
                    className={`group hover:bg-green-50 transition-colors ${rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      }`}>
                    <td className="px-4 py-3 border-r whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.palletNo}
                    </td>


                    <td className="px-4 py-3 border-r whitespace-nowrap text-sm font-medium text-gray-900">

                      <input
                        type="number"
                        value={row.palletprod}
                        onChange={(e) => handleChange(rowIndex, 'palletPROD', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        min="0"
                      />                    </td>

                    <td className="px-4 py-3 border-r">
                      <input
                        type="number"
                        value={row.nbrColis}
                        onChange={(e) => handleChange(rowIndex, 'nbrColis', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        min="0"
                      />
                    </td>

                    <td className="px-4 py-3 border-r">
                      <select
                        value={row.produitVariete}
                        onChange={(e) => handleChange(rowIndex, 'produitVariete', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all appearance-none bg-white"
                      >
                        <option value="">Sélectionner</option>
                        {productVarieties.map((variety) => (
                          <option key={variety} value={variety}>{variety}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3 border-r">
                      <input
                        type="text"
                        value={row.calibre}
                        onChange={(e) => handleChange(rowIndex, 'calibre', e.target.value)}
                        placeholder="ex: 14-16"
                        className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      />
                    </td>

                    <td className="px-4 py-3 border-r">
                      <div className="relative">
                        <input
                          type="number"
                          value={row.temperatureProduit}
                          onChange={(e) => handleChange(rowIndex, 'temperatureProduit', e.target.value)}
                          step="0.1"
                          className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">°C</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 border-r">
                      <select
                        value={row.etatPalette}
                        onChange={(e) => handleChange(rowIndex, 'etatPalette', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all appearance-none bg-white"
                      >
                        <option value="">Sélectionner</option>
                        {etatPaletteOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3 border-r">
                      <select
                        value={row.conformiteEtiquettes}
                        onChange={(e) => handleChange(rowIndex, 'conformiteEtiquettes', e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all appearance-none bg-white"
                      >
                        <option value="">Sélectionner</option>
                        {conformiteOptions.map((option) => (
                          <option key={option} value={option} className={
                            option === 'C' ? 'text-green-600' : 'text-red-600'
                          }>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={row.dessiccation}
                        onChange={(e) => handleChange(rowIndex, 'dessiccation', e.target.value)}
                        placeholder="Entrer la décision"
                        className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-500">
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm">Sauvegarde automatique activée</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {rows.filter(r => r.nbrColis || r.produitVariete).length} palettes
            </div>
            <span className="text-sm text-gray-500">avec données</span>
          </div>
        </div>
      </div>
    </div>
  );
}