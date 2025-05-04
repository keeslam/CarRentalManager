/**
 * PDF generation utility to create rental contracts
 * Using the ELENA AVL ALL contract template
 */

import { Reservation } from "@shared/schema";
import { format } from "date-fns";
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generates a rental contract PDF based on the Auto Lease LAM template
 * Uses the uploaded template PDF and fills in the data
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
    const fontSize = 10;
    const textColor = rgb(0, 0, 0);
    
    // Contract number and date
    page.drawText(`Contract: ${contractData.contractNumber}`, {
      x: 400,
      y: 690,
      size: 10,
      font: helveticaBold,
      color: textColor,
    });
    
    page.drawText(`Datum: ${contractData.contractDate}`, {
      x: 400,
      y: 675,
      size: 10,
      font: helveticaFont,
      color: textColor,
    });
    
    // Vehicle information
    page.drawText(contractData.licensePlate, {
      x: 180,
      y: 585,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    page.drawText(`${contractData.brand} ${contractData.model}`, {
      x: 180,
      y: 570,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    page.drawText(contractData.chassisNumber, {
      x: 180,
      y: 555,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Customer information
    page.drawText(contractData.customerName, {
      x: 180,
      y: 500,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    page.drawText(contractData.customerAddress, {
      x: 180,
      y: 485,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    page.drawText(`${contractData.customerCity} ${contractData.customerPostalCode}`, {
      x: 180,
      y: 470,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    page.drawText(contractData.customerPhone, {
      x: 180,
      y: 455,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    page.drawText(contractData.driverLicense, {
      x: 180,
      y: 440,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Rental period
    page.drawText(contractData.startDate, {
      x: 180,
      y: 385,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    page.drawText(contractData.endDate, {
      x: 180,
      y: 370,
      size: fontSize,
      font: helveticaFont,
      color: textColor,
    });
    
    // Price
    page.drawText(contractData.totalPrice, {
      x: 180,
      y: 330,
      size: fontSize,
      font: helveticaBold,
      color: textColor,
    });
    
    // Today's date at the bottom for signature
    page.drawText(contractData.contractDate, {
      x: 180,
      y: 120,
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
    totalPrice: formatCurrency(reservation.totalPrice),
  };
}

/**
 * Format a number as currency (Euro)
 */
function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '€0.00';
  }
  
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}