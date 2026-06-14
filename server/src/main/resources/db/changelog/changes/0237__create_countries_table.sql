-- Socle multi-pays (CLZ-P0-01) : referentiel des pays supportes par la plateforme.
-- Config globale (non org-scopee). Cle de resolution = country_code (ISO 3166-1 alpha-2).
-- Rollout progressif via la colonne enabled (FR active ; MA/SA inactifs au depart).

CREATE TABLE IF NOT EXISTS countries (
    id                          BIGSERIAL PRIMARY KEY,
    country_code                VARCHAR(2)  NOT NULL UNIQUE,
    name                        VARCHAR(100) NOT NULL,
    default_currency            VARCHAR(3)  NOT NULL,
    default_locale              VARCHAR(5)  NOT NULL DEFAULT 'fr-FR',
    timezone                    VARCHAR(64) NOT NULL DEFAULT 'Europe/Paris',
    weekend_days                VARCHAR(32) NOT NULL DEFAULT 'SATURDAY,SUNDAY',
    rtl                         BOOLEAN     NOT NULL DEFAULT FALSE,
    vat_registered              BOOLEAN     NOT NULL DEFAULT TRUE,
    einvoicing_provider         VARCHAR(40),
    guest_registration_provider VARCHAR(40),
    enabled                     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMP   NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMP   NOT NULL DEFAULT now()
);

-- Seed des 3 pays cibles. Idempotent (re-run safe).
-- FR : active (non-regression). MA / SA : prets mais inactifs (rollout pilote par enabled + flag multi-country).
INSERT INTO countries
    (country_code, name, default_currency, default_locale, timezone, weekend_days, rtl, vat_registered, einvoicing_provider, guest_registration_provider, enabled)
VALUES
    ('FR', 'France',          'EUR', 'fr-FR', 'Europe/Paris',      'SATURDAY,SUNDAY',  FALSE, TRUE, 'factur_x', 'police_fr',   TRUE),
    ('MA', 'Maroc',           'MAD', 'fr-MA', 'Africa/Casablanca', 'SATURDAY,SUNDAY',  FALSE, TRUE, 'dgi_ma',   'dgsn_ma',     FALSE),
    ('SA', 'Arabie Saoudite', 'SAR', 'ar-SA', 'Asia/Riyadh',       'FRIDAY,SATURDAY',  TRUE,  TRUE, 'zatca',    'shomoos_ksa', FALSE)
ON CONFLICT (country_code) DO NOTHING;
