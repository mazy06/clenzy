-- Baitly : le catalogue existant porte la référence commune PMS / marketplace.
-- Noms vérifiés : @Table service_requests, interventions, marketplace_service_items ;
-- baseline 0000, catalogue 0420 et demandes marketplace 0432.
CREATE TABLE service_catalog_legacy_aliases (
    legacy_type VARCHAR(60) PRIMARY KEY,
    service_item_code VARCHAR(60) NOT NULL REFERENCES marketplace_service_items(code),
    mapping_version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_service_catalog_alias_item ON service_catalog_legacy_aliases(service_item_code);

INSERT INTO service_catalog_legacy_aliases(legacy_type,service_item_code) VALUES
 ('CLEANING','cleaning-turnover'),
 ('DEEP_CLEANING','cleaning-deep'),
 ('WINDOW_CLEANING','cleaning-windows'),
 ('DISINFECTION','cleaning-disinfection'),
 ('PLUMBING_REPAIR','maintenance-plumbing'),
 ('ELECTRICAL_REPAIR','maintenance-electrical'),
 ('HVAC_REPAIR','maintenance-hvac'),
 ('APPLIANCE_REPAIR','maintenance-appliance'),
 ('PREVENTIVE_MAINTENANCE','maintenance-preventive'),
 ('EMERGENCY_REPAIR','maintenance-emergency'),
 ('GARDENING','exterior-garden'),
 ('EXTERIOR_CLEANING','exterior-terrace'),
 ('PEST_CONTROL','pest-insects');
-- RESTORATION est plus large que « peinture » : aucune habilitation déduite.
-- OTHER et les autres correspondances ambiguës restent à qualifier.

ALTER TABLE service_requests ADD COLUMN service_item_code VARCHAR(60)
    REFERENCES marketplace_service_items(code);
ALTER TABLE interventions ADD COLUMN service_item_code VARCHAR(60)
    REFERENCES marketplace_service_items(code);
CREATE INDEX idx_service_request_catalog_item ON service_requests(service_item_code);
CREATE INDEX idx_intervention_catalog_item ON interventions(service_item_code);

UPDATE service_requests r SET service_item_code=a.service_item_code
FROM service_catalog_legacy_aliases a WHERE a.legacy_type=r.service_type;

-- La référence de l'accord prime sur un type d'intervention historiquement générique.
-- En cas de plusieurs références contradictoires, ne pas en choisir une arbitrairement.
UPDATE interventions i SET service_item_code=q.code FROM (
    SELECT q.intervention_id,min(q.service_item_code) AS code
    FROM marketplace_quote_requests q
    WHERE q.intervention_id IS NOT NULL GROUP BY q.intervention_id
    HAVING count(DISTINCT q.service_item_code)=1
) q WHERE i.id=q.intervention_id
AND EXISTS(SELECT 1 FROM marketplace_service_items s WHERE s.code=q.code);

UPDATE interventions i SET service_item_code=r.service_item_code
FROM service_requests r WHERE i.service_request_id=r.id AND i.service_item_code IS NULL
AND NOT EXISTS(SELECT 1 FROM marketplace_quote_requests q WHERE q.intervention_id=i.id);

UPDATE interventions i SET service_item_code=a.service_item_code
FROM service_catalog_legacy_aliases a WHERE a.legacy_type=i.type AND i.service_item_code IS NULL
AND i.service_request_id IS NULL
AND NOT EXISTS(SELECT 1 FROM marketplace_quote_requests q WHERE q.intervention_id=i.id);

-- Inventaire technique uniquement : aucun événement métier, paiement ou notification.
CREATE VIEW service_catalog_reference_issues AS
 SELECT 'SERVICE_REQUEST'::text AS source_type,r.id AS source_id,r.organization_id,
        r.service_type AS legacy_type,'UNRESOLVED'::text AS reason
 FROM service_requests r WHERE r.service_item_code IS NULL
 UNION ALL
 SELECT 'INTERVENTION',i.id,i.organization_id,i.type,'UNRESOLVED'
 FROM interventions i WHERE i.service_item_code IS NULL
 UNION ALL
 SELECT 'INTERVENTION',i.id,i.organization_id,i.type,'SOURCE_MISMATCH'
 FROM interventions i JOIN service_requests r ON r.id=i.service_request_id
 WHERE i.service_item_code IS NOT NULL AND r.service_item_code IS NOT NULL
   AND i.service_item_code<>r.service_item_code;
