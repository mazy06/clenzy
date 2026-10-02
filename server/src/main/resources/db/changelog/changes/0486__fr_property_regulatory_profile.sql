-- Conformité France — phase 1 : profil réglementaire du logement.
--
-- commune_insee_code : préfixe du numéro d'enregistrement (meublé de tourisme) et
--   clé du référentiel communal de taxe de séjour. Distinct du code postal.
-- fr_rental_use      : usage du logement (résidence principale → plafond annuel de
--   nuitées ; chambre d'hôtes → hors numéro d'enregistrement).
ALTER TABLE properties ADD COLUMN IF NOT EXISTS commune_insee_code VARCHAR(5);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fr_rental_use VARCHAR(30);

-- Source unique du numéro d'enregistrement : la licence TOURISM_REGISTRATION.
-- Les numéros saisis jadis dans regulatory_configs (sans écran) y sont repris
-- quand le logement n'en a pas encore ; la colonne historique n'est plus écrite.
INSERT INTO property_licenses (organization_id, property_id, license_type, license_number,
                               issued_by, renewal_lead_days, notes, created_at)
SELECT DISTINCT ON (rc.property_id)
       rc.organization_id, rc.property_id, 'TOURISM_REGISTRATION', rc.registration_number,
       'Mairie', 60, 'Repris de la configuration réglementaire', now()
FROM regulatory_configs rc
JOIN properties p ON p.id = rc.property_id AND p.organization_id = rc.organization_id
WHERE rc.registration_number IS NOT NULL AND btrim(rc.registration_number) <> ''
  AND NOT EXISTS (SELECT 1 FROM property_licenses pl
                  WHERE pl.property_id = rc.property_id
                    AND pl.organization_id = rc.organization_id
                    AND pl.license_type = 'TOURISM_REGISTRATION')
ORDER BY rc.property_id, rc.updated_at DESC NULLS LAST;
