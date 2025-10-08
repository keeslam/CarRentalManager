# Car Rental Management System

## Overview

This is a comprehensive car rental management system built with React (frontend) and Express.js (backend). The system provides a complete solution for managing car rental operations including vehicles, customers, reservations, expenses, and documents. It features a dashboard for monitoring key metrics, calendar views for reservations, and comprehensive reporting capabilities.

## Recent Changes (October 2025)

- **Multi-Language Email System**: Complete email template system supporting Dutch and English based on customer's preferred language, with Dutch fallback
- **Fuel Management**: Pickup/return fuel levels, fuel cost tracking, and fuel card number fields in reservations
- **Corporate Customer Features**: Business/individual customer types, billing contacts, account managers, corporate discounts, and separate billing addresses
- **Language Switcher**: i18next integration with Dutch/English support throughout the UI
- **Email Templates**: Welcome emails, password reset, APK reminders, maintenance reminders, and custom notifications all support multi-language

## User Preferences

Preferred communication style: Simple, everyday language.

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