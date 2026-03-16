-- 0088 : Seed default message templates for all organizations
-- Inserts 4 default templates (CHECK_IN, CHECK_OUT, WELCOME, CUSTOM) per organization
-- Uses NOT EXISTS guard to avoid duplicates on re-run

-- 1. Check-in template
INSERT INTO message_templates (organization_id, name, type, subject, body, language, is_active, created_at, updated_at)
SELECT o.id, 'Information Check-in', 'CHECK_IN',
  'Votre arrivée à {propertyName} – Informations de check-in',
  E'Bonjour {guestFirstName},\n\nNous sommes ravis de vous accueillir prochainement à **{propertyName}**.\n\n\U0001F4CD Adresse : {propertyAddress}\n\U0001F4C5 Date d''arrivée : {checkInDate} à partir de {checkInTime}\n\n\U0001F511 Code d''accès : {accessCode}\n\n\U0001F697 Parking : {parkingInfo}\n\n\U0001F4CC Instructions d''arrivée :\n{arrivalInstructions}\n\n\U0001F4F6 WiFi :\nNom du réseau : {wifiName}\nMot de passe : {wifiPassword}\n\n\U0001F4CB Règles de la maison :\n{houseRules}\n\nVotre code de confirmation : {confirmationCode}\n\nEn cas de besoin, vous pouvez nous contacter à tout moment :\n☎ {emergencyContact}\n\nNous vous souhaitons un excellent séjour et restons à votre disposition.\n\nÀ très bientôt !\n\n{locationMap}',
  'fr', true, NOW(), NOW()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM message_templates mt
  WHERE mt.organization_id = o.id AND mt.type = 'CHECK_IN' AND mt.name = 'Information Check-in'
);

-- 2. Check-out template
INSERT INTO message_templates (organization_id, name, type, subject, body, language, is_active, created_at, updated_at)
SELECT o.id, 'Informations de check-out', 'CHECK_OUT',
  'Votre départ de {propertyName} – Informations de check-out',
  E'Bonjour {guestFirstName},\n\nNous espérons que vous avez passé un excellent séjour à {propertyName}.\n\n\U0001F4C5 Date de départ : {checkOutDate} avant {checkOutTime}\n\n\U0001F4CC Instructions de départ :\n{departureInstructions}\n\nAvant de partir, merci de :\n• Vérifier que tout est en ordre\n• Fermer les fenêtres et éteindre les lumières\n• Remettre les clés ou sécuriser l''accès selon les consignes\n\nSi vous avez besoin d''aide ou souhaitez prolonger votre séjour, contactez-nous :\n☎ {emergencyContact}\n\nMerci encore pour votre visite, {guestName}.\nNous espérons vous accueillir de nouveau très bientôt.\n\nBon retour et à bientôt !',
  'fr', true, NOW(), NOW()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM message_templates mt
  WHERE mt.organization_id = o.id AND mt.type = 'CHECK_OUT' AND mt.name = 'Informations de check-out'
);

-- 3. Welcome template
INSERT INTO message_templates (organization_id, name, type, subject, body, language, is_active, created_at, updated_at)
SELECT o.id, 'Email de Bienvenue', 'WELCOME',
  'Bienvenue à {propertyName} – Profitez de votre séjour',
  E'Bonjour {guestFirstName},\n\nBienvenue à **{propertyName}** ! Nous sommes ravis de vous accueillir.\n\nVoici quelques informations utiles pour votre confort :\n\n\U0001F4F6 WiFi\nNom : {wifiName}\nMot de passe : {wifiPassword}\n\n\U0001F697 Parking\n{parkingInfo}\n\n\U0001F4CB Règles de la maison\n{houseRules}\n\nEn cas d''urgence ou de besoin pendant votre séjour :\n☎ {emergencyContact}\n\nNous vous souhaitons un séjour agréable et reposant.\nN''hésitez pas à nous contacter si vous avez la moindre question.\n\nProfitez bien de votre séjour !',
  'fr', true, NOW(), NOW()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM message_templates mt
  WHERE mt.organization_id = o.id AND mt.type = 'WELCOME' AND mt.name = 'Email de Bienvenue'
);

-- 4. Custom template
INSERT INTO message_templates (organization_id, name, type, subject, body, language, is_active, created_at, updated_at)
SELECT o.id, 'Email Personnalisé', 'CUSTOM',
  'Informations personnalisées concernant votre séjour à {propertyName}',
  E'Bonjour {guestName},\n\nNous souhaitions vous transmettre un message personnalisé concernant votre séjour à **{propertyName}**.\n\n\U0001F4C5 Séjour du {checkInDate} au {checkOutDate}\n\U0001F4CD Adresse : {propertyAddress}\n\nMessage important :\n[Ajoutez ici votre message personnalisé pour le voyageur]\n\nPour rappel :\nCode d''accès : {accessCode}\nContact d''urgence : {emergencyContact}\n\nSi vous avez des questions ou une demande particulière, nous sommes à votre disposition.\n\nAu plaisir de vous accueillir ou de vous accompagner durant votre séjour.',
  'fr', true, NOW(), NOW()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM message_templates mt
  WHERE mt.organization_id = o.id AND mt.type = 'CUSTOM' AND mt.name = 'Email Personnalisé'
);
