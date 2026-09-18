-- Qui voit qui, sur la place de marche.
--
-- LE DEFAUT EST DEJA BON : une fiche ACTIVE dont le mode d'engagement autorise
-- l'exposition est visible de toutes les organisations. C'est le comportement
-- attendu d'une place de marche, et `EngagementMode.EXCLUSIVE` couvre deja le
-- cas du prestataire reserve a une organisation.
--
-- CETTE TABLE NE PORTE QUE LES EXCEPTIONS. Construire un systeme de droits
-- complet la ou trois cas suffisent produirait une mecanique que personne ne
-- saurait relire six mois plus tard :
--
--   1. DENY (fiche, organisation) — cette organisation ne voit pas cette fiche.
--      Le cas reel : un prestataire refuse d'etre propose a un concurrent, ou
--      une conciergerie demande a ne plus voir quelqu'un avec qui ca s'est mal
--      passe.
--   2. DENY (fiche, NULL) — retirer une fiche du catalogue sans la suspendre :
--      elle reste active pour son organisation porteuse, invisible ailleurs.
--   3. ALLOW (fiche, organisation) — l'exception a l'exception : rendre visible
--      malgre un DENY global. Sert a ouvrir une fiche a quelques partenaires.
--
-- RESOLUTION, du plus precis au plus general : un ALLOW nominatif l'emporte sur
-- un DENY global, qui l'emporte sur le defaut. Un DENY nominatif ferme.
--
-- PAS DE CONTRAINTE D'UNICITE SUR (fiche, NULL) via la cle primaire : Postgres
-- ne considere pas deux NULL comme egaux. D'ou l'index partiel dedie.

CREATE TABLE IF NOT EXISTS marketplace_exposure_rules (
    id                      BIGSERIAL PRIMARY KEY,
    marketplace_provider_id BIGINT       NOT NULL,
    -- NULL = toutes les organisations.
    organization_id         BIGINT,
    effect                  VARCHAR(10)  NOT NULL,
    -- Pourquoi cette regle existe. Une regle sans motif est impossible a
    -- reprendre : personne n'ose la retirer, personne ne sait la justifier.
    reason                  VARCHAR(500),
    created_by_keycloak_id  VARCHAR(64),
    created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_exposure_provider FOREIGN KEY (marketplace_provider_id)
        REFERENCES marketplace_providers (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_exposure_provider_org
    ON marketplace_exposure_rules (marketplace_provider_id, organization_id)
    WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_exposure_provider_global
    ON marketplace_exposure_rules (marketplace_provider_id)
    WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_exposure_org
    ON marketplace_exposure_rules (organization_id) WHERE organization_id IS NOT NULL;

COMMENT ON TABLE marketplace_exposure_rules IS
  'Exceptions a la visibilite par defaut du catalogue. Une fiche sans regle est visible de toutes les organisations si son etat et son mode d''engagement le permettent.';
COMMENT ON COLUMN marketplace_exposure_rules.organization_id IS
  'Organisation visee, ou NULL pour toutes. Un ALLOW nominatif l''emporte sur un DENY global.';
