-- Baitly : décisions concurrentes et identité de l'équipe ayant émis le devis.
ALTER TABLE service_requests ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE service_quotes ADD COLUMN provider_team_id BIGINT REFERENCES teams(id);

-- Ne pas déduire rétroactivement l'équipe : l'affectation peut avoir changé
-- depuis l'émission. Les devis historiques restent attribués à leur auteur.
