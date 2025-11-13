import { jsPDF } from 'jspdf';

// Type definitions
export interface QualityControlData {
  // Header info
  date: string;
  produit: string;
  variete: string;
  campagne: string;
  lotClients: string;
  numExpedition: string;
  typeEmballage: string;
  categorie: string;
  numExportateur: string;
  frequence: string;
  
  // Pallet data (array of 26 pallets)
  pallets: PalletData[];
  
  // Summary data
  tolerance?: ToleranceData;
  signatures?: {
    controleQualite?: string;
    responsableQualite?: string;
  };
  
  // Images by calibre
  imagesByCalibre?: Record<string, string[]>;
}

export interface PalletData {
  palletNumber: number;
  
  // Section I - Poids du colis
  poidsColis?: string;
  poidsNetRequis?: string;
  pourcentagePoidsSup?: string;
  
  // Section II - Caractéristiques minimales
  firmness?: string;
  pourriture?: string;
  matiereEtranger?: string;
  fletri?: string;
  endodermeDurci?: string;
  presenceParasite?: string;
  attaqueParasite?: string;
  temperature?: string;
  odeurSaveur?: string;
  
  // Section III - Paramètres catégorie I
  defautForme?: string;
  defautColoration?: string;
  defautEpiderme?: string;
  homogeneite?: string;
  extremiteGrains?: string;
  calibre?: string;
  
  // Section IV - Contrôle palettes
  nombreColis?: string;
  etatEmballage?: string;
  presenceEtiquetage?: string;
  cornieres?: string;
  feuillardsHorizontal?: string;
  fichePalette?: string;
  etatPaletteBois?: string;
  poidsBrut?: string;
  poidsNet?: string;
  numLotInterne?: string;
  conformitePalette?: string;
}

export interface ToleranceData {
  resultatMoyen?: string;
  conforme?: string;
  nonConforme?: string;
}

