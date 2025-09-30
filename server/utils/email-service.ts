import { storage } from "../storage";
import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html?: string;
  text?: string;
}

interface EmailConfig {
  provider: string;
  fromEmail: string;
  fromName: string;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
}

let cachedConfig: EmailConfig | null = null;
let configLastFetched: number = 0;
const CONFIG_CACHE_TTL = 60000; // Cache for 1 minute

async function getEmailConfig(): Promise<EmailConfig | null> {
  const now = Date.now();
  
  // Return cached config if still valid
  if (cachedConfig && (now - configLastFetched < CONFIG_CACHE_TTL)) {
    return cachedConfig;
  }

  try {
    const emailSettings = await storage.getAppSettingsByCategory('email');
    
    if (emailSettings.length === 0) {
      console.warn('⚠️ No email settings configured in database');
      return null;
    }

    // Get the first (or only) email configuration
    const setting = emailSettings[0];
    const value = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;

    const config: EmailConfig = {
      provider: value.provider || 'smtp',
      fromEmail: value.fromEmail || '',
      fromName: value.fromName || 'Autolease Lam',
      apiKey: value.apiKey,
      smtpHost: value.smtpHost,
      smtpPort: value.smtpPort ? parseInt(value.smtpPort) : 587,
      smtpUser: value.smtpUser,
      smtpPassword: value.smtpPassword,
      smtpSecure: value.smtpPort === '465'
    };

    // Validate config
    if (!config.fromEmail) {
      console.error('❌ Email configuration missing fromEmail');
      return null;
    }

    if (config.provider === 'smtp') {
      if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
        console.error('❌ SMTP configuration incomplete');
        return null;
      }
    } else if (config.provider === 'mailersend' || config.provider === 'sendgrid') {
      if (!config.apiKey) {
        console.error(`❌ ${config.provider} configuration missing API key`);
        return null;
      }
    }

    cachedConfig = config;
    configLastFetched = now;
    console.log(`✅ Email config loaded: ${config.provider} (from: ${config.fromEmail})`);
    
    return config;
  } catch (error) {
    console.error('Error loading email configuration:', error);
    return null;
  }
}

async function sendViaSmtp(config: EmailConfig, options: EmailOptions): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });

    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ SMTP email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ SMTP email error:', error);
    return false;
  }
}

async function sendViaMailerSend(config: EmailConfig, options: EmailOptions): Promise<boolean> {
  try {
    const { MailerSend, EmailParams, Sender, Recipient } = await import("mailersend");
    
    const mailerSend = new MailerSend({ apiKey: config.apiKey! });
    const sentFrom = new Sender(config.fromEmail, config.fromName);
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

    await mailerSend.email.send(emailParams);
    console.log('✅ MailerSend email sent successfully');
    return true;
  } catch (error) {
    console.error('❌ MailerSend email error:', error);
    return false;
  }
}

async function sendViaSendGrid(config: EmailConfig, options: EmailOptions): Promise<boolean> {
  try {
    const sgMail = await import('@sendgrid/mail');
    const mailService = sgMail.default;
    
    mailService.setApiKey(config.apiKey!);

    const emailData: any = {
      to: options.to,
      from: {
        email: config.fromEmail,
        name: config.fromName
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
    console.log('✅ SendGrid email sent successfully');
    return true;
  } catch (error) {
    console.error('❌ SendGrid email error:', error);
    return false;
  }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const config = await getEmailConfig();
  
  if (!config) {
    console.error('❌ Cannot send email: No valid email configuration found');
    return false;
  }

  switch (config.provider) {
    case 'smtp':
      return sendViaSmtp(config, options);
    case 'mailersend':
      return sendViaMailerSend(config, options);
    case 'sendgrid':
      return sendViaSendGrid(config, options);
    default:
      console.error(`❌ Unknown email provider: ${config.provider}`);
      return false;
  }
}

// Clear the cache - useful when settings are updated
export function clearEmailConfigCache(): void {
  cachedConfig = null;
  configLastFetched = 0;
  console.log('🔄 Email config cache cleared');
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
        <p>Best regards,<br>Autolease Lam</p>
      </div>
    `,
    text: `Dear ${customerName},

This is a friendly reminder that your vehicle ${vehiclePlate} requires an APK inspection.

APK Expiry Date: ${expiryDate}

Please schedule your APK inspection as soon as possible to ensure your vehicle remains roadworthy and legal.

Best regards,
Autolease Lam`
  }),
  
  maintenanceReminder: (customerName: string, vehiclePlate: string, maintenanceType: string) => ({
    subject: `Maintenance Reminder - ${vehiclePlate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Vehicle Maintenance Reminder</h2>
        <p>Dear ${customerName},</p>
        <p>Your vehicle <strong>${vehiclePlate}</strong> is due for maintenance.</p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Maintenance Type:</strong> ${maintenanceType}</p>
        </div>
        <p>Please contact us to schedule your maintenance appointment.</p>
        <p>Best regards,<br>Autolease Lam</p>
      </div>
    `,
    text: `Dear ${customerName},

Your vehicle ${vehiclePlate} is due for maintenance.

Maintenance Type: ${maintenanceType}

Please contact us to schedule your maintenance appointment.

Best regards,
Autolease Lam`
  }),
  
  customMessage: (customerName: string, vehiclePlate: string, message: string) => ({
    subject: `Important Update - ${vehiclePlate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Important Update</h2>
        <p>Dear ${customerName},</p>
        <p>We have an update regarding your vehicle <strong>${vehiclePlate}</strong>:</p>
        <div style="background-color: #e0f2fe; border-left: 4px solid #0284c7; padding: 16px; margin: 16px 0;">
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
