-- Les Checkout Stripe dépassent 64 caractères. Conserver l'identifiant intégral pour l'idempotence.
ALTER TABLE ai_credit_grant ALTER COLUMN stripe_ref TYPE VARCHAR(255);

-- Aucune preuve n'est fabriquée pour les acomptes historiques déjà horodatés.
ALTER TABLE service_quotes ADD COLUMN deposit_transaction_ref VARCHAR(100);
CREATE UNIQUE INDEX uq_service_quote_deposit_transaction ON service_quotes(deposit_transaction_ref)
    WHERE deposit_transaction_ref IS NOT NULL;
