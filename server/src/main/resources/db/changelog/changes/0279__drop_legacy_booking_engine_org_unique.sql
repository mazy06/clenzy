-- ============================================================================
-- 0279 : Drop de la contrainte UNIQUE heritee sur booking_engine_configs(organization_id) SEUL
-- ============================================================================
-- Origine : ancien modele « 1 booking engine par organisation » -> @Column(unique=true) sur
-- organizationId -> contrainte UNIQUE mono-colonne auto-generee par Hibernate (ddl-auto, nom
-- non-deterministe type `uk_2s4asvsf9989g768571ek38ty`), gelee en base.
--
-- Le modele ACTUEL autorise plusieurs configs par org : l'entite BookingEngineConfig declare
-- @UniqueConstraint `uq_bec_org_name` sur (organization_id, name), et le service verifie l'unicite
-- par (orgId, name). La vieille contrainte mono-colonne contredit ce modele : creer un 2e booking
-- engine pour une org qui en a deja un viole `uk_xxxx` -> POST /api/booking-engine/configs en 500
-- (DataIntegrityViolationException).
--
-- On DROP toute contrainte UNIQUE portant EXACTEMENT sur (organization_id) seul (nom agnostique,
-- resolu via pg_constraint). La contrainte composite `uq_bec_org_name` (2 colonnes) est conservee.
--
-- Idempotent : la boucle ne trouve rien au re-run. Robuste prod/dev : no-op si la contrainte
-- mono-colonne n'a jamais existe (schema prod 100 % Liquibase).
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.booking_engine_configs') IS NULL THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.booking_engine_configs'::regclass
      AND con.contype = 'u'
      AND array_length(con.conkey, 1) = 1
      AND (
        SELECT att.attname
        FROM pg_attribute att
        WHERE att.attrelid = con.conrelid
          AND att.attnum = con.conkey[1]
      ) = 'organization_id'
  LOOP
    EXECUTE format('ALTER TABLE booking_engine_configs DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Dropped legacy single-column UNIQUE constraint % on booking_engine_configs(organization_id)', r.conname;
  END LOOP;
END $$;
