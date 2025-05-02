/**
 * This is a simulated RDW API client
 * In a real application, this would make actual HTTP requests to the RDW API
 */

import { InsertVehicle } from "@shared/schema";
import { addMonths } from "date-fns";

/**
 * Simulates fetching vehicle information from the RDW API based on license plate
 */
export async function fetchVehicleInfoByLicensePlate(licensePlate: string): Promise<Partial<InsertVehicle>> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Remove any special characters or spaces
  const normalized = licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  // Simulate different responses based on license plate
  // In a real implementation, this would make an actual API call to the RDW service
  
  switch (normalized) {
    case "AB123C":
      return {
        licensePlate: "AB-123-C",
        brand: "Volkswagen",
        model: "Golf",
        vehicleType: "Hatchback",
        chassisNumber: "WVW123456789",
        fuel: "Gasoline",
        euroZone: "Euro 6",
        apkDate: getRandomFutureDate(3, 8),
        warrantyDate: getRandomFutureDate(6, 12)
      };
      
    case "XY789Z":
      return {
        licensePlate: "XY-789-Z",
        brand: "Toyota",
        model: "Corolla",
        vehicleType: "Sedan",
        chassisNumber: "JTD987654321",
        fuel: "Hybrid",
        euroZone: "Euro 6",
        apkDate: getRandomFutureDate(1, 4),
        warrantyDate: getRandomFutureDate(2, 6)
      };
      
    case "TR567P":
      return {
        licensePlate: "TR-567-P",
        brand: "Ford",
        model: "Focus",
        vehicleType: "Sedan",
        chassisNumber: "WF0123456789",
        fuel: "Diesel",
        euroZone: "Euro 5",
        apkDate: getRandomFutureDate(2, 5),
        warrantyDate: getRandomFutureDate(3, 9)
      };
    
    case "KL456R":
      return {
        licensePlate: "KL-456-R",
        brand: "BMW",
        model: "3 Series",
        vehicleType: "Sedan",
        chassisNumber: "WBKS123456789",
        fuel: "Gasoline",
        euroZone: "Euro 6",
        apkDate: getRandomFutureDate(1, 3),
        warrantyDate: getRandomFutureDate(4, 10)
      };
      
    case "PQ901T":
      return {
        licensePlate: "PQ-901-T",
        brand: "Mercedes-Benz",
        model: "C-Class",
        vehicleType: "Sedan",
        chassisNumber: "WDD123456789",
        fuel: "Diesel",
        euroZone: "Euro 6",
        apkDate: getRandomFutureDate(5, 10),
        warrantyDate: getRandomFutureDate(7, 14)
      };
      
    case "GH456T":
      return {
        licensePlate: "GH-456-T",
        brand: "Audi",
        model: "A4",
        vehicleType: "Sedan",
        chassisNumber: "WAU123456789",
        fuel: "Gasoline",
        euroZone: "Euro 6",
        apkDate: getRandomFutureDate(0, 1),
        warrantyDate: getRandomFutureDate(1, 3)
      };
    
    default:
      // Generate a random response for any other license plate
      return {
        licensePlate: formatLicensePlate(normalized),
        brand: getRandomBrand(),
        model: getRandomModel(),
        vehicleType: getRandomVehicleType(),
        chassisNumber: generateRandomChassisNumber(),
        fuel: getRandomFuelType(),
        euroZone: getRandomEuroZone(),
        apkDate: getRandomFutureDate(1, 12),
        warrantyDate: getRandomFutureDate(1, 24)
      };
  }
}

/**
 * Helper function to format a license plate with the Dutch format
 */
function formatLicensePlate(normalized: string): string {
  if (normalized.length === 6) {
    return `${normalized.slice(0, 2)}-${normalized.slice(2, 4)}-${normalized.slice(4, 6)}`;
  } else if (normalized.length === 7) {
    return `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5, 7)}`;
  } else if (normalized.length === 8) {
    return `${normalized.slice(0, 2)}-${normalized.slice(2, 4)}-${normalized.slice(4, 8)}`;
  } else {
    return normalized;
  }
}

/**
 * Get a random future date between min and max months from now
 */
function getRandomFutureDate(minMonths: number, maxMonths: number): string {
  const today = new Date();
  const randomMonths = minMonths + Math.floor(Math.random() * (maxMonths - minMonths));
  const futureDate = addMonths(today, randomMonths);
  return futureDate.toISOString().split('T')[0];
}

/**
 * Generate a random chassis/VIN number
 */
function generateRandomChassisNumber(): string {
  const characters = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 17; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Get a random car brand
 */
function getRandomBrand(): string {
  const brands = [
    "Volkswagen", "Toyota", "Ford", "BMW", "Mercedes-Benz", "Audi", "Volvo",
    "Peugeot", "Renault", "Citroën", "Kia", "Hyundai", "Opel", "Seat", "Skoda"
  ];
  return brands[Math.floor(Math.random() * brands.length)];
}

/**
 * Get a random car model
 */
function getRandomModel(): string {
  const models = [
    "Golf", "Corolla", "Focus", "3 Series", "C-Class", "A4", "V60",
    "308", "Clio", "C3", "Sportage", "i30", "Astra", "Leon", "Octavia"
  ];
  return models[Math.floor(Math.random() * models.length)];
}

/**
 * Get a random vehicle type
 */
function getRandomVehicleType(): string {
  const types = ["Sedan", "Hatchback", "SUV", "Van", "Coupe", "Truck"];
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Get a random fuel type
 */
function getRandomFuelType(): string {
  const fuels = ["Gasoline", "Diesel", "Electric", "Hybrid", "LPG"];
  return fuels[Math.floor(Math.random() * fuels.length)];
}

/**
 * Get a random Euro Zone classification
 */
function getRandomEuroZone(): string {
  const zones = ["Euro 4", "Euro 5", "Euro 6", "Euro 6d"];
  return zones[Math.floor(Math.random() * zones.length)];
}
