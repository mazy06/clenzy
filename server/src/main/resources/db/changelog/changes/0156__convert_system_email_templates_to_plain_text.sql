-- ============================================================================
-- 0156 : Conversion system_email_template en plain text + wrapper style
-- ----------------------------------------------------------------------------
-- Contexte : la migration 0155 stockait le body en HTML rich (avec <div style>,
-- gradients, etc.). Demande utilisateur : "je souhaite pas avoir du html dans
-- la construction des emails". L'editeur frontend doit montrer du plain text
-- editable, sans balises HTML visibles.
--
-- Solution :
--   - Renomme body_html → body (toujours TEXT mais semantique plain text)
--   - Ajoute wrapper_style : determine le template HTML uniforme applique cote
--     serveur (header Baitly + body interpole + footer). Les variables systeme
--     {detailsHtml} et {urgencyBanner} restent injectees comme HTML pre-rendu
--     (cf. HTML_SAFE_VARIABLES dans TemplateInterpolationService).
--   - Re-seed les 5 templates en plain text (le wrapper redonnera l'aspect HTML
--     consistant entre tous les emails systeme).
--
-- Wrapper styles (resolus par EmailWrapperService cote backend) :
--   NOTIFICATION_OWNER : email envoye au proprietaire (badge "Alerte" + couleur
--                        rouge/orange selon severityColor variable)
--   NOTIFICATION_GUEST : email envoye au voyageur (style sobre, ton conciliant)
--   INVITATION         : email avec CTA bouton (le {invitationLink} devient un
--                        bouton "Accepter l'invitation" auto-genere par le wrapper)
--   INTERNAL_FORM      : notification interne equipe (devis landing)
--   INTERNAL_URGENT    : notification interne avec banner urgency (maintenance)
-- ============================================================================

-- 1) Renomme body_html → body
ALTER TABLE system_email_template RENAME COLUMN body_html TO body;

-- 2) Ajoute wrapper_style
ALTER TABLE system_email_template
    ADD COLUMN wrapper_style VARCHAR(32) NOT NULL DEFAULT 'NOTIFICATION_OWNER';

-- Contrainte CHECK pour la liste fermee des wrapper styles
ALTER TABLE system_email_template
    ADD CONSTRAINT system_email_template_wrapper_style_check
    CHECK (wrapper_style IN (
        'NOTIFICATION_OWNER',
        'NOTIFICATION_GUEST',
        'INVITATION',
        'INTERNAL_FORM',
        'INTERNAL_URGENT'
    ));

COMMENT ON COLUMN system_email_template.body IS
    'Body plain text edite par l''user. Variables {nameVar} interpolees au runtime. Variables {detailsHtml}/{urgencyBanner} sont du HTML pre-rendu cote Java pour les sections dynamiques. Le wrapper HTML uniforme (cf wrapper_style) est applique au moment de l''envoi par EmailWrapperService.';
COMMENT ON COLUMN system_email_template.wrapper_style IS
    'Style HTML wrapper applique cote serveur avant envoi : NOTIFICATION_OWNER (alertes operateur), NOTIFICATION_GUEST (sobre voyageur), INVITATION (CTA bouton), INTERNAL_FORM (devis equipe interne), INTERNAL_URGENT (urgence avec banner).';

-- 3) Re-seed les 5 templates en plain text (UPDATE les rows existantes)

-- Note : les sauts de ligne dans le body sont preserves par le wrapper qui
-- transforme chaque double-newline en paragraphe HTML <p>. Les variables
-- HTML-safe ({detailsHtml}, {urgencyBanner}) sont injectees telles quelles
-- (pas enrobees dans des balises).

-- noise_alert_owner
UPDATE system_email_template
SET subject = '[Baitly] Alerte bruit {severityLabel} — {propertyName}',
    body = E'Bonjour,\n\nUne alerte bruit {severityLabel} a été déclenchée sur votre logement *{propertyName}*.\n\n*Niveau mesuré* : {measuredDb} dB\n*Seuil dépassé* : {thresholdDb} dB\n*Créneau* : {timeWindow}\n*Heure* : {alertTime}\n\nCette alerte a été générée automatiquement. Vous pouvez configurer vos seuils et destinataires depuis le tableau de bord Baitly.',
    wrapper_style = 'NOTIFICATION_OWNER'
WHERE template_key = 'noise_alert_owner' AND organization_id IS NULL;

-- noise_alert_guest
UPDATE system_email_template
SET subject = 'Information importante concernant le bruit — {propertyName}',
    body = E'Bonjour {guestName},\n\nNous avons détecté un niveau sonore élevé dans votre logement *{propertyName}*.\n\nNous vous rappelons que le règlement intérieur prévoit le respect du voisinage, en particulier pendant les heures de repos.\n\nMerci de bien vouloir veiller à réduire le niveau sonore.\n\nCordialement,\nL''équipe de gestion',
    wrapper_style = 'NOTIFICATION_GUEST'
WHERE template_key = 'noise_alert_guest' AND organization_id IS NULL;

-- invitation_organization
UPDATE system_email_template
SET subject = 'Invitation à rejoindre {orgName} sur Baitly',
    body = E'Bonjour,\n\n*{inviterName}* vous invite à rejoindre l''organisation *{orgName}* en tant que *{roleName}*.\n\nCliquez sur le bouton ci-dessous pour accepter l''invitation.\n\n[ACCEPTER L''INVITATION → {invitationLink}]\n\nCette invitation expire le {expiresAt}.\n\nSi vous n''avez pas demandé cette invitation, vous pouvez ignorer ce message.',
    wrapper_style = 'INVITATION'
WHERE template_key = 'invitation_organization' AND organization_id IS NULL;

-- quote_request_internal
UPDATE system_email_template
SET subject = '📋 Nouvelle demande de devis — {fullName} — {city}',
    body = E'Nouvelle demande de devis reçue depuis le formulaire de la landing page.\n\n*Forfait recommandé* : {recommendedPackage} (à partir de {recommendedRate} € par intervention)\n\n{detailsHtml}\n\n— Email généré automatiquement par le formulaire de devis Baitly.',
    wrapper_style = 'INTERNAL_FORM'
WHERE template_key = 'quote_request_internal' AND organization_id IS NULL;

-- maintenance_request_internal
UPDATE system_email_template
SET subject = '{urgencyTag}🔧 Demande de devis maintenance — {fullName} — {city}',
    body = E'Nouvelle demande de maintenance reçue depuis le formulaire de la landing page.\n\n{urgencyBanner}\n\n{detailsHtml}\n\n— Email généré automatiquement par le formulaire de devis maintenance Baitly.',
    wrapper_style = 'INTERNAL_URGENT'
WHERE template_key = 'maintenance_request_internal' AND organization_id IS NULL;
