-- ============================================================================
-- 0154 : Templates WhatsApp editables en base (replace YAML hardcodes)
-- ----------------------------------------------------------------------------
-- Contexte : avant cette migration, les 5 templates WhatsApp standards Clenzy
-- (checkin_instructions, arrival_code, checkout_reminder, review_request,
-- booking_confirmation) etaient hardcodes dans
-- `server/src/main/resources/whatsapp-templates/*.yaml` et charges au boot par
-- `WhatsAppTemplateLoader`. L'utilisateur final n'avait aucun moyen d'adapter
-- le wording, le ton, ou les variantes par langue sans demander une release.
--
-- Cette migration cree la table `whatsapp_template_content` qui stocke les
-- templates en base, editables depuis le menu "Documents & Communication" du
-- frontend. Les 5 YAML × 3 langues sont seedes ici comme templates SYSTEME
-- (organization_id NULL, is_system=true) read-only pour les orgs.
--
-- Architecture (resolve avec fallback) :
--   1. Une org veut envoyer 'checkin_instructions' en 'fr_FR'.
--   2. SELECT * FROM whatsapp_template_content
--      WHERE template_key='checkin_instructions' AND language='fr_FR'
--        AND organization_id IN (NULL, :org)
--      ORDER BY organization_id NULLS LAST LIMIT 1
--      → si l'org a un override → l'override gagne (NULLS LAST)
--      → sinon le template systeme global
--
-- Format des variables (body_named) :
--   Format nomme : "Bonjour {guestFirstName} a {propertyName}".
--   Plus user-friendly que le {{1}} {{2}} de Meta. La conversion vers
--   positionnel ({{1}}, {{2}}, ...) + ordered params est faite a l'envoi
--   par WhatsAppVariableConverter (cf. Phase 2 de ce chantier).
--
-- Multi-tenant :
--   - organization_id NULL : template systeme Clenzy. Visible par TOUTES les
--     orgs (fallback). Pas de Hibernate @Filter sur cette table — la jointure
--     est explicite dans le service. Les orgs ne peuvent PAS modifier ces
--     lignes (verifie cote service via is_system flag).
--   - organization_id defini : override per-org. Visible/editable uniquement
--     par cette org. parent_template_id pointe vers le template systeme
--     dont c'est un fork (utile pour "Restaurer le defaut").
-- ============================================================================

