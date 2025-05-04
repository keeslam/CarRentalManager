/**
 * PDF generation utility to create rental contracts
 * Using the ELENA AVL ALL contract template or custom templates
 */

import { Reservation, PdfTemplate } from "@shared/schema";
import { format } from "date-fns";
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, rgb, StandardFonts, TextAlignment } from 'pdf-lib';

/**
 * Generates a rental contract PDF using a custom template
 * @param reservation Reservation data
 * @param template Optional PDF template. If not provided, the default template will be used.
 */
export async function generateRentalContractFromTemplate(reservation: Reservation, template?: PdfTemplate): Promise<Buffer> {
  try {
    // Extract data for the contract
    const contractData = prepareContractData(reservation);
    
    // Check if a template background exists
    let pdfDoc;
    let page;
    
    // Sample values for preview if needed
    const previewMode = reservation.id === 0;
    if (previewMode) {
      console.log('Preview mode enabled - using sample data for fields');
    }
    
    // Always try to use the template background
    try {
      // Default template path for the contract background
      const templatePath = path.join(
        process.cwd(), 
        'uploads/templates/rental_contract_template.pdf'
      );
      
      console.log('Loading template from path:', templatePath);
      
      // Check if the file exists
      if (fs.existsSync(templatePath)) {
        const templateBytes = fs.readFileSync(templatePath);
        
        // Load the PDF document
        pdfDoc = await PDFDocument.load(templateBytes);
        
        // Get the first page or add one if the PDF is empty
        if (pdfDoc.getPageCount() > 0) {
          page = pdfDoc.getPage(0);
          console.log('Successfully loaded template background');
        } else {
          console.log('Template PDF exists but has no pages, creating new page');
          page = pdfDoc.addPage([595, 842]); // A4 size
        }
      } else {
        console.log('Template file not found, creating new document');
        pdfDoc = await PDFDocument.create();
        page = pdfDoc.addPage([595, 842]); // A4 size
      }
    } catch (error) {
      console.error('Error loading template background:', error);
      // Fall back to creating a new document
      pdfDoc = await PDFDocument.create();
      page = pdfDoc.addPage([595, 842]); // A4 size
    }
    
    // Get fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Default text color
    const textColor = rgb(0, 0, 0);
    
    // If template is provided, process template fields
    if (template && template.fields) {
      console.log('Processing template fields');
      
      // Parse fields if they're stored as a string
      let fields;
      try {
        fields = typeof template.fields === 'string' 
          ? JSON.parse(template.fields) 
          : template.fields;
          
        console.log(`Found ${fields.length} fields to render`);
      } catch (error) {
        console.error('Error parsing template fields:', error);
        fields = [];
      }
      
      // Draw each field
      for (const field of fields) {
        try {
          // Get the field value from the contract data based on the source
          let value = '';
          
          // Use field name or source as placeholder in preview mode
          if (previewMode) {
            // For preview mode, use the field name to clearly identify the field position
            value = field.name || field.source || 'Field';
          } else {
            // For normal contract generation, use actual data
            if (field.source === 'customerName') value = contractData.customerName;
            else if (field.source === 'customerAddress') value = contractData.customerAddress;
            else if (field.source === 'customerCity') value = contractData.customerCity;
            else if (field.source === 'customerPostalCode') value = contractData.customerPostalCode;
            else if (field.source === 'customerPhone') value = contractData.customerPhone;
            else if (field.source === 'driverLicense') value = contractData.driverLicense;
            else if (field.source === 'contractNumber') value = contractData.contractNumber;
            else if (field.source === 'contractDate') value = contractData.contractDate;
            else if (field.source === 'licensePlate') value = contractData.licensePlate;
            else if (field.source === 'brand') value = contractData.brand;
            else if (field.source === 'model') value = contractData.model;
            else if (field.source === 'chassisNumber') value = contractData.chassisNumber;
            else if (field.source === 'startDate') value = contractData.startDate;
            else if (field.source === 'endDate') value = contractData.endDate;
            else if (field.source === 'duration') value = contractData.duration;
            else if (field.source === 'totalPrice') value = contractData.totalPrice;
            else if (field.name) value = field.name; // Use name as fallback
            else value = field.source || 'Field'; // Second fallback
          }
          
          // Log in preview mode to help with debugging
          if (previewMode) {
            console.log(`Rendering preview field: ${value} at position (${field.x}, ${field.y})`);
          }
          
          // Ensure we have a value to display
          if (!value) {
            value = field.label || field.source || '(empty)';
          }
          
          // Determine text alignment
          let textAlignment: TextAlignment = TextAlignment.Left;
          if (field.textAlign === 'center') textAlignment = TextAlignment.Center;
          else if (field.textAlign === 'right') textAlignment = TextAlignment.Right;
          
          // Draw the text field with proper alignment
          const options: any = {
            x: Number(field.x) || 0,
            y: 842 - (Number(field.y) || 0), // Flip Y-coordinate (PDF origin is bottom-left)
            size: Number(field.fontSize) || 12,
            font: field.isBold ? helveticaBold : helveticaFont,
            color: previewMode ? rgb(0, 0.4, 0.8) : textColor // Use blue color for preview mode to make fields stand out
          };
          
          // For preview mode, add a visual indicator of field boundaries
          if (previewMode) {
            // Draw a light rectangle around the field to make it more visible
            try {
              // Calculate text width (approximate)
              const textWidth = helveticaFont.widthOfTextAtSize(value, Number(field.fontSize) || 12);
              const textHeight = (Number(field.fontSize) || 12) * 1.2;
              
              // Draw rectangle with slight padding
              page.drawRectangle({
                x: options.x - 2,
                y: options.y - 2,
                width: textWidth + 4,
                height: textHeight,
                borderColor: rgb(0.7, 0.7, 0.9),
                borderWidth: 0.5,
                color: rgb(0.95, 0.95, 1),
                opacity: 0.3
              });
            } catch (error) {
              console.error('Error drawing field highlight:', error);
            }
          }
          
          // Add alignment property as part of PDF.js options
          if (textAlignment === TextAlignment.Center) {
            // @ts-ignore: TextAlignment is not properly typed in pdf-lib
            options.textAlign = TextAlignment.Center;
          } else if (textAlignment === TextAlignment.Right) {
            // @ts-ignore: TextAlignment is not properly typed in pdf-lib
            options.textAlign = TextAlignment.Right;
          }
          
          console.log(`Drawing field: ${field.label || field.source} at position (${options.x}, ${options.y}) with value: ${value}`);
          page.drawText(value, options);
        } catch (error) {
          console.error(`Error drawing field ${field.label || field.source}:`, error);
        }
      }
    } else {
      console.log('No template fields found');
    }
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    
    // Return the PDF as a buffer
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error generating PDF contract from template:', error);
    // If there's an error, return a simple text-based contract as a fallback
    const contractData = prepareContractData(reservation);
    return generateFallbackContract(contractData);
  }
}

