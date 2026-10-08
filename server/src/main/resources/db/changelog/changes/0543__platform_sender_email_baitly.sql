-- Adresse d'expedition (From) de la plateforme : bascule du defaut historique
-- info@clenzy.fr vers contact@baitly.fr (domaine baitly.fr authentifie dans Brevo :
-- expediteur verifie, DKIM et DMARC valides).
--
-- On ne touche QUE les installations restees sur la valeur par defaut : si un
-- SUPER_ADMIN / SUPER_MANAGER a deja choisi une autre adresse dans les Settings
-- du PMS, elle est conservee.
UPDATE platform_settings
    SET sender_email = 'contact@baitly.fr'
    WHERE sender_email = 'info@clenzy.fr';
