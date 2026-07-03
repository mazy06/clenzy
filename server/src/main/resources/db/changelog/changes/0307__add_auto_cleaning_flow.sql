-- 0307 : Flux deterministes vague 2 (campagne Baitly, fiche 08) — menage auto post-checkout.
-- service_requests.auto_flow_key : cle d'idempotence metier (propriete x dates de sejour)
-- des demandes creees automatiquement par le moteur AutomationRule (action
-- CREATE_CLEANING_REQUEST). Index UNIQUE (les NULL multiples sont permis en Postgres) :
-- filet en base sous l'idempotence generique AutomationExecution du moteur — une
-- re-livraison Kafka ou un double evenement BOOKED ne cree qu'UNE demande.
-- L'opt-in par organisation = l'existence d'une AutomationRule active (pas de colonne dediee).
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS auto_flow_key VARCHAR(120);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_requests_auto_flow_key ON service_requests (auto_flow_key);
