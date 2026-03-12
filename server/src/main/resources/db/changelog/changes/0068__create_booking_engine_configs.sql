-- 0068 : Booking Engine — config par organisation + flag property
-- Cree la table booking_engine_configs et ajoute booking_engine_visible sur properties.
-- Utilise IF NOT EXISTS car la table peut deja exister (migration manuelle precedente).

CREATE TABLE IF NOT EXISTS booking_engine_configs (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
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

CREATE INDEX IF NOT EXISTS idx_bec_api_key ON booking_engine_configs(api_key);

-- Flag sur properties pour controler la visibilite dans le booking engine
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'properties' AND column_name = 'booking_engine_visible'
    ) THEN
        ALTER TABLE properties ADD COLUMN booking_engine_visible BOOLEAN DEFAULT false;
    END IF;
END$$;
