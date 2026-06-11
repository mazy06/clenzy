-- 0232 : verrou structurel NOT NULL sur organization_id (audit SECU9-ORGID, etape 2).
--
-- Suite directe du backfill 0231 : une fois toutes les lignes legacy renseignees,
-- on pose la contrainte NOT NULL sur organization_id pour les tables ou un NULL
-- est ILLEGITIME (cf. helper OrganizationAccessGuard fail-closed). Cela ferme
-- definitivement la fenetre d'IDOR cross-org : plus aucune ligne ne peut etre
-- inseree sans org.
--
-- TABLES CIBLES (NOT NULL) :
--   properties, reservations, interventions, service_requests, ical_feeds,
--   rate_overrides, document_generations, et les tables IoT/echange si presentes
--   (smart_lock_devices, cameras, environment_sensors, noise_devices, thermostats,
--    key_exchange_points, key_exchange_codes, channel_rate_modifiers).
--
-- NULL LEGITIME (EXCLUS de ce verrou, cf. backfill 0231) :
--   * users                  -> staff plateforme (SUPER_ADMIN/SUPER_MANAGER) sans org ;
--   * notifications          -> notifications d'un staff plateforme (org NULL) ;
--   * system_email_templates -> templates globaux Clenzy ;
--   * kb_documents           -> docs RAG globales (NULL = doc Clenzy globale).
--
-- COUVERTURE DU BACKFILL (prerequis au pre-check NOT NULL ci-dessous) :
--   Le backfill 0231 ne resout document_generations que pour 4 des 8 reference_type
--   de com.clenzy.model.ReferenceType : INTERVENTION, RESERVATION, SERVICE_REQUEST,
--   PROPERTY. Les 4 autres (USER, PROVIDER_EXPENSE, MANAGEMENT_CONTRACT, RECEIVED_FORM)
--   ainsi que reference_type NULL persistent reellement des DocumentGeneration
--   (ex: flux public /api/public/quote-request -> RECEIVED_FORM avec organizationId
--   null, contrats de gestion -> MANAGEMENT_CONTRACT). Toute ligne legacy de ces
--   types creee avant l'introduction du fallback template.getOrganizationId() dans
--   DocumentGenerationPipeline serait restee a organization_id NULL apres 0231, et
--   ferait RAISE EXCEPTION en boucle au boot prod (crash-loop). Ce changeset COMPLETE
--   donc le backfill 0231 (etape 0) AVANT de poser NOT NULL, pour les 8 reference_type :
--     * PROVIDER_EXPENSE     -> provider_expenses.organization_id ;
--     * MANAGEMENT_CONTRACT  -> management_contracts.organization_id ;
--     * USER                 -> users.organization_id (NULL si staff plateforme) ;
--     * RECEIVED_FORM / NULL / residus non resolubles -> repli explicite vers l'org
--       Clenzy (SELECT id FROM organizations WHERE name='Clenzy'), exactement comme
--       le fait deja le pipeline applicatif via le fallback template DEVIS.
--   Le pre-check RAISE EXCEPTION n'est donc atteint que si une ligne reste NULL APRES
--   ce backfill exhaustif (ex: org Clenzy absente) -> signal LISIBLE plutot que crash.
--
-- Gardes :
--   * to_regclass : les tables IoT/echange + channel_rate_modifiers + management_contracts
--     ont ete creees hors plage de conversion Flyway->Liquibase (Hibernate ddl-auto) et
--     peuvent etre absentes sur certains environnements. Une table absente est
--     silencieusement ignoree.
--   * Pre-check explicite : si une ligne organization_id IS NULL subsiste (backfill
--     incomplet), on RAISE EXCEPTION en nommant la table -> echec LISIBLE au boot
--     plutot qu'un ALTER cryptique de PostgreSQL.
--   * Idempotence : le backfill complementaire est filtre sur organization_id IS NULL
--     (rejouable sans effet) ; la contrainte n'est posee que si information_schema
--     indique que la colonne est encore nullable (is_nullable = 'YES').
--
-- IMPORTANT (orchestrateur Liquibase) : ce bloc PL/pgSQL exige
--   splitStatements: false
--   stripComments: false
-- dans l'entree sqlFile du db.changelog-master.yaml.

-- ─── Etape 0 : completer le backfill document_generations (4 reference_type non ──
--             couverts par 0231) puis repli Clenzy sur tout residu NULL. ────────
-- DONNEES UNIQUEMENT, filtre sur organization_id IS NULL => IDEMPOTENT.
DO $$
DECLARE
    clenzy_org_id BIGINT;
