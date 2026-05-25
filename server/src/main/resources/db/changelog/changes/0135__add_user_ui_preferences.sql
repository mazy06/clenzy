-- ============================================================================
-- 0135 : Table user_ui_preferences (key-value JSONB par utilisateur)
-- ----------------------------------------------------------------------------
-- Contexte : audit localStorage. Plusieurs hooks frontend (usePlanningFilters,
-- usePlanningNavigation, useResizablePropertyColWidth, etc.) persistent des
-- preferences UI dans localStorage avec une cle scopee par sub Keycloak.
-- Probleme : ces preferences ne traversent pas les devices ni les navigateurs
-- de l'utilisateur, et sont perdues au clear du storage.
--
-- Cette migration introduit une table generique key-value (JSONB) par
-- utilisateur. Le scope est `keycloak_id` (et non `user_id`) pour decoupler
-- la persistance des preferences UI des entites users metier (un user peut
-- avoir des prefs UI avant d'avoir une entite users.id, ex. SSO first-login).
--
-- Differences avec `user_preferences` :
--  - `user_preferences` : schema fige (timezone, currency, language, notify_*).
--  - `user_ui_preferences` : key-value libre, dedie aux preferences UI
--    (filtres planning, zoom, density, largeur de colonnes, etc.).
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_ui_preferences (
    id BIGSERIAL PRIMARY KEY,
    keycloak_id VARCHAR(255) NOT NULL,
    pref_key VARCHAR(120) NOT NULL,
    pref_value JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_ui_pref_keycloak_key_unique UNIQUE (keycloak_id, pref_key)
);

CREATE INDEX IF NOT EXISTS idx_user_ui_pref_keycloak
    ON user_ui_preferences (keycloak_id);

COMMENT ON TABLE user_ui_preferences IS
    'Preferences UI generiques par utilisateur (key-value JSONB). Remplace localStorage pour les hooks frontend partage cross-devices.';
COMMENT ON COLUMN user_ui_preferences.pref_key IS
    'Cle dot-notation (ex: planning.filters, planning.nav, planning.propertyColWidth). Max 120 chars.';
COMMENT ON COLUMN user_ui_preferences.pref_value IS
    'Valeur JSON arbitraire. Le frontend valide / shape via TypeScript.';
