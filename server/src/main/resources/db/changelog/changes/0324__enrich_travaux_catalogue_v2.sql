-- 0324 : Enrichissement du catalogue travaux (v2). Le 0323 initial n'a rien
-- appliqué sur les grilles déjà reformatées par une sauvegarde (WHERE exact).
-- Condition robuste : on enrichit tout ce qui est vide OU en ANCIEN format
-- (sans champ "domain") ET non personnalisé (aucun prix non nul). On ne touche
-- JAMAIS une grille déjà enrichie (a un "domain") ou tarifée (un prix >= 1).
UPDATE pricing_configs
SET travaux_config = '[
{"interventionType":"PREVENTIVE_MAINTENANCE","label":"Maintenance préventive","domain":"Général","basePrice":0.0,"enabled":true},
{"interventionType":"EMERGENCY_REPAIR","label":"Réparation d''urgence","domain":"Général","basePrice":0.0,"enabled":true},
{"interventionType":"GENERAL_INSPECTION","label":"Inspection générale","domain":"Général","basePrice":0.0,"enabled":true},
{"interventionType":"HANDYMAN","label":"Petits travaux / bricolage","domain":"Général","basePrice":0.0,"enabled":true},
{"interventionType":"FURNITURE_ASSEMBLY","label":"Montage de meuble","domain":"Général","basePrice":0.0,"enabled":true},
{"interventionType":"PLUMBING_REPAIR","label":"Réparation plomberie","domain":"Plomberie","basePrice":0.0,"enabled":true},
{"interventionType":"LEAK_REPAIR","label":"Réparation de fuite","domain":"Plomberie","basePrice":0.0,"enabled":true},
{"interventionType":"DRAIN_UNBLOCKING","label":"Débouchage canalisation","domain":"Plomberie","basePrice":0.0,"enabled":true},
{"interventionType":"FAUCET_REPLACEMENT","label":"Remplacement robinetterie","domain":"Plomberie","basePrice":0.0,"enabled":true},
{"interventionType":"WATER_HEATER_REPAIR","label":"Réparation chauffe-eau","domain":"Plomberie","basePrice":0.0,"enabled":true},
{"interventionType":"TOILET_REPAIR","label":"Réparation WC","domain":"Plomberie","basePrice":0.0,"enabled":true},
{"interventionType":"ELECTRICAL_REPAIR","label":"Réparation électrique","domain":"Électricité","basePrice":0.0,"enabled":true},
{"interventionType":"OUTLET_SWITCH_REPLACEMENT","label":"Remplacement prise / interrupteur","domain":"Électricité","basePrice":0.0,"enabled":true},
{"interventionType":"LIGHTING_INSTALLATION","label":"Installation luminaire","domain":"Électricité","basePrice":0.0,"enabled":true},
{"interventionType":"ELECTRICAL_PANEL_UPGRADE","label":"Mise aux normes tableau","domain":"Électricité","basePrice":0.0,"enabled":true},
{"interventionType":"CIRCUIT_BREAKER_REPAIR","label":"Remplacement disjoncteur","domain":"Électricité","basePrice":0.0,"enabled":true},
{"interventionType":"HVAC_REPAIR","label":"Réparation climatisation","domain":"Chauffage & Climatisation","basePrice":0.0,"enabled":true},
{"interventionType":"BOILER_MAINTENANCE","label":"Entretien chaudière","domain":"Chauffage & Climatisation","basePrice":0.0,"enabled":true},
{"interventionType":"AC_RECHARGE","label":"Recharge climatisation","domain":"Chauffage & Climatisation","basePrice":0.0,"enabled":true},
{"interventionType":"RADIATOR_BLEEDING","label":"Purge des radiateurs","domain":"Chauffage & Climatisation","basePrice":0.0,"enabled":true},
{"interventionType":"THERMOSTAT_REPLACEMENT","label":"Remplacement thermostat","domain":"Chauffage & Climatisation","basePrice":0.0,"enabled":true},
{"interventionType":"APPLIANCE_REPAIR","label":"Réparation électroménager","domain":"Électroménager","basePrice":0.0,"enabled":true},
{"interventionType":"WASHING_MACHINE_REPAIR","label":"Réparation lave-linge","domain":"Électroménager","basePrice":0.0,"enabled":true},
{"interventionType":"FRIDGE_REPAIR","label":"Réparation réfrigérateur","domain":"Électroménager","basePrice":0.0,"enabled":true},
{"interventionType":"OVEN_REPAIR","label":"Réparation four","domain":"Électroménager","basePrice":0.0,"enabled":true},
{"interventionType":"DISHWASHER_REPAIR","label":"Réparation lave-vaisselle","domain":"Électroménager","basePrice":0.0,"enabled":true},
{"interventionType":"DOOR_UNLOCKING","label":"Ouverture de porte","domain":"Serrurerie","basePrice":0.0,"enabled":true},
{"interventionType":"LOCK_REPLACEMENT","label":"Remplacement de serrure","domain":"Serrurerie","basePrice":0.0,"enabled":true},
{"interventionType":"KEY_DUPLICATION","label":"Reproduction de clés","domain":"Serrurerie","basePrice":0.0,"enabled":true},
{"interventionType":"DOOR_REINFORCEMENT","label":"Blindage de porte","domain":"Serrurerie","basePrice":0.0,"enabled":true},
{"interventionType":"DOOR_WINDOW_REPAIR","label":"Réparation porte / fenêtre","domain":"Menuiserie","basePrice":0.0,"enabled":true},
{"interventionType":"SHUTTER_REPAIR","label":"Réparation volet","domain":"Menuiserie","basePrice":0.0,"enabled":true},
{"interventionType":"SHELF_INSTALLATION","label":"Pose d''étagère","domain":"Menuiserie","basePrice":0.0,"enabled":true},
{"interventionType":"DOOR_ADJUSTMENT","label":"Réglage de porte","domain":"Menuiserie","basePrice":0.0,"enabled":true},
{"interventionType":"WALL_PAINTING","label":"Peinture murs & plafonds","domain":"Peinture & Revêtements","basePrice":0.0,"enabled":true},
{"interventionType":"PLASTER_REPAIR","label":"Reprise d''enduit / plâtre","domain":"Peinture & Revêtements","basePrice":0.0,"enabled":true},
{"interventionType":"WALLPAPER_INSTALLATION","label":"Pose de papier peint","domain":"Peinture & Revêtements","basePrice":0.0,"enabled":true},
{"interventionType":"FLOOR_COVERING","label":"Pose de revêtement de sol","domain":"Peinture & Revêtements","basePrice":0.0,"enabled":true},
{"interventionType":"GLASS_REPLACEMENT","label":"Remplacement de vitre","domain":"Vitrerie","basePrice":0.0,"enabled":true},
{"interventionType":"DOUBLE_GLAZING","label":"Installation double vitrage","domain":"Vitrerie","basePrice":0.0,"enabled":true}
]'
WHERE travaux_config IS NULL
   OR btrim(travaux_config) = ''
   OR btrim(travaux_config) = '[]'
   OR (travaux_config NOT LIKE '%"domain"%' AND travaux_config !~ '"basePrice":[1-9]');
