import { getReportData, ReportData } from './reportService';

/**
 * Step 3 - Generate PDF (Client-side using html2pdf)
 * Generates a PDF from report data containing image URLs
 */

// Client-side PDF generation using html2pdf (requires: npm install html2pdf.js)
export const generateReportPDFClient = async (reportId: string): Promise<void> => {
  try {
    console.log(`Generating PDF for report ${reportId}`);
    
    // Fetch report data
    const reportData = await getReportData(reportId);
    if (!reportData) {
      throw new Error('Report not found');
    }
    
    // Create HTML content
    const htmlContent = createReportHTML(reportData);
    
    // Check if html2pdf is available
    if (typeof window !== 'undefined' && (window as any).html2pdf) {
      const html2pdf = (window as any).html2pdf;
      
      const options = {
        margin: 1,
        filename: `report_${reportId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      
      // Generate and download PDF
      await html2pdf().set(options).from(htmlContent).save();
      console.log('✅ PDF generated successfully');
      
    } else {
      throw new Error('html2pdf library not loaded. Include it in your HTML: <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>');
    }
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  }
};

/**
 * Create HTML content for the report
 */
const createReportHTML = (reportData: ReportData): string => {
  const { id, images, title, description, createdAt } = reportData;
  
  const imageElements = images.length > 0 
    ? images.map(url => `
        <div style="margin: 20px 0; text-align: center;">
          <img src="${url}" style="max-width: 200px; height: auto; border: 1px solid #ddd; border-radius: 4px;" />
        </div>
      `).join('')
    : '<p style="text-align: center; color: #666;">No images uploaded</p>';
  
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
      <h1 style="text-align: center; color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
        Report for ${id}
      </h1>
      
      ${title ? `<h2 style="color: #555;">${title}</h2>` : ''}
      ${description ? `<p style="color: #666; margin: 20px 0;">${description}</p>` : ''}
      
      <div style="margin: 20px 0;">
        <strong>Created:</strong> ${new Date(createdAt).toLocaleDateString()}
      </div>
      
      <div style="margin: 30px 0;">
        <h3 style="color: #333;">Images (${images.length})</h3>
        ${imageElements}
      </div>
      
      <div style="margin-top: 40px; text-align: center; color: #999; font-size: 12px;">
        Generated on ${new Date().toLocaleString()}
      </div>
    </div>
  `;
};

/**
 * Download report data as JSON (backup/export feature)
 */
export const downloadReportAsJSON = async (reportId: string): Promise<void> => {
  try {
    const reportData = await getReportData(reportId);
    if (!reportData) {
      throw new Error('Report not found');
    }
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${reportId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ Report JSON downloaded');
  } catch (error) {
    console.error('❌ Error downloading report JSON:', error);
    throw error;
  }
};

/**
 * Generate PDF with custom template
 */
export const generateCustomReportPDF = async (
  reportId: string, 
  customHTML: string
): Promise<void> => {
  try {
    if (typeof window !== 'undefined' && (window as any).html2pdf) {
      const html2pdf = (window as any).html2pdf;
      
      const options = {
        margin: 1,
        filename: `custom_report_${reportId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      
      await html2pdf().set(options).from(customHTML).save();
      console.log('✅ Custom PDF generated successfully');
      
    } else {
      throw new Error('html2pdf library not available');
    }
  } catch (error) {
    console.error('❌ Error generating custom PDF:', error);
    throw error;
  }
};

export const pdfService = {
  generateReportPDFClient,
  downloadReportAsJSON,
  generateCustomReportPDF
};