// Main PDF generation function
export const generateQualityControlPDF = (data: QualityControlData): Blob => {
  // Initialize PDF in landscape A4 format
  const doc = new jsPDF({
    orientation: 'landscape', 
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Set document metadata
  doc.setProperties({
    title: `Rapport Qualité - ${data.lotClients || 'Lot'}`,
    subject: 'Contrôle de la Qualité du Produit Final',
    author: 'Système de Contrôle Qualité',
    keywords: 'qualité, contrôle, rapport',
    creator: 'Système de Contrôle Qualité v2.0'
  });

  // PAGE 1 - Header, Sections I and III
  drawHeader(doc, pageWidth, '1 sur 3');
  doc.setLineWidth(0.3); // Thinner lines for better appearance
  drawFormInfo(doc, data); // Form info with proper spacing
  drawSectionI(doc, data.pallets); // Section I with adjusted spacing
  drawSectionIII(doc, data.pallets); // Section III below Section I

  // PAGE 2 - Section II (Caractéristiques minimales)
  doc.addPage();
  drawHeader(doc, pageWidth, '2 sur 3');
  doc.setLineWidth(0.3);
  drawSectionII(doc, data.pallets);

  // PAGE 3 - Section IV and Footer
  doc.addPage();
  drawHeader(doc, pageWidth, '3 sur 3');
  doc.setLineWidth(0.3);
  drawSectionIV(doc, data.pallets);
  drawFooter(doc, pageHeight, data.tolerance, data.signatures);
  
  // Additional pages for images
  if (data.imagesByCalibre && Object.keys(data.imagesByCalibre).length > 0) {
    // Calculate total number of pages
    const pageCount = Object.entries(data.imagesByCalibre).reduce((total, [_, images]) => {
      const imagesPerPage = 4; // 2x2 grid layout
      return total + Math.ceil(images.length / imagesPerPage);
    }, 3); // Start from 4 since we already have 3 pages

    // Images section start
    let currentPage = 4;
    doc.addPage();
    drawHeader(doc, pageWidth, `${currentPage} sur ${pageCount}`);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('V) Images du lot par calibre', 10, 30);
    
    let yPos = 40;
    for (const [calibre, images] of Object.entries(data.imagesByCalibre)) {
      // Add calibre header
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Calibre ${calibre}:`, 10, yPos);
      yPos += 10;
      
      // Calculate optimal image dimensions for 2x2 grid
      const margin = 15;
      const gutter = 10;
      const usableWidth = pageWidth - (2 * margin) - gutter;
      const imageWidth = usableWidth / 2;
      const imageHeight = 80; // Fixed height for consistent layout
      
      // Add images in a 2x2 grid layout
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        try {
          // Calculate grid position
          const row = Math.floor((i % 4) / 2);
          const col = i % 2;
          const xPos = margin + (col * (imageWidth + gutter));
          const currentYPos = yPos + (row * (imageHeight + gutter));

          // Add image with frame and label
          doc.setDrawColor(200, 200, 200); // Light gray border
          doc.setLineWidth(0.5);
          doc.rect(xPos, currentYPos, imageWidth, imageHeight);
          doc.addImage(image, 'JPEG', xPos + 1, currentYPos + 1, imageWidth - 2, imageHeight - 2, undefined, 'MEDIUM');
          
          // Add image number
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setFillColor(255, 255, 255);
          doc.rect(xPos + 2, currentYPos + 2, 12, 8, 'F');
          doc.setTextColor(100, 100, 100);
          doc.text(`#${i + 1}`, xPos + 4, currentYPos + 8);
          
          // Start new page after every 4 images
          if (i > 0 && (i + 1) % 4 === 0) {
            yPos = 40;
            if (i < images.length - 1) { // Only add new page if there are more images
              currentPage++;
              doc.addPage();
              drawHeader(doc, pageWidth, `${currentPage} sur ${pageCount}`);
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.text(`Calibre ${calibre} (suite):`, 10, 30);
            }
          }
        } catch (err) {
          console.error('Error adding image to PDF:', err);
        }
      }
      
      // Move to next calibre section
      if (images.length % 4 !== 0) {
        yPos += Math.ceil((images.length % 4) / 2) * (imageHeight + gutter) + 20;
      } else {
        yPos += 20;
      }
      
      // Check if we need a new page for the next calibre
      if (yPos > pageHeight - 100 && Object.keys(data.imagesByCalibre).indexOf(calibre) < Object.keys(data.imagesByCalibre).length - 1) {
        currentPage++;
        doc.addPage();
        drawHeader(doc, pageWidth, `${currentPage} sur ${pageCount}`);
        yPos = 40;
      }
    }
  }
  
  return doc.output('blob');
};

// Draw document header with improved styling
const drawHeader = (doc: jsPDF, pageWidth: number, pageNumber: string) => {
  // Main title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('CONTROLE DE LA QUALITE DU PRODUIT FINAL', pageWidth / 2, 12, { 
    align: 'center',
    baseline: 'middle'
  });
  
  // Left side info
  doc.setFontSize(9);
  doc.text('MP. ENR02', 10, 15);
  doc.text('VERSION 01', 10, 19);
  
  // Right side info
  doc.text(`Page ${pageNumber}`, pageWidth - 25, 15, { align: 'right' });
  doc.text('01/07/2023', pageWidth - 25, 19, { align: 'right' });
  
  // Bottom text
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('MAITRISE DU PRODUIT', 10, 24);
  
  // Separator line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(10, 26, pageWidth - 10, 26);
};

