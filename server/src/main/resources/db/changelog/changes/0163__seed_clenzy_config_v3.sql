-- =============================================================================
-- 0163 - Seed config Clenzy v3 : align schema + tax_rules + templates
-- =============================================================================
-- Source : Postgres dev (org Sinatech, renommee 'Clenzy' en prod)
--
-- Correctifs vs 0162 :
--  1. Aligne le schema prod sur dev : ALTER COLUMN file_path DROP NOT NULL.
--     Idempotent (PG ne plante pas si la colonne est deja nullable).
--     La migration 0074 contenait ce DROP NOT NULL mais a ete appliquee en
--     prod sans cette ligne (probablement bootstrap manuel partiel).
--  2. Base64 nettoye (\n strippes) avant decode() - inchange depuis 0162.
--
-- Idempotence : UPSERT (DELETE existing matching keys + INSERT new) - ecrase
--               les conflits par decision user.
-- Volumetrie : 15 tax_rules + 4 message_templates + 8 document_templates + 253 tags
-- =============================================================================

-- --- 0. SCHEMA ALIGN : prod a divergee de dev sur file_path NOT NULL --------
ALTER TABLE document_templates ALTER COLUMN file_path DROP NOT NULL;

-- --- 1. TAX RULES (globales, sans organization_id) -------------------------

DELETE FROM tax_rules WHERE (country_code = 'FR' AND tax_category = 'ACCOMMODATION' AND tax_name = 'TVA hebergement') OR (country_code = 'FR' AND tax_category = 'CLEANING' AND tax_name = 'TVA menage') OR (country_code = 'FR' AND tax_category = 'FOOD' AND tax_name = 'TVA restauration') OR (country_code = 'FR' AND tax_category = 'STANDARD' AND tax_name = 'TVA taux normal') OR (country_code = 'FR' AND tax_category = 'TOURIST_TAX' AND tax_name = 'Taxe de sejour') OR (country_code = 'MA' AND tax_category = 'ACCOMMODATION' AND tax_name = 'TVA hebergement') OR (country_code = 'MA' AND tax_category = 'CLEANING' AND tax_name = 'TVA menage') OR (country_code = 'MA' AND tax_category = 'FOOD' AND tax_name = 'TVA restauration') OR (country_code = 'MA' AND tax_category = 'STANDARD' AND tax_name = 'TVA taux normal') OR (country_code = 'MA' AND tax_category = 'TOURIST_TAX' AND tax_name = 'Taxe promotion touristique') OR (country_code = 'SA' AND tax_category = 'ACCOMMODATION' AND tax_name = 'VAT') OR (country_code = 'SA' AND tax_category = 'CLEANING' AND tax_name = 'VAT') OR (country_code = 'SA' AND tax_category = 'FOOD' AND tax_name = 'VAT') OR (country_code = 'SA' AND tax_category = 'STANDARD' AND tax_name = 'VAT') OR (country_code = 'SA' AND tax_category = 'TOURIST_TAX' AND tax_name = 'Municipality fee');

INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('FR', 'ACCOMMODATION', 'TVA hebergement', 0.1, 'TVA taux reduit hebergement touristique 10%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('FR', 'CLEANING', 'TVA menage', 0.2, 'TVA taux normal pour services de nettoyage 20%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('FR', 'FOOD', 'TVA restauration', 0.055, 'TVA taux reduit restauration 5.5%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('FR', 'STANDARD', 'TVA taux normal', 0.2, 'TVA taux normal 20%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('FR', 'TOURIST_TAX', 'Taxe de sejour', 0.0, 'Taxe de sejour - montant fixe par commune', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('MA', 'ACCOMMODATION', 'TVA hebergement', 0.1, 'TVA taux reduit hebergement touristique 10%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('MA', 'CLEANING', 'TVA menage', 0.2, 'TVA taux normal pour services de nettoyage 20%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('MA', 'FOOD', 'TVA restauration', 0.07, 'TVA taux reduit restauration 7%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('MA', 'STANDARD', 'TVA taux normal', 0.2, 'TVA taux normal 20%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('MA', 'TOURIST_TAX', 'Taxe promotion touristique', 0.0, 'Taxe de promotion touristique', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('SA', 'ACCOMMODATION', 'VAT', 0.15, 'VAT uniforme 15%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('SA', 'CLEANING', 'VAT', 0.15, 'VAT uniforme 15%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('SA', 'FOOD', 'VAT', 0.15, 'VAT uniforme 15%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('SA', 'STANDARD', 'VAT', 0.15, 'VAT uniforme 15%', DATE '2024-01-01', NULL, NOW());
INSERT INTO tax_rules (country_code, tax_category, tax_name, tax_rate, description, effective_from, effective_to, created_at)
VALUES ('SA', 'TOURIST_TAX', 'Municipality fee', 0.05, 'Municipality fee on accommodation 5%', DATE '2024-01-01', NULL, NOW());

-- --- 2. MESSAGE + DOCUMENT TEMPLATES (sous org 'Clenzy' en prod) -----------

DO $do$
DECLARE
  clenzy_org_id BIGINT;
BEGIN
  SELECT id INTO clenzy_org_id FROM organizations WHERE name = 'Clenzy' LIMIT 1;
  IF clenzy_org_id IS NULL THEN
    RAISE NOTICE 'Organisation Clenzy introuvable - skip seed templates';
    RETURN;
  END IF;

  -- 2a. Message templates : DELETE + re-INSERT
  DELETE FROM message_templates WHERE organization_id = clenzy_org_id AND name IN ('Email de Bienvenue','Email Personnalisé','Information Check-in','Informations de check-out');

  INSERT INTO message_templates (organization_id, name, type, subject, body, language, is_active, created_at, updated_at)
  VALUES (clenzy_org_id, 'Email de Bienvenue', 'WELCOME', 'Bienvenue à {propertyName} – Profitez de votre séjour', 'Bonjour {guestFirstName},

Bienvenue à **{propertyName}** ! Nous sommes ravis de vous accueillir.

Voici quelques informations utiles pour votre confort :

📶 WiFi
Nom : {wifiName}
Mot de passe : {wifiPassword}

🚗 Parking
{parkingInfo}

📋 Règles de la maison
{houseRules}

En cas d’urgence ou de besoin pendant votre séjour :
☎ {emergencyContact}

Nous vous souhaitons un séjour agréable et reposant.
N’hésitez pas à nous contacter si vous avez la moindre question.

Profitez bien de votre séjour !
', 'fr', TRUE, NOW(), NOW());
  INSERT INTO message_templates (organization_id, name, type, subject, body, language, is_active, created_at, updated_at)
  VALUES (clenzy_org_id, 'Email Personnalisé', 'CUSTOM', 'Informations personnalisées concernant votre séjour à {propertyName}', 'Bonjour {guestName},

Nous souhaitions vous transmettre un message personnalisé concernant votre séjour à **{propertyName}**.

📅 Séjour du {checkInDate} au {checkOutDate}
📍 Adresse : {propertyAddress}

Message important :
[Ajoutez ici votre message personnalisé pour le voyageur]

Pour rappel :
Code d’accès : {accessCode}
Contact d’urgence : {emergencyContact}

Si vous avez des questions ou une demande particulière, nous sommes à votre disposition.

Au plaisir de vous accueillir ou de vous accompagner durant votre séjour.
', 'fr', TRUE, NOW(), NOW());
  INSERT INTO message_templates (organization_id, name, type, subject, body, language, is_active, created_at, updated_at)
  VALUES (clenzy_org_id, 'Information Check-in', 'CHECK_IN', 'Votre arrivée à {propertyName} – Informations de check-in', 'Bonjour {guestFirstName},

Nous sommes ravis de vous accueillir prochainement à **{propertyName}**.

📍 Adresse : {propertyAddress}
📅 Date d’arrivée : {checkInDate} à partir de {checkInTime}

🔑 Code d’accès : {accessCode}

🚗 Parking : {parkingInfo}

📌 Instructions d’arrivée :
{arrivalInstructions}

📶 WiFi :
Nom du réseau : {wifiName}
Mot de passe : {wifiPassword}

📋 Règles de la maison :
{houseRules}

Votre code de confirmation : {confirmationCode}

En cas de besoin, vous pouvez nous contacter à tout moment :
☎ {emergencyContact}

Nous vous souhaitons un excellent séjour et restons à votre disposition.

À très bientôt !

{locationMap}
', 'fr', TRUE, NOW(), NOW());
  INSERT INTO message_templates (organization_id, name, type, subject, body, language, is_active, created_at, updated_at)
  VALUES (clenzy_org_id, 'Informations de check-out', 'CHECK_OUT', 'Votre départ de {propertyName} – Informations de check-out', 'Bonjour {guestFirstName},

Nous espérons que vous avez passé un excellent séjour à {propertyName}.

📅 Date de départ : {checkOutDate} avant {checkOutTime}

📌 Instructions de départ :
{departureInstructions}

Avant de partir, merci de :
• Vérifier que tout est en ordre
• Fermer les fenêtres et éteindre les lumières
• Remettre les clés ou sécuriser l’accès selon les consignes

Si vous avez besoin d’aide ou souhaitez prolonger votre séjour, contactez-nous :
☎ {emergencyContact}

Merci encore pour votre visite, {guestName}.
Nous espérons vous accueillir de nouveau très bientôt.

Bon retour et à bientôt !', 'fr', TRUE, NOW(), NOW());

  -- 2b. Document templates : cascade DELETE tags puis DELETE templates puis INSERT
  DELETE FROM document_template_tags WHERE template_id IN (
    SELECT id FROM document_templates WHERE organization_id = clenzy_org_id AND name IN ('Facture Clenzy','Devis Clenzy','Mandat Gestion Clenzy','Validation Fin Mission Clenzy','Autorisation Travaux Clenzy','Bon Intervention Clenzy','Justificatif Paiement Clenzy','Justificatif Remboursement')
  );
  DELETE FROM document_templates WHERE organization_id = clenzy_org_id AND name IN ('Facture Clenzy','Devis Clenzy','Mandat Gestion Clenzy','Validation Fin Mission Clenzy','Autorisation Travaux Clenzy','Bon Intervention Clenzy','Justificatif Paiement Clenzy','Justificatif Remboursement');

  INSERT INTO document_templates (organization_id, name, description, document_type, event_trigger, file_path, file_content, original_filename, active, version, email_subject, email_body, created_by, created_at, updated_at)
  VALUES (clenzy_org_id, 'Facture Clenzy', NULL, 'FACTURE', NULL, NULL, decode('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', 'base64'), 'template_facture.odt', TRUE, 1, NULL, NULL, 'system-seed', NOW(), NOW());
  INSERT INTO document_templates (organization_id, name, description, document_type, event_trigger, file_path, file_content, original_filename, active, version, email_subject, email_body, created_by, created_at, updated_at)
  VALUES (clenzy_org_id, 'Devis Clenzy', NULL, 'DEVIS', NULL, NULL, decode('UEsDBBQAAAAAAEmvsVxexjIMJwAAACcAAAAIAAAAbWltZXR5cGVhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnRleHRQSwMEFAAAAAgASa+xXLvrh/HuAAAA/QIAABUAAABNRVRBLUlORi9tYW5pZmVzdC54bWytkjFrwzAQhXf/CqPdVpupCNvZOndo5iDksys4nYR0CnF/fe1A45RiaEo2ne699z2Bmv3ZYXmCmKynVjzXT6IEMr63NLbi8P5avYh9VzROkx0gsfo+lLOP0nVsRY6kvE42KdIOkmKjfADqvckOiNVPvbqQrtNNgZ3oinLlDRahmv1xWtVDRqyC5o9WyK2Q9dpBb3XFU4BW6BDQGs2zTJ6ory+F69ueNcOZhbyng/HEi3N+4QZ2yZTL+q7cxBNCenisA9YPD32zhnOEJA0CfU5H9KOvA40bEOv0CHLZ/48yeuyPMSP8ldHIXz+4K74AUEsDBBQAAAAIAEmvsVzkkU9fBwEAACwCAAAIAAAAbWV0YS54bWyNkUFuhDAMRfecIso+hCBNSy1gFq3aC9ADoOBhIoUEJWHU9vQFBhCMuujS/v/92E5+/uo0uaHzypqCijihBI20jTJtQT+rd5bRcxnl9nJREqGxcujQBNZhqMmIGg93qaCDM2BrrzyYukMPQYLt0awI7N0wPRQtAVPWf/HJe4AbWdBrCD1w3g9Ox9a1vJEcNU6U5yIWnJLl1d2eKS0jsq41pY4lyef4Fg26OlhXvmo0P9+kwq7XdUDysSo5f3BOcCMhqKCxfMOb8uQO53xrLx7pcBc+62trG0EZFVSt2aP3T3Gj5sa4H2vGYcs0SZ9YcmLiuRIvcMpAZEvA0TeegR/usJWH3y6jX1BLAwQUAAAACABJr7Fc9efNZj4IAAAIOgAACgAAAHN0eWxlcy54bWzdW+tu2zYU/p+n4LQN7YApvrZxjDhFc2sDpEXXZNtvWqJsLpQoUHQcdyiwh9i77P8eZU+yQ+piSZYd2abTtEV/OIe3c75zeG6Sjl7d+wzdERFRHgys1n7TQiRwuEuD0cD69ebC7lmvjveOuOdRh/Rd7kx8Ekg7kjNGoj0Eq4OoH48OrIkI+hxHNOoH2CdRXzp9HpIgXdXPz+6rs9IN9HZ11+vJheWS3Mu6q9Xc4mI8rH+2nlxY7go8rbtazQVgC+s9Xrn6PmK2x22H+yGWtHzoPaPB7cAaSxn2G43pdLo/7exzMWq0Dg8PG3p0ju3dqDayd6PFExN15WykbR3v7aHUJjwO9uBhh9gucVh0vIfQUayibATFf6ujB9YpFz4XOJDoDRbY54FrITg4ne1TNhtYzxZnPfsZPSv8JiAwxfAzIoJ6VuPBky8DSUTVYXpA7fmWsDsiqYPRezIhivJaUMzUGTiI7LoHnb1D1zC/6qhkSG29/NTSYUeNZVDPtRBfSM3Zd7aNzoiHJ0yiEAAbCRyOE/6QwwgOcgegIXdnyLZzMrnx2viOJ+tS/rP9LLUgXZFR7VCAWQlJSYQ83gc7JPaY0NEYrmer2/zRQjnYaOASZYPKn+iZUYgd7Xc8zCIS45weoa5tfvfcPgXlwqmaGNFPQGw1Q6lpDmdcDKzvWyftg04zUWGjQl6FaXpmHoBEsfFUaykqyYDDcBQNLMV0LaB8DKYc2JKHAytlOaENuZTcj8mPhUgOCWVM//39F/xHJ3AdXTTEQUAEen7KSPBphmiAHEGw/1M6q2BKiwjqTU70HstRrAOZFh8zOgKXFEksKkFr+/6aoFV5pyKC7V6CoKZNE+secuYWcG2/7HQ6Z5rEiARNzM3bbu6/SLVZAflK6G7wSN2V7bCrYW69tZGrNLcDLenDaJ32Dtvd15VoteMtclxIACLyQFEQ10Lgx8Gpt1htwGdJtENyFhLE8JAw9BxAsIXiCg0Zd27r2jHsdQO7nM/IUPCpOVMmicGV1NEyo456prtKGduo4gEsb6hkWxp2DSR34hLa67iEDeF5RyT+WuzssBRkXp4ctHu1gsw1cSSkmUgqY0DPR4AhmkCOIJTXq3s5k00MGFTeU74EbJYYlCKH2FVV0xzK/Rcwos5Qo0MuQIh5NFdODUWcURel980g7qvt8EX3oNs7rLzfrf2eIWd7M1XVC5v4gUpC5Sx2rzUV+EGtuFIO2oj6DFu3gaDW2i6orcTtPfzceX7Q3F8/Q3jYkba6u3SkGp0zcKPUjFmtxqdjyJVmxlYzY18p/buJJO5XJPzGceRElbXz6rdmcQKLzIHTXh0v8tH4j0kkqTf7EgXeKizO/XCsmkbfDCY7cSsXnMuAS4M+dwlKpoqABY+SXKv5PLXPwKISVOHUCvaqLWoLwjC4l5iNqOadu4K8Ti8vw6dbrQXoNGVR3il15RjQOWgq2OIObWJDMYDR2ipVTJ1ydkYip5KtJLOp4C4eWGQyoSe8HjZTVZaYepinX+SCizLCUntzlj4I6lSrb1umOpszdcPBeh+XqVVcaRN/SzAUAaeELWNMjVSwBeSStxhi53YkOFRGdkXDKSlFgNXEkcTVx8AKeLB+UqlZV+HABONLWKsujM56Z6fn64cuzbDWv+K4sowwgPdF76J7fr4K79iZt6oLvY3l+Q2zybLb9hXJE9+FG9UhN9wHfrQ+2YX+t6S+20mnrITcR8WY2Z7Qtw6eukHbGd1TqukKIj1NazAnq3KA2pmbdRqG5Fyvxqg0+50YvUJNh4wvjVqN7s9LE2VadQ/SgS0xVU8udUyE/YTuS9LahcqHePYXqVUeZgsy3p0ku70X62fgKUvm0sX4Cd28BX+nZjiYpdYIiUkde7gMPI4cLFz0/JbMGnfqWiBGI4kAeOoShNGQ39d9yqB2O4XNnpAxpCwZy3uzTLDt+yjLBlcmjxsm9DWlMpL91pZqnqPsRqo1w9m2/Z7VfjXXBSqHpubmj4UeQGDN0PToL71cw3XEciLIWs+vslXmnmHFjcHmI3UGN7aUHeXuc0C3fvklDSlxMdutqHALlztvKgYfzuolWYt1s2ccqvGsEhrgpqZdxivMZYEOyQQt968NFpLrI3MZqNcF1kHmWgoejBYCS/kFvrIgu3qmcJnYxYbsFK1r3cPfaCFMI/FAsyivPR+PIEOHIoGs9yzh0h/Fmi9zr+0YkMgLkNAq0jIYSFqlCSVLN0MeQW5GXZctjgnCQGpwbpoBdVAyY8wF/aTKj2S9J7hvM+JlbjI3QW8yv496F/XWOAgr+C1J2dIkjzK2YUv3io/4hah4T8AoUCorr0SpJOCThelaYj986jiJfNvn8TFSzuLjhJHdw7TtvUuD1RezJoKZKZTcGew5DxBiApF3DMXLaKywSAuZPBpFLOPE8eu1OuXAfocTjL4e1t7guZ52EdtzsuLVTJ1RdZe/N7HphTXL9JJMsFPNd2dZUyn71CWO+/kvXPAElmKwUzsdyzE4IjbDMz6RBVFfd680sSRNNnmhMoCR9HF4Ky21NDX9iKV9eJB7qTMvaau3pDQr0VVEWyzkkv6WJuduXSgopFRwuwBdLPXnVyEXUFHR0mOusX4mFCNTGPB0xp9+24IWViTjpXsBHGWf7ZQ4zcwxOaZRfU5Kz6GdV++iMueK9nGUbZXXckJXO5avYODm+nB5Ba+wg5jjBBP9VWCoC4bY9OxCwXT8w5+gAUFAHxHZD7j/Gf37DyoQsStIFBE9cH358fymOBxRQeTiKuJjyhbJkjASjsExfj5qxKxVgJ2HOYdNHuYSlBm99B3n8d7/UEsDBBQAAAAIAEmvsVyQkGeu2gUAABEpAAALAAAAY29udGVudC54bWztWs1u4zYQvucpCDXoqbaTbotu1NiLJt5tA2S32cTdHorCoKWxzVYiVZKy4wYBeu29L+Fb0Uvv8Zv0STqkpFjyTyLnzw6wl8QazgyHM98MR6T2X52HARmAVEzwurNb3XEIcE/4jPfqzg+tN5WXzqvG1r7odpkHri+8OASuK57gGv9vERTnyk2G604suSuoYsrlNATlas8VEfBMzM1zu2ayTIHSo6C0vGUuiGs412WlDW9RmHbKz22ZC+K+pMOy0oYXPVuQ74qF0ucqqHQFOjqMqGazk54HjP9ad/paR26tNhwOq8MXVSF7td29vb2aHZ36dtAr7dlBb37GNFw5kHzuNLZIhomO8Ef4eP1s/NvYQgKSEm/ZvyT5bWavO98B9UG2DMVJB2xQK8nwCZWagUrGG1ZVQRfaGMQhXy55KAKn9qCCUgxT8oxCCIIb1OFotgAjaKAXEfsvz30seuJHSSOnsW8Q4nYlkon9Ocv2xgw5BAPlDpmv+3Xny+qOFyaUPrBeX5sIffHC0OxElHt9ISt6FKGKiEraw5n62VQspD0gFjBuX0IXTWeejiWomhcA/33UDnDWasR7TsqVKFIsjEzwEprqC8wBCDvgZySKWqhGTsGPBfXRq/u16eLwIXHG7c45kJT7LdpDrQiGEykiCXoyJp/SMPqahHGgmQI5QOgpcvUvQc8zNasdn2di9njBbAqvhS56PYIOgsZpNGEwb9Ct4i2mDfabrz8cna0s/BY0xQAnwxHl84xnWgoMaWIc4Vd/EzedxfA3yPYF71Y5lgYpLh9zekTIopl9pM/NuzSIxYHrTC2QU9Iyy78VgX8aB1AiCzPW+Uzc/Wo+FXequy/vn4o9nLMtcdLHTMRbanaaBR/rdcI9OqYdQObJnyFoDbEsnyZW/J1BT2P7AjdfCRHWLKhyEa6QbFZLE1ONBTN6qI+YUfMJdIuut7FG1DTOjk5ft0hBoWJYcu+orqAIQrT2IRRpCCDqC75ClXhkHDRBacYphkPCHaHgBQyXaGDQNk1YsLrPp3BIdSnhMVhQS1fVc6fAzWlZHrWyEEgV4QsKtCOhNA0uyTV1wILgabeNM/A09sTpZn2AVhB8M/JA8sk4V1hvrKtHvCsOqfQXFdbrsbUV1fuX1mwNJqfSXLk16EbG8rZwJHHsw+Z53qgPNIihpFGWNzFq+yLCXhQQnQsL96qwW7ePv0k2jU12c7avfUZyxJlScE1/mGKw7qiYdnqTQ2J60Gfv5LNYdqm30X5WiYmXJLz6Z30bXBPbAO7Dx53twaD3fecX0BsIPD+JdFUzbLmffYKbKkp8IBHuH5oaQG+yy9HYdnqi9ew9fyKZkEznu+GNc3iU2Pj8nW1P05SI+9R4fBP3s8zl5nyvnVoKz9/xh3Iy5kBjLDCTcXcylhuNd0+CMfZJX5QPhD8qAACUJ1lkSvGMHWVbkcnYHC4QP8bCXjhgv7knOWYcjjSEC88xzWDLUFfrSowYdhZNXNOKbUkq+V6P7iaI5dWDu4m2BL4xLRbt29s5E2i1EKS5BCuFXuvS5MovOVhbGuMcZ1rSJmPFery4Zy/Ppcc159Qc6TuN9/ntbM22IADOScxZ8dhxzUZZaJUwZmk1L9Dn0Zia0/jpk4ApTRjX2C0BNxipBogWUIQqYn/9PFPk7rNR2MWaQlbGKYYnK7zWksUl737bwp0sSoOUmfVbTNFz+e5n/TZhR3bezlC9SYZpg+wSBi3vU1Lk1ix0HxydNvOmjUy288VhBzMo2RFUxdyzcvDrzosSXYTVmH+VMs+k1TpcucHxxAAk+JUpQ21ljhU8ULZNsgKL+yQR67a51Qmf9lLhjRCaC22vhHgXzeA+M1VDtSPKwHytU7ZlmtE0oAHziy86NzdLZ3brNTfQH299c95I3xJORCzJof1Ipvx11lSJ/ZzlnQjTD1lUNrDOC83ZJR4ITiKzTOp5Qvrkvz/+whWby7a1rLhccm0ZSuFjtOlz8rHa9ePs94yNrf8BUEsDBBQAAAAIAEmvsVzml/3TmoEAAE+CAAAYAAAAUGljdHVyZXMvY2xlbnp5X2xvZ28ucG5nvFr1V9RftB26u7u7u4YUlQYB6W4YGulOQemURlI6h24QpEG6u2PoAYZ4ft9a7194Z61P/HhP7H32uffGaKh9xEInRwcAAFiKCvKaAADc7b//BFTkf29MeTbgvw+aq4K+BwCAPfjfA5fGgU0BANACFOVltX1yzrp8U6l0Pd9g67Ac8otzWa5ypjEnxXSr5T8ffBwdf6Naig3xNfOZOQo8ZkTgKqCaMwGDgCYm1N/rfHw5qUdwfPQZ6RD7VRIznYDmiVe0GLPUjGMNVeVChulCTX6tLVEek0HB2usXq+HFOtB5q0XbagPd9RNDz4qL6hVbSCPUGwHp/8FqZY6scAoK6qNRN30PcwEhZAI2vICmpiZazHfxhX+c2s74vSWSJMrDHXnp+2/RJcrC/pllCe9RGZuxcaHh5JL0Td/nykMmK5tm5G2m8aYlpitg2FVS1vok46qi0Q4Ix+QoMu8QjA9iwFb/OOnMH7O8TvnQMdW9nbWeK39glT+r57jGGlRS0uM0Nbk+2wzZ2FhYNLXHeDHLg/geUpwSM8VkYjS07/lXTmZJ7VqKGHked6dIHvy3iBRZ82l1gQvfk/J7SQnT9mZ+s42qgdIbzYXvO4PCGfBTCRyBZ7LCYOHHNwuUigSTx6/KwrcuoIRJUcuyC6TRFxhs1fsiqL6rLNisFGHiGtzNqTqbGXKWKex0skv7RtJi5P87NMXT2fT85K+HllD2sun0rK5+U63tJmXoCe1vKvo586pM5mKD5VkDAtgQnA4AH4UrJhPfj+Z5lyIj8MYqrqegoGDLSpP0djakbMEF4mNuCP2bl5e3GnELPkOp1ul1c9jyp0vV5LWnFHp08PXwmGVxMfV6zLu6gF18XGjqw16rDxyepDA0MCAGnUvWv21103B3PY9+5AmayFmPAyYQccj3xH5dmc0brQrsenGamKiuHhqRO9y7w3anxvNMvM4G6/wM+XLCGevmilt33ZuHLNsnilGPbYZED/9OphRdeEY6cM9YJLgwyZKblZVV1JgV84ntW/SRqdSTo8emDKQDpWKkQ9NW/H25zS7iIPneo6swUjKqEuNMrAunSevlrEur3fZGDCUkkgomTh28cyWBb/k2hDNwwCiknjbwd6psPOt6/XHbuus7iRb/ssfTqEiPP1X51ktQWwBcfd7nuBR+Np65ldlBzEPKWAA9PBwCoN+dIJaPl1tgiz5szqAOt6lsKwfhXa9w2CCC6dOR/8Zr/Uh8438R/VL8r/RIK4Uvcrps7k6yqy4Nq8wUPZQN/V1KRofQ5O318FinwjXRuWOm5Ww6vj+9Xb2D+K0GC9PzndXbinD7OA9EBSNfTch9yx2ASykFBU5453aZ9SEsmj5lCRGsQ42Nja157oixtAs5oFTAW2pzE3qlRoIwD2x6+AX0cUyUKHDmV2xmXDzKBl3e0Ag6iz7cXv0HKxnFfeXgu5psjHATDY3Liv9WiAp6/8zVY+w5cdEFk0ovbh3lyRgYxFOw17OouwdoKlSHRocoFBhb9DdBLF30BN+kiXlMgPY47UMv6kD//XQqntccYG0X/m/WSNU6Zj7hGBFBWB/JlFTlLsuiidtr8cJKD2ws7bvpyTKU6F5JeRlnyRKHmHgBndLqEoKKWS1ECTcpJjoS2x7d204oxaZHwGCGwZjG83LXsalDevsPOrpMAQ0oGoDn55ky8aCbro7XoNOLLu9k3fZJkDOaJcZRHVo5g575YIysUDwtPYAyRwh74fnsHaTz2JTCfhzOTHxY/fb+DoJnF1FCrPeXtxjMLmQ8bTveI7nYdTcsHXR0PLlPT/D6uua2mwY6zBGCpZi32Yvo0Qkj/6t5RLNzWV8pBXtUgtjW8R8SKKFIf0LFBG4BMqlkviCngRrZf9Z3/OEftOnp+xOAjTed1RLQgGGOjDeo5s3cwZINmlm8pLwb/DC6OE69AKoKNiZGwtpCaWKPD/CkVkJCQlVLWZkJjJ1UrxAX6Yn4SaqzTlFiQfd8ueUNBSX4y2Z+rUlXGXBml9POy3he6U0cRKnH5rOCQohDDiGnT47czfwZ3ZifC4dG60pLz1pC7n7xH0WWcUTKSsc8O8xnZS84Brx+3Uur5bvsX4I/i4yuRmBDJgyPTixlaxo2c5+20KDHSMMMOM1p4fTf8YkFPbpvz2VNf7OKsauSWQkXwh4Ss9u0ZDVhrep5GHzaDK45jVw/JxBTs7Uts8/+207E6GoBh88KL0iwxalwHdESwOD2KHwrkOh7NERKuMP/H1nboIcH4R9dXGD3eC+6vPrc3K+b1p8Z2ynSrZJih8xZC7OWANyj2YkSlc0Kg1p9zKbWBMqeDxt2GZEF9s9IDr55zAKnEEL6iJw+hmik1zGboX5abnjL4NB9ueBQl37b6YyhVBbzBpCex9kqY1hqBdhjoKOjf9ACUqjD9wT63Xy9h2I/CzxuOw5nUXGE8HOYuIzLU+aQih7iPpGrmoekTwtIjYtsNn+xfwcaPF2uO34Eje67+yczAhBpUci2n9Hh0slQ5fKVSgx1JTueKhPUe39xEA+n+q+26QZxGv6XeNn/8k7L0d4xUPty1N1zInIgEKQM6jDH0mCOh8f0PUhdtEAACCBwG7JQH0EiY4qq9zU2fTuHfKAMPaYyVdJ2SOZcx1VRuNeo/YkZzj97zTMZ+sDq0i1PlZUL53o+nMMMaZHjstzZonOqdg6LJQX/8ckRIfILYsPdclwLNuOBluxNanMF3uCHrRNH4pEjnEExlH1fAKk8+rf50e8HE4b+wKEWOXmXTTBsgGu21FOHg0+PRmxmPDRJVHYHVbYtxjIJlKffc5FPs9xc7dQ5vIdny+krKIPKIEztwfGPZVn/sOZFswDwtmHUwScrSjtSFE1N4yfq+KILl0r6YaLfEWQTqwts89iTQqKTionzsM1iZcu1lbKyywLKZqwdZBbOrGFTwS+2QdPPh5JdgeKskQr44TOaSIJHJRh8nHjaWwz8xPulxFT6/rMePcH3Nxx5F9QZn7xzApEwXDr/+Wrm/p+vl0uzPOMrTU4wW8rZtUE0TY5p2WhWxSSyy/Eftqf9AOWDagK8pntzpF9DaMhPlYYGY9XGw5axFKZ+t39ZwfkquSAEDh9ZNgzo4h/lSdAY/OMcAq2ci6m0How02oL1nI/tbX3KxcgD5hMPcifLNOCWSIJPCksMQ1h0EjzQ0fhniZ9Ibwl64zO8Xsh8+/DPM0SFsFeg5k7MuClkf/iSO0QFdCbJRFMKwUZe1tIPI3HKpourR1frMNjd4d3gla7mZdggWhMJ7bdCc/BWakISI6w8yuLDFgwXj/WeVi7k3pAgPPj50SU4+OoTjskemIiQkFAwor+Axlan6jxv3vaouv6T4wjKUriQfpfQp4Ps9narRoP+TKKw8PAyNHS2Lwbn4LS8TZH2hafXef9RQy/Io/b839/ta5hlAYPlkfcIvB4mEK4BEzGX3H7AoIGPvBmLmTluZDRWqPLEuSGU5sFn8QCh+qN4ULqXiPiZmoXHJuUjs6Xz/+ossn8cEu+41joD2Vh5Gel+PdI8AuR8TZHVFyNnVAdUBqfsHXC0OCkaRX4MUS7i0jXxtB+ItDIRr4OtJ5Wsvrd3kgFw1N3zV98aKYHvmchOxzQN2c3KH89TVRUU3un1vMyUUfvDfIb4Gu479bR4/mvpwv+ogtK3HfabCQFhhkoJtnIDJLXcyoEL53fxptTt0WaHc/2lU3EqMpEpcCF1uLvdcirMcybW+sZAv8NRgozlgxBn75FTTKNHV4gDRbEZFPoR+4mF/e/GP0ow6SLE6d0d/DZfaQs5PX7JwR64p52ymdpX7MuZNyZwAP39OkD3jd2MXqQocIihRYR3jZu+8zhyAuKVzn0L5AHpG7TYXOQM/BG/rR9Coa2kq2UQGNTX6Kx2Wknm6mkNPt6+l3FuwqPGX2CTO/kvcrv/1OYwHN72Yd6qF0dTcH19xBx67MSgudzUV/owZaw/+9R8gJAbV4mfUscqBAMrgpqOukLusepSjxZ6cbveDpuzQpZ5YOsJg5R2o3EbeivP3WX/FMYrGDaVXyVlqQAF3/7I9UCCp+Dj4n+qMmz7H0hEL3shi17yzC+kMHMxol40mWJ+Hj3OWEVAvYYSFfiSHfOdXsqFI7YSVprfumSdJTMokDqk78JG/5aWR30s7qme9s/tBggN0I/IEXZQPsv9Nm+pPkV+I4l15sP+u93/X4Or/NFfIPKDiN5v9XvHG72dQ2au6Ejjb6Fo1EmxJUEQ7Lh+VLkvikL1Y6Z5MXCkin8ahanpVYjE+JP9niiWJZ9eJAOW94Sy7UGUz5/xWNF4W5fVZnuVcKmlQ6C0s9P/Ms1/2d8wY+fI16f8fe9FlSqmRhlLUDyJPWsDDaRRYrOaUD/5KQuXYbAkOZ2HsPa02MTgsCeKc0+Zc84Kez7F8nHKDQ54+e3hQo35EYAXruFv2hxfA/5gTet8M3D9Yx+k9uG0hSSq6z8CXRIzWNDq42uwPqzJ5qz0RRw9Ge3TZxAqr1a0/UCwx08kajXq+vWdvdK4zJoqlnOaktz2L8v9D50H9QnDBQZ/zEayomUSX2gFbyVs/tbzvepBaH7dhrP+SaeJjlLav/YMLLxS4eT/tmz/X9Ay/wUtkQi0KFzrb76Y7yO7TBONj1iCXzVCuA3Yc5o76V8ldR4HbXt9xKRDYcJ2K8FPC5i/1ClHJHWHL2/MIMCqJ5i5ZL7wZFQMS08nVpiTPnhbFLElG1OWTjs+OfmLILta5cBf5zN7Q2H77Udzeilxze1dPW4oOIoGURFX8K4pn88jvND1JVtiyr717+aIzfkKOGj+sRGWY9wKKelqxLmDgrMI90VjmjSp+2kFF9oUfJf8F87EDA3C0j1dOi/P8lIkL/5pL/JIWRdanp4570oiTjNNWqZMPpavWe4qgTEGpWAdgQvsrzc8Mb/+bkhVbyMHOqymSl5oIKUpMpdYDz3/CS5KrcDULuLzAPwgS/wJhpGXWUR1RB/BqP1s7sdgpt29MhvPsDj/dGab1XHNtjnydCVDVco3etZHjskffvcLoUvp+jP7MD/srl0N07e0TyetPT1vvT08PcFOY6l/X2ZXbGtypL2f0t8L2MRKzoqFVhFdld0W+m6GSlavNkMcLs4hXFNijQNcepdZqrYtM7wDHPSdRZqZd0uWCZ7F5cZAjZj0ar3GoKRD33OlymZGPoMfTTTpYAhoYeXw9ddJwOZXVuvm82UKpqv4LtO208VTwjX1qWwJ2/kGDNPGkiS8XxfhKKvsSRc+QeeNQcGUfIvHBD4K24zZnzuMqPvYJNlhKVx8if03nUWUXLBg/9YR2ywbnscEJcR0TFYip5gtNnldoyD7YNKI6F3WWU1UeEQAPuXjAn7oO0xE2fvGcNFibiX/UZRJyQzyjV77Mz7UHiAv783y/OkYCg7llge3KM1slm0rLe4iwe8tXqvSrMS7aCi8DOaDFCUW9xsTZ1IrLczbeiiWDCv4viuZDdMv3KcdZraaAmrfSBI3N0XMO7Smsxxhbzjtmc4UyK6WuOFN6GL+In4roX46Gmt/DiOX3ODFXPzsdR7H6IjGsro7GPpTg8b8DwsPok/eV1bqo0xhsKdKggrb+RIWjUzg41r5TvFmj/tEYe3bUag0XUmNED0J6Wl/6QExtyLZ/Ekve8kx5PW6qwUouON0qiPZsZ932NEhnVd64TLGxTVb5YFhuhZ8VBrYlbae3dEi9Rxn+vzUY5MrDZ2hmJSERgBDdKv0fjr5wwQXXYi7W73f+l+V+KG6my/7+sWfP+qh2xDMjIt+M/QXduLL9j57toHKPp49l2d+6oFelR2+DOd6d7WQ625Or63wexT83Zxdm2uicqSmnQ5CocCLIZA7MvJLD+fkZe6eM5BYlQvYzVGLxUKaGxIHTpWOYFG0ezsdX2xcVX/taA66qZj0TSFWa4d6q3O1wfK+SpGnjyn3BukjYuJHWYZQ4ZdtsRpq4bu7argmc1FYQy3PPzcgy6YJGkrhxwZYw4U3vC+rf6WRC9ERN/WHR4SH7+tDkG9SGGUmP3pbb5y6qLzF6cUANpeHhyPk8IKiPEbjwKY17xsxKc0aBzVFWegl646zTKU27roo3goat0eTGXzxt6pxpKU4FP9mx03HVeYbm6qNe3A3T0aU8FPAhceg9bdNTHYow4f02rotFNPaApD9aX80reQPuf0uPVbCe9Qu2q8xHcmhTxibzYesvWz9lUSBQW4NV22SsPGY0IBT4XoZpwUIQupGv4SLSHBVNoxV3xWEdMZU1IUmE1LeSXo+lnxP5xKDrkVFOSzWrK8+T2elVTLlNPTu6T8Q/PQqKzcoJyet8XpLei+DrLjZl28c+FoC6dlLfiyKfRK5CDxrDCyH9Th86Ax6kfqnGRan3yMyYhvg05YHHNduvjQnqB7JD5lFRtdIdTtffefpud12yFmraNpM1xswANlVJ334/G9cWK9aOBbZCLrJbqZ2lgYt1tx1tJu+arswPeWP4shhyJVry6lPwT1kPUmalbA8rPVPvq9Mn8iXLt8bXu/wzoCS1jrNYlCUUYm6umb1NnPw6Mn0nmJahQp5NeOKCHjoK8Cq4JuXmWxDI8HEC6WXgkVnvv5/RYN6pn7htrXUbVmgwLTLKTc+o5fVurxT/3I3r0sBcN57pyv/ICZT639EZwrTIoZITt+QfH2CubCLtDRznBfVakYOo59pPnxTBfLWeVycCbwdXCM1Uv8QsJ2MqOkLTJBy6xty6rjgAauc89Je0Pyixxx7fLMhsJZjbsHcS1G3Q6XaoBU4ckUONKp15T+Ycl2eUab7nCy6YUz2i9PO2clcNJQIZQJ9i7NsEM5sG48gfkWfjdUmWo81jerXyuZhQClX42TWfZThxmVUF0Fb+vDot4sL19NZHiOqknuBmJSx7FKV9xAZpL3HcChvTPhovoA+xXfCvGLcDJkqoSx7f8XjTcG0F6LZUa1gSyfTqQbrMfIszGelsstpisGfoaElE9XV51GC+CCZ8bqFsKTAJBBfT5UG15QNDWhHbAe60DZ6H4lBQZ0eeA6ylTfO7t+8jclGCfkY1Tn87uXI42vAoAulSjLt3DaEu9tn4wcB/oIZvyAbXfZu30ulbkbLBmzpXyBh0mciQlyIhDiMyHkk9ESyhBQR3ZunDI/PSbFiAE6TTlH9+mYYx5R0z5Umw0WUNqAZW9wRnsNBbXZPHI649tTvggJaZXAXSZHOSba4V93RIWEEtdjsz4De5ehW6xwOKQbcJ9D42qQfwhp3RTPfV63owSbU6m0WVmJklvqiERqjLHBi3qcPssJbIJVI+qD2TtKrzt733khnDs2Y7I+72HrmPHY1ln2lIOYxCZizk3PeSgkw9Hw7kQTdQ1afVkmgVM/uS1WGCFR7aUToyGr+qhM3XufLUBfvc9/jMcDr5lXOm8I91VEbWNs51ymGT0NVwzkX3TIKeHTWPfoZ9ca/ystWSaqP+tEBMUThnD7uSrx1rN70plZwPmySPf9BkzihUv6YmTe4uLr6pbK8FSOW1O4cYTy6EDXv8BBbapHypU8XoKCJYuqvoEWrWoHaFKbrYOHuvP0q2UVzfJI85eUlLPzTi/M65ihQ+vGf+IUcHz+q5TCT+JXwa3K4yusXJ5MKu+BwkY7mm5cGmrc9jtmq5HttNo3x+JY29qH11jJ/G9xCrgto400JSrhHyDVAOKRM1fRtaajHI1f6VikkRGZxZLyyu7EaP/Aj5k9TupI0oNhN4AHPwtU3DnbxiHEQfHNp3khHl50EPmIZ6P2OyhN8Wc+k/uy83pUENuWtmjqtZs5JjuLOSMLvs8dCh9euuIK+/bop3d9dhjT8voEKRqrmMxUs3gAZFeHpIgnRdWAK+p4yGW9TE9kmT/MJNAF7KwNsp/M3pyx5nUFjk1SbJzEV0gqpr4UODo+GPiXeH+PTxXs6E5W5ztF8zVXyqHkjghAG90LDbfSIzGiF9MukKyrtXIldkSeHaLPbW/kvbyY9bDoh4RDf056Nh9JJ8C7fgeXVR5KJis7DLI7uUwnYW2b3t6s+XA6FalpPzL90X8rn8Cgeh4NNgxbfmt2H4z99Jv24ux+IMhVT/d6Bspc8BiGWVY+OFDeWlfSyjuv7pV5iK59poziRd8Qigwu4JnRZ6qvwZNnAPu2auIRYHT5xMD6WdovPGRxxXcx7MdbwKvic/i2Uzy0xY5N99VG6DmEkwgP1KHAMYGyE+aOpdqh0wKO8VG2M+5iQbtXxD76X8H9NudShhISR2BVbUzePvS5EKERIkv4+mCsnePL0bRhr8XVz0djNXtd8nOWj+TSFzI0+6NC+p2lrqy/8MpAm7/AnPy+gJMp0w+/7h/CozoVY7ahOVP7wN3U1pmEQ1nGOfq1+SZU/r79Pm7miP/a7GURd6I1CBCvUpmE8ICwcH04ZXT32ausV9jSJgd0hXGHnmLloKXIktLw2cjWAEuS/roxyH/xS1eZR+42gyHMJcUFKE2SeM6F0qgLPVMrv8XRbO5mvvouNll6hK7UtS73wR3zZusQX3hLOgubscdz8+Hqdh+ph1JgjyDuF8mc5FqDzVVWZ5ocOd2AdJaIpfWvgOOa5P+2+bOoHK84/GGbG92SPsqglkvJuYYKq2/uBZ4qUMstWo9/eWWABov6KXwtVQ87OHP+8S4+OxQ/iv/zyvgpBDMUGad9eexdR0YHP2q8jnivQYnOha5H6Bi4gP42Gthl75abxepry50/FJkCIa94mvxj/qvizM1lzkllVx1dEM1vzIrvZ9lXngb8eG3WlI1qmtm4x9FF8yG4O29G0GuGGquTtB6gPJtGsap/Kdeja6EvcMPcfWYXAXmdrjW/GKcDflsz6fvq6bZRB/ybjUAUZTg15M1Sgnp1tr8KCQAlNx0V6y/NLg/Lkpl/h8IPSv4kUy+yl+eKUy62trZzIPqeXic8gO7sxmOHUw/nG5DB5M5ZdpADcBtzqTQ1LlIuJTHZcV7HnIU9oEcbjbrfTKQl8up2y+4PMhK2oPSLex5aWkC2zEl6k0u956S0P4I8USQwLhW+Sy5GfzipgQ2L5nDpYnSPhMdRDaY+JCbD4qb9vfESKiWSLyAi8ZZTCZNSvwBrTQPxSyGla726uXvLkIu7YXmAQ91NsKhRXjhS5zh7eDQ2omJPxAToxnwtKsH5r2VSrIbv9zOjGMygHwuJCzCeUR6z35M3DcXAQc1n82Q0JeGHpeWpkCLwnmcj67Lupugi8+9li/DKSeOZvJFinqJKunsvI9swb0ajPBCfwLjaSNDyEDE5gyYbazmnHKkdG4d0xL/SaU6XrsyMgPWe2272KTSQCvl5/SS/pQ7ApIpHgxMrq7NvUZvdby0289Sb8B0fOJppeg1DmSQh3+PhHddk6Wj27eg1Nw6UDtC6bID8uF8axLktz1oyuBt4cPLtzBk94PPikMD2ZFOQSYfRU/SsceecrC6VSxL6ehvKaO7ExS428KLqobcdGbZHHqSzCAUX4ElSD8j5PT/owAiSE37JaN1TQ6gBn8yKpnitXiSTQ/AmI0SsBr2Avw2wXNQ+MOsiID133uCfTcnm+lNi8nngUfEVz65thw3xiPMafYWftWtAz3+XsNKJFCnevGDg8I32u3ksI97Pcv5Yx615gwRSNj7dNP3TSNW1nooWJZWhDVe256S5R7Y2QchAEigyoQqJl/KlTNTMDqsG4dD5KfaThMhyDikTV1RN1iki8aPDJXQIGWa+vByLG9Xc+cYGJyOPe6dKtJ2HvAtN4SvtvHF8viejsNP/1ogUDRFlA9pAdyLlGA//ty3KDJQ7OpBjofqUB4nKpR1eDHXLCTtsgdY35jjxKGzR6ezW86NThCoRJQtOl/X7tVU4tM14w4QlGMsnPA8VNbj4gaSR//IrcsuZfpe5ASfg+zKOifj9cXm9aYto0fha1mHTQ98gAYINlg8US8TrIKTpNE2hW/edHmLwlnWvmsFFw55ljg38cpYzzkU/y+teUovS2XBqXwcpDX4UquBRkUC4a1/4GeHhpXedaZP7+tjt7Y2kX9KRmXbDYJJiRdMDksixmPdL0Dolu+VBnVbfagFmC+xBiqffXqeMe4g+ZKZSMO6hqE/DbYQ1SknU9mpZNfcE9q0pifIVUcps+k4h0Xd0Zqu35mHARIgcmX8aPqqg68PF2prcTa+b2Un99kU/cNZiUl7+Y2vSaaDnM4dud7eKBnMvi/zzjG5Q3s9W4DrQraSjUTbHWYCsp0D74nI5AEyiJonEvpKIdqUrQKrjMfzpORhMEAyvTSOZZokSN7hkRt+dPDx6SJHyZWA++7F2s/PQl3BMe7p1/39beb+gLp8SyWET313CY6Yb4S6wAizb+l/n92mVn1fbk6JOVWWyytKzYGoYoBK6AoIEDdS+nDWCpo7PkWLTKqa9t4OLNS9oQI67oL62ziws/c28JvS4h1rTABanEWnMKN4XcSAI4tho2Ygfb83P/xS9TFJBXgYF0nu49gvQk9ti7zYw+qKLNbcKd55Houw0x3ibrDz+SmImrQqq+0SJx9K7MLc8Bm24Lb1oWE6YY2jq02auVkxHzyhrQolv7hLwLiJsqqGwdS0b6eph3QpX2A3GqlzvtOhfr8YxeVhY/hC5M2b3nvhSCV3+vcg05NA2Y/GjS4ro9SSCWrktQtsQV/HS1E3+RubDsa3CIpQfoHTGzWBsstx7YaWWJwU3qsDKBiYjbqD1aGRyvTzJ7zWaNmWWEMSGpwCtqRQuF0xnUYwur8roe0do0g3tZvrb+PTRQKsHCOPAK2DsQ6XwlGfZfi9sqv1uVaHYJvvIwCxSDwXGcv4tIJHqzwbHehG7n9JYgl9CGMIPvwzJzDVncgfTusyulrzogLyEXJ8L+NvXyNodxrilg1+MuR3tHQhajF2zntyIpItRBhzsupc85KNXfnaBPbL7Kw4n+/+4CJB5Nr4BBLyz5/vfYLHonj3Sap7hl9sQNkx6syNmIbsLLV0CXjckuiVryt08nC5UeLp0XKlGlqpZNbNTc14LdiwZ3Si/vBDH6Fne4lzU/E8dsBahKG+q2MJ9AEZ4DFqr0BxAzJqUrAzly2mahqTEVCAXmpwpF0t8YrONEAWZyGs4GrfanzYbxl2VYX6MxcyTtZpd8EbWf/KmN1uqPZpVJuMSP5ZRqrdDDpRTvz1ZnmeXOhabW9n862FC7CRzMGX11oy9w+0rJMvD8eFME3fA5Dzbyee2HJipeUIu2Su8Ihn5nn7bQuCadMA+R4dviJESTMy2qZpP/642qGGzKZPUMjW1eWHXuvG6AkVdLBosacS3bwz+60verS3dcaHHNlq5v6Fbzw+j+LCrk/JbRRvInV2IbdAM+tJW6hbU1Tj2d7/wm0N1hR9GiUU0ppp/EjAr52o2vD2/I9cx99th/UrtQG+BnhGM1NUpewjaTlVSKFkUGl/xzr87NtHEkOHbs/UO5E8/Gim75a64uN+yTRaIByjlM/9GI+oqOXo/FlbhODpCy6XG5ZcgiCZjz3wP+oDxkvswlG9FgLBCWJX06a+jM/KmAmSTDIedQMU0tCdzvXIbGrZna2pZlLizcT/yq9XbxIN3DoLX8Yj2oMbJuBs91Ir1qBIGHp7uUAT+9flxwzpN4FKCmoe/P0wmSGeeO8StTs3+9TtOdFHMtjH9z+CcGUt77cHPsG5ZXc439+sAwrMS1zGwokXL9aXNapqbd6mr0u2nL5ctsaar0Vt+GABOml98Oe+lfl2SHHgG334qantyqmCVuSG5N4JGi/C/jP9xX44KbbhlcOk4ahFgcqvSTN6aLLvTSRdvlb0WC/SD5n5NvE7R2vyzNxbKqJRnApSK7ERvXL8jxDWhhVqMqUr6ffw1NSyGDeurmNU5lfumo/dIdJUkpayIJQMKAb1rME71L6Hl8ebqJb3ZR1oypTLpJDdOloROPUty7pFI7cxKSjzh/STDaXKQJ/mmttDpuoPhZzwH+0ADrjss/hv9cCCWUSM5ivzNNwksle4018b0kMguf7+cP5z12FrV3mDop8wvtIDQPbgKFhiEZgd463BTHXLGuR4wWmlLEy9yx9LNboeD8QbEwhJi5Rzhn3mFzXPKxJVtLs/2fmtX0juxTG01gWDwBOP31YVcisPmeks9+7gxm2n4CHg5+rC7ATc8UPPM9THFbMYBrRHaPbPwU7D24l/2TZZD0aoJg5+eix+/HQxrA5Yu/sPNz0pnYl6tuBMnvyQ7ADML8bX8TVnq8wQtN+g4eYPCMwCx8x+saAaPxCmvFlHN3Hf6qenpWWSrO7b35CZlA3ZsGTyoR676swIB4r/532lvz33KDcgKQG7B0uZAMvfub7+I3oc8g7gK+w7nllt/4uIjWt7pPn9hbxv2dXzDyT1YCthhyD1Ukqi5j3dEGyUlTejHkBo/NOd1Vu89Y/8hb3on1+Fqsz6P4w7oVxI9cCzVisCgFBPEq3NATIwtVviAOAqzTMGjhQ3ERZWE/SXC4AK7aEDVRaPvp6GzUR9eGs1s6SE7fDv9Ahjpmwj4RaRAaaPniDlmaA6Nqvt2wTsjGxvBUmof1rQ+PJVIrK6vH25W2/f1jH3wvlQkH9bsTN9Kr2HKmGTJcPfv1zUX/1QGQyYNUSPXHjvSUkuHONUoHsHzF/FcSY9f7jMNxtoZldcRI2XxG+MzDnHBUWV8T7lz7bZlLIE557hp+ccgYfT/LuynRRZJg+F4C+v5sQDWccIgh6g8tRUvfJs31bd/LZVtbKWh/1JQbKfevYjaD1VKLzT7qCNV9x5c1UcZJWTqMjFJ79F1M+P3e3iymYJ/HYhq1oeIEw1Pn+ZUpSF+Asa6odNL4tG4KYYkm2STzZdaoiHTPATQh5k8w5cWKruq3hQXi22Hk5GKznXrmGE8ra424D/IPIsan4iJeLjDyJcOCZ3wLy+1HOE6+5MFeaCCqCnFJXSp443cinab85We22KITIMD4o+SvyrTU+Sc6TMh33oCQTHpLrrML9xewZSDVmTg92AT53fVkpnhWrxZmM6LeYuXvZ4uZ2wMXStWu88LGWhNox0TPU5DF+hvd2ZfqJ7MlNszslDjhA4BZVaQpe1FtD82E+XEY17qhC0nSmycwY1A+IuPtuk95NzTUSm1YP7/9GlzLJXfOEk2/J6XIPj/KuV3l1aEziaQTvj1o4DuuYDV4o/dLJ0GKEnTe5C/iJH5MwEPvfojPdBNT6BET/31pwkq8Cg9wGP8a2247P7TAxXP2pML+BYttogo4WP5+K8Osulcf7qS/B8xEmCvZZoz/0dgWPkX4yKRAWNR2+EwmY37T9kNomlwyuYx9MX01kaX0TXhHcKDeHc8mFG94ZitLmnckOyAs4SX/xWE/0rDZCcbe1CKT+sGCirG2hSSpLwjqOoCEWKxzyqWPHJDM/Dp0MdE45DHedyAzKQvCOuSvRkSWnUmkN+caRvLV8Wvu5LvnUIAbLwqCRNDCFy/IRZsNyvkuS+JM8m/nqm4nM2LUMyn2qCUn5HtPniV4eXnFP7YtNvrwMR1OZr5ZY+mnaHNM40YElfL+yeEyjKVaJ1NT/Wis1xf6PLhT5L3RsTN6ZTQVcz29q55HolsR7HGQafu8fufi96I1fKOHNPCfhseTNeyiE0/fqxrQH8z6Sk/LWr1q4DQt1fapu18squ33GA+kndn9Ir6gXBH6eefTaSEDQYlDCWhSLFqgtKStsxovJTPSNr+xrHytiWdsjJpduoIqL5FFAq8PL/Ebgh4dUZY++N6lvR1bdzQ9LLpAX6gQ6TxiqpEn3hn/mtgW3VaoXnsUUe+6R8xgULqHW0Vud4yBzqs3cbTAoleXPYNGSAPXjj6az1UR8wfhnqNUueg1x37Md7DuZNpd1hgdIrEaZpWQGZIMJyEG/Hs7LpRflMDWjqoHSxq/RdVNPa8Rpt0LhOD5ksMLLYNuDeznoHpkRUKG20ZWs+psBt4nCUOOMoRrxQZeIFVvjJzDzIyhqvQa+LH3kzIdS1j0ZTyJ9zpm0rqI0QsKTo7Sp05dhH/AR3yj7V9YmUbro4NUCDaUQX9V3Q/E/DqA/NymiVloX6O5Awv5HJVhwmfdert2jnVCHdeOoJ8rab5oTAzhZxmuRmXwxvFRWKaBK+YweT3mpIq66LYHBKay5rNLj399lcAhj9v2HB6CKxSkFCjUrvG7+H2BMbRSy5iJUuWBR2CGr+OLr11xRUGV5NUmt6PwS8dA+Bpq+aFxyFtllAWDEZ5imPcTojsxtyqtPaIXG9DrMo32lnRf5h3Cx7XUP3jC30NfTXqLWR+pfyDiIrix/WEKiUvCvH3PlPD6Grs4AbuXj119zrQFjk5K/k5V//7j5u+n3qTYej3+24CRGuu82RTfo5B7UbXzu/XsBR6phfrYr/mStxog/OyW1NFXKLpl0M5/5dS6NSmxDVgHqNuR+oqMcYJ0jHxtoTVukZSmTnP+9G0i/oMQDyhk0bRM8m20YC1CyUqjnPnX4yD4ZU4dG3VZ3I8LIRvtZbasRahYJDDiSMazwMUlEJ9onlESKXxfCREz6jVJ+cqgMD78ZQZleKVWa8UaxzVLg82UQa87QIyCwwMJOC5BozixizSk6Ti2ONCI2XIlWea4o0cZQPyQJwcSC/mIHRp2tYWfxhwT90RQjsnYvJLxQ8lFrtSvdSIWXB930jwIRgzV2slRtigzj8O3FKwqEvzwp6m8KPAE9rpjLBLgX/hykcHVZldWdilEfAj8XWdP7C4yZDVGjKhgEq+Hg9OtucBDC3Y1Yz0P7yxwmurLS6gx7mjeRmuZV/LrwF2Y6jkr3N343mUmyBLodP/lo0IDYt5u05ug4ti8EuRstwk2m/fEe5dkNEMlwdgJmu8SKVUzSGGV1XMYvaZS+dYXUdg+vp+VWuqBDY9AjHLq+NtyHRcn8C2V7SXv3q/B3FZ/YdmtkfbZDALasweh88I/rIw19SIE3klWCjdv1O2tfSKDTNq4MOrg6krUDrF0U6HZEK3QSYIdjQRTi9OtbXBotM4DPsrt6nMi4/pkxVD+ZYS3ICjvNbTdsSu5n8P46QXTtKTXk2GTEUOyjdm2XCpJwrs6XWF0471Of6vWDPEYjEaqQ5NfQosRmK9wdmA3/Um2KIK0MbxRf3aHo7aglSsNWetYdDLo+SyDQXissiNMUoPv9m4Tj3zDzJ6XIZ+MWShktDSmWLLYvul22RgmAadSgdiYB6MxlPQYWLhzuRC1PNCVkBCPz2LRmPb5J/DRFta9KAwgnYtUCcL54Conuod9TVGIlXV7PrZVHC/AO2Jq29swSEQifjY7PN2GOeWurUYbeXoHpm9JQp6e/fljni8XvG1yINpzVFO28Qer7utZf/bjuhvSORRKzvej1HP6ZBlCyPFAUR1UYM9uSWBHDcJl0dMLe4nZtpHq3NHRDls4cU/93PGkjbUFw+0c63c5K4H4pHtxF50vsR64KYy0P5XYODd12cEBUkD/E4GvlXdS1FV6Hc2+Axgdm8aSX3AbxQ+6d9NBtUuX3chn3stMN/7dV42bAY9m4OtHd2VDUjKMXBYi7IOgWLcuBVTGTG2BpqgQ3DLkPPwH83JLSF83ztlS/W65mMeBYHGx4+HYai1JdCOKyasqw72u6xkhHVSxfzwqmra4Ydoi97NdxM9FA9B9+GLnw8734TWap3kAFqxF4gza5v7LW1GPfcJisr9nAdXA8ESLIKpWEv/ahnmcVGWX/qRF3OHHlxLRRYw9ZP9BUf4uPhS87LsE5C15dyQhJMvfEEhtZ7k/pqJeodv4LAu7oIBawx/kBLWl5G1lpjjGGkxtOdO3QxBJLnRGuvsqTj1HwXKDqbDFZcPje8yTzYS0y+ShS9v9N6y4tbfORypoWqdZoA6TmSyja50l++t8Ow78sudk8lFYVX8IP5HU8LcYt9lZihYuu8GH9O91vd1FTqOpNBtBsPPIXbdk1n/s84BCP1zwbRRDIf7c4sBa0HLpmVMh09OIQVOhaC+MxdRnO4J9KBc91har1Yak4YAzon4l7huqbqx/peWBEuE7f3198xJ+ILveGGdtUkzq3mkvtqtcmvXNoYgK7TtKqiomtyQzXsWqIExGgNjIyjF+6LVOo2IyLx/XsnH1JCXYsrRPUc5GRt2xlQqAD/K4S1sRbWBmAKdQPDl+lao581tkiVsQkRATP9cyvMiCtXtI13+ZWVtPkQ6/uunqoLE37Hje6GFKUYFVQjeu3zqdRpKj5N1O2g4K31OUNjdv2O+gqiAy1Eyak5YTiggmWSDppYSwKqffAnGKSYcMEknG19pBUx91BWUknUdHN3nOJeayO18rRICCy4FEKjn9Ber4CW2maL06BfrvKGXMfNr+YMZQNGN5WtBjVncuUrsDfxDmW8/AT+rZ9TQVkPumZPQAkcxFgHhOnLlXDJFxVGich+sjt0uZmAkuS2Icbn6fHBFLNNEssDSze3Eklzrl6xa4Km2kHJQsP9vSKoUCacrfNwU8XketCYxl8NgmePbrFOROKFdyAjJAhHPdAsRKlH/IEQFL+qIpMhxhmg7b91iGUfu6xcgFWYg1BHZ4cyuVrbKW+m+BQCnepX3VkMbT7N/vkRNOr1MHHCurqw1j8RXcIn7qDH48QGhZv+6VT5li7r/eH3sswwF6XfVleD0H4v7aU83VDbrx4f4+kc13A0sd7FjWlyGVZ89ntX7LZ/ozr7yGLo8Jn2D+F/Ub0mSmyqbxo0Iaiq5DO3dAUACXH87wCtg/uwWydNVtr1W64RsEAtHRe+CzLUyzoElQuk7KXXNbyacuctueZiYaTPpFpVR1BwDnDTiXB8RU/9qsFmfA29mRQr6YAbEEKduqIvfNyaMulsDB9ff92HgolioXy6IK1A1VLi36RTbRTdi474l8vm3bS3p78Lw+j20+1qecAAhDP2/ReS7Lx+lbuxGBcnllQVMxqLGKcKyihz8Azg7OQ/FKg/vMbRFscZShiqICe/E3e6Vn8+FhRAIPAmJhkZ6uiF9/WJLwyBtbpAjhRUjajDZkC5B93jv0H1dxv9akcadxgDOo7CCxcnBKPeS1+p2fk6Btfdo/7NpEMI+LCgian59feem/zy5cX930GaoSCLqsoXi73N4NHGcimVrt9pyqcaGJnX1jUxH3xFbRvy1KL9KgWSVVSh4rU2mDNxfWZwKQR82v2Yo4BSREV2Ue3fk7vFss4fzLB3USeXFsONTjFftvhwa4uZr3A5idAfiNHiNUN9SvZXToGpv2LODH5TYtQBTGEEofxnvVnRfuYsB9PbH6fbD10xyQsG+J+3BSsuMgcn/Bhj5MUctHFsBkyTGLdWxhq5chx4YsYPaeXVW1pPofznLymxsgfCzxS/0ybHG0l3jDxIFdXbzCUTpSYZojd7rsGoAfQJ2sNjB45H2SG/v0m7UmlEs5U11VXiXeLC2yAV1nuXPYKyiIPnORozx8xqzu+IeU5RLjlPu9lfekNbs5i9TK67fSykpll+V5EZfVUmMaJyen9fuVNgGpl6jv3A4+0YGc0X+qfRxeEqBOJ925yqoYWx9UfJCFiEKecF4VUiyYq2GVaRLUQTuRtWbw5JCx962HX6U7VEODOs8Q1X6hD5XyHqXI5zgi/mEt+YKOklYLirGqmJQ3Ilmpml87UKWL3wlEh/tkoXENTEz6TcVz9gNpK6IGJ09tD3w0ENsefRT8dG98aODW7cnPeqwE0LTc2je5+2MWyMU2CTedh6JIsCS4fHMFXX/uRRPPRdvuezcvpmeLi7jROjCP9PGw0tjY7+U7yluTwXlHYfnafa73etPZDIGxr/sdU62vw0s6F1QP9Lpii8QSRvfyJF5MjAR0x/EsIVzCsXFa7zh9AUgFVu269QRcdmpUxt8f2wa96m0aTvt8E7odoXfWohyOicZUisDHa3WWbGHeF7cZqt3rSr1xck0TqKWb70bZ5axqxFiQfns2F+rEAJDtbj/hb4kICXEBeuX1Bygtx0WtPoH4fELr0WJVt+wD+yU2qTjUYhhqZgtp0gN01i4I9lm83xzwXJaeMgW/lRkHLe/n+0ImFoEB/KMKMX9yxf4pCWNyiJbln7s5aqaBPKGiG3kUxarwe/hbrMGWGqPGxx9zuws1xqdl86Owv6Jdp1HWyszzoXUFfITeD4z2IHuxXs6uqqimFlD2RNftTOtM/b141JlEnyjKvWAnryNYbcOn8IksPz5WhwIhL9D9O/GfKoMpJ8CyeDugG3tobaqOsauzLx4+FG1bT/+2DF9lUB5x39p4JwRIQ/v2drXHKOjAynKmMJy0PxYZfL/1DYRzDw2KDWV5u12geDsu9LDN194V8ugjyw7w8l4VdC9yuLP+Y0izINL1CuIAsmKcHgO6EIgiVPdvdKQ7Ds6H+eOxDE2NpqV56x462wS+g2+0InQHVb35xfxf9f0l1Z3eG4u2HLzEfcQX5jDcSeohe44BhxHIMX0T/ZaSHfQySDBcUt7PkZYBa4Z9ogQvSn0XVG20ej93iki5MYqHF0YbshArGDcGWuj8onQK5wOoUkU5Tf1Id1diNnx3L31u+VIp4pSlXy/9MoaAgtPleaFv+7aLsuF/qq6G5FbGcTgeY6OW+2RqNU5Nvss/hgpe+9mZM5Pfhtt38+5W15JrFLY1gCMtdPFBwx/nomPk5rY2g9tYXKm6bmtPg/RW8e+nk6WynNXUUj4FzuivmL7VgSVjQtUf3Rh5uppjCrIG7Ryco7DDkF4QjoDYZVejZlUh0Vx84dmSUwgC76reHcFwk2Rx7l018kRtkwVBIyNrNmUVWh2f4jPe0wJkTul/CHyifl4XOJS8ehDIV83lE7BVfbvN3lxqe7FKKM9bnMisZ799QEumw6MHDJBvoM4/deIE38+9WVUjseHk0ch9LWlb9b/f5MvblX7oOCzzNXFdFrshUTFYaS5w++9Y5ssXjfd81TqYHxl9ZxHJHfM0plyLTLxxMDtoHEqBA6TfNZciHJLlou+UYdCX3yeS/iZi9AK+FX16M7FX8qLx90jNzOYIh7b7lpk/lZMRlcpl1V8UfPIy7vbV8BHNRSeGRuzoMrRiCKcdfkEeRlTcXb7MFhLILl6s70NeHzIg6ytdj7uzkz/uq6WDIU5vvrMUm6IX6WUs3zymJEUyxaxHSbYdcTC22LAyDqN8lAZIPeYgImgFaQmiaoBzOjeZ4JzXEYYpYPBG0kaLUUQLxGcbW/qSuucJh9t/Pu1v3ighchdck6CIJB6rGiq2uMhBNwSHPDF2wPhkBqcr65aV7qahwWQNUZM8fn4/e8HTNIBSbbcpcu9SV1egUUdJQCBg82u+/+HCCl7+lF0Ev0sGWM7DQwDgvNHsucrmNJ0by72ePdj+GAGs9WxZF95GiI9EzcfFuZy5O80WkQbf18Y8NtyY+m8fbvquC3GoW0M8XvuXQU0eOAJoyUYcobLLewKo1xBv4mbxnJPCRmJZXFo+4g8A9jTupXZLqOdH8Zp26M94RmGXH/zVdyRl13e+Qpqkt8iuG4LBJQJXajiAnH99qdDgJuJJotzkt73C02eHCmbBvYGE2KEUC1E6VLfhGhJTv83yvBxPftGcdXd67m/0jIrJ31/17Cx8wumOGfyT7bP6xWjVUg7Wec6l9iU24/jeU+7Wqmm6zGul/revtHPYkfdm5AL52QUJhN3l+wycTq67Nwx/EeQGws7yymdXu7FTbmU4ge99i1aMBO3lI4o3fi2yO7JOvdTTu1ZtFTy/dKWpP1eAbsw9PJ92ukt+QiRfFipr2PlX1fnQi6YB4hIScaopXwlTlFNQu3UUZq1csbTi6xWVq9vg0WgXQqP7qsyre5MtjNnX3Q+L1POuo/a1e70n05Ssd303ftmITcad/1z0b1qBbqPW4bLuP+KKH95WCP7xxMOGEQV4SsPLRwQHbP5jrTuqh6WzxsnnbSZI211HWcri8kz9pQimPgE7khuyBZZSaALjt2FwsTyjazkcCOse4fYj33PpQfx6R/vwuA/k5IQdB1M7XQxELZo0GoC0uzsfKCKSmK75OGwxa/Ie8z1iduk0cAFLCDg7l0TxztJfYSkikm4orFf/owidT8l1FVWHd3BAlZphGQXj7nRvLiJCsRHlRyJA+GdUg9Oqqun4JCQpQX4Z1CGr9mUV8tFZzipu05u/ymVBkk+kKyi79l43DhbzFXHVm08zU5BfmJidjZ4Os7abDY4jRbllmUkG7XYf3mLLnUyZFfZU0Cf+iN+OPFh5oJHOTQIINM1Zpae70vYQOHRcKPcFgWDfm7vuMq+uN+MW4OxDI9sPzkhZF1yPwwkT9R3hyDzqNNyPmmPCVDzOdSLNNpGCYNwRh+9UHJiDaE00a89H6ecZws/yapYRH4LzbZubyCxVEsBeruudB+WL9KyW64hCXN67DdMlbsRD6KmHpg87Ublln4+3jjOyvJ6PT1bW2s1X29Wj3RpLp44e5iTSuVb9GoYFPxFznumVoBpzhtB/MIrTwH7XWvQL0UYtXIYjyhM7pv4yHDeNMZJG0LjdeqC58uQt6PesegsZaJM0fSA/V+1TrC7Bfw7oGj9knU/sX0/leoQ0aijtry+cdLrNgfEp9rnnR9WjsiLn5Bl+NN49qLDK0Qlhs6MeUC95X1rG2QX6iAt0zh8dKc52evAoZBkYQB+6patiK4WPydnG+fhDOS+Vp1cQPO433NvKA2nByuRe8Cw59d3+tdw6kl3O2wIUOsE/18T320ogQcMZzq0nfwNZ/FVStv+2eXir5/69NqWNkcGmhy8hVCjmphZtvgDgYfl3y9iTooRoe6Qy0nQF3530fcsiEXZs5UUNG320zWs7Rsw16OP7D+Oy8jXV1Xcdn8B+MmxCPilzKxQ2aUfvRlxkJnoXpcLEJW22OT9h6+f+gtjibWR5l4fjulllNgVrQdUvuve/qCWCIqA/VEMoSYuKSiqoFI2OV6mH6xEa9uRsoggw0kRkpB3DKQH2+Ps4CmF82G7J130bG9LiabW+XCgMlkd7Q+mSokKU1StLdrzaaw9uMaibN1sDJFW+F23qgmnZkMDDOxeDIO4ZNFCLH1Cs6GU8n9XNMKceNZDGPssiNmSeNRppoXQLmLRo8L3O6IMp5YCLQ5vr8A3POsBK1T5gwYVOGert5aUTD0MjUonWuv/5Rdz9Jfl7S8bA5YUSocQEOjpimEyfXAzZmgIl51oiQLVmi3EwU35w66ksRJvLl4MjhgEvkYF1P1Sb9J75IAVHCnwf7VlUxi+v3+Wuyt3ipfqBuY4qPisLHBVJXsRyLtfbKrh+xOa1sMIpm0RmXpA4iEBrtdjcjEXuMcps9hMiWxWq+FcFxYQSP0k5f839xKajEZUWfnI1eYGZK1WdUxaeToyJ8o7BjgOLX3PKvDAAYgs17vI8rElQc8l9AkM7X9p1tZce4kjy1neTAlRDY0XhQ81lB9KfHLqOGilzVSD9Ygjv4bFCciPh6dQwWwnp8dmhfC8JkNojB1Ow22HJvKgnCfePjuu6cFbR43+9KhQ3iSNtTJo18nVDNL7PE0dl9N2JZzCG2S0KLUPRteBaJU3YdjSdeKvPQDxV/slKFyyNQVjg0x+L4kMVeWcd2G01ruEn39qnOXLRwwY1rTC6tGq+6F0fBQwZRBNcerWJwkNhJ2nrgQtO0uZUDdCaf8XGWThfxW7T0iZTYc9bI8xFfNrjaOg+U+B1P1fEdNUzIP6Lu1ij0wEPatPQEiMoN1vakjKKmmagiMZzqsg8IZMz7wd/aGp3RcvhNHhyCRSueZyRm/sP9n+3KuO07qilnTKlIWsfA3e+fgmUtgDAY2HkjvRqLrT4dJocmeMhN+7UzbmPCRhPvdov2rfmBbVSH+wynSplLN4mlNdi5PgO6VOYrcO9X5YfFUOx3I/Oy6+8cf7h++ucHS9Vc4IHM3FD5v/uAvQ8/3WqvX+OnI2M85a+vEfoQtkI2D81fdtfdWn1Wh+hnrra4Vo0ak5TvLgNPE9mDCPfPZVcmDjATtHpw/X5thqrKr0b+Up2yNl6SeR/bsL2LxF9nMaCRcFDTaU8rHwoSyVti311qWTXnFUbrXplf+nuIdKkyejS4PMW9bW5OiqRRIZqkVmr9ML9N1vI+EDxr4uuN0llrq5xlSl4eH7RrWjEj/JerggWmOzo5BnyRchoWfvktf/TtlcFtdW14eJuRYprkQQp7h6kENyLl1Lc3d2KUwju7lLctUCR4u4USXF3O/n+mXOuTu4yTNZmvevRvRNapK7uzr8MYl4uLgSmnYxksQqyMXlD0tgIdDT1qHjv8OCXzUjDTUpKU/UmLl/V1gfgZrlpttyfrkRurhU9sitcKiqPPCYcRIVU3BQgxK7rNMk9gkesEKJdsghFCqUIYYQBjq0n/y8eqGE7j1slMthj3babWcXJud1XxjiEwj/RF6EjetV/oG9iO+HtIahPuP+4/6W+VEw8g/ZMxZfxQJpWVhEWwHlhyDWO4Pzfc5+nBBSO1tJ41tqMP7gqjcGaYgBXXUmB64W6qw7/bfWtfcGsTglx5CytNYvqy/VUWl/4Ai4ZfJJv5mMglSkG1jQaDscPoRAmoeMN47sxYijrI4jIQbfDvVrwZj7geWtHRezAuT6+Wo7vSjSIri151CJbRiSTPLr4PK8JpVjk+8Hk6WYnQrrY2mmZRMbcCbi8RNHFXUC91Wez+yeLdtXv2hkVzowylZss77Om9A9/R+YYKEeVfVwltBa7mDqMjaW73ZwmuzTLiAdK8ovOcX2GvhETLj918loyZnMtIimaurX8bYBmreRABUl3kR+BeRVRnpTgDwFFmg6MevBCO8GJD5xWUwTv93WLUArCOAFKW2jzH/ZGLHJen1allEf7VBK0MvmSqzcad/hRrXFzCm07BpdfRhzHrZv7J9oyjudq7qkT6GrMGBkYi9MpFv/MXlBRNjMWI3GPM9JSY8hsYSJvJnGwHrW7+Rz2qBKUiQTJWh4eNdQKpMkZqauu+I+21JDc9jDLWEXcDs4Crt9H9cK3MBAKarJ3tS1wlNHmS+SFfEcs2DFZ9XT9neAM5aYA5ajIG+Xl0nW7HQzarAwWqIAU3nlmTBXaarX52w6HQB/lhMXot+sKkeW8CphP23r8nTYKKgjE7tHr3I60ff48Ub8wZzvXfDxTf/ilW1xc2mju/EWM6fde29pFo7Jwf3hblOU8qD+2UGdfiPtidOUPsFhSzA9ubsvRD1cbsFacz8l5OxfLPFm6fSPzdviztPn2sr5+hsmB1OniLSrZy8XbTcQBMcRgXH7rfPlZ0OU3/26Cz9p2D8r8LmC0EeHH68xEqdvnR1J38Un0BB3iHDo02sNqImrxph6TIxnVR2tVmYMRHMMFJHMAVjmhBCkEpejSJO02YeVxt3JyPMtj8a5b0PXWgjKn4fwFe524p+ciNQ5qLAvIdj35Hr2wu5JKYdUr/E5PULOnQXheOfvm1PilSFzOyoxAKT8vP7ioXZAlUQ287UVlOwsn8QMs+F12wPKabFtBps1s83pmNdqo/fWIeFzMaue3C8nwjoiQzWAGlb7Yhr9KY95xZBc28LUjdbN9Ia9RGHmike29hj2Z+ojnEoc1GQE2tcxJf4ZY18Q65UfmFf3pj+pXWmhmRyvJApPdYnd2DLvVfeoIqkKVtCL4wfttGJaMRbEo7tea9Lai/LYS82/t8tOpyTB+hfkWbqZf8KcE3B9R+tzeKXjbW5gvp3eOBImmaDj3R3kUa+6TEKqzBJKr6gXh66W7dw7n5Db8E6u+2RSLBmHo2Tz2k7s8Vb9ZHrErDbR+fidUqDLfxt44/7HslvA528+TpTiO5fVzUvNRRPZ8+U5MgN2SCNXW+kldbNERyOzvDPeLwyHiH8Y3NbIsFzSi50klxDjoQJ0tgE2CF5vaVk7R03+o82bzBaHMHZsiF45+d0pUDg0eTVIDeYEgpl9gGxCHpUe5WuSwsdI0zUYu3sZuoNkOzFGO5fbcBQVqMweyADKuidA4JcqDQudo8r/+gKzoP/eFd8UlbZhk7D/qQKsN+tn4WgqB1t3jtHqU4Oj3DpsNm4UlJkNJOBimDJaKJXnoYXYRtMWhUC+amH4OgTy4yStVPPQBBYb8UFSUAJf4j6Ib953DidClkco1Fc4PqL52PyXnNqUYQ65n6khkfnNtd2ygM40LNFaIaEYRCZ2X6eQlhLpV2lj6nk6nGvvsxgZUH7iDmGxCdM8c7N8irLgDci5vWMs5DSybqk2fZs9IXe1bMhZWps0xCz6MiVKx18fOzwe6sHi8Y8vFylREYw+rs+rfjcgiJDX9EsM7ryCuxxsg3dSseImTzzFH7D1DTGurmqihf7zfEK6O4Y0VX07U4RHBX7P6+KW1zNN15ersw1y7VOANJDQjUZUZPYKGIjjtvAw9V++8fNDQPDyM9BCl40vZp/t4a/yRw5Pc4yfPkaGuN+/TWK+eHD6bvn/JmR7a/j+4EZt/faf14+9Q9m67Fv3M+EkoGwVKEcN53427eWeSwUhS6GhIrGfzGSUCWtSXjhLkjIFREH995LEP5E3eE2zzLbefYWc5KZi2Trde0ifko1lDmhlBioqO3mo/lReSkj23JPsGmiVMdAQ4yinZCRtcv8TzO2Q+LkXXGrvXszTarVeclLtoY63XOz1p2i8l9X6OIZeNTfg6+m/br6XJK5DAU9ncRlyDIrubl3ivNPmVcka/1hdXrz3oo7q8JRCOgbv8E65ZTaHSgut6wYdCswha9J2b2JFMvgm953UNtrmmhetkHXP3e7pUx5OHGQWmG8/h+qk3y/nHyr5YffLZA5CM5ZJG+4iRr6UpHkQSD9HI3IU3pBKdfu8cGFEK/LLSzDW+cRN5rWJzSDBZbXQ3XRnwujou3tNmuedB3NXT9qJc3UOohaMQVTiJNqmkm4JMK60hqFWM1JgSsaetCkbpoWXobUJBXdB0PeV5c6GUyNnZx3xSvWfmtP68qcU+occhlqMo8k1VOx+NRgQ33CRLdcgaA3segnqMl4GHR/mdmptQdtRpPPjzCM22N0zcfQeudTaMjPxkZfaahygHOyKwhf21nqPixT+K1AnrtrH71w3r27z35T5o1YlgE2b0UxlpXDJZHYKcGbs8cM4nawtSIMZrGSpwb7QKyM5CtVKxVp7/Hj9oeJLF83rb+3ydGZh7VgrO+rah06ZQZY2fhmGgklcHeG8nV+LftN/UNn23sfr4/FBKY+7RV6FkpqLdw4PQL3yXpEIWgJx3+i13R67s2VfnWVJva6Hj/HKNAfHwcKeHdo35iijoCBNvIFR7GT0NRSKD57PSxSJc2kgwz3i6SByYeakEebWOxi8eBIsFo8yBWicrHucLu8OrNmJL99NR4j1cptqll5frxTIywoTFPoX2fkpaWvOc0DDjJn+FVMTy9kcHGBhHtXu7erQFTQ98qGMTwUZ2pLJ5TokYMahtJKHn+U2yv+tpRXBBnnXYGHtPyqz4frvBLpMrzhWPKdC5BOJ/ufChePlNOWJ+C6sds2I+rdNXPuiS5YxVdgMO5BT4h6QZ73/0rWgxI6gSoO7Ip60BvpW4PQVJO++eJo/Z5M03WzmwPaQSWsedlbq3RCeXTNRUnGNERScjEK7jtjseOWt0jNOvxMtT+1nfLhp2+94ME8VMfeyeY+ie2S6whL/JauQSNBzH8t9sKwxnF9WG0ik1zuhJHak4uPzRLhXWjg8l73EasZnd0FP9C37Ws9T93YZMg6ZmM8qCi81glulnrSgMiCKSAkdCaldC6iJS7DY8R65JFahbt6MkmRgaUhYyuvkcZPYOb2yozAL/rdxcCwt7fBTZ66fohb6GTukV6h6GF3r69UWJ6Xuc+YyjyQgVi1LnEY7X00rXIWAfBlswdpEJOHvLfg9PRICocXyVeBQTmQxRQYPgfQ8fkCvG34qRJAB/KD4Rloj6ETuy+z3b5660+WRNoxZS9gE838lxta67htGjbbnsZoFzmm5Zfj5WdbeJe7beDZ1BZnl107dSm5aGK1XM03E7ab+jxtRWXqm3mBwMN8TDHFIIDuVGUvKnJcMPtVQtyA9FSHKWjcgpfTvRvGGZLP/APiX+gUvZ6urtcdJrx2AiR6HVXmXULiHlkpuKiVCSKK5QtAndYFiqkQZfwAmdOlIzShakjWr3mbIxpct9cbi2Gcu/J+U7/+lqj88nO7vqBeYayLXiLEZHzWYOx8rGlrkPh/3T2l8IGR4EQZr2FyAx1mmPnjzViKvsLRtxQnDnPjRtH07Mr6+Shh56f00Rine2095ODB3Xn9F5vH4iizF/Ia23/m1Ll16VwUU83Q+a4+UJ1IiylKQNPSLkGq1dza2qfX7qqGSMaT9/bmP6KyhqaPN4v7nZnvyOL4iTZfyz9zHRgLPw5jtvZ4rpboBltb4WLKq3QamogMc7LL1YxDQ5cnS2+unnUzTENJKqN6pBwT9oPBD/vJdIFHM1/ztEirgt8ltUAlhmRXvgnTcOt00RqYlRUqIKDskwOZUjxDd/bz3aDgCqnXmmPqKSn22eth21HG803d7NmtvSgRmKpnCCisLNkv1a7fWNZ3lq+ejCeC0guV6j3LVERnMWoka+O8i0v3BbR4DbhCAksGCIC6AgQbn0HZcAVtKAnW0VkDVKjK/KZtF37SE1oVPiLeZhInlAWzG76V8EKHrzPuO6D/2REy+7HE+Wq0YqXcIjWU1j5QfgbyQSiSlamO3ndxjU+HmEetyWcq15fCajC5otqXrwocEcOJ80ehtp8mgltjrEeLiDXdQQkfBLrkMlb/5OrE90PrWGCcJR7Hm6G8TCJ8Y2iIpFtHMrgP826Nh5nu+I8vrN5JzudODsZYVwoVQTujJi0GZadxcnUCPTnLRz2JGH4nmCEUODM1FCC73tNpue0onNGXM//7zd6bkWLV2t2SE6ziQjH9Pu7LLtJHxEDf0wzubTj7zO8p5qUUIl8Pjr6VUoHkgr7rkXU8fuX6P7ag3LTJTqQOOWQqxcI96FJ8XPv6D7A3qADB8SJk/SIf+Hoz6e3sjwAgxVhJlJekp1DDE0Et4thUhVAFI5b5oZYgyqGlxo/yJGKBz4XSAH3iggeoXBhI0dAsJ+N6MRPhJGWhIF9wWF3294u0ZdTvhgpc5aYA/Bj4T264pwZclJuaiAus16MbBAElFvrJdkenz3m/7Csf26sr5/xVMyTPI8op4oWh8yiVkB2GHDvSpsZnrlKVHllMz/5DOMMme/wjePo/aBRS0ZQlHH6nux4qSZ0VURJlPx1BFDg0i1Eyaz6ml2/9TlYWHO1G0FgzgQM9Kn5kIZsbQBSGCBPB4IFLhXYpETcKq7U0Pq/nqo4sLGM4/x5zktU8eP7lF1r+7DpsOrIF5n/Y6isIduLlWHSvTgaRSJragWl1yJpNzQACVNDL9C6nJnAPOOSGleMVa/f952+0dCTCRhXsXRgR8TqH8jUXXsH++p57k3XlsEh0mszl+fziLe+Bwufns5sN2brve155Ix4vooP7L7dfi+4NotW7kNkbK6aHEtn8e1xmeUDiGKsub6L4xwVN7QVN/jNU5sZySVzPRauotmztChvqA18kom5h5jkGtCeXyORVV98uGAPGzkVpNhCfjqYML3Mj/ADH2Cn9xniGPYfHKR5DVI6Bs1v0CCJSRZ4DHwPUMs1F/JwtFBAPVyHgBUNUOCuVcHiQbFVykPgMqr6AnqIxCTVoWkOgv/IuK2kx93nEnahrC0IQWZhWmqSU73TzKznmapu1h9PxSUxpDbRDTFClVr9XfsKsjnoCHyZTohJHov4mQSTxU5WWDspSz2QPQI/dXSsxxwIr7P1l39EchEYSnnz06InpnhXJTFU6VKAoGzGoaHMqKhR6XJsfWh9QIRw4LxEKISzRFEtn4XmJKRTQWacAAOBrZ0P3EgFwDTZLfslAGhiTQxIBYJALIMj4BZAqiXC+t3I2Kmk6Uxva1yCe7x6l23S0f2grWlno2qjGTfFiY1ZLq3UNeGA0+OVl/LyyJJSx2/qisUMiwq2WX+u23s7XLy4a6o+C4LvTAJghEKg/Q2ZuI7MQzIN3UTa+QQxMDgVCdbSD88fJgJil/yVEJooDWC3TIP9vzqu12dC9GnM6/nG69K9MIzdZAOKaETW9mMonqmfsn5Okb5tQwmvz/XL44Y++7awhIrCc8DKPvB5tnrFfOq+xfNDCCtYRotIpigrES1t1cawa+M5E8+VyVG1DclfjIkBMi3ufnjWVE6kkJV5jolC9FxSZI4nvh/x1U8+pZMs+LYyEp+gHVnYKGX3tU8+5/WQFK1ijA4aHpyw/tzEWQwYrIQLZa6hipZmlpZCQdJiDZSzRHyZjoCyef99qkYcVRMxu9k537UKUSj95/wOfANCKpDMi7JyMBWHMpcTf/MGCtpgpAkgEFwyBBZNQAGk1GupbH25aSKm4k4spaW1gaLy/sXJ2M/X57pxlB1AnmdQCccMLrIJKIGPt/cmouw9GXlFTunV9CrIJf1UsKfs7N1n8lRBvLDvwe/7qrlGsf3sWqSUFrspAvVBOIQQQIA2imwpDyy8eMXGhqec3MH50fJL0z06aj8cd7IwbZukv4PvdHCSSnh6p4gCfiE/ggT/a1xJCZC9ftA/DoSVFqs8vDHlWDV3aAr72TxAPuWWeXf5Z/gKEIDv4EhCJbOijYsysYhIHn0fKR+xhCr9GG/1xgy34lcY68r/0mXEjlzdxSBsvTyuFJeNJMpvWAJKWbsE0yOjPJfKcCvknkZjOrMO0rZRAAM/Km593ra9xhECa1kqlR5ogM0ObnvO38w6wMHm84FLRht7fvvihO7+S2W8oLubv7NnKYxKsVwjgqUgtDuwSFOH7injpl5G6jsm5l1BFxVAMyZoc+RgPPQxE7gCUDQW12WNy8vX75ZnNWFXcOyAOGTSkEebV6ywCFc5mbWZh9W2BOaEvcVXjKwU8qElEIdiAYMGg8NZ6b0TdWTAqAnOYUOmLT2i1tXSaMiB2Tc8aZdf6vReJ894qeMJscHVGsw/V3FhUSYQhk+EihtioiB1d1+twz1LSmWm/y37OZ3UpDcwPbBN4SdnleRIJR8qhvTEh2F0kJ1kjK+1D+Hncor+Qk67kUpVISS5TaCaDgmbHTGR2UwmuzIWpCfxZN4ISBAG5iiOoOKt/vOYi3QHCuDQ1WplxB5mr5hBee1NCPwUKr2+PdL8CEWzTLkJ1kehJYCZ6CZlQMbMByWCw4EUqtFD0Qu+tDNC1xVRU1str9kRFOfeexHMmU7JgMI4QiLVSEguIRQCXwEGavZTTZ7QtUsxHB03MDSvQuF6+M7x5PvUKWkuOgVEapmYGJkCM1MCEQMgi8pKwYKAbHNBZaiIZHkedF8d81rn3jN7jpNaD94vIqZoiODMNtJ5U+5vXDZf+YENv5B3/vhSEJIFnuBEmrnYjp5aqF0OF28fmpKGUFoHzlCik1K8W4MaZ5M04aDjTtzwhYfiSutV00CH0OeO4kelN9Hi56fI/IqH9Bivw5gqiOVkR35mGmX3i0RbAaZjYgKQlNl49oT5t7+DqbBx8n8xOi+3X28/WTPvnlHm9/XBg8G+m5GHN1P4QfSbY2HWi19CSeyXQuckVi52wajZ7Op4mf9tLIZ6Xa5FwjmdLSsixHNKd/Xix8n1AfKHSBK98kzmJBrou11u7p73af1zCZJ9ihnq9MKq1f79mgrUCfgj7qYqCOw+VoCoTgUnmpifhepWbD0g6CqJdOpRnybYzzf9dc85Pvmu+2i0agCNBcEOuTvWPg53068cwjxQBLm2ovSSeMhu1MsI50qzn45Xudy5fCymZ3t2Zpk3UcI/VJLX+tI8YLD5XhPY0mOW4hvhN+aWdj/NW192+u89VuW/yexx5KPu6q5QCC4iIKgIq/K8hnoEwWxXSkST1Y9+/S91e/arOHl218n/uV/TdFEgQTwSfAQS0s5NAZa9CBziigSvIxt1WWtcNtqZudfN5/2JScl+tCRmSiyuEhikFk8kdNK0EFoZOR/0UhRojDoeMGeuAauRndEw9w41vUb6ug5YAY4tgaizUz1Sp63XGuJJBo3xyv1RjLJZklse3zrsPg7vVONihh1sj/Wsw1NTQ36GsYN/ni6PsIjjJwTCzsotqslOVDXjRbcCAYXk6y7Qois0myoOnOZLm7vLkWKSaAGBgCZAQmCd+4HT0vPw5CHgkoSUYsIVUOecVXZK2g7k75iE5ak01VSKiF0uO0bJQnrIwWo0axEmJHxWniIXg3udJUwhYgZVr5XLUiJsOXWaJSRuv+IpTxoZVY83zXxfe8oO2BkBPOaHS/19qxp72nRgK/ctOrL55ccQ/Yl6Xm1g75Q0O+tLxAkoxN1JL7Jqqj25RDAYsjB7zu3/QAlRN5iCD6jRZ3gp19bgVDJDitHBps0V+Njf+3F6CEjn+UXpq/s4om6Yxu1eOpaQCQn6aAQyETZVydFcrSwWp5e7MCLDZ/dGqrcZvFQPLd5Gaj45y8/0P3rTfiLSgXoSdCz9hoXzrkJgIOkvZ9ptjINRuI20PZoIPxKn+ub5hsy09UiOw54ANPfw20nlZgspBUNxG4z3s3GW/zlsViuT2zc2ZADFGZwtRopMN5JeKJsBmx9eFe2ozUriu+LS5ioOosW0e3UuTjtttwEOnDUVj2M+WCgwXZqq1J/Z6qgfCwEsMmU88orEf22/CiTnRmQdfkSbWCsWn2TvwtKjwnoPpJAp262+uarjIb1/leRAhAe3CuA6ysTONBdW7Ipv/8pmWiXkM3hTzZ3Qz9FBhVZ0gxMw34gNA+KHhRTUS2cHa/872QqKm5h8fc67baTMGLCkhgyk9PT6eLFanz2zCJhlBfQRxP6/ajba/oS86PAWcQvjyFp0tyBJsdOVwR/IfgKetvZQDsySTBpQUgE19R1hUtngdV8JsxOYuBiAI4Ay034WYQEKqzf0pBZ0hOMwhYDLtfe7NTsTZerkSrppq+DUee3Ku5vJBIWBW7u2auNP2MM65uwp9DC7DxzUMHw6PMnhbGZtQI//N0O54BuQ2XvAmi6uVOADuXOSWCh2C1pOltnVeffQ9SEQ+ihgUW68F67NrKBCL+N3qo8+OHQJoMuDaSl+BrP5l0YAhahx6ceG+d/tivjjryt/4hvuJ0vQFg6NMz76gdoxiU0ct6q/Kgj6ovgl+frxqvG4sEOCsWMOpMGnTW7n58uDhPvmK2PyO0XxgMLWAnQlTM7j9xKXC3cEeY0tUlImzzMud59c9tBC/uQEKrDMye8OZEjZaM0212B9ilKIjJ8EA4HvSQksvYPoIxQKfNWNA1C881RQl5uM2KIlluboHptA2MZXe70k/kVSylXzkMMHtoiIgS1Yu/SnshCUXzBxosZIFz9RYY5/XNVEW6FH0lWEcmuS8iEEEtuwwtLrw4L5qBOgtfV/gUh+4FL3U8nRSk6p3yaopk6LH3m3iukVivU5CGePwIkaoACiZvpWl0odbWZOW8+TTJuNLfjEF6teBozxid+gnsXZiGPmm5biflSDBmbaI9F/zWznZL4U/mSdeppxx8HLCuQKZlRmgEdbZspvRI+Jbh+Uophyd88eWuE368JLFI8HrW/Oea2DSjX9a/1Y5MXoN4y2G8a6gsvLBaVUsY5fvpNwxpLel4MVyr5eyWfCxLRY12dydzC+Y2ytD7uC9y8NPpiNTtWmLl0NKin7TTxddjvz6bezwLH4YnwVXIDaL5qI+AY3HuD3Gr1rXEp4peXNs2Pqh39fXwzJsblyfIJgUR0ahPZnLPlo5gLYk3t5ors9J/WGsvtN9RiQ1VTbmuN5XDo1phwSiwLNK6sJD107VZfBwit9LbBwTR8WXKATanvCHQ5VezMrBkceZcFPVXGPTgd1e1K3Wce23pzYVjNBvcbzKsYdmdLr42EZiKdPeYqT0Oef68d6WcYqByO5bEaQkjr7YZxG/XX6rbQkcGZT6uUlKjerffaSj2Zx6V9DmeOqO2MpXJyJIwRt5Sq9+U1lKvGboO9V/vN7tjimDl+JycOpWH+CBL5Z/T7d6cBEzfEuW4L0ALe3y7O/4kjeiaflYvCAOq62MO3ycBGqDHyaLjl6NcMR33kjSNNM6R2xgr5Xv4AZMJGnP75MnOMhKh3e2iL5bHhdCyQS2MygbwzMgePg33/F2X/tvlFaDXARkDVpanwl11UAvwch50x5z2YPx233kwDaAYG/xib7QJGxEEVlprREZAP2usE4UUcGkbOe2X8Kl4XbpC4jayqDyoxU9w3O3zemsabhwVAHijFjA22h5jI2cCg1UQBcUKT7JF3uRe/GPUkgQzfZy7wTF2kwrVELR3nnxvACvE2yY3uJ3ouT5KldxPrvB6YoNo6uunPdCeBpNp4d9kjSvEx1vd1LOVACSTAM0203hAnlhKLBZxePxxyKPSzdOdUS8D8vZFFlhMk2222RGl/JUN60lD4TjHUxMhiifYUnajofXGEcJnFkZ3FD55WWd1PE1USuBuLXwi/gGikASLDy2xh/gKEbPc+dhUX2QWfg6o1IjmNK4VML+oa4rVNbaoPwlXITI/E9XTeOci5Q5udTNecIuT+4c82tkIVLL9SmNdbL8wWblgJBp5OtWa0zApx/AJs01FwiYiTvs32rDvurRuHeh+5pPh9rrd6mtBVjzSiRdwZ9j+KenvofIJAdxOI/xmrp9ivaC6l4fnx2a0L0Zw87DE2tKuFuF6KqA1hkfGlWQkZZTzWSEiqaQLzk/GMRutBTotOCzblzckphHZsbHE1390A+rxFnc+QUu/nnaR5qXSzAExGXAVsjoFQvIgoCF9tDjjDR2VPwgZEhE4vFqLOep5XQpFBUECJwlurMr+4UVZRIQSM5Er5uK7Z2mUyeT7U+IRtfAifmHDaTcjH2WrljJNPWES9SwDlkftZ3hRul5EHqZA2DbHIMI+1q2uqOYcmpyb/IfG7KJ28e73nZo/Zzf8dT1RstoaDeIFk9PB/vwuwppqjOXrji8dBEg6vRFj8+HscCY4nHwlD8QGNKwsVxz/UiSEyPFFPHviFSxkb57SYTOb3N8yJShEov5aW4Z057tWi7plrjajqHZ7ER8xPBZzDBI7/PaxVFFwzt7B3ThzDV/weSBOjbFNd3+wiHxzKJ80igZGWEaiBUt103lh1gQ7cwerpfmofe9u8QBtBruRL9mvdKzxq7es+lePVtNbGxyCe+sYVKUcfrLmCXCw5QyRMEQxF1hrVHALQSnOM7JYgb3pISkqQbvkEmUe+wyngfiAIRbWkJvz6WCfWdXaqO23vsCr6bHs/EP32TJXvbVCaWG8jayj0r+hhcPfBF8bbWjibJr5qJIyjI2uMFocVsmqHNQeCISVwSJXO6KyccNx3wvCuWreTFAw3QHk5kDUmtwz86DmtN2u3+sUZB+0ntoRM5ZNF/9++h+1LwJP/bcPA26ZsCJZJ4I6rdnIyHpOPVuN/z4kHNh5xmlBxXM3XKqpUfqFilLergseKEpoTgjNL0Mf4wuR1RZIVj5sGbp9KRrQ9AMJ2w6TZzO658z+3QrWyYPWVfONx+hODUcgA6Q7zSk3Xoas3E4QwlQYb7oAnkCbMpsYUqWZnwiTAChsZVe5DrBaLznSCmfqQrx5JdCRVaba2xobt5d1/d4LEVzT0tTp6JnbfF0bp1pFobFHUHKlP2AHwf3UD/0gwBH0lowgMlOAjQpmNYHRczlQHYsPDK9gwMOTjiYlM6szRN5YVVVUYyl+Qb1I42k903lb/POgN6ue1ETtOd+/MRyWf5ecGd3iCZLEH8kBWae5o3ao044HsWngLIwiossgICCjlvnAIa18CGTkEIlICz1o50PKSa7+fa+eudz0PvfObXH62evSq8PxbTJraVi595+LQ9Xox+SiYAJ37QfzP6zILqXHhujg10P1kfzY4GAFOwtT0w+0ZdYV96/aVTsP+yJ/OJptCg7p8fY9Tsj1M3rnUiuBV2hy5YpPPfL75eZHw9mlTkD5iOjlsRZ6iyy+rjKGqqqBgK4QkzrQYDPHstPXiK6udWrIZmwGo6NC+onHnklhdk7l6VdG/kTMDMdtV6HquCFN8p8RkEpMKFZywx2njov3mKkOOnJEBscra79ZpDTVtOl5FbOWwmQg6JLQws8yEmTB2A0D+u2ZbCSsGCn4jQj7jj8wA738ZJlCHJwPUeQQVlacnsxxIsoc/dGW4B43v5f9dIOfD559fkVORGUQXfetOQaCY163nr8M3qxpDA+Em00VJsgmcaGgRrJb52yWz6Gxzf28HzSZvjldPzqBu/xIeO4ed6G0Wa2K7Gy5Dct0P1/YebLr9+1ImO8S9lD8+GJx6Xe6OuCClgy1t4KqWO3Qi7pjcU4+X7uTTdw78CR9tRq2qzsMcME8y43IVJWcy6t1PXqe7/o4Xv0ycXodhw6/WmaoUmy3fWGTz7Wo8UO0+fE3673h2R2YxKIUSCAMJAw3hlOXtwyeD/ws91T63htP5pg82Wlr0xqF7LHJGedCRJKbJN4RbasXrnZL0dud/CTs4yc+OizWJJ6vuHmXVNoC50eJQLnaKuKHJI5eJDW4F8KXufjfNrt3/LnNFZHGy0rRfwUv9Khcy3nVScrRAYdOxqOOr6Z5nvukWKX0JdtSTAbK/qxluYsyxIvNJnrHBkjU+eGhS5v54PL1TtOvz++pgpHbqanckCcoyMfHyJIwOcFnagiePN3trsml6UFs/VLg7Xr2zGfZgEQUrgbEcv0rov/8O+oyH7wJZ/GD7+YNOZ4vbzZHCRo/Nbp5R5VXOVS61V1AO7NxEjN2KODsNO27H4nmJLivYrhwqVIqp52LcadfQ6nHo5KwUgIjwNMVIUIqsK0e9SloYjrztg0ziUBNqK18Ff9Q2p/xvERPt6hXN5p6a2/HrYinixqbahQzl3KZ/7Yhu2PEr+XLE5ml54ehDgsH9yvRJM/wAkBRAZsXlHRsAgf+kgpdcrMrfZzojWuUm7bJR0SgvF2S7+irebKdit9n9Mtft9yTmsmyWuu6zatfiZlOtBJ3IPsMOA83H/LReba4snP5HAOfPZdIfijPsPNFx2j7G+vFjd0FR0S5/uImIhrb2beWPD59wssX82tMrY810U5ebDe1W3d0AhBU4EQMBH9nZ35b/TReyrAgYRtqtzkNmDuXo1e1IZG8eoLlvv1t6Xk5Y9v9kWrQsTDWfAPNVLStM6g5Vf1fxYZlWmJBowDZPYW/1VlBQoACvyItVuNJ8Yj3LUyHsfnxukPrRsGK1xeHtKmVFunB6u8RKscnOpcLOwvikvNnu7WaUpTamibNZu7yq6lmsuNF7Ks9fh/phmdyh8x0LC8uTGz1+effTaccqVCjcLOy1q77+8m3DdVYp4sZs9/cPHZJwzhvYn21+2pbbrRIPff0pbuzyh3d99bDUhKSL1HQ+3ERTA1wpla/KW3wtCDfPwMDQMzF/Os492VnY2ek7msZpOqr36Pv3V6ThhPBZp49SkugAycvOsoXOhv/LzWKLd7ws3Q+c8L6SlWZOol7NgTwNpdkqFFW/aRlibKtypVLl7FHb1RxrElk3SUlJ3kAoBiYmNamg8y4Rt/m45UXO6XKDRWNd3bnJavOZ6GUDjD+zcvSX38103zbUV2FnVMmKH6lIyWe7ZFYdiwxH5X+/vXS+LRWgqql5P2w55385o8De5f54fSCYW551JflDbrd22vKbNT1+Bllk6Ks1ydBcYmJiT0pKirt1+Z+zgDefq4rKGjI1dfVL6X2v8ynYcUYo54g8pOWu2/D7TkVzPl5gD+dhBLgt9FcMfbNWb60DHMoj46HQ8voag0AWo6vWcpaq/ZJWqki/3QzxrAMzt28zxZc5rYY6i7NXhXRyklT+w+To2Bg7esQA8cLi4qp+i32s33kfqmluwOtDy8ee58uNthWScKcgExKpge26P4KlOdAmdgCg9ehimDrA73jpp1Z19pmF+JPu4NWk+FvFQvuKU5ZRidVKU1NTVyqrLtfJgr5DdQ6vjfbHbfURQerypjjOoTI8unaLyRwnzPesnkeZm8/mkwZQzDCQyQBHTaw03Xqy+tydX7fZWAoVt8WEr/mv7+/iJzL52Uvlh3n+5MOFL7n/XiBbq2fFA/2q0m3Q8/1HnyT/6ysnxxAA2kkOvT58eboLw6USKSMjJ9cfl8lWZmLGwCjQQQRsrxVlkc/xKC01sy1U66c+gagQITNX0dHRDp9bTgci7Nv2UgYYadm77/+66R2tik6SKwFj94Vkvbygrz63x227PptPGyYnOrVG63+aTyoDnneoWwTaSHksVUs9RcS+TmQJ2i0A+ZUISqzo8CMDORfgey1Xm8cAxcxU8dDxbTuSIS9UXCqKx8PKWqr5gFkeH7GX69lah+X6PeEUoqihr2HZHicrolb74/zUPn8jmZz9oYioOFgRoFvL2cb25OTk/nrQl5ggzhK6H3LRmz6TOaIDoQmVbGMVhCAaQgynySvvzqsJ4ckYKtHHUrYm9DAQjul4A6vNeG8QIktmwO3faHYjOWCX/VZvENt7et0ma60lpyyWZodNo+UZqO5p+1GNAozwz6eXe2/t8eor8mDpTS+LU4jwaevOm4H/wx6bMo/t6ilrqEfTQnvMtyiMCxpoF4mwu2001GsrCLWEVbf+W4V6hQbre0wN8KdOGLlnSUwH9I+MXSgWT2RJ9X1Yn05rKinZecsLUpBVKvJSutTxhMqCf5OEaAfiWJ+AbLBneeBHt8DI9hHw1jjV1SprrlUvYy6XvzGvNeSYkxFovyGaHn+Ea/E70t9sZ8GPdCyeY2tbcT3byAYD+Xn4+DaS5OiH3P9NmYxr6RjycmYre1TU1HTr2WQfCWOKX/wiwC2aPRArzfV//GVT23Wb8o1L8DYOtjclsCADIYahgP1aKzpbtbXBYpiZLjr4QCpS+msV1Gvnv7Fc1BxlNNttrq2QhOFxYJnqCWVTYX45juXf8Mw0IWF3mah9yn17yI3SXpl2FOjUBr6YDl8M0eNH/swWcmt3GUlkYFu5D8VzOTo6GhaK415wW7fKIn/26PG5foWJ/0a6cmnApjo5mBQ/UrqitfVfvjSdYEkVqyAjVXx8dW0tdYvdanPhaCAVbvrKSTDngtnr84NS5bXPWRc/n91K4xmgGA8nwmlS9G5XRPZsww9YDDlda7uqu1NQUJBEy2+z7tt0X7XjocBBFZriS+Mw6c9wFRKt6e72p4A+c04I3omcmRTPZYO+ozo3dWwFY+ZBrC/uS6yMWItZyXmt50L29gyHPI1e7MBe/ASgAC9otsd+Fr2A8vk8I37k4coKoilB5O4SbEVlsJeFpGTfZcrKmtMwJYcSQc2RskLp7M7MwfWSQ8DTakt6yUO9VUaIfgZPjUGbuu9dx6afApqJd46H1e0LbArO4AMtyIzhyDdnKwVoBww6fSSFy93N0jD5HZkr16DmxQoJB23rh5ZRJykL74AVFJjSGDcpYmX1O1Fi4AcHBxFoephZFOKsFk8bOUuz3VeWYKd72vN61OPeMsdIiLGO9OUB5gn2BKA194e9VGNjIyMx+/3xdLbbN7nGhc7GqvuYK58b+yt/mKm/3P6wvCBCCG3PgeO3swTBj/aVwQfnoWHTFlkVfwwNVMUfr6OByIokhxdkdfR67P9ZXalI+Tg5wsQ+pUIbGxurCg5yOZ2bnx8sVcpsJus1B8lNLL89P1xJoqlNW87Bb8HEsvA1jNgoTffzZ5JU9ZQPER92vr/7gLLc7AeL74jUui326w0wEX02gisXfzlQ8ZkUuRof7nA9uHQVoeppz8/fBpxI8JCFnT3Jlc5SBQfr/yfBvsnq1jAWCiohHbiSlVjNuAqxcZ2oBzzO5t4yJo3wo9OWLAiVrsS61FAMS3Kl84yNjgrAdcNwtVAhVj4uSAEuhwu82/CZTBcP6A6RQm7HCeGMgrU8UZ/bq8REfO4fgB0zM7Pnx6NacRP2NaVMvj6OGDZIYtjT3Rnl3VXumz4TnOfuj08f2ZiZD8ub/KWAg4aLdqZyvfoOXW5LHSlmksAw1xK9lR9pJekaS1QjsJiXWUMONQAUO540LZr3QLNGZELx5uqr3p/xDnD8hRuH8WpnVEVseaHr57tyVz3WuOEdFr2jsb+D0fmEX3TfswODIreM9uHOYTbadJ9dNGslByw30132Gfe6Xba4Yy7eIARBjjd7egaPpppsFsMohd3XWp12htR0k4Z+RRKwuJ+ueekOx1FCqwza6gcbS2Ejy1cFQJtQA49qe14Z4RjKNXfuYf7BbmkrTRn4a6PryWJubq47wYZVHczD8wsIzWLC34qUDmbCR4eJYiq0kzpZ3Q1cbvSfaahWu203Ws02Vxl1PTbJRL+ntPlOEsuUyGPdbLheOy2PE8+UxDDXuGUjYY1szAyHFKoqB8wEIxCAJIBf0ijUwffqgSSMrMIYMqQG+Sxy5b/LI8ddrP+nfzCtpw1VBQNxehUZk7JJTQ3RaIWdm8orKoLNdEnE/UV6Xh+PgHDChBg3KHgp6qfSONtu626LbsrF6r7359sK8WsWe6PJBTDfOgMDMYHFn8rX/TYjzp4O9zMdStCo6krOnohifk7oHWUB6aTy8eDKoqIwvtlGPKfo26MTv39/28Kq0Giz+NFCv5q3ceEFA6O/1jvnSltNbVp/b2/vg8tJAD0Y6Pb2ctfSHg8JhHq5q6n1fVB/dBjcwXZQA29uwI7BrW3FwPugeB0Fl2rtCeZEpy8wPLWUXaIEE7VDvcoteS4/gSwnLXJfjs4jqP0FZNFIj7w2FKtvUCOYu6AUiFgDqjpGXnsmwu01mNVut4/NHB/RZ3lc/HMwJ68kgFrij9PxcVagQog6AZOyyKEf7S/FzbvNOlYbpN4SIiKizpnKRcHN7p04YQx94Rwz3S8xzNU38cWsaWar+1XBwcH8sABAPT4PU4q5y/TId8i9AbcNuWGweBkAkvODEVKPYkwl4FGj1O/pll0NjGq70dmGD/d6Jf7mgkdb1GCVEfDHTWwCEX4ets+sHUcKKMWiWwtpuJ8i7RddkckQSi5A/uViJH2AgpxFCtTLYXF+3o9dhxy4RzhWf0gQ+cu0xOq1wefutEfw7fnKh/JIsAV+Tr406eC6m48JjrepCUpWIm+4GWKlf16MUNyXpWyDjYIBBqLRqkpLmmOsaYDhR/OKcDD+ZrynMF7qEFteLIn/lJOkIGZ7Quh8viVpRiKLTLvrX80bO/iVmClJvuHnz59COpn/0fju5SOu6PUU0mpz9mfW9zaWlq0JLkb/lZGuFJahWTfDd5HScwUy0XqaLv+lQRM4MJqT5lOMt4CI2+GcsN1qDSwvmmzeRWiAYSFdQ5+8EA8B1gxafWFso8TEwPg3xt6zBsSPjCmrrc19vd+Jd/gv0+jZDpMUQmb0JMZ7zvuj1cdSXjARUbCW3Ioe2xiwBgIX6v+MlJlwWFYnH3mPwVaru7tdddDpcD+RlZIaaGZQSKFo6lnIiADlG+ODajiwpP5kC98dwTnXCCWrVwS89R3BEqVgx8+fF8Pibw+TliYmVT5c6b7f1Vca2IIU0DQOXDOGv/4cGMKPlW0zIWFOtm5rRqVFitv50hsInyb6tPQhVHEWqfg6jfGixCrYRZmFmTnusQo2L5xegQGOR86hj/N6xo1uR83i9sv1J+x6Rz7O64WFn+KHKmu7QUqzS3lNRleF1C9ynOa/LXnat4NQna3faEPhoM/OQ0tWILTXp823bhcnpwuz7rM3xiSXLhkUbDIel52hWAJ++7V7SrhK9+MlJ8zAsFQD55EhXhtnqDaM8wMczv5UOBHItKHCcS4GkyqzPNutNTN6NRgRdMLe2je/igc+BXI2ey3Xm7E1L/cEvI1NW7r685BRpsvRo3TU+EjB5tb08/NxxuPjI9/s1KluPRJwWA2WJe0WRBYzCLlCpNARJq++kKBAUNAAZfZeOGk3nqUQkDV2AfwwQR1r9BD5X7tHz13Btv9+X/INVk63smAdU/R6zWXSDT/y12V7e/th7vMuE8v7jwZLX8mBDHCQwa8/t/NV5X7tXHxWU/vh8XhQGp8p6uOuPJyy+XrbQk5GRvY3mpid6uZ8AJe9C5rjk2FrDotl3vJ+fi+8NUenOGGgT+VkwGJHw0VWNjbKuXypCIjdKlXgIKycV/nfzOss7tbvma+CgR0KwNWnbtwJL6g03cVKkXzS6YfQXd/vltXl6tYKpqbOozAMmFPAwWQjOQtqpeyY07yXeCTUWFQ0p0CvrmK/3u73UCTfFoYCBysRg8TGIq8dmy+nIT33g+wcnudbbLjiz47RT+Z7f3UtsotHx4TF7q5nJ8Xky31VwW39TlnF05aNpWdPdaws0AfFpHnZwml/Xl5eMzh3xN7rg9kDmMv1DJFUehjyRwCD+niU/svDdkYh+99O2WBNajxDcFXM2/8+hPo57wXGk6yK6mpDjC8PsE8pVFS+XX6zszvBhmOkU42lHuRdNAhpc4FOfeO6mJSmeymFDdFjeA4V9H1G744mtLEUoj7hVbqysrJYoph+ORfwPBywa6ujpqamoanJU9jc7O4pQNFd0Nra+omHLPv6X2H8Pg/vUjP2otv2k//EzunSzx3KoSWl7jMc5DpS0lX5zW6/B5hLPmDzr039vS9GAuXXgYuzxBfnB4k/GtQRYhLv8oXhUgpBanUbSqQMDddPYbO3hcHC+Pn1ruft1jRe9BbN1BYpjrb2ucYwcDD+hJPd19iKIV+CJjScki//RSo4C25Kmv/pLEFC/Jo/6OwJgEUqV6znrv3H5fB35ZoKLenTwyUsUdrCAI24WK3PP+GUhcy/5iilnAybNoCZWU9LX/8pNlvY47bF7ikCXA6avNJr+uT3fDFswzqWwVzcaTJTJI879PXnxg+5opd5HeN14Wzlt/qaGnt66DMp7S81a9AARx6kQtxxq5ftaKGavNV5bzRau8bgYSAjI2Ow2syPjNdaUztPPEuO/rHZZvE0mFYqXGRS8KzLcbtfWyrNd5M4htN61R1LgvV99CAchQZA18tLEGAnjDTMgVWkDrz3F8oQ9deH6tZ96auB9QvTlzhK4QWoNwdiLyzf/VAunW+2W8WLTmYTfTqmilaajXnsfkPiYsQFoek15CtELopOHl32IuIqtl6OslS2ux0t7JWX5jyeBiGiynrn8L/9d1eE85N7g5ZaY11dHZIEeuASDDSrvs4sxZpC2fZXK1bVP8DFcz8mTE5WmqKVM/lO+LvPxPVgWBChwPG4Px+4G4MVDdq8Vc2jktm4RHy+4LM8joZBWMeLe/+Uo1ya31Sid7QJq0qvJ6stPV/Ot/rYQwe2N66gkw6ccyxjKv6XBLWf4qlqCUBff8h9G82BhURtbe0Ju+rYHQFY7p+2nNhCGs8RfYp1Feqiwwe2BpxvwW+erbZUrErhis7l//y5HcdpOvS8WqKUqXftfNfJo17OoziLhfidiJiY2PxsOKV/SmSSvKDp9RPr+6cW95MVLaE4gieYVKx21ETDmgKVxuv1RDZ8tSS/g73PhXnEn5cpsNNEH4lNxpxqdYZzaJLUpfCHNSI4ZCByPSNjyDsJZqJo6cO44ngvZSqvIP8oq7E4b/oYTlhCLx8d7XWY4IgJg73Yj2Ex73RmZmYBpCUtQvX2QmqRdWEDPhhUH+2BBUoY2k7npOmmSwsKvo42TIo9uSokRUrT5QOKC+rrL1tPIzw2/YhzoOXHzK6LNYYT//2b+1mmMATjNplr7GVJoTnR0j6eJCYWMMBa5Q+rjGj7npfbNZUZLIi66ug/GGcWhvwVdVOI+LCOJrvPPsJ853OiHH2KdOE0w6KBi9LE/bmpCcwmOLAQC2Vj+2HnrQHN0ripFPOboBY36Q/dk/iCWgqpgLmLDKovXO/bS8/bzzwX6AQupYBj3ibMwV9/Bry9tqSy6d/SmNq6wYqaFCzpekcL3XWcdZOHmyzB5bgaesjr6i4n9vf362ZdaTP5xXCqgg9mVcTX9++eR1lqp/7+/eq9i9GlkPpRWUtrXhjGrVGOGKYP757WF40DrnK7z5LdTvQu4GjpofSW/aHodawE4AcCDMzCaNaxz18z9ulWm4mrdRvMpRXsbo+XEWd5rAQoWrmPV5rGlmHTGgAD27/0BevrRT7CwVXpt9ib8JCtM4b+s8rYH//vHkt1CvZ6uxsLRN3uxT479+0ZKt7IajOx0nQ05LDSaLcAAeJ2JymXOpCLeJ6nwIpM7WByOUS12U5tUeltmuMef1GJ7R2IFQgE6jbDZCXqwx01rNumwAzgJA+ysee1sap3xMBtMUFBHT34nkrA8Yu3DeX4TM36F63Pn/GipMn0bxzgApUphdlQaADTHGw4xfT1cZnw7YM96LSknwQDp7bEFEoTy28pR+M60BRzCD7UOouHZTkNkcafbHTpJ6eklJCRk8eXY9PuRm4PRJj+/RUZaTIQbvIfUGaKFai7bldsxNt3ExU6iY08g5rrreMcluq2e4Ziye9WXCZFdQYF4xG+E4C0YYJrfvWfKn8thPUU/+3/vFQTVmM8YGn0IW34boQpd448nBOWOqg+e551SeLE89osHLefwQTj9ezt9ayCpbZz5nU293XuL7j/7iWC1PTkrOPM/9dXzhtYhdyZ/kQtY2pqmmlG2fN6U8teVeNv/9wXgqpvCF+kPqEO3Pu1PcCuBUNfMCSnYK4XZlkxMG5mq9JGwgJA6uPdmfjZ89VkLXKgRa6fO1tgk0OPKDXcF92F/hBU3Djxl+tZF29iHS0tLxWRi19vHTDTN8ch4ciDxvJv/BadrPQ6LC9NqTFo47IQXnTTEYzjNvmdQNv6sJ/5Q46ew+/RNQJvpqKuAFJTDIlrsev4w75892JlARuxPjm/vUgVNYtODSFcjjdsEXNqEc86FR6yj4hlDf4vj1rxYo+WlbjnMP4ukKFQGhttIMMm8VaDoIEziErtG6jwse3bwEzxp8rcXK/99HZpOs7XDZ8zQw6zUUK43v0/mR5KWQIXOSpiD0VK5Ccw2c6C7Vnp0q/ncEHfwW8HN+BeqvLp7dSjpxKRIx/GMEyX9EG4LWJYgkiBhZbXVhiQQ77+7I+q9atGfT2P+KTzJ53b4k+WoIueranuwiHM5UxgAf1+wsNeHQy87w5dyDhdbig9/cO/KWL7FknAdJoh4nX5p8Fi8rTJarYkp8TqUj6J8cTzcoSJuNag7TJN+19ysqqCjovHU86JGZzejevZ52mTg5LsjuaHnH/2n2K/IJQh7AnZpVCe4vWZfsfDDu7VjcNDsERWmjv97HUQbnpgmpP0qXtFLwd2Gd+whytMduMx0vhN951/KRZkfzy9F/rJD5NGPvE2rGqYB6L5QSRwv07BKxGWzdBISwWF4CHI8jQeReEMbgP5/f3OA3L+5u8JBneOiqrA1uvu18zxWmDe9uryOF1bNi9I7aZk3vynSZb5Ta7FyMcKTw6OLIri43hQTBIFgyo4yBK9gr4Mb6rf0Ggjfx2z1FXVS4++B/S/R2+1ArVdgmf9GSsvfijZm1cXFRUV2n/09Gwe7x4w2WtsFN+mp6tQYzjUcwJlGb9pygMYei3xUnOUmd5xCSjCcaVveE4sE+ngHPlM/Fw9vcziuWS5hu129yHKxV9rD2Py7ivLgoNNExUSXih6HJX3dvDn31RnDIk3K3dcXmvYrTWYQIa0Cc8eFnRlgCI4T6S0u6z31cwoLcB/F9n7f2MbBLKzezzendzRlXqvZWK+zZuj8IO+Py7wf8x5x/J9XYo+ksA4mKV3CsnEvp8O6xyp8Syf4xtIQFkEv9n/fv3HwNulbgyTytj/lnNkaK+Gg4Of/u+7AF6Xz+x5b16ifK9vt6elTZE0ODv3x+PH9jN2DQUoMnV5X/BC6LwBryxzIXlM7DnSPjfYnsc25/Q53kBPPJfyiCjN8l/R8waskvSEahwMt1++rtnz2ZsPJ+VY22szbE4Kp80OOJjfi0om+Jwf7ESsshvxhy8IvBGesoip95d3qKMffM6vwntpZQrl7ddRF7Binqku0yIhz8zscv7JZeuA/CqyMQX/JZRVzItvfW0pixI35GmYEVczonqyaWHUJ3q+I/JdS5F2v4foj18/zps+ZI1jGfzour46XYsd4570OEe7x0aghJNVNLN62NVe68ghuxAEKGrGUbPa297p2psNHjbdXvqmjGRqC/Uv1sglem7ZzF8WNzhen+8+hxEU22Ue1V2hucKRSN603xhVi3evqDxCq5qUGLKHlsvLPX5O8IUoM1lndHl3/XQXU/bxwNiuUbdGcZo74euP7J/J+Xp/vpI+69D29a0F7x8cR39OTc3p60qswslEqoba0+q7RS11APuTfYwm+KxFb8xX7E3W20jL+uV1qvhgYTzhL8OzKJIQ3FaqXnVJsvrOUBpr6hjDnrNXLz0O3P/31fsGRWXnltqdQzCV+e+9vIyydA3oS/D/AVBLAwQUAAAACABJr7FcK8ARDpIAAACSAAAAFgAAAFBpY3R1cmVzL2dvbGRfcnVsZS5wbmfrDPBz5+WS4mJgYOD19HAJYmBgVgCy2TjYgKR17q97QCrS08UxpGLO2+sbeRsMBJgdJuccr/A5GrQgZ0LTI+cl1ienSm+3e/faZ5KZ5/X8+8wMb555fvLbtCl+71t+abvvukADXGUEGBgW9DAzMTBMKXRgYGgw4uNgYAhIY/gYWLHp4jqPaqAaBk9XP5d1TglNAFBLAQIUAxQAAAAAAEmvsVxexjIMJwAAACcAAAAIAAAAAAAAAAAAAACAAQAAAABtaW1ldHlwZVBLAQIUAxQAAAAIAEmvsVy764fx7gAAAP0CAAAVAAAAAAAAAAAAAACAAU0AAABNRVRBLUlORi9tYW5pZmVzdC54bWxQSwECFAMUAAAACABJr7Fc5JFPXwcBAAAsAgAACAAAAAAAAAAAAAAAgAFuAQAAbWV0YS54bWxQSwECFAMUAAAACABJr7Fc9efNZj4IAAAIOgAACgAAAAAAAAAAAAAAgAGbAgAAc3R5bGVzLnhtbFBLAQIUAxQAAAAIAEmvsVyQkGeu2gUAABEpAAALAAAAAAAAAAAAAACAAQELAABjb250ZW50LnhtbFBLAQIUAxQAAAAIAEmvsVzml/3TmoEAAE+CAAAYAAAAAAAAAAAAAACAAQQRAABQaWN0dXJlcy9jbGVuenlfbG9nby5wbmdQSwECFAMUAAAACABJr7FcK8ARDpIAAACSAAAAFgAAAAAAAAAAAAAAgAHUkgAAUGljdHVyZXMvZ29sZF9ydWxlLnBuZ1BLBQYAAAAABwAHAKoBAACakwAAAAA=', 'base64'), 'Devis Clenzy.odt', TRUE, 1, NULL, NULL, 'system-seed', NOW(), NOW());
  INSERT INTO document_templates (organization_id, name, description, document_type, event_trigger, file_path, file_content, original_filename, active, version, email_subject, email_body, created_by, created_at, updated_at)
  VALUES (clenzy_org_id, 'Mandat Gestion Clenzy', NULL, 'MANDAT_GESTION', NULL, NULL, decode('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', 'base64'), 'mandat_gestion.odt', TRUE, 1, NULL, NULL, 'system-seed', NOW(), NOW());
  INSERT INTO document_templates (organization_id, name, description, document_type, event_trigger, file_path, file_content, original_filename, active, version, email_subject, email_body, created_by, created_at, updated_at)
  VALUES (clenzy_org_id, 'Validation Fin Mission Clenzy', NULL, 'VALIDATION_FIN_MISSION', NULL, NULL, decode('UEsDBAoAAAAAAM0qbFxexjIMJwAAACcAAAAIAAAAbWltZXR5cGVhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnRleHRQSwMEFAAAAAgAzSpsXBLrrytgAwAAjgwAAAsAAABjb250ZW50LnhtbKVXUW/aMBB+51dYUaW+FNj2NEVARSGokSBUSdpXFJKjtZTYWexUoKnSfsR+4X7JzgmQAHFhrFKFuPN39/nO99n07tdJTN4hE5SzvvG188UgwEIeUfbaN579Sfu7cT9o9fhqRUMwIx7mCTDZDjmT+EkQzYRZevtGnjGTB4IKkwUJCFOGJk+B7VBmfbWpcrXINoKEtbwUr9YeoYNlfHH6YvEhXsjN5fhi8SF+xS8Fr0XcXnEsX5IGktaIbItS68Q3Y4D2XeWXPNqo75VFlWHQKkxoLIqSkuKjYNhWNPqGT2UMxuBlOLXHQ9+eO2RskYldfMxsz0NLr1uCB+dieflSluFcWJnkZTJr3/wUGyEh6TDcZcYXQS75B/nz6zfZe6JAwkeV41ySRwjU4TMGluO71pNre5aG4ODmJxY2gzSjAjqMJ2Viz3Ytn5jkwCtoBvLjokBBlIEQV1EeTW1kTbrkyZ0jc8sfIhddUocnBcswpphd8V+oYxF/wtPjIQUJdZgoTVqIlQQ0rgNAGcpK+XDgkRBD+sbZVVt/wJ2T0dwZWa7zScPSDIcik5uqXTXbrvJ3dSNqESxSLmSArGv2dxrHVzG1Hd9yX7BPahhcCwfDs7SMbYYnPo/LklPUvOwdS4UT2kF7pi+7v0mbMGjVN1cGMpenIFHYtbAxiDCjqVp6io0q5zWlQsWwPILTNH529TUaw7KJt5r7RaR8Wu4T2sRZ4VaU6XeMC0gEZDstzRtXQaoF+lh5BkBASJpAQ8Mi5V5s3WeC4H/cdFDKGKVXG+Ip46/q8DduJq2c13TRt0aPjj1SA7o7+0PHPydLEsI3RlFc2EXSVOlMDVhqjXZGdnpzDPtPIZoOHXXDDR3csqtLPuJ4ZsvGnhY8ROe261r2RQDVVQ1cua7hP3/wsEXFVe3h3JGqe3pVPcjOuASxqMp5DQlnrgZ/NJ89Ta0ZSqW6x7x/yX9N0uqNoss0BSJ4joPwiocmkJgHleBHDiS+rVNAcUDVQ1dI26iAIhckIOrezCCI8YpX0sFWPEtAvcxIkK+LYBhBdDSpuyfSFVBEVpdneR3dEVSAw5fPxRFxc6MiFh6opj/0+/umNq2Z3lr7Vwwx9d1qeHDUomgnv1pw9Oo6anWve/BArRnKN+z+6/GPiUHrL1BLAwQUAAAACADNKmxc0MKcWGEBAAD7BAAACgAAAHN0eWxlcy54bWy9lF1PwyAUhu/3Kxq87j7VGFK2xAvjvfMHUEY7EuA0wHTz1wv0I13jYjcTuWiaF96X8xxKs81RyeSDGytAE7SYzlHCNYOd0CVB79uX9Alt1pMMikIwjnfADoprl1p3ktwm3qwtricJOhiNgVphsaaKW+wYhorr1oT7q3HYapI0CTFubEBcfO4vYKz5aGVaQMpAVdSJfBjk+NGNjQprW3cD1WvkEq293jau7ldQvFYDxGdSv4dtCNoKJzlqpIIqIU8EVdTQ0tBqj2p35+8m0sr46owT/kAKiGWlVIrSl8F8tdygICtqSqHTHJwDRdB8+sAUmg0yo/c8roBw3OLL17d4qhzqtE8uyr1vVg5y1wZlsx7bL7Rvh9z9K/DqeuBlA8xAgiHo7jGOW2hfOQ136s+wDZWDKiDde6QfWZfXs64uHm6/A6s4bunAc4w6xw8lDckvlTnqe8tmgwvXCYNf13ryDVBLAwQUAAAACADNKmxcg83lEKQAAAA8AQAACAAAAG1ldGEueG1sjY/BDoIwEETvfEXTO6KezAbKgcSbiYn6AU1ZSBO6NW0x6tdLFQx48jg782Z38/JuOnZD57Wlgm9Wa86QlK01tQW/nPfpjpciyW3TaIVQW9UbpJAaDJINKHn4WAXvHYGVXnsgadBDUGCvSBMC8zTERQkbG2LZv3zMTvTYNbt+y8Uwn66N2aiHyRtrkdDJYJ2oOqTngx0Ppzz7sSKfLQq+cvG9SF5QSwMECgAAAAAAzSpsXAAAAAAAAAAAAAAAAAkAAABNRVRBLUlORi9QSwMEFAAAAAgAzSpsXAiDMffDAAAAIAIAABUAAABNRVRBLUlORi9tYW5pZmVzdC54bWytkcEKwjAMhu97ipL7VvUkZZ03n0AfoHSZFtq0rJm4t3cT1IleBG8J/Pm+hNS7a/Dign12kTSsqxUIJBtbRycNx8O+3MKuKepgyHWYWT0KMc1RfrYahp5UNNllRSZgVmxVTEhttENAYvWeV3fTs1sssIGmEOIl7JzHcgL04ysesHWm5DGhBpOSd9bwNC4v1Fb3HaqlumK88kLWDd6XyfBZgwT5m21GyemU7zgbiWfhHPgrOPPoMf+fG5DNg1rLjyc3xQ1QSwECHgMKAAAAAADNKmxcXsYyDCcAAAAnAAAACAAAAAAAAAAAAAAApIEAAAAAbWltZXR5cGVQSwECHgMUAAAACADNKmxcEuuvK2ADAACODAAACwAAAAAAAAABAAAApIFNAAAAY29udGVudC54bWxQSwECHgMUAAAACADNKmxc0MKcWGEBAAD7BAAACgAAAAAAAAABAAAApIHWAwAAc3R5bGVzLnhtbFBLAQIeAxQAAAAIAM0qbFyDzeUQpAAAADwBAAAIAAAAAAAAAAEAAACkgV8FAABtZXRhLnhtbFBLAQIeAwoAAAAAAM0qbFwAAAAAAAAAAAAAAAAJAAAAAAAAAAAAEADtQSkGAABNRVRBLUlORi9QSwECHgMUAAAACADNKmxcCIMx98MAAAAgAgAAFQAAAAAAAAABAAAApIFQBgAATUVUQS1JTkYvbWFuaWZlc3QueG1sUEsFBgAAAAAGAAYAVwEAAEYHAAAAAA==', 'base64'), 'validation_fin_mission.odt', TRUE, 1, NULL, NULL, 'system-seed', NOW(), NOW());
  INSERT INTO document_templates (organization_id, name, description, document_type, event_trigger, file_path, file_content, original_filename, active, version, email_subject, email_body, created_by, created_at, updated_at)
  VALUES (clenzy_org_id, 'Autorisation Travaux Clenzy', NULL, 'AUTORISATION_TRAVAUX', NULL, NULL, decode('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', 'base64'), 'autorisation_travaux.odt', TRUE, 1, NULL, NULL, 'system-seed', NOW(), NOW());
  INSERT INTO document_templates (organization_id, name, description, document_type, event_trigger, file_path, file_content, original_filename, active, version, email_subject, email_body, created_by, created_at, updated_at)
  VALUES (clenzy_org_id, 'Bon Intervention Clenzy', NULL, 'BON_INTERVENTION', NULL, NULL, decode('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', 'base64'), 'bon_intervention.odt', TRUE, 1, NULL, NULL, 'system-seed', NOW(), NOW());
  INSERT INTO document_templates (organization_id, name, description, document_type, event_trigger, file_path, file_content, original_filename, active, version, email_subject, email_body, created_by, created_at, updated_at)
  VALUES (clenzy_org_id, 'Justificatif Paiement Clenzy', NULL, 'JUSTIFICATIF_PAIEMENT', NULL, NULL, decode('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', 'base64'), 'justificatif_paiement.odt', TRUE, 1, NULL, NULL, 'system-seed', NOW(), NOW());
  INSERT INTO document_templates (organization_id, name, description, document_type, event_trigger, file_path, file_content, original_filename, active, version, email_subject, email_body, created_by, created_at, updated_at)
  VALUES (clenzy_org_id, 'Justificatif Remboursement', NULL, 'JUSTIFICATIF_REMBOURSEMENT', NULL, NULL, decode('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', 'base64'), 'justificatif_remboursement.odt', TRUE, 1, NULL, NULL, 'system-seed', NOW(), NOW());

  -- 2c. Document template tags : INSERT

  -- Tags pour template : Facture Clenzy
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.code_postal', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — code postal', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.email', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.nom_complet', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.societe', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — societe', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.telephone', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.ville', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.adresse', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.email', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.nom', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.siret', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — siret', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.telephone', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.cout_estime', 'INTERVENTION', 'MONEY', 'InterventionRepository', 'intervention — cout estime', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.cout_reel', 'INTERVENTION', 'MONEY', 'InterventionRepository', 'intervention — cout reel', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_completion', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date completion', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_debut', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date debut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_fin', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date fin', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.description', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — description', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.duree_reelle', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — duree reelle', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.id', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — id', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.lignes', 'INTERVENTION', 'LIST', 'InterventionRepository', 'intervention — lignes', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.notes', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — notes', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.notes_technicien', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — notes technicien', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.statut', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — statut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.titre', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — titre', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.type', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — type', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.date_paiement', 'PAIEMENT', 'DATE', 'Stripe / InterventionRepository', 'paiement — date paiement', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.montant', 'PAIEMENT', 'MONEY', 'Stripe / InterventionRepository', 'paiement — montant', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.reference_stripe', 'PAIEMENT', 'SIMPLE', 'Stripe / InterventionRepository', 'paiement — reference stripe', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.statut', 'PAIEMENT', 'SIMPLE', 'Stripe / InterventionRepository', 'paiement — statut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.adresse', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.code_postal', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — code postal', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.nom', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.surface', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — surface', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.type', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — type', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.ville', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'ligne.description', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — description', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'ligne.prix_unitaire', 'SYSTEM', 'MONEY', 'System (date, numero auto)', 'system — prix unitaire', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'ligne.quantite', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — quantite', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'ligne.total', 'SYSTEM', 'MONEY', 'System (date, numero auto)', 'system — total', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'nf', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — nf', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'nf.conditions_paiement', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — conditions paiement', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'nf.legal_mention_1', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — legal mention 1', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'nf.legal_mention_2', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — legal mention 2', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.date', 'SYSTEM', 'DATE', 'System (date, numero auto)', 'system — date', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.numero_auto', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — numero auto', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.email', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.nom_complet', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.telephone', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Facture Clenzy';

  -- Tags pour template : Devis Clenzy
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.code_postal', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — code postal', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.email', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.nom_complet', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.societe', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — societe', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.telephone', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.ville', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.adresse', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.email', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.nom', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.siret', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — siret', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.telephone', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.lignes', 'INTERVENTION', 'LIST', 'InterventionRepository', 'intervention — lignes', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.adresse', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.code_postal', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — code postal', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.nom', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.surface', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — surface', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.type', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — type', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.ville', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'demande.cout_estime', 'SYSTEM', 'MONEY', 'System (date, numero auto)', 'system — cout estime', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'demande.creneau', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — creneau', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'demande.date_souhaitee', 'SYSTEM', 'DATE', 'System (date, numero auto)', 'system — date souhaitee', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'demande.description', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — description', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'demande.priorite', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — priorite', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'demande.titre', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — titre', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'demande.type_service', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — type service', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'ligne.description', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — description', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'ligne.prix_unitaire', 'SYSTEM', 'MONEY', 'System (date, numero auto)', 'system — prix unitaire', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'ligne.quantite', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — quantite', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'ligne.total', 'SYSTEM', 'MONEY', 'System (date, numero auto)', 'system — total', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'nf.conditions_paiement', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — conditions paiement', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'nf.date', 'SYSTEM', 'DATE', 'System (date, numero auto)', 'system — date', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'nf.numero', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — numero', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'nf.validite', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — validite', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Devis Clenzy';

  -- Tags pour template : Mandat Gestion Clenzy
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.code_postal', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — code postal', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.email', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.nom_complet', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.societe', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — societe', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.telephone', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.ville', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.adresse', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.email', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.nom', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.siret', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — siret', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.telephone', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.adresse', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.capacite', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — capacite', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.chambres', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — chambres', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.check_in', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — check in', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.check_out', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — check out', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.code_postal', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — code postal', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.nom', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.pays', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — pays', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.prix_nuit', 'PROPERTY', 'MONEY', 'PropertyRepository', 'property — prix nuit', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.salles_bain', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — salles bain', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.surface', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — surface', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.type', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — type', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.ville', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.date', 'SYSTEM', 'DATE', 'System (date, numero auto)', 'system — date', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.numero_auto', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — numero auto', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Mandat Gestion Clenzy';

  -- Tags pour template : Validation Fin Mission Clenzy
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.email', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.nom_complet', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.societe', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — societe', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.telephone', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.ville', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.adresse', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.nom', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.siret', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — siret', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.cout_estime', 'INTERVENTION', 'MONEY', 'InterventionRepository', 'intervention — cout estime', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.cout_reel', 'INTERVENTION', 'MONEY', 'InterventionRepository', 'intervention — cout reel', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_completion', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date completion', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_debut', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date debut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_fin', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date fin', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.description', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — description', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.duree_estimee', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — duree estimee', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.duree_reelle', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — duree reelle', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.notes', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — notes', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.notes_technicien', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — notes technicien', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.progression', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — progression', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.statut', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — statut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.titre', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — titre', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.type', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — type', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.adresse', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.code_postal', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — code postal', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.nom', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.ville', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.date', 'SYSTEM', 'DATE', 'System (date, numero auto)', 'system — date', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.numero_auto', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — numero auto', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.email', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.nom_complet', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.telephone', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Validation Fin Mission Clenzy';

  -- Tags pour template : Autorisation Travaux Clenzy
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.email', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.nom_complet', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.societe', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — societe', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.telephone', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.ville', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.adresse', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.email', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.nom', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.siret', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — siret', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.telephone', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.cout_estime', 'INTERVENTION', 'MONEY', 'InterventionRepository', 'intervention — cout estime', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_debut', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date debut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_fin', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date fin', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_planifiee', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date planifiee', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.description', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — description', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.duree_estimee', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — duree estimee', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.instructions', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — instructions', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.priorite', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — priorite', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.titre', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — titre', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.type', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — type', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.adresse', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.code_postal', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — code postal', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.nom', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.surface', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — surface', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.type', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — type', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.ville', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.date', 'SYSTEM', 'DATE', 'System (date, numero auto)', 'system — date', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.numero_auto', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — numero auto', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.email', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.nom_complet', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.telephone', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Autorisation Travaux Clenzy';

  -- Tags pour template : Bon Intervention Clenzy
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.email', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.nom_complet', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.societe', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — societe', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.telephone', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.adresse', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.email', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.nom', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.siret', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — siret', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.telephone', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.cout_estime', 'INTERVENTION', 'MONEY', 'InterventionRepository', 'intervention — cout estime', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_debut', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date debut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_fin', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date fin', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_planifiee', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date planifiee', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.description', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — description', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.duree_estimee', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — duree estimee', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.instructions', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — instructions', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.notes', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — notes', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.priorite', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — priorite', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.statut', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — statut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.titre', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — titre', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.type', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — type', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.adresse', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.code_postal', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — code postal', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.instructions_acces', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — instructions acces', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.nom', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.ville', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.date', 'SYSTEM', 'DATE', 'System (date, numero auto)', 'system — date', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.numero_auto', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — numero auto', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.email', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.nom_complet', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'technicien.telephone', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Bon Intervention Clenzy';

  -- Tags pour template : Justificatif Paiement Clenzy
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.email', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.nom_complet', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.societe', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — societe', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.telephone', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.adresse', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.email', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.nom', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.siret', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — siret', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.telephone', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.cout_estime', 'INTERVENTION', 'MONEY', 'InterventionRepository', 'intervention — cout estime', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.cout_reel', 'INTERVENTION', 'MONEY', 'InterventionRepository', 'intervention — cout reel', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_debut', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date debut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_fin', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date fin', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.description', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — description', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.titre', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — titre', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.type', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — type', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.date_paiement', 'PAIEMENT', 'DATE', 'Stripe / InterventionRepository', 'paiement — date paiement', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.montant', 'PAIEMENT', 'MONEY', 'Stripe / InterventionRepository', 'paiement — montant', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.reference_stripe', 'PAIEMENT', 'SIMPLE', 'Stripe / InterventionRepository', 'paiement — reference stripe', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.statut', 'PAIEMENT', 'SIMPLE', 'Stripe / InterventionRepository', 'paiement — statut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.adresse', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.code_postal', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — code postal', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.nom', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.ville', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.date', 'SYSTEM', 'DATE', 'System (date, numero auto)', 'system — date', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.numero_auto', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — numero auto', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Paiement Clenzy';

  -- Tags pour template : Justificatif Remboursement
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.email', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.nom_complet', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — nom complet', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.societe', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — societe', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'client.telephone', 'CLIENT', 'SIMPLE', 'UserRepository / KeycloakService', 'client — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.adresse', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.email', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — email', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.nom', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.siret', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — siret', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'entreprise.telephone', 'ENTREPRISE', 'SIMPLE', 'Configuration application', 'entreprise — telephone', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.cout_reel', 'INTERVENTION', 'MONEY', 'InterventionRepository', 'intervention — cout reel', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_debut', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date debut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.date_fin', 'INTERVENTION', 'DATE', 'InterventionRepository', 'intervention — date fin', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.description', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — description', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.notes', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — notes', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.statut', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — statut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.titre', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — titre', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'intervention.type', 'INTERVENTION', 'SIMPLE', 'InterventionRepository', 'intervention — type', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.date_paiement', 'PAIEMENT', 'DATE', 'Stripe / InterventionRepository', 'paiement — date paiement', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.montant', 'PAIEMENT', 'MONEY', 'Stripe / InterventionRepository', 'paiement — montant', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.reference_stripe', 'PAIEMENT', 'SIMPLE', 'Stripe / InterventionRepository', 'paiement — reference stripe', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'paiement.statut', 'PAIEMENT', 'SIMPLE', 'Stripe / InterventionRepository', 'paiement — statut', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.adresse', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — adresse', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.code_postal', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — code postal', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.nom', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — nom', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'property.ville', 'PROPERTY', 'SIMPLE', 'PropertyRepository', 'property — ville', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.date', 'SYSTEM', 'DATE', 'System (date, numero auto)', 'system — date', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';
  INSERT INTO document_template_tags (template_id, tag_name, tag_category, tag_type, data_source, description, required, created_at)
  SELECT dt.id, 'system.numero_auto', 'SYSTEM', 'SIMPLE', 'System (date, numero auto)', 'system — numero auto', TRUE, NOW()
  FROM document_templates dt WHERE dt.organization_id = clenzy_org_id AND dt.name = 'Justificatif Remboursement';

END $do$;

