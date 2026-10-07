-- Conserve l'information explicite reçue du channel manager sans inventer une preuve historique.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS channel_payment_collect VARCHAR(20);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS channel_payment_observed_at TIMESTAMP;
COMMENT ON COLUMN reservations.channel_payment_collect IS
    'Channex payment_collect: ota/property; NULL = aucune information vérifiable conservée';
COMMENT ON COLUMN reservations.channel_payment_observed_at IS
    'Date de réception dans Baitly, pas la date du paiement ni du versement bancaire';