// Draw form information section with improved styling
const drawFormInfo = (doc: jsPDF, data: QualityControlData) => {
  let yPos = 32;
  
  // Style for labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  
  // Function to draw a field with label and value
  const drawField = (label: string, value: string, x: number, y: number, width: number = 40) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    const valueX = x + doc.getTextWidth(label);
    doc.text(value || '_____', valueX, y);
    
    // Underline for empty values
    if (!value) {
      doc.line(valueX, y + 1, x + width, y + 1);
    }
  };
  
  // Line 1 with proper spacing and alignment
  drawField('Date : ', data.date, 10, yPos);
  drawField('Produit : ', data.produit, 55, yPos);
  drawField('Variété : ', data.variete, 100, yPos);
  drawField('Campagne : ', data.campagne || '2024-2025', 145, yPos);
  drawField('Lot clients : ', data.lotClients, 200, yPos);
  
  // Line 2 with improved spacing
  yPos += 6; // Increased spacing between lines
  drawField('N° Expédition : ', data.numExpedition, 10, yPos);
  drawField("Type d'emballage : ", data.typeEmballage, 65, yPos, 60);
  drawField('Catégorie : ', data.categorie || 'I', 130, yPos);
  drawField("N° d'Exportateur : ", data.numExportateur || '106040', 165, yPos);
  drawField('Fréquence : ', data.frequence || '1 Carton/palette', 225, yPos);
  
  // Add a subtle separator line
  yPos += 3;
  doc.setDrawColor(200, 200, 200); // Light gray
  doc.setLineWidth(0.1);
  doc.line(10, yPos, doc.internal.pageSize.getWidth() - 10, yPos);
};

// Section I - Contrôle du poids du colis with improved styling
const drawSectionI = (doc: jsPDF, pallets: PalletData[]) => {
  let yPos = 45;
  
  // Section title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('I) CONTRÔLE DU POIDS DU COLIS :', 10, yPos);
  yPos += 6;
  
  const headers = ['N° Palette', 'Poids du colis en Kg', 'Poids Net requis', '% du poids supplémentaire'];
  const colWidths = [25, 70, 70, 70];
  const startX = 10;
  const headerHeight = 7; // Slightly taller headers
  const dataCellHeight = 5;
  
  // Draw table headers with improved styling
  doc.setFillColor(240, 240, 240); // Light gray background
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  
  headers.forEach((header, i) => {
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    // Fill header background
    doc.setFillColor(240, 240, 240);
    doc.rect(x, yPos, colWidths[i], headerHeight, 'F');
    // Draw border
    doc.rect(x, yPos, colWidths[i], headerHeight);
    // Center text in header
    const textWidth = doc.getTextWidth(header);
    const textX = x + (colWidths[i] - textWidth) / 2;
    doc.text(header, textX, yPos + 5);
  });

  // Draw data rows with improved styling
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);

  for (let i = 0; i < 26; i++) {
    const rowY = yPos + headerHeight + dataCellHeight * i;
    const pallet = pallets[i] || {};
    
    // Alternate row background for better readability
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(startX, rowY, colWidths.reduce((a, b) => a + b, 0), dataCellHeight, 'F');
    }
    
    // Draw cell borders and content
    const drawCell = (value: string, colIndex: number) => {
      const x = startX + colWidths.slice(0, colIndex).reduce((a, b) => a + b, 0);
      doc.rect(x, rowY, colWidths[colIndex], dataCellHeight);
      // Center numbers, left-align text
      const isNumber = !isNaN(Number(value));
      if (isNumber) {
        const textWidth = doc.getTextWidth(value);
        const textX = x + (colWidths[colIndex] - textWidth) / 2;
        doc.text(value, textX, rowY + 3.5);
      } else {
        doc.text(value || '', x + 2, rowY + 3.5);
      }
    };
    
    // Draw each cell
    drawCell((i + 1).toString(), 0);
    drawCell(pallet.poidsColis || '', 1);
    drawCell(pallet.poidsNetRequis || '', 2);
    drawCell(pallet.pourcentagePoidsSup || '', 3);
  }
  
  // Add "Moyen" row with special styling
  const moyenY = yPos + headerHeight + dataCellHeight * 26;
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(230, 230, 230); // Darker background for average row
  
  // Fill background for entire row
  doc.rect(startX, moyenY, colWidths.reduce((a, b) => a + b, 0), dataCellHeight, 'F');
  
  // Draw borders and "Moyen" text
  doc.rect(startX, moyenY, colWidths[0], dataCellHeight);
  doc.text('Moyen', startX + 2, moyenY + 3.5);
  
  // Draw remaining cells
  doc.setFont('helvetica', 'normal');
  for (let i = 1; i < 4; i++) {
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.rect(x, moyenY, colWidths[i], dataCellHeight);
  }
};

