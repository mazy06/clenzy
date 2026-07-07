-- Seuils configurables par agent/module (B5) : JSON par module, ex.
-- {"occupancyLow":55,"marginLow":50,"priceDropPercent":12}. NULL = seuils par défaut
-- en dur (comportement historique). Lu par les scanners déterministes (BusinessAnalyticsScanner).
ALTER TABLE supervision_module_settings ADD COLUMN IF NOT EXISTS thresholds TEXT;
