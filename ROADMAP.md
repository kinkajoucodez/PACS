# PACS-EMR Platform Roadmap

This document outlines the next steps and development priorities for the PACS-EMR platform.

## Current State

The foundation layer is complete:

| Component | Status | Description |
|-----------|--------|-------------|
| Docker Infrastructure | ✅ Complete | Multi-service Docker Compose with PostgreSQL, Orthanc, Keycloak, OHIF, Nginx |
| Database Schema | ✅ Complete | Full schema for users, studies, reports, SLA tracking, billing, disputes, audit logs |
| Identity Management | ✅ Complete | Keycloak realm with roles (admin, radiologist, provider, billing_officer, support, auditor) |
| DICOM Server | ✅ Complete | Orthanc configured with DICOMweb, PostgreSQL storage |
| Viewer | ✅ Complete | OHIF Viewer connected to Orthanc via DICOMweb |
| Reverse Proxy | ✅ Complete | Nginx routing for all services |

---

## Phase 1: Backend API (Priority: High)

Build the core backend service that connects Keycloak, Orthanc, and the PostgreSQL platform database.

### 1.1 API Foundation
- [ ] Choose backend framework (Node.js/Express, Python/FastAPI, Go/Gin)
- [ ] Set up project structure with dependency injection
- [ ] Configure Keycloak JWT validation middleware
- [ ] Implement database connection pool with Prisma/SQLAlchemy/GORM
- [ ] Add OpenAPI/Swagger documentation
- [ ] Create health check endpoints

### 1.2 Core Endpoints
- [ ] **User Management**
  - `GET/POST/PATCH /api/users` - CRUD operations
  - `GET /api/users/me` - Current user profile
  - `POST /api/users/radiologist-profile` - Radiologist verification submission
  - `PATCH /api/users/:id/status` - Admin status changes

- [ ] **Healthcare Provider Management**
  - `GET/POST/PATCH /api/providers` - CRUD operations
  - `GET /api/providers/:id/users` - Users associated with provider
  - `GET /api/providers/:id/studies` - Studies from provider

- [ ] **Study Management**
  - `GET /api/studies` - List with filtering/pagination
  - `GET /api/studies/:id` - Study details with assignments
  - `POST /api/studies/:id/flag-stat` - STAT flagging
  - `POST /api/studies/:id/assign` - Manual assignment
  - `POST /api/studies/:id/release` - Release assignment

- [ ] **Report Management**
  - `GET/POST/PATCH /api/reports` - CRUD operations
  - `POST /api/reports/:id/finalize` - Finalize report
  - `POST /api/reports/:id/addendum` - Create addendum

### 1.3 Background Jobs
- [ ] **Orthanc Webhook Handler** - Sync new studies from Orthanc to platform database
- [ ] **SLA Monitor** - Check SLA deadlines, send warnings, mark breaches
- [ ] **Auto-Assignment Engine** - Round-robin or load-balanced radiologist assignment
- [ ] **Notification Dispatcher** - Send notifications via email/WebSocket

---

## Phase 2: Frontend Integration (Priority: High)

Extend the OHIF Viewer with platform-specific features.

### 2.1 Authentication Integration
- [ ] Add Keycloak OIDC login flow to OHIF
- [ ] Implement token refresh logic
- [ ] Add role-based route guards
- [ ] Display user profile in header

### 2.2 Worklist Extension
- [ ] Create custom OHIF extension for worklist
- [ ] Show studies assigned to current radiologist
- [ ] Display SLA countdown timers
- [ ] Add STAT indicators and sorting
- [ ] Filter by modality, priority, status

### 2.3 Reporting Extension
- [ ] In-viewer report editor panel
- [ ] Template selection and insertion
- [ ] Voice dictation integration (Web Speech API)
- [ ] Draft auto-save
- [ ] Finalize and sign workflow
- [ ] Previous reports viewer

### 2.4 Admin Dashboard
- [ ] User management UI
- [ ] Provider onboarding wizard
- [ ] Radiologist verification workflow
- [ ] SLA configuration editor
- [ ] System health dashboard

---

## Phase 3: Billing & Invoicing (Priority: Medium)

### 3.1 Billing Records
- [ ] Auto-create billing record when report is finalized
- [ ] Price matrix configuration per provider/modality
- [ ] STAT surcharge rules
- [ ] Billing status tracking

