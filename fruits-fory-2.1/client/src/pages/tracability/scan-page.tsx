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
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/scan/${lotNumber}`)}`;
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

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/scan/${lotNumber}`)}`;

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

  // Download PDF rapport using advanced template
  const downloadPDF = async () => {
    if (!scannedLot && !scannedMultiLot) return;

    setIsDownloading(true);
    try {
      const lotId = scannedLot 
        ? scannedLot.harvest.lotNumber 
        : (scannedMultiLot?.lotNumber || scannedMultiLot?.id);

      await generateAdvancedPDF(scannedLot, scannedMultiLot);

      toast({
        title: "PDF téléchargé",
        description: `Rapport avancé du lot ${lotId} généré avec succès`,
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Erreur PDF",
        description: "Impossible de générer le rapport PDF. Vérifiez que le lot contient des données valides.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Advanced PDF generation with enhanced UI/UX
  const generateAdvancedPDF = async (avocadoLot: AvocadoTracking | null, multiLot: MultiLot | null) => {
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

      // Convert data
      const lotData = convertToAdvancedLotData(avocadoLot, multiLot);

      // Create PDF
      const pdfDoc = await PDFDocument.create();
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      let pageNumber = 1;

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let { width, height } = page.getSize();

      const colors = {
        primary: rgb(0.05, 0.25, 0.45),
        secondary: rgb(0.13, 0.59, 0.27),
        accent: rgb(1, 0.65, 0.0),
        success: rgb(0.16, 0.66, 0.26),
        warning: rgb(0.92, 0.58, 0.13),
        info: rgb(0.2, 0.6, 0.86),
        error: rgb(0.87, 0.19, 0.39),
        textPrimary: rgb(0.13, 0.13, 0.13),
        textSecondary: rgb(0.45, 0.45, 0.45),
        textLight: rgb(0.65, 0.65, 0.65),
        textInverse: rgb(1, 1, 1),
        backgroundSecondary: rgb(0.97, 0.97, 0.97),
        backgroundCard: rgb(0.99, 0.99, 0.99),
        border: rgb(0.88, 0.88, 0.88),
        borderLight: rgb(0.94, 0.94, 0.94),
        highlight: rgb(0.95, 0.98, 0.95),
      };

      const fonts = {
        bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
        oblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
      };

      const formatDate = (dateString: string, includeTime = false) => {
        if (!dateString) return 'Not recorded';
        const date = new Date(dateString);
        const options: Intl.DateTimeFormatOptions = {
          day: '2-digit', month: 'short', year: 'numeric',
          ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {})
        };
        return date.toLocaleDateString('en-GB', options);
      };

      // Enhanced Header with gradient effect
      const createHeader = () => {
        const headerHeight = 120;
        // Main header background
        page.drawRectangle({ 
          x: 0, 
          y: height - headerHeight, 
          width: width, 
          height: headerHeight, 
          color: colors.primary 
        });
        // Top accent stripe
        page.drawRectangle({ 
          x: 0, 
          y: height - 8, 
          width: width, 
          height: 8, 
          color: colors.secondary 
        });
        // Bottom accent stripe
        page.drawRectangle({ 
          x: 0, 
          y: height - headerHeight, 
          width: width, 
          height: 3, 
          color: colors.accent 
        });
        
        // Company name
        page.drawText('FRUITS FOR YOU', { 
          x: 50, 
          y: height - 50, 
          size: 24, 
          color: colors.textInverse, 
          font: fonts.bold 
        });
        page.drawText('Premium Quality Traceability', { 
          x: 50, 
          y: height - 72, 
          size: 11, 
          color: rgb(0.8, 0.8, 0.8), 
          font: fonts.regular 
        });
        
        // Generation date
        const currentDate = new Date().toLocaleString('en-GB', { hour12: false });
        page.drawText(`Generated: ${currentDate}`, { 
          x: width - 200, 
          y: height - 50, 
          size: 9, 
          color: rgb(0.75, 0.75, 0.75), 
          font: fonts.regular 
        });
        
        return height - headerHeight - 25;
      };

      // Enhanced section header with modern design
      const drawSectionHeader = (title: string, y: number, icon = '●') => {
        const sectionHeight = 40;
        const padding = 45;
        
        // Background with rounded corner effect
        page.drawRectangle({ 
          x: padding, 
          y: y - sectionHeight, 
          width: width - (padding * 2), 
          height: sectionHeight, 
          color: colors.backgroundSecondary,
          borderColor: colors.border,
          borderWidth: 0.5
        });
        
        // Left accent bar
        page.drawRectangle({ 
          x: padding, 
          y: y - sectionHeight, 
          width: 6, 
          height: sectionHeight, 
          color: colors.secondary 
        });
        
        // Icon/bullet
        page.drawText(icon, { 
          x: padding + 18, 
          y: y - 24, 
          size: 12, 
          color: colors.secondary, 
          font: fonts.bold 
        });
        
        // Title
        page.drawText(title, { 
          x: padding + 35, 
          y: y - 24, 
          size: 13, 
          color: colors.primary, 
          font: fonts.bold 
        });
        
        return y - sectionHeight - 15;
      };

      // Enhanced info row with better spacing and card-like design
      const drawInfoRow = (label: string, value: string, y: number, highlight = false) => {
        const rowHeight = 28;
        const leftCol = 70;
        const rightCol = 280;
        const padding = 45;
        
        // Background for row
        if (highlight) {
          page.drawRectangle({
            x: padding + 10,
            y: y - 2,
            width: width - (padding * 2) - 20,
            height: rowHeight - 6,
            color: colors.highlight
          });
        }
        
        // Label
        page.drawText(`${label}`, { 
          x: leftCol, 
          y: y + 6, 
          size: 10, 
          color: colors.textSecondary, 
          font: fonts.bold 
        });
        
        // Value with better formatting
        const displayValue = value || 'Not available';
        page.drawText(displayValue, { 
          x: rightCol, 
          y: y + 6, 
          size: 10, 
          color: value ? colors.textPrimary : colors.textLight, 
          font: value ? fonts.regular : fonts.oblique 
        });
        
        // Subtle divider line
        page.drawLine({
          start: { x: leftCol, y: y - 8 },
          end: { x: width - 70, y: y - 8 },
          thickness: 0.3,
          color: colors.borderLight
        });
        
        return y - rowHeight - 2;
      };

      // Summary card drawer
      const drawSummaryCard = (title: string, value: string, x: number, y: number, w: number, h: number, accentColor: any) => {
        // Card background
        page.drawRectangle({
          x, y: y - h, width: w, height: h,
          color: colors.backgroundCard,
          borderColor: colors.border,
          borderWidth: 1
        });
        
        // Top accent
        page.drawRectangle({
          x, y: y - 4, width: w, height: 4,
          color: accentColor
        });
        
        // Title
        page.drawText(title, {
          x: x + 15, y: y - 30,
          size: 9, color: colors.textSecondary,
          font: fonts.regular
        });
        
        // Value
        page.drawText(value, {
          x: x + 15, y: y - 52,
          size: 13, color: colors.textPrimary,
          font: fonts.bold
        });
      };

      // Page footer with page number
      const drawFooter = () => {
        const footerY = 40;
        
        // Footer line
        page.drawLine({
          start: { x: 50, y: footerY + 30 },
          end: { x: width - 50, y: footerY + 30 },
          thickness: 0.5,
          color: colors.border
        });
        
        // Company info
        page.drawText('FRUITS FOR YOU - Premium Quality Assurance', { 
          x: 50, 
          y: footerY + 10, 
          size: 9, 
          color: colors.textSecondary, 
          font: fonts.bold 
        });
        
        // Page number
        page.drawText(`Page ${pageNumber}`, { 
          x: width - 100, 
          y: footerY + 10, 
          size: 9, 
          color: colors.textLight, 
          font: fonts.regular 
        });
        
        // Document ID
        page.drawText(`Doc ID: TR-${lotData.harvest.lotNumber}-${Date.now().toString().slice(-6)}`, { 
          x: 50, 
          y: footerY - 5, 
          size: 7, 
          color: colors.textLight, 
          font: fonts.regular 
        });
      };

      // New page helper
      const checkAndAddNewPage = (requiredSpace: number) => {
        if (currentY < requiredSpace + 80) {
          drawFooter();
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          ({ width, height } = page.getSize());
          pageNumber++;
          currentY = height - 60;
          return true;
        }
        return false;
      };

      // Start first page
      let currentY = createHeader();

      // Title section with enhanced design
      page.drawRectangle({
        x: 45,
        y: currentY - 85,
        width: width - 90,
        height: 75,
        color: colors.backgroundCard,
        borderColor: colors.secondary,
        borderWidth: 2
      });
      
      page.drawText('AVOCADO TRACEABILITY REPORT', { 
        x: 60, 
        y: currentY - 35, 
        size: 18, 
        color: colors.primary, 
        font: fonts.bold 
      });
      
      page.drawText(`Lot Number: ${lotData.harvest.lotNumber}`, { 
        x: 60, 
        y: currentY - 60, 
        size: 14, 
        color: colors.secondary, 
        font: fonts.bold 
      });
      
      // Status badge
      const statusText = avocadoLot?.status || multiLot?.status || 'Active';
      const statusColor = statusText === 'completed' ? colors.success : colors.info;
      page.drawRectangle({
        x: width - 150,
        y: currentY - 65,
        width: 90,
        height: 25,
        color: statusColor
      });
      page.drawText(statusText.toUpperCase(), {
        x: width - 140,
        y: currentY - 55,
        size: 10,
        color: colors.textInverse,
        font: fonts.bold
      });
      
      currentY -= 105;

      // Summary Cards Section
      const cardWidth = (width - 140) / 3;
      const cardHeight = 70;
      
      drawSummaryCard(
        'Harvest Date',
        formatDate(lotData.harvest.harvestDate) || 'N/A',
        50,
        currentY,
        cardWidth,
        cardHeight,
        colors.secondary
      );
      
      drawSummaryCard(
        'Variety',
        lotData.harvest.variety || 'N/A',
        50 + cardWidth + 20,
        currentY,
        cardWidth,
        cardHeight,
        colors.info
      );
      
      drawSummaryCard(
        'Net Weight',
        lotData.packaging.netWeight ? `${lotData.packaging.netWeight} kg` : 'N/A',
        50 + (cardWidth + 20) * 2,
        currentY,
        cardWidth,
        cardHeight,
        colors.accent
      );
      
      currentY -= cardHeight + 25;

      // TRACEABILITY PROCESS with enhanced professional design
      const raw = avocadoLot ? avocadoLot : (multiLot ? multiLot : null);
      const tsToString = (val: any) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && 'seconds' in val) {
          try {
            const ms = (val.seconds || 0) * 1000 + Math.floor((val.nanoseconds || 0) / 1e6);
            return new Date(ms).toLocaleString('en-GB', { hour12: false });
          } catch (e) {
            return String(val);
          }
        }
        return String(val);
      };

      if (raw) {
        const rAny = raw as any;
        checkAndAddNewPage(300);
        
        // Professional section header with shadow effect
        const headerY = currentY;
        page.drawRectangle({
          x: 40,
          y: headerY - 60,
          width: width - 80,
          height: 55,
          color: colors.primary
        });
        
        page.drawRectangle({
          x: 40,
          y: headerY - 5,
          width: width - 80,
          height: 5,
          color: colors.accent
        });
        
        page.drawText('COMPLETE TRACEABILITY CHAIN', {
          x: 55,
          y: headerY - 30,
          size: 16,
          color: colors.textInverse,
          font: fonts.bold
        });
        
        page.drawText('Detailed Process Documentation & Audit Trail', {
          x: 55,
          y: headerY - 48,
          size: 10,
          color: rgb(0.85, 0.85, 0.85),
          font: fonts.regular
        });
        
        currentY = headerY - 75;

        // Overview Card with Metadata
        page.drawRectangle({
          x: 50,
          y: currentY - 110,
          width: width - 100,
          height: 105,
          color: colors.backgroundCard,
          borderColor: colors.border,
          borderWidth: 1
        });
        
        page.drawRectangle({
          x: 50,
          y: currentY - 5,
          width: width - 100,
          height: 3,
          color: colors.info
        });
        
        page.drawText('OVERVIEW & STATUS', {
          x: 65,
          y: currentY - 28,
          size: 11,
          color: colors.primary,
          font: fonts.bold
        });
        
        currentY -= 45;
        
        // Metadata in two columns
        const col1X = 70;
        const col2X = width / 2 + 20;
        let metaY = currentY;
        
        const metadataLeft = [
          ['Created By', String(rAny.createdBy || 'System')],
          ['Status', String(rAny.status || 'Active')],
          ['Created', String(tsToString(rAny.createdAt) || 'N/A')]
        ];
        
        const metadataRight = [
          ['Updated', String(tsToString(rAny.updatedAt) || 'N/A')],
          ['Completed', String(tsToString(rAny.completedAt) || 'N/A')],
          ['Steps', String(rAny.completedSteps ? (Array.isArray(rAny.completedSteps) ? rAny.completedSteps.length : rAny.completedSteps) : '0')]
        ];
        
        for (let i = 0; i < metadataLeft.length; i++) {
          const [label, value] = metadataLeft[i];
          page.drawText(`${label}:`, {
            x: col1X,
            y: metaY,
            size: 9,
            color: colors.textSecondary,
            font: fonts.bold
          });
          page.drawText(String(value), {
            x: col1X + 70,
            y: metaY,
            size: 9,
            color: colors.textPrimary,
            font: fonts.regular
          });
          metaY -= 18;
        }
        
        metaY = currentY;
        for (let i = 0; i < metadataRight.length; i++) {
          const [label, value] = metadataRight[i];
          page.drawText(`${label}:`, {
            x: col2X,
            y: metaY,
            size: 9,
            color: colors.textSecondary,
            font: fonts.bold
          });
          page.drawText(String(value), {
            x: col2X + 70,
            y: metaY,
            size: 9,
            color: colors.textPrimary,
            font: fonts.regular
          });
          metaY -= 18;
        }
        
        currentY -= 80;

        // Process stages with premium card design
        const processStages = [
          { name: 'HARVEST', data: rAny.harvest, icon: 'H', color: colors.secondary },
          { name: 'TRANSPORT', data: rAny.transport, icon: 'T', color: colors.info },
          { name: 'PACKAGING', data: rAny.packaging, icon: 'P', color: colors.warning },
          { name: 'STORAGE', data: rAny.storage, icon: 'S', color: colors.accent },
          { name: 'SORTING', data: rAny.sorting, icon: 'Q', color: colors.success },
          { name: 'EXPORT', data: rAny.export, icon: 'E', color: colors.error },
          { name: 'DELIVERY', data: rAny.delivery, icon: 'D', color: colors.primary }
        ];

        for (const stage of processStages) {
          if (!stage.data) continue;
          
          checkAndAddNewPage(250);
          
          // Premium stage card
          const cardY = currentY;
          const cardHeight = 45;
          
          // Card background
          page.drawRectangle({
            x: 50,
            y: cardY - cardHeight,
            width: width - 100,
            height: cardHeight,
            color: colors.backgroundCard,
            borderColor: colors.border,
            borderWidth: 1.5
          });
          
          // Colored left border
          page.drawRectangle({
            x: 50,
            y: cardY - cardHeight,
            width: 5,
            height: cardHeight,
            color: stage.color
          });
          
          // Icon circle
          page.drawCircle({
            x: 75,
            y: cardY - 22,
            size: 14,
            color: stage.color
          });
          
          page.drawText(stage.icon, {
            x: 71,
            y: cardY - 27,
            size: 12,
            color: colors.textInverse,
            font: fonts.bold
          });
          
          // Stage name
          page.drawText(stage.name, {
            x: 100,
            y: cardY - 20,
            size: 13,
            color: colors.primary,
            font: fonts.bold
          });
          
          page.drawText('Process Details', {
            x: 100,
            y: cardY - 35,
            size: 9,
            color: colors.textSecondary,
            font: fonts.regular
          });
          
          currentY = cardY - cardHeight - 12;

          // Stage fields in professional grid
          const stageFields = extractStageFields(stage.name, stage.data, tsToString, formatDate);
          
          // Draw fields in a cleaner format
          page.drawRectangle({
            x: 55,
            y: currentY - (stageFields.length * 24) - 15,
            width: width - 110,
            height: (stageFields.length * 24) + 10,
            color: rgb(0.99, 0.99, 0.99),
            borderColor: colors.borderLight,
            borderWidth: 0.5
          });
          
          currentY -= 10;
          
          for (let i = 0; i < stageFields.length; i++) {
            const [label, value] = stageFields[i];
            if (value && value !== 'N/A') {
              const fieldY = currentY - (i * 24);
              
              // Alternating row background
              if (i % 2 === 0) {
                page.drawRectangle({
                  x: 55,
                  y: fieldY - 20,
                  width: width - 110,
                  height: 22,
                  color: colors.backgroundSecondary
                });
              }
              
              // Label
              page.drawText(label, {
                x: 70,
                y: fieldY - 8,
                size: 9,
                color: colors.textSecondary,
                font: fonts.bold
              });
              
              // Value - truncate if too long
              const maxValueWidth = width - 300;
              let displayValue = String(value); // Ensure it's a string
              if (fonts.regular.widthOfTextAtSize(displayValue, 9) > maxValueWidth) {
                while (fonts.regular.widthOfTextAtSize(displayValue + '...', 9) > maxValueWidth && displayValue.length > 0) {
                  displayValue = displayValue.slice(0, -1);
                }
                displayValue += '...';
              }
              
              page.drawText(displayValue, {
                x: 240,
                y: fieldY - 8,
                size: 9,
                color: colors.textPrimary,
                font: fonts.regular
              });
            }
          }
          
          currentY -= (stageFields.filter(([, v]) => v && v !== 'N/A').length * 24) + 25;
        }
      }

      // Helper function to extract stage fields
      function extractStageFields(stageName: string, data: any, tsToString: any, formatDate: any): [string, string][] {
        const fields: [string, string][] = [];
        
        switch(stageName) {
          case 'HARVEST':
            fields.push(['Lot Number', String(data.lotNumber || 'N/A')]);
            fields.push(['Farm Location', String(data.farmLocation || 'N/A')]);
            fields.push(['Harvest Date', data.harvestDate ? String(formatDate(data.harvestDate)) : 'N/A']);
            fields.push(['Variety', String(data.variety || 'N/A')]);
            fields.push(['Farmer ID', String(data.farmerId || 'N/A')]);
            break;
          case 'TRANSPORT':
            fields.push(['Departure Time', data.departureDateTime ? String(tsToString(data.departureDateTime)) : 'N/A']);
            fields.push(['Arrival Time', data.arrivalDateTime ? String(tsToString(data.arrivalDateTime)) : 'N/A']);
            fields.push(['Vehicle ID', String(data.vehicleId || 'N/A')]);
            fields.push(['Driver Name', String(data.driverName || 'N/A')]);
            fields.push(['Transport Company', String(data.transportCompany || 'N/A')]);
            fields.push(['Temperature', data.temperature !== undefined ? `${data.temperature}°C` : 'N/A']);
            break;
          case 'PACKAGING':
            fields.push(['Packaging Date', data.packagingDate ? String(tsToString(data.packagingDate)) : 'N/A']);
            fields.push(['Box ID', String(data.boxId || 'N/A')]);
            fields.push(['Palette Numbers', Array.isArray(data.paletteNumbers) ? data.paletteNumbers.join(', ') : 'N/A']);
            fields.push(['Box Weights', Array.isArray(data.boxWeights) ? data.boxWeights.join(', ') : 'N/A']);
            fields.push(['Calibers', Array.isArray(data.calibers) ? data.calibers.join(', ') : 'N/A']);
            fields.push(['Worker IDs', Array.isArray(data.workerIds) ? data.workerIds.join(', ') : 'N/A']);
            fields.push(['Net Weight', data.netWeight !== undefined ? `${data.netWeight} kg` : 'N/A']);
            fields.push(['Avocado Count', data.avocadoCount !== undefined ? String(data.avocadoCount) : 'N/A']);
            break;
          case 'STORAGE':
            fields.push(['Warehouse', String(data.warehouseName || data.warehouseId || 'N/A')]);
            fields.push(['Storage Room', String(data.storageRoomId || 'N/A')]);
            fields.push(['Entry Date', data.entryDate ? String(tsToString(data.entryDate)) : 'N/A']);
            fields.push(['Exit Date', data.exitDate ? String(tsToString(data.exitDate)) : 'N/A']);
            fields.push(['Temperature', data.storageTemperature !== undefined ? `${data.storageTemperature}°C` : 'N/A']);
            break;
          case 'SORTING':
            fields.push(['Sorting Date', data.sortingDate ? String(tsToString(data.sortingDate)) : 'N/A']);
            fields.push(['Quality Grade', String(data.qualityGrade || 'N/A')]);
            fields.push(['Rejected Count', data.rejectedCount !== undefined ? String(data.rejectedCount) : 'N/A']);
            fields.push(['Notes', String(data.notes || 'N/A')]);
            break;
          case 'EXPORT':
            fields.push(['Container ID', String(data.containerId || data.containerNumber || 'N/A')]);
            fields.push(['Loading Date', data.loadingDate ? String(tsToString(data.loadingDate)) : 'N/A']);
            fields.push(['Destination', String(data.destination || 'N/A')]);
            fields.push(['Vehicle ID', String(data.vehicleId || 'N/A')]);
            fields.push(['Driver Name', String(data.driverName || 'N/A')]);
            break;
          case 'DELIVERY':
            fields.push(['Actual Delivery', data.actualDeliveryDate ? String(tsToString(data.actualDeliveryDate)) : 'N/A']);
            fields.push(['Estimated Delivery', data.estimatedDeliveryDate ? String(tsToString(data.estimatedDeliveryDate)) : 'N/A']);
            fields.push(['Client Name', String(data.clientName || 'N/A')]);
            fields.push(['Client Location', String(data.clientLocation || 'N/A')]);
            fields.push(['Notes', String(data.notes || 'N/A')]);
            break;
        }
        
        return fields;
      }

      // Final professional certification footer
      checkAndAddNewPage(150);
      
      // Certificate section with premium design
      currentY -= 30;
      
      // Certificate border
      page.drawRectangle({
        x: 45,
        y: currentY - 100,
        width: width - 90,
        height: 95,
        color: colors.backgroundCard,
        borderColor: colors.secondary,
        borderWidth: 2
      });
      
      // Top accent bar
      page.drawRectangle({
        x: 45,
        y: currentY - 5,
        width: width - 90,
        height: 5,
        color: colors.success
      });
      
      // Certificate icon/badge
      page.drawCircle({
        x: 80,
        y: currentY - 50,
        size: 20,
        color: colors.success
      });
      
      page.drawText('V', {
        x: 75,
        y: currentY - 56,
        size: 16,
        color: colors.textInverse,
        font: fonts.bold
      });
      
      // Certificate text
      page.drawText('CERTIFIED TRACEABILITY DOCUMENT', {
        x: 115,
        y: currentY - 40,
        size: 13,
        color: colors.primary,
        font: fonts.bold
      });
      
      page.drawText('This document certifies the complete chain of custody and traceability', {
        x: 115,
        y: currentY - 60,
        size: 9,
        color: colors.textSecondary,
        font: fonts.regular
      });
      
      page.drawText('for the specified avocado lot in accordance with international standards.', {
        x: 115,
        y: currentY - 73,
        size: 9,
        color: colors.textSecondary,
        font: fonts.regular
      });
      
      // Certification details
      const certDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      page.drawText(`Certification Date: ${certDate}`, {
        x: 115,
        y: currentY - 88,
        size: 8,
        color: colors.textLight,
        font: fonts.oblique
      });
      
      drawFooter();

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const fileName = `Avocado-Traceability-Report-${lotData.harvest.lotNumber}-${new Date().toISOString().split('T')[0]}.pdf`;
      const link = document.createElement('a'); 
      link.href = url; 
      link.download = fileName; 
      document.body.appendChild(link); 
      link.click(); 
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (error) {
      console.error('Error generating advanced PDF:', error);
      throw error;
    }
  };

  // Convert lot data to the format expected by advanced PDF template
  const convertToAdvancedLotData = (avocadoLot: AvocadoTracking | null, multiLot: MultiLot | null) => {
    if (avocadoLot) {
      return {
        harvest: {
          lotNumber: avocadoLot.harvest.lotNumber,
          harvestDate: avocadoLot.harvest.harvestDate,
          farmLocation: avocadoLot.harvest.farmLocation,
          variety: avocadoLot.harvest.variety,
          qualityScore: 'N/A'
        },
        transport: {
          arrivalDateTime: avocadoLot.transport.arrivalDateTime,
          vehicleId: avocadoLot.transport.vehicleId,
          driverName: avocadoLot.transport.driverName,
          temperature: avocadoLot.transport.temperature
        },
        sorting: {
          sortingDate: avocadoLot.sorting.sortingDate,
          qualityGrade: avocadoLot.sorting.qualityGrade,
          acceptedQuantity: undefined,
          rejectedQuantity: avocadoLot.sorting.rejectedCount
        },
        packaging: {
          packagingDate: avocadoLot.packaging.packagingDate,
          netWeight: avocadoLot.packaging.netWeight,
          packagingType: avocadoLot.packaging.boxType,
          unitsCount: avocadoLot.packaging.avocadoCount
        },
        storage: {
          entryDate: avocadoLot.storage?.entryDate || '',
          storageZone: avocadoLot.storage?.storageRoomId || '',
          temperature: avocadoLot.storage?.storageTemperature,
          humidity: undefined
        },
        export: {
          loadingDate: avocadoLot.export?.loadingDate || '',
          destination: avocadoLot.export?.destination || '',
          containerNumber: avocadoLot.export?.containerId || '',
          shippingLine: 'N/A'
        },
        delivery: {
          actualDeliveryDate: avocadoLot.delivery.actualDeliveryDate || '',
          customerName: avocadoLot.delivery.clientName,
          deliveryStatus: avocadoLot.delivery.actualDeliveryDate ? 'Delivered' : 'Pending',
          receivedBy: 'N/A'
        }
      };
    } else if (multiLot) {
      return {
        harvest: {
          lotNumber: multiLot.lotNumber || multiLot.id,
          harvestDate: multiLot.harvest?.harvestDate || '',
          farmLocation: multiLot.harvest?.farmLocation || '',
          variety: multiLot.harvest?.variety || 'Mixed varieties',
          qualityScore: 'N/A'
        },
        transport: {
          arrivalDateTime: '',
          vehicleId: '',
          driverName: '',
          temperature: undefined
        },
        sorting: {
          sortingDate: '',
          qualityGrade: '',
          acceptedQuantity: undefined,
          rejectedQuantity: undefined
        },
        packaging: {
          packagingDate: '',
          netWeight: undefined,
          packagingType: '',
          unitsCount: undefined
        },
        storage: {
          entryDate: '',
          storageZone: '',
          temperature: undefined,
          humidity: undefined
        },
        export: {
          loadingDate: '',
          destination: '',
          containerNumber: '',
          shippingLine: ''
        },
        delivery: {
          actualDeliveryDate: '',
          customerName: '',
          deliveryStatus: multiLot.status || 'Active',
          receivedBy: ''
        }
      };
    }
    
    // Default empty structure
    return {
      harvest: { lotNumber: '', harvestDate: '', farmLocation: '', variety: '', qualityScore: '' },
      transport: { arrivalDateTime: '', vehicleId: '', driverName: '', temperature: undefined },
      sorting: { sortingDate: '', qualityGrade: '', acceptedQuantity: undefined, rejectedQuantity: undefined },
      packaging: { packagingDate: '', netWeight: undefined, packagingType: '', unitsCount: undefined },
      storage: { entryDate: '', storageZone: '', temperature: undefined, humidity: undefined },
      export: { loadingDate: '', destination: '', containerNumber: '', shippingLine: '' },
      delivery: { actualDeliveryDate: '', customerName: '', deliveryStatus: '', receivedBy: '' }
    };
  };

  // View lot details
  const viewDetails = () => {
    if (scannedLot) {
      setLocation(`/lots/${scannedLot.harvest.lotNumber}`);
    } else if (scannedMultiLot) {
      setLocation(`/multi-lot-detail/${scannedMultiLot.id}`);
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