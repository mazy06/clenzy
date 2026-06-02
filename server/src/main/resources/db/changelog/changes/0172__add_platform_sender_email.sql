-- Adresse d'expedition (From) de la plateforme, configurable depuis les Settings
-- du PMS (SUPER_ADMIN / SUPER_MANAGER) au lieu d'etre figee dans clenzy.mail.from.
--
-- Niveau PLATEFORME (pas multi-tenant) : un seul couple email + nom d'affichage.
-- Defaut = info@clenzy.fr / Baitly (comportement actuel) => aucune regression.
--
-- ATTENTION deliverabilite : pour envoyer depuis un autre DOMAINE que clenzy.fr,
-- ce domaine doit d'abord etre authentifie dans Brevo (SPF + DKIM + DMARC aligne),
-- sinon les emails partent en spam / soft bounce.
ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS sender_email TEXT NOT NULL DEFAULT 'info@clenzy.fr',
    ADD COLUMN IF NOT EXISTS sender_name  TEXT NOT NULL DEFAULT 'Baitly';
