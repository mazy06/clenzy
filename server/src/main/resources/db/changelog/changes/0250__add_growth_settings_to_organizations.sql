-- Booking engine — réglages de croissance org-level (CLZ Domaine 2), réellement appliqués.
-- lead_capture_enabled : gate l'endpoint public /leads (capture de leads).
-- abandoned_cart_recovery_enabled : gate le scheduler de relance de panier abandonné.
-- Défaut TRUE = comportement actuel préservé (les features tournaient sans condition).

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS lead_capture_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS abandoned_cart_recovery_enabled BOOLEAN NOT NULL DEFAULT TRUE;
