import { Router } from 'express';
import { db } from '../db.js';
import { vehicles, customers, reservations, emailLogs } from '../../shared/schema.js';
import { eq, and, isNotNull, inArray } from 'drizzle-orm';
import { sendEmail, EmailTemplates } from '../utils/mailersend-service.js';

const router = Router();

// Send notifications to customers
router.post('/send', async (req, res) => {
  try {
    const { vehicleIds, template, customMessage, customSubject } = req.body;
    
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
      
      if (!customer?.email) {
        results.failed++;
        results.errors.push(`No email for vehicle ${vehicle.licensePlate}`);
        continue;
      }

      try {
        let emailContent;
        let fromEmail = 'notifications@autoleaselam.nl'; // You should replace with your verified domain

        switch (template) {
          case 'apk':
            emailContent = EmailTemplates.apkReminder(
              customer.name || 'Customer',
              vehicle.licensePlate || 'Unknown',
              vehicle.apkDate ? new Date(vehicle.apkDate).toLocaleDateString('nl-NL') : 'Unknown'
            );
            break;
          case 'maintenance':
            emailContent = EmailTemplates.maintenanceReminder(
              customer.name || 'Customer',
              vehicle.licensePlate || 'Unknown',
              'Regular Service' // You could make this dynamic based on vehicle data
            );
            break;
          case 'custom':
            emailContent = EmailTemplates.generalNotification(
              customer.name || 'Customer',
              vehicle.licensePlate || 'Unknown',
              customMessage
            );
            break;
          default:
            throw new Error('Invalid template');
        }

        const success = await sendEmail({
          to: customer.email,
          toName: customer.name || undefined,
          from: fromEmail,
          fromName: 'Autolease Lam',
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });

        if (success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Failed to send to ${customer.email} for vehicle ${vehicle.licensePlate}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error sending to ${customer.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

export default router;