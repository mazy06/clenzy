-- Booking engine — relance de panier abandonné MULTI-ÉTAPES (2.12).
-- reminder_count : nombre de relances déjà envoyées (0,1,2) → échelonnement 1h / 24h / 72h.
-- Défaut 0 = aucune relance envoyée (comportement préservé pour les lignes existantes).

ALTER TABLE abandoned_bookings ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;
