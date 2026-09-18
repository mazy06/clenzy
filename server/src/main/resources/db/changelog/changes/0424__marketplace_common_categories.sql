-- Metiers USUELS de la location courte duree.
--
-- LE PROBLEME : le panneau de filtres ne montrait en tete que les metiers ayant
-- au moins un prestataire, et repliait les autres. Sur un catalogue jeune —
-- trois metiers pourvus sur trente-deux — le panneau etait donc quasiment vide,
-- et il fallait deplier vingt-neuf entrees pour voir qu'on peut chercher un
-- serrurier. Le classement par volume seul dit ou sont les gens ; il ne dit pas
-- de quoi une conciergerie a besoin.
--
-- CE DRAPEAU dit la seconde chose. Un metier marque `common` reste visible en
-- tete meme a zero prestataire : c'est un besoin connu du metier, et son compte
-- a zero devient une information utile — « personne ne couvre la serrurerie »
-- est exactement ce qu'un gestionnaire doit voir.
--
-- EN BASE ET NON EN DUR COTE INTERFACE : la liste des metiers usuels differe
-- d'un marche a l'autre — le deneigement en montagne, le hammam au Maroc — et
-- doit pouvoir bouger sans deploiement, comme le reste du referentiel.

ALTER TABLE marketplace_service_categories
    ADD COLUMN IF NOT EXISTS common BOOLEAN NOT NULL DEFAULT FALSE;

-- Les quatorze metiers du quotidien d'une conciergerie : ce qu'on cherche sans
-- y penser. Volontairement court — au-dela, « usuel » ne veut plus rien dire et
-- on retombe sur la liste complete.
UPDATE marketplace_service_categories
   SET common = TRUE
 WHERE code IN (
    -- Exploitation : le cycle d'un sejour
    'CLEANING', 'LAUNDRY', 'LINEN', 'KEYS', 'CONCIERGE',
    -- Technique : ce qui casse, ce qui s'entretient, ce qui est obligatoire
    'MAINTENANCE', 'LOCKSMITH', 'EXTERIOR', 'POOL', 'REGULATORY',
    -- Voyageur : les ventes additionnelles les plus demandees
    'CULINARY', 'DRIVER', 'ACTIVITIES',
    -- Proprietaire : la mise en ligne d'un bien
    'PHOTOGRAPHY'
 );

CREATE INDEX IF NOT EXISTS idx_marketplace_category_common
    ON marketplace_service_categories (common) WHERE common;

COMMENT ON COLUMN marketplace_service_categories.common IS
  'Metier usuel de la location courte duree : reste visible en tete du filtre meme sans prestataire, parce que son absence est elle-meme une information.';
