-- Baitly : un besoin opérationnel partagé avec sa sollicitation commerciale.
ALTER TABLE service_requests ADD COLUMN marketplace_request_id bigint;
ALTER TABLE service_requests ADD CONSTRAINT fk_service_need_marketplace_request
    FOREIGN KEY (marketplace_request_id) REFERENCES marketplace_quote_requests(id);
CREATE UNIQUE INDEX uq_service_need_marketplace_request
    ON service_requests(marketplace_request_id) WHERE marketplace_request_id IS NOT NULL;

-- Reprise seulement quand l'origine est certaine, sans modifier aucun accord ou paiement.
UPDATE service_requests need SET marketplace_request_id=source.quote_id
FROM (
    SELECT mission.service_request_id AS need_id, min(quote.id) AS quote_id
    FROM interventions mission JOIN marketplace_quote_requests quote ON quote.intervention_id=mission.id
    WHERE mission.service_request_id IS NOT NULL
    GROUP BY mission.service_request_id HAVING count(*)=1
) source WHERE need.id=source.need_id AND need.marketplace_request_id IS NULL;
