CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- for booking overlap EXCLUDE constraint

-- =====================================================================
-- ENUM TYPES
-- =====================================================================
CREATE TYPE user_role            AS ENUM ('admin', 'asset_manager', 'department_head', 'employee');
CREATE TYPE active_status        AS ENUM ('active', 'inactive');
CREATE TYPE asset_condition      AS ENUM ('new', 'good', 'fair', 'poor', 'damaged');
CREATE TYPE asset_status         AS ENUM ('available', 'allocated', 'reserved', 'under_maintenance', 'lost', 'retired', 'disposed');
CREATE TYPE allocation_status    AS ENUM ('active', 'returned', 'overdue');
CREATE TYPE transfer_status      AS ENUM ('requested', 'approved', 'rejected', 'completed');
CREATE TYPE booking_status       AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');
CREATE TYPE maintenance_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE maintenance_status   AS ENUM ('pending', 'approved', 'rejected', 'technician_assigned', 'in_progress', 'resolved');
CREATE TYPE audit_cycle_status   AS ENUM ('planned', 'in_progress', 'closed');
CREATE TYPE audit_item_result    AS ENUM ('pending', 'verified', 'missing', 'damaged');
CREATE TYPE discrepancy_type     AS ENUM ('missing', 'damaged');
CREATE TYPE notification_type    AS ENUM (
    'asset_assigned', 'maintenance_approved', 'maintenance_rejected',
    'booking_confirmed', 'booking_cancelled', 'booking_reminder',
    'transfer_approved', 'overdue_return', 'audit_discrepancy'
);

