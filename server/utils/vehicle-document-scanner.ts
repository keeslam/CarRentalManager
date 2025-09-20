import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExtractedVehicleData {
  licensePlate: string;
  brand: string;
  model: string;
  chassisNumber: string;
  vehicleType: string;
  fuel: string;
  apkDate: string;
  registrationDate?: string;
  color?: string;
  engineCapacity?: string;
}

/**
 * Process vehicle registration document using Google Gemini AI
 */
export async function processVehicleDocumentWithAI(documentPath: string): Promise<ExtractedVehicleData> {
  try {
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set. Please configure your Google Gemini API key.');
    }

    if (process.env.GEMINI_API_KEY.trim() === '') {
      throw new Error('GEMINI_API_KEY is empty. Please provide a valid Google Gemini API key.');
    }

    // Read document file as base64
    const documentBytes = fs.readFileSync(documentPath);
    const base64Document = Buffer.from(documentBytes).toString('base64');
    
    const prompt = `
You are an expert document processor for a car rental company. Analyze this vehicle registration document (Dutch kentekenbewijs) and extract the following information in JSON format:

{
  "licensePlate": "License plate number (Dutch format like AB-123-C or 12-ABC-3)",
  "brand": "Vehicle manufacturer/brand",
  "model": "Vehicle model name",
  "chassisNumber": "VIN/chassis number",
  "vehicleType": "Vehicle type (Sedan, SUV, Van, Hatchback, etc.)",
  "fuel": "Fuel type (Benzine/Gasoline, Diesel, Electric, Hybrid, LPG, etc.)",
  "apkDate": "APK expiration date in YYYY-MM-DD format",
  "registrationDate": "First registration date in YYYY-MM-DD format",
  "color": "Vehicle color",
  "engineCapacity": "Engine displacement/capacity"
}

IMPORTANT INSTRUCTIONS:
- This is a Dutch vehicle registration document (kentekenbewijs)
- Extract the license plate in proper Dutch format with dashes (e.g., AB-123-C)
- For Dutch terms: 
  - "Merk" = brand/manufacturer
  - "Type" or "Handelsnaam" = model
  - "Kenteken" = license plate
  - "Chassisnummer" or "VIN" = chassis number
  - "Brandstof" = fuel type
  - "Vervaldatum APK" = APK expiration date
  - "Datum eerste toelating" = first registration date
  - "Kleur" = color
- Convert all dates to YYYY-MM-DD format
- For fuel types, map Dutch terms: Benzine → Gasoline, Diesel → Diesel, Elektriciteit → Electric
- If a field is not clearly visible or found, use null
- Be very precise with the license plate format

Please respond ONLY with the JSON object, no additional text.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            licensePlate: { type: "string" },
            brand: { type: "string" },
            model: { type: "string" },
            chassisNumber: { type: "string" },
            vehicleType: { type: "string" },
            fuel: { type: "string" },
            apkDate: { type: "string" },
            registrationDate: { type: "string" },
            color: { type: "string" },
            engineCapacity: { type: "string" }
          }
        }
      },
      content: {
        parts: [
          {
            text: prompt
          },
          {
            file: {
              mimeType: documentPath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
              data: base64Document
            }
          }
        ]
      }
    });

    if (!response.response?.text()) {
      throw new Error('No response from AI service');
    }

    const parsedData = JSON.parse(response.response.text());
    
    // Clean and validate the extracted data
    const cleanedData: ExtractedVehicleData = {
      licensePlate: parsedData.licensePlate?.trim() || '',
      brand: parsedData.brand?.trim() || '',
      model: parsedData.model?.trim() || '',
      chassisNumber: parsedData.chassisNumber?.trim() || '',
      vehicleType: mapVehicleType(parsedData.vehicleType?.trim() || ''),
      fuel: mapFuelType(parsedData.fuel?.trim() || ''),
      apkDate: validateAndFormatDate(parsedData.apkDate),
      registrationDate: validateAndFormatDate(parsedData.registrationDate),
      color: parsedData.color?.trim() || '',
      engineCapacity: parsedData.engineCapacity?.trim() || ''
    };

    return cleanedData;
    
  } catch (error) {
    console.error('Error processing vehicle document with AI:', error);
    throw new Error('Failed to process vehicle document: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Map vehicle type to standardized values
 */
function mapVehicleType(type: string): string {
  const lowerType = type.toLowerCase();
  
  const typeMap: { [key: string]: string } = {
    'personenauto': 'Sedan',
    'sedan': 'Sedan',
    'stationwagon': 'Van',
    'station wagon': 'Van',
    'hatchback': 'Hatchback',
    'suv': 'SUV',
    'mpv': 'SUV',
    'cabriolet': 'Coupe',
    'coupe': 'Coupe',
    'bestelwagen': 'Van',
    'van': 'Van',
    'truck': 'Truck',
    'vrachtwagen': 'Truck'
  };

  for (const [key, value] of Object.entries(typeMap)) {
    if (lowerType.includes(key)) {
      return value;
    }
  }

  return type || 'Other';
}

/**
 * Map fuel type to standardized values
 */
function mapFuelType(fuel: string): string {
  const lowerFuel = fuel.toLowerCase();
  
  const fuelMap: { [key: string]: string } = {
    'benzine': 'Gasoline',
    'gasoline': 'Gasoline',
    'petrol': 'Gasoline',
    'diesel': 'Diesel',
    'elektriciteit': 'Electric',
    'electric': 'Electric',
    'elektrisch': 'Electric',
    'hybride': 'Hybrid',
    'hybrid': 'Hybrid',
    'lpg': 'LPG',
    'cng': 'CNG',
    'gas': 'LPG'
  };

  for (const [key, value] of Object.entries(fuelMap)) {
    if (lowerFuel.includes(key)) {
      return value;
    }
  }

  return fuel || 'Other';
}

/**
 * Validate and format date to YYYY-MM-DD
 */
function validateAndFormatDate(dateStr: string): string {
  if (!dateStr || dateStr === 'null' || dateStr.trim() === '') {
    return '';
  }

  try {
    // Try to parse the date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // Try different date formats
      const formats = [
        /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
        /(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
        /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
      ];

      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          const [, day, month, year] = match;
          const formattedDate = new Date(`${year}-${month}-${day}`);
          if (!isNaN(formattedDate.getTime())) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }
      }
      
      return '';
    }

    // Format as YYYY-MM-DD
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Date parsing error:', error);
    return '';
  }
}

/**
 * Validate extracted vehicle data
 */
export function validateExtractedVehicleData(data: ExtractedVehicleData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.licensePlate || data.licensePlate.trim() === '') {
    errors.push('License plate is required');
  }
  
  if (!data.brand || data.brand.trim() === '') {
    errors.push('Vehicle brand is required');
  }
  
  if (!data.model || data.model.trim() === '') {
    errors.push('Vehicle model is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}