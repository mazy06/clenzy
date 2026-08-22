-- Encaissement de l'acompte, trace sur le devis.
--
-- L'acompte se devinait a la cle d'idempotence d'une transaction
-- (« INT-97-DEPOSIT-… ») : un detail d'implementation, invisible pour qui lit
-- la donnee, et qui interdisait de deduire l'acompte du solde.
ALTER TABLE service_quotes ADD COLUMN deposit_paid_at TIMESTAMP;
