/**
 * Invoice scanning utility using Google Gemini Vision API
 * Processes PDF invoices and extracts expense data for car rental management
 */

import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { PDFDocument } from 'pdf-lib';

// Using Google Gemini for invoice processing - javascript_gemini integration
// The newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ParsedInvoiceLineItem {
  description: string;
  amount: number;
  category: string;
  subcategory?: string;
}

export interface ParsedInvoice {
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  totalAmount: number;
  lineItems: ParsedInvoiceLineItem[];
  vehicleInfo?: {
    licensePlate?: string;
    chassisNumber?: string;
  };
}

// Category mapping for Dutch and English terms
const CATEGORY_MAPPINGS = {
  // Maintenance related
  'onderhoud': 'Maintenance',
  'maintenance': 'Maintenance', 
  'reparatie': 'Maintenance',
  'repair': 'Maintenance',
  'service': 'Maintenance',
  'inspectie': 'Maintenance',
  'inspection': 'Maintenance',
  'olie': 'Maintenance',
  'oil': 'Maintenance',
  'filter': 'Maintenance',
  'remmen': 'Maintenance',
  'brakes': 'Maintenance',
  
  // Tires
  'banden': 'Tires',
  'tires': 'Tires',
  'tyres': 'Tires',
  'velgen': 'Tires',
  'wheels': 'Tires',
  'winterbanden': 'Tires',
  'winter tires': 'Tires',
  'zomerbanden': 'Tires',
  'summer tires': 'Tires',
  
  // Damage/Repair
  'schade': 'Damage',
  'damage': 'Damage',
  'herstel': 'Damage',
  'bodywork': 'Damage',
  'carrosserie': 'Damage',
  'deuken': 'Damage',
  'dent': 'Damage',
  'krassen': 'Damage',
  'scratch': 'Damage',
  
  // Fuel
  'brandstof': 'Fuel',
  'fuel': 'Fuel',
  'benzine': 'Fuel',
  'petrol': 'Fuel',
  'diesel': 'Fuel',
  'gas': 'Fuel',
  'lpg': 'Fuel',
  'electricity': 'Fuel',
  'elektriciteit': 'Fuel',
  
  // Insurance
  'verzekering': 'Insurance',
  'insurance': 'Insurance',
  'liability': 'Insurance',
  'aansprakelijkheid': 'Insurance',
  'all risk': 'Insurance',
  'allrisk': 'Insurance',
  
  // Registration/Legal
  'registratie': 'Registration',
  'registration': 'Registration',
  'belasting': 'Registration',
  'tax': 'Registration',
  'kenteken': 'Registration',
  'license plate': 'Registration',
  'apk': 'Registration',
  'mot': 'Registration',
  
  // Cleaning
  'reiniging': 'Cleaning',
  'cleaning': 'Cleaning',
  'was': 'Cleaning',
  'wash': 'Cleaning',
  'detailing': 'Cleaning',
  
  // Accessories
  'accessoires': 'Accessories',
  'accessories': 'Accessories',
  'uitrusting': 'Accessories',
  'equipment': 'Accessories',
  'radio': 'Accessories',
  'navigatie': 'Accessories',
  'navigation': 'Accessories'
};

/**
 * Convert PDF to images for OpenAI Vision processing
 */
async function pdfToBase64Images(pdfPath: string): Promise<string[]> {
  try {
    // For now, we'll use a simplified approach - convert first page to image
    // In production, you might want to use pdf2pic or similar library
    const pdfBytes = fs.readFileSync(pdfPath);
    
    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    if (pages.length === 0) {
      throw new Error('PDF has no pages');
    }
    
    // For this implementation, we'll send the entire PDF as base64
    // OpenAI can handle PDFs directly, but we convert to base64 for the API
    const base64 = Buffer.from(pdfBytes).toString('base64');
    return [base64];
  } catch (error) {
    console.error('Error converting PDF to base64:', error);
    throw new Error('Failed to process PDF file');
  }
}

/**
 * Categorize a line item based on description
 */
function categorizeLineItem(description: string): string {
  const lowerDesc = description.toLowerCase();
  
  // Check for exact matches first
  for (const [keyword, category] of Object.entries(CATEGORY_MAPPINGS)) {
    if (lowerDesc.includes(keyword.toLowerCase())) {
      return category;
    }
  }
  
  // Default to Other if no match found
  return 'Other';
}

/**
 * Process invoice with Google Gemini Vision API
 */
