-- Place de marche des professionnels Baitly.
--
-- POURQUOI DE NOUVELLES TABLES PLUTOT QUE D'ETENDRE `teams` : tout l'existant
-- prestataire (equipe personnelle, zones de couverture, tarifs menage,
-- prestations technicien) porte `organization_id` et passe par le filtre
-- Hibernate `organizationFilter`. C'est exactement ce qu'il faut pour la
-- gestion INTERNE d'une conciergerie, et exactement ce qui rend un catalogue
-- de place de marche impossible : un professionnel n'y serait visible que de
-- l'organisation qui l'a saisi. Etendre `teams` aurait impose de percer ce
-- filtre sur l'objet dont dependent le moteur d'affectation, le planning et le
-- moteur menage — le chemin le plus sensible du produit (cf. audit IDOR
-- F1-01 a F1-09).
--
-- Ces tables sont donc PLATEFORME : aucune colonne `organization_id`
-- structurante, aucun filtre Hibernate. Le cloisonnement se fait par
-- l'autorisation (`SUPER_ADMIN` / `SUPER_MANAGER` sur l'API d'administration)
-- et non par le tenant.
--
-- LE PROFESSIONNEL EST TOUJOURS PORTE PAR UNE ORGANISATION : la sienne s'il
-- est independant, celle qui l'emploie s'il est rattache. `home_organization_id`
-- porte ce lien et reste NULL tant que la candidature n'est pas validee — un
-- professionnel qui s'inscrit depuis la landing n'a pas encore d'organisation
-- d'accueil. `engagement_mode` dit dans quelles conditions il travaille :
--   INDEPENDENT — sa propre organisation, ouvert a toutes les autres ;
--   AFFILIATED  — membre d'une organisation tierce, toujours expose au catalogue ;
--   EXCLUSIVE   — rattache exclusivement, retire du catalogue.
--
-- PAS DE CONTRAINTE CHECK SUR LES ENUMS : les 175 contraintes CHECK heritees
-- d'Hibernate ont ete supprimees au changeset 0274 precisement parce qu'elles
-- gelaient les enums et produisaient des bugs visibles en production seulement.
-- Les valeurs sont validees cote applicatif.

