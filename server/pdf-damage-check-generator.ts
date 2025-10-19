import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

interface VehicleData {
  brand: string;
  model: string;
  licensePlate: string;
  buildYear?: string;
  fuel?: string;
}

interface DamageCheckTemplate {
  name: string;
  inspectionPoints: Array<{
    name: string;
    category: string;
    damageTypes: string[];
  }>;
}

export async function generateDamageCheckPDF(
  vehicle: VehicleData,
  template: DamageCheckTemplate,
  reservationData?: { contractNumber?: string; customerName?: string }
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let yPosition = height - 50;
  
  // Header
  page.drawText('VERHUURCONTRACT/DAMAGE CHECK', {
    x: 50,
    y: yPosition,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 30;
  
  // Vehicle data section
  page.drawText('Gegevens voertuig', {
    x: 350,
    y: yPosition,
    size: 12,
    font: boldFont,
  });
  
  page.drawRectangle({
    x: 340,
    y: yPosition - 100,
    width: 200,
    height: 120,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  
  yPosition -= 20;
  page.drawText(`Merk: ${vehicle.brand}`, { x: 350, y: yPosition, size: 10, font });
  yPosition -= 15;
  page.drawText(`Type: ${vehicle.model}`, { x: 350, y: yPosition, size: 10, font });
  yPosition -= 15;
  page.drawText(`Kenteken: ${vehicle.licensePlate}`, { x: 350, y: yPosition, size: 10, font });
  
  yPosition = height - 130;
  
  // Group inspection points by category
  const categories = ['interieur', 'exterieur', 'afweez_check'];
  const categoryLabels = {
    interieur: 'Interieur',
    exterieur: 'Exterieur',
    afweez_check: 'Afweez Check'
  };
  
  for (const category of categories) {
    const points = template.inspectionPoints.filter(p => p.category === category);
    if (points.length === 0) continue;
    
    // Category header
    page.drawRectangle({
      x: 20,
      y: yPosition - 5,
      width: 220,
      height: 20,
      color: rgb(0, 0.3, 0.6),
    });
    
    page.drawText(categoryLabels[category as keyof typeof categoryLabels] || category, {
      x: 25,
      y: yPosition,
      size: 11,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    
    yPosition -= 25;
    
    // Inspection points
    for (const point of points.slice(0, 10)) { // Limit to prevent overflow
      // Checkbox
      page.drawRectangle({
        x: 25,
        y: yPosition - 2,
        width: 8,
        height: 8,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });
      
      // Point name
      page.drawText(point.name, {
        x: 38,
        y: yPosition,
        size: 9,
        font,
      });
      
      // Damage types (abbreviated)
      const damageText = point.damageTypes.slice(0, 3).join(' / ');
      page.drawText(damageText, {
        x: 150,
        y: yPosition,
        size: 8,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      
      yPosition -= 12;
    }
    
    yPosition -= 10;
    
    if (yPosition < 150) break; // Stop if we're running out of space
  }
  
  // Vehicle diagrams placeholder
  // Note: In production, you would load actual vehicle diagrams here
  const diagramY = 100;
  page.drawText('Vehicle Diagrams: Top / Front / Rear / Side', {
    x: 50,
    y: diagramY,
    size: 10,
    font: boldFont,
  });
  
  // Signature section
  page.drawText('Handtekening', {
    x: 350,
    y: 50,
    size: 10,
    font: boldFont,
  });
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
