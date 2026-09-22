-- Baitly : suspension des nouvelles inscriptions et date publique de lancement.
-- La réouverture reste une action explicite, indépendante du décompte.
ALTER TABLE platform_settings
    ADD COLUMN registrations_paused BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN launch_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN launch_time_zone VARCHAR(255) NOT NULL DEFAULT 'Europe/Paris';
