-- ============================================================================
-- 0157 : Booking Vouchers — promos/voucher sur les nuitees de location
-- ----------------------------------------------------------------------------
-- Contexte : permet aux hosts (et aux orgs/conciergeries quand le host a
-- consenti) de creer des codes promo / campagnes auto qui reduisent le prix
-- des nuitees pour les guests. Distinct du systeme PlatformPromoCode (0152)
-- qui s'applique aux abonnements PMS via Stripe.
--
-- Trois modes d'application :
--   1. MANUAL_CODE  : code texte que le guest entre dans le booking engine
--   2. AUTO_CAMPAIGN: campagne marketing globale, prix discount applique direct
--   3. (Le canal de partage WhatsApp/EMAIL passe par MANUAL_CODE + lien
--      pre-rempli `?voucher=ABC123`)
--
-- Pricing chain :
--   PriceEngine (9 niveaux : RateOverride > Promotional > Event > Weekend >
--   Seasonal > EarlyBird > LastMinute > Base > nightlyPrice)
--     -> prix publie (ex: 167€/nuit × 3 = 501€)
--   VoucherEngine.apply(voucher, quote)
--     -> discount applique (ex: -20% = 100€)
--   Quote final = 401€ + audit row dans voucher_usage a la confirmation
--
-- Permissions creation :
--   - HOST cree sur SES properties : OK toujours
--   - MANAGEMENT_ORG cree (conciergerie qui gere des properties d'autres
--     hosts) : OK si pour CHAQUE property cible :
--       1. organization.has_voucher_contract = true (contrat signe)
--       2. property.org_can_create_vouchers = true (consentement explicite
--          du host pour CE logement)
--   Logique de check au niveau service (BookingVoucherService.create),
--   pas de contrainte DB (trop rigide pour le cas refus partiel).
-- ============================================================================

