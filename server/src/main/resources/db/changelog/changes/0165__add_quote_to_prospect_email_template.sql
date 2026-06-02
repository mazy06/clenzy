-- ============================================================================
-- 0165 : Template email "quote_to_prospect" (devis envoye au prospect)
-- ----------------------------------------------------------------------------
-- Jusqu'ici, le devis PDF envoye au prospect (DocumentGeneratorService
-- .sendDocumentByEmail) utilisait un corps generique hardcode "Votre document
-- Clenzy". Ce changeset seede un template systeme dedie, editable depuis le
-- menu "Documents & Communication", avec le wrapper Baitly NOTIFICATION_GUEST
-- (ton sobre client-facing).
--
-- recipient_type = GUEST (envoye au prospect/voyageur), wrapper_style =
-- NOTIFICATION_GUEST. Schema post-0156 : colonnes `body` (plain text) +
-- `wrapper_style`. Idempotent (NOT EXISTS) pour pouvoir etre rejoue.
-- ============================================================================

INSERT INTO system_email_template
    (organization_id, template_key, language, recipient_type, subject, body, is_system, wrapper_style)
SELECT
    NULL, 'quote_to_prospect', 'fr', 'GUEST',
    'Votre devis Baitly',
    E'Bonjour,\n\nNous avons le plaisir de vous transmettre votre devis personnalisé, que vous trouverez en pièce jointe au format PDF.\n\nCe devis est *sans engagement*. Notre équipe reste à votre entière disposition pour toute question ou pour planifier une intervention.\n\nAu plaisir de collaborer avec vous,\nL''équipe Baitly',
    true, 'NOTIFICATION_GUEST'
WHERE NOT EXISTS (
    SELECT 1 FROM system_email_template
    WHERE template_key = 'quote_to_prospect'
      AND language = 'fr'
      AND organization_id IS NULL
);
