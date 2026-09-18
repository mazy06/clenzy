-- Correction du modele de prix de onze prestations du catalogue.
--
-- L'ERREUR : le semis du 0420 a place `MONTHLY` — une valeur de RECURRENCE —
-- dans `default_pricing_model`, qui n'accepte que HOURLY, FLAT, PER_UNIT,
-- PER_SQM et ON_QUOTE. Onze lignes sur deux cent dix : abonnement internet,
-- tenue de livres, entretien du jardin, gardiennage saisonnier...
--
-- POURQUOI RIEN NE L'A ATTRAPE : la colonne n'a volontairement pas de
-- contrainte CHECK (les 175 heritees d'Hibernate ont ete supprimees au 0274
-- parce qu'elles gelaient les enums). Le changeset s'applique donc sans broncher,
-- les comptages sont justes, et l'erreur n'apparait qu'a la LECTURE : Hibernate
-- leve « No enum constant PricingModel.MONTHLY » et l'endpoint du referentiel
-- repond 400. C'est exactement le piege documente — une migration verte ne
-- prouve rien sur la validite des valeurs.
--
-- LA CORRECTION : ces onze prestations sont des abonnements factures a montant
-- fixe par periode. Le montant est donc FLAT, et c'est `recurrence` — deja juste
-- dans toutes ces lignes — qui porte la periodicite. Les deux colonnes disaient
-- la meme chose ; une seule devait la dire.
--
-- Le filtre porte sur l'ensemble des valeurs VALIDES plutot que sur la liste des
-- onze codes : si une autre valeur aberrante s'etait glissee dans le semis, elle
-- serait ramenee au meme repli plutot que de rester en embuscade.
UPDATE marketplace_service_items
   SET default_pricing_model = 'FLAT',
       updated_at = CURRENT_TIMESTAMP
 WHERE default_pricing_model NOT IN ('HOURLY', 'FLAT', 'PER_UNIT', 'PER_SQM', 'ON_QUOTE');

-- Meme garde sur les offres deja creees : une offre reprise d'un catalogue
-- fautif porterait la meme valeur, et la fiche du professionnel repondrait 400.
UPDATE marketplace_provider_services
   SET pricing_model = 'ON_QUOTE',
       updated_at = CURRENT_TIMESTAMP
 WHERE pricing_model NOT IN ('HOURLY', 'FLAT', 'PER_UNIT', 'PER_SQM', 'ON_QUOTE');
