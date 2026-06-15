-- Acompte / paiement partiel cote booking engine (P0.7).
-- Politique d'acompte par moteur de reservation : % preleve a la reservation + delai du solde.
ALTER TABLE booking_engine_configs ADD COLUMN deposit_percent INTEGER;
ALTER TABLE booking_engine_configs ADD COLUMN balance_due_days INTEGER;

-- Suivi du paiement echelonne sur la reservation (acompte deja paye, solde du, echeance).
ALTER TABLE reservations ADD COLUMN amount_paid NUMERIC(10,2);
ALTER TABLE reservations ADD COLUMN amount_due NUMERIC(10,2);
ALTER TABLE reservations ADD COLUMN balance_due_date DATE;
