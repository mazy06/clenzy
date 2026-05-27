-- ============================================================================
-- 0152 : Table promo_codes pour la gestion des codes promo / cooptation
-- ----------------------------------------------------------------------------
-- Contexte : la migration 0151 a ajoute un champ `promo_code` sur
-- pending_inscriptions et users pour collecter le code saisi. Cette table
-- centralise les codes valides, leur reduction, leur duree de validite et leur
-- compteur d'usage.
--
-- Type supporte au lancement : PERCENTAGE uniquement (la plus simple a
-- communiquer cote marketing : "-30% le premier mois"). L'extension a FIXED
-- (reduction en centimes) ou MONTHS_FREE viendra dans une migration ulterieure.
--
-- Anti-race condition : la colonne `used_count` est incrementee via un UPDATE
-- atomique conditionnel (`WHERE used_count < max_uses`) dans le service. Pas
-- besoin de verrou explicite.
-- ============================================================================

CREATE TABLE IF NOT EXISTS promo_codes (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(50) NOT NULL UNIQUE,
    discount_type   VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE',
    -- Pour PERCENTAGE : entier 1-100 (ex: 30 = -30%)
    -- Pour FIXED      : montant en centimes (ex: 500 = -5 EUR) [non implemente]
    discount_value  INTEGER NOT NULL CHECK (discount_value > 0),
    max_uses        INTEGER NULL,        -- NULL = illimite
    used_count      INTEGER NOT NULL DEFAULT 0,
    valid_from      TIMESTAMP NULL,
    valid_until     TIMESTAMP NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    description     VARCHAR(255) NULL,    -- contexte interne (ex: "campagne Q3 2026")
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(255) NULL,    -- keycloakId de l'admin qui a cree

    CONSTRAINT chk_promo_codes_discount_type
        CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
    CONSTRAINT chk_promo_codes_percentage_range
        CHECK (discount_type <> 'PERCENTAGE' OR discount_value BETWEEN 1 AND 100),
    CONSTRAINT chk_promo_codes_used_count_positive
        CHECK (used_count >= 0)
);

-- Index pour lookup rapide par code (CASE INSENSITIVE — on stocke en UPPER)
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_code_upper
    ON promo_codes (UPPER(code));

-- Index pour les rapports admin (codes actifs filtres par date)
CREATE INDEX IF NOT EXISTS idx_promo_codes_active
    ON promo_codes (active, valid_until)
    WHERE active = TRUE;

COMMENT ON TABLE promo_codes IS
    'Codes promo / cooptation valides a l''inscription. Lookup case-insensitive via UPPER(code).';
COMMENT ON COLUMN promo_codes.discount_value IS
    'Pour PERCENTAGE : entier 1-100. Pour FIXED : montant en centimes.';
COMMENT ON COLUMN promo_codes.max_uses IS
    'Nombre maximum d''utilisations. NULL = illimite.';
COMMENT ON COLUMN promo_codes.used_count IS
    'Compteur incrémenté atomiquement par PromoCodeService.tryConsume().';
