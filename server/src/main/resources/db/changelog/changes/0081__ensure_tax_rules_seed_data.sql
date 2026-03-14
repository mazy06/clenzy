-- ============================================================================
-- 0081 : Re-ensure tax rules seed data for FR, MA, SA
-- ============================================================================
-- Idempotent: ON CONFLICT DO NOTHING.
-- Necessaire car le changeset 0077 peut avoir ete marque comme execute
-- sans que les donnees soient reellement presentes en production.

-- ─── France (FR) ────────────────────────────────────────────────────────────
INSERT INTO tax_rules (country_code, tax_category, tax_rate, tax_name, effective_from, effective_to, description, created_at)
VALUES
    ('FR', 'ACCOMMODATION', 0.1000, 'TVA hebergement',  '2024-01-01', NULL, 'TVA taux reduit hebergement touristique 10%', NOW()),
    ('FR', 'STANDARD',      0.2000, 'TVA taux normal',  '2024-01-01', NULL, 'TVA taux normal 20%', NOW()),
    ('FR', 'CLEANING',      0.2000, 'TVA menage',       '2024-01-01', NULL, 'TVA taux normal pour services de nettoyage 20%', NOW()),
    ('FR', 'FOOD',          0.0550, 'TVA restauration',  '2024-01-01', NULL, 'TVA taux reduit restauration 5.5%', NOW()),
    ('FR', 'TOURIST_TAX',   0.0000, 'Taxe de sejour',    '2024-01-01', NULL, 'Taxe de sejour - montant fixe par commune', NOW())
ON CONFLICT (country_code, tax_category, effective_from) DO NOTHING;

-- ─── Maroc (MA) ─────────────────────────────────────────────────────────────
INSERT INTO tax_rules (country_code, tax_category, tax_rate, tax_name, effective_from, effective_to, description, created_at)
VALUES
    ('MA', 'ACCOMMODATION', 0.1000, 'TVA hebergement',            '2024-01-01', NULL, 'TVA taux reduit hebergement 10%', NOW()),
    ('MA', 'STANDARD',      0.2000, 'TVA standard',               '2024-01-01', NULL, 'TVA taux normal 20%', NOW()),
    ('MA', 'FOOD',          0.0700, 'TVA alimentaire',             '2024-01-01', NULL, 'TVA taux reduit alimentaire 7%', NOW()),
    ('MA', 'CLEANING',      0.2000, 'TVA nettoyage',               '2024-01-01', NULL, 'TVA taux normal services 20%', NOW()),
    ('MA', 'TOURIST_TAX',   0.0000, 'Taxe promotion touristique', '2024-01-01', NULL, 'Taxe de promotion touristique', NOW())
ON CONFLICT (country_code, tax_category, effective_from) DO NOTHING;

-- ─── Arabie Saoudite (SA) ───────────────────────────────────────────────────
INSERT INTO tax_rules (country_code, tax_category, tax_rate, tax_name, effective_from, effective_to, description, created_at)
VALUES
    ('SA', 'ACCOMMODATION', 0.1500, 'VAT',              '2024-01-01', NULL, 'Value Added Tax - standard rate 15%', NOW()),
    ('SA', 'STANDARD',      0.1500, 'VAT',              '2024-01-01', NULL, 'Value Added Tax - standard rate 15%', NOW()),
    ('SA', 'FOOD',          0.1500, 'VAT',              '2024-01-01', NULL, 'Value Added Tax - standard rate 15%', NOW()),
    ('SA', 'CLEANING',      0.1500, 'VAT',              '2024-01-01', NULL, 'Value Added Tax - standard rate 15%', NOW()),
    ('SA', 'TOURIST_TAX',   0.0500, 'Municipality fee', '2024-01-01', NULL, 'Municipality fee on accommodation 5%', NOW())
ON CONFLICT (country_code, tax_category, effective_from) DO NOTHING;
