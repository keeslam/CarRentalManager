/**
 * This is a simulated PDF generation utility
 * In a real application, this would use PDFKit or a similar library to generate actual PDFs
 */

import { Reservation } from "@shared/schema";
import { format } from "date-fns";

/**
 * Generates a rental contract PDF based on the Auto Lease LAM template
 * This function simulates PDF generation - in a real app, it would use PDFKit
 */
export async function generateRentalContract(reservation: Reservation): Promise<Buffer> {
  // Simulate PDF generation delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // In a real implementation, this would create a proper PDF with PDFKit
  // For this simulation, we'll return a placeholder buffer with contract data
  
  // Extract data for the contract
  const contractData = prepareContractData(reservation);
  
  // Simulate the contract template based on the PDF sample from the client
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

  // For simulation, return a buffer with the contract text
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
