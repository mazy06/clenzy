-- Baitly : une commune explicitement déclarée restreint le département.
-- Aucun secteur n'est élargi : département vide, commune inconnue et ville absente
-- du logement ne valent jamais une correspondance avec une commune déclarée.
CREATE OR REPLACE FUNCTION public.baitly_normalize_city(p_city text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
 SELECT NULLIF(btrim(regexp_replace(lower(regexp_replace(
   normalize(replace(replace(replace(replace(trim(p_city),'Œ','oe'),'œ','oe'),'Æ','ae'),'æ','ae'),NFD),
   U&'[\0300-\036F]','','g')),'[^a-z0-9]+','-','g'),'-'),'')
$fn$;

CREATE OR REPLACE FUNCTION public.baitly_zone_covers(
 z_country text,z_department text,z_arrondissement text,z_city text,
 p_country text,p_department text,p_arrondissement text,p_city text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
 SELECT COALESCE(upper(trim(z_country))=upper(trim(p_country)) AND
 CASE WHEN upper(trim(p_country))='FR' THEN
   NULLIF(upper(trim(z_department)),'')=NULLIF(upper(trim(p_department)),'') AND
   CASE WHEN NULLIF(trim(z_arrondissement),'') IS NOT NULL THEN
     public.baitly_normalize_arrondissement(z_country,z_department,z_arrondissement) IS NOT NULL
     AND public.baitly_normalize_arrondissement(z_country,z_department,z_arrondissement)
       =public.baitly_normalize_arrondissement(p_country,p_department,p_arrondissement)
   ELSE NULLIF(trim(z_city),'') IS NULL OR
     public.baitly_normalize_city(z_city)=public.baitly_normalize_city(p_city)
   END
 ELSE NULLIF(lower(trim(z_city)),'')=NULLIF(lower(trim(p_city)),'') END,false)
$fn$;
