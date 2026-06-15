-- Booking engine 2.12 — segments Brevo pour les leads (exit-intent / panier abandonné).
-- leads_list_id      : liste Brevo cible des leads captés (segmentables ensuite via l'attribut SOURCE).
-- sync_leads_enabled : toggle de synchronisation (défaut TRUE = comportement actif par défaut).

ALTER TABLE marketing_integration ADD COLUMN IF NOT EXISTS leads_list_id BIGINT;
ALTER TABLE marketing_integration ADD COLUMN IF NOT EXISTS sync_leads_enabled BOOLEAN NOT NULL DEFAULT TRUE;
