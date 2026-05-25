-- ============================================================================
-- 0136 : Ajout de theme_mode sur user_preferences
-- ----------------------------------------------------------------------------
-- Contexte : audit localStorage, le theme (light/dark/auto) etait persiste
-- en localStorage cote frontend uniquement (`clenzy_theme_mode`). Ajout d'une
-- colonne dans user_preferences pour la portabilite cross-devices.
--
-- Le frontend conserve localStorage comme cache anti-FOUC (lecture synchrone
-- au boot avant que React monte), mais le backend est source de verite.
-- Au login, le theme serveur ecrase la valeur locale.
--
-- Valeurs autorisees : 'light' | 'dark' | 'auto' (defaut). La contrainte
-- CHECK est volontairement permissive (string libre) pour pouvoir ajouter
-- de nouveaux themes (ex: 'high-contrast') sans nouvelle migration.
-- ============================================================================

ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS theme_mode VARCHAR(20) NOT NULL DEFAULT 'auto';

COMMENT ON COLUMN user_preferences.theme_mode IS
    'Mode d''affichage UI : light | dark | auto (suit prefers-color-scheme).';
