-- ============================================================================
-- 0198 : Toggles par livret (chatbot / livre d'or / activités)
-- ============================================================================
-- Permet à l'hôte d'activer/désactiver chaque fonctionnalité par livret.
-- Défaut TRUE = comportement actuel préservé pour les livrets existants.
-- ============================================================================

ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS chatbot_enabled    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS guestbook_enabled  BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS activities_enabled BOOLEAN NOT NULL DEFAULT TRUE;
