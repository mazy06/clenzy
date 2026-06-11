-- Backfill des organization_id NULL legacy (audit SECU9-ORGID).
--
-- Le helper d'isolation OrganizationAccessGuard est desormais FAIL-CLOSED :
-- il refuse l'acces des qu'un organization_id (tenant OU entite) est NULL.
-- Avant ce passage en fail-closed, les lignes legacy a organization_id NULL
-- ouvraient un IDOR cross-org. Ce changeset propage l'org connue de la racine
-- (properties.owner_id -> users.organization_id) vers les tables filles.
--
-- DONNEES UNIQUEMENT (aucun changement de schema). Chaque UPDATE est filtre sur
-- organization_id IS NULL => IDEMPOTENT (rejouable sans effet).
-- AUCUNE contrainte NOT NULL n'est posee ici : un lot ulterieur la posera apres
-- verification que toutes les lignes prod sont bien renseignees.
--
-- Les tables filles sont gardees par to_regclass : certaines (smart_lock_devices,
-- cameras, thermostats, environment_sensors, key_exchange_*, channel_rate_modifiers)
-- ont ete creees hors de la plage de conversion Flyway->Liquibase (V2..V58) et
-- pourraient ne pas exister sur tous les environnements. Le garde evite de casser
-- le changeset au boot si une table est absente.
--
-- NULL LEGITIME (EXCLUS de ce backfill) :
--   * users                  -> staff plateforme (SUPER_ADMIN/SUPER_MANAGER) sans org ;
--   * system_email_templates -> templates globaux Clenzy ;
--   * kb_documents           -> docs RAG globales (NULL = doc Clenzy globale).
--
-- IMPORTANT (orchestrateur Liquibase) : ce bloc PL/pgSQL exige
--   splitStatements: false
--   stripComments: false
-- dans l'entree sqlFile du db.changelog-master.yaml.

DO $$
BEGIN
    -- ── 1. Racine : properties depuis le proprietaire (users.owner_id) ───────
    UPDATE properties p
    SET organization_id = u.organization_id
    FROM users u
    WHERE p.owner_id = u.id
      AND p.organization_id IS NULL
      AND u.organization_id IS NOT NULL;

    -- ── 2. Tables filles : org propagee depuis properties via property_id ────
    UPDATE reservations r
    SET organization_id = p.organization_id
    FROM properties p
    WHERE r.property_id = p.id
      AND r.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    UPDATE interventions i
    SET organization_id = p.organization_id
    FROM properties p
    WHERE i.property_id = p.id
      AND i.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    UPDATE service_requests sr
    SET organization_id = p.organization_id
    FROM properties p
    WHERE sr.property_id = p.id
      AND sr.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    UPDATE ical_feeds f
    SET organization_id = p.organization_id
    FROM properties p
    WHERE f.property_id = p.id
      AND f.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    UPDATE rate_overrides ro
    SET organization_id = p.organization_id
    FROM properties p
    WHERE ro.property_id = p.id
      AND ro.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    IF to_regclass('public.smart_lock_devices') IS NOT NULL THEN
        UPDATE smart_lock_devices d
        SET organization_id = p.organization_id
        FROM properties p
        WHERE d.property_id = p.id
          AND d.organization_id IS NULL
          AND p.organization_id IS NOT NULL;
    END IF;

    IF to_regclass('public.cameras') IS NOT NULL THEN
        UPDATE cameras c
        SET organization_id = p.organization_id
        FROM properties p
        WHERE c.property_id = p.id
          AND c.organization_id IS NULL
          AND p.organization_id IS NOT NULL;
    END IF;

    IF to_regclass('public.environment_sensors') IS NOT NULL THEN
        UPDATE environment_sensors s
        SET organization_id = p.organization_id
        FROM properties p
        WHERE s.property_id = p.id
          AND s.organization_id IS NULL
          AND p.organization_id IS NOT NULL;
    END IF;

    IF to_regclass('public.noise_devices') IS NOT NULL THEN
        UPDATE noise_devices n
        SET organization_id = p.organization_id
        FROM properties p
        WHERE n.property_id = p.id
          AND n.organization_id IS NULL
          AND p.organization_id IS NOT NULL;
    END IF;

    IF to_regclass('public.thermostats') IS NOT NULL THEN
        UPDATE thermostats t
        SET organization_id = p.organization_id
        FROM properties p
        WHERE t.property_id = p.id
          AND t.organization_id IS NULL
          AND p.organization_id IS NOT NULL;
    END IF;

    IF to_regclass('public.key_exchange_points') IS NOT NULL THEN
        UPDATE key_exchange_points kep
        SET organization_id = p.organization_id
        FROM properties p
        WHERE kep.property_id = p.id
          AND kep.organization_id IS NULL
          AND p.organization_id IS NOT NULL;
    END IF;

    IF to_regclass('public.key_exchange_codes') IS NOT NULL THEN
        UPDATE key_exchange_codes kec
        SET organization_id = p.organization_id
        FROM properties p
        WHERE kec.property_id = p.id
          AND kec.organization_id IS NULL
          AND p.organization_id IS NOT NULL;
    END IF;

    -- channel_rate_modifiers.property_id est NULLABLE (regles org-wide sans bien).
    -- On ne propage que les lignes liees a une propriete ; les regles org-wide
    -- a organization_id NULL sont laissees telles quelles (pas de racine pour les resoudre).
    IF to_regclass('public.channel_rate_modifiers') IS NOT NULL THEN
        UPDATE channel_rate_modifiers crm
        SET organization_id = p.organization_id
        FROM properties p
        WHERE crm.property_id = p.id
          AND crm.organization_id IS NULL
          AND p.organization_id IS NOT NULL;
    END IF;

    -- ── 3a. document_generations via reference_type / reference_id ───────────
    -- reference_type est stocke en STRING (EnumType.STRING : 'INTERVENTION', ...).
    UPDATE document_generations dg
    SET organization_id = i.organization_id
    FROM interventions i
    WHERE dg.reference_type = 'INTERVENTION'
      AND dg.reference_id = i.id
      AND dg.organization_id IS NULL
      AND i.organization_id IS NOT NULL;

    UPDATE document_generations dg
    SET organization_id = r.organization_id
    FROM reservations r
    WHERE dg.reference_type = 'RESERVATION'
      AND dg.reference_id = r.id
      AND dg.organization_id IS NULL
      AND r.organization_id IS NOT NULL;

    UPDATE document_generations dg
    SET organization_id = sr.organization_id
    FROM service_requests sr
    WHERE dg.reference_type = 'SERVICE_REQUEST'
      AND dg.reference_id = sr.id
      AND dg.organization_id IS NULL
      AND sr.organization_id IS NOT NULL;

    UPDATE document_generations dg
    SET organization_id = p.organization_id
    FROM properties p
    WHERE dg.reference_type = 'PROPERTY'
      AND dg.reference_id = p.id
      AND dg.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    -- ── 3b. notifications via user_id (keycloak_id) -> users.organization_id ─
    -- notifications.user_id est le keycloak_id du destinataire. Les notifications
    -- d'un staff plateforme (users.organization_id NULL) restent NULL (legitime).
    UPDATE notifications n
    SET organization_id = u.organization_id
    FROM users u
    WHERE n.user_id = u.keycloak_id
      AND n.organization_id IS NULL
      AND u.organization_id IS NOT NULL;
END $$;
