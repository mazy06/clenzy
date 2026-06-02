-- Destinataires des notifications internes equipe (lead devis « Nouvelle demande
-- de devis », copie devis, waitlist, maintenance). Liste CSV configurable depuis
-- les Settings du PMS (SUPER_ADMIN / SUPER_MANAGER).
--
-- Contexte : l'expediteur reste TOUJOURS info@clenzy.fr. Avant, ces notifications
-- partaient aussi VERS info@clenzy.fr (From == To) -> self-send qui soft-bounce de
-- facon intermittente cote serveur de reception (~79 % d'echec observe). On rend
-- le(s) destinataire(s) parametrable(s) pour pointer vers une/des adresse(s)
-- differente(s) de l'expediteur.
--
-- Defaut = 'info@clenzy.fr' : aucune regression au boot ; l'admin remplace ensuite
-- par sa/ses adresse(s) via l'UI Settings.
ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS internal_notification_emails TEXT NOT NULL DEFAULT 'info@clenzy.fr';