// Section II - Caractéristiques minimales
const drawSectionII = (doc: jsPDF, pallets: PalletData[]) => {
  let yPos = 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('II) contrôle des caractéristiques minimales :', 10, yPos);
  yPos += 3;
  doc.setFontSize(7);
  doc.text('1 Carton/Palette', 10, yPos);
  yPos += 5;

  const headers = [
    'N° Palette',
    'Firmness\n(kgf) [13-14]',
    'Pourriture\n(anthracnose)\n(%)',
    'Matière\nétranger\nvisible',
    'Flétri',
    'Endoderme\ndurci (%)',
    'Présence de\nparasite (%)',
    "Présence\nd'attaque de\nparasite (%)",
    'Température',
    "Odeur ou\nsaveur\nd'étranger"
  ];
  
  const colWidths = [18, 22, 22, 22, 18, 22, 22, 24, 22, 24];
  const startX = 10;
  const headerHeight = 8;
  const dataCellHeight = 5;
  
  // Draw headers
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  headers.forEach((header, i) => {
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.rect(x, yPos, colWidths[i], headerHeight);
    const lines = header.split('\n');
    lines.forEach((line, lineIdx) => {
      doc.text(line, x + 1, yPos + 3 + (lineIdx * 2.5));
    });
  });

  // Draw data rows
  doc.setFont('helvetica', 'normal');
  for (let i = 0; i < 26; i++) {
    const rowY = yPos + headerHeight + dataCellHeight * i;
    const pallet = pallets[i] || {};
    
    const values = [
      (i + 1).toString(),
      pallet.firmness || '',
      pallet.pourriture || '',
      pallet.matiereEtranger || '',
      pallet.fletri || '',
      pallet.endodermeDurci || '',
      pallet.presenceParasite || '',
      pallet.attaqueParasite || '',
      pallet.temperature || '',
      pallet.odeurSaveur || ''
    ];
    
    values.forEach((value, colIdx) => {
      const x = startX + colWidths.slice(0, colIdx).reduce((a, b) => a + b, 0);
      doc.rect(x, rowY, colWidths[colIdx], dataCellHeight);
      doc.text(value, x + 1, rowY + 3);
    });
  }
  
  // Moyen row
  const moyenY = yPos + headerHeight + dataCellHeight * 26;
  doc.setFont('helvetica', 'bold');
  doc.rect(startX, moyenY, colWidths[0], dataCellHeight);
  doc.text('Moyen', startX + 1, moyenY + 3);
  doc.setFont('helvetica', 'normal');
  for (let i = 1; i < colWidths.length; i++) {
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.rect(x, moyenY, colWidths[i], dataCellHeight);
  }
};

