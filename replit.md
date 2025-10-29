# Car Rental Management System

## Overview
This is a comprehensive car rental management system offering full management of vehicles, customers, reservations, expenses, and documents. It features a dashboard for key metrics, calendar views for reservations, and extensive reporting. The system includes recent enhancements such as a damage check template editor, a simplified one-button backup system, auto-logout security, advanced reporting with a custom report builder, maintenance cost analysis, and a complete multi-driver management system. Key project ambitions include providing a robust and user-friendly platform for efficient car rental operations.

## Recent Changes (October 29, 2025)
### Document Email Functionality with Multilingual Templates
- **Email Templates Management**: Settings page now includes dedicated section for configuring email templates for contracts, damage checks, and combined documents in English and Dutch
- **Template Customization**: Full-featured rich text editor for subject lines and message bodies with placeholder support
- **Smart Template Selection**: Automatically selects the appropriate template based on selected documents:
  - Contract template when sending only contracts
  - Damage check template when sending only damage checks
  - Combined template when sending both contracts AND damage checks together
- **Available Placeholders**: {customerName}, {vehiclePlate}, {startDate}, {endDate} - automatically filled from reservation and customer data
- **Multi-Document Email**: Send multiple documents (contracts, damage checks) in a single email with multiple file attachments
- **Language Selection**: Choose between English or Dutch templates for each email sent
- **Customer Email Management**: Smart email selection from customer records (emailGeneral with fallback to emailForInvoices), plus option for custom email addresses
- **Reservation Calendar Integration**: "Email Documents to Customer" button in reservation calendar for quick access to email functionality
- **Email Preview**: Real-time preview of subject and message with placeholders replaced before sending
- **Backend Enhancement**: New `/api/email/send-documents` endpoint using configured email service (SMTP/MailerSend/SendGrid) from database settings
- **Settings Storage**: Templates stored in appSettings table with document_email_templates key containing contract, damage_check, and combined templates for both EN and NL
- **Email Service Integration**: Uses existing email configuration from Settings → Email Configuration with purpose set to 'documents', supporting multiple providers with configured sender address and credentials

**Email Provider Note**: Email sending uses your configured email settings from the Settings page. Ensure email configuration with purpose "Documents Email" is set up before sending documents.

## Recent Changes (October 26, 2025)
### Comprehensive Permission System Implementation
- **New Roles Added**: CLEANER, VIEWER, ACCOUNTANT, MAINTENANCE (in addition to ADMIN, MANAGER, USER)
- **New Granular Permissions**: 
  - Vehicle management: VIEW_VEHICLES, MANAGE_VEHICLES
  - Customer management: VIEW_CUSTOMERS, MANAGE_CUSTOMERS  
  - Reservation management: VIEW_RESERVATIONS, MANAGE_RESERVATIONS
  - Document/Template management: MANAGE_DOCUMENTS, MANAGE_PDF_TEMPLATES
  - Damage checks: VIEW_DAMAGE_CHECKS, MANAGE_DAMAGE_CHECKS
  - Reports: VIEW_REPORTS, MANAGE_REPORTS
  - System admin: MANAGE_BACKUPS, MANAGE_SETTINGS, MANAGE_EMAIL_TEMPLATES, MANAGE_NOTIFICATIONS
- **Permission Enforcement**: All backend routes now enforce granular permissions using shared middleware
- **User Form**: Updated to show all new roles and permissions as individual toggles

**IMPORTANT**: After this update, administrators should review and re-assign permissions to existing users through the user management interface to ensure they have the appropriate access rights.

### Enterprise-Grade Security Features
- **Rate Limiting**: Login endpoint protected with 5 attempts per 15 minutes per IP address to prevent brute force attacks
- **CSRF Protection**: All state-changing requests (POST/PATCH/DELETE) require valid CSRF tokens. Tokens issued via cookie and validated via X-CSRF-Token header. Logout route protected at route level with csrfProtection middleware
- **Audit Logging**: Comprehensive activity tracking for critical actions (login/logout, user management, permission changes, data modifications) with timestamp, user ID, username, action type, IP address, user agent, and status
- **Password History**: Prevents password reuse by storing bcrypt hashes of last 5 passwords per user
- **Account Lockout**: Automatic account lockout after 5 failed login attempts, preventing brute force attacks
- **Login Attempt Tracking**: Records all login attempts (successful and failed) with username, IP address, timestamp, and success status
- **Session Management**: Active session tracking with device information, location, last activity timestamp, and ability to revoke sessions remotely
- **Session Cleanup**: Automated hourly cleanup of expired sessions from database
- **Security Headers**: Helmet.js integration for XSS protection, clickjacking prevention (X-Frame-Options), content security policy (CSP), HSTS, and other security headers
- **Input Sanitization**: All user inputs sanitized to prevent XSS attacks using DOMPurify with HTML stripping

**Database Tables for Security:**
- `auditLogs`: Tracks all critical system actions
- `passwordHistory`: Stores hashed password history per user
- `loginAttempts`: Records login attempts for security monitoring
- `activeSessions`: Manages active user sessions across devices

**Security Middleware Order:**
1. Security headers (Helmet.js)
2. Rate limiting
3. JSON/URL-encoded body parsing
4. Input sanitization
5. Session middleware
6. CSRF token issuance
7. Authentication routes (login/logout/register)
8. Route-level CSRF protection (on logout)
9. Application routes with permission enforcement

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **UI Components**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Authentication**: Passport.js (local strategy, session-based)
- **Database ORM**: Drizzle ORM
- **File Handling**: Multer (local storage)
- **PDF Generation**: pdf-lib
- **Session Storage**: PostgreSQL session store with connect-pg-simple

