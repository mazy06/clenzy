-- Referentiel des metiers et des prestations de la place de marche.
--
-- POURQUOI UN CATALOGUE ET PAS DU TEXTE LIBRE : au 0418, une prestation n'etait
-- qu'un `label` saisi a la main. Dix professionnels ecrivaient « menage fin de
-- sejour », « Menage sortie », « nettoyage apres depart » — trois libelles pour
-- une seule prestation, donc aucun filtre possible et aucune comparaison de
-- prix. Un catalogue rend la recherche exploitable et les prix comparables. Le
-- champ libre SURVIT a cote : un metier qui n'est pas dans la liste doit quand
-- meme pouvoir se vendre, c'est tout l'objet d'une place de marche ouverte.
--
-- DEUX ATTRIBUTS QUI PORTENT LE METIER, et qui manquaient :
--   * `recurrence` — ponctuel, par sejour, hebdomadaire, mensuel, saisonnier,
--     annuel, pluriannuel. C'est elle qui transforme une prestation en
--     ECHEANCE, donc en relance automatique. Sans elle, un ramonage annuel
--     obligatoire se gere comme une demande ponctuelle : il s'oublie.
--   * `payer` — proprietaire, voyageur, ou agence. C'est lui qui decide si la
--     prestation atterrit dans `provider_expenses` (cout refacture), dans
--     `upsell_orders` (vente au voyageur) ou dans une facture de commission.
--     Trois chemins comptables qui existent deja, et que rien ne choisissait.
--
-- `regulated` marque les prestations IMPOSEES par la loi (diagnostics,
-- ramonage, entretien de chaudiere, controle du dispositif de securite
-- piscine...). Ce sont les plus previsibles du catalogue : elles reviennent
-- qu'on le veuille ou non. Les distinguer permet de les traiter comme un
-- calendrier d'obligations plutot que comme un rayon parmi d'autres.
--
-- `family` groupe les metiers en quatre familles. Trente-deux pastilles de
-- filtre sur une ligne ne se lisent plus ; groupees, elles se parcourent.
--
-- PAS DE CONTRAINTE CHECK SUR LES ENUMS (cf. 0274 : les 175 contraintes heritees
-- d'Hibernate ont ete supprimees parce qu'elles gelaient les enums et
-- produisaient des bugs visibles en production seulement).

-- ─── Familles de metiers ────────────────────────────────────────────────────
ALTER TABLE marketplace_service_categories
    ADD COLUMN IF NOT EXISTS family VARCHAR(20) NOT NULL DEFAULT 'OPERATIONS';

CREATE INDEX IF NOT EXISTS idx_marketplace_category_family
    ON marketplace_service_categories (family, sort_order);