// Section III - Contrôle des caractéristiques spécifiques with improved styling
const drawSectionIII = (doc: jsPDF, pallets: PalletData[]) => {
  let yPos = 180; // Position after Section I

  // Section title with improved styling
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("III) CONTRÔLE DES CARACTÉRISTIQUES SPÉCIFIQUES", 10, yPos);
  yPos += 6;

  const headers = [
    'N° Palette',
    'Défaut de\nforme (%)',
    'Défaut de\ncoloration\n(brûlée de\nsoleil.) (%)',
    "Défaut\nd'épiderme\n(%)",
    'Homogénéité',
    'Extrémité des\ngrains\nmanques et\ncassées (%)',
    'Calibre'
  ];
  
  const colWidths = [25, 28, 35, 30, 32, 38, 28];
  const startX = 10;
  const headerHeight = 12; // Taller header for multiline text
  const dataCellHeight = 5;
  
  // Draw headers with improved styling
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240); // Light gray background
  
  headers.forEach((header, i) => {
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    // Fill header background
    doc.rect(x, yPos, colWidths[i], headerHeight, 'F');
    // Draw border
    doc.rect(x, yPos, colWidths[i], headerHeight);
    // Center and stack multiline text
    const lines = header.split('\n');
    const lineHeight = 2.2;
    const startY = yPos + (headerHeight - (lines.length * lineHeight)) / 2;
    lines.forEach((line, lineIdx) => {
      const textWidth = doc.getTextWidth(line);
      const textX = x + (colWidths[i] - textWidth) / 2;
      doc.text(line, textX, startY + (lineIdx * lineHeight));
    });
  });

  // Draw data rows with improved styling
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  for (let i = 0; i < 26; i++) {
    const rowY = yPos + headerHeight + dataCellHeight * i;
    const pallet = pallets[i] || {};
    
    // Alternate row background
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(startX, rowY, colWidths.reduce((a, b) => a + b, 0), dataCellHeight, 'F');
    }
    
    const values = [
      (i + 1).toString(),
      pallet.defautForme || '',
      pallet.defautColoration || '',
      pallet.defautEpiderme || '',
      pallet.homogeneite || '',
      pallet.extremiteGrains || '',
      pallet.calibre || ''
    ];
    
    // Draw each cell with centered content
    values.forEach((value, colIdx) => {
      const x = startX + colWidths.slice(0, colIdx).reduce((a, b) => a + b, 0);
      doc.rect(x, rowY, colWidths[colIdx], dataCellHeight);
      
      // Center numbers, left-align text
      const isNumber = !isNaN(Number(value));
      if (isNumber) {
        const textWidth = doc.getTextWidth(value);
        const textX = x + (colWidths[colIdx] - textWidth) / 2;
        doc.text(value, textX, rowY + 3.5);
      } else {
        doc.text(value, x + 2, rowY + 3.5);
      }
    });
  }
  
  // Moyen row with special styling
  const moyenY = yPos + headerHeight + dataCellHeight * 26;
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(230, 230, 230); // Darker background for average row
  
  // Fill background for entire Moyen row
  doc.rect(startX, moyenY, colWidths.reduce((a, b) => a + b, 0), dataCellHeight, 'F');
  
  // Draw Moyen row borders and text
  doc.rect(startX, moyenY, colWidths[0], dataCellHeight);
  doc.text('Moyen', startX + 2, moyenY + 3.5);
  
  for (let i = 1; i < colWidths.length; i++) {
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.rect(x, moyenY, colWidths[i], dataCellHeight);
  }
};