### Database Design
- **Primary Database**: PostgreSQL (Neon serverless)
- **Schema Management**: Drizzle Kit
- **Core Tables**: users, vehicles, customers, reservations, expenses, documents, pdf_templates, custom_notifications, damage_check_templates, saved_reports, whatsapp_messages, drivers
- **Relationships**: Foreign keys link reservations to vehicles/customers, expenses to vehicles, documents to vehicles. Multiple drivers per customer.

### Authentication & Authorization
- **Authentication**: Username/password with bcrypt hashing
- **Session Management**: Express sessions with PostgreSQL store
- **Role-Based Access**: Admin, Manager, and User roles with granular permissions
- **Protection**: Route-level authentication middleware

### File Management
- **Upload Handling**: Local file system storage in `uploads` directory for documents, driver licenses, and vehicle diagrams
- **Document Types**: Contracts, maintenance records, photos, receipts
- **File Validation**: Size limits and type restrictions
- **Path Management**: Relative path storage
- **Vehicle Diagram Storage**: Simple filesystem storage in `uploads/vehicle-diagrams/` directory - uses the same proven approach as contracts, driver licenses, and all other document uploads. Ensures diagrams persist across all deployment scenarios (Replit, own server, Docker, etc.). Enhanced matching algorithm with 5 progressive fallback strategies (exact match → partial match → brand-only → generic fallback).
- **Template Background Storage**: Environment-aware storage system. On Replit, uses Object Storage (persistent cloud storage) to survive app restarts - backgrounds stored at `/bucket/public/templates/` and served via `/object-storage/*` route. On Coolify/Docker, uses local filesystem with volume mounts (same as other uploads) for persistence. **Cache Management**: GET /api/pdf-templates endpoint includes Cache-Control headers (`no-store, no-cache`) to prevent 304 responses and ensure fresh data after uploads. Frontend uses forced refetch (`refetchQueries`) after background mutations to bypass React Query cache staleness.

### Data Validation
- **Schema Validation**: Zod schemas (shared between frontend/backend)
- **Form Validation**: Client-side with server-side verification
- **Type Safety**: Full TypeScript coverage

### Key Features and Implementations
- **Damage Check Template Editor**: Customizable vehicle inspection templates matching Dutch rental industry format. Build year range filtering, Dutch categories (Interieur/Exterieur/Afweez Check), damage type options (Kapot/Gat/Kras/Deuk/Ster), vehicle diagram support, multi-column layout support (1-4 columns) for all sections (contract info, vehicle data, remarks, signatures, checklist), and JSON storage for inspection points with fieldKey-based data binding for automatic population.
- **Damage Check PDF Generation**: Automated PDF generation service that creates professional Dutch-format damage check forms from templates. Features template-driven layout with dynamic damage types and categories, vehicle-specific diagram embedding, multi-page support with proper pagination, customer and reservation data integration, multi-column rendering support for all sections, and intelligent template matching (exact vehicle match → make+model → make+type → type only → default). PDFs include all required sections: contract/customer details, vehicle information, damage check matrix with checkboxes, vehicle diagrams, and signature fields. Accessible via "Download Damage Check" button in vehicle details page and "Generate & Save Damage Check" button in reservation form.
- **Reservation Damage Check Integration**: Direct damage check generation from reservation workflow using selected vehicle, customer, and driver data. Generates versioned unsigned damage checks (version 1, 2, 3, etc.) automatically saved to documents and linked to both reservation and vehicle. Files stored in uploads/{license_plate}/damage-checks/ directory structure.
- **PDF Template Editor with Driver Data Support**: Template editor now includes driver information fields from reservations. Available driver fields: Driver Name (full), Driver First Name, Driver Last Name, Driver Email, Driver Phone, Driver License Number, Driver License Expiry. When generating PDFs from reservations with assigned drivers, these fields automatically populate with the driver's data. Supports both direct field mapping (e.g., driverName) and nested property paths (e.g., driver.name).
- **Backup System**: One-click download for database (SQL) and application code (tar.gz), with recovery instructions.
- **Auto-Logout**: Inactivity detection logs users out after 2 minutes.
- **Custom Report Builder**: Drag-and-drop interface for creating custom reports from various data sources with filtering and aggregation.
- **WhatsApp Messaging Dashboard**: Foundation for customer conversations, message threads, and sending capabilities.
- **Vehicle Delivery/Pickup Service**: Delivery options in reservations, fee calculation, and tracking dashboard.
- **Maintenance Cost Analysis**: Dashboard with cost breakdown, category charts, and trend analysis.
- **Maintenance History Tracking**: Comprehensive history section in vehicle details, recording detailed work performed.
- **Multi-Driver Management**: Separate drivers table, association with customers, reservation assignment, license upload, and searchable selection.
- **Document Management**: Reservation-specific document uploads linked to vehicle and reservation.
- **Fuel Management**: Pickup/return fuel levels, cost tracking, and fuel card fields.
- **Corporate Customer Features**: Business/individual types, billing contacts, corporate discounts.
- **Email Templates**: Multi-language support for customer communications (e.g., welcome, reminders).
- **English-Only Interface**: Internal staff interface is English-only.

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL database.

### UI Component Libraries
- **Radix UI**: Headless component primitives.
- **Lucide React**: Icon library.
- **Recharts**: Charting library.
- **Date-fns**: Date manipulation utilities.

### Development Tools
- **Drizzle Kit**: Database schema management.
- **ESBuild**: Bundling for production.
- **TSX**: TypeScript execution for development.

### Third-Party APIs
- **RDW API**: Dutch vehicle registration authority.

### Deployment Infrastructure
- **PM2**: Process management.
- **Nginx**: Reverse proxy and static file serving.
- **Node.js 18+**: Runtime environment.