CREATE TABLE whatsapp_template_content (
    id BIGSERIAL PRIMARY KEY,

    -- NULL = template systeme Clenzy global (read-only pour les orgs).
    -- Defini = override per-org (editable par l'org proprietaire).
    organization_id BIGINT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Cle logique stable, identique a l'ancien YAML key. Sert de pivot pour
    -- relier les 3 langues d'un meme template-concept et pour les references
    -- depuis le code applicatif (BriefingDelivery, GuestMessagingService).
    template_key VARCHAR(64) NOT NULL,

    -- Format Meta : fr_FR, en_US, ar_AR (PAS ISO 639-1 brut).
    -- Determine quelle langue d'un meme template_key est envoyee selon la
    -- langue preferee du guest (cf. OrgWhatsAppTemplate.template_language).
    language VARCHAR(8) NOT NULL,

    -- Categorie Meta — controlee par CHECK plus bas.
    -- UTILITY = transactionnel (default Clenzy, $0.022/conv FR).
    -- MARKETING = promo ($0.069/conv FR), reserve aux campagnes opt-in.
    -- AUTHENTICATION = OTP ($0.032/conv FR), pas utilise en v1.
    category VARCHAR(32) NOT NULL,

    -- Corps du message au format nomme : "Bonjour {guestFirstName} 🏠 ...".
    -- Edite directement par l'utilisateur dans l'UI. Converti en positionnel
    -- {{1}} {{2}} a l'envoi vers Meta par WhatsAppVariableConverter.
    -- Limite a 1024 chars (limite Meta body component).
    body_named TEXT NOT NULL,

    -- TRUE = template systeme Clenzy, read-only pour les orgs.
    -- FALSE = template per-org, editable par l'org proprietaire.
    -- Combine avec organization_id : (NULL, true) = systeme global ;
    -- (org_id, false) = override org. Les combinaisons (NULL, false) et
    -- (org_id, true) sont INTERDITES (CHECK plus bas).
    is_system BOOLEAN NOT NULL DEFAULT false,

    -- Si l'org a fait un fork du template systeme, pointe vers la ligne
    -- systeme parente (pour le bouton "Restaurer le defaut" dans l'UI).
    -- NULL si c'est un template systeme ou un override sans parent identifie.
    parent_template_id BIGINT NULL REFERENCES whatsapp_template_content(id) ON DELETE SET NULL,

    -- Nom du template tel qu'enregistre cote Meta (clenzy_checkin_instructions_v1).
    -- Sync apres soumission Meta (MetaTemplateProvisioner). NULL tant que
    -- pas soumis (cas template systeme nouveau ou override pas encore push).
    meta_template_name VARCHAR(128) NULL,

    -- Statut d'approbation Meta : PENDING | APPROVED | REJECTED | PAUSED | NULL.
    -- Sync periodique via MetaTemplateProvisioner (a venir). NULL = pas soumis.
    meta_approval_status VARCHAR(32) NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unicite : 1 seul template par (cle logique, langue, org). Pour les
    -- templates systeme org=NULL, l'unicite Postgres ne protege PAS contre
    -- les doublons de (key, lang, NULL) — donc l'index UNIQUE partiel
    -- ci-dessous renforce cette contrainte.
    CONSTRAINT whatsapp_template_content_unique_per_org
        UNIQUE (organization_id, template_key, language),

    -- Coherence is_system <-> organization_id :
    --   - is_system=true → organization_id DOIT etre NULL (template global)
    --   - is_system=false → organization_id DOIT etre defini (override per-org)
    CONSTRAINT whatsapp_template_content_system_org_consistent
        CHECK (
            (is_system = true AND organization_id IS NULL)
            OR (is_system = false AND organization_id IS NOT NULL)
        ),

    -- Categorie Meta dans la liste fermee
    CONSTRAINT whatsapp_template_content_category_check
        CHECK (category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION')),

    -- Statut Meta dans la liste fermee si defini
    CONSTRAINT whatsapp_template_content_meta_status_check
        CHECK (meta_approval_status IS NULL
               OR meta_approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED')),

    -- Body non vide et borne (limite Meta : 1024 chars)
    CONSTRAINT whatsapp_template_content_body_length_check
        CHECK (char_length(body_named) BETWEEN 1 AND 1024)
);

-- Index principal : resolve(org, key, lang). Le tri permet en SQL
-- "ORDER BY organization_id NULLS LAST LIMIT 1" pour faire prevaloir
-- l'override org sur le systeme.
CREATE INDEX idx_wt_content_key_lang_org
    ON whatsapp_template_content (template_key, language, organization_id);

-- Index partiel pour les templates systeme (frequent, scans frequents).
CREATE INDEX idx_wt_content_system
    ON whatsapp_template_content (template_key, language)
    WHERE is_system = true;

-- Index unique partiel : 1 seul template systeme par (key, lang).
-- Necessaire car PostgreSQL ne considere PAS deux NULL egaux dans un
-- index UNIQUE classique (= duplication possible de (key, lang, NULL)).
CREATE UNIQUE INDEX idx_wt_content_system_unique
    ON whatsapp_template_content (template_key, language)
    WHERE organization_id IS NULL;

-- Index pour les overrides per-org (frequent dans l'UI Documents).
CREATE INDEX idx_wt_content_org_overrides
    ON whatsapp_template_content (organization_id)
    WHERE organization_id IS NOT NULL;

-- Trigger update_at auto (pattern Clenzy standard, cf. les autres migrations).
-- updated_at est bumped a chaque UPDATE pour permettre le cache invalidation
-- cote frontend (React Query refetch si timestamp change).
CREATE OR REPLACE FUNCTION trg_wt_content_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wt_content_updated_at_bump
    BEFORE UPDATE ON whatsapp_template_content
    FOR EACH ROW EXECUTE FUNCTION trg_wt_content_updated_at();

COMMENT ON TABLE whatsapp_template_content IS
    'Contenu editable des templates WhatsApp Clenzy. organization_id NULL = template systeme global (read-only pour les orgs), defini = override per-org.';
COMMENT ON COLUMN whatsapp_template_content.body_named IS
    'Body au format nomme {variableName}. Converti en positionnel {{1}} {{2}} a l''envoi par WhatsAppVariableConverter.';

-- ============================================================================
-- SEED : 5 templates × 3 langues = 15 lignes systeme (organization_id=NULL)
-- ----------------------------------------------------------------------------
-- Source : extraction des YAML resources/whatsapp-templates/*.yaml en
-- vigueur avant cette migration. Les {{1}} {{2}} ... sont convertis en
-- {variableName} intuitifs (l'ordre d'apparition genere implicitement le
-- mapping positionnel au runtime).
--
-- Convention de naming des variables (alignee sur
-- com.clenzy.service.messaging.TemplateInterpolationService.SUPPORTED_VARIABLES) :
--   {guestFirstName}     prenom du guest
--   {propertyName}       nom de la propriete
--   {propertyAddress}    adresse complete
--   {checkInTime}        heure check-in HH:MM
--   {checkOutTime}       heure check-out HH:MM
--   {accessCode}         code porte / boite a cles
--   {wifiName}           SSID
--   {wifiPassword}       mot de passe wifi
--   {checkInDate}        date arrivee localisee
--   {checkOutDate}       date depart localisee
--   {emergencyContact}   nom du contact urgence (host / conciergerie)
--   {emergencyPhone}     telephone du contact urgence (NOUVELLE variable, voir TODO ci-dessous)
--   {departureInstructions}   instructions specifiques au depart
--   {reviewLink}         URL review OTA (NOUVELLE variable, voir TODO ci-dessous)
--
-- TODO de suivi (hors scope migration) :
--   - Ajouter {emergencyPhone} et {reviewLink} a SUPPORTED_VARIABLES dans
--     TemplateInterpolationService apres mise en place du converter. Ces 2
--     variables ne sont pas encore reconnues : le converter les exposera
--     comme "non resolu — laisse tel quel" en attendant.
-- ============================================================================

-- checkin_instructions (J-1 avant arrivee)
INSERT INTO whatsapp_template_content (organization_id, template_key, language, category, body_named, is_system, meta_template_name) VALUES
(NULL, 'checkin_instructions', 'fr_FR', 'UTILITY',
'Bonjour {guestFirstName} 🏠

Votre check-in à *{propertyAddress}* est prévu demain à partir de {checkInTime}.

Vous recevrez le code d''accès le jour J à 14h.

En cas de question : *{emergencyContact}* au {emergencyPhone}.

Bon voyage !',
true, 'clenzy_checkin_instructions_v1'),

(NULL, 'checkin_instructions', 'en_US', 'UTILITY',
'Hi {guestFirstName} 🏠

Your check-in at *{propertyAddress}* is scheduled tomorrow from {checkInTime}.

You will receive the access code on the day of arrival at 2pm.

Need help? Contact *{emergencyContact}* at {emergencyPhone}.

Safe travels!',
true, 'clenzy_checkin_instructions_v1'),

(NULL, 'checkin_instructions', 'ar_AR', 'UTILITY',
'مرحبا {guestFirstName} 🏠

تسجيل دخولك في *{propertyAddress}* مقرر غدا ابتداء من {checkInTime}.

ستتلقى رمز الدخول يوم الوصول الساعة 14:00.

تحتاج مساعدة؟ تواصل مع *{emergencyContact}* على {emergencyPhone}.

رحلة سعيدة!',
true, 'clenzy_checkin_instructions_v1');

-- arrival_code (jour J 14h)
INSERT INTO whatsapp_template_content (organization_id, template_key, language, category, body_named, is_system, meta_template_name) VALUES
(NULL, 'arrival_code', 'fr_FR', 'UTILITY',
'{guestFirstName}, voici vos infos d''accès 🔑

*Code porte* : {accessCode}
*Wifi* : {wifiName}
*Mot de passe wifi* : {wifiPassword}

Bienvenue ! N''hésitez pas si besoin de quoi que ce soit.',
true, 'clenzy_arrival_code_v1'),

(NULL, 'arrival_code', 'en_US', 'UTILITY',
'{guestFirstName}, here are your access details 🔑

*Door code*: {accessCode}
*WiFi*: {wifiName}
*WiFi password*: {wifiPassword}

Welcome! Reach out anytime if you need anything.',
true, 'clenzy_arrival_code_v1'),

(NULL, 'arrival_code', 'ar_AR', 'UTILITY',
'{guestFirstName}، إليك تفاصيل الدخول 🔑

*رمز الباب*: {accessCode}
*واي فاي*: {wifiName}
*كلمة سر الواي فاي*: {wifiPassword}

أهلا بك! تواصل معنا في أي وقت إذا احتجت أي شيء.',
true, 'clenzy_arrival_code_v1');

-- checkout_reminder (jour depart 9h)
INSERT INTO whatsapp_template_content (organization_id, template_key, language, category, body_named, is_system, meta_template_name) VALUES
(NULL, 'checkout_reminder', 'fr_FR', 'UTILITY',
'Bonjour {guestFirstName} 👋

Petit rappel : votre check-out est aujourd''hui avant *{checkOutTime}*.

Avant de partir : {departureInstructions}

On espère que votre séjour s''est bien passé. Bon retour !',
true, 'clenzy_checkout_reminder_v1'),

(NULL, 'checkout_reminder', 'en_US', 'UTILITY',
'Hi {guestFirstName} 👋

Friendly reminder: check-out is today before *{checkOutTime}*.

Before leaving: {departureInstructions}

Hope you enjoyed your stay. Safe trip back!',
true, 'clenzy_checkout_reminder_v1'),

(NULL, 'checkout_reminder', 'ar_AR', 'UTILITY',
'مرحبا {guestFirstName} 👋

تذكير: موعد المغادرة اليوم قبل *{checkOutTime}*.

قبل المغادرة: {departureInstructions}

نتمنى أن تكون استمتعت بإقامتك. عودة سعيدة!',
true, 'clenzy_checkout_reminder_v1');

-- review_request (J+1 apres depart)
INSERT INTO whatsapp_template_content (organization_id, template_key, language, category, body_named, is_system, meta_template_name) VALUES
(NULL, 'review_request', 'fr_FR', 'UTILITY',
'Bonjour {guestFirstName} 🙏

On espère que votre séjour à *{propertyName}* s''est bien passé !

Votre avis nous aiderait beaucoup. Si vous avez 30 secondes :
{reviewLink}

Merci et à bientôt !',
true, 'clenzy_review_request_v1'),

(NULL, 'review_request', 'en_US', 'UTILITY',
'Hi {guestFirstName} 🙏

We hope you enjoyed your stay at *{propertyName}*!

A short review would mean a lot. If you have 30 seconds:
{reviewLink}

Thank you and see you soon!',
true, 'clenzy_review_request_v1'),

(NULL, 'review_request', 'ar_AR', 'UTILITY',
'مرحبا {guestFirstName} 🙏

نأمل أن تكون استمتعت بإقامتك في *{propertyName}*!

تقييمك يعني لنا الكثير. إذا كان لديك 30 ثانية:
{reviewLink}

شكرا لك ونراك قريبا!',
true, 'clenzy_review_request_v1');

-- booking_confirmation (J-7 avant arrivee)
INSERT INTO whatsapp_template_content (organization_id, template_key, language, category, body_named, is_system, meta_template_name) VALUES
(NULL, 'booking_confirmation', 'fr_FR', 'UTILITY',
'Bonjour {guestFirstName} 👋

Votre réservation à *{propertyName}* du {checkInDate} au {checkOutDate} est confirmée.

Nous vous contacterons à J-1 pour vous transmettre les instructions de check-in (adresse exacte, code d''accès, wifi).

Bon séjour à venir !',
true, 'clenzy_booking_confirmation_v1'),

(NULL, 'booking_confirmation', 'en_US', 'UTILITY',
'Hello {guestFirstName} 👋

Your booking at *{propertyName}* from {checkInDate} to {checkOutDate} is confirmed.

We will reach out the day before your arrival with check-in details (exact address, access code, WiFi).

Looking forward to welcoming you!',
true, 'clenzy_booking_confirmation_v1'),

(NULL, 'booking_confirmation', 'ar_AR', 'UTILITY',
'مرحبا {guestFirstName} 👋

تم تأكيد حجزك في *{propertyName}* من {checkInDate} إلى {checkOutDate}.

سنتواصل معك قبل يوم من وصولك لإرسال تفاصيل تسجيل الدخول (العنوان الدقيق، رمز الدخول، واي فاي).

نتطلع لاستقبالك!',
true, 'clenzy_booking_confirmation_v1');
