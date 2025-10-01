import { Router } from 'express';
import { db } from '../db.js';
import { vehicles, customers, reservations, emailLogs } from '../../shared/schema.js';
import { eq, and, isNotNull, inArray } from 'drizzle-orm';
import { sendEmail, EmailTemplates } from '../utils/email-service.js';

// Helper function to replace placeholders in template strings
function replacePlaceholders(text: string, data: {
  customerName?: string;
  vehiclePlate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  apkDate?: string;
}): string {
  return text
    .replace(/\{customerName\}/g, data.customerName || '')
    .replace(/\{vehiclePlate\}/g, data.vehiclePlate || '')
    .replace(/\{vehicleBrand\}/g, data.vehicleBrand || '')
    .replace(/\{vehicleModel\}/g, data.vehicleModel || '')
    .replace(/\{apkDate\}/g, data.apkDate || '');
}

// Format license plate consistently using Dutch license plate patterns
function formatLicensePlate(plate: string | null): string {
  if (!plate) return '';
  
  // Remove all hyphens and spaces
  const clean = plate.replace(/[-\s]/g, '').toUpperCase();
  
  if (clean.length === 6) {
    // Detect pattern: digits (D) vs letters (L)
    const pattern = clean.split('').map(c => /\d/.test(c) ? 'D' : 'L').join('');
    
    // Common Dutch license plate patterns:
    // DD-LLL-D (e.g., 97-GRD-4)
    if (pattern === 'DDLLLD') {
      return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 6)}`;
    }
    // DD-DD-LL (e.g., 12-34-AB)
    else if (pattern === 'DDDDLL') {
      return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    }
    // LL-DD-DD (e.g., AB-12-34)
    else if (pattern === 'LLDDDD') {
      return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    }
    // DD-LL-DD (e.g., 12-AB-34)
    else if (pattern === 'DDLLDD') {
      return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    }
    // LL-LL-DD (e.g., AB-CD-12)
    else if (pattern === 'LLLLDD') {
      return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    }
    // LL-DD-LL (e.g., AB-12-CD)
    else if (pattern === 'LLDDLL') {
      return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    }
    // DD-LL-LL (e.g., 12-AB-CD)
    else if (pattern === 'DDLLLL') {
      return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    }
    // LLL-DD-D (e.g., ABC-12-3)
    else if (pattern === 'LLLDDD') {
      return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 6)}`;
    }
    // D-LLL-DD (e.g., 1-ABC-23)
    else if (pattern === 'DLLLDD') {
      return `${clean.slice(0, 1)}-${clean.slice(1, 4)}-${clean.slice(4, 6)}`;
    }
    // Default to XX-XX-XX if pattern not recognized
    else {
      return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
    }
  }
  
  return plate; // Return original if not 6 characters
}

const router = Router();

