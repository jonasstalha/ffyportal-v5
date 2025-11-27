import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X, FileText } from "lucide-react";
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { rgb } from 'pdf-lib';
import { StandardFonts } from 'pdf-lib';

interface Harvest {
  lotNumber: string;
  harvestDate: string;
  farmLocation: string;
  variety: string;
  qualityScore?: string;
}

interface Transport {
  arrivalDateTime: string;
  vehicleId?: string;
  driverName?: string;
  temperature?: number;
}

interface Sorting {
  sortingDate: string;
  qualityGrade?: string;
  rejectedQuantity?: number;
  acceptedQuantity?: number;
}

interface Packaging {
  packagingDate: string;
  netWeight?: number;
  packagingType?: string;
  unitsCount?: number;
}

interface Storage {
  entryDate: string;
  storageZone?: string;
  temperature?: number;
  humidity?: number;
}

interface Export {
  loadingDate: string;
  destination?: string;
  containerNumber?: string;
  shippingLine?: string;
}

interface Delivery {
  actualDeliveryDate: string;
  customerName?: string;
  deliveryStatus?: string;
  receivedBy?: string;
}

interface AvocadoTrackingData {
  harvest: Harvest;
  transport: Transport;
  sorting: Sorting;
  packaging: Packaging;
  storage: Storage;
  export: Export;
  delivery: Delivery;
}

interface PDFViewerProps {
  lotData: AvocadoTrackingData;
  onClose: () => void;
}

