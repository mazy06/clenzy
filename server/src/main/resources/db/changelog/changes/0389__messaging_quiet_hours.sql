-- M10 (modèles métier constellation) : heures calmes de la messagerie automatique.
-- Fenêtre "HH:mm" en heure LOCALE du logement pendant laquelle les envois
-- automatiques NON urgents (bienvenue, guides, demandes d'avis, relances) sont
-- reportés à la fin de la fenêtre — les codes d'accès, alertes bruit et liens de
-- paiement partent toujours. Vider les deux champs désactive la fonctionnalité.
-- Défaut 22:00 → 08:00 : personne ne veut une demande d'avis à 3 h du matin.
ALTER TABLE messaging_automation_config
    ADD COLUMN IF NOT EXISTS quiet_hours_start VARCHAR(5) DEFAULT '22:00';
ALTER TABLE messaging_automation_config
    ADD COLUMN IF NOT EXISTS quiet_hours_end VARCHAR(5) DEFAULT '08:00';