// Section IV - Contrôle des palettes produits fini
const drawSectionIV = (doc: jsPDF, pallets: PalletData[]) => {
  let yPos = 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('IV) Contrôle des palettes produits fini :', 10, yPos);
  yPos += 4;

  const headers = [
    'N° Palette',
    'Calibre',
    'Nombre\ncolis/palette',
    "Etat\nd'emballage",
    "Présence\nd'étiquetage",
    'Cornières',
    'Feuillards\nhorizontal',
    'Fiche\npalette',
    'Etat de la\npalette en\nbois',
    'Poids\nBrut',
    'Poids\nNet',
    'N° Lot\nInterne',
    'Conformité\nde la\npalette'
  ];
  
  const colWidths = [18, 20, 22, 20, 20, 18, 20, 18, 22, 18, 18, 20, 22];
  const startX = 10;
  const headerHeight = 8;
  const dataCellHeight = 5;
  
  // Draw headers
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  headers.forEach((header, i) => {
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.rect(x, yPos, colWidths[i], headerHeight);
    const lines = header.split('\n');
    lines.forEach((line, lineIdx) => {
      doc.text(line, x + 1, yPos + 3 + (lineIdx * 2.2));
    });
  });

  // Draw data rows
  doc.setFont('helvetica', 'normal');
  for (let i = 0; i < 26; i++) {
    const rowY = yPos + headerHeight + dataCellHeight * i;
    const pallet = pallets[i] || {};
    
    const values = [
      (i + 1).toString(),
      pallet.calibre || '',
      pallet.nombreColis || '',
      pallet.etatEmballage || '',
      pallet.presenceEtiquetage || '',
      pallet.cornieres || '',
      pallet.feuillardsHorizontal || '',
      pallet.fichePalette || '',
      pallet.etatPaletteBois || '',
      pallet.poidsBrut || '',
      pallet.poidsNet || '',
      pallet.numLotInterne || '',
      pallet.conformitePalette || ''
    ];
    
    values.forEach((value, colIdx) => {
      const x = startX + colWidths.slice(0, colIdx).reduce((a, b) => a + b, 0);
      doc.rect(x, rowY, colWidths[colIdx], dataCellHeight);
      doc.text(value, x + 1, rowY + 3);
    });
  }
};

// Draw footer with notes and signatures
const drawFooter = (
  doc: jsPDF, 
  pageHeight: number, 
  tolerance?: ToleranceData,
  signatures?: { controleQualite?: string; responsableQualite?: string }
) => {
  let yPos = pageHeight - 45;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('N.B : C : conforme + N.C : non conforme', 10, yPos);
  
  yPos += 6;
  
  // Tolerance table header
  doc.text('Tolérance', 10, yPos);
  doc.text('Résultat moyen', 70, yPos);
  doc.text('Conforme', 130, yPos);
  doc.text('Non-conforme', 180, yPos);
  
  yPos += 4;
  doc.setFont('helvetica', 'normal');
  
  // Draw boxes for tolerance data
  doc.rect(10, yPos, 55, 6);
  doc.rect(70, yPos, 55, 6);
  doc.rect(130, yPos, 45, 6);
  doc.rect(180, yPos, 45, 6);
  
  if (tolerance) {
    doc.text(tolerance.resultatMoyen || '', 72, yPos + 4);
    doc.text(tolerance.conforme || '', 132, yPos + 4);
    doc.text(tolerance.nonConforme || '', 182, yPos + 4);
  }
  
  yPos += 10;
  doc.setFontSize(7);
  
  // Tolerance notes
  doc.text('Caractéristiques minimales :(≤ 10%)', 10, yPos);
  yPos += 4;
  doc.text('Total des défauts : catégorie I + caractéristiques minimales : (≤ 10%)', 10, yPos);
  yPos += 4;
  doc.text('Extrémité des grains manques et cassées (≤ 10%)', 10, yPos);
  yPos += 4;
  doc.text("Poids selon le type d'emballage (poids net +1%)", 10, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'bold');
  
  // Signature section
  doc.text('Contrôle Qualité :', 10, yPos);
  doc.text('Responsable Qualité :', 160, yPos);
  
  // Signature boxes
  doc.rect(10, yPos + 2, 70, 15);
  doc.rect(160, yPos + 2, 70, 15);
  
  if (signatures) {
    doc.setFont('helvetica', 'normal');
    if (signatures.controleQualite) {
      doc.text(signatures.controleQualite, 12, yPos + 10);
    }
    if (signatures.responsableQualite) {
      doc.text(signatures.responsableQualite, 162, yPos + 10);
    }
  }
};

