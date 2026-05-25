-- ============================================================================
-- 0134 : Table organization_amenity_icon_overrides
-- ----------------------------------------------------------------------------
-- Contexte : sprint UI/UX, les commodites (built-in + custom) ont desormais
-- une icone lucide-react par defaut. L'utilisateur peut personnaliser l'icone
-- via un picker (AmenityIconPicker). Le choix etait stocke en localStorage cote
-- frontend (cf. useAmenityIconOverrides) — incompatible cross-devices /
-- cross-users de la meme org.
--
-- Cette migration introduit une table par-organisation pour persister les
-- overrides cote backend. L'API expose alors un GET pour lire et PUT/DELETE
-- pour ecrire. Le frontend bascule en source de verite serveur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_amenity_icon_overrides (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amenity_code VARCHAR(80) NOT NULL,
    icon_name VARCHAR(80) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT amenity_icon_override_org_code_unique UNIQUE (organization_id, amenity_code)
);

CREATE INDEX IF NOT EXISTS idx_amenity_icon_overrides_org
    ON organization_amenity_icon_overrides (organization_id);

COMMENT ON TABLE organization_amenity_icon_overrides IS
    'Personnalisation par-organisation des icones lucide-react associees aux commodites (built-in + custom).';
COMMENT ON COLUMN organization_amenity_icon_overrides.amenity_code IS
    'Code Clenzy (WIFI, POOL, custom_amenities.code, etc.).';
COMMENT ON COLUMN organization_amenity_icon_overrides.icon_name IS
    'Nom du composant lucide-react (Wifi, Waves, ChefHat, etc.). Le frontend resout via ICON_REGISTRY.';
