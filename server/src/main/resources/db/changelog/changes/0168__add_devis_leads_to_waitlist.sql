-- Toggle plateforme : verser automatiquement les demandes de devis (landing)
-- dans la waitlist de lancement, tant que le PMS n'est pas public.
-- Activé par défaut ; les SUPER_ADMIN / SUPER_MANAGER le désactivent au lancement.
ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS add_devis_leads_to_waitlist BOOLEAN NOT NULL DEFAULT TRUE;
