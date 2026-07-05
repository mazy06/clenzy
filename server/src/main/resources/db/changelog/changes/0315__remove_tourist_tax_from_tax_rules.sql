-- ============================================================================
-- 0315 : Retrait des lignes TOURIST_TAX de tax_rules (consolidation fiscale)
-- ============================================================================
-- La taxe de sejour est desormais geree par un SEUL systeme : tourist_tax_configs
-- (bareme par bien/commune, org-scope, modes fixe/pourcentage/plafond, surtaxes,
-- exoneration mineurs) — surface dans Reglages > Fiscal.
--
-- Les lignes TOURIST_TAX de tax_rules etaient un placeholder COSMETIQUE :
--   - un TaxRule ne porte qu'un taux %, incapable d'exprimer un montant fixe par
--     commune (FR/MA affichaient 0 %) ;
--   - AUCUN calculateur fiscal (France/Maroc/Arabie Saoudite) ne lisait ces lignes
--     (le taux saoudien est code dans SaudiTaxCalculator, pas dans une TaxRule).
-- On les retire pour supprimer la ligne trompeuse de l'ecran « Regles fiscales »
-- (qui reste dedie a la TVA). Aucune incidence sur le calcul (rien ne les lisait).
-- ============================================================================

DELETE FROM tax_rules WHERE tax_category = 'TOURIST_TAX';
