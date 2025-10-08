// Multi-language email templates
type Language = 'nl' | 'en';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// APK Reminder Template
export function getApkReminderTemplate(
  customerName: string,
  vehiclePlate: string,
  expiryDate: string,
  language: Language = 'nl'
): EmailTemplate {
  if (language === 'en') {
    return {
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
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>Autolease Lam</p>
        </div>
      `,
      text: `Dear ${customerName},

This is a friendly reminder that your vehicle ${vehiclePlate} requires an APK inspection.

APK Expiry Date: ${expiryDate}

Please schedule your APK inspection as soon as possible to ensure your vehicle remains roadworthy and legal.

If you have any questions, please don't hesitate to contact us.

Best regards,
Autolease Lam`
    };
  }

  // Dutch version
  return {
    subject: `APK Herinnering - ${vehiclePlate} verloopt binnenkort`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">APK Keuringsherinnering</h2>
        <p>Beste ${customerName},</p>
        <p>Dit is een vriendelijke herinnering dat uw voertuig <strong>${vehiclePlate}</strong> een APK-keuring nodig heeft.</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>APK Vervaldatum:</strong> ${expiryDate}</p>
        </div>
        <p>Plan uw APK-keuring zo snel mogelijk in om ervoor te zorgen dat uw voertuig veilig en legaal blijft.</p>
        <p>Als u vragen heeft, aarzel dan niet om contact met ons op te nemen.</p>
        <p>Met vriendelijke groet,<br>Autolease Lam</p>
      </div>
    `,
    text: `Beste ${customerName},

Dit is een vriendelijke herinnering dat uw voertuig ${vehiclePlate} een APK-keuring nodig heeft.

APK Vervaldatum: ${expiryDate}

Plan uw APK-keuring zo snel mogelijk in om ervoor te zorgen dat uw voertuig veilig en legaal blijft.

Als u vragen heeft, aarzel dan niet om contact met ons op te nemen.

Met vriendelijke groet,
Autolease Lam`
  };
}

// Maintenance Reminder Template
export function getMaintenanceReminderTemplate(
  customerName: string,
  vehiclePlate: string,
  maintenanceType: string,
  language: Language = 'nl'
): EmailTemplate {
  if (language === 'en') {
    return {
      subject: `Maintenance Reminder - ${vehiclePlate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Maintenance Reminder</h2>
          <p>Dear ${customerName},</p>
          <p>Your vehicle <strong>${vehiclePlate}</strong> requires maintenance.</p>
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Maintenance Type:</strong> ${maintenanceType}</p>
          </div>
          <p>Please contact us to schedule an appointment at your earliest convenience.</p>
          <p>Best regards,<br>Autolease Lam</p>
        </div>
      `,
      text: `Dear ${customerName},

Your vehicle ${vehiclePlate} requires maintenance.

Maintenance Type: ${maintenanceType}

Please contact us to schedule an appointment at your earliest convenience.

Best regards,
Autolease Lam`
    };
  }

  // Dutch version
  return {
    subject: `Onderhoudsherinnering - ${vehiclePlate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Onderhoudsherinnering</h2>
        <p>Beste ${customerName},</p>
        <p>Uw voertuig <strong>${vehiclePlate}</strong> heeft onderhoud nodig.</p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Type Onderhoud:</strong> ${maintenanceType}</p>
        </div>
        <p>Neem contact met ons op om zo spoedig mogelijk een afspraak in te plannen.</p>
        <p>Met vriendelijke groet,<br>Autolease Lam</p>
      </div>
    `,
    text: `Beste ${customerName},

Uw voertuig ${vehiclePlate} heeft onderhoud nodig.

Type Onderhoud: ${maintenanceType}

Neem contact met ons op om zo spoedig mogelijk een afspraak in te plannen.

Met vriendelijke groet,
Autolease Lam`
  };
}

// Welcome Email Template
export function getWelcomeTemplate(
  customerName: string,
  email: string,
  password: string,
  portalUrl: string,
  language: Language = 'nl'
): EmailTemplate {
  if (language === 'en') {
    return {
      subject: "Welcome to Your Customer Portal - Autolease Lam",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to the Customer Portal</h2>
          <p>Dear ${customerName},</p>
          <p>Your customer portal account has been created. You can now view your rentals and request extensions online.</p>
          <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Login Email:</strong> ${email}</p>
            <p style="margin: 8px 0 0 0;"><strong>Access Code:</strong> ${password}</p>
          </div>
          <p><strong>Portal Login:</strong> <a href="${portalUrl}" style="color: #2563eb;">${portalUrl}</a></p>
          <p style="color: #666666; font-size: 14px;">Please update your access code after your first login for security.</p>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>Autolease Lam</p>
        </div>
      `,
      text: `Dear ${customerName},

Your customer portal account has been created. You can now view your rentals and request extensions online.

Login Email: ${email}
Access Code: ${password}

Portal Login: ${portalUrl}

Please update your access code after your first login for security.

If you have any questions, please don't hesitate to contact us.

Best regards,
Autolease Lam`
    };
  }

  // Dutch version
  return {
    subject: "Welkom bij Uw Klantenportaal - Autolease Lam",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welkom bij het Klantenportaal</h2>
        <p>Beste ${customerName},</p>
        <p>Uw klantenportaal account is aangemaakt. U kunt nu online uw verhuurperiodes bekijken en verlengingen aanvragen.</p>
        <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Login E-mail:</strong> ${email}</p>
          <p style="margin: 8px 0 0 0;"><strong>Toegangscode:</strong> ${password}</p>
        </div>
        <p><strong>Portal Inloggen:</strong> <a href="${portalUrl}" style="color: #2563eb;">${portalUrl}</a></p>
        <p style="color: #666666; font-size: 14px;">Wijzig uw toegangscode na uw eerste login voor de beveiliging.</p>
        <p>Als u vragen heeft, aarzel dan niet om contact met ons op te nemen.</p>
        <p>Met vriendelijke groet,<br>Autolease Lam</p>
      </div>
    `,
    text: `Beste ${customerName},

Uw klantenportaal account is aangemaakt. U kunt nu online uw verhuurperiodes bekijken en verlengingen aanvragen.

Login E-mail: ${email}
Toegangscode: ${password}

Portal Inloggen: ${portalUrl}

Wijzig uw toegangscode na uw eerste login voor de beveiliging.

Als u vragen heeft, aarzel dan niet om contact met ons op te nemen.

Met vriendelijke groet,
Autolease Lam`
  };
}

// Password Reset Template
export function getPasswordResetTemplate(
  customerName: string,
  email: string,
  password: string,
  portalUrl: string,
  language: Language = 'nl'
): EmailTemplate {
  if (language === 'en') {
    return {
      subject: "Your Portal Access Code - Autolease Lam",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Portal Access Update</h2>
          <p>Dear ${customerName},</p>
          <p>Your customer portal access code has been updated as requested.</p>
          <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Login Email:</strong> ${email}</p>
            <p style="margin: 8px 0 0 0;"><strong>New Access Code:</strong> ${password}</p>
          </div>
          <p><strong>Portal Login:</strong> <a href="${portalUrl}" style="color: #2563eb;">${portalUrl}</a></p>
          <p style="color: #666666; font-size: 14px;">Please update your access code after logging in for security.</p>
          <p>If you did not request this update, please contact us immediately.</p>
          <p>Best regards,<br>Autolease Lam</p>
        </div>
      `,
      text: `Dear ${customerName},

Your customer portal access code has been updated as requested.

Login Email: ${email}
New Access Code: ${password}

Portal Login: ${portalUrl}

Please update your access code after logging in for security.

If you did not request this update, please contact us immediately.

Best regards,
Autolease Lam`
    };
  }

  // Dutch version
  return {
    subject: "Uw Portaal Toegangscode - Autolease Lam",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Portaal Toegang Bijgewerkt</h2>
        <p>Beste ${customerName},</p>
        <p>Uw klantenportaal toegangscode is bijgewerkt zoals gevraagd.</p>
        <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Login E-mail:</strong> ${email}</p>
          <p style="margin: 8px 0 0 0;"><strong>Nieuwe Toegangscode:</strong> ${password}</p>
        </div>
        <p><strong>Portal Inloggen:</strong> <a href="${portalUrl}" style="color: #2563eb;">${portalUrl}</a></p>
        <p style="color: #666666; font-size: 14px;">Wijzig uw toegangscode na het inloggen voor de beveiliging.</p>
        <p>Als u deze update niet heeft aangevraagd, neem dan onmiddellijk contact met ons op.</p>
        <p>Met vriendelijke groet,<br>Autolease Lam</p>
      </div>
    `,
    text: `Beste ${customerName},

Uw klantenportaal toegangscode is bijgewerkt zoals gevraagd.

Login E-mail: ${email}
Nieuwe Toegangscode: ${password}

Portal Inloggen: ${portalUrl}

Wijzig uw toegangscode na het inloggen voor de beveiliging.

Als u deze update niet heeft aangevraagd, neem dan onmiddellijk contact met ons op.

Met vriendelijke groet,
Autolease Lam`
  };
}

// Custom Message Template
export function getCustomMessageTemplate(
  customerName: string,
  vehiclePlate: string,
  message: string,
  language: Language = 'nl',
  customSubject?: string
): EmailTemplate {
  if (language === 'en') {
    return {
      subject: customSubject || `Important Update - ${vehiclePlate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Important Update</h2>
          <p>Dear ${customerName},</p>
          <p>We have an important update regarding your vehicle ${vehiclePlate}:</p>
          <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0;">
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
    };
  }

  // Dutch version
  return {
    subject: customSubject || `Belangrijke Update - ${vehiclePlate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Belangrijke Update</h2>
        <p>Beste ${customerName},</p>
        <p>We hebben een belangrijke update met betrekking tot uw voertuig ${vehiclePlate}:</p>
        <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;">${message}</p>
        </div>
        <p>Als u vragen heeft, aarzel dan niet om contact met ons op te nemen.</p>
        <p>Met vriendelijke groet,<br>Autolease Lam</p>
      </div>
    `,
    text: `Beste ${customerName},

We hebben een belangrijke update met betrekking tot uw voertuig ${vehiclePlate}:

${message}

Als u vragen heeft, aarzel dan niet om contact met ons op te nemen.

Met vriendelijke groet,
Autolease Lam`
  };
}
