-- Le devis commercial conserve l'origine de sa discussion après création de la mission.
ALTER TABLE service_quotes ADD COLUMN marketplace_request_id BIGINT
    REFERENCES marketplace_quote_requests(id);
CREATE UNIQUE INDEX uq_service_quote_marketplace_request ON service_quotes (marketplace_request_id)
    WHERE marketplace_request_id IS NOT NULL;
