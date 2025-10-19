# Car Rental Management System

## Overview

This is a comprehensive car rental management system built with React (frontend) and Express.js (backend). The system provides a complete solution for managing car rental operations including vehicles, customers, reservations, expenses, and documents. It features a dashboard for monitoring key metrics, calendar views for reservations, and comprehensive reporting capabilities.

## Recent Changes (October 2025)

- **Simplified One-Button Backup System** (Oct 19, 2025): Easy backup and recovery with just two buttons
  - **Download App Data**: One-click download of complete database export (SQL format)
    - Includes all vehicles, customers, reservations, expenses, documents, users, settings, templates
    - Downloadable as `car-rental-data-YYYY-MM-DD.sql`
    - API endpoint: `/api/backups/download-data`
  - **Download App Code**: One-click download of complete source code archive
    - Includes all application source code, configuration files, package.json
    - Excludes node_modules, uploads, temp files, and build artifacts
    - Downloadable as `car-rental-code-YYYY-MM-DD.tar.gz`
    - API endpoint: `/api/backups/download-code`
  - **Recovery Instructions**: Built-in guidance panel explaining how to restore from backups
  - Simplified from complex backup management system to just two essential buttons
  - Admin-only access via `/admin/backup` route

- **Auto-Logout Security Feature** (Oct 19, 2025): Automatic session timeout for security
  - **Inactivity Detection**: Monitors mouse movement, keyboard input, clicks, scrolling, and touch events
  - **2-Minute Timeout**: Automatically logs users out after 2 minutes of no activity
  - **Activity Reset**: Any user interaction resets the timeout timer
  - **Session Notification**: Shows "Session expired" toast when auto-logout occurs
  - Reusable hook implementation in `client/src/hooks/use-inactivity-timeout.tsx`
  - Integrated into main App component for system-wide protection

- **Advanced Reporting & Communication Features Added** (Oct 19, 2025): Three major features for custom reporting and WhatsApp integration
  - **Custom Report Builder** (Full Implementation):
    - Complete drag-drop interface for building custom reports from any data source
    - Available data sources: Vehicles, Customers, Reservations, Expenses, Drivers, Documents
    - Field selection with column configuration (select specific fields or all fields)
    - Filter builder with comparison operators (equals, greater than, less than, contains, starts with, ends with, etc.)
    - Aggregation functions: COUNT, SUM, AVG, MIN, MAX with grouping support
    - Report execution engine that dynamically builds SQL queries from configuration
    - Save reports with name and description to saved_reports table
    - Preview results in table format with export capability
    - Load and execute saved reports
    - Route: `/reports/builder`
    - API endpoints: `/api/reports/saved`, `/api/reports/execute`
  - **WhatsApp Messaging Dashboard** (Foundation Complete):
    - Conversation list showing all customer WhatsApp conversations
    - Real-time message thread with sent/received messages
    - Message status indicators (sent, delivered, read, failed)
    - Send messages to customers directly from dashboard
    - Customer details panel with contact information
    - Database infrastructure for storing messages and conversations
    - Route: `/whatsapp/messaging`
    - API endpoints: `/api/whatsapp/conversations`, `/api/whatsapp/messages/:customerId`, `/api/whatsapp/send`
    - Note: Twilio integration, webhook receiver, and real-time Socket.IO updates pending for full two-way messaging
  - **WhatsApp Settings & Templates** (Existing):
    - WhatsApp settings page for Twilio API configuration
    - Message templates with variable replacement system
    - Routes: `/settings/whatsapp`, `/settings/whatsapp/templates`
  - **Database Tables**: saved_reports (full implementation), whatsapp_messages (foundation)

- **Four Major New Features Added** (Oct 19, 2025): Significant expansion of system capabilities across delivery, analytics, reporting, and communication
  - **Vehicle Delivery/Pickup Service**:
    - Delivery service option in reservation form with address input (street, city, postal code)
    - Delivery fee calculation and special instructions notes
    - Delivery tracking dashboard showing pending, scheduled, en-route, and completed deliveries
    - Status management with real-time updates
    - Database schema: delivery fields in reservations table + delivery_tasks table for advanced tracking
    - Route: `/delivery` for delivery dashboard
  - **Maintenance Cost Analysis**:
    - Comprehensive cost breakdown dashboard with time range and brand filters
    - Key metrics: total costs, average cost per vehicle, cost per kilometer
    - Category breakdown charts (maintenance, repairs, tires, fuel, insurance, etc.)
    - Brand comparison showing total/average costs across vehicle makes
    - Vehicle-level details with cost per km calculations
    - Monthly trend analysis showing 12-month cost patterns
    - API endpoint: `/api/reports/maintenance-costs`
    - Route: `/reports/maintenance-costs`

- **Customer Portal & Extension Requests Removed** (Oct 18, 2025): Completely removed customer portal and extension request functionality
  - Removed customer portal login/dashboard pages and all related UI components
  - Removed customer authentication system and API endpoints
  - Removed customer_users and extension_requests database tables
  - Removed customer portal email templates
  - Removed extension requests page and all extension request management endpoints

- **Maintenance History Tracking**: Complete maintenance tracking system for vehicles
  - **Maintenance History Section**: Added to vehicle details Maintenance tab
    - Displays all completed maintenance work in chronological order
    - Shows maintenance type, date, status (Scheduled/In Progress/Completed), and details
    - Empty state guidance when no maintenance history exists
  - **Maintenance Details Recording**: Enhanced complete maintenance dialog
    - Textarea field to record what maintenance work was performed
    - Details are preserved in maintenance record for future reference
    - Toast notification shows maintenance details upon completion
  - **Preservation of History**: Changed from deletion to update approach
    - Maintenance reservations are now marked as complete (maintenanceStatus='out') instead of deleted
    - Creates permanent maintenance history for each vehicle
    - Maintenance details stored in notes field with format: `{MaintenanceType}:\n{Details}`
  - **Real-time Updates**: Proper cache invalidation ensures maintenance history refreshes immediately after completion
