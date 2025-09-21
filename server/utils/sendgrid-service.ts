import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

export interface EmailOptions {
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  subject: string;
  html?: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const emailData: any = {
      to: options.to,
      from: {
        email: options.from,
        name: options.fromName || "Autolease Lam"
      },
      subject: options.subject,
    };

    if (options.text) {
      emailData.text = options.text;
    }
    if (options.html) {
      emailData.html = options.html;
    }

    await mailService.send(emailData);
    console.log('SendGrid email sent successfully to:', options.to);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

// Predefined email templates for common notifications
export const EmailTemplates = {
  apkReminder: (customerName: string, vehiclePlate: string, expiryDate: string) => ({
    subject: `APK Reminder - ${vehiclePlate} expires soon`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">APK Inspection Reminder</h2>
        <p>Dear ${customerName},</p>
        <p>This is a friendly reminder that your vehicle <strong>${vehiclePlate}</strong> requires an APK inspection.</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>APK Expiry Date:</strong> ${expiryDate}</p>
        </div>
        <p>Please schedule your APK inspection as soon as possible to ensure your vehicle remains roadworthy and legal.</p>
        <p>Contact us to schedule your appointment:</p>
        <ul>
          <li>Phone: Your phone number</li>
          <li>Email: Your email address</li>
        </ul>
        <p>Best regards,<br>Autolease Lam</p>
      </div>
    `,
    text: `Dear ${customerName},

This is a friendly reminder that your vehicle ${vehiclePlate} requires an APK inspection.

APK Expiry Date: ${expiryDate}

Please schedule your APK inspection as soon as possible to ensure your vehicle remains roadworthy and legal.

Contact us to schedule your appointment.

Best regards,
Autolease Lam`
  }),

  maintenanceReminder: (customerName: string, vehiclePlate: string, maintenanceType: string) => ({
    subject: `Maintenance Reminder - ${vehiclePlate} service due`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Vehicle Maintenance Reminder</h2>
        <p>Dear ${customerName},</p>
        <p>Your vehicle <strong>${vehiclePlate}</strong> is due for scheduled maintenance.</p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Maintenance Type:</strong> ${maintenanceType}</p>
        </div>
        <p>Regular maintenance helps ensure your vehicle's reliability, safety, and optimal performance.</p>
        <p>Contact us to schedule your service appointment:</p>
        <ul>
          <li>Phone: Your phone number</li>
          <li>Email: Your email address</li>
        </ul>
        <p>Best regards,<br>Autolease Lam</p>
      </div>
    `,
    text: `Dear ${customerName},

Your vehicle ${vehiclePlate} is due for scheduled maintenance.

Maintenance Type: ${maintenanceType}

Regular maintenance helps ensure your vehicle's reliability, safety, and optimal performance.

Contact us to schedule your service appointment.

Best regards,
Autolease Lam`
  }),

  generalNotification: (customerName: string, vehiclePlate: string, message: string) => ({
    subject: `Vehicle Notification - ${vehiclePlate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Vehicle Notification</h2>
        <p>Dear ${customerName},</p>
        <p>We have an important update regarding your vehicle <strong>${vehiclePlate}</strong>:</p>
        <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;">${message}</p>
        </div>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>Autolease Lam</p>
      </div>
    `,
    text: `Dear ${customerName},

We have an important update regarding your vehicle ${vehiclePlate}:

${message}

If you have any questions, please don't hesitate to contact us.

Best regards,
Autolease Lam`
  })
};