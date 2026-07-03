-- 0301 : Supplement IA mensuel par forfait (campagne X5, grille +9/+29/+79 EUR).
-- Colonnes nullables : NULL = defaut code (PricingConfigService, 900/2900/7900 cents).
ALTER TABLE pricing_configs ADD COLUMN IF NOT EXISTS ai_surcharge_essentiel_cents INTEGER;
ALTER TABLE pricing_configs ADD COLUMN IF NOT EXISTS ai_surcharge_confort_cents INTEGER;
ALTER TABLE pricing_configs ADD COLUMN IF NOT EXISTS ai_surcharge_premium_cents INTEGER;
