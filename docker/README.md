# PACS Platform — Docker Infrastructure

A full Docker Compose setup that wires together all foundational services for the PACS-EMR platform built on top of the OHIF Viewer.

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
                        │  /api/      → 502 (reserved)      │
                        └─────┬────────┬────────┬──────────┘
                              │        │        │
              ┌───────────────▼─┐   ┌──▼───┐  ┌▼──────────┐
              │   OHIF Viewer   │   │Orthanc│  │ Keycloak  │
              │   :3000         │   │:8042  │  │ :8080     │
              └─────────────────┘   └──┬───┘  └─────┬─────┘
                                       │             │
                              ┌────────▼─────────────▼──────┐
                              │         PostgreSQL :5432      │
                              │  orthanc / keycloak /         │
                              │  pacs_platform databases      │
                              └──────────────────────────────┘
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+

## Quick Start

```bash
# 1. Copy the example environment file
cp .env.example .env

# 2. Edit .env to set your passwords (optional for local dev)

# 3. Start all services
docker compose up -d

# 4. Wait for services to become healthy (~60 seconds first run)
docker compose ps

# 5. Open the OHIF Viewer
open http://localhost
```

## Service URLs

| Service | URL | Notes |
|---------|-----|-------|
| OHIF Viewer | http://localhost | Main entry point via Nginx |
| OHIF Viewer (direct) | http://localhost:3000 | Direct access |
| Orthanc Web UI | http://localhost/orthanc/ | DICOM management UI |
| Orthanc (direct) | http://localhost:8042 | DICOMweb API |
| Keycloak Admin | http://localhost/auth/ | Identity management |
| Keycloak (direct) | http://localhost:8080 | Direct access |
| PostgreSQL | localhost:5432 | Database |

## Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| Keycloak Admin Console | `admin` | `keycloak_admin_password` |
| PACS Platform — admin user | `admin` | `admin123` |
| PACS Platform — radiologist | `radiologist` | `rad123` |
| PostgreSQL | `postgres` | `postgres_password` |

> ⚠️ Change all default passwords before deploying to any non-local environment.

## Uploading DICOM Studies

### Via Orthanc Web UI

1. Navigate to http://localhost/orthanc/
2. Click **Upload** in the top menu
3. Drag and drop DICOM files or click to browse

### Via DICOM C-STORE (DIMSE)

Use any DICOM-capable tool (e.g., `storescu` from dcm4che):

```bash
storescu -c PACS_PLATFORM@localhost:4242 /path/to/dicom/files/
```

### Via DICOMweb STOW-RS

```bash
curl -X POST http://localhost/orthanc/dicom-web/studies \
  -H "Content-Type: multipart/related; type=application/dicom" \
  --data-binary @study.dcm
```

## Accessing the OHIF Viewer

1. Open http://localhost in your browser
2. The study list will show all studies stored in Orthanc
3. Click any study to open it in the viewer

## Database Access

Connect to PostgreSQL with any SQL client:

```
Host:     localhost
Port:     5432
Username: postgres
Password: postgres_password
```

Available databases:
- `orthanc` — DICOM index (managed by Orthanc)
- `keycloak` — Identity provider data
- `pacs_platform` — Platform schema (users, studies, reports, billing, etc.)

## Development Workflow

```bash
# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f orthanc

# Restart a single service
docker compose restart ohif

# Stop all services
docker compose down

# Stop and remove all volumes (destructive!)
docker compose down -v

# Rebuild the OHIF image after code changes
docker compose build ohif
docker compose up -d ohif
```

## Troubleshooting

### Orthanc fails to start

Check that PostgreSQL is healthy before Orthanc starts:
```bash
docker compose ps postgres
docker compose logs postgres
```

### OHIF shows "No studies found"

1. Confirm Orthanc is running: http://localhost/orthanc/
2. Upload a test DICOM study via the Orthanc UI
3. Refresh the OHIF study list

### Keycloak import fails

If the `pacs-platform` realm was not imported automatically, import it manually:
```bash
docker compose exec keycloak \
  /opt/keycloak/bin/kc.sh import --file /opt/keycloak/data/import/pacs-realm.json
```

### Port conflicts

If any port is already in use, override it in your `.env` file:
```bash
ORTHANC_HTTP_PORT=18042
NGINX_PORT=8888
```

## Production Deployment Considerations

- **TLS**: Place a TLS-terminating load balancer (e.g., Caddy, Traefik, AWS ALB) in front of Nginx
- **Secrets**: Use Docker Secrets or a vault (HashiCorp Vault, AWS Secrets Manager) instead of `.env` files
- **Resource limits**: Add `deploy.resources.limits` to each service in `docker-compose.yml`
- **Authentication**: Enable `AuthenticationEnabled: true` in `docker/orthanc/orthanc.json`
- **Backups**: Set up automated backups for the `postgres-data` and `orthanc-data` volumes
- **High availability**: Consider running PostgreSQL as a managed service (RDS, Cloud SQL) and Orthanc in cluster mode
- **Monitoring**: Add Prometheus + Grafana for metrics; Orthanc exposes a `/metrics` endpoint
