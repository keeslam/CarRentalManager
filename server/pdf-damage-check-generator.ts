import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { db } from './db';
import { damageCheckPdfTemplates, damageCheckTemplates } from '../shared/schema';
import { eq } from 'drizzle-orm';

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

interface PdfTemplateSection {
  id: string;
  type: 'header' | 'contractInfo' | 'vehicleData' | 'checklist' | 'diagram' | 'remarks' | 'signatures' | 'customField';
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  settings: {
    fontSize?: number;
    checkboxSize?: number;
    companyName?: string;
    headerColor?: string;
    headerFontSize?: number;
    showLogo?: boolean;
    logoPath?: string;
    customLabel?: string;
    textAlign?: 'left' | 'center' | 'right';
    columnCount?: number;
    fieldText?: string;
    hasCheckbox?: boolean;
    hasText?: boolean;
    [key: string]: any;
  };
}

interface PdfTemplate {
  id: number;
  name: string;
  isDefault: boolean;
  sections: PdfTemplateSection[];
  pageMargins?: number;
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

/**
 * Generate damage check PDF using the template system with custom section layout
 */
export async function generateDamageCheckPDFWithTemplate(
  vehicle: VehicleData,
  damageTemplate: DamageCheckTemplate,
  reservationData?: ReservationData,
  interactiveDamageCheck?: any
): Promise<Buffer> {
  // Fetch the default PDF template
  const [pdfTemplate] = await db.select().from(damageCheckPdfTemplates).where(eq(damageCheckPdfTemplates.isDefault, true)).limit(1);
  
  // If no template found, fall back to standard generation
  if (!pdfTemplate || !pdfTemplate.sections) {
    return generateDamageCheckPDF(vehicle, damageTemplate, reservationData);
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { height } = page.getSize();
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Helper to convert hex color to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0.2, g: 0.3, b: 0.6 };
  };
  
