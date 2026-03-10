# PACS-EMR Platform Roadmap

This document outlines the next steps and development priorities for the PACS-EMR platform.

## Current State

The foundation layer is complete:

| Component | Status | Description |
|-----------|--------|-------------|
| Docker Infrastructure | ✅ Complete | Multi-service Docker Compose with PostgreSQL, Orthanc, Keycloak, OHIF, Nginx, Backend API |
| Database Schema | ✅ Complete | Full schema for users, studies, reports, SLA tracking, billing, disputes, audit logs |
| Identity Management | ✅ Complete | Keycloak realm with roles (admin, radiologist, provider, billing_officer, support, auditor) |
| DICOM Server | ✅ Complete | Orthanc configured with DICOMweb, PostgreSQL storage |
| Viewer | ✅ Complete | OHIF Viewer connected to Orthanc via DICOMweb |
| Reverse Proxy | ✅ Complete | Nginx routing for all services including backend API |
| Backend API | ✅ Complete | NestJS API with User, Provider, Study, Report management |

---

## Phase 1: Backend API (Priority: High) ✅ COMPLETE

Build the core backend service that connects Keycloak, Orthanc, and the PostgreSQL platform database.

### 1.1 API Foundation ✅
- [x] Choose backend framework - **NestJS (TypeScript)**
- [x] Set up project structure with dependency injection
- [x] Configure Keycloak JWT validation middleware
- [x] Implement database connection pool with **Prisma ORM**
- [x] Add OpenAPI/Swagger documentation (available at `/api/docs`)
- [x] Create health check endpoints (`/api/health`, `/api/health/ready`)

### 1.2 Core Endpoints ✅
- [x] **User Management**
  - `GET/POST/PATCH /api/users` - CRUD operations
  - `GET /api/users/me` - Current user profile
  - `GET /api/users/radiologists` - List active radiologists
  - `POST /api/users/radiologist-profile` - Radiologist verification submission
  - `PATCH /api/users/:id/status` - Admin status changes

- [x] **Healthcare Provider Management**
  - `GET/POST/PATCH /api/providers` - CRUD operations
  - `GET /api/providers/:id/studies` - Studies from provider

- [x] **Study Management**
  - `GET /api/studies` - List with filtering/pagination
  - `GET /api/studies/:id` - Study details with assignments
  - `GET /api/studies/worklist` - Radiologist worklist
  - `POST /api/studies` - Create study (webhook handler)
  - `POST /api/studies/:id/flag-stat` - STAT flagging
  - `POST /api/studies/:id/assign` - Manual assignment
  - `POST /api/studies/:id/release` - Release assignment

- [x] **Report Management**
  - `GET/POST/PATCH /api/reports` - CRUD operations
  - `GET /api/reports/my-reports` - Radiologist's reports
  - `POST /api/reports/:id/finalize` - Finalize report
  - `POST /api/reports/:id/addendum` - Create addendum

### 1.3 Background Jobs ✅
- [x] **Orthanc Webhook Handler** - Sync new studies from Orthanc to platform database
- [x] **SLA Monitor** - Check SLA deadlines, send warnings, mark breaches
- [x] **Auto-Assignment Engine** - Round-robin or load-balanced radiologist assignment
- [x] **Notification Dispatcher** - Email (nodemailer/SMTP) + WebSocket (Socket.IO) delivery; `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`

---

## Phase 2: Frontend Integration (Priority: High) ✅ COMPLETE

Extend the OHIF Viewer with platform-specific features.

### 2.1 Authentication Integration ✅
- [x] Add Keycloak OIDC login flow configuration to OHIF (`pacs-platform.js` config)
- [x] Create API service layer (`pacsApiService.js`) for backend integration
- [x] Implement token refresh logic (`TokenRefreshNotification`, `automaticSilentRenew: true`)
- [x] Add role-based route guards (`ProtectedRoute` component, `useHasRole` hook)
- [x] Display user profile in header (`UserProfile` component in Header)

### 2.2 Worklist Extension ✅
- [x] Create custom OHIF extension for worklist
- [x] Show studies assigned to current radiologist
- [x] Display SLA countdown timers
- [x] Add STAT indicators and sorting
- [x] Filter by modality, priority, status

### 2.3 Reporting Extension ✅
- [x] In-viewer report editor panel (`extensions/reporting/`)
- [x] Template selection and insertion (modality-specific templates)
- [x] Voice dictation integration (Web Speech API)
- [x] Draft auto-save
- [x] Finalize and sign workflow
- [x] Previous reports viewer

### 2.4 Admin Dashboard ✅
- [x] User management UI (list, create, activate/deactivate)
- [x] Provider onboarding wizard (step-by-step, `POST /api/providers`)
- [x] Radiologist verification workflow (approve/reject pending verifications)
- [x] SLA configuration editor (threshold form)
- [x] System health dashboard (`GET /api/health/ready`)

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
