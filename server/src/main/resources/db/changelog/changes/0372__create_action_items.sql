-- File d'attente persistée des actions en attente.
--
-- Jusqu'ici, « à traiter » recalculait tout à chaque chargement du tableau de
-- bord : une requête par nature, chacune hydratant des entités entières pour
-- n'en afficher que quelques-unes. Vingt-cinq natures rendaient ce coût
-- intenable, et surtout le résultat n'existait nulle part — impossible
-- d'assigner une action, de la reporter, ou de savoir qui l'avait traitée.
--
-- Cette table est désormais la file elle-même. La lecture est une requête
-- indexée, quel que soit le nombre de natures.
--
-- DEUX RÉGIMES, distingués par `source`, et c'est le cœur du dispositif :
--
--   DERIVED — l'anomalie se déduit de l'état des données (un solde impayé, un
--   calendrier muet). Un balayage de réconciliation la retrouve périodiquement
--   et met `last_seen_at` à jour. Une ligne que le balayage NE retrouve PLUS
--   se referme d'elle-même : la réservation a été confirmée, donc l'action
--   n'existe plus. C'est ce qui empêche la table de dériver, et ce qui rend
--   inutile un événement de clôture pour ces natures.
--
--   EVENT — l'anomalie n'existe dans aucune donnée : elle nous a été apprise
--   une seule fois, par un webhook (litige bancaire, virement refusé). Aucune
--   requête ne peut la redécouvrir, donc le balayage NE DOIT PAS la refermer.
--   Seul un geste explicite ou un événement contraire la clôt.
--
-- Confondre les deux régimes ferait disparaître un litige au premier balayage.

CREATE TABLE action_items (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT       NOT NULL,
    kind                VARCHAR(50)  NOT NULL,

    -- Identité de l'action dans le monde réel : « reservation:88 », « dp_1AbC ».
    -- Avec (organization_id, kind), c'est la clé d'idempotence : un balayage
    -- répété ou un webhook re-livré ne crée pas de doublon.
    subject_ref         VARCHAR(160) NOT NULL,

    -- DERIVED : le balayage fait foi. EVENT : seul un geste explicite clôt.
    source              VARCHAR(10)  NOT NULL DEFAULT 'DERIVED',
    status              VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    severity            VARCHAR(20)  NOT NULL DEFAULT 'warning',
    -- Rang numérique de la sévérité (0 = critique). Trier sur le libellé
    -- placerait « info » avant « warning » : l'ordre alphabétique n'est pas
    -- l'ordre d'urgence. Le rang permet de trier dans l'index.
    severity_rank       SMALLINT     NOT NULL DEFAULT 1,

    -- Ce que l'écran affiche. Dénormalisé volontairement : la lecture ne doit
    -- joindre aucune table métier, sinon on retombe sur le coût qu'on supprime.
    title               VARCHAR(255),
    detail              TEXT,
    subject             VARCHAR(255),
    target_id           BIGINT,
    property_id         BIGINT,
    property_name       VARCHAR(255),
    amount              NUMERIC(12,2),
    currency            VARCHAR(3),
    badge               VARCHAR(40),
    action_type         VARCHAR(60),

    -- Ce que la table rend possible et qui n'existait pas.
    assigned_to_user_id BIGINT,
    snoozed_until       TIMESTAMP,
    deadline_at         TIMESTAMP,

    first_seen_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Horodatage du dernier balayage qui a confirmé l'anomalie. Une ligne
    -- DERIVED dont ce champ est antérieur au balayage courant est close.
    last_seen_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at         TIMESTAMP,
    resolved_by         VARCHAR(120)
);

-- Idempotence du balayage ET des webhooks.
CREATE UNIQUE INDEX uq_action_item_subject
    ON action_items (organization_id, kind, subject_ref);

-- Lecture dominante : la file ouverte d'une organisation, par urgence.
CREATE INDEX idx_action_item_open
    ON action_items (organization_id, status, severity_rank);

-- Clôture des lignes dérivées que le balayage n'a plus retrouvées.
CREATE INDEX idx_action_item_sweep
    ON action_items (organization_id, source, status, last_seen_at);

-- Un hôte ne voit que ses logements : le filtre porte sur cette colonne.
CREATE INDEX idx_action_item_property
    ON action_items (organization_id, property_id)
    WHERE property_id IS NOT NULL;