-- Helper: auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- DEPARTMENTS  (self-referencing hierarchy)
-- =====================================================================
CREATE TABLE departments (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   VARCHAR(150) NOT NULL,
    head_user_id           UUID,               -- FK added after users table exists
    parent_department_id   UUID REFERENCES departments(id),
    status                 active_status NOT NULL DEFAULT 'active',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- USERS
-- =====================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL CHECK (length(password_hash) >= 6),
    role            user_role NOT NULL DEFAULT 'employee',
    department_id   UUID REFERENCES departments(id),
    status          active_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE departments
    ADD CONSTRAINT fk_department_head FOREIGN KEY (head_user_id) REFERENCES users(id);

CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_role ON users(role);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- ASSET CATEGORIES
-- Only 4 rows will be seeded: Electronics, Furniture, Shared Spaces, Vehicle
-- custom_fields defines the category-specific schema-flexible attributes
-- =====================================================================
CREATE TABLE asset_categories (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(100) NOT NULL UNIQUE,
    custom_fields  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON asset_categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- ASSETS
-- =====================================================================
CREATE TABLE assets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_tag           VARCHAR(30) NOT NULL UNIQUE,          -- server-generated e.g. AF-0001
    name                VARCHAR(200) NOT NULL,
    category_id         UUID NOT NULL REFERENCES asset_categories(id),
    serial_number       VARCHAR(150),
    qr_code             VARCHAR(255),
    acquisition_date    DATE,
    acquisition_cost    DECIMAL(12,2),
    condition           asset_condition NOT NULL DEFAULT 'new',
    location             VARCHAR(200),
    department_id       UUID REFERENCES departments(id),      -- current owning department
    photo_url           TEXT,
    document_urls        JSONB DEFAULT '[]'::jsonb,
    custom_field_values  JSONB DEFAULT '{}'::jsonb,            -- values matching category.custom_fields
    is_bookable         BOOLEAN NOT NULL DEFAULT false,
    status              asset_status NOT NULL DEFAULT 'available',
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_category ON assets(category_id);
CREATE INDEX idx_assets_department ON assets(department_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_asset_tag ON assets(asset_tag);
CREATE INDEX idx_assets_is_bookable ON assets(is_bookable) WHERE is_bookable = true;
CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();



-- =====================================================================
-- ALLOCATIONS  (one active allocation per asset — partial unique index)
-- =====================================================================
CREATE TABLE allocations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id                UUID NOT NULL REFERENCES assets(id),
    employee_id             UUID REFERENCES users(id),
    department_id           UUID REFERENCES departments(id),
    allocated_date          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expected_return_date    TIMESTAMPTZ,
    actual_return_date      TIMESTAMPTZ,
    return_condition_notes  TEXT,
    status                  allocation_status NOT NULL DEFAULT 'active',
    allocated_by            UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No double allocation: only one ACTIVE allocation per asset at a time
CREATE UNIQUE INDEX uq_one_active_allocation_per_asset
    ON allocations(asset_id) WHERE status = 'active';

CREATE INDEX idx_allocations_asset ON allocations(asset_id);
CREATE INDEX idx_allocations_employee ON allocations(employee_id);
CREATE INDEX idx_allocations_status ON allocations(status);
CREATE TRIGGER trg_allocations_updated_at BEFORE UPDATE ON allocations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- TRANSFER REQUESTS
-- =====================================================================
CREATE TABLE transfer_requests (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id                  UUID NOT NULL REFERENCES assets(id),
    from_allocation_id        UUID REFERENCES allocations(id),
    requested_by               UUID REFERENCES users(id),
    requested_to_employee_id  UUID REFERENCES users(id),
    status                    transfer_status NOT NULL DEFAULT 'requested',
    approved_by                UUID REFERENCES users(id),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transfer_asset ON transfer_requests(asset_id);
CREATE INDEX idx_transfer_status ON transfer_requests(status);
CREATE TRIGGER trg_transfer_updated_at BEFORE UPDATE ON transfer_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- BOOKINGS  (used mainly by Shared Spaces, but any is_bookable asset qualifies)
-- Overlap prevented at the DB level via an EXCLUDE constraint
-- =====================================================================
CREATE TABLE bookings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id       UUID NOT NULL REFERENCES assets(id),
    booked_by      UUID REFERENCES users(id),
    department_id  UUID REFERENCES departments(id),
    start_time     TIMESTAMPTZ NOT NULL,
    end_time       TIMESTAMPTZ NOT NULL,
    status         booking_status NOT NULL DEFAULT 'upcoming',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);

-- DB-level overlap prevention for active bookings on the same asset
ALTER TABLE bookings
    ADD CONSTRAINT no_overlapping_bookings
    EXCLUDE USING gist (
        asset_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    )
    WHERE (status IN ('upcoming', 'ongoing'));

CREATE INDEX idx_bookings_asset ON bookings(asset_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_time_range ON bookings USING gist (tstzrange(start_time, end_time));

-- =====================================================================
-- MAINTENANCE REQUESTS
-- =====================================================================
CREATE TABLE maintenance_requests (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id           UUID NOT NULL REFERENCES assets(id),
    raised_by          UUID REFERENCES users(id),
    issue_description  TEXT NOT NULL,
    priority           maintenance_priority NOT NULL DEFAULT 'medium',
    photo_url          TEXT,
    status             maintenance_status NOT NULL DEFAULT 'pending',
    approved_by        UUID REFERENCES users(id),
    technician_name    VARCHAR(150),
    resolved_at        TIMESTAMPTZ,
    resolution_notes   TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_asset ON maintenance_requests(asset_id);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status);
CREATE TRIGGER trg_maintenance_updated_at BEFORE UPDATE ON maintenance_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- AUDIT CYCLES + JUNCTION + ITEMS + DISCREPANCY REPORTS
-- =====================================================================
CREATE TABLE audit_cycles (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  VARCHAR(200) NOT NULL,
    scope_department_id   UUID REFERENCES departments(id),
    scope_location        VARCHAR(200),
    start_date            DATE NOT NULL,
    end_date              DATE NOT NULL,
    status                audit_cycle_status NOT NULL DEFAULT 'planned',
    created_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_audit_cycles_updated_at BEFORE UPDATE ON audit_cycles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE audit_cycle_auditors (
    audit_cycle_id  UUID NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
    auditor_id      UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (audit_cycle_id, auditor_id)
);

CREATE TABLE audit_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_cycle_id  UUID NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
    asset_id        UUID NOT NULL REFERENCES assets(id),
    result          audit_item_result NOT NULL DEFAULT 'pending',
    notes           TEXT,
    audited_by      UUID REFERENCES users(id),
    audited_at      TIMESTAMPTZ
);

CREATE INDEX idx_audit_items_cycle ON audit_items(audit_cycle_id);
CREATE INDEX idx_audit_items_asset ON audit_items(asset_id);

CREATE TABLE discrepancy_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_cycle_id  UUID NOT NULL REFERENCES audit_cycles(id),
    asset_id        UUID NOT NULL REFERENCES assets(id),
    issue_type      discrepancy_type NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved        BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_discrepancy_cycle ON discrepancy_reports(audit_cycle_id);

-- =====================================================================
-- NOTIFICATIONS
-- =====================================================================
CREATE TABLE notifications (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id),
    type                 notification_type NOT NULL,
    message              TEXT NOT NULL,
    is_read              BOOLEAN NOT NULL DEFAULT false,
    related_entity_type  VARCHAR(50),
    related_entity_id    UUID,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = false;

-- =====================================================================
-- ACTIVITY LOGS
-- =====================================================================
CREATE TABLE activity_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES users(id),
    action       VARCHAR(100) NOT NULL,        -- e.g. asset.allocated, maintenance.approved
    entity_type  VARCHAR(50),
    entity_id    UUID,
    metadata     JSONB DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- =====================================================================
-- SEED: the 4 chosen asset categories with category-specific custom_fields
-- These are field *definitions* (form schema). Per-asset values live in
-- assets.custom_field_values, keyed the same way.
-- =====================================================================
INSERT INTO asset_categories (name, custom_fields) VALUES
('Electronics', '{
    "brand":               {"type": "text",   "required": true},
    "model":                {"type": "text",   "required": false},
    "warranty_period_months": {"type": "number", "required": false},
    "warranty_expiry":      {"type": "date",   "required": false},
    "os_or_firmware_version": {"type": "text",  "required": false}
}'::jsonb),

('Furniture', '{
    "material":            {"type": "text",   "required": false},
    "dimensions":          {"type": "text",   "required": false},
    "warranty_period_months": {"type": "number", "required": false},
    "vendor":              {"type": "text",   "required": false}
}'::jsonb),

('Shared Spaces', '{
    "capacity":            {"type": "number", "required": true},
    "floor":               {"type": "text",   "required": false},
    "amenities":           {"type": "multi_select", "required": false, "options": ["projector", "whiteboard", "video_conferencing", "ac"]},
    "building_wing":       {"type": "text",   "required": false}
}'::jsonb),

('Vehicle', '{
    "registration_number": {"type": "text",   "required": true},
    "fuel_type":           {"type": "select", "required": false, "options": ["petrol", "diesel", "electric", "hybrid", "cng"]},
    "seating_capacity":    {"type": "number", "required": false},
    "odometer_km":         {"type": "number", "required": false},
    "insurance_expiry":    {"type": "date",   "required": false},
    "puc_expiry":          {"type": "date",   "required": false}
}'::jsonb);

-- Note: Shared Spaces rows in `assets` should almost always have is_bookable = true.
-- Electronics/Furniture/Vehicle *can* also be is_bookable = true (e.g. a pool car,
-- a projector cart) — the flag is independent of category by design.
