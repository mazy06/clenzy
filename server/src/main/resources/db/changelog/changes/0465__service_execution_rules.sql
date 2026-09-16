-- Baitly : règles d'exécution du référentiel commun, indépendantes de l'audience/payeur.
-- Tables vérifiées dans les entités MarketplaceServiceItem, ServiceRequest et Intervention.
ALTER TABLE marketplace_service_items
    ADD COLUMN execution_mode VARCHAR(20) NOT NULL DEFAULT 'ON_SITE'
        CHECK (execution_mode IN ('ON_SITE','REMOTE','DELIVERY')),
    ADD COLUMN property_required BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN slot_required BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE marketplace_service_categories ADD COLUMN professional_domain VARCHAR(60) NOT NULL DEFAULT 'OTHER';
UPDATE marketplace_service_categories SET professional_domain=CASE
    WHEN family='OPERATIONS' THEN 'PROPERTY_OPERATIONS'
    WHEN family='TECHNICAL' THEN 'PROPERTY_TECHNICAL'
    WHEN family='GUEST' THEN 'HOSPITALITY'
    WHEN family='OWNER' THEN 'PROFESSIONAL_SERVICES'
    ELSE 'OTHER' END;
UPDATE marketplace_service_items SET execution_mode='REMOTE',property_required=false,slot_required=false
WHERE category_id IN (SELECT id FROM marketplace_service_categories WHERE code IN ('ACCOUNTING','MARKETING','INSURANCE'));
ALTER TABLE service_requests ALTER COLUMN property_id DROP NOT NULL;
ALTER TABLE interventions ALTER COLUMN property_id DROP NOT NULL;
