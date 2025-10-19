import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

interface VehicleData {
  brand: string;
  model: string;
  licensePlate: string;
  buildYear?: string;
  fuel?: string;
  mileage?: number;
}

interface InspectionPoint {
  name: string;
  category: string;
  damageTypes: string[];
}

interface DamageCheckTemplate {
  id?: number;
  name: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleType?: string | null;
  buildYearFrom?: number | null;
  buildYearTo?: number | null;
  inspectionPoints: InspectionPoint[];
  diagramTopView?: string | null;
  diagramFrontView?: string | null;
  diagramRearView?: string | null;
  diagramSideView?: string | null;
  isDefault?: boolean;
}

interface ReservationData {
  contractNumber?: string;
  customerName?: string;
  startDate?: string;
  endDate?: string;
  rentalDays?: number;
}

export async function generateDamageCheckPDF(
  vehicle: VehicleData,
  template: DamageCheckTemplate,
  reservationData?: ReservationData
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const margin = 40;
  let yPosition = height - margin;
  
  // Helper function to ensure we have space on page
  const ensureSpace = (requiredSpace: number): PDFPage => {
    if (yPosition < requiredSpace + margin) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = height - margin;
    }
    return page;
  };
  
  // Helper function to draw a box with text
  const drawBox = (currentPage: PDFPage, x: number, y: number, w: number, h: number, label?: string, value?: string) => {
    currentPage.drawRectangle({
      x,
      y: y - h,
      width: w,
      height: h,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.5,
    });
    
    if (label) {
      currentPage.drawText(label, {
        x: x + 3,
        y: y - h + 3,
        size: 7,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
    
    if (value) {
      currentPage.drawText(value, {
        x: x + 3,
        y: y - h + 13,
        size: 9,
        font: boldFont,
      });
    }
  };
  
  // Header
  page.drawRectangle({
    x: margin,
    y: yPosition - 35,
    width: width - margin * 2,
    height: 35,
    color: rgb(0.1, 0.3, 0.6),
  });
  
  page.drawText('VERHUURCONTRACT / SCHADEFORMULIER', {
    x: margin + 10,
    y: yPosition - 22,
    size: 16,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  
  yPosition -= 50;
  
  // Contract and Customer Information Section
  if (reservationData) {
    page.drawText('GEGEVENS HUURDER', {
      x: margin,
      y: yPosition,
      size: 11,
      font: boldFont,
    });
    
    yPosition -= 20;
    
    const boxHeight = 28;
    const col1Width = 120;
    const col2Width = 150;
    
    // Contract Number and Customer Name
    drawBox(page, margin, yPosition, col1Width, boxHeight, 'Contractnummer', reservationData.contractNumber || 'N/A');
    drawBox(page, margin + col1Width + 5, yPosition, col2Width, boxHeight, 'Naam huurder', reservationData.customerName || 'N/A');
    
    yPosition -= boxHeight + 5;
    
    // Rental period
    if (reservationData.startDate && reservationData.endDate) {
      drawBox(page, margin, yPosition, col1Width, boxHeight, 'Huurperiode van', reservationData.startDate);
      drawBox(page, margin + col1Width + 5, yPosition, col1Width, boxHeight, 'Tot', reservationData.endDate);
      drawBox(page, margin + col1Width * 2 + 10, yPosition, 60, boxHeight, 'Dagen', reservationData.rentalDays?.toString() || '');
    }
    
    yPosition -= boxHeight + 15;
  }
  
  // Vehicle Information Section
  page.drawText('GEGEVENS VOERTUIG', {
    x: margin,
    y: yPosition,
    size: 11,
    font: boldFont,
  });
  
  yPosition -= 20;
  
  const vBoxHeight = 28;
  const vCol1 = 100;
  const vCol2 = 120;
  const vCol3 = 80;
  
  // Row 1: Brand, Model, License Plate
  drawBox(page, margin, yPosition, vCol1, vBoxHeight, 'Merk', vehicle.brand);
  drawBox(page, margin + vCol1 + 5, yPosition, vCol2, vBoxHeight, 'Type/Model', vehicle.model);
  drawBox(page, margin + vCol1 + vCol2 + 10, yPosition, vCol3, vBoxHeight, 'Kenteken', vehicle.licensePlate);
  
  yPosition -= vBoxHeight + 5;
  
  // Row 2: Build Year, Fuel, Mileage
  if (vehicle.buildYear || vehicle.fuel || vehicle.mileage) {
    drawBox(page, margin, yPosition, vCol1, vBoxHeight, 'Bouwjaar', vehicle.buildYear || '');
    drawBox(page, margin + vCol1 + 5, yPosition, vCol2, vBoxHeight, 'Brandstof', vehicle.fuel || '');
    drawBox(page, margin + vCol1 + vCol2 + 10, yPosition, vCol3, vBoxHeight, 'KM-stand', vehicle.mileage?.toString() || '');
    yPosition -= vBoxHeight + 5;
  }
  
  yPosition -= 15;
  
  // Damage Check Section
  page.drawText('SCHADECONTROLE', {
    x: margin,
    y: yPosition,
    size: 11,
    font: boldFont,
  });
  
  yPosition -= 15;
  
  page.drawText('(Kruis aan wat van toepassing is)', {
    x: margin,
    y: yPosition,
    size: 8,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  
  yPosition -= 20;
  
  // Extract unique categories from template inspection points
  const categorySet = new Set<string>();
  template.inspectionPoints.forEach(p => {
    if (p.category) categorySet.add(p.category);
  });
  const categories = Array.from(categorySet);
  
  // Create category labels (capitalize first letter)
  const categoryLabels: Record<string, string> = {};
  categories.forEach(cat => {
    categoryLabels[cat] = cat.replace(/_/g, ' ').toUpperCase();
  });
  
  // Extract all unique damage types from all inspection points to use as column headers
  const damageTypeSet = new Set<string>();
  template.inspectionPoints.forEach(p => {
    if (p.damageTypes && Array.isArray(p.damageTypes)) {
      p.damageTypes.forEach(dt => damageTypeSet.add(dt));
    }
  });
  
  // Use template damage types if available, otherwise fallback to standard Dutch types
  const damageTypes = damageTypeSet.size > 0 
    ? Array.from(damageTypeSet) 
    : ['Kapot', 'Gat', 'Kras', 'Deuk', 'Ster'];
  
  const checkboxSize = 8;
  const nameColumnWidth = 150;
  const damageColumnWidth = Math.max(18, Math.floor((width - margin * 2 - nameColumnWidth - 10) / damageTypes.length));
  
  for (const category of categories) {
    const points = template.inspectionPoints.filter(p => p.category === category);
    if (points.length === 0) continue;
    
    // Ensure space for category header
    page = ensureSpace(100);
    
    // Category header
    page.drawRectangle({
      x: margin,
      y: yPosition - 18,
      width: width - margin * 2,
      height: 18,
      color: rgb(0.2, 0.4, 0.7),
    });
    
    page.drawText(categoryLabels[category as keyof typeof categoryLabels] || category, {
      x: margin + 5,
      y: yPosition - 13,
      size: 10,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    
    yPosition -= 20;
    
    // Damage type column headers
    let xPos = margin + nameColumnWidth + 10;
    for (const damageType of damageTypes) {
      page.drawText(damageType.substring(0, 4), {
        x: xPos,
        y: yPosition,
        size: 7,
        font: boldFont,
      });
      xPos += damageColumnWidth;
    }
    
    yPosition -= 12;
    
    // Inspection points with checkboxes
    for (const point of points) {
      // Ensure space for this row
      page = ensureSpace(50);
      
      // Point name
      page.drawText(point.name, {
        x: margin + 5,
        y: yPosition,
        size: 8,
        font,
      });
      
      // Checkboxes for each damage type
      let checkXPos = margin + nameColumnWidth + 10;
      for (const damageType of damageTypes) {
        page.drawRectangle({
          x: checkXPos + 2,
          y: yPosition - 1,
          width: checkboxSize,
          height: checkboxSize,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.5,
        });
        checkXPos += damageColumnWidth;
      }
      
      yPosition -= 14;
    }
    
    yPosition -= 10;
  }
  
  // Ensure space for diagrams and signatures
  page = ensureSpace(250);
  
  yPosition -= 20;
  
  // Vehicle Diagram Section
  page.drawText('VOERTUIGSCHEMA', {
    x: margin,
    y: yPosition,
    size: 10,
    font: boldFont,
  });
  
  yPosition -= 15;
  
  // Try to load and embed vehicle diagrams if available
  const diagramBoxWidth = (width - margin * 2 - 10) / 2;
  const diagramBoxHeight = 80;
  
  // Helper function to load and embed a diagram
  const loadDiagram = async (diagramPath: string | null | undefined) => {
    if (!diagramPath) return null;
    
    try {
      const diagramFullPath = path.join(process.cwd(), diagramPath);
      const diagramExists = await fs.access(diagramFullPath).then(() => true).catch(() => false);
      
      if (diagramExists) {
        const diagramBytes = await fs.readFile(diagramFullPath);
        
        if (diagramPath.toLowerCase().endsWith('.png')) {
          return await pdfDoc.embedPng(diagramBytes);
        } else if (diagramPath.toLowerCase().endsWith('.jpg') || diagramPath.toLowerCase().endsWith('.jpeg')) {
          return await pdfDoc.embedJpg(diagramBytes);
        }
      }
    } catch (error) {
      console.warn('Could not load vehicle diagram:', diagramPath, error);
    }
    
    return null;
  };
  
  // Load all available diagrams
  const topViewImage = await loadDiagram(template.diagramTopView);
  const sideViewImage = await loadDiagram(template.diagramSideView);
  const frontViewImage = await loadDiagram(template.diagramFrontView);
  const rearViewImage = await loadDiagram(template.diagramRearView);
  
  const diagramEmbedded = !!(topViewImage || sideViewImage || frontViewImage || rearViewImage);
  
  // Display diagrams (top row: Top & Side, bottom row: Front & Rear)
  const drawDiagramOrPlaceholder = (image: any, x: number, y: number, width: number, height: number, label: string) => {
    if (image) {
      const dims = image.scale(1);
      const scale = Math.min(width / dims.width, height / dims.height);
      const imgWidth = dims.width * scale;
      const imgHeight = dims.height * scale;
      const xOffset = (width - imgWidth) / 2;
      const yOffset = (height - imgHeight) / 2;
      
      page.drawImage(image, {
        x: x + xOffset,
        y: y - height + yOffset,
        width: imgWidth,
        height: imgHeight,
      });
    } else {
      page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });
      page.drawText(label, {
        x: x + width / 2 - (label.length * 2.5),
        y: y - height / 2,
        size: 9,
        font: boldFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  };
  
  // Top row: Top view and Side view
  drawDiagramOrPlaceholder(topViewImage, margin, yPosition, diagramBoxWidth, diagramBoxHeight, 'BOVENAANZICHT');
  drawDiagramOrPlaceholder(sideViewImage, margin + diagramBoxWidth + 10, yPosition, diagramBoxWidth, diagramBoxHeight, 'ZIJAANZICHT');
  
  yPosition -= diagramBoxHeight + 10;
  
  // Bottom row: Front view and Rear view (if we have any diagrams at all)
  if (diagramEmbedded) {
    page = ensureSpace(diagramBoxHeight + 20);
    drawDiagramOrPlaceholder(frontViewImage, margin, yPosition, diagramBoxWidth, diagramBoxHeight, 'VOORAANZICHT');
    drawDiagramOrPlaceholder(rearViewImage, margin + diagramBoxWidth + 10, yPosition, diagramBoxWidth, diagramBoxHeight, 'ACHTERAANZICHT');
    yPosition -= diagramBoxHeight + 20;
  } else {
    yPosition -= 20;
  }
  
  // Ensure space for signatures
  page = ensureSpace(100);
  
  // Signature Section
  page.drawText('HANDTEKENINGEN', {
    x: margin,
    y: yPosition,
    size: 10,
    font: boldFont,
  });
  
  yPosition -= 15;
  
  const signatureBoxWidth = (width - margin * 2 - 10) / 2;
  const signatureBoxHeight = 60;
  
  // Customer signature
  drawBox(page, margin, yPosition, signatureBoxWidth, signatureBoxHeight, 'Handtekening huurder');
  page.drawText('Datum: ___/___/______', {
    x: margin + 5,
    y: yPosition - signatureBoxHeight + 5,
    size: 8,
    font,
  });
  
  // Company signature
  drawBox(page, margin + signatureBoxWidth + 10, yPosition, signatureBoxWidth, signatureBoxHeight, 'Handtekening verhuurder');
  page.drawText('Datum: ___/___/______', {
    x: margin + signatureBoxWidth + 15,
    y: yPosition - signatureBoxHeight + 5,
    size: 8,
    font,
  });
  
  // Footer on last page
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lastPage.drawText(`Template: ${template.name}`, {
    x: margin,
    y: 30,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
