import { format, parseISO, isValid } from 'date-fns';

/**
 * Format a date string to a readable format
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return '';
    
    return format(date, 'MMM d, yyyy');
  } catch (err) {
    return '';
  }
}

/**
 * Format a number as currency (Euro)
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return '';
  
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numAmount);
}

/**
 * Format a license plate with standard Dutch format
 */
export function formatLicensePlate(licensePlate: string | null | undefined): string {
  if (!licensePlate) return '';
  
  // Remove all non-alphanumeric characters
  const cleaned = licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  // Format based on common Dutch license plate formats
  if (cleaned.length === 6) {
    // Format XX-XX-XX
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}`;
  } else if (cleaned.length === 7) {
    // Format XX-XXX-X
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5, 7)}`;
  } else if (cleaned.length === 8) {
    // Format XX-XX-XXX
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 8)}`;
  }
  
  return cleaned;
}

/**
 * Format a phone number to standard Dutch format
 */
export function formatPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return '';
  
  // Remove all non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Check if it's a mobile number
  if (cleaned.startsWith('06') && cleaned.length === 10) {
    return `+31 ${cleaned.slice(1, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
  }
  
  // Other Dutch numbers
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `+31 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)}`;
  }
  
  // Already in international format
  if (cleaned.startsWith('31') && cleaned.length === 11) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 11)}`;
  }
  
  // Return as is if format is not recognized
  return phoneNumber;
}

/**
 * Get color class based on urgency (days until expiration)
 */
export function getUrgencyColorClass(days: number): string {
  if (days <= 14) return "bg-danger-50 text-danger-500"; // Within 2 weeks
  if (days <= 30) return "bg-warning-50 text-warning-500"; // Within 1 month
  return "bg-primary-100 text-primary-600"; // More than 1 month
}

/**
 * Format file size to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
