-- ============================================================================
-- 0292 : Backfill des partitions mensuelles calendar_days (défensif)
-- ============================================================================
-- Contexte : selon l'environnement, calendar_days est soit une table PARTITIONNÉE
-- (prod, changeset 0050 : partitions mensuelles + partition par défaut), soit une
-- table PLATE (dev, recréée par Hibernate ddl-auto). Le job mensuel
-- (CalendarPartitionManager, 18-24 mois à l'avance) échoue à créer
-- calendar_days_2028_* :
--   - table plate    → "table calendar_days is not partitioned" ;
--   - table partitionnée avec des lignes 2028 dans la default → "updated partition
--     constraint for default partition ... would be violated by some row".
--
-- Ce changeset ne s'applique QUE si la table est réellement partitionnée : il
-- détache la default, crée les partitions mensuelles manquantes (12 mois passés →
-- 36 mois futurs), réinjecte les lignes de l'ancienne default (routage auto) et
-- recrée une default vide. Sur une table plate, il ne fait RIEN (no-op) → le boot
-- n'est jamais bloqué. Idempotent, s'exécute au boot avant le trafic.
-- ============================================================================

DO $$
DECLARE
    is_partitioned BOOLEAN;
    has_default    BOOLEAN;
    m              DATE;
    start_month    DATE;
    end_month      DATE;
    part_name      TEXT;
BEGIN
    -- 0. N'agir que si calendar_days est VRAIMENT partitionnée (prod). Sinon no-op.
    SELECT EXISTS (
        SELECT 1 FROM pg_partitioned_table pt
        JOIN pg_class c ON c.oid = pt.partrelid
        WHERE c.relname = 'calendar_days'
    ) INTO is_partitioned;

    IF NOT is_partitioned THEN
        RAISE NOTICE 'calendar_days non partitionnée — backfill des partitions ignoré (no-op).';
        RETURN;
    END IF;

    -- 1. Détacher la partition par défaut si présente (supprime l'overlap bloquant).
    SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'calendar_days_default')
        INTO has_default;
    IF has_default THEN
        ALTER TABLE calendar_days DETACH PARTITION calendar_days_default;
        ALTER TABLE calendar_days_default RENAME TO calendar_days_default_backfill;
    END IF;

    -- 2. Créer les partitions mensuelles manquantes (12 mois passés → 36 mois futurs).
    start_month := date_trunc('month', CURRENT_DATE - INTERVAL '12 months');
    end_month   := date_trunc('month', CURRENT_DATE + INTERVAL '36 months');
    m := start_month;
    WHILE m < end_month LOOP
        part_name := 'calendar_days_' || to_char(m, 'YYYY_MM');
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = part_name) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF calendar_days FOR VALUES FROM (%L) TO (%L)',
                part_name, m, m + INTERVAL '1 month'
            );
        END IF;
        m := m + INTERVAL '1 month';
    END LOOP;

    -- 3. Recréer une default VIDE + réinjecter les lignes de l'ancienne default.
    IF has_default THEN
        CREATE TABLE calendar_days_default PARTITION OF calendar_days DEFAULT;
        INSERT INTO calendar_days SELECT * FROM calendar_days_default_backfill;
        DROP TABLE calendar_days_default_backfill;
    END IF;
END $$;