// Send notifications to customers
router.post('/send', async (req, res) => {
  try {
    const { vehicleIds, template, customMessage, customSubject, emailFieldSelection, individualEmailSelections } = req.body;
    
    if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
      return res.status(400).json({ error: 'Vehicle IDs are required' });
    }

    if (!template || !['apk', 'maintenance', 'custom'].includes(template)) {
      return res.status(400).json({ error: 'Valid template is required' });
    }

    if (template === 'custom' && (!customMessage || !customMessage.trim() || !customSubject || !customSubject.trim())) {
      return res.status(400).json({ error: 'Custom subject and message are required for custom template' });
    }

    // Get vehicles with their associated customers through reservations
    const vehicleData = await db
      .select({
        vehicle: vehicles,
        customer: customers,
      })
      .from(vehicles)
      .leftJoin(reservations, eq(reservations.vehicleId, vehicles.id))
      .leftJoin(customers, eq(customers.id, reservations.customerId))
      .where(
        and(
          inArray(vehicles.id, vehicleIds),
          isNotNull(customers.email) // Only include customers with email addresses
        )
      );

    if (vehicleData.length === 0) {
      return res.status(400).json({ error: 'No vehicles found with customer email addresses' });
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Send emails
    for (const data of vehicleData) {
      const vehicle = data.vehicle;
      const customer = data.customer;
      
      // Determine which email to use based on selection
      let selectedEmail = null;
      const emailField = emailFieldSelection || 'auto';
      
      // Check if there's an individual email selection for this vehicle
      const individualSelection = individualEmailSelections && individualEmailSelections[vehicle.id.toString()];
      
      if (individualSelection) {
        // Use individual selection if available
        switch (individualSelection) {
          case 'email':
            selectedEmail = customer?.email;
            break;
          case 'emailForMOT':
            selectedEmail = customer?.emailForMOT;
            break;
          case 'emailForInvoices':
            selectedEmail = customer?.emailForInvoices;
            break;
          case 'emailGeneral':
            selectedEmail = customer?.emailGeneral;
            break;
        }
      } else if (emailField === 'auto') {
        // Auto-select based on notification type
        if (template === 'apk' && customer?.emailForMOT) {
          selectedEmail = customer.emailForMOT;
        } else if (customer?.email) {
          selectedEmail = customer.email;
        } else if (customer?.emailGeneral) {
          selectedEmail = customer.emailGeneral;
        }
      } else {
        // Use specifically selected email field
        switch (emailField) {
          case 'email':
            selectedEmail = customer?.email;
            break;
          case 'emailForMOT':
            selectedEmail = customer?.emailForMOT;
            break;
          case 'emailForInvoices':
            selectedEmail = customer?.emailForInvoices;
            break;
          case 'emailGeneral':
            selectedEmail = customer?.emailGeneral;
            break;
        }
      }

      if (!selectedEmail) {
        results.failed++;
        results.errors.push(`No ${emailField === 'auto' ? 'suitable' : emailField} email for vehicle ${vehicle.licensePlate}`);
        continue;
      }

      try {
        let emailContent;

        // Prepare placeholder data
        const formattedPlate = formatLicensePlate(vehicle.licensePlate);
        const placeholderData = {
          customerName: customer?.name || 'Customer',
          vehiclePlate: formattedPlate,
          vehicleBrand: vehicle.brand || '',
          vehicleModel: vehicle.model || '',
          apkDate: vehicle.apkDate ? new Date(vehicle.apkDate).toLocaleDateString('nl-NL') : ''
        };

        switch (template) {
          case 'apk':
            emailContent = EmailTemplates.apkReminder(
              placeholderData.customerName,
              formattedPlate,
              placeholderData.apkDate || 'Unknown'
            );
            break;
          case 'maintenance':
            emailContent = EmailTemplates.maintenanceReminder(
              placeholderData.customerName,
              formattedPlate,
              'Regular Service' // You could make this dynamic based on vehicle data
            );
            break;
          case 'custom':
            // Replace placeholders in both subject and message
            const processedSubject = replacePlaceholders(customSubject, placeholderData);
            const processedMessage = replacePlaceholders(customMessage, placeholderData);
            
            // For custom templates, send ONLY the template content without any wrapper
            // Convert line breaks to HTML for proper formatting
            const htmlMessage = processedMessage
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .map(line => `<p>${line}</p>`)
              .join('');
            
            emailContent = {
              subject: processedSubject,
              html: htmlMessage,
              text: processedMessage
            };
            break;
          default:
            throw new Error('Invalid template');
        }

        // Map template type to email purpose
        let emailPurpose: 'apk' | 'maintenance' | 'gps' | 'custom' | undefined;
        if (template === 'apk') {
          emailPurpose = 'apk';
        } else if (template === 'maintenance') {
          emailPurpose = 'maintenance';
        } else if (template === 'custom') {
          emailPurpose = 'custom';
        }
        
        const success = await sendEmail({
          to: selectedEmail,
          toName: customer?.name || undefined,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        }, emailPurpose);

        if (success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Failed to send to ${selectedEmail} for vehicle ${vehicle.licensePlate}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error sending to ${selectedEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('Notification results:', results);

    // Log the email sending activity
    try {
      // Get subject based on template type
      let logSubject = '';
      if (template === 'custom') {
        logSubject = customSubject || 'Custom Message';
      } else if (template === 'apk') {
        logSubject = 'APK Inspection Reminder - Action Required';
      } else if (template === 'maintenance') {
        logSubject = 'Scheduled Maintenance Reminder';
      } else {
        logSubject = 'Notification';
      }

      await db.insert(emailLogs).values({
        template: template,
        subject: logSubject,
        recipients: vehicleData.length,
        emailsSent: results.sent,
        emailsFailed: results.failed,
        failureReason: results.errors.length > 0 ? results.errors.join('; ') : null,
        vehicleIds: vehicleIds,
        sentAt: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Failed to log email activity:', logError);
    }

    res.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined
    });

  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ 
      error: 'Failed to send notifications', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Send GPS activation email to GPS company
router.post('/send-gps-activation', async (req, res) => {
  try {
    const { vehicleData, isSwap } = req.body;

    if (!vehicleData || !vehicleData.imei) {
      return res.status(400).json({ error: 'Vehicle data with IMEI is required' });
    }

    // Fetch GPS recipient email from settings
    const gpsRecipientSetting = await db.query.appSettings.findFirst({
      where: (appSettings, { eq }) => eq(appSettings.key, 'gps_recipient_email')
    });

    const recipientEmail = gpsRecipientSetting?.value?.email;
    
    if (!recipientEmail) {
      return res.status(400).json({ 
        error: 'GPS recipient email not configured. Please configure it in settings.' 
      });
    }

    const { brand, model, licensePlate, imei } = vehicleData;
    const formattedPlate = formatLicensePlate(licensePlate);

    // Create email content based on swap status
    const subject = isSwap 
      ? `GPS Module Swap Request - ${brand} ${model} (${formattedPlate})`
      : `GPS Activation Request - ${brand} ${model} (${formattedPlate})`;

    const message = isSwap
      ? `Dear GPS Provider,\n\nWe request a GPS module swap for the following vehicle:\n\nVehicle: ${brand} ${model}\nLicense Plate: ${formattedPlate}\nNew IMEI: ${imei}\n\nPlease activate the new GPS module at your earliest convenience.\n\nThank you.`
      : `Dear GPS Provider,\n\nWe request GPS activation for the following vehicle:\n\nVehicle: ${brand} ${model}\nLicense Plate: ${formattedPlate}\nIMEI: ${imei}\n\nPlease activate this GPS device at your earliest convenience.\n\nThank you.`;

    // Send email using GPS-purpose email configuration
    const success = await sendEmail(
      {
        to: recipientEmail,
        subject: subject,
        text: message
      },
      'gps' // Use GPS-purpose email configuration
    );

    if (!success) {
      return res.status(500).json({ error: 'Failed to send GPS activation email' });
    }

    // Log the email
    try {
      await db.insert(emailLogs).values({
        template: 'gps',
        subject: subject,
        recipients: 1,
        emailsSent: 1,
        emailsFailed: 0,
        failureReason: null,
        vehicleIds: [],
        sentAt: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Failed to log GPS activation email:', logError);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error sending GPS activation email:', error);
    res.status(500).json({ 
      error: 'Failed to send GPS activation email', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;