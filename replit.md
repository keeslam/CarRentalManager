# Car Rental Management System

## Overview
This is a comprehensive car rental management system offering full management of vehicles, customers, reservations, expenses, and documents. It features a dashboard for key metrics, calendar views for reservations, and extensive reporting. The system includes recent enhancements such as a damage check template editor, a simplified one-button backup system, auto-logout security, advanced reporting with a custom report builder, maintenance cost analysis, and a complete multi-driver management system. Key project ambitions include providing a robust and user-friendly platform for efficient car rental operations.

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
- **Upload Handling**: Local file system storage in `uploads` directory
- **Document Types**: Contracts, maintenance records, photos, receipts
- **File Validation**: Size limits and type restrictions
- **Path Management**: Relative path storage
- **Vehicle Diagram Storage**: Simple filesystem storage in `uploads/vehicle-diagrams/` directory - uses the same proven approach as contracts, driver licenses, and all other document uploads. Ensures diagrams persist across all deployment scenarios (Replit, own server, Docker, etc.). Enhanced matching algorithm with 5 progressive fallback strategies (exact match → partial match → brand-only → generic fallback).

### Data Validation
- **Schema Validation**: Zod schemas (shared between frontend/backend)
- **Form Validation**: Client-side with server-side verification
- **Type Safety**: Full TypeScript coverage

### Key Features and Implementations
- **Damage Check Template Editor**: Customizable vehicle inspection templates matching Dutch rental industry format. Build year range filtering, Dutch categories (Interieur/Exterieur/Afweez Check), damage type options (Kapot/Gat/Kras/Deuk/Ster), vehicle diagram support, multi-column layout support (1-4 columns) for all sections (contract info, vehicle data, remarks, signatures, checklist), and JSON storage for inspection points with fieldKey-based data binding for automatic population.
- **Damage Check PDF Generation**: Automated PDF generation service that creates professional Dutch-format damage check forms from templates. Features template-driven layout with dynamic damage types and categories, vehicle-specific diagram embedding, multi-page support with proper pagination, customer and reservation data integration, multi-column rendering support for all sections, and intelligent template matching (exact vehicle match → make+model → make+type → type only → default). PDFs include all required sections: contract/customer details, vehicle information, damage check matrix with checkboxes, vehicle diagrams, and signature fields. Accessible via "Download Damage Check" button in vehicle details page and "Generate & Save Damage Check" button in reservation form.
- **Reservation Damage Check Integration**: Direct damage check generation from reservation workflow using selected vehicle, customer, and driver data. Generates versioned unsigned damage checks (version 1, 2, 3, etc.) automatically saved to documents and linked to both reservation and vehicle. Files stored in uploads/{license_plate}/damage-checks/ directory structure.
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