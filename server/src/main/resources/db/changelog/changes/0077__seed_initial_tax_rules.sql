-- ============================================================================
-- 0077 : Seed initial tax rules for FR, MA, SA
-- ============================================================================
-- Les tables tax_rules sont creees par Hibernate auto-DDL mais jamais peuplees.
-- Cette migration s'assure que la table existe, ajoute une contrainte unique
-- pour l'idempotence, puis insere les taux de TVA/VAT par pays et categorie.
-- Taux stockes en fraction decimale (0.1000 = 10%).

-- 1. Creer la table si Hibernate ne l'a pas encore fait
CREATE TABLE IF NOT EXISTS tax_rules (
    id          BIGSERIAL PRIMARY KEY,
    country_code VARCHAR(3)     NOT NULL,
    tax_category VARCHAR(30)    NOT NULL,
    tax_rate     NUMERIC(5, 4)  NOT NULL,
    tax_name     VARCHAR(50)    NOT NULL,
    effective_from DATE         NOT NULL,
    effective_to   DATE,
    description  TEXT,
    created_at   TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- 2. Index de lookup
CREATE INDEX IF NOT EXISTS idx_tax_rule_lookup
    ON tax_rules (country_code, tax_category);

-- 3. S'assurer que created_at a un DEFAULT (Hibernate peut creer la colonne sans)
ALTER TABLE tax_rules ALTER COLUMN created_at SET DEFAULT NOW();

-- 4. Contrainte unique pour ON CONFLICT DO NOTHING
ALTER TABLE tax_rules
    DROP CONSTRAINT IF EXISTS uq_tax_rule_country_category_from;
ALTER TABLE tax_rules
    ADD CONSTRAINT uq_tax_rule_country_category_from
    UNIQUE (country_code, tax_category, effective_from);

-- ─── France (FR) ────────────────────────────────────────────────────────────
INSERT INTO tax_rules (country_code, tax_category, tax_rate, tax_name, effective_from, effective_to, description, created_at)
VALUES
    ('FR', 'ACCOMMODATION', 0.1000, 'TVA hebergement',  '2024-01-01', NULL, 'TVA taux reduit hebergement touristique 10%', NOW()),
    ('FR', 'STANDARD',      0.2000, 'TVA taux normal',  '2024-01-01', NULL, 'TVA taux normal 20%', NOW()),
    ('FR', 'CLEANING',      0.2000, 'TVA menage',       '2024-01-01', NULL, 'TVA taux normal pour services de nettoyage 20%', NOW()),
    ('FR', 'FOOD',          0.0550, 'TVA restauration',  '2024-01-01', NULL, 'TVA taux reduit restauration 5.5%', NOW())
ON CONFLICT (country_code, tax_category, effective_from) DO NOTHING;

-- ─── Maroc (MA) ─────────────────────────────────────────────────────────────
INSERT INTO tax_rules (country_code, tax_category, tax_rate, tax_name, effective_from, effective_to, description, created_at)
VALUES
    ('MA', 'ACCOMMODATION', 0.1000, 'TVA hebergement',  '2024-01-01', NULL, 'TVA taux reduit hebergement touristique 10%', NOW()),
    ('MA', 'STANDARD',      0.2000, 'TVA taux normal',  '2024-01-01', NULL, 'TVA taux normal 20%', NOW()),
    ('MA', 'CLEANING',      0.2000, 'TVA menage',       '2024-01-01', NULL, 'TVA taux normal pour services de nettoyage 20%', NOW()),
    ('MA', 'FOOD',          0.0700, 'TVA restauration',  '2024-01-01', NULL, 'TVA taux reduit restauration 7%', NOW())
ON CONFLICT (country_code, tax_category, effective_from) DO NOTHING;

-- ─── Arabie Saoudite (SA) ───────────────────────────────────────────────────
INSERT INTO tax_rules (country_code, tax_category, tax_rate, tax_name, effective_from, effective_to, description, created_at)
VALUES
    ('SA', 'ACCOMMODATION', 0.1500, 'VAT', '2024-01-01', NULL, 'VAT uniforme 15%', NOW()),
    ('SA', 'STANDARD',      0.1500, 'VAT', '2024-01-01', NULL, 'VAT uniforme 15%', NOW()),
    ('SA', 'CLEANING',      0.1500, 'VAT', '2024-01-01', NULL, 'VAT uniforme 15%', NOW()),
    ('SA', 'FOOD',          0.1500, 'VAT', '2024-01-01', NULL, 'VAT uniforme 15%', NOW())
ON CONFLICT (country_code, tax_category, effective_from) DO NOTHING;
