const fs = require('fs');
const path = require('path');
const PDFKit = require('pdfkit');
const axios = require('axios');
const admin = require('firebase-admin');

/**
 * Server-side PDF generation using PDFKit
 * Generates professional PDFs from Firestore report data
 */

// Initialize Firebase Admin (assumes service account is configured)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: 'fruitsforyou-10acc.appspot.com'
  });
}

const db = admin.firestore();

/**
 * Generate PDF from report data
 */
async function generateReportPDF(reportId, outputPath = null) {
  try {
    console.log(`📄 Generating PDF for report: ${reportId}`);
    
    // Fetch report data from Firestore
    const reportDoc = await db.collection('reports').doc(reportId).get();
    if (!reportDoc.exists) {
      throw new Error(`Report ${reportId} not found`);
    }
    
    const reportData = { id: reportDoc.id, ...reportDoc.data() };
    console.log(`📊 Report data: ${reportData.images?.length || 0} images`);
    
    // Create PDF
    const pdf = new PDFKit();
    const fileName = outputPath || `report_${reportId}_${Date.now()}.pdf`;
    const filePath = path.resolve(fileName);
    
    // Pipe PDF to file
    pdf.pipe(fs.createWriteStream(filePath));
    
    // Add header
    pdf.fontSize(20)
       .text(`Report: ${reportId}`, 50, 50);
    
    if (reportData.title) {
      pdf.fontSize(16)
         .text(reportData.title, 50, 80);
    }
    
    if (reportData.description) {
      pdf.fontSize(12)
         .text(reportData.description, 50, 110, { width: 500 });
    }
    
    // Add metadata
    pdf.fontSize(10)
       .text(`Created: ${new Date(reportData.createdAt).toLocaleString()}`, 50, 150)
       .text(`Generated: ${new Date().toLocaleString()}`, 50, 165);
    
    let yPosition = 200;
    
    // Add images if available
    if (reportData.images && reportData.images.length > 0) {
      pdf.fontSize(14)
         .text(`Images (${reportData.images.length}):`, 50, yPosition);
      
      yPosition += 30;
      
      for (let i = 0; i < reportData.images.length; i++) {
        const imageUrl = reportData.images[i];
        
        try {
          console.log(`📷 Processing image ${i + 1}/${reportData.images.length}`);
          
          // Download image
          const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000
          });
          
          // Add image to PDF
          const imageBuffer = Buffer.from(response.data);
          
          // Check if we need a new page
          if (yPosition > 600) {
            pdf.addPage();
            yPosition = 50;
          }
          
          // Add image with caption
          pdf.fontSize(10)
             .text(`Image ${i + 1}:`, 50, yPosition);
          
          yPosition += 20;
          
          pdf.image(imageBuffer, 50, yPosition, {
            fit: [200, 200],
            align: 'left'
          });
          
          yPosition += 220;
          
        } catch (imageError) {
          console.warn(`⚠️  Failed to load image ${i + 1}: ${imageError.message}`);
          
          // Add placeholder text
          pdf.fontSize(10)
             .text(`Image ${i + 1}: Failed to load`, 50, yPosition)
             .text(`URL: ${imageUrl}`, 50, yPosition + 15);
          
          yPosition += 40;
        }
      }
    } else {
      pdf.fontSize(12)
         .text('No images available', 50, yPosition);
    }
    
    // Finalize PDF
    pdf.end();
    
    console.log(`✅ PDF generated: ${filePath}`);
    return filePath;
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  }
}

/**
 * Generate PDF with custom layout
 */
