-- Cloisonnement du hub Channex par organisation.
--
-- La clé API Channex est UNIQUE pour toute la plateforme : GET /properties
-- renvoie le compte entier, toutes organisations confondues. La découverte
-- présentait donc à une organisation les logements d'une autre — visibles en
-- lecture (titre, devise, prix, capacité) et, avant les garde-fous ajoutés
-- côté service, importables.
--
-- Channex fournit la primitive d'isolation : les GROUPS. Un logement appartient
-- à au moins un group ; on donne à chaque organisation Baitly le sien, et la
-- découverte ne montre plus que le contenu du group de l'appelant.
--
-- Cette table porte la correspondance organisation -> group Channex. Elle n'est
-- PAS org-scopée par le filtre Hibernate : c'est une table de routage lue par
-- le service d'intégration avant même de savoir quoi montrer, et une ligne par
-- organisation suffit à la contrainte d'unicité.
CREATE TABLE IF NOT EXISTS channex_organization_groups (
    id                UUID PRIMARY KEY,
    organization_id   BIGINT       NOT NULL,
    channex_group_id  VARCHAR(64)  NOT NULL,
    -- Titre canonique côté hub. Déterministe (« Baitly Org <id> ») pour qu'une
    -- re-provision après perte de cette table retrouve le group existant au
    -- lieu d'en créer un doublon.
    title             VARCHAR(255) NOT NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Une organisation = un group, et un group = une organisation. Les deux sens
-- comptent : le premier empêche de provisionner deux fois, le second empêche
-- que deux organisations se retrouvent à partager le même cloisonnement.
CREATE UNIQUE INDEX IF NOT EXISTS uq_channex_org_groups_org
    ON channex_organization_groups (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_channex_org_groups_group
    ON channex_organization_groups (channex_group_id);