-- ─── Catalogue des prestations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_service_items (
    id                    BIGSERIAL PRIMARY KEY,
    code                  VARCHAR(60)  NOT NULL,
    category_id           BIGINT       NOT NULL,
    label_fr              VARCHAR(120) NOT NULL,
    label_en              VARCHAR(120) NOT NULL,
    description           VARCHAR(300),
    default_pricing_model VARCHAR(20)  NOT NULL DEFAULT 'ON_QUOTE',
    recurrence            VARCHAR(20)  NOT NULL DEFAULT 'ONE_OFF',
    payer                 VARCHAR(10)  NOT NULL DEFAULT 'OWNER',
    guest_sellable        BOOLEAN      NOT NULL DEFAULT FALSE,
    regulated             BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order            INTEGER      NOT NULL DEFAULT 0,
    active                BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP,
    CONSTRAINT fk_mp_service_item_category FOREIGN KEY (category_id)
        REFERENCES marketplace_service_categories (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_service_item_code
    ON marketplace_service_items (code);
CREATE INDEX IF NOT EXISTS idx_marketplace_service_item_category
    ON marketplace_service_items (category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_marketplace_service_item_guest
    ON marketplace_service_items (guest_sellable) WHERE guest_sellable;
CREATE INDEX IF NOT EXISTS idx_marketplace_service_item_regulated
    ON marketplace_service_items (regulated) WHERE regulated;

-- L'offre d'un professionnel pointe vers le catalogue QUAND elle correspond a
-- une prestation connue. Nullable a dessein : une prestation hors catalogue
-- garde son libelle libre et reste vendable.
ALTER TABLE marketplace_provider_services
    ADD COLUMN IF NOT EXISTS service_item_id BIGINT;

-- Idempotent sans bloc PL/pgSQL : PostgreSQL ne connait pas
-- `ADD CONSTRAINT IF NOT EXISTS`, mais `DROP ... IF EXISTS` puis `ADD` donne le
-- meme resultat et garde le decoupage d'instructions par defaut de Liquibase.
ALTER TABLE marketplace_provider_services
    DROP CONSTRAINT IF EXISTS fk_mp_service_item;

ALTER TABLE marketplace_provider_services
    ADD CONSTRAINT fk_mp_service_item FOREIGN KEY (service_item_id)
    REFERENCES marketplace_service_items (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mp_service_item_ref
    ON marketplace_provider_services (service_item_id);

-- ─── Famille des metiers deja amorces au 0418 ──────────────────────────────
UPDATE marketplace_service_categories SET family = 'OPERATIONS', sort_order = 10, icon_key = 'cleaning', label_fr = 'Ménage', description = 'Ménage entre deux séjours, remise en état, nettoyage en profondeur' WHERE code = 'CLEANING';
UPDATE marketplace_service_categories SET family = 'OPERATIONS', sort_order = 20, icon_key = 'laundry', label_fr = 'Blanchisserie', description = 'Lavage, repassage, collecte et livraison du linge' WHERE code = 'LAUNDRY';
UPDATE marketplace_service_categories SET family = 'OPERATIONS', sort_order = 30, icon_key = 'linen', label_fr = 'Fourniture de linge', description = 'Location et renouvellement des parures et du linge de toilette' WHERE code = 'LINEN';
UPDATE marketplace_service_categories SET family = 'OPERATIONS', sort_order = 40, icon_key = 'supplies', label_fr = 'Consommables', description = 'Produits d''accueil, café, entretien, réassort' WHERE code = 'SUPPLIES';
UPDATE marketplace_service_categories SET family = 'OPERATIONS', sort_order = 50, icon_key = 'keys', label_fr = 'Clés & accueil', description = 'Remise des clés, accueil physique, serrures et boîtes à clés' WHERE code = 'KEYS';
UPDATE marketplace_service_categories SET family = 'OPERATIONS', sort_order = 60, icon_key = 'logistics', label_fr = 'Logistique', description = 'Coursier, bagagerie, navette linge, débarras' WHERE code = 'LOGISTICS';
UPDATE marketplace_service_categories SET family = 'OPERATIONS', sort_order = 70, icon_key = 'security', label_fr = 'Gardiennage & sécurité', description = 'Rondes, télésurveillance, intervention sur alerte' WHERE code = 'SECURITY';
UPDATE marketplace_service_categories SET family = 'OPERATIONS', sort_order = 80, icon_key = 'concierge', label_fr = 'Conciergerie', description = 'Assistance voyageur, réservations, accompagnement sur place' WHERE code = 'CONCIERGE';
UPDATE marketplace_service_categories SET family = 'TECHNICAL', sort_order = 110, icon_key = 'handyman', label_fr = 'Maintenance', description = 'Plomberie, électricité, électroménager, petits travaux' WHERE code = 'MAINTENANCE';
UPDATE marketplace_service_categories SET family = 'TECHNICAL', sort_order = 120, icon_key = 'locksmith', label_fr = 'Serrurerie & dépannage', description = 'Ouverture de porte, cylindres, serrures connectées' WHERE code = 'LOCKSMITH';
UPDATE marketplace_service_categories SET family = 'TECHNICAL', sort_order = 130, icon_key = 'yard', label_fr = 'Extérieurs & jardin', description = 'Jardin, terrasse, façade, gouttières, déneigement' WHERE code = 'EXTERIOR';
UPDATE marketplace_service_categories SET family = 'TECHNICAL', sort_order = 140, icon_key = 'pool', label_fr = 'Piscine & spa', description = 'Entretien, hivernage, ouverture de saison, sécurité' WHERE code = 'POOL';
UPDATE marketplace_service_categories SET family = 'TECHNICAL', sort_order = 150, icon_key = 'pest', label_fr = 'Nuisibles', description = 'Dératisation, désinsectisation, punaises de lit' WHERE code = 'PEST_CONTROL';
UPDATE marketplace_service_categories SET family = 'TECHNICAL', sort_order = 160, icon_key = 'regulatory', label_fr = 'Contrôles réglementaires', description = 'Diagnostics, ramonage, chaudière, sécurité piscine, extincteurs' WHERE code = 'REGULATORY';
UPDATE marketplace_service_categories SET family = 'TECHNICAL', sort_order = 170, icon_key = 'renovation', label_fr = 'Travaux & rénovation', description = 'Peinture, second œuvre, conduite de chantier' WHERE code = 'RENOVATION';
UPDATE marketplace_service_categories SET family = 'GUEST', sort_order = 210, icon_key = 'culinary', label_fr = 'Cuisine', description = 'Chef à domicile, traiteur, petit-déjeuner, paniers repas' WHERE code = 'CULINARY';
UPDATE marketplace_service_categories SET family = 'GUEST', sort_order = 220, icon_key = 'driver', label_fr = 'Chauffeur privé', description = 'Transferts, mise à disposition, navette' WHERE code = 'DRIVER';
UPDATE marketplace_service_categories SET family = 'GUEST', sort_order = 230, icon_key = 'mobility', label_fr = 'Location de véhicules', description = 'Voiture, scooter, vélo, place de parking' WHERE code = 'MOBILITY';
UPDATE marketplace_service_categories SET family = 'GUEST', sort_order = 240, icon_key = 'guide', label_fr = 'Guide touristique', description = 'Visites guidées, médina, randonnée, musées' WHERE code = 'TOURIST_GUIDE';
UPDATE marketplace_service_categories SET family = 'GUEST', sort_order = 250, icon_key = 'activities', label_fr = 'Activités & excursions', description = 'Excursions, sports, billetterie, club enfants' WHERE code = 'ACTIVITIES';
UPDATE marketplace_service_categories SET family = 'GUEST', sort_order = 260, icon_key = 'wellness', label_fr = 'Bien-être', description = 'Massage, hammam, coiffure, soins, coaching' WHERE code = 'WELLNESS';
UPDATE marketplace_service_categories SET family = 'GUEST', sort_order = 270, icon_key = 'childcare', label_fr = 'Garde d''enfants', description = 'Baby-sitting, garde de nuit, animation' WHERE code = 'CHILDCARE';
UPDATE marketplace_service_categories SET family = 'GUEST', sort_order = 280, icon_key = 'pet', label_fr = 'Animaux', description = 'Garde, promenade, toilettage, kit animal' WHERE code = 'PET_CARE';
UPDATE marketplace_service_categories SET family = 'GUEST', sort_order = 290, icon_key = 'equipment', label_fr = 'Location d''équipement', description = 'Lit bébé, skis, planches, barbecue, lit d''appoint' WHERE code = 'EQUIPMENT_RENTAL';
UPDATE marketplace_service_categories SET family = 'OWNER', sort_order = 310, icon_key = 'camera', label_fr = 'Photographie', description = 'Shooting, visite virtuelle, drone, vidéo, plan coté' WHERE code = 'PHOTOGRAPHY';
UPDATE marketplace_service_categories SET family = 'OWNER', sort_order = 320, icon_key = 'furnishing', label_fr = 'Ameublement & décoration', description = 'Home staging, mobilier, artisanat, kit d''équipement' WHERE code = 'FURNISHING';
UPDATE marketplace_service_categories SET family = 'OWNER', sort_order = 330, icon_key = 'marketing', label_fr = 'Annonces & visibilité', description = 'Rédaction, traduction, référencement, avis' WHERE code = 'MARKETING';
UPDATE marketplace_service_categories SET family = 'OWNER', sort_order = 340, icon_key = 'admin', label_fr = 'Démarches & juridique', description = 'Déclaration en mairie, classement, litiges, contrats' WHERE code = 'ADMIN_LEGAL';
UPDATE marketplace_service_categories SET family = 'OWNER', sort_order = 350, icon_key = 'accounting', label_fr = 'Comptabilité & fiscalité', description = 'LMNP, liasse fiscale, TVA, tenue de livres' WHERE code = 'ACCOUNTING';
UPDATE marketplace_service_categories SET family = 'OWNER', sort_order = 360, icon_key = 'insurance', label_fr = 'Assurance', description = 'PNO, RC villégiature, garanties voyageur' WHERE code = 'INSURANCE';
UPDATE marketplace_service_categories SET family = 'OWNER', sort_order = 370, icon_key = 'utilities', label_fr = 'Énergie & connectivité', description = 'Courtage énergie, internet, wifi, compteurs, borne de recharge' WHERE code = 'UTILITIES';
UPDATE marketplace_service_categories SET family = 'OTHER', sort_order = 999, icon_key = 'more', label_fr = 'Autre', description = 'Prestation hors catégories' WHERE code = 'OTHER';

-- ─── Metiers (creation des manquants, mise a jour des existants ci-dessus) ──
INSERT INTO marketplace_service_categories (code, label_fr, label_en, description, icon_key, family, sort_order)
VALUES
    ('CLEANING', 'Ménage', 'Housekeeping', 'Ménage entre deux séjours, remise en état, nettoyage en profondeur', 'cleaning', 'OPERATIONS', 10),
    ('LAUNDRY', 'Blanchisserie', 'Laundry', 'Lavage, repassage, collecte et livraison du linge', 'laundry', 'OPERATIONS', 20),
    ('LINEN', 'Fourniture de linge', 'Linen supply', 'Location et renouvellement des parures et du linge de toilette', 'linen', 'OPERATIONS', 30),
    ('SUPPLIES', 'Consommables', 'Supplies', 'Produits d''accueil, café, entretien, réassort', 'supplies', 'OPERATIONS', 40),
    ('KEYS', 'Clés & accueil', 'Keys & check-in', 'Remise des clés, accueil physique, serrures et boîtes à clés', 'keys', 'OPERATIONS', 50),
    ('LOGISTICS', 'Logistique', 'Logistics', 'Coursier, bagagerie, navette linge, débarras', 'logistics', 'OPERATIONS', 60),
    ('SECURITY', 'Gardiennage & sécurité', 'Security', 'Rondes, télésurveillance, intervention sur alerte', 'security', 'OPERATIONS', 70),
    ('CONCIERGE', 'Conciergerie', 'Concierge', 'Assistance voyageur, réservations, accompagnement sur place', 'concierge', 'OPERATIONS', 80),
    ('MAINTENANCE', 'Maintenance', 'Maintenance', 'Plomberie, électricité, électroménager, petits travaux', 'handyman', 'TECHNICAL', 110),
    ('LOCKSMITH', 'Serrurerie & dépannage', 'Locksmith', 'Ouverture de porte, cylindres, serrures connectées', 'locksmith', 'TECHNICAL', 120),
    ('EXTERIOR', 'Extérieurs & jardin', 'Outdoor', 'Jardin, terrasse, façade, gouttières, déneigement', 'yard', 'TECHNICAL', 130),
    ('POOL', 'Piscine & spa', 'Pool & spa', 'Entretien, hivernage, ouverture de saison, sécurité', 'pool', 'TECHNICAL', 140),
    ('PEST_CONTROL', 'Nuisibles', 'Pest control', 'Dératisation, désinsectisation, punaises de lit', 'pest', 'TECHNICAL', 150),
    ('REGULATORY', 'Contrôles réglementaires', 'Regulatory checks', 'Diagnostics, ramonage, chaudière, sécurité piscine, extincteurs', 'regulatory', 'TECHNICAL', 160),
    ('RENOVATION', 'Travaux & rénovation', 'Renovation', 'Peinture, second œuvre, conduite de chantier', 'renovation', 'TECHNICAL', 170),
    ('CULINARY', 'Cuisine', 'Culinary', 'Chef à domicile, traiteur, petit-déjeuner, paniers repas', 'culinary', 'GUEST', 210),
    ('DRIVER', 'Chauffeur privé', 'Private driver', 'Transferts, mise à disposition, navette', 'driver', 'GUEST', 220),
    ('MOBILITY', 'Location de véhicules', 'Vehicle rental', 'Voiture, scooter, vélo, place de parking', 'mobility', 'GUEST', 230),
    ('TOURIST_GUIDE', 'Guide touristique', 'Tour guide', 'Visites guidées, médina, randonnée, musées', 'guide', 'GUEST', 240),
    ('ACTIVITIES', 'Activités & excursions', 'Activities', 'Excursions, sports, billetterie, club enfants', 'activities', 'GUEST', 250),
    ('WELLNESS', 'Bien-être', 'Wellness', 'Massage, hammam, coiffure, soins, coaching', 'wellness', 'GUEST', 260),
    ('CHILDCARE', 'Garde d''enfants', 'Childcare', 'Baby-sitting, garde de nuit, animation', 'childcare', 'GUEST', 270),
    ('PET_CARE', 'Animaux', 'Pet care', 'Garde, promenade, toilettage, kit animal', 'pet', 'GUEST', 280),
    ('EQUIPMENT_RENTAL', 'Location d''équipement', 'Equipment rental', 'Lit bébé, skis, planches, barbecue, lit d''appoint', 'equipment', 'GUEST', 290),
    ('PHOTOGRAPHY', 'Photographie', 'Photography', 'Shooting, visite virtuelle, drone, vidéo, plan coté', 'camera', 'OWNER', 310),
    ('FURNISHING', 'Ameublement & décoration', 'Furnishing', 'Home staging, mobilier, artisanat, kit d''équipement', 'furnishing', 'OWNER', 320),
    ('MARKETING', 'Annonces & visibilité', 'Marketing', 'Rédaction, traduction, référencement, avis', 'marketing', 'OWNER', 330),
    ('ADMIN_LEGAL', 'Démarches & juridique', 'Admin & legal', 'Déclaration en mairie, classement, litiges, contrats', 'admin', 'OWNER', 340),
    ('ACCOUNTING', 'Comptabilité & fiscalité', 'Accounting', 'LMNP, liasse fiscale, TVA, tenue de livres', 'accounting', 'OWNER', 350),
    ('INSURANCE', 'Assurance', 'Insurance', 'PNO, RC villégiature, garanties voyageur', 'insurance', 'OWNER', 360),
    ('UTILITIES', 'Énergie & connectivité', 'Utilities', 'Courtage énergie, internet, wifi, compteurs, borne de recharge', 'utilities', 'OWNER', 370),
    ('OTHER', 'Autre', 'Other', 'Prestation hors catégories', 'more', 'OTHER', 999)
ON CONFLICT (code) DO NOTHING;

-- ─── Prestations types (210 entrees) ─────────────────────────────
-- Une seule instruction plutot que 210 : la jointure sur le code de
-- metier evite de coder en dur des identifiants qui different d'un environnement
-- a l'autre. `ON CONFLICT` rend le changeset rejouable sans doublon.
INSERT INTO marketplace_service_items
    (code, category_id, label_fr, label_en, default_pricing_model, recurrence, payer, guest_sellable, regulated, sort_order)
SELECT v.code, c.id, v.label_fr, v.label_en, v.pricing, v.recurrence, v.payer, v.guest_sellable, v.regulated, v.sort_order
FROM (VALUES
    ('cleaning-turnover', 'CLEANING', 'Ménage entre deux séjours', 'Turnover cleaning', 'FLAT', 'PER_STAY', 'OWNER', false, false, 10),
    ('cleaning-mid-stay', 'CLEANING', 'Ménage en cours de séjour', 'Mid-stay cleaning', 'FLAT', 'PER_STAY', 'GUEST', true, false, 20),
    ('cleaning-deep', 'CLEANING', 'Ménage en profondeur', 'Deep cleaning', 'FLAT', 'SEASONAL', 'OWNER', false, false, 30),
    ('cleaning-season-start', 'CLEANING', 'Remise en état de début de saison', 'Season opening clean', 'FLAT', 'SEASONAL', 'OWNER', false, false, 40),
    ('cleaning-windows', 'CLEANING', 'Nettoyage des vitres', 'Window cleaning', 'FLAT', 'SEASONAL', 'OWNER', false, false, 50),
    ('cleaning-carpet', 'CLEANING', 'Nettoyage moquettes & tapis', 'Carpet cleaning', 'PER_SQM', 'ONE_OFF', 'OWNER', false, false, 60),
    ('cleaning-upholstery', 'CLEANING', 'Nettoyage canapés & matelas', 'Upholstery cleaning', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 70),
    ('cleaning-post-works', 'CLEANING', 'Nettoyage de fin de chantier', 'Post-construction cleaning', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 80),
    ('cleaning-disinfection', 'CLEANING', 'Désinfection', 'Disinfection', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 90),
    ('cleaning-common-areas', 'CLEANING', 'Parties communes', 'Common areas', 'HOURLY', 'WEEKLY', 'OWNER', false, false, 100),
    ('laundry-bed-linen', 'LAUNDRY', 'Lavage du linge de lit', 'Bed linen washing', 'PER_UNIT', 'PER_STAY', 'OWNER', false, false, 10),
    ('laundry-towels', 'LAUNDRY', 'Lavage du linge de toilette', 'Towel washing', 'PER_UNIT', 'PER_STAY', 'OWNER', false, false, 20),
    ('laundry-ironing', 'LAUNDRY', 'Repassage', 'Ironing', 'HOURLY', 'PER_STAY', 'OWNER', false, false, 30),
    ('laundry-pickup', 'LAUNDRY', 'Collecte et livraison', 'Pickup and delivery', 'FLAT', 'PER_STAY', 'OWNER', false, false, 40),
    ('laundry-guest-express', 'LAUNDRY', 'Blanchisserie express du voyageur', 'Guest express laundry', 'FLAT', 'PER_STAY', 'GUEST', true, false, 50),
    ('laundry-dry-cleaning', 'LAUNDRY', 'Pressing', 'Dry cleaning', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 60),
    ('laundry-curtains', 'LAUNDRY', 'Rideaux et voilages', 'Curtains', 'FLAT', 'ANNUAL', 'OWNER', false, false, 70),
    ('linen-rental-bed', 'LINEN', 'Location de parures de lit', 'Bed linen rental', 'PER_UNIT', 'PER_STAY', 'OWNER', false, false, 10),
    ('linen-rental-towels', 'LINEN', 'Location de linge de toilette', 'Towel rental', 'PER_UNIT', 'PER_STAY', 'OWNER', false, false, 20),
    ('linen-purchase', 'LINEN', 'Achat de linge neuf', 'New linen purchase', 'PER_UNIT', 'ONE_OFF', 'OWNER', false, false, 30),
    ('linen-renewal', 'LINEN', 'Renouvellement du parc', 'Linen stock renewal', 'FLAT', 'ANNUAL', 'OWNER', false, false, 40),
    ('linen-baby', 'LINEN', 'Linge bébé', 'Baby linen', 'FLAT', 'PER_STAY', 'GUEST', true, false, 50),
    ('supplies-welcome-kit', 'SUPPLIES', 'Produits d''accueil', 'Welcome amenities', 'PER_UNIT', 'PER_STAY', 'OWNER', false, false, 10),
    ('supplies-coffee', 'SUPPLIES', 'Café et capsules', 'Coffee and capsules', 'FLAT', 'MONTHLY', 'OWNER', false, false, 20),
    ('supplies-cleaning-products', 'SUPPLIES', 'Produits d''entretien', 'Cleaning products', 'FLAT', 'MONTHLY', 'OWNER', false, false, 30),
    ('supplies-paper', 'SUPPLIES', 'Papier et essuie-tout', 'Paper goods', 'FLAT', 'MONTHLY', 'OWNER', false, false, 40),
    ('supplies-welcome-basket', 'SUPPLIES', 'Panier de bienvenue', 'Welcome basket', 'FLAT', 'PER_STAY', 'GUEST', true, false, 50),
    ('supplies-grocery-arrival', 'SUPPLIES', 'Courses à l''arrivée', 'Arrival grocery shopping', 'FLAT', 'PER_STAY', 'GUEST', true, false, 60),
    ('keys-checkin', 'KEYS', 'Accueil physique et remise des clés', 'In-person check-in', 'FLAT', 'PER_STAY', 'OWNER', false, false, 10),
    ('keys-checkout', 'KEYS', 'État des lieux de départ', 'Check-out inspection', 'FLAT', 'PER_STAY', 'OWNER', false, false, 20),
    ('keys-lockbox-install', 'KEYS', 'Pose de boîte à clés', 'Lockbox installation', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 30),
    ('keys-smartlock-install', 'KEYS', 'Installation de serrure connectée', 'Smart lock installation', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 40),
    ('keys-duplicate', 'KEYS', 'Reproduction de clés', 'Key duplication', 'PER_UNIT', 'ONE_OFF', 'OWNER', false, false, 50),
    ('keys-emergency-handover', 'KEYS', 'Remise de clés en urgence', 'Emergency key handover', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 60),
    ('logistics-luggage-storage', 'LOGISTICS', 'Consigne à bagages', 'Luggage storage', 'PER_UNIT', 'PER_STAY', 'GUEST', true, false, 10),
    ('logistics-courier', 'LOGISTICS', 'Coursier', 'Courier', 'FLAT', 'ONE_OFF', 'AGENCY', false, false, 20),
    ('logistics-linen-shuttle', 'LOGISTICS', 'Navette linge', 'Linen shuttle', 'FLAT', 'WEEKLY', 'AGENCY', false, false, 30),
    ('logistics-waste', 'LOGISTICS', 'Débarras et déchetterie', 'Waste removal', 'FLAT', 'SEASONAL', 'OWNER', false, false, 40),
    ('logistics-moving', 'LOGISTICS', 'Petit déménagement', 'Small removal', 'HOURLY', 'ONE_OFF', 'OWNER', false, false, 50),
    ('logistics-parcel', 'LOGISTICS', 'Réception de colis', 'Parcel reception', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 60),
    ('security-patrol', 'SECURITY', 'Rondes de surveillance', 'Security patrol', 'FLAT', 'WEEKLY', 'OWNER', false, false, 10),
    ('security-caretaker', 'SECURITY', 'Gardiennage saisonnier', 'Seasonal caretaking', 'MONTHLY', 'SEASONAL', 'OWNER', false, false, 20),
    ('security-alarm-install', 'SECURITY', 'Installation d''alarme', 'Alarm installation', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 30),
    ('security-monitoring', 'SECURITY', 'Télésurveillance', 'Remote monitoring', 'FLAT', 'MONTHLY', 'OWNER', false, false, 40),
    ('security-noise-response', 'SECURITY', 'Intervention sur alerte bruit', 'Noise alert response', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 50),
    ('security-event-staff', 'SECURITY', 'Agent de sécurité événementiel', 'Event security', 'HOURLY', 'ONE_OFF', 'GUEST', true, false, 60),
    ('concierge-guest-support', 'CONCIERGE', 'Assistance voyageur 24/7', '24/7 guest support', 'MONTHLY', 'PER_STAY', 'OWNER', false, false, 10),
    ('concierge-online-checkin', 'CONCIERGE', 'Accompagnement au check-in en ligne', 'Online check-in support', 'FLAT', 'PER_STAY', 'OWNER', false, false, 20),
    ('concierge-bookings', 'CONCIERGE', 'Réservation de restaurants et activités', 'Restaurant and activity booking', 'FLAT', 'PER_STAY', 'GUEST', true, false, 30),
    ('concierge-luxury', 'CONCIERGE', 'Conciergerie de luxe', 'Luxury concierge', 'HOURLY', 'ONE_OFF', 'GUEST', true, false, 40),
    ('concierge-multilingual', 'CONCIERGE', 'Assistance multilingue', 'Multilingual support', 'HOURLY', 'PER_STAY', 'OWNER', false, false, 50),
    ('maintenance-preventive', 'MAINTENANCE', 'Visite de maintenance préventive', 'Preventive maintenance visit', 'FLAT', 'SEASONAL', 'OWNER', false, false, 10),
    ('maintenance-plumbing', 'MAINTENANCE', 'Dépannage plomberie', 'Plumbing repair', 'HOURLY', 'ONE_OFF', 'OWNER', false, false, 20),
    ('maintenance-electrical', 'MAINTENANCE', 'Dépannage électricité', 'Electrical repair', 'HOURLY', 'ONE_OFF', 'OWNER', false, false, 30),
    ('maintenance-appliance', 'MAINTENANCE', 'Réparation électroménager', 'Appliance repair', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 40),
    ('maintenance-hvac', 'MAINTENANCE', 'Climatisation et chauffage', 'HVAC repair', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 50),
    ('maintenance-handyman', 'MAINTENANCE', 'Petits travaux polyvalents', 'General handyman', 'HOURLY', 'ONE_OFF', 'OWNER', false, false, 60),
    ('maintenance-glazing', 'MAINTENANCE', 'Vitrerie', 'Glazing', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 70),
    ('maintenance-furniture-assembly', 'MAINTENANCE', 'Montage de meubles', 'Furniture assembly', 'HOURLY', 'ONE_OFF', 'OWNER', false, false, 80),
    ('maintenance-bedding', 'MAINTENANCE', 'Remplacement de literie', 'Bedding replacement', 'PER_UNIT', 'ONE_OFF', 'OWNER', false, false, 90),
    ('maintenance-descaling', 'MAINTENANCE', 'Détartrage et désembouage', 'Descaling and flushing', 'FLAT', 'ANNUAL', 'OWNER', false, false, 100),
    ('maintenance-emergency', 'MAINTENANCE', 'Intervention d''urgence', 'Emergency call-out', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 110),
    ('locksmith-lockout', 'LOCKSMITH', 'Ouverture de porte', 'Door opening', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 10),
    ('locksmith-cylinder', 'LOCKSMITH', 'Remplacement de cylindre', 'Cylinder replacement', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 20),
    ('locksmith-reinforcement', 'LOCKSMITH', 'Blindage et sécurisation', 'Door reinforcement', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 30),
    ('locksmith-smartlock-repair', 'LOCKSMITH', 'Dépannage de serrure connectée', 'Smart lock repair', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 40),
    ('locksmith-lost-key', 'LOCKSMITH', 'Dépannage clé perdue', 'Lost key call-out', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 50),
    ('exterior-garden', 'EXTERIOR', 'Entretien du jardin', 'Garden maintenance', 'MONTHLY', 'MONTHLY', 'OWNER', false, false, 10),
    ('exterior-lawn', 'EXTERIOR', 'Tonte', 'Lawn mowing', 'FLAT', 'MONTHLY', 'OWNER', false, false, 20),
    ('exterior-pruning', 'EXTERIOR', 'Élagage et taille', 'Pruning', 'FLAT', 'ANNUAL', 'OWNER', false, false, 30),
    ('exterior-irrigation', 'EXTERIOR', 'Arrosage automatique', 'Irrigation system', 'FLAT', 'SEASONAL', 'OWNER', false, false, 40),
    ('exterior-terrace', 'EXTERIOR', 'Nettoyage de terrasse', 'Terrace cleaning', 'PER_SQM', 'SEASONAL', 'OWNER', false, false, 50),
    ('exterior-facade', 'EXTERIOR', 'Nettoyage de façade', 'Facade cleaning', 'PER_SQM', 'ANNUAL', 'OWNER', false, false, 60),
    ('exterior-gutters', 'EXTERIOR', 'Gouttières', 'Gutter cleaning', 'FLAT', 'ANNUAL', 'OWNER', false, false, 70),
    ('exterior-snow', 'EXTERIOR', 'Déneigement et pose de chaînes', 'Snow clearing', 'FLAT', 'SEASONAL', 'OWNER', false, false, 80),
    ('exterior-garden-furniture', 'EXTERIOR', 'Mobilier de jardin (sortie et rentrée)', 'Garden furniture handling', 'FLAT', 'SEASONAL', 'OWNER', false, false, 90),
    ('pool-weekly', 'POOL', 'Entretien hebdomadaire', 'Weekly pool service', 'FLAT', 'WEEKLY', 'OWNER', false, false, 10),
    ('pool-opening', 'POOL', 'Ouverture de saison', 'Season opening', 'FLAT', 'ANNUAL', 'OWNER', false, false, 20),
    ('pool-winterizing', 'POOL', 'Hivernage', 'Winterizing', 'FLAT', 'ANNUAL', 'OWNER', false, false, 30),
    ('pool-water-analysis', 'POOL', 'Analyse de l''eau', 'Water analysis', 'FLAT', 'MONTHLY', 'OWNER', false, false, 40),
    ('pool-spa', 'POOL', 'Entretien spa et jacuzzi', 'Spa maintenance', 'FLAT', 'WEEKLY', 'OWNER', false, false, 50),
    ('pool-repair', 'POOL', 'Réparation pompe et filtration', 'Pump and filter repair', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 60),
    ('pool-safety-check', 'POOL', 'Contrôle du dispositif de sécurité', 'Safety device inspection', 'FLAT', 'ANNUAL', 'OWNER', false, true, 70),
    ('pool-heating', 'POOL', 'Mise en service du chauffage', 'Pool heating start-up', 'FLAT', 'SEASONAL', 'OWNER', false, false, 80),
    ('pest-inspection', 'PEST_CONTROL', 'Diagnostic nuisibles', 'Pest inspection', 'FLAT', 'ANNUAL', 'OWNER', false, false, 10),
    ('pest-bedbugs', 'PEST_CONTROL', 'Traitement punaises de lit', 'Bed bug treatment', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 20),
    ('pest-rodents', 'PEST_CONTROL', 'Dératisation', 'Rodent control', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 30),
    ('pest-insects', 'PEST_CONTROL', 'Désinsectisation', 'Insect control', 'FLAT', 'SEASONAL', 'OWNER', false, false, 40),
    ('pest-nests', 'PEST_CONTROL', 'Destruction de nids', 'Nest removal', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 50),
    ('pest-prevention', 'PEST_CONTROL', 'Contrat de prévention', 'Prevention contract', 'MONTHLY', 'ANNUAL', 'OWNER', false, false, 60),
    ('regulatory-dpe', 'REGULATORY', 'Diagnostic de performance énergétique', 'Energy performance certificate', 'FLAT', 'MULTI_YEAR', 'OWNER', false, true, 10),
    ('regulatory-electrical', 'REGULATORY', 'Diagnostic électricité', 'Electrical inspection', 'FLAT', 'MULTI_YEAR', 'OWNER', false, true, 20),
    ('regulatory-gas', 'REGULATORY', 'Diagnostic gaz', 'Gas inspection', 'FLAT', 'MULTI_YEAR', 'OWNER', false, true, 30),
    ('regulatory-asbestos', 'REGULATORY', 'Diagnostic amiante', 'Asbestos survey', 'FLAT', 'MULTI_YEAR', 'OWNER', false, true, 40),
    ('regulatory-lead', 'REGULATORY', 'Constat de risque d''exposition au plomb', 'Lead exposure report', 'FLAT', 'MULTI_YEAR', 'OWNER', false, true, 50),
    ('regulatory-erp', 'REGULATORY', 'État des risques et pollutions', 'Risks and pollution statement', 'FLAT', 'MULTI_YEAR', 'OWNER', false, true, 60),
    ('regulatory-chimney', 'REGULATORY', 'Ramonage', 'Chimney sweeping', 'FLAT', 'ANNUAL', 'OWNER', false, true, 70),
    ('regulatory-boiler', 'REGULATORY', 'Entretien de chaudière', 'Boiler servicing', 'FLAT', 'ANNUAL', 'OWNER', false, true, 80),
    ('regulatory-hvac-check', 'REGULATORY', 'Contrôle de climatisation', 'Air conditioning inspection', 'FLAT', 'ANNUAL', 'OWNER', false, true, 90),
    ('regulatory-smoke-detector', 'REGULATORY', 'Vérification des détecteurs de fumée', 'Smoke detector check', 'FLAT', 'ANNUAL', 'OWNER', false, true, 100),
    ('regulatory-extinguisher', 'REGULATORY', 'Vérification des extincteurs', 'Extinguisher check', 'PER_UNIT', 'ANNUAL', 'OWNER', false, true, 110),
    ('regulatory-legionella', 'REGULATORY', 'Analyse légionelle', 'Legionella testing', 'FLAT', 'ANNUAL', 'OWNER', false, true, 120),
    ('regulatory-electrical-periodic', 'REGULATORY', 'Vérification électrique périodique', 'Periodic electrical check', 'FLAT', 'ANNUAL', 'OWNER', false, true, 130),
    ('regulatory-classification', 'REGULATORY', 'Visite de classement meublé de tourisme', 'Tourism classification visit', 'FLAT', 'MULTI_YEAR', 'OWNER', false, true, 140),
    ('regulatory-accessibility', 'REGULATORY', 'Diagnostic accessibilité', 'Accessibility assessment', 'FLAT', 'ONE_OFF', 'OWNER', false, true, 150),
    ('renovation-painting', 'RENOVATION', 'Peinture et rafraîchissement', 'Painting and refresh', 'PER_SQM', 'SEASONAL', 'OWNER', false, false, 10),
    ('renovation-bathroom', 'RENOVATION', 'Rénovation de salle de bain', 'Bathroom renovation', 'ON_QUOTE', 'ONE_OFF', 'OWNER', false, false, 20),
    ('renovation-kitchen', 'RENOVATION', 'Rénovation de cuisine', 'Kitchen renovation', 'ON_QUOTE', 'ONE_OFF', 'OWNER', false, false, 30),
    ('renovation-flooring', 'RENOVATION', 'Sols et revêtements', 'Flooring', 'PER_SQM', 'ONE_OFF', 'OWNER', false, false, 40),
    ('renovation-carpentry', 'RENOVATION', 'Menuiserie', 'Carpentry', 'ON_QUOTE', 'ONE_OFF', 'OWNER', false, false, 50),
    ('renovation-insulation', 'RENOVATION', 'Isolation', 'Insulation', 'PER_SQM', 'ONE_OFF', 'OWNER', false, false, 60),
    ('renovation-project-management', 'RENOVATION', 'Conduite de chantier', 'Project management', 'ON_QUOTE', 'ONE_OFF', 'OWNER', false, false, 70),
    ('renovation-survey', 'RENOVATION', 'Étude et chiffrage', 'Survey and costing', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 80),
    ('culinary-private-chef', 'CULINARY', 'Chef à domicile', 'Private chef', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 10),
    ('culinary-breakfast', 'CULINARY', 'Petit-déjeuner livré', 'Breakfast delivery', 'PER_UNIT', 'PER_STAY', 'GUEST', true, false, 20),
    ('culinary-catering', 'CULINARY', 'Traiteur', 'Catering', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 30),
    ('culinary-meal-delivery', 'CULINARY', 'Livraison de repas', 'Meal delivery', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 40),
    ('culinary-cooking-class', 'CULINARY', 'Cours de cuisine', 'Cooking class', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 50),
    ('culinary-bbq', 'CULINARY', 'Service barbecue', 'Barbecue service', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 60),
    ('culinary-bartender', 'CULINARY', 'Barman à domicile', 'Private bartender', 'HOURLY', 'ONE_OFF', 'GUEST', true, false, 70),
    ('driver-airport', 'DRIVER', 'Transfert aéroport', 'Airport transfer', 'FLAT', 'PER_STAY', 'GUEST', true, false, 10),
    ('driver-station', 'DRIVER', 'Transfert gare', 'Station transfer', 'FLAT', 'PER_STAY', 'GUEST', true, false, 20),
    ('driver-day-hire', 'DRIVER', 'Mise à disposition à la journée', 'Full-day hire', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 30),
    ('driver-excursion', 'DRIVER', 'Excursion avec chauffeur', 'Chauffeured excursion', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 40),
    ('driver-resort-shuttle', 'DRIVER', 'Navette de station', 'Resort shuttle', 'PER_UNIT', 'SEASONAL', 'GUEST', true, false, 50),
    ('mobility-car', 'MOBILITY', 'Location de voiture', 'Car rental', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 10),
    ('mobility-scooter', 'MOBILITY', 'Location de scooter', 'Scooter rental', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 20),
    ('mobility-bike', 'MOBILITY', 'Location de vélos', 'Bike rental', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 30),
    ('mobility-ebike', 'MOBILITY', 'Location de vélos électriques', 'E-bike rental', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 40),
    ('mobility-vehicle-delivery', 'MOBILITY', 'Livraison du véhicule sur place', 'Vehicle delivery', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 50),
    ('mobility-parking', 'MOBILITY', 'Place de parking', 'Parking space', 'FLAT', 'PER_STAY', 'GUEST', true, false, 60),
    ('guide-city', 'TOURIST_GUIDE', 'Visite guidée de la ville', 'City tour', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 10),
    ('guide-medina', 'TOURIST_GUIDE', 'Visite de la médina', 'Medina tour', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 20),
    ('guide-private-day', 'TOURIST_GUIDE', 'Guide privé à la journée', 'Private day guide', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 30),
    ('guide-hiking', 'TOURIST_GUIDE', 'Randonnée accompagnée', 'Guided hike', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 40),
    ('guide-museum', 'TOURIST_GUIDE', 'Accompagnement musées', 'Museum tour', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 50),
    ('activities-desert', 'ACTIVITIES', 'Excursion désert', 'Desert excursion', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 10),
    ('activities-mountain', 'ACTIVITIES', 'Excursion montagne', 'Mountain excursion', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 20),
    ('activities-watersports', 'ACTIVITIES', 'Sports nautiques', 'Water sports', 'PER_UNIT', 'SEASONAL', 'GUEST', true, false, 30),
    ('activities-ski-pass', 'ACTIVITIES', 'Forfait de ski', 'Ski pass', 'PER_UNIT', 'SEASONAL', 'GUEST', true, false, 40),
    ('activities-golf', 'ACTIVITIES', 'Green fee', 'Green fee', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 50),
    ('activities-boat', 'ACTIVITIES', 'Sortie en bateau', 'Boat trip', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 60),
    ('activities-tickets', 'ACTIVITIES', 'Billetterie et spectacles', 'Tickets and shows', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 70),
    ('activities-kids-club', 'ACTIVITIES', 'Club enfants', 'Kids club', 'PER_UNIT', 'SEASONAL', 'GUEST', true, false, 80),
    ('wellness-massage', 'WELLNESS', 'Massage à domicile', 'In-home massage', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 10),
    ('wellness-hammam', 'WELLNESS', 'Hammam et gommage', 'Hammam and scrub', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 20),
    ('wellness-hairdresser', 'WELLNESS', 'Coiffure à domicile', 'In-home hairdressing', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 30),
    ('wellness-beauty', 'WELLNESS', 'Soins esthétiques', 'Beauty treatments', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 40),
    ('wellness-yoga', 'WELLNESS', 'Cours de yoga', 'Yoga class', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 50),
    ('wellness-coach', 'WELLNESS', 'Coach sportif', 'Personal trainer', 'HOURLY', 'ONE_OFF', 'GUEST', true, false, 60),
    ('childcare-babysitting', 'CHILDCARE', 'Baby-sitting', 'Babysitting', 'HOURLY', 'ONE_OFF', 'GUEST', true, false, 10),
    ('childcare-night', 'CHILDCARE', 'Garde de nuit', 'Overnight care', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 20),
    ('childcare-animation', 'CHILDCARE', 'Animation enfants', 'Kids entertainment', 'HOURLY', 'ONE_OFF', 'GUEST', true, false, 30),
    ('childcare-baby-kit', 'CHILDCARE', 'Kit bébé', 'Baby kit', 'FLAT', 'PER_STAY', 'GUEST', true, false, 40),
    ('pet-sitting', 'PET_CARE', 'Garde d''animaux', 'Pet sitting', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 10),
    ('pet-walking', 'PET_CARE', 'Promenade', 'Dog walking', 'PER_UNIT', 'ONE_OFF', 'GUEST', true, false, 20),
    ('pet-kit', 'PET_CARE', 'Kit animal', 'Pet kit', 'FLAT', 'PER_STAY', 'GUEST', true, false, 30),
    ('pet-grooming', 'PET_CARE', 'Toilettage', 'Grooming', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 40),
    ('pet-deep-clean', 'PET_CARE', 'Ménage renforcé après animal', 'Post-pet deep clean', 'FLAT', 'PER_STAY', 'OWNER', false, false, 50),
    ('equipment-baby', 'EQUIPMENT_RENTAL', 'Lit bébé et chaise haute', 'Cot and high chair', 'FLAT', 'PER_STAY', 'GUEST', true, false, 10),
    ('equipment-ski', 'EQUIPMENT_RENTAL', 'Location de skis', 'Ski rental', 'PER_UNIT', 'SEASONAL', 'GUEST', true, false, 20),
    ('equipment-surf', 'EQUIPMENT_RENTAL', 'Location de planches', 'Board rental', 'PER_UNIT', 'SEASONAL', 'GUEST', true, false, 30),
    ('equipment-bbq', 'EQUIPMENT_RENTAL', 'Location de barbecue', 'Barbecue rental', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 40),
    ('equipment-heater', 'EQUIPMENT_RENTAL', 'Chauffage d''appoint', 'Portable heater', 'FLAT', 'SEASONAL', 'GUEST', true, false, 50),
    ('equipment-extra-bed', 'EQUIPMENT_RENTAL', 'Lit d''appoint', 'Extra bed', 'FLAT', 'PER_STAY', 'GUEST', true, false, 60),
    ('photo-listing', 'PHOTOGRAPHY', 'Shooting du logement', 'Property shoot', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 10),
    ('photo-virtual-tour', 'PHOTOGRAPHY', 'Visite virtuelle 3D', '3D virtual tour', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 20),
    ('photo-drone', 'PHOTOGRAPHY', 'Prises de vue par drone', 'Drone footage', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 30),
    ('photo-video', 'PHOTOGRAPHY', 'Vidéo de présentation', 'Promotional video', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 40),
    ('photo-floorplan', 'PHOTOGRAPHY', 'Plan 2D coté', 'Dimensioned floor plan', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 50),
    ('photo-guest-session', 'PHOTOGRAPHY', 'Séance photo du séjour', 'Guest photo session', 'FLAT', 'ONE_OFF', 'GUEST', true, false, 60),
    ('furnishing-home-staging', 'FURNISHING', 'Home staging', 'Home staging', 'ON_QUOTE', 'ONE_OFF', 'OWNER', false, false, 10),
    ('furnishing-interior-design', 'FURNISHING', 'Conseil en décoration', 'Interior design advice', 'HOURLY', 'ONE_OFF', 'OWNER', false, false, 20),
    ('furnishing-purchase', 'FURNISHING', 'Achat et installation de mobilier', 'Furniture sourcing', 'ON_QUOTE', 'ONE_OFF', 'OWNER', false, false, 30),
    ('furnishing-custom', 'FURNISHING', 'Mobilier sur mesure', 'Bespoke furniture', 'ON_QUOTE', 'ONE_OFF', 'OWNER', false, false, 40),
    ('furnishing-artisan', 'FURNISHING', 'Artisanat local', 'Local craftsmanship', 'ON_QUOTE', 'ONE_OFF', 'OWNER', false, false, 50),
    ('furnishing-starter-kit', 'FURNISHING', 'Constitution du kit d''équipement', 'Starter equipment kit', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 60),
    ('marketing-listing-copy', 'MARKETING', 'Rédaction d''annonce', 'Listing copywriting', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 10),
    ('marketing-translation', 'MARKETING', 'Traduction', 'Translation', 'PER_UNIT', 'ONE_OFF', 'OWNER', false, false, 20),
    ('marketing-seo', 'MARKETING', 'Référencement du site direct', 'Direct site SEO', 'MONTHLY', 'MONTHLY', 'OWNER', false, false, 30),
    ('marketing-social', 'MARKETING', 'Animation des réseaux sociaux', 'Social media management', 'MONTHLY', 'MONTHLY', 'OWNER', false, false, 40),
    ('marketing-reviews', 'MARKETING', 'Gestion des avis', 'Review management', 'MONTHLY', 'MONTHLY', 'OWNER', false, false, 50),
    ('admin-town-hall', 'ADMIN_LEGAL', 'Déclaration en mairie', 'Town hall declaration', 'FLAT', 'ONE_OFF', 'OWNER', false, true, 10),
    ('admin-registration-number', 'ADMIN_LEGAL', 'Obtention du numéro d''enregistrement', 'Registration number filing', 'FLAT', 'ONE_OFF', 'OWNER', false, true, 20),
    ('admin-change-of-use', 'ADMIN_LEGAL', 'Changement d''usage', 'Change of use application', 'ON_QUOTE', 'ONE_OFF', 'OWNER', false, true, 30),
    ('admin-classification', 'ADMIN_LEGAL', 'Dossier de classement meublé', 'Tourism classification filing', 'FLAT', 'MULTI_YEAR', 'OWNER', false, true, 40),
    ('admin-tourist-tax', 'ADMIN_LEGAL', 'Déclaration de taxe de séjour', 'Tourist tax filing', 'MONTHLY', 'MONTHLY', 'OWNER', false, true, 50),
    ('admin-legal-advice', 'ADMIN_LEGAL', 'Conseil juridique', 'Legal advice', 'HOURLY', 'ONE_OFF', 'OWNER', false, false, 60),
    ('admin-contracts', 'ADMIN_LEGAL', 'Rédaction de contrats', 'Contract drafting', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 70),
    ('admin-dispute', 'ADMIN_LEGAL', 'Gestion de litige voyageur', 'Guest dispute handling', 'HOURLY', 'ONE_OFF', 'OWNER', false, false, 80),
    ('accounting-lmnp', 'ACCOUNTING', 'Comptabilité meublé (LMNP)', 'Furnished rental accounting', 'FLAT', 'ANNUAL', 'OWNER', false, false, 10),
    ('accounting-tax-return', 'ACCOUNTING', 'Liasse fiscale', 'Tax return filing', 'FLAT', 'ANNUAL', 'OWNER', false, true, 20),
    ('accounting-vat', 'ACCOUNTING', 'Déclaration de TVA', 'VAT filing', 'FLAT', 'MONTHLY', 'OWNER', false, true, 30),
    ('accounting-bookkeeping', 'ACCOUNTING', 'Tenue de livres', 'Bookkeeping', 'MONTHLY', 'MONTHLY', 'OWNER', false, false, 40),
    ('accounting-advice', 'ACCOUNTING', 'Conseil fiscal', 'Tax advice', 'HOURLY', 'ONE_OFF', 'OWNER', false, false, 50),
    ('accounting-payroll', 'ACCOUNTING', 'Paie du personnel', 'Payroll', 'PER_UNIT', 'MONTHLY', 'OWNER', false, true, 60),
    ('insurance-pno', 'INSURANCE', 'Assurance propriétaire non occupant', 'Landlord insurance', 'FLAT', 'ANNUAL', 'OWNER', false, false, 10),
    ('insurance-holiday-rental', 'INSURANCE', 'Responsabilité civile villégiature', 'Holiday rental liability', 'FLAT', 'ANNUAL', 'OWNER', false, false, 20),
    ('insurance-damage', 'INSURANCE', 'Garantie dommages voyageur', 'Guest damage cover', 'FLAT', 'PER_STAY', 'GUEST', true, false, 30),
    ('insurance-cancellation', 'INSURANCE', 'Assurance annulation', 'Cancellation cover', 'FLAT', 'PER_STAY', 'GUEST', true, false, 40),
    ('insurance-rent-guarantee', 'INSURANCE', 'Garantie loyers impayés', 'Rent guarantee', 'FLAT', 'ANNUAL', 'OWNER', false, false, 50),
    ('insurance-audit', 'INSURANCE', 'Audit de couverture', 'Coverage audit', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 60),
    ('utilities-energy-broker', 'UTILITIES', 'Courtage énergie', 'Energy brokerage', 'FLAT', 'ANNUAL', 'OWNER', false, false, 10),
    ('utilities-internet', 'UTILITIES', 'Abonnement internet', 'Internet subscription', 'MONTHLY', 'MONTHLY', 'OWNER', false, false, 20),
    ('utilities-wifi-boost', 'UTILITIES', 'Renforcement du wifi', 'Wi-Fi boost', 'FLAT', 'ONE_OFF', 'OWNER', false, false, 30),
    ('utilities-sim', 'UTILITIES', 'Carte SIM locale', 'Local SIM card', 'FLAT', 'PER_STAY', 'GUEST', true, false, 40),
    ('utilities-tv', 'UTILITIES', 'Bouquet TV et streaming', 'TV and streaming package', 'MONTHLY', 'MONTHLY', 'OWNER', false, false, 50),
    ('utilities-meter-reading', 'UTILITIES', 'Relevé de compteurs', 'Meter reading', 'FLAT', 'MONTHLY', 'OWNER', false, false, 60),
    ('utilities-ev-charger', 'UTILITIES', 'Borne de recharge', 'EV charger', 'ON_QUOTE', 'ONE_OFF', 'OWNER', false, false, 70),
    ('other-custom', 'OTHER', 'Prestation sur mesure', 'Custom service', 'ON_QUOTE', 'ONE_OFF', 'OWNER', false, false, 10)
) AS v(code, category_code, label_fr, label_en, pricing, recurrence, payer, guest_sellable, regulated, sort_order)
JOIN marketplace_service_categories c ON c.code = v.category_code
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE marketplace_service_items IS
  'Catalogue des prestations types. Le champ libre de marketplace_provider_services survit a cote : une prestation hors catalogue reste vendable.';
COMMENT ON COLUMN marketplace_service_items.recurrence IS
  'ONE_OFF | PER_STAY | WEEKLY | MONTHLY | SEASONAL | ANNUAL | MULTI_YEAR. Transforme une prestation en echeance, donc en relance.';
COMMENT ON COLUMN marketplace_service_items.payer IS
  'OWNER | GUEST | AGENCY. Decide du chemin comptable : depense refacturee, vente au voyageur, ou commission.';
COMMENT ON COLUMN marketplace_service_items.regulated IS
  'Prestation imposee par la loi. Les plus previsibles du catalogue : elles reviennent qu''on le veuille ou non.';
COMMENT ON COLUMN marketplace_service_categories.family IS
  'OPERATIONS | TECHNICAL | GUEST | OWNER | OTHER. Groupe les pastilles de filtre, illisibles a trente-deux sur une ligne.';
