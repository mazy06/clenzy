-- Baitly : même code INSEE pour la couverture, l'affectation et les contours.
CREATE OR REPLACE FUNCTION public.baitly_normalize_arrondissement(p_country text,p_department text,p_value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
 raw text := NULLIF(trim(p_value),'');
 dept text := trim(p_department);
 prefix text;
 postal_prefix text;
 maximum integer;
 ordinal text;
 n integer;
BEGIN
 IF raw IS NULL THEN RETURN NULL; END IF;
 IF upper(trim(p_country)) IS DISTINCT FROM 'FR' OR dept IS NULL OR dept NOT IN ('75','69','13') THEN RETURN raw; END IF;
 prefix := CASE dept WHEN '75' THEN '751' WHEN '69' THEN '6938' ELSE '132' END;
 postal_prefix := CASE dept WHEN '75' THEN '750' WHEN '69' THEN '6900' ELSE '130' END;
 maximum := CASE dept WHEN '75' THEN 20 WHEN '69' THEN 9 ELSE 16 END;
 IF raw ~ '^[0-9]{5}$' AND (left(raw,length(prefix))=prefix OR left(raw,length(postal_prefix))=postal_prefix) THEN
   n := substring(raw FROM length(prefix)+1)::integer;
 ELSE
   ordinal := translate(lower(raw),'éèê','eee');
   IF ordinal !~ '^[0-9]{1,2}(er|e|eme)?$' THEN RETURN NULL; END IF;
   n := substring(ordinal FROM '^[0-9]+')::integer;
 END IF;
 IF n<1 OR n>maximum THEN RETURN NULL; END IF;
 RETURN prefix || CASE WHEN dept='69' THEN n::text ELSE lpad(n::text,2,'0') END;
END
$fn$;

-- Une valeur inconnue n'est pas assimilée à une zone sans arrondissement.
CREATE OR REPLACE FUNCTION public.baitly_zone_covers(
 z_country text,z_department text,z_arrondissement text,z_city text,
 p_country text,p_department text,p_arrondissement text,p_city text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
 SELECT COALESCE(upper(trim(z_country))=upper(trim(p_country)) AND
 CASE WHEN upper(trim(p_country))='FR' THEN
   NULLIF(trim(z_department),'')=NULLIF(trim(p_department),'')
   AND (NULLIF(trim(z_arrondissement),'') IS NULL OR
     (public.baitly_normalize_arrondissement(z_country,z_department,z_arrondissement) IS NOT NULL
      AND public.baitly_normalize_arrondissement(z_country,z_department,z_arrondissement)
          =public.baitly_normalize_arrondissement(p_country,p_department,p_arrondissement)))
 ELSE NULLIF(lower(trim(z_city)),'')=NULLIF(lower(trim(p_city)),'') END,false)
$fn$;

-- Reprise ciblée des valeurs résolubles, sans effacer les déclarations ambiguës.
SELECT set_config('app.baitly_arrondissement_previous_bypass',COALESCE(current_setting('app.bypass_rls',true),''),true);
SET LOCAL app.bypass_rls='on';
UPDATE public.properties SET arrondissement=public.baitly_normalize_arrondissement(country_code,department,arrondissement)
 WHERE upper(trim(country_code))='FR' AND NULLIF(trim(arrondissement),'') IS NOT NULL
 AND public.baitly_normalize_arrondissement(country_code,department,arrondissement) IS NOT NULL
 AND arrondissement IS DISTINCT FROM public.baitly_normalize_arrondissement(country_code,department,arrondissement);
UPDATE public.marketplace_provider_zones SET arrondissement=public.baitly_normalize_arrondissement(country_code,department,arrondissement)
 WHERE upper(trim(country_code))='FR' AND NULLIF(trim(arrondissement),'') IS NOT NULL
 AND public.baitly_normalize_arrondissement(country_code,department,arrondissement) IS NOT NULL
 AND arrondissement IS DISTINCT FROM public.baitly_normalize_arrondissement(country_code,department,arrondissement);
UPDATE public.team_coverage_zones SET arrondissement=public.baitly_normalize_arrondissement(country,department,arrondissement)
 WHERE upper(trim(country))='FR' AND NULLIF(trim(arrondissement),'') IS NOT NULL
 AND public.baitly_normalize_arrondissement(country,department,arrondissement) IS NOT NULL
 AND arrondissement IS DISTINCT FROM public.baitly_normalize_arrondissement(country,department,arrondissement);
SELECT set_config('app.bypass_rls',current_setting('app.baitly_arrondissement_previous_bypass'),true);
