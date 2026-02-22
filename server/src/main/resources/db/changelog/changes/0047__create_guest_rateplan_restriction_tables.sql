-- ============================================================================
-- V51 : Guests, Rate Plans, Rate Overrides, Rate Audit Log, Booking Restrictions
-- ============================================================================
-- G6 : Guest entity normalisee avec chiffrement PII (AES-256 applicatif)
-- G7 : Pricing dynamique avec plans tarifaires prioritaires
-- G8 : Restrictions de reservation (min_stay, max_stay, closed_to_arrival, etc.)
-- ============================================================================

-- ============================
-- 1. Table guests
-- ============================
-- PII (email, phone, first_name, last_name) chiffre AES-256 au niveau applicatif
-- via EncryptedFieldConverter. Les colonnes VARCHAR(500) pour stocker le ciphertext.
-- La deduplication par email est applicative (impossible en SQL car chiffre).

CREATE TABLE guests (
    id                BIGSERIAL PRIMARY KEY,
    organization_id   BIGINT NOT NULL REFERENCES organizations(id),
    email             VARCHAR(500),
    phone             VARCHAR(500),
    first_name        VARCHAR(500) NOT NULL,
    last_name         VARCHAR(500) NOT NULL,
    language          VARCHAR(5) DEFAULT 'fr',
    country_code      VARCHAR(2),
    channel_guest_id  VARCHAR(100),
    channel           VARCHAR(30),
    notes             TEXT,
    total_stays       INTEGER NOT NULL DEFAULT 0,
    total_spent       DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at        TIMESTAMP NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_guests_org ON guests(organization_id);
CREATE INDEX idx_guests_channel ON guests(channel, channel_guest_id)
    WHERE channel IS NOT NULL AND channel_guest_id IS NOT NULL;

-- ============================
-- 2. Lier guests aux reservations
-- ============================
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_id BIGINT REFERENCES guests(id);
CREATE INDEX idx_reservations_guest ON reservations(guest_id) WHERE guest_id IS NOT NULL;

-- ============================
-- 3. Table rate_plans
-- ============================
-- Pricing dynamique : chaque propriete peut avoir plusieurs plans tarifaires.
-- Resolution : override > PROMOTIONAL > SEASONAL > LAST_MINUTE > BASE > Property.nightlyPrice

CREATE TABLE rate_plans (
    id                BIGSERIAL PRIMARY KEY,
    organization_id   BIGINT NOT NULL REFERENCES organizations(id),
    property_id       BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    type              VARCHAR(30) NOT NULL
                      CHECK (type IN ('BASE','SEASONAL','PROMOTIONAL','LAST_MINUTE')),
    priority          INTEGER NOT NULL DEFAULT 0,
    nightly_price     DECIMAL(10,2) NOT NULL,
    currency          VARCHAR(3) NOT NULL DEFAULT 'EUR',
    start_date        DATE,
    end_date          DATE,
    days_of_week      INTEGER[],
    min_stay_override INTEGER,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_plans_property_type ON rate_plans(property_id, type, is_active);
CREATE INDEX idx_rate_plans_property_priority ON rate_plans(property_id, priority DESC);
CREATE INDEX idx_rate_plans_org ON rate_plans(organization_id);

-- ============================
-- 4. Table rate_overrides (prix specifique par date — priorite max)
-- ============================
CREATE TABLE rate_overrides (
    id                BIGSERIAL PRIMARY KEY,
    organization_id   BIGINT NOT NULL REFERENCES organizations(id),
    property_id       BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    date              DATE NOT NULL,
    nightly_price     DECIMAL(10,2) NOT NULL,
    source            VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
    created_by        VARCHAR(255),
    created_at        TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_rate_override_property_date UNIQUE (property_id, date)
);

CREATE INDEX idx_rate_overrides_property_date ON rate_overrides(property_id, date);

-- ============================
-- 5. Table rate_audit_log (historisation 2 ans — exigence certification)
-- ============================
CREATE TABLE rate_audit_log (
    id                BIGSERIAL PRIMARY KEY,
    organization_id   BIGINT NOT NULL REFERENCES organizations(id),
    property_id       BIGINT NOT NULL REFERENCES properties(id),
    date              DATE,
    rate_plan_id      BIGINT REFERENCES rate_plans(id) ON DELETE SET NULL,
    old_value         TEXT,
    new_value         TEXT,
    changed_by        VARCHAR(255),
    source            VARCHAR(50),
    changed_at        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_audit_property_date ON rate_audit_log(property_id, date, changed_at DESC);
CREATE INDEX idx_rate_audit_org ON rate_audit_log(organization_id);

-- ============================
-- 6. Table booking_restrictions
-- ============================
-- Restrictions par propriete et par plage de dates.
-- La restriction la plus prioritaire s'applique (priority DESC).
-- Si la table est vide pour une propriete, aucune restriction.

CREATE TABLE booking_restrictions (
    id                      BIGSERIAL PRIMARY KEY,
    organization_id         BIGINT NOT NULL REFERENCES organizations(id),
    property_id             BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,
    min_stay                INTEGER,
    max_stay                INTEGER,
    closed_to_arrival       BOOLEAN NOT NULL DEFAULT false,
    closed_to_departure     BOOLEAN NOT NULL DEFAULT false,
    gap_days                INTEGER NOT NULL DEFAULT 0,
    advance_notice_days     INTEGER,
    days_of_week            INTEGER[],
    priority                INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMP NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_restrictions_property_dates ON booking_restrictions(property_id, start_date, end_date);
CREATE INDEX idx_booking_restrictions_org ON booking_restrictions(organization_id);
