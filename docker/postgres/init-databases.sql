-- =============================================================================
-- PACS Platform Database Initialization Script
-- Creates databases and full schema for the PACS-EMR platform
-- =============================================================================

-- Create databases
CREATE DATABASE orthanc;
CREATE DATABASE keycloak;
CREATE DATABASE pacs_platform;

-- =============================================================================
-- PACS Platform Schema
-- =============================================================================

\connect pacs_platform

-- ---------------------------------------------------------------------------
-- ENUM Types
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM (
    'admin', 'radiologist', 'provider_manager', 'billing_officer', 'support', 'auditor'
);

CREATE TYPE user_status AS ENUM (
    'active', 'inactive', 'suspended', 'pending_verification'
);

CREATE TYPE study_priority AS ENUM (
    'stat', 'urgent', 'routine', 'follow_up'
);

CREATE TYPE study_status AS ENUM (
    'received', 'queued', 'assigned', 'in_progress', 'reported', 'verified', 'disputed', 'amended'
);

CREATE TYPE assignment_status AS ENUM (
    'pending', 'accepted', 'in_progress', 'completed', 'released', 'escalated', 'reassigned'
);

CREATE TYPE report_status AS ENUM (
    'draft', 'preliminary', 'final', 'amended', 'cancelled'
);

CREATE TYPE sla_status AS ENUM (
    'on_track', 'warning', 'breached'
);

CREATE TYPE dispute_status AS ENUM (
    'open', 'under_review', 'resolved_original_correct', 'resolved_amended', 'escalated', 'closed'
);

CREATE TYPE verification_status AS ENUM (
    'pending', 'under_review', 'approved', 'rejected', 'expired'
);

CREATE TYPE notification_type AS ENUM (
    'study_assigned', 'stat_alert', 'sla_warning', 'sla_breach', 'dispute_filed',
    'report_completed', 'credential_status', 'system_alert'
);

CREATE TYPE invoice_status AS ENUM (
    'draft', 'sent', 'paid', 'overdue', 'cancelled'
);

CREATE TYPE billing_status AS ENUM (
    'pending', 'billable', 'invoiced', 'paid', 'waived'
);

-- ---------------------------------------------------------------------------
-- updated_at trigger function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT NOT NULL UNIQUE,
    password_hash       TEXT,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    role                user_role NOT NULL,
    status              user_status NOT NULL DEFAULT 'pending_verification',
    phone               TEXT,
    two_factor_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE healthcare_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    code            TEXT NOT NULL UNIQUE,
    address         TEXT,
    city            TEXT,
    state           TEXT,
    country         TEXT,
    phone           TEXT,
    email           TEXT,
    contact_person  TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE radiologist_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    license_number          TEXT,
    license_expiry          DATE,
    specializations         TEXT[],
    verification_status     verification_status NOT NULL DEFAULT 'pending',
    verified_by             UUID REFERENCES users(id),
    verified_at             TIMESTAMPTZ,
    years_of_experience     INTEGER,
    average_rating          NUMERIC(3,2) NOT NULL DEFAULT 0,
    total_ratings           INTEGER NOT NULL DEFAULT 0,
    documents_url           TEXT,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE studies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orthanc_study_id    TEXT NOT NULL UNIQUE,
    study_instance_uid  TEXT NOT NULL UNIQUE,
    patient_id          TEXT,
    patient_name_hash   TEXT,
    modality            TEXT,
    study_description   TEXT,
    study_date          DATE,
    referring_physician TEXT,
    body_part           TEXT,
    priority            study_priority NOT NULL DEFAULT 'routine',
    status              study_status NOT NULL DEFAULT 'received',
    provider_id         UUID REFERENCES healthcare_providers(id),
    is_anonymized       BOOLEAN NOT NULL DEFAULT TRUE,
    stat_flagged_at     TIMESTAMPTZ,
    stat_flagged_by     UUID REFERENCES users(id),
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE report_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id         UUID REFERENCES healthcare_providers(id),
    name                TEXT NOT NULL,
    description         TEXT,
    modality            TEXT,
    body_part           TEXT,
    template_format     TEXT NOT NULL DEFAULT 'HTML',
    template_content    TEXT,
    language            TEXT NOT NULL DEFAULT 'en',
    placeholders        JSONB,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    version             INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id            UUID NOT NULL REFERENCES studies(id),
    radiologist_id      UUID NOT NULL REFERENCES users(id),
    template_id         UUID REFERENCES report_templates(id),
    status              report_status NOT NULL DEFAULT 'draft',
    findings            TEXT,
    impression          TEXT,
    conclusion          TEXT,
    report_body         TEXT,
    version             INTEGER NOT NULL DEFAULT 1,
    parent_report_id    UUID REFERENCES reports(id),
    is_addendum         BOOLEAN NOT NULL DEFAULT FALSE,
    finalized_at        TIMESTAMPTZ,
    finalized_by        UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE study_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id            UUID NOT NULL REFERENCES studies(id),
    radiologist_id      UUID NOT NULL REFERENCES users(id),
    assigned_by         UUID NOT NULL REFERENCES users(id),
    assignment_status   assignment_status NOT NULL DEFAULT 'pending',
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at         TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    released_at         TIMESTAMPTZ,
    release_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sla_configurations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id                 UUID NOT NULL REFERENCES healthcare_providers(id),
    modality                    TEXT,
    priority                    study_priority NOT NULL,
    target_hours                NUMERIC(6,2) NOT NULL,
    warning_threshold_percent   INTEGER NOT NULL DEFAULT 80,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider_id, modality, priority)
);