### 3.2 Invoice Generation
- [ ] Monthly invoice generation job
- [ ] Invoice PDF rendering
- [ ] Email invoice delivery
- [ ] Payment tracking
- [ ] Overdue alerts

### 3.3 Billing Dashboard
- [ ] Invoice list with status filters
- [ ] Payment recording
- [ ] Revenue analytics
- [ ] Provider billing history

---

## Phase 4: Quality & Compliance (Priority: Medium)

### 4.1 Dispute System
- [ ] Dispute filing workflow
- [ ] Reviewer assignment
- [ ] Resolution tracking
- [ ] Amended report linking

### 4.2 Rating System
- [ ] Provider rating interface
- [ ] Radiologist performance scores
- [ ] Feedback collection
- [ ] Quality metrics dashboard

### 4.3 Audit & Compliance
- [ ] Comprehensive audit logging
- [ ] Audit log viewer
- [ ] Compliance reports (HIPAA, etc.)
- [ ] Data retention policies

---

## Phase 5: Production Readiness (Priority: High for Production)

### 5.1 Security Hardening
- [ ] Enable Orthanc authentication
- [ ] TLS everywhere (generate certs, configure Nginx)
- [ ] Secret management (Docker Secrets / Vault)
- [ ] Network segmentation
- [ ] Input validation and sanitization
- [ ] Rate limiting

### 5.2 Observability
- [ ] Prometheus metrics collection
- [ ] Grafana dashboards
- [ ] Centralized logging (ELK/Loki)
- [ ] Distributed tracing
- [ ] Alert rules for critical events

### 5.3 High Availability
- [ ] PostgreSQL replication or managed service
- [ ] Orthanc clustering
- [ ] Keycloak clustering
- [ ] Load balancer configuration
- [ ] Backup and disaster recovery

### 5.4 CI/CD
- [ ] GitHub Actions for testing
- [ ] Docker image builds
- [ ] Automated deployments
- [ ] Database migrations in CI
- [ ] E2E test suite

---

## Phase 6: Advanced Features (Priority: Low)

### 6.1 AI Integration
- [ ] AI-assisted reporting (findings suggestions)
- [ ] Auto-routing based on study type
- [ ] Anomaly detection flags
- [ ] Quality assurance AI review

### 6.2 Communication
- [ ] In-app messaging between providers and radiologists
- [ ] Critical findings notification workflow
- [ ] Referring physician communication portal

### 6.3 Analytics
- [ ] Turnaround time analytics
- [ ] Volume trends
- [ ] Radiologist productivity
- [ ] SLA compliance rates
- [ ] Revenue forecasting

### 6.4 Mobile
- [ ] Mobile-responsive viewer
- [ ] Push notifications
- [ ] Quick report approval on mobile

---

## Quick Wins (Can Start Immediately)

1. **Update README.md** - Add project overview, architecture diagram, and getting started guide
2. **Add sample DICOM data** - Include test studies for development
3. **API Scaffolding** - Set up basic Express/FastAPI project structure
4. **Keycloak OHIF Integration** - Add OIDC login to the viewer
5. **Orthanc Webhook** - Configure Orthanc to call backend on new studies

---

## Technology Recommendations

### Backend Options

| Option | Pros | Cons |
|--------|------|------|
| **Node.js + Express** | Same language as frontend, large ecosystem | Weaker typing without TypeScript |
| **Node.js + NestJS** | Strong typing, dependency injection, OpenAPI built-in | Steeper learning curve |
| **Python + FastAPI** | Great for medical/data apps, auto-docs, async | Different language from frontend |
| **Go + Gin** | Fast, compiled, excellent concurrency | Smaller ecosystem |

**Recommendation**: NestJS or FastAPI for the balance of features and maintainability.

### Infrastructure Enhancements

| Enhancement | Tool Options |
|-------------|--------------|
| Message Queue | Redis, RabbitMQ, AWS SQS |
| Cache | Redis |
| Object Storage | MinIO, S3 |
| Search | Elasticsearch (for patient search) |
| PDF Generation | Puppeteer, WeasyPrint, Gotenberg |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to this project.

## Questions?

Open a GitHub Issue or start a Discussion for any questions about the roadmap or implementation details.
