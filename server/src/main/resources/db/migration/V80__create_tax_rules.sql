-- V80: Create tax_rules table with seed data for FR/MA/SA
-- Configurable tax rules per country with effective date ranges

CREATE TABLE tax_rules (
    id              BIGSERIAL PRIMARY KEY,
    country_code    VARCHAR(3) NOT NULL,
    tax_category    VARCHAR(30) NOT NULL,
    tax_rate        DECIMAL(5,4) NOT NULL,
    tax_name        VARCHAR(50) NOT NULL,
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tax_rule_unique ON tax_rules(country_code, tax_category, effective_from);
CREATE INDEX idx_tax_rule_lookup ON tax_rules(country_code, tax_category);

-- Seed data: France
INSERT INTO tax_rules (country_code, tax_category, tax_rate, tax_name, effective_from, description) VALUES
('FR', 'ACCOMMODATION', 0.1000, 'TVA hebergement',   '2024-01-01', 'TVA taux reduit hebergement touristique'),
('FR', 'STANDARD',      0.2000, 'TVA standard',      '2024-01-01', 'TVA taux normal'),
('FR', 'FOOD',          0.0550, 'TVA alimentation',   '2024-01-01', 'TVA taux reduit alimentation'),
('FR', 'CLEANING',      0.2000, 'TVA nettoyage',      '2024-01-01', 'TVA taux normal services nettoyage'),
('FR', 'TOURIST_TAX',   0.0000, 'Taxe de sejour',     '2024-01-01', 'Taxe de sejour - montant fixe par commune');

-- Seed data: Morocco
INSERT INTO tax_rules (country_code, tax_category, tax_rate, tax_name, effective_from, description) VALUES
('MA', 'ACCOMMODATION', 0.1000, 'TVA hebergement',   '2024-01-01', 'TVA taux reduit hebergement'),
('MA', 'STANDARD',      0.2000, 'TVA standard',      '2024-01-01', 'TVA taux normal'),
('MA', 'FOOD',          0.0700, 'TVA alimentaire',    '2024-01-01', 'TVA taux reduit alimentaire'),
('MA', 'CLEANING',      0.2000, 'TVA nettoyage',      '2024-01-01', 'TVA taux normal services'),
('MA', 'TOURIST_TAX',   0.0000, 'Taxe promotion touristique', '2024-01-01', 'Taxe de promotion touristique');

-- Seed data: Saudi Arabia
INSERT INTO tax_rules (country_code, tax_category, tax_rate, tax_name, effective_from, description) VALUES
('SA', 'ACCOMMODATION', 0.1500, 'VAT',               '2024-01-01', 'Value Added Tax - standard rate'),
('SA', 'STANDARD',      0.1500, 'VAT',               '2024-01-01', 'Value Added Tax - standard rate'),
('SA', 'FOOD',          0.1500, 'VAT',               '2024-01-01', 'Value Added Tax - standard rate'),
('SA', 'CLEANING',      0.1500, 'VAT',               '2024-01-01', 'Value Added Tax - standard rate'),
('SA', 'TOURIST_TAX',   0.0500, 'Municipality fee',   '2024-01-01', 'Municipality fee on accommodation');
