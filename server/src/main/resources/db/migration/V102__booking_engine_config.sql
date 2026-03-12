-- ============================================================
-- V102 : Booking Engine — config par organisation + flag property
-- ============================================================

CREATE TABLE booking_engine_configs (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL UNIQUE REFERENCES organizations(id),
    enabled         BOOLEAN NOT NULL DEFAULT false,
    api_key         VARCHAR(64) NOT NULL UNIQUE,

    -- Theming
    primary_color   VARCHAR(7) DEFAULT '#2563eb',
    accent_color    VARCHAR(7),
    logo_url        VARCHAR(500),
    font_family     VARCHAR(100),

    -- Comportement
    default_language VARCHAR(5) DEFAULT 'fr',
    default_currency VARCHAR(3) DEFAULT 'EUR',
    min_advance_days INTEGER DEFAULT 1,
    max_advance_days INTEGER DEFAULT 365,

    -- Politiques
    cancellation_policy TEXT,
    terms_url           VARCHAR(500),
    privacy_url         VARCHAR(500),

    -- Securite
    allowed_origins TEXT,

    -- Options
    collect_payment_on_booking BOOLEAN DEFAULT true,
    auto_confirm               BOOLEAN DEFAULT true,
    show_cleaning_fee          BOOLEAN DEFAULT true,
    show_tourist_tax           BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_bec_api_key ON booking_engine_configs(api_key);

-- Flag sur properties pour controler la visibilite dans le booking engine
ALTER TABLE properties ADD COLUMN booking_engine_visible BOOLEAN DEFAULT false;
