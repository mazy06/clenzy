-- Moteur Ménage (Phase 1A) — configuration JSON du CleaningPricingEngine.
-- Minutes normées par composant × taux horaire org × multiplicateur type de ménage
-- → prix conseillé + fourchette. NULL = défauts Java (constantes du moteur),
-- même pattern que les autres colonnes de coefficients de pricing_configs.
ALTER TABLE pricing_configs
    ADD COLUMN IF NOT EXISTS cleaning_engine_config TEXT;

COMMENT ON COLUMN pricing_configs.cleaning_engine_config IS
    'Config JSON du moteur menage (hourlyRate, componentMinutes, multiplicateurs, fourchette). NULL = defauts Java';
