-- Une référence Checkout peut dépasser 128 caractères ; préserver sa valeur et son préfixe d'audit.
ALTER TABLE ai_usage_ledger ALTER COLUMN idempotency_key TYPE VARCHAR(288);
