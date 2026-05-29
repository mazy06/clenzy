-- ============================================================================
-- 0155 : Templates email systeme editables (remplace les String.format Java)
-- ----------------------------------------------------------------------------
-- Contexte : avant cette migration, 5 templates email etaient hardcodes dans
-- les services Java :
--   - NoiseAlertNotificationService.buildAlertEmailHtml()      → noise_alert_owner
--   - NoiseAlertNotificationService.buildGuestMessageHtml()    → noise_alert_guest
--   - EmailService.buildInvitationHtmlBody()                   → invitation_organization
--   - EmailService.buildHtmlBody() (devis)                     → quote_request_internal
--   - EmailService.buildMaintenanceHtmlBody()                  → maintenance_request_internal
--
-- L'utilisateur ne pouvait pas adapter le wording (texte, ton, branding) sans
-- une release. Cette migration cree la table `system_email_template` qui stocke
-- les templates en base, editables depuis le menu "Documents & Communication".
--
-- Meme architecture que `whatsapp_template_content` (migration 0154) :
--   - organization_id NULL = template SYSTEME global Baitly (read-only)
--   - organization_id defini = override per-org (editable)
--   - Resolution: override > systeme (fallback)
--
-- Specificites email vs WhatsApp :
--   - Un `subject` en plus du body (l'email a un objet, pas WhatsApp)
--   - body_html (HTML rich avec inline styles) au lieu de body texte simple
--   - Pas de format positionnel Meta {{1}} : on utilise {nameVar} direct
--   - Variables interpolees par TemplateInterpolationService cote serveur
--   - recipient_type pour info uniquement (OWNER, GUEST, INTERNAL_TEAM, INVITED_USER)
--
-- Variables speciales pour les templates avec contenu dynamique :
--   - {detailsHtml} : block HTML pre-rendu cote Java pour les listes
--     dynamiques (services selectionnes, travaux). L'user voit cette variable
--     comme une variable "speciale non-editable" dans la sidebar.
--   - {urgencyBanner} : banner d'urgence pre-rendu pour maintenance_request
--
-- I18N : tous les seeds sont en FR pour l'instant (les emails system sont
-- actuellement envoyes en francais uniquement). L'override per-org peut creer
-- d'autres langues, et un futur seed multi-langues completera EN/AR plus tard.
-- ============================================================================

