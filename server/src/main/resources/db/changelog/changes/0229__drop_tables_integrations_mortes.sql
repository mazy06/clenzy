-- =============================================================================
-- 0229 : Drop des tables orphelines des integrations mortes (audit T-MORT / C11)
--
-- Contexte : le changeset 0061 a cree deux tables pour un scaffold
-- webhooks (Zapier/n8n) + signature electronique generique jamais cable :
--
--   1. webhook_subscriptions — etait mappee par l'entite
--      com.clenzy.integration.zapier.model.WebhookSubscription, supprimee avec
--      tout le paquet integration/zapier (code mort, aucun endpoint expose en
--      prod). Plus aucune entite JPA ni requete native ne reference la table.
--
--   2. signature_requests — n'a JAMAIS ete mappee par une entite JPA ni ecrite
--      par du code applicatif (verification historique git : aucun
--      @Table(name = "signature_requests"), aucun JdbcTemplate). La signature
--      electronique reelle utilise contract_signature_requests (changeset 0225).
--
-- Donnees : features fantomes jamais cablees — aucune ecriture applicative
-- possible, tables vides par construction. DROP IF EXISTS par securite.
-- =============================================================================

DROP TABLE IF EXISTS webhook_subscriptions;

DROP TABLE IF EXISTS signature_requests;