-- ─── Referentiel des categories de services ─────────────────────────────────
--
-- EN BASE ET NON EN ENUM JAVA : la liste des metiers est ouverte par nature
-- (menage, maintenance, blanchisserie, exterieurs, cuisine, chauffeur, guide,
-- garde d'enfants, bien-etre...). Un enum aurait impose un deploiement pour
-- chaque metier ajoute, et le referentiel doit rester administrable.
-- A distinguer de `ServiceType` / `InterventionType`, qui decrivent les
-- interventions PLANIFIEES dans le PMS et restent inchanges.
CREATE TABLE IF NOT EXISTS marketplace_service_categories (
    id           BIGSERIAL PRIMARY KEY,
    code         VARCHAR(40)  NOT NULL,
    label_fr     VARCHAR(80)  NOT NULL,
    label_en     VARCHAR(80)  NOT NULL,
    description  VARCHAR(300),
    icon_key     VARCHAR(40),
    sort_order   INTEGER      NOT NULL DEFAULT 0,
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_service_category_code
    ON marketplace_service_categories (code);

-- ─── Fiche professionnelle ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_providers (
    id                        BIGSERIAL PRIMARY KEY,

    -- Reference opaque servie aux surfaces publiques : jamais l'id sequentiel,
    -- qui donnerait le volume du catalogue et permettrait l'enumeration.
    public_ref                UUID         NOT NULL,

    display_name              VARCHAR(150) NOT NULL,
    legal_name                VARCHAR(200),
    contact_first_name        VARCHAR(80),
    contact_last_name         VARCHAR(80),
    email                     VARCHAR(320) NOT NULL,
    phone                     VARCHAR(40),
    website                   VARCHAR(300),

    headline                  VARCHAR(200),
    bio                       TEXT,
    avatar_url                VARCHAR(500),

    -- Point d'ancrage geographique. `travel_radius_km` complete les zones
    -- declarees : une zone dit « je couvre ce departement », le rayon dit
    -- « je me deplace jusque-la depuis ma base ».
    base_address              VARCHAR(200),
    base_city                 VARCHAR(80),
    base_postal_code          VARCHAR(10),
    base_country_code         VARCHAR(2)   NOT NULL DEFAULT 'FR',
    latitude                  NUMERIC(10,6),
    longitude                 NUMERIC(10,6),
    travel_radius_km          INTEGER,

    -- Langues parlees, codes ISO 639-1 separes par des virgules (fr,en,ar).
    -- Liste courte, jamais interrogee par son contenu : une colonne texte
    -- suffit et evite une table de jointure pour trois valeurs.
    languages                 VARCHAR(120),

    status                    VARCHAR(20)  NOT NULL DEFAULT 'PENDING_REVIEW',
    engagement_mode           VARCHAR(20)  NOT NULL DEFAULT 'INDEPENDENT',

    home_organization_id      BIGINT,
    user_id                   BIGINT,

    -- Conformite. Les pieces justificatives elles-memes vivent dans
    -- `provider_documents`, deja rattache a l'UTILISATEUR et non a
    -- l'organisation. Ces colonnes ne les dupliquent pas : elles portent les
    -- echeances, qui doivent etre filtrables et alertables sans ouvrir chaque
    -- document. L'absence d'attestation de vigilance a jour expose le donneur
    -- d'ordre a la solidarite financiere — c'est un filtre de premiere classe.
    registration_number       VARCHAR(40),
    vat_number                VARCHAR(40),
    insurance_company         VARCHAR(120),
    insurance_policy_number   VARCHAR(60),
    insurance_expires_at      DATE,
    vigilance_expires_at      DATE,

    -- Conditions commerciales generales, affichees sur la fiche. Les prix par
    -- prestation vivent dans `marketplace_provider_services`.
    currency                  VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    minimum_charge            NUMERIC(10,2),
    travel_fee                NUMERIC(10,2),
    accepts_urgent            BOOLEAN      NOT NULL DEFAULT FALSE,
    lead_time_hours           INTEGER,
    cancellation_notice_hours INTEGER,

    -- Agregats de reputation. DENORMALISES A DESSEIN : la liste affiche des
    -- cartes triables par note, et recalculer une moyenne par carte a chaque
    -- page imposerait une agregation par professionnel a chaque requete.
    -- Ils sont recalcules par le service, jamais saisis a la main.
    rating_avg                NUMERIC(3,2),
    rating_count              INTEGER      NOT NULL DEFAULT 0,
    completed_missions        INTEGER      NOT NULL DEFAULT 0,
    acceptance_rate_pct       NUMERIC(5,2),
    avg_response_minutes      INTEGER,

    -- Traçabilite de la moderation : qui a valide, quand, et pourquoi en cas
    -- de refus. `review_note` est lue par l'equipe plateforme, pas par le
    -- professionnel.
    verified_at               TIMESTAMP,
    verified_by_keycloak_id   VARCHAR(64),
    review_note               VARCHAR(500),

    source                    VARCHAR(20)  NOT NULL DEFAULT 'LANDING',
    submitted_at              TIMESTAMP,
    activated_at              TIMESTAMP,
    suspended_at              TIMESTAMP,
    last_active_at            TIMESTAMP,

    created_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_provider_public_ref
    ON marketplace_providers (public_ref);

-- Une seule candidature par adresse : sans cette contrainte, un formulaire
-- public re-soumis produit des doublons que la moderation doit trier a la main.
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_provider_email
    ON marketplace_providers (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_marketplace_provider_status
    ON marketplace_providers (status);
CREATE INDEX IF NOT EXISTS idx_marketplace_provider_engagement
    ON marketplace_providers (engagement_mode);
CREATE INDEX IF NOT EXISTS idx_marketplace_provider_org
    ON marketplace_providers (home_organization_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_provider_user
    ON marketplace_providers (user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_provider_geo
    ON marketplace_providers (base_country_code, base_city);

-- ─── Offres de service ──────────────────────────────────────────────────────
--
-- Un professionnel expose N prestations, chacune dans une categorie et avec
-- son propre modele de prix. `pricing_model` = HOURLY | FLAT | PER_UNIT |
-- PER_SQM | ON_QUOTE. ON_QUOTE laisse `amount` NULL : tout ne se tarife pas
-- d'avance, et forcer un montant produirait un prix faux plutot qu'absent.
CREATE TABLE IF NOT EXISTS marketplace_provider_services (
    id                  BIGSERIAL PRIMARY KEY,
    provider_id         BIGINT       NOT NULL,
    category_id         BIGINT       NOT NULL,
    label               VARCHAR(120) NOT NULL,
    description         VARCHAR(500),
    pricing_model       VARCHAR(20)  NOT NULL DEFAULT 'ON_QUOTE',
    amount              NUMERIC(10,2),
    currency            VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    unit_label          VARCHAR(40),
    min_duration_minutes INTEGER,
    active              BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order          INTEGER      NOT NULL DEFAULT 0,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP,
    CONSTRAINT fk_mp_service_provider FOREIGN KEY (provider_id)
        REFERENCES marketplace_providers (id) ON DELETE CASCADE,
    CONSTRAINT fk_mp_service_category FOREIGN KEY (category_id)
        REFERENCES marketplace_service_categories (id)
);

CREATE INDEX IF NOT EXISTS idx_mp_service_provider
    ON marketplace_provider_services (provider_id);
CREATE INDEX IF NOT EXISTS idx_mp_service_category
    ON marketplace_provider_services (category_id);

-- ─── Zones d'intervention ───────────────────────────────────────────────────
--
-- Meme granularite que `team_coverage_zones` (pays / departement / ville) pour
-- que les deux referentiels restent comparables le jour ou un professionnel du
-- catalogue est rattache a une organisation et doit alimenter le moteur
-- d'affectation existant.
CREATE TABLE IF NOT EXISTS marketplace_provider_zones (
    id           BIGSERIAL PRIMARY KEY,
    provider_id  BIGINT      NOT NULL,
    country_code VARCHAR(2)  NOT NULL DEFAULT 'FR',
    department   VARCHAR(3),
    city         VARCHAR(80),
    postal_code  VARCHAR(10),
    radius_km    INTEGER,
    is_primary   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mp_zone_provider FOREIGN KEY (provider_id)
        REFERENCES marketplace_providers (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mp_zone_provider
    ON marketplace_provider_zones (provider_id);
CREATE INDEX IF NOT EXISTS idx_mp_zone_lookup
    ON marketplace_provider_zones (country_code, department, city);

-- ─── Disponibilites hebdomadaires ───────────────────────────────────────────
--
-- MEME CONVENTION QUE `team_weekly_availability` : aucune declaration vaut
-- DISPONIBLE. Traiter le silence comme une indisponibilite sortirait du
-- catalogue tous les professionnels qui n'ont pas rempli leur agenda — c'est
-- la regle deja retenue dans ProviderAvailabilityService, et la changer ici
-- creerait deux semantiques contradictoires dans le meme produit.
-- `day_of_week` suit ISO-8601 : 1 = lundi, 7 = dimanche.
CREATE TABLE IF NOT EXISTS marketplace_provider_availability (
    id          BIGSERIAL PRIMARY KEY,
    provider_id BIGINT    NOT NULL,
    day_of_week SMALLINT  NOT NULL,
    start_time  TIME      NOT NULL,
    end_time    TIME      NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mp_availability_provider FOREIGN KEY (provider_id)
        REFERENCES marketplace_providers (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mp_availability_provider
    ON marketplace_provider_availability (provider_id);

-- ─── Amorce du referentiel ──────────────────────────────────────────────────
--
-- Les douze metiers d'ouverture. `ON CONFLICT DO NOTHING` rend le changeset
-- rejouable sans dupliquer : une reprise de migration ne doit pas produire un
-- referentiel en double.
INSERT INTO marketplace_service_categories (code, label_fr, label_en, description, icon_key, sort_order) VALUES
    ('CLEANING',      'Ménage',              'Housekeeping',      'Ménage entre deux séjours, remise en état, nettoyage en profondeur', 'cleaning',   10),
    ('MAINTENANCE',   'Maintenance',         'Maintenance',       'Plomberie, électricité, serrurerie, petits travaux',                 'handyman',   20),
    ('LAUNDRY',       'Blanchisserie',       'Laundry',           'Linge de maison, collecte et livraison, repassage',                  'laundry',    30),
    ('EXTERIOR',      'Extérieurs',          'Outdoor',           'Jardin, piscine, terrasse, façade',                                  'yard',       40),
    ('CULINARY',      'Cuisine',             'Culinary',          'Chef à domicile, traiteur, petit-déjeuner, paniers repas',           'culinary',   50),
    ('DRIVER',        'Chauffeur privé',     'Private driver',    'Transferts aéroport, mise à disposition, navette',                   'driver',     60),
    ('TOURIST_GUIDE', 'Guide touristique',   'Tour guide',        'Visites guidées, excursions, accompagnement',                        'guide',      70),
    ('CONCIERGE',     'Conciergerie',        'Concierge',         'Accueil voyageurs, remise des clés, assistance sur place',           'concierge',  80),
    ('CHILDCARE',     'Garde d''enfants',    'Childcare',         'Baby-sitting, animation enfants',                                    'childcare',  90),
    ('WELLNESS',      'Bien-être',           'Wellness',          'Massage, coiffure, soins à domicile',                                'wellness',  100),
    ('PHOTOGRAPHY',   'Photographie',        'Photography',       'Shooting des logements, visite virtuelle',                           'camera',    110),
    ('OTHER',         'Autre',               'Other',             'Prestation hors catégories',                                         'more',      999)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE marketplace_providers IS
  'Fiche professionnelle de la place de marche. Table PLATEFORME : pas de filtre tenant, l''acces passe par l''autorisation SUPER_ADMIN / SUPER_MANAGER.';
COMMENT ON COLUMN marketplace_providers.home_organization_id IS
  'Organisation porteuse : la sienne si independant, celle qui l''emploie si rattache. NULL tant que la candidature n''est pas validee.';
COMMENT ON COLUMN marketplace_providers.engagement_mode IS
  'INDEPENDENT (sa propre organisation, ouvert a tous) | AFFILIATED (membre d''une organisation tierce, toujours expose) | EXCLUSIVE (retire du catalogue).';
COMMENT ON COLUMN marketplace_providers.vigilance_expires_at IS
  'Echeance de l''attestation de vigilance URSSAF. Son absence expose le donneur d''ordre a la solidarite financiere : c''est un filtre, pas un detail.';
COMMENT ON COLUMN marketplace_providers.rating_avg IS
  'Agregat denormalise, recalcule par le service. Jamais saisi a la main.';
COMMENT ON TABLE marketplace_provider_availability IS
  'Creneaux hebdomadaires declares. Aucune declaration = DISPONIBLE, meme convention que team_weekly_availability.';
