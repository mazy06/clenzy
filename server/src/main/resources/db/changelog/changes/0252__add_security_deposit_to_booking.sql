-- Caution / depot de garantie cote booking engine (P0.3).
-- Montant de caution par moteur de reservation (NULL/0 = pas de caution).
ALTER TABLE booking_engine_configs ADD COLUMN security_deposit_amount NUMERIC(12,2);

-- Carte enregistree (Stripe customer + payment_method) sur la reservation : permet de poser
-- le hold de caution off-session apres le paiement du sejour, et de reutiliser la carte.
ALTER TABLE reservations ADD COLUMN stripe_customer_id VARCHAR(255);
ALTER TABLE reservations ADD COLUMN stripe_payment_method_id VARCHAR(255);