/**
 * Generates a rental contract PDF based on the ELENA AVL ALL contract template
 * Uses the uploaded template PDF and fills in the data according to the form layout
 */
export async function generateRentalContract(reservation: Reservation): Promise<Buffer> {
  try {
    // Extract data for the contract
    const contractData = prepareContractData(reservation);
    
    // Load the template PDF
    const templatePath = path.join(process.cwd(), 'uploads/templates/rental_contract_template.pdf');
    const templateBytes = fs.readFileSync(templatePath);
    
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(templateBytes);
    
    // Get the first page
    const page = pdfDoc.getPage(0);
    
    // Get fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Set drawing parameters
    const fontSize = 9;
    const textColor = rgb(0, 0, 0);
    
    // Based on the ELENA AVL ALL contract template structure
    
    // First section - Gegevens voertuig (Vehicle details)
    
    // Merk (Brand)
    page.drawText(contractData.brand, {
      x: 55,
      y: 150,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Type (Model)
    page.drawText(contractData.model, {
      x: 55,
      y: 165,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Kenteken (License plate)
    page.drawText(contractData.licensePlate, {
      x: 55,
      y: 179,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Customer section - Huurder (Renter)
    
    // Naam (Name)
    page.drawText(contractData.customerName, {
      x: 55,
      y: 254,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Adres (Address)
    page.drawText(contractData.customerAddress, {
      x: 55,
      y: 268,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Postcode (Postal code)
    page.drawText(contractData.customerPostalCode, {
      x: 55,
      y: 282,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Plaats (City)
    page.drawText(contractData.customerCity, {
      x: 55,
      y: 296,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Land (Country)
    page.drawText("Nederland", {
      x: 95,
      y: 313,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Telefoon (Phone)
    page.drawText(contractData.customerPhone, {
      x: 58,
      y: 328,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Driver's license
    page.drawText(contractData.driverLicense, {
      x: 100,
      y: 358,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Right column - Voorwaarden (Terms)
    
    // Huurtijd van-tot (Rental period from-to) - van datum
    page.drawText(contractData.startDate, {
      x: 405,
      y: 149,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // tot datum (to date)
    page.drawText(contractData.endDate, {
      x: 545,
      y: 149,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Price section
    if (reservation.totalPrice) {
      // Total price
      page.drawText(contractData.totalPrice, {
        x: 508,
        y: 236,
        size: fontSize,
        font: helveticaBold,
        color: textColor,
      });
    }
    
    // Date at the bottom - Today's date for signature
    page.drawText(contractData.contractDate, {
      x: 138,
      y: 637,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    
    // Return the PDF as a buffer
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error generating PDF contract:', error);
    // If there's an error, return a simple text-based contract as a fallback
    const contractData = prepareContractData(reservation);
    return generateFallbackContract(contractData);
  }
}

/**
 * Generate a fallback text-based contract if PDF generation fails
 */
function generateFallbackContract(contractData: any): Buffer {
  const contractTemplate = `
Auto Lease LAM
Kerkweg 47a
3214 VC Zuidland
Tel. 0181-451040
Fax 0181-453386
info@autobedrijflam.nl

- ABN AMRO 428621783
- RABOBANK 375915605
- Ook mogelijk met Creditcard, VISA of MASTERCARD te betalen

RENTAL CONTRACT

Contract Number: ${contractData.contractNumber}
Date: ${contractData.contractDate}

VEHICLE INFORMATION:
License Plate: ${contractData.licensePlate}
Brand: ${contractData.brand}
Model: ${contractData.model}
Chassis Number: ${contractData.chassisNumber}

CUSTOMER INFORMATION:
Name: ${contractData.customerName}
Address: ${contractData.customerAddress}
City: ${contractData.customerCity} ${contractData.customerPostalCode}
Phone: ${contractData.customerPhone}
Driver License: ${contractData.driverLicense}

RENTAL PERIOD:
Start Date: ${contractData.startDate}
End Date: ${contractData.endDate}
Duration: ${contractData.duration}

RENTAL PRICE:
Total Price: ${contractData.totalPrice}

TERMS AND CONDITIONS:
1. The vehicle must be returned in the same condition as at the start of the rental period.
2. The renter is responsible for any damage to the vehicle during the rental period.
3. The vehicle must not be used for illegal purposes.
4. The vehicle must not be driven outside of the Netherlands without prior permission.
5. The vehicle must be returned with the same amount of fuel as at the start of the rental period.

SIGNATURES:

Auto Lease LAM: ___________________

Customer: _________________________

Date: ${contractData.contractDate}
`;

  return Buffer.from(contractTemplate);
}

/**
 * Prepare contract data from reservation
 */
export function prepareContractData(reservation: Reservation) {
  const vehicle = reservation.vehicle || {
    licensePlate: "Unknown",
    brand: "Unknown",
    model: "Unknown",
    chassisNumber: "Unknown",
  };
  
  const customer = reservation.customer || {
    name: "Unknown",
    address: "Unknown",
    city: "Unknown",
    postalCode: "Unknown",
    phone: "Unknown",
    driverLicenseNumber: "Unknown",
  };
  
  // Calculate duration in days
  const startDate = new Date(reservation.startDate);
  const endDate = new Date(reservation.endDate);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Parse totalPrice as a number if it's a string
  const totalPrice = typeof reservation.totalPrice === 'string' 
    ? parseFloat(reservation.totalPrice) 
    : reservation.totalPrice;
  
  return {
    contractNumber: `C-${reservation.id}-${format(new Date(), 'yyyyMMdd')}`,
    contractDate: format(new Date(), 'MMMM d, yyyy'),
    licensePlate: vehicle.licensePlate,
    brand: vehicle.brand,
    model: vehicle.model,
    chassisNumber: vehicle.chassisNumber || "Unknown",
    customerName: customer.name,
    customerAddress: customer.address || "Unknown",
    customerCity: customer.city || "Unknown",
    customerPostalCode: customer.postalCode || "Unknown",
    customerPhone: customer.phone || "Unknown",
    driverLicense: customer.driverLicenseNumber || "Unknown",
    startDate: format(startDate, 'MMMM d, yyyy'),
    endDate: format(endDate, 'MMMM d, yyyy'),
    duration: `${diffDays} day${diffDays !== 1 ? 's' : ''}`,
    totalPrice: formatCurrency(totalPrice),
  };
}

/**
 * Format a value as currency (Euro)
 * Handles number, string, null, or undefined
 */
function formatCurrency(amount: any): string {
  if (amount === null || amount === undefined) {
    return '€0.00';
  }
  
  // Convert to number if it's a string
  const numericAmount = typeof amount === 'string' 
    ? parseFloat(amount.replace(/[^\d.-]/g, '')) 
    : amount;
  
  // If it's NaN after conversion, return zero
  if (isNaN(numericAmount)) {
    return '€0.00';
  }
  
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numericAmount);
}