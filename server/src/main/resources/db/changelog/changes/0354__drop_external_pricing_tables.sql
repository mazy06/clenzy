-- Retrait des amorces « pricing externe / PriceLabs » (décision 2026-07-20,
-- roadmap market data : le RMS est natif, remplacé par une architecture
-- fournisseur-agnostique — voir docs/ROADMAP-MARKET-DATA-BAITLY.md).
--
-- On DROP UNIQUEMENT les deux tables de ces amorces. Les tables compta créées
-- dans les MÊMES changesets historiques (0120/0121) — quickbooks_connections,
-- xero_connections, sage_connections — NE SONT PAS touchées (hors périmètre).
--
-- La valeur historique rate_overrides.source = 'EXTERNAL_PRICING' subsiste
-- (colonne texte libre, aucune contrainte CHECK) : les overrides passés restent
-- protégés du yield par AdvancedRateManager (garde source-agnostique).
DROP TABLE IF EXISTS external_pricing_configs;
DROP TABLE IF EXISTS pricing_connections;
