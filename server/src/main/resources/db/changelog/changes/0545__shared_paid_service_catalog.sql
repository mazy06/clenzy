-- Baitly : une seule référence de prestation pour les offres et les prestataires.
-- Les codes historiques et les types propres aux organisations restent inchangés.
CREATE OR REPLACE FUNCTION public.baitly_sync_paid_service_catalog()
RETURNS void LANGUAGE sql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
    INSERT INTO public.upsell_types
        (organization_id, code, label_fr, label_en, description, icon_key,
         service_item_code, sort_order, active, system)
    SELECT NULL, i.code, i.label_fr, i.label_en, i.description, c.icon_key,
           i.code, 1000 + c.sort_order * 100 + i.sort_order, i.active AND c.active, false
    FROM public.marketplace_service_items i
    JOIN public.marketplace_service_categories c ON c.id=i.category_id
    ON CONFLICT (COALESCE(organization_id, 0), code) DO UPDATE
    SET label_fr=EXCLUDED.label_fr, label_en=EXCLUDED.label_en,
        description=EXCLUDED.description, icon_key=EXCLUDED.icon_key,
        service_item_code=EXCLUDED.service_item_code, sort_order=EXCLUDED.sort_order,
        active=EXCLUDED.active, updated_at=CURRENT_TIMESTAMP
    WHERE NOT upsell_types.system AND
        (upsell_types.label_fr, upsell_types.label_en, upsell_types.description,
         upsell_types.icon_key, upsell_types.service_item_code, upsell_types.sort_order, upsell_types.active)
        IS DISTINCT FROM
        (EXCLUDED.label_fr, EXCLUDED.label_en, EXCLUDED.description,
         EXCLUDED.icon_key, EXCLUDED.service_item_code, EXCLUDED.sort_order, EXCLUDED.active);
    UPDATE public.upsell_types t SET active=false, updated_at=CURRENT_TIMESTAMP
    WHERE t.organization_id IS NULL AND NOT t.system AND t.code=t.service_item_code AND t.active
      AND NOT EXISTS (SELECT 1 FROM public.marketplace_service_items i WHERE i.code=t.service_item_code);
$function$;

SELECT public.baitly_sync_paid_service_catalog();

-- Les évolutions du catalogue doivent aussi se retrouver dans les services payants.
CREATE OR REPLACE FUNCTION public.baitly_paid_service_catalog_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
    PERFORM public.baitly_sync_paid_service_catalog();
    RETURN NULL;
END;
$function$;
CREATE TRIGGER baitly_paid_service_items_changed
AFTER INSERT OR UPDATE OR DELETE ON marketplace_service_items
FOR EACH STATEMENT EXECUTE FUNCTION public.baitly_paid_service_catalog_changed();
CREATE TRIGGER baitly_paid_service_categories_changed
AFTER INSERT OR UPDATE OR DELETE ON marketplace_service_categories
FOR EACH STATEMENT EXECUTE FUNCTION public.baitly_paid_service_catalog_changed();
