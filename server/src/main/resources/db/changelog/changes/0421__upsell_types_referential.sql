-- Referentiel extensible des types de vente additionnelle.
--
-- CE QUI BLOQUAIT : `upsell_offers.type` etait alimente par un enum Java de neuf
-- valeurs. Chaque metier nouveau — un massage, un forfait de ski, une carte SIM —
-- imposait un deploiement pour exister. Les soixante-neuf prestations du
-- catalogue marquees vendables au voyageur (changeset 0420) etaient donc
-- inutilisables en upsell : elles existaient cote place de marche et nulle part
-- cote livret.
--
-- REFERENCE SOUPLE, PAS DE CLEF ETRANGERE : `upsell_offers.type` continue de
-- porter le CODE en clair. C'est ce qui rend la reprise gratuite — les lignes
-- existantes portent deja `EARLY_CHECKIN`, `CLEANING`... et ces codes sont
-- semes a l'identique. Une offre dont le type serait retire du referentiel
-- continue de s'afficher sous son code brut plutot que de disparaitre : sur un
-- livret deja diffuse, une offre qui s'evapore est pire qu'une offre au libelle
-- technique.
--
-- PORTEE : `organization_id` NULL = type de PLATEFORME, propose a tout le monde.
-- Renseigne = type propre a une organisation, qu'elle ajoute elle-meme. Meme
-- convention que `kb_document`, ou NULL designe deja la documentation globale.
--
-- `system` marque les neuf types historiques : ils restent references par le
-- code (l'agent de supervision cherche EARLY_CHECKIN et LATE_CHECKOUT nommement)
-- et ne doivent pas pouvoir etre supprimes depuis l'interface.

CREATE TABLE IF NOT EXISTS upsell_types (
    id                BIGSERIAL PRIMARY KEY,
    organization_id   BIGINT,
    code              VARCHAR(60)  NOT NULL,
    label_fr          VARCHAR(120) NOT NULL,
    label_en          VARCHAR(120) NOT NULL,
    description       VARCHAR(300),
    icon_key          VARCHAR(40),

    -- Pont vers le catalogue de la place de marche : quand l'upsell correspond
    -- a une prestation vendue par des professionnels, le code de la prestation
    -- est porte ici. C'est ce qui permettra de proposer un prestataire en face
    -- d'une offre plutot que de laisser l'hote la servir seul.
    service_item_code VARCHAR(60),

    sort_order        INTEGER      NOT NULL DEFAULT 0,
    active            BOOLEAN      NOT NULL DEFAULT TRUE,
    system            BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP
);

-- Unicite du code PAR PORTEE : une organisation peut definir « MASSAGE » sans
-- entrer en conflit avec une autre, ni avec la plateforme. COALESCE plutot
-- qu'un index partiel : un NULL ne s'egale pas a lui-meme en SQL, et deux types
-- de plateforme au meme code auraient donc coexiste en silence.
CREATE UNIQUE INDEX IF NOT EXISTS uq_upsell_type_scope_code
    ON upsell_types (COALESCE(organization_id, 0), code);

CREATE INDEX IF NOT EXISTS idx_upsell_type_org
    ON upsell_types (organization_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_upsell_type_service_item
    ON upsell_types (service_item_code);

-- Les codes du catalogue vont jusqu'a soixante caracteres
-- (« regulatory-electrical-periodic ») ; la colonne en tenait trente et aurait
-- tronque en silence.
ALTER TABLE upsell_offers ALTER COLUMN type TYPE VARCHAR(60);

-- ─── Les neuf types historiques ─────────────────────────────────────────────
-- Codes identiques a l'ancien enum : les lignes existantes restent valides sans
-- aucune reprise de donnees.
INSERT INTO upsell_types (organization_id, code, label_fr, label_en, description, icon_key, sort_order, system)
VALUES
    (NULL, 'EARLY_CHECKIN', 'Arrivée anticipée',  'Early check-in',  'Accès au logement avant l''heure d''arrivée', 'schedule',  10, TRUE),
    (NULL, 'LATE_CHECKOUT', 'Départ tardif',      'Late check-out',  'Libération du logement après l''heure de départ', 'schedule', 20, TRUE),
    (NULL, 'CLEANING',      'Ménage',             'Cleaning',        'Ménage supplémentaire pendant ou après le séjour', 'cleaning', 30, TRUE),
    (NULL, 'TRANSFER',      'Transfert',          'Transfer',        'Transfert aéroport, gare ou station', 'driver',    40, TRUE),
    (NULL, 'BREAKFAST',     'Petit-déjeuner',     'Breakfast',       'Petit-déjeuner livré ou servi', 'culinary',        50, TRUE),
    (NULL, 'PARKING',       'Parking',            'Parking',         'Place de stationnement réservée', 'mobility',      60, TRUE),
    (NULL, 'EQUIPMENT',     'Équipement',         'Equipment',       'Location de matériel pour le séjour', 'equipment',  70, TRUE),
    (NULL, 'EXPERIENCE',    'Expérience',         'Experience',      'Activité, excursion ou visite', 'activities',      80, TRUE),
    (NULL, 'OTHER',         'Autre',              'Other',           'Prestation hors catégories', 'more',              999, TRUE)
ON CONFLICT DO NOTHING;

-- ─── Reprise des prestations vendables au voyageur ──────────────────────────
-- Les soixante-neuf entrees du catalogue marquees `guest_sellable` deviennent
-- autant de types disponibles. C'est ce qui relie les deux referentiels : ce
-- qu'un professionnel VEND sur la place de marche, un hote peut le PROPOSER
-- dans son livret.
--
-- `sort_order` decale de mille pour que les neuf types historiques restent en
-- tete des listes : ce sont ceux que les hotes utilisent le plus.
INSERT INTO upsell_types (organization_id, code, label_fr, label_en, description, icon_key, service_item_code, sort_order, system)
SELECT NULL,
       i.code,
       i.label_fr,
       i.label_en,
       i.description,
       c.icon_key,
       i.code,
       1000 + i.sort_order,
       FALSE
FROM marketplace_service_items i
JOIN marketplace_service_categories c ON c.id = i.category_id
WHERE i.guest_sellable = TRUE
  AND i.active = TRUE
ON CONFLICT DO NOTHING;

COMMENT ON TABLE upsell_types IS
  'Referentiel extensible des types de vente additionnelle. organization_id NULL = type de plateforme.';
COMMENT ON COLUMN upsell_types.service_item_code IS
  'Prestation correspondante du catalogue place de marche, quand il y en a une. Reference SOUPLE par code.';
COMMENT ON COLUMN upsell_types.system IS
  'Types historiques references nommement par le code (agent de supervision) : non supprimables.';
COMMENT ON COLUMN upsell_offers.type IS
  'Code d''un upsell_types. Reference souple : une offre survit au retrait de son type plutot que de disparaitre d''un livret diffuse.';
