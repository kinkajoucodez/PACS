# PACS-EMR Platform

A comprehensive Picture Archiving and Communication System (PACS) with EMR integration capabilities, built on top of the OHIF Viewer.

## Overview

This platform provides a complete teleradiology solution that enables healthcare providers to send medical imaging studies (X-rays, CT, MRI, etc.) to remote radiologists for interpretation and reporting.

### Key Features

- **DICOM Image Management** – Store, view, and manage medical imaging studies
- **Study Worklist** – Prioritized queue with STAT/urgent/routine classification
- **Report Generation** – Template-based radiology reporting with digital signatures
- **Multi-tenant Architecture** – Support for multiple healthcare providers
- **SLA Tracking** – Turnaround time monitoring with automated alerts
- **Billing & Invoicing** – Per-study billing with monthly invoice generation
- **Quality Assurance** – Dispute resolution and radiologist rating system
- **Audit Logging** – HIPAA-compliant activity tracking
- **Backend API** – NestJS REST API with Swagger documentation

## Architecture

```
                        ┌──────────────────────────────────┐
                        │  Host browser / EMR client        │
                        └──────────────┬───────────────────┘
                                       │ :80
                        ┌──────────────▼───────────────────┐
                        │          Nginx  (reverse proxy)   │
                        │  /          → OHIF Viewer :3000   │
                        │  /orthanc/  → Orthanc     :8042   │
                        │  /auth/     → Keycloak    :8080   │
                        │  /api/      → Backend API :3001   │
                        └─────┬────────┬────────┬──────────┘
                              │        │        │
              ┌───────────────▼─┐   ┌──▼───┐  ┌▼──────────┐
              │   OHIF Viewer   │   │Orthanc│  │ Keycloak  │
              │   :3000         │   │:8042  │  │ :8080     │
              └─────────────────┘   └──┬───┘  └─────┬─────┘
                                       │            │
                              ┌────────▼────────────▼──────┐
                              │         PostgreSQL :5432     │
                              │  orthanc / keycloak /        │
                              │  pacs_platform databases     │
                              └──────────────────────────────┘
```

### Components

| Component | Description |
|-----------|-------------|
| **OHIF Viewer** | React-based DICOM viewer for medical imaging |
| **Orthanc** | DICOM server with DICOMweb API |
| **Keycloak** | Identity and access management |
| **Backend API** | NestJS REST API for platform business logic |
| **PostgreSQL** | Relational database for all platform data |
| **Nginx** | Reverse proxy and SSL termination |

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+

### Running Locally

```bash
# 1. Clone the repository
git clone https://github.com/kinkajoucodez/PACS.git
cd PACS

# 2. Copy the example environment file
cp .env.example .env

# 3. Start all services
docker compose up -d

# 4. Wait for services to become healthy (~60-90 seconds on first run)
docker compose ps

# 5. Open the OHIF Viewer
open http://localhost
```

### Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| OHIF Viewer | http://localhost | Medical imaging viewer |
| Orthanc | http://localhost/orthanc/ | DICOM server UI |
| Keycloak | http://localhost/auth/ | Identity management |
| Backend API | http://localhost/api/ | Platform REST API |
| API Documentation | http://localhost/api/docs | Swagger UI |

### Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| Keycloak Admin | `admin` | `keycloak_admin_password` |
| Platform Admin | `admin` | `admin123` |
| Test Radiologist | `radiologist` | `rad123` |

> ⚠️ **Change all default passwords before deploying to production.**

## Project Structure

```
├── backend/                 # Backend API (NestJS)
│   ├── src/                # Source code
│   │   ├── auth/          # JWT authentication with Keycloak
│   │   ├── users/         # User management
│   │   ├── providers/     # Healthcare provider management
│   │   ├── studies/       # DICOM study management
│   │   └── reports/       # Radiology report management
│   ├── prisma/            # Database schema and migrations
│   └── Dockerfile         # Docker build for backend
├── docker/                  # Docker configuration files
│   ├── keycloak/           # Keycloak realm and config
│   ├── nginx/              # Nginx reverse proxy config
│   ├── ohif/               # OHIF Dockerfile and config
│   ├── orthanc/            # Orthanc DICOM server config
│   └── postgres/           # Database initialization scripts
├── platform/               # OHIF platform packages
│   ├── core/              # Core functionality
│   ├── i18n/              # Internationalization
│   ├── ui/                # UI components
│   └── viewer/            # Main viewer application
│       └── src/services/  # API service layer
├── extensions/            # OHIF extensions
├── docker-compose.yml     # Main compose file
├── ROADMAP.md            # Development roadmap
└── README.md             # This file
```

## Backend API

The platform includes a NestJS-based REST API with the following endpoints:

### Health
- `GET /api/health` - API health status
- `GET /api/health/ready` - Readiness check

### Users
- `GET /api/users` - List users (admin/support only)
- `GET /api/users/me` - Current user profile
- `GET /api/users/radiologists` - List active radiologists
- `POST /api/users` - Create user (admin only)
- `PATCH /api/users/:id` - Update user
- `PATCH /api/users/:id/status` - Update user status

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
- `POST /api/studies/:id/assign` - Assign study to radiologist
- `POST /api/studies/:id/release` - Release assignment
- `POST /api/studies/:id/flag-stat` - Flag as STAT priority

### Reports
- `GET /api/reports` - List reports
- `GET /api/reports/my-reports` - Get radiologist's reports
- `POST /api/reports` - Create new report
- `PATCH /api/reports/:id` - Update draft report
- `POST /api/reports/:id/finalize` - Finalize report
- `POST /api/reports/:id/addendum` - Create addendum

For full API documentation, visit `http://localhost/api/docs` after starting the services.

## Documentation

- [Backend API Documentation](./backend/README.md) – Backend API setup and endpoints
- [Docker Setup Guide](./docker/README.md) – Detailed Docker configuration and usage
- [Development Roadmap](./ROADMAP.md) – Planned features and next steps
- [Contributing Guide](./CONTRIBUTING.md) – How to contribute

## User Roles

| Role | Description |
|------|-------------|
| **Admin** | Full system access, user management, configuration |
| **Radiologist** | View studies, create reports, manage assignments |
| **Provider** | Healthcare facility manager, view reports, manage studies |
| **Billing Officer** | Invoice management, payment tracking |
| **Support** | Limited admin access for user assistance |
| **Auditor** | Read-only access for compliance review |

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the complete development roadmap.

### Completed ✅
- **Backend API** – NestJS REST API with Swagger documentation
- **Authentication** – Keycloak JWT validation middleware
- **Core Endpoints** – Users, Providers, Studies, Reports management
- **Frontend Integration** – API service layer and OIDC configuration

### In Progress 🔄
- **Worklist Extension** – Radiologist assignment queue
- **Reporting Extension** – In-viewer report editor

### Upcoming
- **Background Jobs** – SLA monitoring, auto-assignment, notifications
- **Admin Dashboard** – User and provider management UI

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License – see [LICENSE](./LICENSE) for details.

## Acknowledgments

- [OHIF Viewer](https://ohif.org/) – Open-source medical imaging viewer
- [Orthanc](https://www.orthanc-server.com/) – DICOM server
- [Keycloak](https://www.keycloak.org/) – Identity and access management