  // Render each visible section based on template
  for (const section of (pdfTemplate.sections as PdfTemplateSection[])) {
    if (!section.visible) continue;
    
    // PDF coordinates are from bottom-left, so convert from top-left
    const pdfY = height - section.y - section.height;
    
    switch (section.type) {
      case 'header': {
        const headerColor = hexToRgb(section.settings.headerColor || '#334d99');
        const headerFontSize = section.settings.headerFontSize || 14;
        const companyName = section.settings.companyName || 'LAM GROUP';
        
        // Draw header background
        page.drawRectangle({
          x: section.x,
          y: pdfY,
          width: section.width,
          height: section.height,
          color: rgb(headerColor.r, headerColor.g, headerColor.b),
        });
        
        // Draw company name
        page.drawText(companyName, {
          x: section.x + section.width / 2 - (companyName.length * headerFontSize * 0.3),
          y: pdfY + section.height / 2 - headerFontSize / 2,
          size: headerFontSize,
          font: boldFont,
          color: rgb(1, 1, 1),
        });
        
        // Load logo if available
        if (section.settings.logoPath) {
          try {
            const logoPath = path.join(process.cwd(), section.settings.logoPath);
            const logoBytes = await fs.readFile(logoPath);
            let logoImage;
            
            if (section.settings.logoPath.toLowerCase().endsWith('.png')) {
              logoImage = await pdfDoc.embedPng(logoBytes);
            } else if (section.settings.logoPath.toLowerCase().match(/\.(jpg|jpeg)$/)) {
              logoImage = await pdfDoc.embedJpg(logoBytes);
            }
            
            if (logoImage) {
              const logoHeight = section.height * 0.8;
              const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
              page.drawImage(logoImage, {
                x: section.x + 10,
                y: pdfY + (section.height - logoHeight) / 2,
                width: logoWidth,
                height: logoHeight,
              });
            }
          } catch (error) {
            console.warn('Could not load logo:', error);
          }
        }
        break;
      }
      
      case 'contractInfo': {
        const fontSize = section.settings.fontSize || 9;
        const lineHeight = fontSize + 4;
        const sectionLabel = section.settings.customLabel || 'CONTRACTGEGEVENS';
        let yPos = pdfY + section.height - 15;
        
        page.drawText(sectionLabel, {
          x: section.x + 5,
          y: yPos,
          size: fontSize + 1,
          font: boldFont,
        });
        
        yPos -= lineHeight;
        
        if (reservationData) {
          const items = [
            { label: 'Contract Nr:', value: reservationData.contractNumber || 'N/A' },
            { label: 'Datum:', value: new Date().toLocaleDateString('nl-NL') },
            { label: 'Klant:', value: reservationData.customerName || 'N/A' },
            { label: 'Periode:', value: `${reservationData.startDate || ''} - ${reservationData.endDate || ''}` },
          ];
          
          items.forEach(item => {
            page.drawText(`${item.label} ${item.value}`, {
              x: section.x + 5,
              y: yPos,
              size: fontSize,
              font,
            });
            yPos -= lineHeight;
          });
        }
        break;
      }
      
      case 'vehicleData': {
        const fontSize = section.settings.fontSize || 9;
        const lineHeight = fontSize + 4;
        const sectionLabel = section.settings.customLabel || 'VOERTUIGGEGEVENS';
        let yPos = pdfY + section.height - 15;
        
        page.drawText(sectionLabel, {
          x: section.x + 5,
          y: yPos,
          size: fontSize + 1,
          font: boldFont,
        });
        
        yPos -= lineHeight;
        
        const items = [
          { label: 'Kenteken:', value: vehicle.licensePlate },
          { label: 'Merk:', value: vehicle.brand },
          { label: 'Model:', value: vehicle.model },
          { label: 'Bouwjaar:', value: vehicle.buildYear || 'N/A' },
          { label: 'Km-stand:', value: vehicle.mileage ? `${vehicle.mileage} km` : 'N/A' },
          { label: 'Brandstof:', value: vehicle.fuel || 'N/A' },
        ];
        
        items.forEach(item => {
          page.drawText(`${item.label} ${item.value}`, {
            x: section.x + 5,
            y: yPos,
            size: fontSize,
            font,
          });
          yPos -= lineHeight;
        });
        break;
      }
      
      case 'checklist': {
        const fontSize = section.settings.fontSize || 8;
        const checkboxSize = section.settings.checkboxSize || 8;
        const lineHeight = fontSize + 3;
        const sectionLabel = section.settings.customLabel || 'SCHADECONTROLE';
        const columnCount = section.settings.columnCount || 3;
        let yPos = pdfY + section.height - 15;
        
        page.drawText(sectionLabel, {
          x: section.x + 5,
          y: yPos,
          size: fontSize + 2,
          font: boldFont,
        });
        
        yPos -= lineHeight * 2;
        
        // Group inspection points by category
        const categories = ['interieur', 'exterieur', 'afweez_check'];
        const categoryLabels: Record<string, string> = {
          interieur: 'Interieur',
          exterieur: 'Exterieur',
          afweez_check: 'Aflever Check'
        };
        
        // Calculate column width
        const columnWidth = (section.width - 10) / columnCount;
        const columnGap = 8;
        let currentColumn = 0;
        let columnYPos = yPos;
        
        for (const category of categories) {
          const points = damageTemplate.inspectionPoints.filter(p => p.category === category);
          if (points.length === 0) continue;
          
          // Check if we need to move to next column
          const categoryHeight = (points.length + 1) * lineHeight + lineHeight / 2;
          if (columnYPos - categoryHeight < pdfY + 10 && currentColumn < columnCount - 1) {
            currentColumn++;
            columnYPos = yPos;
          }
          
          const columnX = section.x + 5 + (currentColumn * (columnWidth + columnGap));
          
          // Category header
          page.drawText(categoryLabels[category] || category, {
            x: columnX,
            y: columnYPos,
            size: fontSize + 1,
            font: boldFont,
          });
          
          columnYPos -= lineHeight;
          
          // Inspection points
          for (const point of points) {
            if (columnYPos < pdfY + 10) {
              // Move to next column if we run out of space
              if (currentColumn < columnCount - 1) {
                currentColumn++;
                columnYPos = yPos;
              } else {
                break; // No more space
              }
            }
            
            const itemX = section.x + 5 + (currentColumn * (columnWidth + columnGap));
            
            // Checkbox
            page.drawRectangle({
              x: itemX + 5,
              y: columnYPos - checkboxSize,
              width: checkboxSize,
              height: checkboxSize,
              borderColor: rgb(0, 0, 0),
              borderWidth: 0.5,
            });
            
            // Point name (with text wrapping if needed)
            const maxTextWidth = columnWidth - checkboxSize - 15;
            let displayText = point.name;
            const textWidth = font.widthOfTextAtSize(displayText, fontSize);
            
            if (textWidth > maxTextWidth) {
              // Truncate with ellipsis if text is too long
              while (font.widthOfTextAtSize(displayText + '...', fontSize) > maxTextWidth && displayText.length > 0) {
                displayText = displayText.slice(0, -1);
              }
              displayText += '...';
            }
            
            page.drawText(displayText, {
              x: itemX + 5 + checkboxSize + 5,
              y: columnYPos - checkboxSize + 1,
              size: fontSize,
              font,
            });
            
            columnYPos -= lineHeight;
          }
          
          columnYPos -= lineHeight / 2; // Extra space between categories
        }
        break;
      }
      
      case 'diagram': {
        // Draw diagram placeholder box
        page.drawRectangle({
          x: section.x,
          y: pdfY,
          width: section.width,
          height: section.height,
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 1,
        });
        
        let diagramLoaded = false;
        
        // First, try to use the interactive damage check diagram with annotations
        if (interactiveDamageCheck?.diagramWithAnnotations) {
          try {
            // Extract base64 data from data URL (format: data:image/png;base64,...)
            const base64Data = interactiveDamageCheck.diagramWithAnnotations.split(',')[1];
            if (base64Data) {
              const diagramBytes = Buffer.from(base64Data, 'base64');
              const diagramImage = await pdfDoc.embedPng(diagramBytes);
              
              const imgHeight = section.height - 10;
              const imgWidth = (diagramImage.width / diagramImage.height) * imgHeight;
              page.drawImage(diagramImage, {
                x: section.x + (section.width - imgWidth) / 2,
                y: pdfY + 5,
                width: imgWidth,
                height: imgHeight,
              });
              diagramLoaded = true;
            }
          } catch (error) {
            console.warn('Could not load interactive damage check diagram:', error);
          }
        }
        
        // If no interactive diagram, show placeholder text
        if (!diagramLoaded) {
          page.drawText('VOERTUIGSCHEMA (Markeer schade)', {
            x: section.x + section.width / 2 - 60,
            y: pdfY + section.height / 2,
            size: 9,
            font: boldFont,
            color: rgb(0.5, 0.5, 0.5),
          });
          
          // Try to load template diagram if available
          if (damageTemplate.diagramTopView) {
            try {
              const diagramPath = path.join(process.cwd(), damageTemplate.diagramTopView);
              const diagramBytes = await fs.readFile(diagramPath);
              let diagramImage;
              
              if (damageTemplate.diagramTopView.toLowerCase().endsWith('.png')) {
                diagramImage = await pdfDoc.embedPng(diagramBytes);
              } else if (damageTemplate.diagramTopView.toLowerCase().match(/\.(jpg|jpeg)$/)) {
                diagramImage = await pdfDoc.embedJpg(diagramBytes);
              }
              
              if (diagramImage) {
                const imgHeight = section.height - 10;
                const imgWidth = (diagramImage.width / diagramImage.height) * imgHeight;
                page.drawImage(diagramImage, {
                  x: section.x + (section.width - imgWidth) / 2,
                  y: pdfY + 5,
                  width: imgWidth,
                  height: imgHeight,
                });
              }
            } catch (error) {
              console.warn('Could not load template diagram:', error);
            }
          }
        }
        break;
      }
      
      case 'remarks': {
        const fontSize = section.settings.fontSize || 9;
        const sectionLabel = section.settings.customLabel || 'OPMERKINGEN';
        
        page.drawText(sectionLabel, {
          x: section.x + 5,
          y: pdfY + section.height - 15,
          size: fontSize + 1,
          font: boldFont,
        });
        
        // Draw remarks box
        page.drawRectangle({
          x: section.x + 5,
          y: pdfY + 5,
          width: section.width - 10,
          height: section.height - 25,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.5,
        });
        break;
      }
      
      case 'signatures': {
        const fontSize = section.settings.fontSize || 9;
        const boxWidth = (section.width - 15) / 2;
        const signatureHeight = section.height - 20;
        
        // Customer signature
        page.drawRectangle({
          x: section.x + 5,
          y: pdfY + 5,
          width: boxWidth,
          height: signatureHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.5,
        });
        
        page.drawText('Handtekening Klant', {
          x: section.x + 5 + boxWidth / 2 - 40,
          y: pdfY + 10,
          size: fontSize,
          font: boldFont,
        });
        
        // Staff signature
        page.drawRectangle({
          x: section.x + 10 + boxWidth,
          y: pdfY + 5,
          width: boxWidth,
          height: signatureHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.5,
        });
        
        page.drawText('Handtekening Medewerker', {
          x: section.x + 10 + boxWidth + boxWidth / 2 - 55,
          y: pdfY + 10,
          size: fontSize,
          font: boldFont,
        });
        break;
      }
      
      case 'customField': {
        const fontSize = section.settings.fontSize || 9;
        const checkboxSize = section.settings.checkboxSize || 10;
        const hasCheckbox = section.settings.hasCheckbox !== false;
        const hasText = section.settings.hasText !== false;
        const fieldText = section.settings.fieldText || 'Field Label';
        
        let xPos = section.x + 5;
        const yPos = pdfY + section.height / 2;
        
        // Draw checkbox if enabled
        if (hasCheckbox) {
          page.drawRectangle({
            x: xPos,
            y: yPos - checkboxSize / 2,
            width: checkboxSize,
            height: checkboxSize,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5,
          });
          xPos += checkboxSize + 5;
        }
        
        // Draw text if enabled
        if (hasText) {
          page.drawText(fieldText, {
            x: xPos,
            y: yPos - fontSize / 2,
            size: fontSize,
            font,
          });
        }
        break;
      }
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
