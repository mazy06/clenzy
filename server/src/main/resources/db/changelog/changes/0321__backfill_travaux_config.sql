-- 0321 : Backfill du catalogue « travaux » (maintenance) pour les configs dont
-- travaux_config est vide. L'ancien seed (0032) utilisait COALESCE et ne
-- remplissait donc PAS les tableaux vides '[]' (org créées avec une config vide).
-- Prix à 0 € (éditables). N'écrase JAMAIS une config déjà remplie.
UPDATE pricing_configs
SET travaux_config = '[{"interventionType":"PREVENTIVE_MAINTENANCE","basePrice":0.0,"enabled":true},{"interventionType":"EMERGENCY_REPAIR","basePrice":0.0,"enabled":true},{"interventionType":"ELECTRICAL_REPAIR","basePrice":0.0,"enabled":true},{"interventionType":"PLUMBING_REPAIR","basePrice":0.0,"enabled":true},{"interventionType":"HVAC_REPAIR","basePrice":0.0,"enabled":true},{"interventionType":"APPLIANCE_REPAIR","basePrice":0.0,"enabled":true}]'
WHERE travaux_config IS NULL OR btrim(travaux_config) = '' OR btrim(travaux_config) = '[]';
