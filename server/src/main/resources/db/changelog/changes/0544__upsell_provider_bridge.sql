-- Baitly : lien entre service vendu au voyageur et prestation d'exécution.
ALTER TABLE upsell_offers ADD COLUMN fulfillment_service_code varchar(60);
ALTER TABLE upsell_offers ADD COLUMN preferred_provider_id bigint REFERENCES marketplace_providers(id) ON DELETE SET NULL;

-- Correspondances précises des catégories historiques ; les catégories génériques
-- (transfert, expérience, équipement...) restent à qualifier dans la fiche.
UPDATE upsell_types t SET service_item_code=m.item_code
FROM (VALUES ('BREAKFAST','culinary-breakfast'),('PARKING','mobility-parking')) m(type_code,item_code)
WHERE t.code=m.type_code AND t.organization_id IS NULL AND t.service_item_code IS NULL
AND EXISTS (SELECT 1 FROM marketplace_service_items i WHERE i.code=m.item_code AND i.active);

-- Projection booléenne uniquement : aucun détail des engagements d'autres organisations.
-- NULL = calendrier non connecté, à confirmer auprès du professionnel.
CREATE FUNCTION public.baitly_provider_slot_available(p_id bigint, p_start timestamp, p_finish timestamp)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, public SET app.bypass_rls = 'on'
AS $function$
    SELECT CASE WHEN p.user_id IS NULL THEN NULL
        ELSE public.baitly_user_declared_available(p.user_id, p_start, p_finish)
        AND NOT public.baitly_assignment_conflicts(-1, -1, 'user', p.user_id, p_start, p_finish)
    END FROM public.marketplace_providers p WHERE p.id = p_id
$function$;
