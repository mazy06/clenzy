-- Baitly : rattachement d'une vente à la demande PMS existante.
-- Les ventes historiques restent à qualifier, sans déduire leur contenu du catalogue actuel.
ALTER TABLE upsell_orders ADD COLUMN fulfillment_service_code varchar(60);
ALTER TABLE upsell_orders ADD COLUMN service_request_id bigint REFERENCES service_requests(id);
ALTER TABLE upsell_orders ADD CONSTRAINT uq_baitly_upsell_service_request UNIQUE (service_request_id);