CREATE TABLE system_email_template (
    id BIGSERIAL PRIMARY KEY,

    -- NULL = template systeme global Baitly (read-only pour les orgs).
    -- Defini = override per-org (editable par l'org proprietaire).
    organization_id BIGINT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Slug stable, identique au flow Java (NoiseAlertNotificationService etc).
    template_key VARCHAR(64) NOT NULL,

    -- Locale : fr, en, ar (formats ISO 639-1 simples, pas le format Meta).
    language VARCHAR(8) NOT NULL DEFAULT 'fr',

    -- Type de destinataire — pour info / UI uniquement.
    -- OWNER : envoye au proprietaire du bien (alertes operationnelles)
    -- GUEST : envoye au voyageur en sejour
    -- INTERNAL_TEAM : envoye a l'equipe Baitly (notifications landing page)
    -- INVITED_USER : envoye a un user invite a rejoindre une org
    recipient_type VARCHAR(32) NOT NULL DEFAULT 'OWNER',

    -- Sujet de l'email. Peut contenir des variables {nameVar} interpolees.
    -- Limite a 255 chars (limite SMTP standard pour subject).
    subject VARCHAR(255) NOT NULL,

    -- Corps HTML complet de l'email. Variables {nameVar} interpolees par
    -- TemplateInterpolationService au moment de l'envoi. Peut contenir des
    -- variables speciales comme {detailsHtml} pre-rendues cote Java pour les
    -- contenus dynamiques (listes, banners conditionnels).
    body_html TEXT NOT NULL,

    -- TRUE = systeme Baitly (read-only), FALSE = override per-org.
    is_system BOOLEAN NOT NULL DEFAULT false,

    -- Pour les overrides : pointe vers le template systeme parent.
    -- Permet le bouton "Restaurer le defaut systeme" dans l'UI.
    parent_template_id BIGINT NULL REFERENCES system_email_template(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unicite : 1 seul template par (cle logique, langue, org).
    CONSTRAINT system_email_template_unique_per_org
        UNIQUE (organization_id, template_key, language),

    -- Coherence is_system <-> organization_id (memes regles que WhatsApp).
    CONSTRAINT system_email_template_system_org_consistent
        CHECK (
            (is_system = true AND organization_id IS NULL)
            OR (is_system = false AND organization_id IS NOT NULL)
        ),

    -- Recipient type dans la liste fermee.
    CONSTRAINT system_email_template_recipient_check
        CHECK (recipient_type IN ('OWNER', 'GUEST', 'INTERNAL_TEAM', 'INVITED_USER')),

    -- Subject + body non vides.
    CONSTRAINT system_email_template_subject_length_check
        CHECK (char_length(subject) BETWEEN 1 AND 255),
    CONSTRAINT system_email_template_body_length_check
        CHECK (char_length(body_html) BETWEEN 1 AND 100000)  -- 100KB max pour un body HTML
);

-- Index principal : resolve(org, key, lang). Memes patterns que WhatsApp.
CREATE INDEX idx_set_key_lang_org
    ON system_email_template (template_key, language, organization_id);

-- Index partiel sur les templates systeme (frequent en lecture pour les services).
CREATE INDEX idx_set_system
    ON system_email_template (template_key, language)
    WHERE is_system = true;

-- Index unique partiel : 1 seul template systeme par (key, lang). Necessaire
-- car PostgreSQL ne considere PAS deux NULL egaux dans un UNIQUE classique.
CREATE UNIQUE INDEX idx_set_system_unique
    ON system_email_template (template_key, language)
    WHERE organization_id IS NULL;

-- Index sur les overrides per-org pour l'UI Documents (fast scan par org).
CREATE INDEX idx_set_org_overrides
    ON system_email_template (organization_id)
    WHERE organization_id IS NOT NULL;

-- Trigger updated_at auto (pattern Baitly standard).
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_updated_at_bump
    BEFORE UPDATE ON system_email_template
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

COMMENT ON TABLE system_email_template IS
    'Templates email systeme editables. organization_id NULL = template systeme global Baitly (read-only), defini = override per-org.';
COMMENT ON COLUMN system_email_template.body_html IS
    'HTML complet de l''email. Variables {nameVar} interpolees au runtime. Variables speciales pre-rendues : {detailsHtml}, {urgencyBanner}.';

-- ============================================================================
-- SEED : 5 templates systeme en FR (organization_id=NULL, is_system=true)
-- ----------------------------------------------------------------------------
-- Source : extraction des buildXxxHtmlBody() Java en vigueur avant cette
-- migration. Les variables Java %s sont converties en {nameVar} explicites.
-- Pour les contenus dynamiques (listes for-loop), on utilise {detailsHtml}
-- pre-rendu cote Java avant interpolation finale.
-- ============================================================================

-- 1. Alerte bruit — Proprietaire (NoiseAlertNotificationService.buildAlertEmailHtml)
INSERT INTO system_email_template
    (organization_id, template_key, language, recipient_type, subject, body_html, is_system)
VALUES (
    NULL, 'noise_alert_owner', 'fr', 'OWNER',
    '[Baitly] Alerte bruit {severityLabel} — {propertyName}',
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:{severityColor};color:white;padding:16px;border-radius:8px 8px 0 0">
    <h2 style="margin:0">Alerte bruit {severityLabel}</h2>
  </div>
  <div style="padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
    <p><strong>Logement :</strong> {propertyName}</p>
    <p><strong>Niveau mesuré :</strong> {measuredDb} dB</p>
    <p><strong>Seuil dépassé :</strong> {thresholdDb} dB</p>
    <p><strong>Créneau :</strong> {timeWindow}</p>
    <p><strong>Heure :</strong> {alertTime}</p>
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
    <p style="color:#666;font-size:12px">
      Cette alerte a été générée automatiquement par Baitly.
      Vous pouvez configurer vos alertes depuis le tableau de bord.
    </p>
  </div>
</div>',
    true
);

-- 2. Alerte bruit — Voyageur (NoiseAlertNotificationService.buildGuestMessageHtml)
INSERT INTO system_email_template
    (organization_id, template_key, language, recipient_type, subject, body_html, is_system)
VALUES (
    NULL, 'noise_alert_guest', 'fr', 'GUEST',
    'Information importante concernant le bruit — {propertyName}',
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#6B8A9A;color:white;padding:16px;border-radius:8px 8px 0 0">
    <h2 style="margin:0">Information importante</h2>
  </div>
  <div style="padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
    <p>Bonjour {guestName},</p>
    <p>Nous avons détecté un niveau sonore élevé dans votre logement <strong>{propertyName}</strong>.</p>
    <p>Nous vous rappelons que le règlement intérieur du logement prévoit le respect
       du voisinage, en particulier pendant les heures de repos.</p>
    <p>Merci de bien vouloir veiller à réduire le niveau sonore.</p>
    <p>Cordialement,<br>L''équipe de gestion</p>
  </div>
</div>',
    true
);

-- 3. Invitation organisation (EmailService.buildInvitationHtmlBody)
INSERT INTO system_email_template
    (organization_id, template_key, language, recipient_type, subject, body_html, is_system)
VALUES (
    NULL, 'invitation_organization', 'fr', 'INVITED_USER',
    'Invitation à rejoindre {orgName} sur Baitly',
    '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;border-radius:10px 10px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;font-size:22px;">Invitation à rejoindre une organisation</h1>
  </div>
  <div style="background:#ffffff;padding:30px;border:1px solid #e2e8f0;">
    <p style="font-size:16px;color:#334155;">Bonjour,</p>
    <p style="font-size:15px;color:#475569;"><strong>{inviterName}</strong> vous invite à rejoindre
      l''organisation <strong>{orgName}</strong> en tant que <strong>{roleName}</strong>.</p>
    <div style="text-align:center;margin:30px 0;">
      <a href="{invitationLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;">Accepter l''invitation</a>
    </div>
    <p style="font-size:13px;color:#94a3b8;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
    <p style="font-size:12px;color:#667eea;word-break:break-all;">{invitationLink}</p>
  </div>
  <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:12px;">Cette invitation expire le {expiresAt}.</p>
    <p style="margin:5px 0 0;color:#94a3b8;font-size:12px;">Si vous n''avez pas demandé cette invitation, vous pouvez ignorer ce message.</p>
  </div>
</div>
</body></html>',
    true
);

-- 4. Demande de devis (EmailService.buildHtmlBody) — utilise {detailsHtml} pour
-- les sections dynamiques (coordonnees, bien immobilier, services). Le service
-- Java pre-rend ces sections en HTML avant l'interpolation finale du template.
INSERT INTO system_email_template
    (organization_id, template_key, language, recipient_type, subject, body_html, is_system)
VALUES (
    NULL, 'quote_request_internal', 'fr', 'INTERNAL_TEAM',
    '📋 Nouvelle demande de devis — {fullName} — {city}',
    '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;border-radius:10px 10px 0 0;">
    <h1 style="color:white;margin:0;font-size:22px;">📋 Nouvelle demande de devis</h1>
    <p style="color:rgba(255,255,255,0.9);margin:5px 0 0;">Baitly — Formulaire Landing Page</p>
  </div>
  <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:15px 20px;">
    <strong style="color:#15803d;">🎯 Forfait recommandé :</strong>
    <span style="font-size:18px;font-weight:bold;color:#15803d;">{recommendedPackage}</span>
    <span style="color:#666;">(à partir de {recommendedRate} € par intervention)</span>
  </div>
  {detailsHtml}
  <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;">
    <p>Cet email a été généré automatiquement par le formulaire de devis Baitly.</p>
  </div>
</div>
</body></html>',
    true
);

-- 5. Demande maintenance (EmailService.buildMaintenanceHtmlBody) — meme pattern
-- {detailsHtml} pour les sections dynamiques (travaux selectionnes, description).
-- {urgencyBanner} pre-rendu pour le banner couleur selon urgency level.
INSERT INTO system_email_template
    (organization_id, template_key, language, recipient_type, subject, body_html, is_system)
VALUES (
    NULL, 'maintenance_request_internal', 'fr', 'INTERNAL_TEAM',
    '{urgencyTag}🔧 Demande de devis maintenance — {fullName} — {city}',
    '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);padding:30px;border-radius:10px 10px 0 0;">
    <h1 style="color:white;margin:0;font-size:22px;">🔧 Demande de devis maintenance</h1>
    <p style="color:rgba(255,255,255,0.9);margin:5px 0 0;">Baitly — Formulaire Landing Page</p>
  </div>
  {urgencyBanner}
  {detailsHtml}
  <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;">
    <p>Cet email a été généré automatiquement par le formulaire de devis maintenance Baitly.</p>
  </div>
</div>
</body></html>',
    true
);
