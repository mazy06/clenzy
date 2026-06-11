-- Z3-SEC-04 : le retour PayPal (/api/payments/paypal/return, endpoint public)
-- resolvait la transaction par findAll() en memoire (full table scan cross-tenant
-- a chaque appel). La resolution passe desormais par une derived query
-- findByProviderTxId : cet index la rend O(log n) et supprime le vecteur de DoS.
-- provider_tx_id porte l'order_id PayPal puis le capture_id apres capture ;
-- pas d'unicite imposee (colonne nullable, historique heterogene multi-providers).
CREATE INDEX IF NOT EXISTS idx_payment_tx_provider_tx_id
    ON payment_transactions (provider_tx_id);
