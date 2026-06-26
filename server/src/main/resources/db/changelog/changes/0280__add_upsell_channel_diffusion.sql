-- Diffusion par canal des services additionnels (upsells) : livret numérique et/ou booking engine.
-- Défaut TRUE (rétro-compatibilité : les offres existantes restent diffusées sur les deux canaux).
-- Idempotent (IF NOT EXISTS).
ALTER TABLE upsell_offers ADD COLUMN IF NOT EXISTS diffuse_on_livret BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE upsell_offers ADD COLUMN IF NOT EXISTS diffuse_on_booking BOOLEAN NOT NULL DEFAULT TRUE;
