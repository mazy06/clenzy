-- ============================================================================
-- 0184 : Template de message dedie ACCESS_CODE (code d'acces serrure au voyageur)
-- ============================================================================
-- Ajoute le type ACCESS_CODE. Au passage, on recree la contrainte CHECK de
-- message_templates.type qui n'incluait que CHECK_IN/CHECK_OUT/WELCOME/CUSTOM —
-- alors que l'enum Java porte aussi NOISE_ALERT et PAYMENT_LINK (dette corrigee).
-- Seed FR uniquement : l'interpolation traduit selon la langue du voyageur.
-- ============================================================================

ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_type_check;
ALTER TABLE message_templates ADD CONSTRAINT message_templates_type_check
    CHECK (type IN ('CHECK_IN','CHECK_OUT','WELCOME','CUSTOM','NOISE_ALERT','PAYMENT_LINK','ACCESS_CODE'));

INSERT INTO message_templates (organization_id, name, type, subject, body, language, is_active, created_at, updated_at)
SELECT o.id, 'Code d''acces serrure', 'ACCESS_CODE',
  'Votre code d''accès à {propertyName}',
  E'Bonjour {guestFirstName},\n\nVoici votre code d''accès pour la serrure connectée de {propertyName} :\n\nCode : {accessCode}\nValide du {checkInDate} au {checkOutDate}\n\nLe code s''active automatiquement à votre arrivée et se désactive à votre départ.\n\nEn cas de besoin, contactez-nous : {emergencyContact}\n\nBon séjour !',
  'fr', true, NOW(), NOW()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM message_templates mt
  WHERE mt.organization_id = o.id AND mt.type = 'ACCESS_CODE'
);