-- ============================================================================
-- Table principale : booking_voucher
-- ============================================================================
CREATE TABLE booking_voucher (
    id BIGSERIAL PRIMARY KEY,

    -- Organisation creatrice du voucher (host ou conciergerie). Multi-tenant
    -- via Hibernate @Filter. Cascade DELETE car un voucher n'a pas de sens
    -- sans son org (orphan).
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Code texte que le guest entre (ex: WELCOME20, BLACKFRIDAY). NULL pour
    -- les campagnes AUTO_CAMPAIGN (appliquees automatiquement sans saisie).
    -- Stocke en UPPER pour comparaison case-insensitive (cf. index ci-dessous).
    code VARCHAR(64),

    -- Type de declenchement :
    --   MANUAL_CODE   = guest entre le code dans le booking engine
    --   AUTO_CAMPAIGN = applique automatiquement sur les dates cibles
    type VARCHAR(20) NOT NULL,

    -- Type de remise :
    --   PERCENTAGE    = discount_value en % (1-100), applique sur subtotal
    --   FIXED_AMOUNT  = discount_value en euros, montant fixe deduit
    --   FREE_NIGHTS   = discount_value = nb de nuits gratuites (les N moins
    --                   cheres). Reserve V2 si on a le temps.
    discount_type VARCHAR(20) NOT NULL,

    -- Valeur de la remise (semantique depend de discount_type). Decimal pour
    -- supporter % avec decimales (ex: 12.5%) et FIXED en euros avec centimes.
    discount_value DECIMAL(10, 2) NOT NULL,

    -- Periode de validite. NULL valid_from = effectif immediatement.
    -- NULL valid_until = pas d'expiration (rare, generalement defini).
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,

    -- Contraintes de sejour pour l'eligibilite :
    --   min_stay_nights : nombre minimum de nuits (ex: 3 pour decourager les
    --                     reservations 1 nuit avec gros discount)
    --   min_total_amount: montant minimum du sejour avant discount (ex: 200€)
    --   max_stay_nights : nombre max de nuits (ex: limite a 7 pour eviter
    --                     les reservations longues avec discount cumule eleve)
    min_stay_nights INT,
    min_total_amount DECIMAL(10, 2),
    max_stay_nights INT,

    -- Plafonds d'utilisation :
    --   max_uses_total    = nombre total d'utilisations toutes guests confondus
    --                       (ex: 100 = premiers 100 a utiliser le code)
    --   max_uses_per_guest = par guest (ex: 1 = one-shot, default 1 pour
    --                       MANUAL_CODE, NULL = illimite)
    max_uses_total INT,
    max_uses_per_guest INT DEFAULT 1,

    -- Compteur d'utilisations (incremente atomiquement a chaque application
    -- via VoucherUsageService.recordUsage avec UPDATE ... RETURNING).
    usage_count INT NOT NULL DEFAULT 0,

    -- Canal d'application du voucher :
    --   ALL            = tous canaux (booking engine + saisie directe)
    --   BOOKING_ENGINE = visible/utilisable uniquement dans le widget guest
    --   DIRECT_LINK    = via lien pre-rempli `?voucher=CODE` partage
    --   WHATSAPP       = idem mais provenance trackee WhatsApp
    --   EMAIL          = idem mais provenance trackee email
    -- Sert principalement pour les analytics (segmenter par canal d'acquisition).
    channel_scope VARCHAR(20) NOT NULL DEFAULT 'ALL',

    -- Statut du cycle de vie :
    --   DRAFT   = en cours de creation, non actif
    --   ACTIVE  = actif et utilisable
    --   PAUSED  = temporairement desactive (gardable pour analytics)
    --   EXPIRED = passe par le scheduler quotidien quand valid_until < now
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    -- Qui a cree ce voucher : HOST (proprietaire) ou MANAGEMENT_ORG (conciergerie).
    -- Stocke pour audit + analytics (savoir si la conciergerie genere des promos
    -- au nom du host avec accord).
    created_by_org_type VARCHAR(20) NOT NULL DEFAULT 'HOST',

    -- User qui a cree le voucher (UI display + audit).
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

    -- Nom interne pour identifier la campagne (UI listing).
    -- Ex: "Black Friday 2026", "Cooptation repeat customers Q1".
    name VARCHAR(150) NOT NULL,

    -- Description optionnelle (contexte, conditions, raison de la promo).
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Contraintes
    CONSTRAINT booking_voucher_type_check
        CHECK (type IN ('MANUAL_CODE', 'AUTO_CAMPAIGN')),

    CONSTRAINT booking_voucher_discount_type_check
        CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_NIGHTS')),

    CONSTRAINT booking_voucher_discount_value_positive
        CHECK (discount_value > 0),

    CONSTRAINT booking_voucher_discount_percent_range
        CHECK (
            discount_type != 'PERCENTAGE'
            OR (discount_value > 0 AND discount_value <= 100)
        ),

    CONSTRAINT booking_voucher_channel_scope_check
        CHECK (channel_scope IN ('ALL', 'BOOKING_ENGINE', 'DIRECT_LINK', 'WHATSAPP', 'EMAIL')),

    CONSTRAINT booking_voucher_status_check
        CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED')),

    CONSTRAINT booking_voucher_created_by_org_type_check
        CHECK (created_by_org_type IN ('HOST', 'MANAGEMENT_ORG')),

    -- MANUAL_CODE : code requis. AUTO_CAMPAIGN : code optionnel.
    CONSTRAINT booking_voucher_code_required_for_manual
        CHECK (type != 'MANUAL_CODE' OR code IS NOT NULL),

    -- Period coherente (valid_until apres valid_from si les deux defines)
    CONSTRAINT booking_voucher_period_coherent
        CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_until >= valid_from),

    -- usage_count borne (peut depasser legerement max_uses_total en cas de
    -- race condition, mais on protege via UPDATE conditionnel cote service).
    CONSTRAINT booking_voucher_usage_count_non_negative
        CHECK (usage_count >= 0)
);

