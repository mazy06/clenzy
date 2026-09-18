-- Baitly : rattacher les exécutions historiques qualifiées au besoin commun.
-- Aucun montant, paiement, affectation ou notification n'est créé par cette reprise.
-- Tables/colonnes vérifiées contre ServiceRequest, Intervention et la baseline 0000.
UPDATE service_requests need SET service_item_code=source.code
FROM (
    SELECT service_request_id,min(service_item_code) AS code,min(organization_id) AS org_id
    FROM interventions WHERE service_request_id IS NOT NULL
    GROUP BY service_request_id
    HAVING count(DISTINCT service_item_code)=1 AND count(service_item_code)=count(*)
       AND count(DISTINCT organization_id)=1
) source WHERE need.id=source.service_request_id AND need.service_item_code IS NULL
    AND need.organization_id=source.org_id;

DO $$
DECLARE
    mission record;
    source_quote_id bigint;
    need_id bigint;
BEGIN
    FOR mission IN SELECT * FROM interventions
        WHERE service_request_id IS NULL AND service_item_code IS NOT NULL
          AND organization_id IS NOT NULL AND requestor_id IS NOT NULL
          AND coalesce(scheduled_date,start_time) IS NOT NULL
        ORDER BY id
    LOOP
        SELECT CASE WHEN count(*)=1 THEN min(id) END INTO source_quote_id
        FROM marketplace_quote_requests WHERE intervention_id=mission.id;
        SELECT id INTO need_id FROM service_requests WHERE marketplace_request_id=source_quote_id;
        IF need_id IS NULL THEN
            INSERT INTO service_requests(organization_id,user_id,property_id,title,description,
                service_type,service_item_code,priority,status,desired_date,estimated_duration_hours,
                auto_assign_status,created_at,updated_at,version,marketplace_request_id)
            VALUES(mission.organization_id,mission.requestor_id,mission.property_id,
                left(CASE WHEN length(coalesce(mission.title,''))<5 THEN 'Prestation '||coalesce(mission.title,'') ELSE mission.title END,100),
                left(mission.description,1000),'OTHER',mission.service_item_code,'NORMAL',
                CASE WHEN mission.status='COMPLETED' THEN 'COMPLETED' WHEN mission.status='CANCELLED' THEN 'CANCELLED' ELSE 'PENDING' END,
                coalesce(mission.scheduled_date,mission.start_time),mission.estimated_duration_hours,
                'manual_hold',coalesce(mission.created_at,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP,0,source_quote_id)
            RETURNING id INTO need_id;
        END IF;
        UPDATE interventions SET service_request_id=need_id WHERE id=mission.id AND service_request_id IS NULL;
    END LOOP;
END $$;
