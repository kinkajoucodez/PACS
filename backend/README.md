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
- `POST /api/reports/:id/finalize` - Finalize report
- `POST /api/reports/:id/addendum` - Create report addendum

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
- `Report` - Radiology reports
- `SlaTracking` - SLA monitoring
- `BillingRecord` - Per-study billing
- `Invoice` - Provider invoices
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
│   ├── common/         # Shared utilities, guards, filters
│   ├── health/         # Health check endpoints
│   ├── prisma/         # Prisma service
│   ├── providers/      # Healthcare provider module
│   ├── reports/        # Report management module
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
