# PACS Platform Backend API

Backend API service for the PACS-EMR Platform, built with NestJS and TypeScript.

## Features

- **User Management**: CRUD operations for platform users with role-based access
- **Healthcare Provider Management**: Manage healthcare facilities and their settings
- **Study Management**: Track DICOM studies, assignments, and SLA monitoring
- **Report Management**: Create, edit, finalize, and add addenda to radiology reports
- **Keycloak Integration**: JWT-based authentication with role validation
- **Swagger Documentation**: Interactive API documentation

## Tech Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript
- **ORM**: Prisma 5.x
- **Database**: PostgreSQL 16
- **Authentication**: Keycloak JWT with Passport.js
- **Documentation**: Swagger/OpenAPI

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or Docker)
- Keycloak (for authentication)

## Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Copy environment file
cp .env.example .env
# Edit .env with your configuration
```

## Configuration

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres_password@localhost:5432/pacs_platform?schema=public"

# Keycloak
KEYCLOAK_REALM=pacs
KEYCLOAK_AUTH_SERVER_URL=http://localhost:8080
KEYCLOAK_CLIENT_ID=pacs-viewer
KEYCLOAK_JWKS_URI=http://localhost:8080/realms/pacs/protocol/openid-connect/certs

# Orthanc
ORTHANC_URL=http://localhost:8042

# Server
PORT=3001
NODE_ENV=development
```

## Running the Application

```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod

# With Docker
docker build -t pacs-backend .
docker run -p 3001:3001 pacs-backend
```

## API Endpoints

### Health Check
- `GET /api/health` - API health status
- `GET /api/health/ready` - Readiness check with database connection

### Users
- `GET /api/users` - List all users (admin/support only)
- `GET /api/users/me` - Get current user profile
- `GET /api/users/radiologists` - List active radiologists
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user (admin only)
- `PATCH /api/users/:id` - Update user
- `PATCH /api/users/:id/status` - Update user status (admin only)
- `POST /api/users/radiologist-profile` - Create radiologist profile

### Providers
- `GET /api/providers` - List healthcare providers
- `GET /api/providers/:id` - Get provider details
- `GET /api/providers/:id/studies` - Get provider's studies
- `POST /api/providers` - Create provider (admin only)
- `PATCH /api/providers/:id` - Update provider

### Studies
- `GET /api/studies` - List studies with filtering
- `GET /api/studies/worklist` - Get radiologist's worklist
- `GET /api/studies/:id` - Get study details
- `POST /api/studies` - Create study (webhook handler)
- `POST /api/studies/:id/assign` - Assign study to radiologist
- `POST /api/studies/:id/release` - Release study assignment
- `POST /api/studies/:id/flag-stat` - Flag study as STAT priority

### Reports
- `GET /api/reports` - List reports
- `GET /api/reports/my-reports` - Get radiologist's reports
- `GET /api/reports/:id` - Get report details
- `POST /api/reports` - Create new report
- `PATCH /api/reports/:id` - Update draft report
- `POST /api/reports/:id/finalize` - Finalize report (auto-creates a billing record)
- `POST /api/reports/:id/addendum` - Create report addendum

### Report Templates
- `GET /api/report-templates` - List templates (filterable by provider, modality, body part)
- `GET /api/report-templates/:id` - Get template details
- `POST /api/report-templates` - Create template (admin or provider_manager only)
- `PATCH /api/report-templates/:id` - Update template (admin or provider_manager only)
- `DELETE /api/report-templates/:id` - Delete template (admin only)

### SLA Configuration
- `GET /api/sla-config` - List SLA configurations (filterable by provider, modality, priority)
- `GET /api/sla-config/:id` - Get SLA configuration by ID
- `POST /api/sla-config` - Create SLA configuration (admin only)
- `PATCH /api/sla-config/:id` - Update SLA configuration (admin only)
- `DELETE /api/sla-config/:id` - Delete SLA configuration (admin only)

### Billing
- `GET /api/billing/records` - List billing records (admin or billing_officer only)
- `GET /api/billing/records/:id` - Get billing record details
- `GET /api/billing/invoices` - List invoices (admin or billing_officer only)
- `GET /api/billing/invoices/:id` - Get invoice with line items
- `POST /api/billing/invoices/generate` - Generate invoice for a provider/period
- `PATCH /api/billing/invoices/:id/status` - Update invoice status (send, pay, etc.)

### Disputes
- `GET /api/disputes` - List disputes (admin, support, auditor, provider_manager)
- `GET /api/disputes/:id` - Get dispute details
- `POST /api/disputes` - File a dispute on a finalized report
- `PATCH /api/disputes/:id/assign-reviewer` - Assign reviewer (admin or support)
- `PATCH /api/disputes/:id/resolve` - Resolve dispute (admin, support, or auditor)

### Ratings
- `GET /api/ratings` - List ratings (filterable by radiologist, study, stars)
- `GET /api/ratings/radiologist/:radiologistId/stats` - Get rating stats for a radiologist
- `GET /api/ratings/:id` - Get rating details
- `POST /api/ratings` - Submit a rating for a finalized study report

### Audit
- `GET /api/audit/logs` - View audit logs (admin or auditor only)

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3001/api/docs
- **OpenAPI JSON**: http://localhost:3001/api/docs-json

## Database Schema

The backend uses Prisma ORM with the following main entities:

- `User` - Platform users with roles
- `RadiologistProfile` - Radiologist-specific information
- `HealthcareProvider` - Healthcare facilities
- `Study` - DICOM studies
- `StudyAssignment` - Study-to-radiologist assignments
- `SlaConfiguration` - Per-provider SLA thresholds
- `SlaTracking` - Per-study SLA monitoring
- `ReportTemplate` - Reusable report templates
- `Report` - Radiology reports
- `Dispute` - Report disputes
- `Rating` - Radiologist ratings
- `BillingRecord` - Per-study billing (auto-created on report finalization)
- `Invoice` - Provider invoices with line items
- `InvoiceItem` - Invoice line items
- `AuditLog` - Activity logging
- `Notification` - User notifications

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Project Structure

```
backend/
├── src/
│   ├── auth/           # JWT authentication
│   ├── audit/          # Audit log recording and viewer
│   ├── billing/        # Billing records and invoice management
│   ├── common/         # Shared utilities, guards, filters
│   ├── disputes/       # Report dispute workflow
│   ├── health/         # Health check endpoints
│   ├── jobs/           # Background jobs (SLA monitor, auto-assignment)
│   ├── notifications/  # Real-time + email notification dispatch
│   ├── orthanc/        # Orthanc REST client
│   ├── prisma/         # Prisma service
│   ├── providers/      # Healthcare provider module
│   ├── ratings/        # Radiologist rating management
│   ├── report-templates/ # Report template CRUD
│   ├── reports/        # Report management module
│   ├── sla-config/     # SLA configuration CRUD
│   ├── studies/        # Study management module
│   ├── users/          # User management module
│   ├── app.module.ts   # Root module
│   └── main.ts         # Application entry point
├── prisma/
│   └── schema.prisma   # Database schema
├── test/               # E2E tests
├── Dockerfile          # Docker configuration
└── package.json
```

## License

MIT
