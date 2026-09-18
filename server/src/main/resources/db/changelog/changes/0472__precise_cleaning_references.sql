-- Baitly : correspondances exactes des prestations historiques spécialisées.
-- Tables vérifiées : MarketplaceServiceItem, ServiceRequest, Intervention et 0420/0461.
INSERT INTO marketplace_service_items(code,category_id,label_fr,label_en,sort_order)
SELECT v.code,c.id,v.label_fr,v.label_en,v.sort_order
FROM (VALUES
 ('cleaning-floors','Nettoyage des sols','Floor cleaning',110),
 ('cleaning-kitchen','Nettoyage de la cuisine','Kitchen cleaning',120),
 ('cleaning-bathroom','Nettoyage des sanitaires','Bathroom cleaning',130)
) v(code,label_fr,label_en,sort_order)
JOIN marketplace_service_categories c ON c.code='CLEANING'
ON CONFLICT (code) DO NOTHING;

INSERT INTO service_catalog_legacy_aliases(legacy_type,service_item_code) VALUES
 ('FLOOR_CLEANING','cleaning-floors'),
 ('KITCHEN_CLEANING','cleaning-kitchen'),
 ('BATHROOM_CLEANING','cleaning-bathroom')
ON CONFLICT (legacy_type) DO NOTHING;

-- Ne remplacer aucune qualification existante ni contredire un accord commercial.
UPDATE service_requests r SET service_item_code=a.service_item_code
FROM service_catalog_legacy_aliases a
WHERE r.service_item_code IS NULL AND r.service_type=a.legacy_type
 AND a.legacy_type IN ('FLOOR_CLEANING','KITCHEN_CLEANING','BATHROOM_CLEANING')
 AND r.marketplace_request_id IS NULL
 AND NOT EXISTS (SELECT 1 FROM interventions i WHERE i.service_request_id=r.id
   AND (i.service_item_code IS NOT NULL AND i.service_item_code<>a.service_item_code
     OR EXISTS (SELECT 1 FROM marketplace_quote_requests q WHERE q.intervention_id=i.id)));

UPDATE interventions i SET service_item_code=a.service_item_code
FROM service_catalog_legacy_aliases a
WHERE i.service_item_code IS NULL AND i.type=a.legacy_type
 AND a.legacy_type IN ('FLOOR_CLEANING','KITCHEN_CLEANING','BATHROOM_CLEANING')
 AND NOT EXISTS (SELECT 1 FROM marketplace_quote_requests q WHERE q.intervention_id=i.id)
 AND (i.service_request_id IS NULL OR EXISTS (
   SELECT 1 FROM service_requests r WHERE r.id=i.service_request_id
     AND r.organization_id=i.organization_id AND r.service_item_code=a.service_item_code));