-- Index lookup par code (case-insensitive). Index partiel sur les non-null
-- pour reduire taille (les AUTO_CAMPAIGN n'ont pas de code).
CREATE UNIQUE INDEX idx_booking_voucher_code_upper_per_org
    ON booking_voucher (organization_id, UPPER(code))
    WHERE code IS NOT NULL;

-- Index pour le scan periodique du scheduler (expire les vouchers passes).
CREATE INDEX idx_booking_voucher_valid_until_active
    ON booking_voucher (valid_until)
    WHERE status = 'ACTIVE' AND valid_until IS NOT NULL;

-- Index pour le listing org admin (filtre status + tri date).
CREATE INDEX idx_booking_voucher_org_status_created
    ON booking_voucher (organization_id, status, created_at DESC);

-- Trigger updated_at auto (pattern standard Baitly).
CREATE OR REPLACE FUNCTION trg_booking_voucher_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_booking_voucher_updated_at_bump
    BEFORE UPDATE ON booking_voucher
    FOR EACH ROW EXECUTE FUNCTION trg_booking_voucher_updated_at();

COMMENT ON TABLE booking_voucher IS
    'Promos / vouchers sur les nuitees de location. Cree par host (sur ses properties) ou par conciergerie (sur properties avec consentement du host).';
COMMENT ON COLUMN booking_voucher.code IS
    'Code texte que le guest entre. Stocke en UPPER. NULL pour les AUTO_CAMPAIGN.';
COMMENT ON COLUMN booking_voucher.discount_value IS
    'Semantique selon discount_type : % (PERCENTAGE), euros (FIXED_AMOUNT), nb nuits (FREE_NIGHTS).';

-- ============================================================================
-- Table de liaison : voucher_property_scope
-- ----------------------------------------------------------------------------
-- Many-to-many entre vouchers et properties.
--   - Si AUCUNE row pour un voucher_id : voucher applicable a TOUTES les
--     properties de l'org creatrice (regle metier au niveau service).
--   - Si rows definies : voucher applicable UNIQUEMENT a ces properties.
-- ============================================================================
CREATE TABLE voucher_property_scope (
    voucher_id BIGINT NOT NULL REFERENCES booking_voucher(id) ON DELETE CASCADE,
    property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (voucher_id, property_id)
);

-- Lookup inverse : "quelles properties beneficient de ce voucher" (UI listing).
CREATE INDEX idx_voucher_property_scope_voucher ON voucher_property_scope (voucher_id);

-- Lookup direct : "quels vouchers s'appliquent a cette property" (resolution
-- au moment du quote dans VoucherEngine).
CREATE INDEX idx_voucher_property_scope_property ON voucher_property_scope (property_id);

COMMENT ON TABLE voucher_property_scope IS
    'Scope properties d''un voucher. Vide = applicable a toutes les properties de l''org creatrice.';

-- ============================================================================
-- Table audit : voucher_usage
-- ----------------------------------------------------------------------------
-- Trace chaque application d'un voucher sur une reservation. Insere par le
-- service au moment de la confirmation du booking. Sert pour :
--   - Analytics (CA brut/net, ROI par campagne)
--   - Detection abus (meme guest_email > N usages)
--   - Reconciliation comptable
--
-- Pas de DELETE CASCADE depuis voucher (RESTRICT) : on garde la trace meme
-- si le voucher est supprime ulterieurement, pour preserver l'historique.
-- ============================================================================
CREATE TABLE voucher_usage (
    id BIGSERIAL PRIMARY KEY,

    -- Voucher applique. RESTRICT pour preserver l'historique d'usage.
    voucher_id BIGINT NOT NULL REFERENCES booking_voucher(id) ON DELETE RESTRICT,

    -- Reservation a laquelle le voucher a ete applique. CASCADE car si la
    -- reservation est supprimee, l'audit d'usage ne sert plus a rien.
    reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

    -- Org de la reservation (denormalise pour analytics multi-tenant).
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Property de la reservation (denormalise pour stats par property).
    property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Email guest (denormalise pour la detection d'abus sans depender du
    -- guest_id qui peut etre NULL pour les bookings externes).
    guest_email VARCHAR(255),

    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Montants au moment de l'application (audit + analytics).
    original_total DECIMAL(10, 2) NOT NULL,
    discount_applied DECIMAL(10, 2) NOT NULL,
    final_total DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',

    -- Channel utilise pour appliquer le voucher (BOOKING_ENGINE, DIRECT_LINK,
    -- WHATSAPP, EMAIL, MANUAL). Diff du channel_scope du voucher qui est la
    -- restriction ; ici c'est l'application reelle.
    applied_via VARCHAR(20) NOT NULL DEFAULT 'BOOKING_ENGINE',

    CONSTRAINT voucher_usage_original_total_positive
        CHECK (original_total > 0),

    CONSTRAINT voucher_usage_discount_non_negative
        CHECK (discount_applied >= 0),

    CONSTRAINT voucher_usage_final_total_non_negative
        CHECK (final_total >= 0),

    CONSTRAINT voucher_usage_amounts_coherent
        CHECK (final_total = original_total - discount_applied)
);

-- Lookup principal : "toutes les usages d'un voucher" (analytics)
CREATE INDEX idx_voucher_usage_voucher ON voucher_usage (voucher_id, applied_at DESC);

-- Lookup secondaire : "quel voucher a ete applique sur cette reservation"
CREATE UNIQUE INDEX idx_voucher_usage_reservation ON voucher_usage (reservation_id);

-- Detection abus : "combien de fois ce guest a-t-il utilise ce voucher"
CREATE INDEX idx_voucher_usage_voucher_guest_email
    ON voucher_usage (voucher_id, guest_email)
    WHERE guest_email IS NOT NULL;

-- Analytics par org (rapport admin / dashboard host)
CREATE INDEX idx_voucher_usage_org_applied_at
    ON voucher_usage (organization_id, applied_at DESC);

COMMENT ON TABLE voucher_usage IS
    'Audit + analytics : trace chaque application d''un voucher sur une reservation. Insertion au moment de la confirmation du booking.';

-- ============================================================================
-- Colonnes ajoutees aux tables existantes
-- ============================================================================

-- organization : flag "contrat de voucher signe" (active la possibilite pour
-- l'org gestionnaire de creer des vouchers sur les properties de ses hosts,
-- sous reserve du consentement par-property cote host).
ALTER TABLE organizations
    ADD COLUMN has_voucher_contract BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN organizations.has_voucher_contract IS
    'TRUE si l''org a signe un contrat lui permettant de creer des vouchers sur les properties de ses hosts. Active par admin Baitly. Pre-requis (mais pas suffisant) : property.org_can_create_vouchers doit aussi etre true.';

-- property : consentement explicite du host pour que sa conciergerie cree
-- des vouchers sur ce logement. Toggle par le host dans Property Settings.
ALTER TABLE properties
    ADD COLUMN org_can_create_vouchers BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN properties.org_can_create_vouchers IS
    'TRUE si le host autorise son org gestionnaire (conciergerie) a creer des vouchers sur ce logement. Combine avec organization.has_voucher_contract = true pour activer la creation par MANAGEMENT_ORG.';

-- reservation : tracker le voucher applique a cette reservation pour
-- l'affichage facture / detail booking / analytics.
ALTER TABLE reservations
    ADD COLUMN original_total DECIMAL(10, 2),
    ADD COLUMN discount_amount DECIMAL(10, 2),
    ADD COLUMN voucher_code VARCHAR(64),
    ADD COLUMN booking_voucher_id BIGINT REFERENCES booking_voucher(id) ON DELETE SET NULL;

COMMENT ON COLUMN reservations.original_total IS
    'Total AVANT application du voucher. NULL si aucun voucher applique (totalPrice = montant final dans ce cas).';
COMMENT ON COLUMN reservations.discount_amount IS
    'Montant du discount voucher applique. NULL si aucun voucher applique.';
COMMENT ON COLUMN reservations.voucher_code IS
    'Code texte du voucher applique. Denormalise pour audit meme si le voucher est supprime.';
COMMENT ON COLUMN reservations.booking_voucher_id IS
    'FK vers le voucher applique. SET NULL si le voucher est supprime (voucher_code reste pour audit).';

-- Index pour les rapports "toutes les reservations avec voucher".
CREATE INDEX idx_reservations_booking_voucher
    ON reservations (booking_voucher_id)
    WHERE booking_voucher_id IS NOT NULL;
