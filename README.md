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
                        │  /api/      → Backend API         │
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

### Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| Keycloak Admin | `admin` | `keycloak_admin_password` |
| Platform Admin | `admin` | `admin123` |
| Test Radiologist | `radiologist` | `rad123` |

> ⚠️ **Change all default passwords before deploying to production.**

## Project Structure

```
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
├── extensions/            # OHIF extensions
├── docker-compose.yml     # Main compose file
├── ROADMAP.md            # Development roadmap
└── README.md             # This file
```

## Documentation

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

See [ROADMAP.md](./ROADMAP.md) for the complete development roadmap. High-priority next steps:

1. **Backend API** – REST API for platform business logic
2. **Authentication Integration** – Keycloak OIDC in OHIF viewer
3. **Worklist Extension** – Radiologist assignment queue
4. **Reporting Extension** – In-viewer report editor

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License – see [LICENSE](./LICENSE) for details.

## Acknowledgments

- [OHIF Viewer](https://ohif.org/) – Open-source medical imaging viewer
- [Orthanc](https://www.orthanc-server.com/) – DICOM server
- [Keycloak](https://www.keycloak.org/) – Identity and access management
