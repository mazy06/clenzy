-- ============================================================================
-- 0128 : Tables de gestion des commodites OTA
-- ----------------------------------------------------------------------------
-- Contexte : lors de l'import depuis un OTA (Channex/Airbnb), on detecte des
-- amenities qui ne matchent pas le referentiel statique Clenzy (WIFI, TV,
-- AIR_CONDITIONING, etc.). Le champ properties.ota_raw_amenities (migration
-- 0127) stocke ces noms bruts en attente de mapping.
--
-- Cette migration introduit 3 tables pour gerer le mapping et l'extension du
-- referentiel par l'admin :
--
--   1. custom_amenities : nouvelles commodites definies au niveau org
--      (au-dela du referentiel statique cote frontend AMENITIES_CATEGORIES)
--   2. amenity_aliases : mapping nom_brut_OTA → code_clenzy (built-in OU custom)
--   3. ignored_amenities : noms bruts marques "ne pas mapper" (nettoie l'UI)
--
-- Toutes les tables sont multi-tenant (organization_id NOT NULL).
-- ============================================================================

-- ─── 1. custom_amenities ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_amenities (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(80) NOT NULL,
    label_fr VARCHAR(120) NOT NULL,
    label_en VARCHAR(120),
    category VARCHAR(40) NOT NULL DEFAULT 'custom',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT custom_amenities_org_code_unique UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_custom_amenities_org
    ON custom_amenities (organization_id);

COMMENT ON TABLE custom_amenities IS
    'Commodites supplementaires definies par une organisation (extension du referentiel Clenzy statique).';
COMMENT ON COLUMN custom_amenities.code IS
    'Code unique au format SCREAMING_SNAKE_CASE (ex: SMOKE_ALARM). Utilise dans properties.amenities.';
COMMENT ON COLUMN custom_amenities.category IS
    'Categorie : comfort | kitchen | appliances | outdoor | safetyFamily | custom (defaut).';

-- ─── 2. amenity_aliases ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amenity_aliases (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    raw_ota_name VARCHAR(200) NOT NULL,
    clenzy_code VARCHAR(80) NOT NULL,
    ota_source VARCHAR(40),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT amenity_aliases_org_raw_unique UNIQUE (organization_id, raw_ota_name)
);

CREATE INDEX IF NOT EXISTS idx_amenity_aliases_org
    ON amenity_aliases (organization_id);
CREATE INDEX IF NOT EXISTS idx_amenity_aliases_org_raw
    ON amenity_aliases (organization_id, LOWER(raw_ota_name));

COMMENT ON TABLE amenity_aliases IS
    'Mapping entre noms d''amenities OTA bruts (Airbnb/Booking/...) et codes Clenzy (built-in ou custom).';
COMMENT ON COLUMN amenity_aliases.raw_ota_name IS
    'Nom exact tel que renvoye par l''OTA (ex: "Smoke alarm").';
COMMENT ON COLUMN amenity_aliases.clenzy_code IS
    'Code Clenzy cible : soit un built-in (WIFI, TV, ...) soit un custom_amenities.code.';
COMMENT ON COLUMN amenity_aliases.ota_source IS
    'Source du nom brut : "AirBNB", "BookingCom", "VrboCom", ... ou NULL si inconnu.';

-- ─── 3. ignored_amenities ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ignored_amenities (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    raw_ota_name VARCHAR(200) NOT NULL,
    ota_source VARCHAR(40),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ignored_amenities_org_raw_unique UNIQUE (organization_id, raw_ota_name)
);

CREATE INDEX IF NOT EXISTS idx_ignored_amenities_org
    ON ignored_amenities (organization_id);

COMMENT ON TABLE ignored_amenities IS
    'Noms d''amenities OTA bruts explicitement ignores (ne plus apparaitre dans la liste a mapper).';
