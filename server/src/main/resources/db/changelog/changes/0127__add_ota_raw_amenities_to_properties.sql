-- ============================================================================
-- 0127 : Ajout du champ ota_raw_amenities sur properties
-- ----------------------------------------------------------------------------
-- Contexte : lors de l'import d'une property depuis un OTA (via Channex), on
-- recupere les amenities/equipements depuis le JSON-LD Schema.org de la page
-- publique de l'OTA. Le mapping OTA → codes Clenzy (WIFI, TV, ...) ne couvre
-- pas TOUT (les amenities OTA evoluent dans le temps, varient selon les pays).
--
-- Pour eviter de PERDRE de l'information, on stocke aussi les noms d'amenities
-- bruts (tels que renvoyes par l'OTA) dans cette colonne. Format : JSON array
-- de strings, ex : ["Smoke alarm", "Bed linens", "First aid kit"].
--
-- A terme, une UI d'administration permettra a l'admin de :
--   - mapper un nom OTA brut sur un code Clenzy existant (alias)
--   - creer une nouvelle commodite Clenzy si pertinent
-- ============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS ota_raw_amenities TEXT;

COMMENT ON COLUMN properties.ota_raw_amenities IS
    'JSON array des noms d''amenities OTA bruts (non mappes sur les codes Clenzy). '
    'Ex: ["Smoke alarm","Bed linens"]. Sert a la review et au mapping ulterieur.';