- **Multi-Driver Management System**: Complete driver management for corporate customers
  - **Drivers Table**: Separate drivers table with full contact and license information
  - **Customer Association**: Multiple drivers per customer with primary driver designation
  - **Reservation Assignment**: Optional driver selection when creating reservations
  - **Auto-Reset**: Driver selection automatically resets when customer changes to prevent invalid assignments
  - **Migration Complete**: Existing customer driver license data migrated to drivers table (2 records transferred)
  - **CRUD Operations**: Full create, read, update, delete functionality with audit tracking
  - **UI Integration**: Drivers tab on customer details page with add/edit/delete, plus quick-add driver in reservation form
  - **License Upload**: Secure driver's license file upload (images/PDF up to 10MB)
    - Files stored in uploads/drivers/ directory with customer ID in filename
    - Secure serving via authenticated endpoint
    - Current file display when editing existing drivers
  - **Searchable Driver Selection**: Searchable dropdown for finding drivers in reservations
    - Real-time search filtering by name, phone, or email
    - Handles 100+ drivers efficiently with instant search
    - Shows primary driver badge and contact info
    - "No driver selected" option with clear visual indicator
- **Backup System Enhancement**: Complete backup/restore system for all user data
  - **What's Backed Up**:
    - **Database**: All tables including pdf_templates, email_templates, custom_notifications, users, vehicles, customers, reservations, expenses, documents, etc.
    - **Files**: uploads/ directory containing all user files (documents, contracts, PDF template backgrounds in uploads/templates/, invoices, etc.)
    - **NOT backed up**: Source code (it's in version control) - only user-created data is backed up
  - **Storage Options**: 
    - Object storage (cloud) with automatic fallback to local filesystem
    - Local filesystem: `./backups/[database|files]/YYYY/MM/DD/`
  - **Complete Restore**: One-click restoration of both database and files
    - ⚠️ Important: Database restore resets your session - you must refresh browser and log in again after restore
  - **Cross-filesystem support**: Upload uses copy+delete instead of rename to support different volume mounts
  - **Easy Upload**: Upload external backups through UI - system auto-detects type and stores correctly
- **Document Management**: Reservation-specific document uploads with auto-generated filenames (vehicle plate + document type + date)
  - Quick upload buttons for Contract, Damage Report Photo, and Other documents
  - Documents linked to both vehicle AND reservation for organized tracking
- **English-Only Interface**: Simplified UI by removing multi-language switcher - all internal staff features in English only
  - Email system still supports Dutch/English for customer communications
- **Fuel Management**: Pickup/return fuel levels, fuel cost tracking, and fuel card number fields in reservations
- **Corporate Customer Features**: Business/individual customer types, billing contacts, account managers, corporate discounts, and separate billing addresses
- **Email Templates**: Welcome emails, password reset, APK reminders, maintenance reminders, and custom notifications support multi-language

## User Preferences

Preferred communication style: Simple, everyday language.

## System Language

The internal staff interface is **English-only** for simplicity. All UI text, including the login page, is in plain English without translation keys. Customer-facing email communications still support Dutch and English based on customer language preference via the email template system.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Authentication**: Passport.js with local strategy and session-based auth
- **Database ORM**: Drizzle ORM for type-safe database operations
- **File Handling**: Multer for document uploads with local storage
- **PDF Generation**: pdf-lib for generating rental contracts
- **Session Storage**: PostgreSQL session store with connect-pg-simple
- **API Integration**: RDW (Dutch Vehicle Authority) API for vehicle information

### Database Design
- **Primary Database**: PostgreSQL with connection pooling via Neon serverless
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Core Tables**: users, vehicles, customers, reservations, expenses, documents, pdf_templates, custom_notifications
- **Relationships**: Foreign keys linking reservations to vehicles/customers, expenses to vehicles, documents to vehicles

### Authentication & Authorization
- **Authentication**: Username/password with bcrypt hashing
- **Session Management**: Express sessions with PostgreSQL store
- **Role-Based Access**: Admin, Manager, and User roles with granular permissions
- **Protection**: Route-level authentication middleware with automatic redirects

### File Management
- **Upload Handling**: Local file system storage in uploads directory
- **Document Types**: Support for contracts, maintenance records, photos, receipts, etc.
- **File Validation**: Size limits (5MB for documents, 25MB for expenses) and type restrictions
- **Path Management**: Relative path storage for portability

### Data Validation
- **Schema Validation**: Zod schemas shared between frontend and backend
- **Form Validation**: Client-side validation with server-side verification
- **Type Safety**: Full TypeScript coverage with shared types

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL database with connection pooling
- **WebSocket Support**: For real-time database connections

### UI Component Libraries
- **Radix UI**: Headless component primitives for accessibility
- **Lucide React**: Icon library for consistent iconography
- **Recharts**: Chart library for reporting and analytics
- **Date-fns**: Date manipulation and formatting utilities

### Development Tools
- **Drizzle Kit**: Database schema management and migrations
- **ESBuild**: Fast bundling for production builds
- **TSX**: TypeScript execution for development server

### Third-Party APIs
- **RDW API**: Dutch vehicle registration authority for vehicle data lookup
- **PDF Generation**: Built-in PDF creation for rental contracts

### Deployment Infrastructure
- **PM2**: Process management for production deployment
- **Nginx**: Reverse proxy and static file serving
- **Node.js 18+**: Runtime environment with ES modules support