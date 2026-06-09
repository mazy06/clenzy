-- Modèle de flux / répartition des paiements + base de commission sur le contrat de gestion (taxonomie OTA).
-- payment_model   : DIRECT (défaut = comportement Stripe historique) | OWNER_COLLECTS | CONCIERGE_COLLECTS | OTA_COHOST_SPLIT
-- commission_base : GROSS (défaut) | NET_OF_OTA_FEE (net des frais OTA, ex. host fee Airbnb)
-- Les contrats existants restent en DIRECT/GROSS (aucun changement de comportement).
ALTER TABLE management_contracts
    ADD COLUMN IF NOT EXISTS payment_model VARCHAR(30) NOT NULL DEFAULT 'DIRECT';

ALTER TABLE management_contracts
    ADD COLUMN IF NOT EXISTS commission_base VARCHAR(20) NOT NULL DEFAULT 'GROSS';