async function generateAdvancedReportPDF(reportId, options = {}) {
  const {
    outputPath = null,
    includeMetadata = true,
    imageSize = [200, 200],
    fontSize = {
      title: 20,
      subtitle: 16,
      body: 12,
      caption: 10
    }
  } = options;
  
  try {
    console.log(`📄 Generating advanced PDF for report: ${reportId}`);
    
    // Fetch report data
    const reportDoc = await db.collection('reports').doc(reportId).get();
    if (!reportDoc.exists) {
      throw new Error(`Report ${reportId} not found`);
    }
    
    const reportData = { id: reportDoc.id, ...reportDoc.data() };
    
    // Create PDF with advanced options
    const pdf = new PDFKit({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Report ${reportId}`,
        Author: 'Fruits For You Quality System',
        Subject: reportData.title || 'Quality Control Report',
        CreationDate: new Date()
      }
    });
    
    const fileName = outputPath || `advanced_report_${reportId}_${Date.now()}.pdf`;
    const filePath = path.resolve(fileName);
    
    pdf.pipe(fs.createWriteStream(filePath));
    
    // Header with border
    pdf.rect(50, 50, 500, 100)
       .stroke();
    
    pdf.fontSize(fontSize.title)
       .text('QUALITY CONTROL REPORT', 60, 70, { align: 'center' });
    
    pdf.fontSize(fontSize.subtitle)
       .text(`Report ID: ${reportId}`, 60, 100, { align: 'center' });
    
    if (reportData.title) {
      pdf.fontSize(fontSize.body)
         .text(reportData.title, 60, 120, { align: 'center' });
    }
    
    let yPos = 180;
    
    // Metadata section
    if (includeMetadata) {
      pdf.rect(50, yPos, 500, 80)
         .stroke();
      
      pdf.fontSize(fontSize.body)
         .text('REPORT DETAILS', 60, yPos + 10)
         .text(`Created: ${new Date(reportData.createdAt).toLocaleString()}`, 60, yPos + 30)
         .text(`Generated: ${new Date().toLocaleString()}`, 60, yPos + 45)
         .text(`Images: ${reportData.images?.length || 0}`, 60, yPos + 60);
      
      yPos += 100;
    }
    
    // Description section
    if (reportData.description) {
      pdf.fontSize(fontSize.body)
         .text('DESCRIPTION:', 50, yPos)
         .text(reportData.description, 50, yPos + 20, { width: 500 });
      
      yPos += 80;
    }
    
    // Images section
    if (reportData.images && reportData.images.length > 0) {
      pdf.fontSize(fontSize.body)
         .text('IMAGES:', 50, yPos);
      
      yPos += 30;
      
      for (let i = 0; i < reportData.images.length; i++) {
        const imageUrl = reportData.images[i];
        
        try {
          // Check page space
          if (yPos > 650) {
            pdf.addPage();
            yPos = 50;
          }
          
          // Download and add image
          const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000
          });
          
          const imageBuffer = Buffer.from(response.data);
          
          // Image border
          pdf.rect(50, yPos, imageSize[0] + 20, imageSize[1] + 40)
             .stroke();
          
          // Image caption
          pdf.fontSize(fontSize.caption)
             .text(`Image ${i + 1} of ${reportData.images.length}`, 60, yPos + 10);
          
          // Image
          pdf.image(imageBuffer, 60, yPos + 25, {
            fit: imageSize,
            align: 'left'
          });
          
          yPos += imageSize[1] + 60;
          
        } catch (imageError) {
          console.warn(`⚠️  Image ${i + 1} failed: ${imageError.message}`);
          
          // Error placeholder
          pdf.rect(50, yPos, 200, 100)
             .stroke();
          
          pdf.fontSize(fontSize.caption)
             .text(`Image ${i + 1}: Load Error`, 60, yPos + 10)
             .text('Unable to retrieve image', 60, yPos + 30)
             .text(imageUrl.substring(0, 50) + '...', 60, yPos + 50, { width: 180 });
          
          yPos += 120;
        }
      }
    }
    
    // Footer
    const pageCount = pdf.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      pdf.switchToPage(i);
      pdf.fontSize(8)
         .text(`Page ${i + 1} of ${pageCount} | Report ${reportId}`, 50, 750, {
           width: 500,
           align: 'center'
         });
    }
    
    pdf.end();
    
    console.log(`✅ Advanced PDF generated: ${filePath}`);
    return filePath;
    
  } catch (error) {
    console.error('❌ Error generating advanced PDF:', error);
    throw error;
  }
}

/**
 * CLI usage
 */
if (require.main === module) {
  const reportId = process.argv[2];
  const outputPath = process.argv[3];
  const advanced = process.argv.includes('--advanced');
  
  if (!reportId) {
    console.log('Usage: node generate-report-pdf.js <reportId> [outputPath] [--advanced]');
    console.log('Example: node generate-report-pdf.js LOT001 ./report.pdf');
    console.log('Example: node generate-report-pdf.js LOT001 ./report.pdf --advanced');
    process.exit(1);
  }
  
  const generateFn = advanced ? generateAdvancedReportPDF : generateReportPDF;
  
  generateFn(reportId, outputPath)
    .then(filePath => {
      console.log(`🎉 Success! PDF saved to: ${filePath}`);
    })
    .catch(error => {
      console.error('💥 Failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  generateReportPDF,
  generateAdvancedReportPDF
};