// Export utility function to download PDF
export const downloadPDF = (blob: Blob, fileName: string) => {
  try {
    console.log('[downloadPDF] invoked', { fileName, size: blob?.size, type: blob?.type, time: new Date().toISOString() });
    // small stack trace to know call origin
    // eslint-disable-next-line no-console
    console.trace('[downloadPDF] stack trace');
  } catch (err) {
    // ignore logging errors
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Export utility function to upload PDF to Firebase Storage
export const uploadPDFToStorage = async (
  pdfBlob: Blob, 
  fileName: string
): Promise<string> => {
  try {
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { storage } = await import('./firebase');
    
    const pdfRef = ref(storage, `quality-control/pdfs/${fileName}`);
    await uploadBytes(pdfRef, pdfBlob);
    return await getDownloadURL(pdfRef);
  } catch (error) {
    console.error('Error uploading PDF to storage:', error);
    throw error;
  }
};

// Backwards-compatible wrappers expected by other modules
// The application elsewhere imports `generateQualityRapportPDF` and `generateVisualRapportPDF`.
// We provide thin wrappers that convert a rapport-like object into the local QualityControlData
// and delegate to `generateQualityControlPDF`.
export const generateQualityRapportPDF = async (rapport: any): Promise<Blob> => {
  // Map known fields where possible; the rest remain empty so the PDF still renders the 26 rows
  const data: QualityControlData = {
    date: rapport.date || new Date().toISOString().split('T')[0],
    produit: rapport.product || rapport.controller || 'Produit',
    variete: rapport.variety || '',
    campagne: rapport.campaign || '',
    lotClients: rapport.lotNumber || '',
    numExpedition: rapport.palletNumber || '',
    typeEmballage: '' + (rapport.packagingType || ''),
    categorie: '' + (rapport.category || ''),
    numExportateur: '' + (rapport.exporterNumber || ''),
    frequence: '' + (rapport.frequency || ''),
    imagesByCalibre: rapport.imagesByCalibre,
    pallets: Array.from({ length: 26 }).map((_, i) => {
      const calibre = Array.isArray(rapport.calibres) ? rapport.calibres[i] : undefined;
      // Try to pull some test results into the pallet where available
      const testResultsForCalibre = rapport.testResults && calibre ? rapport.testResults[calibre] : undefined;
      return {
        palletNumber: i + 1,
        poidsColis: testResultsForCalibre?.poids || '',
        poidsNetRequis: '',
        pourcentagePoidsSup: '',
        firmness: testResultsForCalibre?.firmness || '',
        pourriture: '',
        matiereEtranger: '',
        fletri: '',
        endodermeDurci: '',
        presenceParasite: '',
        attaqueParasite: '',
        temperature: '',
        odeurSaveur: '',
        defautForme: testResultsForCalibre?.defects || '',
        defautColoration: '',
        defautEpiderme: '',
        homogeneite: '',
        extremiteGrains: '',
        calibre: calibre ? String(calibre) : '',
        nombreColis: '',
        etatEmballage: '',
        presenceEtiquetage: '',
        cornieres: '',
        feuillardsHorizontal: '',
        fichePalette: '',
        etatPaletteBois: '',
        poidsBrut: '',
        poidsNet: '',
        numLotInterne: '',
        conformitePalette: ''
      } as PalletData;
    }),
    tolerance: undefined,
    signatures: undefined
  };

  try {
    console.log('[generateQualityRapportPDF] invoked', { lot: rapport?.lotNumber, time: new Date().toISOString() });
  } catch (_) {}
  const blob = generateQualityControlPDF(data);
  try {
    console.log('[generateQualityRapportPDF] completed', { size: (blob as Blob)?.size });
  } catch (_) {}
  return Promise.resolve(blob);
};

export const generateVisualRapportPDF = async (rapport: any): Promise<Blob> => {
  // For the visual report we can reuse the same layout but callers expect a 'visual' summary.
  // Map minimal fields and return the same PDF for now (keeps compatibility).
  try {
    console.log('[generateVisualRapportPDF] invoked', { lot: rapport?.lotNumber, time: new Date().toISOString() });
  } catch (_) {}
  const blob = await generateQualityRapportPDF(rapport);
  try {
    console.log('[generateVisualRapportPDF] completed', { size: blob?.size });
  } catch (_) {}
  return blob;
};