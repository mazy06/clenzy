-- Baitly : historique d'annulation, sans réécriture du devis accepté.
-- Tables vérifiées : ServiceQuote @Table(service_quotes), Intervention @Table(interventions).
CREATE TABLE service_quote_cancellations (
    quote_id BIGINT PRIMARY KEY REFERENCES service_quotes(id),
    organization_id BIGINT NOT NULL,
    intervention_id BIGINT NOT NULL REFERENCES interventions(id),
    actor_subject VARCHAR(120) NOT NULL,
    reason VARCHAR(1000) NOT NULL CHECK (length(trim(reason)) > 0),
    cancelled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    agreed_amount NUMERIC(19,2) NOT NULL,
    currency VARCHAR(8) NOT NULL
);
CREATE INDEX idx_quote_cancellations_organization ON service_quote_cancellations(organization_id, cancelled_at);

