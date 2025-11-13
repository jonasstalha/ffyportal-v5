import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale/fr';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FilePlus, Printer, RefreshCw, Check, Save, ExternalLink } from 'lucide-react';
import { addItemToBox } from '../../lib/firebaseService';
import { collection, getDocs, query, where, addDoc, updateDoc, doc as firestoreDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, auth, storage } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';

// Add logo import
const LOGO_PATH = new URL('../../../assets/logo.png', import.meta.url).href;

// Function to convert image to base64
const getBase64Image = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
  pdfURL?: string; // Add PDF URL field
}

// Product varieties options
const productVarieties = ['Hass', 'Fuerte', 'Pinkerton', 'Reed', 'Zutano', 'Bacon', 'Gwen', 'Lamb Hass'];

// Define dropdown options
const etatPaletteOptions = ['C', 'NC']; // C = Conforme, NC = Non Conforme
const conformiteOptions = ['C', 'NC']; // C = Conforme, NC = Non Conforme

// Initial empty row structure
const createEmptyRow = (index: number): ExpeditionRow => ({
  palletNo: index + 1,
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
  // Use a consistent user ID to avoid authentication issues
  const [userId] = useState('USER123');
  const [companyName] = useState('Fruits For You ');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessageText, setSuccessMessageText] = useState('');
  const [expeditionDate, setExpeditionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [clientName, setClientName] = useState('');
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
    thermokingEtat: ''
  });

  // Initialize rows on component mount
  useEffect(() => {
    // Check URL for expedition ID parameter
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    console.log('URL parameter ID:', id);
    
    if (id) {
      // Load data from database using the ID
      loadExpeditionData(id);
    } else {
      // Load from localStorage as fallback for new forms
      const savedData = localStorage.getItem('ficheExpeditionData');
      if (savedData) {
        try {
          setRows(JSON.parse(savedData));
        } catch (e) {
          console.error('Error parsing saved data:', e);
          initializeEmptyRows();
        }
      } else {
        console.log('No saved data found, initializing empty rows');
        initializeEmptyRows();
      }
    }
  }, []);
  
  // Function to load expedition data from localStorage first, then try Firestore
  const loadExpeditionData = async (id: string) => {
    try {
      console.log('Loading expedition data with ID:', id);
      // First, try to load from localStorage
      const savedExpeditions = localStorage.getItem('savedExpeditions');
      
      if (savedExpeditions) {
        const expeditionsArray: ExpeditionFormData[] = JSON.parse(savedExpeditions);
        const foundExpedition = expeditionsArray.find(exp => exp.id === id);
        
        if (foundExpedition) {
          console.log('Found expedition in localStorage:', foundExpedition);
          setExpeditionId(id);
          setHeaderData(foundExpedition.headerData);
          setRows(foundExpedition.rows);
          setSuccessMessageText('Fiche d\'expédition chargée avec succès!');
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);
          
          // Ensure URL has the correct ID parameter
          const url = new URL(window.location.href);
          url.searchParams.set('id', id);
          window.history.replaceState({}, '', url);
          
          return; // Successfully loaded from localStorage
        }
      }
      
      // If not found in localStorage, try Firestore as a fallback
      try {
        const docRef = collection(firestore, 'expeditions');
        const q = query(docRef, where('id', '==', id));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const expeditionData = querySnapshot.docs[0].data() as ExpeditionFormData;
          console.log('Found expedition in Firestore:', expeditionData);
          setExpeditionId(id);
          setHeaderData(expeditionData.headerData);
          setRows(expeditionData.rows);
          
          // Try to get the PDF from Firebase Storage if it exists
          if (expeditionData.pdfURL) {
            console.log('Found PDF URL:', expeditionData.pdfURL);
            // You can set a state variable to store the PDF URL if needed
          } else {
            // If no PDF URL exists in Firestore, check Firebase Storage directly
            try {
              const storageRef = ref(storage, `reports/${id}_expedition.pdf`);
              const pdfURL = await getDownloadURL(storageRef);
              console.log('Found PDF in storage:', pdfURL);
              // Update the expedition data with the found PDF URL
              expeditionData.pdfURL = pdfURL;
            } catch (storageError) {
              console.log('No PDF found in storage for this expedition');
            }
          }
          
          setSuccessMessageText('Fiche d\'expédition chargée avec succès!');
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);
          
          // Ensure URL has the correct ID parameter
          const url = new URL(window.location.href);
          url.searchParams.set('id', id);
          window.history.replaceState({}, '', url);
          
          // Also save to localStorage for future offline access
          const savedExpeditions = localStorage.getItem('savedExpeditions');
          let expeditionsArray: ExpeditionFormData[] = [];
          
          if (savedExpeditions) {
            expeditionsArray = JSON.parse(savedExpeditions);
          }
          
          expeditionsArray.push(expeditionData);
          localStorage.setItem('savedExpeditions', JSON.stringify(expeditionsArray));
        } else {
          console.error('No expedition found with ID:', id);
          alert('Aucune fiche d\'expédition trouvée avec cet identifiant.');
          // Reset the URL to remove the invalid ID
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch (firestoreError) {
        console.error('Firestore load failed:', firestoreError);
        alert('Aucune fiche d\'expédition trouvée avec cet identifiant.');
        // Reset the URL to remove the invalid ID
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (error) {
      console.error('Error loading expedition data:', error);
      alert('Erreur lors du chargement de la fiche d\'expédition.');
      // Reset the URL to remove the invalid ID
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  // Auto-save to localStorage when rows change
  useEffect(() => {
    if (rows.length > 0) {
      localStorage.setItem('ficheExpeditionData', JSON.stringify(rows));
    }
  }, [rows]);

  const initializeEmptyRows = () => {
    const emptyRows = Array(26).fill(null).map((_, index) => createEmptyRow(index));
    setRows(emptyRows);
  };

  // Handle input changes
  const handleChange = (rowIndex: number, field: keyof ExpeditionRow, value: string) => {
    const updatedRows = [...rows];
    
    // If changing product variety in the first row, apply only to rows with data
    if (field === 'produitVariete' && rowIndex === 0) {
      // Apply to all rows that have some data (not completely empty)
      updatedRows.forEach((row, index) => {
        // Check if row has any data besides produitVariete
        const hasData = row.nbrColis || row.calibre || row.temperatureProduit || 
                       row.etatPalette || row.conformiteEtiquettes || row.dessiccation;
        
        if (index === 0 || hasData) {
          // Always update first row, and rows that have data
          updatedRows[index] = {
            ...row,
            [field]: value
          };
        }
      });
    } else if (field === 'nbrColis' && value && updatedRows[0].produitVariete) {
      // When typing in Nbr Colis, also apply the product variety from first row
      updatedRows[rowIndex] = { 
        ...updatedRows[rowIndex], 
        [field]: value,
        produitVariete: updatedRows[0].produitVariete
      };
    } else if (field !== 'produitVariete' && value && updatedRows[0].produitVariete && !updatedRows[rowIndex].produitVariete) {
      // When typing in any other field (except produitVariete), apply the product variety from first row if current row doesn't have one
      updatedRows[rowIndex] = { 
        ...updatedRows[rowIndex], 
        [field]: value,
        produitVariete: updatedRows[0].produitVariete
      };
    } else {
      // Normal behavior for other changes
      updatedRows[rowIndex] = { 
        ...updatedRows[rowIndex], 
        [field]: value
      };
    }
    
    setRows(updatedRows);
  };

  // Add header data change handler
  const handleHeaderChange = (field: keyof HeaderData, value: string) => {
    setHeaderData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Simple validation to check if there's at least one row with data
  const validateForm = () => {
    const hasAnyData = rows.some(row => 
      row.nbrColis || row.produitVariete || row.calibre || row.temperatureProduit || 
      row.etatPalette || row.conformiteEtiquettes || row.dessiccation
    );
    
    const hasHeaderData = headerData.transporteur && headerData.destination;
    
    return hasAnyData && hasHeaderData;
  };

  // Function to generate, save to Firebase Storage, and download a PDF of the expedition form
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
      const lightGreen: [number, number, number] = [198, 224, 180];
      const darkGreen: [number, number, number] = [76, 175, 80];
      const gray: [number, number, number] = [75, 75, 75];

      // Helper function to apply color arrays
      const applyColor = (color: [number, number, number]) => {
        return color[0] + ',' + color[1] + ',' + color[2];  // Returns "R,G,B" format
      };
      
      // Remove the page border
      // doc.setDrawColor(darkGreen[0], darkGreen[1], darkGreen[2]);
      // doc.setLineWidth(1);
      // doc.roundedRect(5, 5, pageWidth - 10, pageHeight - 10, 3, 3);
      
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
      
      // Destination
      doc.rect(115, checkY, 45, 12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]); // Green title
      doc.text('Nom client :', 117, checkY + 4);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.text(clientName || '', 117, checkY + 9);
      
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
        row.conformiteEtiquettes || row.dessiccation
      );
      
      // Apply enhanced table styling
      (doc as any).autoTable({
        startY: tableY,
        margin: { left: 10, right: 10 },
        head: [[
          { content: 'N° de\npalette', styles: { cellWidth: 20, cellPadding: 2 } },
          { content: 'NBR de\nColis', styles: { cellWidth: 20, cellPadding: 2 } },
          { content: 'Produit/\nVariété', styles: { cellWidth: 30, cellPadding: 2 } },
          { content: 'Calibre', styles: { cellWidth: 20, cellPadding: 2 } },
          { content: 'T° produit', styles: { cellWidth: 20, cellPadding: 2 } },
          { content: 'État de la palette', styles: { cellWidth: 25, cellPadding: 2 } },
          { content: 'Conformité d\'\u00e9tiquettes\n(C/NC)', styles: { cellWidth: 30, cellPadding: 2 } },
          { content: 'Décision\n(C/NC)', styles: { cellWidth: 25, cellPadding: 2 } }
        ]],
        body: filteredRows.map((row, index) => [
          { content: index + 1, styles: { halign: 'center' } },
          { content: row.nbrColis, styles: { halign: 'center' } },
          { content: row.produitVariete, styles: { halign: 'left' } },
          { content: row.calibre, styles: { halign: 'center' } },
          { content: row.temperatureProduit ? `${row.temperatureProduit}°C` : '', styles: { halign: 'center' } },
          { content: row.etatPalette, styles: { halign: 'center' } },
          { content: row.conformiteEtiquettes, styles: { halign: 'center' } },
          { content: row.dessiccation, styles: { halign: 'center' } }
        ]),
        styles: {
          fontSize: 8,
          cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
          lineWidth: 0.1,
          lineColor: [0, 0, 0],
          textColor: [0, 0, 0],
          minCellHeight: 6,
          valign: 'middle',
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [...lightGreen],
          textColor: [0, 0, 0],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
          minCellHeight: 8
        },
        columnStyles: {
          0: { fillColor: [...lightGreen], halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [255, 255, 255]
        },
        rowStyles: {
          0: { fillColor: lightGreen },  // First row green
          1: { fillColor: lightGreen },  // Second row green
          2: { fillColor: lightGreen }   // Third row green
        },
        theme: 'grid',
        didDrawPage: function(data: any) {
          // Add page number
          doc.setFontSize(8);
          doc.text(
            `Page ${data.pageCount}`,
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
      
      // Add footer

      
      // Convert PDF to blob for storage and download
      const pdfOutput = doc.output('arraybuffer');
      const pdfBlob = new Blob([pdfOutput], { type: 'application/pdf' });
      const fileName = `Fiche_Expedition_${format(new Date(), 'yyyyMMdd')}_${headerData.transporteur.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      
      // Skip Firebase Storage entirely due to persistent CORS issues
      const fileId = expeditionId || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      // Use a local PDF URL format
      const localPdfUrl = `local_${fileId}_expedition.pdf`;
      
      try {
        console.log('Using localStorage only for PDFs to avoid CORS issues');
        
        // Save PDF data directly to localStorage for reliable access
        try {
          const reader = new FileReader();
          reader.onloadend = function(this: FileReader, event: ProgressEvent<FileReader>) {
            try {
              const base64data = this.result as string;
              // Store the PDF data in localStorage with the expedition ID as key
              localStorage.setItem(`pdf_${expeditionId || fileId}`, base64data);
              console.log('PDF data saved to localStorage successfully');
            } catch (e) {
              console.error('Error saving PDF data to localStorage:', e);
            }
          };
          reader.readAsDataURL(pdfBlob);
        } catch (localStorageError) {
          console.error('Error storing PDF in localStorage:', localStorageError);
        }
        
        // Update Firestore with local PDF URL reference
        if (expeditionId) {
          try {
            const expeditionsRef = collection(firestore, 'expeditions');
            const q = query(expeditionsRef, where('id', '==', expeditionId));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const docId = querySnapshot.docs[0].id;
              await updateDoc(firestoreDoc(firestore, 'expeditions', docId), {
                pdfURL: localPdfUrl,  // Store reference to local PDF
                updatedAt: serverTimestamp()
              });
              console.log('Updated Firestore with local PDF reference');
            }
          } catch (firestoreError) {
            console.error('Error updating Firestore with PDF reference:', firestoreError);
          }
        }
        
        // Always update localStorage data with PDF URL
        const savedExpeditions = localStorage.getItem('savedExpeditions');
        if (savedExpeditions && expeditionId) {
          let expeditionsArray = JSON.parse(savedExpeditions);
          expeditionsArray = expeditionsArray.map((exp: ExpeditionFormData) => {
            if (exp.id === expeditionId) {
              return { ...exp, pdfURL: localPdfUrl };
            }
            return exp;
          });
          localStorage.setItem('savedExpeditions', JSON.stringify(expeditionsArray));
          
          // Also update archive boxes
          const savedArchiveBoxes = localStorage.getItem('archiveBoxes');
          if (savedArchiveBoxes) {
            let archiveBoxes = JSON.parse(savedArchiveBoxes);
            archiveBoxes = archiveBoxes.map((item: any) => {
              if (item.id === expeditionId) {
                return { ...item, pdfURL: localPdfUrl };
              }
              return item;
            });
            localStorage.setItem('archiveBoxes', JSON.stringify(archiveBoxes));
          }
        }
        
        setSuccessMessageText('PDF généré et sauvegardé localement');
      } catch (error) {
        console.error('Error handling PDF storage:', error);
        // Continue with download even if storage fails
      }
      
      // Download the PDF for the user
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

  // Function to save expedition to localStorage with improved persistence
  const saveExpedition = async (generatePdfAfterSave = false) => {
    // Validate form before saving
    if (!validateForm()) {
      alert("Veuillez remplir au moins une ligne et les informations principales (transporteur et destination).");
      return null;
    }

    setIsSaving(true);
    try {
      console.log('Saving expedition, current ID:', expeditionId);
      // Create or update the expedition ID
      const newExpeditionId = expeditionId || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setExpeditionId(newExpeditionId);
      console.log('Using expedition ID for save:', newExpeditionId);

      // Prepare the expedition data object
      const expeditionData: ExpeditionFormData = {
        id: newExpeditionId,
        name: `Expedition_${headerData.transporteur}_${format(new Date(headerData.date), 'yyyy-MM-dd')}`,
        date: headerData.date,
        headerData,
        rows,
        pdfURL: "", // Will be updated after PDF generation if needed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to localStorage first for immediate persistence
      const savedExpeditions = localStorage.getItem('savedExpeditions');
      let expeditionsArray: ExpeditionFormData[] = [];
      
      if (savedExpeditions) {
        expeditionsArray = JSON.parse(savedExpeditions);
        // Check if we need to update existing or add new
        const existingIndex = expeditionsArray.findIndex(exp => exp.id === newExpeditionId);
        if (existingIndex >= 0) {
          // Keep the existing pdfURL if it exists and we're not regenerating
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
      console.log('Saved to localStorage with ID:', newExpeditionId);

      // Create a simplified archive item reference
      const archiveItem = {
        id: newExpeditionId,
        name: expeditionData.name,
        date: expeditionData.date,
        type: 'expedition',
        pdfURL: expeditionData.pdfURL
      };

      // Save to archive boxes in localStorage
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

      // Try to save to Firestore with fallback for unauthenticated users
      try {
        const currentUserId = auth.currentUser?.uid || 'USER123'; // Use fallback ID if not authenticated
        console.log('🔄 Attempting to save to Firebase with user ID:', currentUserId);
        
        // Check if expedition already exists in Firestore
        const expeditionsRef = collection(firestore, 'expeditions');
        const q = query(expeditionsRef, where('id', '==', newExpeditionId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // Update existing document
          const docId = querySnapshot.docs[0].id;
          console.log('🔄 Updating existing document with ID:', docId);
          await updateDoc(firestoreDoc(firestore, 'expeditions', docId), {
            ...expeditionData,
            userId: currentUserId,
            updatedAt: serverTimestamp()
          });
          console.log('✅ Updated existing expedition in Firestore');
          setSuccessMessageText('✅ Fiche d\'expédition mise à jour dans Firebase et localStorage!');
        } else {
          // Create new document
          console.log('🔄 Creating new document in Firebase...');
          const docRef = await addDoc(expeditionsRef, {
            ...expeditionData,
            userId: currentUserId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log('✅ Created new expedition in Firestore with doc ID:', docRef.id);
          setSuccessMessageText('✅ Fiche d\'expédition sauvegardée dans Firebase et localStorage!');
        }
        
      } catch (firestoreError: any) {
        console.error('❌ Error saving to Firestore:', firestoreError);
        console.error('❌ Firebase error details:', {
          code: firestoreError?.code,
          message: firestoreError?.message,
          stack: firestoreError?.stack
        });
        // Display a user-friendly message with more details
        setSuccessMessageText(`⚠️ Sauvegardé localement seulement (Firebase Error: ${firestoreError?.code || firestoreError?.message || 'Unknown error'})`);
        // Continue since we've already saved to localStorage
      }
      
      // Update URL with expedition ID parameter without reloading the page
      const url = new URL(window.location.href);
      url.searchParams.set('id', newExpeditionId);
      window.history.pushState({}, '', url);
      
      // Generate PDF if requested
      if (generatePdfAfterSave) {
        console.log('Generating PDF after save...');
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
  
  // Navigate to history page
  const goToHistory = () => {
    window.location.href = '/logistique/history';
  };

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl p-6">
        {/* Enhanced Header */}
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

            {/* Form Grid with Enhanced Styling */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl mt-6">
              {/* Date and Time Group */}
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

              {/* Transport Info Group */}
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

              {/* Temperature and Status Group */}
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

              {/* Status Checkboxes - Full Width */}
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
          
          {/* Action Buttons with Enhanced Styling */}
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
                    // First save the expedition data
                    await saveExpedition(false);
                    // Then generate the PDF
                    await generatePDF();
                  } catch (error) {
                    console.error('Error in save and generate PDF flow:', error);
                    // Fallback to just downloading a PDF without Firebase storage
                    const doc = new jsPDF();
                    doc.setFontSize(18);
                    doc.text('Fiche d\'Expédition', 105, 15, { align: 'center' });
                    doc.setFontSize(12);
                    doc.text(`Entreprise: ${companyName}`, 105, 25, { align: 'center' });
                    const pdfBlob = doc.output('blob');
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(pdfBlob);
                    link.download = `Fiche_Expedition_${format(new Date(), 'yyyyMMdd')}.pdf`;
                    link.click();
                    
                    setSuccessMessageText('PDF généré localement uniquement');
                    setShowSuccessMessage(true);
                    setTimeout(() => setShowSuccessMessage(false), 3000);
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
                  // Clear the expedition ID if there is one
                  setExpeditionId(null);
                  // Reset URL parameters
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
        
        {/* Enhanced Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r">
                    N° Palette
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
                    Dessiccation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} 
                      className={`group hover:bg-green-50 transition-colors ${
                        rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      }`}>
                    <td className="px-4 py-3 border-r whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.palletNo}
                    </td>
                    
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
                      <select
                        value={row.dessiccation}
                        onChange={(e) => handleChange(rowIndex, 'dessiccation', e.target.value)}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Enhanced Footer */}
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