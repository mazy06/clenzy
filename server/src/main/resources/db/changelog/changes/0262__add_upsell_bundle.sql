-- Upsells (2.10) : bundles — offre groupée à prix combiné référençant d'autres offres (CSV d'ids).
-- Non vide = l'offre est un bundle ; vide/NULL = offre simple.

ALTER TABLE upsell_offers ADD COLUMN IF NOT EXISTS bundle_offer_ids VARCHAR(500);