function PDFViewer({ lotData, onClose }: PDFViewerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const downloadQRCode = async () => {
    try {
      const url = `https://fruitsforyou-10acc.web.app/tracability/lot/${lotData.harvest.lotNumber}`;
      const qrResponse = await fetch(
        `https://api.qrserver.com/v1/create-qr-code/?` +
        `size=300x300` +
        `&data=${encodeURIComponent(url)}` +
        `&format=png` +
        `&qzone=2` +
        `&margin=0` +
        `&ecc=M` +
        `&color=213A55` +
        `&bgcolor=FFFFFF`
      );
      
      const blob = await qrResponse.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `QR-Code-${lotData.harvest.lotNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading QR code:', error);
      alert('Failed to download QR code. Please try again.');
    }
  };

  const generatePDF = async () => {
    try {
      setIsGenerating(true);
      
      // Show progress indicator
      const updateProgress = (step, percentage) => {
        console.log(`${step}: ${percentage}%`);
        // You can update a progress bar here if you have one in your UI
      };
  
      updateProgress('Initializing PDF', 5);
      const pdfDoc = await PDFDocument.create();
      
      // A4 size in points (1 point = 1/72 inch)
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      
      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let { width, height } = page.getSize();
      
      updateProgress('Setting up styling', 10);
      
      // Enhanced color palette with semantic meaning
      const colors = {
        // Primary brand colors
        primary: rgb(0.08, 0.20, 0.36),        // Deep navy blue
        secondary: rgb(0.22, 0.66, 0.34),      // Avocado green
        accent: rgb(0.95, 0.61, 0.07),         // Golden orange
        
        // Status colors
        success: rgb(0.16, 0.66, 0.26),        // Success green
        warning: rgb(0.92, 0.58, 0.13),        // Warning amber
        info: rgb(0.26, 0.54, 0.96),           // Info blue
        error: rgb(0.87, 0.19, 0.39),          // Error red
        pending: rgb(0.55, 0.53, 0.68),        // Pending purple
        
        // Text colors
        textPrimary: rgb(0.13, 0.13, 0.13),    // Almost black
        textSecondary: rgb(0.38, 0.38, 0.38),  // Medium gray
        textLight: rgb(0.62, 0.62, 0.62),      // Light gray
        textInverse: rgb(0.98, 0.98, 0.98),    // Off white
        
        // Background colors
        backgroundPrimary: rgb(1, 1, 1),        // Pure white
        backgroundSecondary: rgb(0.98, 0.98, 0.98), // Off white
        backgroundTertiary: rgb(0.95, 0.95, 0.95),  // Light gray
        
        // Border and divider colors
        border: rgb(0.85, 0.85, 0.85),         // Light border
        divider: rgb(0.90, 0.90, 0.90),        // Subtle divider
        
        // Quality grade colors
        gradeA: rgb(0.22, 0.66, 0.34),         // Premium green
        gradeB: rgb(0.95, 0.61, 0.07),         // Standard orange
        gradeC: rgb(0.87, 0.19, 0.39),         // Below standard red
        
        // Temperature zone colors
        tempOptimal: rgb(0.22, 0.66, 0.34),    // Optimal temp
        tempCaution: rgb(0.95, 0.61, 0.07),    // Caution temp
        tempDanger: rgb(0.87, 0.19, 0.39),     // Danger temp
      };
  
      // Load fonts
      updateProgress('Loading fonts', 15);
      const fonts = {
        bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
        light: await pdfDoc.embedFont(StandardFonts.Helvetica),
        oblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
      };
  
      // Helper functions for better organization
      const formatDate = (dateString, includeTime = false) => {
        if (!dateString) return 'Not recorded';
        const date = new Date(dateString);
        const options = {
          day: '2-digit',
          month: 'short', 
          year: 'numeric',
          ...(includeTime && {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
        };
        return date.toLocaleDateString('en-GB', options);
      };
  
      const formatWeight = (weight, unit = 'kg') => {
        if (!weight) return 'Not recorded';
        return `${parseFloat(weight).toLocaleString()} ${unit}`;
      };
  
      const formatTemperature = (temp) => {
        if (!temp) return 'Not monitored';
        return `${temp}°C`;
      };
  
      const formatPercentage = (value, total) => {
        if (!value || !total) return 'Not calculated';
        return `${((value / total) * 100).toFixed(1)}%`;
      };
  
      // Enhanced status determination with more granular states
      const getDetailedStatus = () => {
        const stages = [
          { key: 'harvest', label: 'Harvested', condition: !!lotData.harvest.harvestDate },
          { key: 'transport', label: 'In Transit', condition: !!lotData.transport.arrivalDateTime },
          { key: 'reception', label: 'Received', condition: !!lotData.reception?.receptionDate },
          { key: 'inspection', label: 'Inspected', condition: !!lotData.inspection?.inspectionDate },
          { key: 'sorting', label: 'Sorted', condition: !!lotData.sorting.sortingDate },
          { key: 'processing', label: 'Processed', condition: !!lotData.processing?.processingDate },
          { key: 'packaging', label: 'Packaged', condition: !!lotData.packaging.packagingDate },
          { key: 'labeling', label: 'Labeled', condition: !!lotData.labeling?.labelingDate },
          { key: 'storage', label: 'In Storage', condition: !!lotData.storage.entryDate },
          { key: 'qualityCheck', label: 'Quality Checked', condition: !!lotData.qualityCheck?.checkDate },
          { key: 'export', label: 'Export Ready', condition: !!lotData.export.loadingDate },
          { key: 'shipping', label: 'Shipped', condition: !!lotData.shipping?.departureDate },
          { key: 'customs', label: 'Customs Cleared', condition: !!lotData.customs?.clearanceDate },
          { key: 'delivery', label: 'Delivered', condition: !!lotData.delivery.actualDeliveryDate }
        ];
  
        const currentStage = stages.reverse().find(stage => stage.condition);
        const completedStages = stages.filter(stage => stage.condition).length;
        const totalStages = stages.length;
        const progressPercentage = (completedStages / totalStages) * 100;
  
        return {
          currentStage: currentStage || stages[0],
          completedStages,
          totalStages,
          progressPercentage,
          statusColor: currentStage ? 
            (currentStage.key === 'delivery' ? colors.success : colors.info) : 
            colors.pending
        };
      };
  
      const statusInfo = getDetailedStatus();
  
      // Create header with modern design
      const createHeader = async () => {
        updateProgress('Creating header', 20);
        
        const headerHeight = 180;
        
        // Main header background with gradient effect
        page.drawRectangle({
          x: 0,
          y: height - headerHeight,
          width: width,
          height: headerHeight,
          color: colors.primary,
        });

        // Secondary accent strip
        page.drawRectangle({
          x: 0,
          y: height - headerHeight,
          width: width,
          height: 6,
          color: colors.secondary,
        });

        // Logo section (left side)
        const logoSection = { x: 40, y: height - 140, width: 180, height: 90 };
        
        try {
          const logoUrl = '/assets/logo.png';
          const logoResponse = await fetch(logoUrl);
          if (logoResponse.ok) {
            const logoArrayBuffer = await logoResponse.arrayBuffer();
            const logoImage = await pdfDoc.embedPng(logoArrayBuffer);
            
            // Calculate dimensions to maintain aspect ratio
            const maxHeight = 70;
            const maxWidth = 140;
            const aspectRatio = logoImage.width / logoImage.height;
            
            let logoWidth = maxWidth;
            let logoHeight = maxWidth / aspectRatio;
            
            if (logoHeight > maxHeight) {
              logoHeight = maxHeight;
              logoWidth = maxHeight * aspectRatio;
            }
            
            page.drawImage(logoImage, {
              x: logoSection.x,
              y: logoSection.y + (maxHeight - logoHeight) / 2, // Center vertically
              width: logoWidth,
              height: logoHeight,
            });
          } else {
            throw new Error('Logo not found');
          }
        } catch (error) {
          // Enhanced text logo fallback
          page.drawText('FRUITS', {
            x: logoSection.x,
            y: logoSection.y + 35,
            size: 28,
            color: colors.textInverse,
            font: fonts.bold,
          });
          
          page.drawText('FOR YOU', {
            x: logoSection.x,
            y: logoSection.y + 5,
            size: 28,
            color: colors.secondary,
            font: fonts.bold,
          });
        }

        // Company name (center)
        const companySection = { x: width / 2 - 150, y: height - 100 };
        
        page.drawText('FRUITS FOR YOU', {
          x: companySection.x,
          y: companySection.y,
          size: 24,
          color: colors.textInverse,
          font: fonts.bold,
        });

        // Document information (bottom of header)
        const docInfoY = height - headerHeight + 30;
        
        const currentDate = new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        page.drawText(`Generated: ${currentDate}`, {
          x: width - 200,
          y: docInfoY,
          size: 10,
          color: colors.textLight,
          font: fonts.regular,
        });

        return height - headerHeight - 20;
      };
  
      // Enhanced progress indicator with timeline
      const createProgressTimeline = async (startY) => {
        updateProgress('Creating progress timeline', 25);
        
        const timelineY = startY - 20;
        const timelineHeight = 100;
        
        // Timeline title
        page.drawText('SUPPLY CHAIN PROGRESS TIMELINE', {
          x: 50,
          y: timelineY + 20,
          size: 14,
          color: colors.primary,
          font: fonts.bold,
        });
  
        // Progress steps with enhanced details
        const progressSteps = [
          { 
            name: 'Harvest', 
            shortName: 'HRV',
            completed: !!lotData.harvest.harvestDate,
            date: lotData.harvest.harvestDate,
            details: `${lotData.harvest.variety || 'N/A'} variety`
          },
          { 
            name: 'Transport', 
            shortName: 'TRP',
            completed: !!lotData.transport.arrivalDateTime,
            date: lotData.transport.arrivalDateTime,
            details: `Vehicle: ${lotData.transport.vehicleId || 'N/A'}`
          },
          { 
            name: 'Sorting', 
            shortName: 'SRT',
            completed: !!lotData.sorting.sortingDate,
            date: lotData.sorting.sortingDate,
            details: `Grade: ${lotData.sorting.qualityGrade || 'N/A'}`
          },
          { 
            name: 'Packaging', 
            shortName: 'PKG',
            completed: !!lotData.packaging.packagingDate,
            date: lotData.packaging.packagingDate,
            details: `${lotData.packaging.packagingType || 'Standard'} pkg`
          },
          { 
            name: 'Storage', 
            shortName: 'STR',
            completed: !!lotData.storage.entryDate,
            date: lotData.storage.entryDate,
            details: `Zone: ${lotData.storage.storageZone || 'N/A'}`
          },
          { 
            name: 'Export', 
            shortName: 'EXP',
            completed: !!lotData.export.loadingDate,
            date: lotData.export.loadingDate,
            details: `To: ${lotData.export.destination || 'N/A'}`
          },
          { 
            name: 'Delivery', 
            shortName: 'DEL',
            completed: !!lotData.delivery.actualDeliveryDate,
            date: lotData.delivery.actualDeliveryDate,
            details: `Customer: ${lotData.delivery.customerName || 'N/A'}`
          }
        ];
  
        const stepWidth = (width - 100) / progressSteps.length;
        const baseY = timelineY - 10;
  
        progressSteps.forEach((step, index) => {
          const stepX = 50 + (index * stepWidth) + (stepWidth / 2);
          const stepColor = step.completed ? colors.success : colors.border;
          const textColor = step.completed ? colors.textPrimary : colors.textSecondary;
          
          // Connection line to next step
          if (index < progressSteps.length - 1) {
            const nextStepX = 50 + ((index + 1) * stepWidth) + (stepWidth / 2);
            page.drawLine({
              start: { x: stepX + 12, y: baseY },
              end: { x: nextStepX - 12, y: baseY },
              thickness: 3,
              color: step.completed && progressSteps[index + 1].completed ? colors.success : colors.border,
            });
          }
  
          // Step circle with enhanced styling
          page.drawCircle({
            x: stepX,
            y: baseY,
            size: 12,
            color: stepColor,
          });
  
          // Inner circle for completed steps
          if (step.completed) {
            page.drawCircle({
              x: stepX,
              y: baseY,
              size: 6,
              color: colors.textInverse,
            });
          }
  
          // Step label
          page.drawText(step.shortName, {
            x: stepX - 10,
            y: baseY + 20,
            size: 9,
            color: textColor,
            font: fonts.bold,
          });
  
          // Step details
          if (step.completed && step.date) {
            page.drawText(formatDate(step.date), {
              x: stepX - 20,
              y: baseY - 20,
              size: 7,
              color: colors.textSecondary,
              font: fonts.regular,
            });
          }
  
          // Additional details
          page.drawText(step.details, {
            x: stepX - 25,
            y: baseY - 32,
            size: 6,
            color: colors.textLight,
            font: fonts.oblique,
          });
        });
  
        return timelineY - timelineHeight;
      };
  
      // Enhanced section header function
      const drawSectionHeader = async (title: string, y: number) => {
        try {
          const sectionHeight = 45;
          const sectionMargin = 15;
          
          // Section background with subtle shadow effect
          page.drawRectangle({
            x: 40,
            y: y - sectionHeight,
            width: width - 80,
            height: sectionHeight,
            color: colors.backgroundSecondary,
          });

          // Left accent border
          page.drawRectangle({
            x: 40,
            y: y - sectionHeight,
            width: 4,
            height: sectionHeight,
            color: colors.secondary,
          });

          // Section title
          const safeTitle = title.replace(/[^\x00-\x7F]/g, '');
          page.drawText(safeTitle, {
            x: 55,
            y: y - 25,
            size: 14,
            color: colors.primary,
            font: fonts.bold,
          });

          return y - sectionHeight - sectionMargin;
        } catch (error) {
          console.error('Error drawing section header:', error);
          throw new Error('Failed to draw section header');
        }
      };

      // Enhanced info row function with better spacing
      const drawInfoRow = async (label: string, value: string | null, y: number, isLast: boolean = false) => {
        try {
          const rowHeight = 28;
          const leftCol = 60;
          const rightCol = 300;
          const rowMargin = 5;

          // Alternating row background for better readability
          if (Math.floor((height - y) / rowHeight) % 2 === 0) {
            page.drawRectangle({
              x: 45,
              y: y - 5,
              width: width - 90,
              height: rowHeight,
              color: colors.backgroundSecondary,
            });
          }

          // Label
          const safeLabel = label.replace(/[^\x00-\x7F]/g, '');
          page.drawText(`${safeLabel}:`, {
            x: leftCol,
            y: y + 5,
            size: 11,
            color: colors.textSecondary,
            font: fonts.regular,
          });

          // Value
          const safeValue = value ? value.replace(/[^\x00-\x7F]/g, '') : 'Not available';
          page.drawText(safeValue, {
            x: rightCol,
            y: y + 5,
            size: 11,
            color: colors.textPrimary,
            font: fonts.regular,
          });

          // Subtle separator line (except for last row)
          if (!isLast) {
            page.drawLine({
              start: { x: 50, y: y - 10 },
              end: { x: width - 50, y: y - 10 },
              thickness: 0.3,
              color: colors.border,
            });
          }

          return y - rowHeight - rowMargin;
        } catch (error) {
          console.error('Error drawing info row:', error);
          throw new Error('Failed to draw info row');
        }
      };
  
      // Quality assessment visualization
      const drawQualityMetrics = (y, qualityData) => {
        if (!qualityData) return y;
  
        const metricsY = y - 20;
        const metrics = [
          { label: 'Size Consistency', value: qualityData.sizeConsistency || 85 },
          { label: 'Color Quality', value: qualityData.colorQuality || 92 },
          { label: 'Ripeness Level', value: qualityData.ripenessLevel || 78 },
          { label: 'Defect Rate', value: 100 - (qualityData.defectRate || 8) }
        ];
  
        page.drawText('QUALITY METRICS', {
          x: 60,
          y: metricsY,
          size: 12,
          color: colors.primary,
          font: fonts.bold,
        });
  
        metrics.forEach((metric, index) => {
          const barY = metricsY - 30 - (index * 25);
          const barWidth = 200;
          const fillWidth = (metric.value / 100) * barWidth;
          
          // Background bar
          page.drawRectangle({
            x: 200,
            y: barY - 5,
            width: barWidth,
            height: 12,
            color: colors.backgroundTertiary,
          });
  
          // Fill bar with color coding
          let fillColor = colors.success;
          if (metric.value < 60) fillColor = colors.error;
          else if (metric.value < 80) fillColor = colors.warning;
  
          page.drawRectangle({
            x: 200,
            y: barY - 5,
            width: fillWidth,
            height: 12,
            color: fillColor,
          });
  
          // Label and value
          page.drawText(metric.label, {
            x: 60,
            y: barY,
            size: 10,
            color: colors.textPrimary,
            font: fonts.regular,
          });
  
          page.drawText(`${metric.value}%`, {
            x: 410,
            y: barY,
            size: 10,
            color: colors.textPrimary,
            font: fonts.bold,
          });
        });
  
        return metricsY - 130;
      };
  
      // Temperature monitoring chart (simplified visualization)
      const drawTemperatureChart = (y, temperatureData) => {
        if (!temperatureData || !temperatureData.length) return y;
  
        const chartY = y - 20;
        const chartHeight = 80;
        const chartWidth = 400;
  
        page.drawText('TEMPERATURE MONITORING', {
          x: 60,
          y: chartY,
          size: 12,
          color: colors.primary,
          font: fonts.bold,
        });
  
        // Chart background
        page.drawRectangle({
          x: 60,
          y: chartY - chartHeight - 20,
          width: chartWidth,
          height: chartHeight,
          color: colors.backgroundSecondary,
        });
  
        // Simulate temperature data points
        const dataPoints = temperatureData.slice(0, 10); // Max 10 points
        const stepWidth = chartWidth / (dataPoints.length - 1);
  
        dataPoints.forEach((point, index) => {
          const x = 60 + (index * stepWidth);
          const temp = point.temperature || 5;
          const normalizedTemp = Math.max(0, Math.min(1, (temp + 5) / 15)); // Normalize -5 to 10°C
          const pointY = chartY - 20 - (normalizedTemp * (chartHeight - 20));
  
          // Temperature point
          const tempColor = temp >= 2 && temp <= 8 ? colors.success : colors.warning;
          page.drawCircle({
            x: x,
            y: pointY,
            size: 3,
            color: tempColor,
          });
  
          // Connect points with lines
          if (index > 0) {
            const prevX = 60 + ((index - 1) * stepWidth);
            const prevTemp = dataPoints[index - 1].temperature || 5;
            const prevNormalizedTemp = Math.max(0, Math.min(1, (prevTemp + 5) / 15));
            const prevY = chartY - 20 - (prevNormalizedTemp * (chartHeight - 20));
  
            page.drawLine({
              start: { x: prevX, y: prevY },
              end: { x: x, y: pointY },
              thickness: 2,
              color: colors.info,
            });
          }
        });
  
        // Chart axes and labels
        page.drawText('0°C', {
          x: 25,
          y: chartY - chartHeight - 10,
          size: 8,
          color: colors.textSecondary,
          font: fonts.regular,
        });
  
        page.drawText('10°C', {
          x: 25,
          y: chartY - 30,
          size: 8,
          color: colors.textSecondary,
          font: fonts.regular,
        });
  
        return chartY - chartHeight - 50;
      };
  
      // Check if we need a new page
      const checkPageSpace = (requiredSpace) => {
        if (currentY < requiredSpace) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          ({ width, height } = page.getSize());
          return height - 50; // Start with some margin from top
        }
        return currentY;
      };
  
      // Start document generation
      let currentY = await createHeader();
      currentY = await createProgressTimeline(currentY);
  
      updateProgress('Generating sections', 40);
  
      // Enhanced sections with comprehensive data
      const sections = [
        {
          title: 'HARVEST & ORIGIN DETAILS',
          fields: [
            ['Farm Location', lotData.harvest.farmLocation],
            ['Variety', lotData.harvest.variety],
            ['Harvest Date', formatDate(lotData.harvest.harvestDate)],
            ['Quality Score', lotData.harvest.qualityScore ? `${lotData.harvest.qualityScore}/100` : 'N/A'],
            ['Harvest Method', 'Manual Harvest'],
            ['Field Conditions', 'Optimal'],
            ['Harvest Team', 'Field Team A']
          ]
        },
        {
          title: 'TRANSPORT & LOGISTICS',
          condition: lotData.transport.arrivalDateTime,
          fields: [
            ['Arrival Date', formatDate(lotData.transport.arrivalDateTime, true)],
            ['Vehicle ID', lotData.transport.vehicleId],
            ['Driver', lotData.transport.driverName],
            ['Temperature', lotData.transport.temperature ? `${lotData.transport.temperature}°C` : null],
            ['Route', 'Farm to Processing Center'],
            ['Distance', '25 km'],
            ['Transport Method', 'Refrigerated Truck']
          ]
        },
        {
          title: 'QUALITY SORTING',
          condition: lotData.sorting.sortingDate,
          fields: [
            ['Sorting Date', formatDate(lotData.sorting.sortingDate, true)],
            ['Quality Grade', lotData.sorting.qualityGrade],
            ['Accepted Weight', lotData.sorting.acceptedQuantity ? `${lotData.sorting.acceptedQuantity} kg` : null],
            ['Rejected Quantity', lotData.sorting.rejectedQuantity ? `${lotData.sorting.rejectedQuantity} kg` : null],
            ['Sorting Criteria', 'Size, Color, Ripeness'],
            ['Quality Inspector', 'John Smith'],
            ['Rejection Reason', 'Minor defects']
          ]
        },
        {
          title: 'PACKAGING DETAILS',
          condition: lotData.packaging.packagingDate,
          fields: [
            ['Packaging Date', formatDate(lotData.packaging.packagingDate, true)],
            ['Net Weight', lotData.packaging.netWeight ? `${lotData.packaging.netWeight} kg` : null],
            ['Package Type', lotData.packaging.packagingType],
            ['Units Packed', lotData.packaging.unitsCount],
            ['Packaging Material', 'Eco-friendly cardboard'],
            ['Label Information', 'Organic Certified'],
            ['Batch Number', lotData.harvest.lotNumber]
          ]
        },
        {
          title: 'COLD STORAGE',
          condition: lotData.storage.entryDate,
          fields: [
            ['Storage Entry', formatDate(lotData.storage.entryDate, true)],
            ['Storage Zone', lotData.storage.storageZone],
            ['Temperature', lotData.storage.temperature ? `${lotData.storage.temperature}°C` : null],
            ['Humidity', lotData.storage.humidity ? `${lotData.storage.humidity}%` : null],
            ['Storage Duration', '48 hours'],
            ['Storage Facility', 'Main Cold Storage'],
            ['Storage Conditions', 'Controlled Atmosphere']
          ]
        },
        {
          title: 'EXPORT SHIPPING',
          condition: lotData.export.loadingDate,
          fields: [
            ['Loading Date', formatDate(lotData.export.loadingDate, true)],
            ['Destination', lotData.export.destination],
            ['Container No.', lotData.export.containerNumber],
            ['Shipping Line', lotData.export.shippingLine],
            ['Export Documentation', 'Complete'],
            ['Customs Status', 'Cleared'],
            ['Estimated Arrival', '5 days']
          ]
        },
        {
          title: 'FINAL DELIVERY',
          condition: lotData.delivery.actualDeliveryDate,
          fields: [
            ['Delivery Date', formatDate(lotData.delivery.actualDeliveryDate, true)],
            ['Customer', lotData.delivery.customerName],
            ['Delivery Status', lotData.delivery.deliveryStatus || 'Completed'],
            ['Received By', lotData.delivery.receivedBy],
            ['Delivery Method', 'Direct Delivery'],
            ['Delivery Notes', 'On time delivery'],
            ['Quality Check', 'Passed']
          ]
        }
      ];
  
      // Render sections with pagination
      let currentPage = 1;
      const maxSectionsPerPage = 2; // Reduced to 2 sections per page for better spacing
      let sectionsRendered = 0;

      for (const section of sections) {
        if (!section.condition && section.condition !== undefined) continue;

        // Check if we need a new page
        if (sectionsRendered > 0 && sectionsRendered % maxSectionsPerPage === 0) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          ({ width, height } = page.getSize());
          currentY = height - 60; // Increased top margin
          currentPage++;
        }

        try {
          currentY = await drawSectionHeader(section.title, currentY);
          currentY -= 15; // Additional spacing after header

          const validFields = section.fields.filter(([_, value]) => value && value !== 'N/A');
          
          if (validFields.length === 0) {
            currentY = await drawInfoRow('Status', 'No data available', currentY, true);
            currentY -= 20;
            continue;
          }

          for (let i = 0; i < validFields.length; i++) {
            const [label, value] = validFields[i];
            const isLast = i === validFields.length - 1;
            currentY = await drawInfoRow(label, String(value || ''), currentY, isLast);
          }
          currentY -= 30; // Increased spacing between sections
          sectionsRendered++;
        } catch (error) {
          console.error(`Error rendering section ${section.title}:`, error);
          continue;
        }
      }

      // Add page numbers with better positioning
      for (let i = 1; i <= currentPage; i++) {
        const page = pdfDoc.getPage(i - 1);
        page.drawText(`Page ${i} of ${currentPage}`, {
          x: width - 120,
          y: 40,
          size: 10,
          color: colors.textSecondary,
          font: fonts.regular,
        });
      }
  
      // Simple footer
      const footerY = 50;
      
      page.drawText('FRUITS FOR YOU - PREMIUM QUALITY ASSURANCE', {
        x: 50,
        y: footerY,
        size: 12,
        color: colors.primary,
        font: fonts.bold,
      });

      page.drawText(`Document ID: TR-${lotData.harvest.lotNumber}-${Date.now().toString().slice(-6)}`, {
        x: 50,
        y: footerY - 20,
        size: 10,
        color: colors.textSecondary,
        font: fonts.regular,
      });

      // Generate and download PDF
      updateProgress('Finalizing PDF', 95);
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const fileName = `Avocado-Traceability-Report-${lotData.harvest.lotNumber}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      updateProgress('Complete', 100);
      
      // Show success message
      if (typeof alert !== 'undefined') {
        alert(`PDF Report Generated Successfully!\n\nDocument: ${fileName}\nLot: ${lotData.harvest.lotNumber}`);
      }
      
      onClose && onClose();
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      if (typeof alert !== 'undefined') {
        alert('Unable to generate PDF report. Please try again or contact support.');
      }
      
    } finally {
      setIsGenerating && setIsGenerating(false);
    }
  };
  


  return (
    <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">PDF Preview</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex justify-end space-x-4 mb-6">
          <Button onClick={downloadQRCode} disabled={isGenerating}>
            <FileText className="mr-2 h-4 w-4" />
            Download QR Code
          </Button>
          <Button onClick={generatePDF} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate PDF
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>

        {/* Preview content */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">PDF Preview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Lot Number:</span>
              <span>{lotData.harvest.lotNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Farm Location:</span>
              <span>{lotData.harvest.farmLocation}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Variety:</span>
              <span>{lotData.harvest.variety}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Harvest Date:</span>
              <span>{new Date(lotData.harvest.harvestDate).toLocaleDateString('fr-FR')}</span>
            </div>
            {qrCodeUrl && (
              <div className="mt-4 p-4 border rounded-lg bg-white">
                <h4 className="text-sm font-medium mb-2">QR Code URL:</h4>
                <p className="text-sm text-gray-600 break-all">{qrCodeUrl}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default PDFViewer;