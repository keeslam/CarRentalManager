import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

if (!process.env.MAILERSEND_API_KEY) {
  throw new Error("MAILERSEND_API_KEY environment variable must be set");
}

const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY,
});

export interface EmailOptions {
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  variables?: Record<string, any>;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const sentFrom = new Sender(options.from, options.fromName || "Autolease Lam");
    const recipients = [new Recipient(options.to, options.toName || "Customer")];

    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject(options.subject);

    if (options.html) {
      emailParams.setHtml(options.html);
    }

    if (options.text) {
      emailParams.setText(options.text);
    }

    if (options.templateId) {
      emailParams.setTemplateId(options.templateId);
      if (options.variables) {
        // Note: Template variables are handled differently in MailerSend
        // This would need to be set up in the MailerSend dashboard first
        console.log('Template variables:', options.variables);
      }
    }

    const response = await mailerSend.email.send(emailParams);
    console.log('Email sent successfully:', response);
    return true;
  } catch (error) {
    console.error('MailerSend email error:', error);
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