import { jsPDF } from 'jspdf';
import { AvocadoTracking } from "@shared/types/avocado-tracking";

export async function generateLotPDF(lot: AvocadoTracking): Promise<Blob> {
  const doc = new jsPDF();

  // Add content to PDF
  doc.setFontSize(20);
  doc.text('Lot Tracking Report', 105, 20, { align: 'center' });

  // Harvest Information
  doc.setFontSize(16);
  doc.text('Harvest Information', 20, 40);
  doc.setFontSize(12);
  doc.text(`Lot Number: ${lot.harvest.lotNumber}`, 20, 50);
  doc.text(`Date: ${new Date(lot.harvest.harvestDate).toLocaleDateString()}`, 20, 60);
  doc.text(`Location: ${lot.harvest.farmLocation}`, 20, 70);
  doc.text(`Farmer ID: ${lot.harvest.farmerId}`, 20, 80);
  doc.text(`Variety: ${lot.harvest.variety}`, 20, 90);

  // Transport Information
  doc.setFontSize(16);
  doc.text('Transport Information', 20, 110);
  doc.setFontSize(12);
  doc.text(`Company: ${lot.transport.transportCompany}`, 20, 120);
  doc.text(`Driver: ${lot.transport.driverName}`, 20, 130);
  doc.text(`Vehicle ID: ${lot.transport.vehicleId}`, 20, 140);
  doc.text(`Temperature: ${lot.transport.temperature}°C`, 20, 150);

  // Quality Information
  doc.setFontSize(16);
  doc.text('Quality Information', 20, 170);
  doc.setFontSize(12);
  doc.text(`Grade: ${lot.sorting.qualityGrade}`, 20, 180);
  doc.text(`Rejected Count: ${lot.sorting.rejectedCount}`, 20, 190);
  doc.text(`Notes: ${lot.sorting.notes || 'N/A'}`, 20, 200);

  // Packaging Information
  doc.setFontSize(16);
  doc.text('Packaging Information', 20, 220);
  doc.setFontSize(12);
  doc.text(`Box ID: ${lot.packaging.boxId}`, 20, 230);
  doc.text(`Net Weight: ${lot.packaging.netWeight} kg`, 20, 240);
  doc.text(`Count: ${lot.packaging.avocadoCount}`, 20, 250);
  doc.text(`Type: ${lot.packaging.boxType}`, 20, 260);

  // Delivery Information
  doc.setFontSize(16);
  doc.text('Delivery Information', 20, 280);
  doc.setFontSize(12);
  doc.text(`Client: ${lot.delivery.clientName}`, 20, 290);
  doc.text(`Location: ${lot.delivery.clientLocation}`, 20, 300);
  doc.text(`Status: ${lot.delivery.actualDeliveryDate ? 'Delivered' : 'Pending'}`, 20, 310);
  doc.text(`Notes: ${lot.delivery.notes || 'N/A'}`, 20, 320);

  // Convert to Blob
  return doc.output('blob');
}