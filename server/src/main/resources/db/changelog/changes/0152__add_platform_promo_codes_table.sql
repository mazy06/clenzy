-- ============================================================================
-- 0152 : Table platform_promo_codes pour les codes promo / cooptation a
--        l'inscription Clenzy (plate-forme).
-- ----------------------------------------------------------------------------
-- Distinction importante : la table `promo_codes` existe deja et est utilisee
-- par le booking engine pour des codes org-scopes appliques aux reservations
-- directes (guests). Cette nouvelle table `platform_promo_codes` est dediee
-- aux codes globaux Clenzy plate-forme (inscription PMS), sans organization_id
-- (un code peut etre utilise par n'importe quel nouvel inscrit).
--
-- Contexte : la migration 0151 a ajoute un champ `promo_code` sur
-- pending_inscriptions et users pour collecter le code saisi. Cette table
-- centralise les codes valides, leur reduction, leur duree de validite et leur
-- compteur d'usage.
--
-- Type supporte au lancement : PERCENTAGE (entier 1-100) ou FIXED (montant
-- centimes). Le service applique le coupon Stripe Duration.ONCE.
--
-- Anti-race condition : la colonne `used_count` est incrementee via un UPDATE
-- atomique conditionnel (`WHERE used_count < max_uses`) dans le service. Pas
-- besoin de verrou explicite.
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_promo_codes (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(50) NOT NULL UNIQUE,
    discount_type   VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE',
    -- Pour PERCENTAGE : entier 1-100 (ex: 30 = -30%)
    -- Pour FIXED      : montant en centimes (ex: 500 = -5 EUR)
    discount_value  INTEGER NOT NULL CHECK (discount_value > 0),
    max_uses        INTEGER NULL,        -- NULL = illimite
    used_count      INTEGER NOT NULL DEFAULT 0,
    valid_from      TIMESTAMP NULL,
    valid_until     TIMESTAMP NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    description     VARCHAR(255) NULL,    -- contexte interne (ex: "campagne Q3 2026")
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(255) NULL,    -- keycloakId de l'admin qui a cree

    CONSTRAINT chk_platform_promo_codes_discount_type
        CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
    CONSTRAINT chk_platform_promo_codes_percentage_range
        CHECK (discount_type <> 'PERCENTAGE' OR discount_value BETWEEN 1 AND 100),
    CONSTRAINT chk_platform_promo_codes_used_count_positive
        CHECK (used_count >= 0)
);

-- Index pour lookup rapide par code (CASE INSENSITIVE — on stocke en UPPER)
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_promo_codes_code_upper
    ON platform_promo_codes (UPPER(code));

-- Index pour les rapports admin (codes actifs filtres par date)
CREATE INDEX IF NOT EXISTS idx_platform_promo_codes_active
    ON platform_promo_codes (active, valid_until)
    WHERE active = TRUE;

COMMENT ON TABLE platform_promo_codes IS
    'Codes promo / cooptation valides a l''inscription Clenzy plate-forme (codes globaux, non org-scopes). Distinct de promo_codes qui est utilise par le booking engine.';
COMMENT ON COLUMN platform_promo_codes.discount_value IS
    'Pour PERCENTAGE : entier 1-100. Pour FIXED : montant en centimes.';
COMMENT ON COLUMN platform_promo_codes.max_uses IS
    'Nombre maximum d''utilisations. NULL = illimite.';
COMMENT ON COLUMN platform_promo_codes.used_count IS
    'Compteur incrémenté atomiquement par PlatformPromoCodeService.tryConsume().';
