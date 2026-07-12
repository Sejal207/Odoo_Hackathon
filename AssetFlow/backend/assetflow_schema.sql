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
    password_hash   VARCHAR(255) NOT NULL,
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
