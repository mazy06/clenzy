-- ============================================================================
-- 0210 : Toggle d'affichage de la section "Services à la carte" du livret
-- ============================================================================
-- Comme les autres bascules de fonctionnalités du livret (chatbot_enabled,
-- guestbook_enabled, activities_enabled), `upsells_enabled` permet à l'hôte
-- d'afficher ou masquer la section des services payants dans SON livret.
-- Défaut sûr (true) pour l'existant : les livrets continuent d'afficher les
-- services s'il y en a. Idempotent (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS upsells_enabled BOOLEAN NOT NULL DEFAULT true;
