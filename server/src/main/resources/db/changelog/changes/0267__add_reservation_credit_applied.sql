-- Crédit fidélité (2.8 phase 2b) : montant de crédit appliqué à une réservation au checkout
-- (réduit le montant facturé Stripe). Sert au clawback (re-crédit) en cas d'annulation. NULL = aucun.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS credit_applied NUMERIC(10,2);