BEGIN
    -- PROVIDER_EXPENSE -> provider_expenses.organization_id (cree par Liquibase 0079,
    -- mais garde par symetrie defensive).
    IF to_regclass('public.provider_expenses') IS NOT NULL THEN
        UPDATE document_generations dg
        SET organization_id = pe.organization_id
        FROM provider_expenses pe
        WHERE dg.reference_type = 'PROVIDER_EXPENSE'
          AND dg.reference_id = pe.id
          AND dg.organization_id IS NULL
          AND pe.organization_id IS NOT NULL;
    END IF;

    -- MANAGEMENT_CONTRACT -> management_contracts.organization_id. Table creee par
    -- Hibernate ddl-auto (pas de CREATE TABLE Liquibase) -> peut etre absente.
    IF to_regclass('public.management_contracts') IS NOT NULL THEN
        UPDATE document_generations dg
        SET organization_id = mc.organization_id
        FROM management_contracts mc
        WHERE dg.reference_type = 'MANAGEMENT_CONTRACT'
          AND dg.reference_id = mc.id
          AND dg.organization_id IS NULL
          AND mc.organization_id IS NOT NULL;
    END IF;

    -- USER -> users.organization_id. NULL legitime si le destinataire est un staff
    -- plateforme (organization_id NULL) : ces lignes tombent dans le repli Clenzy.
    UPDATE document_generations dg
    SET organization_id = u.organization_id
    FROM users u
    WHERE dg.reference_type = 'USER'
      AND dg.reference_id = u.id
      AND dg.organization_id IS NULL
      AND u.organization_id IS NOT NULL;

    -- Repli explicite vers l'org Clenzy pour tout residu NULL non resoluble :
    -- RECEIVED_FORM (flux public quote-request), reference_type NULL, ou lignes
    -- legacy dont la racine a elle-meme une org NULL. Aligne sur le fallback
    -- template.getOrganizationId() de DocumentGenerationPipeline (l'org Clenzy
    -- possede le template DEVIS seede en 0163). Si l'org Clenzy est absente,
    -- on laisse les lignes NULL : le pre-check ci-dessous levera une erreur LISIBLE.
    SELECT id INTO clenzy_org_id FROM organizations WHERE name = 'Clenzy' LIMIT 1;
    IF clenzy_org_id IS NOT NULL THEN
        UPDATE document_generations
        SET organization_id = clenzy_org_id
        WHERE organization_id IS NULL;
    END IF;
END $$;

DO $$
DECLARE
    target_table TEXT;
    null_count   BIGINT;
    is_nullable  TEXT;
    -- Tables ou organization_id NULL est ILLEGITIME. Les exclusions (users,
    -- notifications, system_email_templates, kb_documents) ne figurent PAS ici.
    target_tables TEXT[] := ARRAY[
        'properties',
        'reservations',
        'interventions',
        'service_requests',
        'ical_feeds',
        'rate_overrides',
        'document_generations',
        'smart_lock_devices',
        'cameras',
        'environment_sensors',
        'noise_devices',
        'thermostats',
        'key_exchange_points',
        'key_exchange_codes',
        'channel_rate_modifiers'
    ];
BEGIN
    FOREACH target_table IN ARRAY target_tables
    LOOP
        -- Garde : table potentiellement absente (creee hors Liquibase) -> on saute.
        IF to_regclass('public.' || target_table) IS NULL THEN
            CONTINUE;
        END IF;

        -- Idempotence : si la colonne est deja NOT NULL, rien a faire.
        SELECT c.is_nullable
        INTO is_nullable
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = target_table
          AND c.column_name = 'organization_id';

        IF is_nullable IS DISTINCT FROM 'YES' THEN
            CONTINUE;
        END IF;

        -- Pre-check : refuser proprement si une ligne legacy NULL subsiste.
        EXECUTE format(
            'SELECT count(*) FROM %I WHERE organization_id IS NULL',
            target_table
        ) INTO null_count;

        IF null_count > 0 THEN
            RAISE EXCEPTION
                'Impossible de poser NOT NULL sur %.organization_id : % ligne(s) a organization_id NULL subsiste(nt). Rejouer le backfill 0231 ou renseigner ces lignes avant de re-deployer.',
                target_table, null_count;
        END IF;

        -- Verrou structurel.
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL',
            target_table
        );
    END LOOP;
END $$;