export async function processInvoiceWithAI(pdfPath: string): Promise<ParsedInvoice> {
  try {
    // Read PDF file as base64
    const pdfBytes = fs.readFileSync(pdfPath);
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');
    
    const prompt = `
You are an expert invoice processor for a car rental company. Analyze this PDF invoice and extract the following information in JSON format:

{
  "vendor": "Company name",
  "invoiceNumber": "Invoice/order number",
  "invoiceDate": "YYYY-MM-DD format",
  "currency": "EUR or other currency code", 
  "totalAmount": 123.45,
  "lineItems": [
    {
      "description": "Service or item description",
      "amount": 12.34,
      "category": "One of: Maintenance, Tires, Damage, Fuel, Insurance, Registration, Cleaning, Accessories, Other"
    }
  ],
  "vehicleInfo": {
    "licensePlate": "License plate if mentioned (Dutch format like XX-123-YZ)",
    "chassisNumber": "VIN/chassis number if mentioned"
  }
}

IMPORTANT INSTRUCTIONS:
- Extract ALL line items from the invoice, not just the total
- For Dutch invoices, understand terms like: onderhoud (maintenance), banden (tires), schade (damage), brandstof (fuel), verzekering (insurance)
- For amounts, use numbers only (no currency symbols)
- If vehicle info is not clearly stated, set those fields to null
- Be precise with dates - convert to YYYY-MM-DD format
- Categorize each line item appropriately based on automotive expense categories
- If unsure about a category, use "Other"

Please respond ONLY with the JSON object, no additional text.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            vendor: { type: "string" },
            invoiceNumber: { type: "string" },
            invoiceDate: { type: "string" },
            currency: { type: "string" },
            totalAmount: { type: "number" },
            lineItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  amount: { type: "number" },
                  category: { type: "string" },
                  subcategory: { type: "string" }
                },
                required: ["description", "amount", "category"]
              }
            },
            vehicleInfo: {
              type: "object",
              properties: {
                licensePlate: { type: "string" },
                chassisNumber: { type: "string" }
              }
            }
          },
          required: ["vendor", "invoiceNumber", "invoiceDate", "currency", "totalAmount", "lineItems"]
        }
      },
      contents: [
        {
          inlineData: {
            data: base64Pdf,
            mimeType: "application/pdf",
          },
        },
        prompt
      ],
    });

    const result = JSON.parse(response.text || '{}');
    
    // Validate and clean up the result
    const parsedInvoice: ParsedInvoice = {
      vendor: result.vendor || 'Unknown Vendor',
      invoiceNumber: result.invoiceNumber || '',
      invoiceDate: result.invoiceDate || new Date().toISOString().split('T')[0],
      currency: result.currency || 'EUR',
      totalAmount: Number(result.totalAmount) || 0,
      lineItems: (result.lineItems || []).map((item: any) => ({
        description: item.description || '',
        amount: Number(item.amount) || 0,
        category: item.category || categorizeLineItem(item.description || ''),
        subcategory: item.subcategory || undefined
      })),
      vehicleInfo: result.vehicleInfo ? {
        licensePlate: result.vehicleInfo.licensePlate || undefined,
        chassisNumber: result.vehicleInfo.chassisNumber || undefined
      } : undefined
    };
    
    // If no line items were extracted, create one from the total
    if (parsedInvoice.lineItems.length === 0 && parsedInvoice.totalAmount > 0) {
      parsedInvoice.lineItems.push({
        description: `Invoice from ${parsedInvoice.vendor}`,
        amount: parsedInvoice.totalAmount,
        category: 'Other'
      });
    }
    
    return parsedInvoice;
    
  } catch (error) {
    console.error('Error processing invoice with AI:', error);
    throw new Error('Failed to process invoice: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Generate a unique hash for an invoice to prevent duplicates
 */
export function generateInvoiceHash(invoice: ParsedInvoice): string {
  const hashString = `${invoice.vendor}-${invoice.invoiceNumber}-${invoice.invoiceDate}-${invoice.totalAmount}`;
  return Buffer.from(hashString).toString('base64');
}

/**
 * Validate parsed invoice data
 */
export function validateParsedInvoice(invoice: ParsedInvoice): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!invoice.vendor || invoice.vendor.trim() === '') {
    errors.push('Vendor name is required');
  }
  
  if (!invoice.invoiceDate || isNaN(new Date(invoice.invoiceDate).getTime())) {
    errors.push('Valid invoice date is required');
  }
  
  if (!invoice.totalAmount || invoice.totalAmount <= 0) {
    errors.push('Total amount must be greater than 0');
  }
  
  if (!invoice.lineItems || invoice.lineItems.length === 0) {
    errors.push('At least one line item is required');
  }
  
  // Validate line items
  invoice.lineItems.forEach((item, index) => {
    if (!item.description || item.description.trim() === '') {
      errors.push(`Line item ${index + 1}: Description is required`);
    }
    if (!item.amount || item.amount <= 0) {
      errors.push(`Line item ${index + 1}: Amount must be greater than 0`);
    }
    if (!item.category || item.category.trim() === '') {
      errors.push(`Line item ${index + 1}: Category is required`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}