CREATE TABLE sla_tracking (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id        UUID NOT NULL UNIQUE REFERENCES studies(id),
    sla_config_id   UUID NOT NULL REFERENCES sla_configurations(id),
    deadline_at     TIMESTAMPTZ NOT NULL,
    warning_sent_at TIMESTAMPTZ,
    breached_at     TIMESTAMPTZ,
    status          sla_status NOT NULL DEFAULT 'on_track',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number      TEXT NOT NULL UNIQUE,
    provider_id         UUID NOT NULL REFERENCES healthcare_providers(id),
    billing_period_start DATE NOT NULL,
    billing_period_end   DATE NOT NULL,
    subtotal            NUMERIC(12,2) NOT NULL,
    tax_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(12,2) NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'USD',
    status              invoice_status NOT NULL DEFAULT 'draft',
    issued_at           TIMESTAMPTZ,
    due_at              TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    payment_reference   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE billing_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id        UUID NOT NULL UNIQUE REFERENCES studies(id),
    provider_id     UUID NOT NULL REFERENCES healthcare_providers(id),
    radiologist_id  UUID REFERENCES users(id),
    modality        TEXT,
    priority        study_priority,
    base_amount     NUMERIC(10,2) NOT NULL,
    stat_surcharge  NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(10,2) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USD',
    status          billing_status NOT NULL DEFAULT 'pending',
    invoice_id      UUID REFERENCES invoices(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          UUID NOT NULL REFERENCES invoices(id),
    billing_record_id   UUID REFERENCES billing_records(id),
    description         TEXT NOT NULL,
    quantity            INTEGER NOT NULL DEFAULT 1,
    unit_price          NUMERIC(10,2) NOT NULL,
    total_price         NUMERIC(10,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE disputes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id                UUID NOT NULL REFERENCES studies(id),
    report_id               UUID NOT NULL REFERENCES reports(id),
    filed_by                UUID NOT NULL REFERENCES users(id),
    assigned_reviewer_id    UUID REFERENCES users(id),
    status                  dispute_status NOT NULL DEFAULT 'open',
    reason                  TEXT,
    resolution_notes        TEXT,
    original_report_id      UUID REFERENCES reports(id),
    amended_report_id       UUID REFERENCES reports(id),
    filed_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ratings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id            UUID NOT NULL REFERENCES studies(id),
    report_id           UUID NOT NULL REFERENCES reports(id),
    radiologist_id      UUID NOT NULL REFERENCES users(id),
    rated_by            UUID NOT NULL REFERENCES users(id),
    stars               INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    feedback            TEXT,
    is_dispute_related  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (study_id, rated_by)
);

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    action          TEXT NOT NULL,
    resource_type   TEXT,
    resource_id     TEXT,
    details         JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    type            notification_type NOT NULL,
    title           TEXT NOT NULL,
    message         TEXT,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    reference_type  TEXT,
    reference_id    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at         TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

CREATE INDEX idx_studies_orthanc_study_id ON studies(orthanc_study_id);
CREATE INDEX idx_studies_study_instance_uid ON studies(study_instance_uid);
CREATE INDEX idx_studies_status ON studies(status);
CREATE INDEX idx_studies_priority ON studies(priority);
CREATE INDEX idx_studies_provider_id ON studies(provider_id);
CREATE INDEX idx_studies_received_at ON studies(received_at);
CREATE INDEX idx_studies_modality ON studies(modality);

CREATE INDEX idx_study_assignments_study_id ON study_assignments(study_id);
CREATE INDEX idx_study_assignments_radiologist_id ON study_assignments(radiologist_id);
CREATE INDEX idx_study_assignments_status ON study_assignments(assignment_status);

CREATE INDEX idx_reports_study_id ON reports(study_id);
CREATE INDEX idx_reports_radiologist_id ON reports(radiologist_id);
CREATE INDEX idx_reports_status ON reports(status);

CREATE INDEX idx_sla_tracking_study_id ON sla_tracking(study_id);
CREATE INDEX idx_sla_tracking_status ON sla_tracking(status);
CREATE INDEX idx_sla_tracking_deadline_at ON sla_tracking(deadline_at);

CREATE INDEX idx_disputes_study_id ON disputes(study_id);
CREATE INDEX idx_disputes_status ON disputes(status);

CREATE INDEX idx_billing_records_study_id ON billing_records(study_id);
CREATE INDEX idx_billing_records_provider_id ON billing_records(provider_id);
CREATE INDEX idx_billing_records_status ON billing_records(status);

CREATE INDEX idx_invoices_provider_id ON invoices(provider_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

CREATE INDEX idx_ratings_radiologist_id ON ratings(radiologist_id);
CREATE INDEX idx_ratings_study_id ON ratings(study_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_radiologist_profiles
    BEFORE UPDATE ON radiologist_profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_healthcare_providers
    BEFORE UPDATE ON healthcare_providers
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_studies
    BEFORE UPDATE ON studies
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_study_assignments
    BEFORE UPDATE ON study_assignments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_reports
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_report_templates
    BEFORE UPDATE ON report_templates
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_sla_configurations
    BEFORE UPDATE ON sla_configurations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_sla_tracking
    BEFORE UPDATE ON sla_tracking
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_disputes
    BEFORE UPDATE ON disputes
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_billing_records
    BEFORE UPDATE ON billing_records
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_invoices
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
