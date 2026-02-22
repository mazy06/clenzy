-- =============================================================================
-- V36: Seed default values into pricing_configs JSON columns + add catalog cols
-- =============================================================================
-- This migration:
-- 1. Adds 2 new columns for forfait catalogs (available_prestations, available_surcharges)
-- 2. Seeds all JSON columns with default values so the code no longer needs hardcoded defaults

-- ─── Add catalog columns for forfaits ────────────────────────────────────────
ALTER TABLE pricing_configs ADD COLUMN available_prestations TEXT;
ALTER TABLE pricing_configs ADD COLUMN available_surcharges TEXT;

-- ─── Seed default data into NULL columns ─────────────────────────────────────
UPDATE pricing_configs SET
  travaux_config = COALESCE(travaux_config,
    '[{"interventionType":"PREVENTIVE_MAINTENANCE","basePrice":0.0,"enabled":true},{"interventionType":"EMERGENCY_REPAIR","basePrice":0.0,"enabled":true},{"interventionType":"ELECTRICAL_REPAIR","basePrice":0.0,"enabled":true},{"interventionType":"PLUMBING_REPAIR","basePrice":0.0,"enabled":true},{"interventionType":"HVAC_REPAIR","basePrice":0.0,"enabled":true},{"interventionType":"APPLIANCE_REPAIR","basePrice":0.0,"enabled":true}]'
  ),
  exterieur_config = COALESCE(exterieur_config,
    '[{"interventionType":"GARDENING","basePrice":0.0,"enabled":true},{"interventionType":"EXTERIOR_CLEANING","basePrice":0.0,"enabled":true},{"interventionType":"PEST_CONTROL","basePrice":0.0,"enabled":true},{"interventionType":"DISINFECTION","basePrice":0.0,"enabled":true},{"interventionType":"RESTORATION","basePrice":0.0,"enabled":true}]'
  ),
  blanchisserie_config = COALESCE(blanchisserie_config,
    '[{"key":"draps_1place","label":"Draps 1 place","price":8.0,"enabled":true},{"key":"draps_2places","label":"Draps 2 places","price":10.0,"enabled":true},{"key":"serviettes","label":"Serviettes","price":3.0,"enabled":true},{"key":"housse_couette","label":"Housse de couette","price":12.0,"enabled":true},{"key":"taie_oreiller","label":"Taie d''oreiller","price":2.0,"enabled":true},{"key":"peignoir","label":"Peignoir","price":6.0,"enabled":true},{"key":"nappe","label":"Nappe","price":5.0,"enabled":true}]'
  ),
  commission_configs = COALESCE(commission_configs,
    '[{"category":"entretien","enabled":true,"rate":15.0},{"category":"travaux","enabled":true,"rate":15.0},{"category":"exterieur","enabled":true,"rate":15.0},{"category":"blanchisserie","enabled":true,"rate":15.0}]'
  ),
  forfait_configs = COALESCE(forfait_configs,
    '[{"key":"CLEANING","label":"Standard","coeffMin":1.0,"coeffMax":1.0,"serviceTypes":["CLEANING","FLOOR_CLEANING","BATHROOM_CLEANING","KITCHEN_CLEANING"],"includedPrestations":["laundry","exterior"],"extraPrestations":["ironing","deepKitchen","disinfection","windows","frenchDoors","slidingDoors"],"eligibleTeamIds":[],"surcharges":{"perBedroom":5.0,"perBathroom":4.0,"perFloor":8.0,"exterior":12.0,"laundry":8.0,"perGuestAbove4":3.0},"surfaceBasePrices":[{"maxSurface":30,"base":35},{"maxSurface":50,"base":45},{"maxSurface":70,"base":55},{"maxSurface":100,"base":70},{"maxSurface":150,"base":90},{"maxSurface":null,"base":110}]},{"key":"EXPRESS_CLEANING","label":"Express","coeffMin":0.7,"coeffMax":0.85,"serviceTypes":["EXPRESS_CLEANING"],"includedPrestations":[],"extraPrestations":["laundry","exterior","ironing","deepKitchen","disinfection","windows","frenchDoors","slidingDoors"],"eligibleTeamIds":[],"surcharges":{"perBedroom":5.0,"perBathroom":4.0,"perFloor":8.0,"exterior":12.0,"laundry":8.0,"perGuestAbove4":3.0},"surfaceBasePrices":[{"maxSurface":30,"base":35},{"maxSurface":50,"base":45},{"maxSurface":70,"base":55},{"maxSurface":100,"base":70},{"maxSurface":150,"base":90},{"maxSurface":null,"base":110}]},{"key":"DEEP_CLEANING","label":"En profondeur","coeffMin":1.4,"coeffMax":1.7,"serviceTypes":["DEEP_CLEANING","WINDOW_CLEANING"],"includedPrestations":["laundry","exterior","ironing","deepKitchen","windows","frenchDoors","slidingDoors"],"extraPrestations":["disinfection"],"eligibleTeamIds":[],"surcharges":{"perBedroom":5.0,"perBathroom":4.0,"perFloor":8.0,"exterior":12.0,"laundry":8.0,"perGuestAbove4":3.0},"surfaceBasePrices":[{"maxSurface":30,"base":35},{"maxSurface":50,"base":45},{"maxSurface":70,"base":55},{"maxSurface":100,"base":70},{"maxSurface":150,"base":90},{"maxSurface":null,"base":110}]}]'
  ),
  available_prestations = COALESCE(available_prestations,
    '[{"key":"laundry","label":"Linge"},{"key":"exterior","label":"Ext\u00e9rieur"},{"key":"ironing","label":"Repassage"},{"key":"deepKitchen","label":"Cuisine en profondeur"},{"key":"disinfection","label":"D\u00e9sinfection"},{"key":"windows","label":"Fen\u00eatres"},{"key":"frenchDoors","label":"Portes-fen\u00eatres"},{"key":"slidingDoors","label":"Baies vitr\u00e9es"}]'
  ),
  available_surcharges = COALESCE(available_surcharges,
    '[{"key":"perBedroom","label":"Par chambre suppl\u00e9mentaire","unit":"\u20ac"},{"key":"perBathroom","label":"Par salle de bain suppl\u00e9mentaire","unit":"\u20ac"},{"key":"perFloor","label":"Par \u00e9tage suppl\u00e9mentaire","unit":"\u20ac"},{"key":"exterior","label":"Ext\u00e9rieur","unit":"\u20ac"},{"key":"laundry","label":"Linge","unit":"\u20ac"},{"key":"perGuestAbove4","label":"Par voyageur au-del\u00e0 de 4","unit":"\u20ac"}]'
  )
WHERE id = (SELECT id FROM pricing_configs ORDER BY id DESC LIMIT 1);
