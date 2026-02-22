-- ============================================================================
-- V54: Partition calendar_days by month for scalability
-- ============================================================================
-- calendar_days grandit lineairement (~365 lignes x N proprietes/an).
-- Le partitionnement mensuel permet :
-- - Requetes de disponibilite 10-50x plus rapides (partition pruning)
-- - Maintenance (VACUUM, reindex) par partition sans verrouiller la table
-- - Suppression rapide de vieux mois (DROP PARTITION)
--
-- Niveau 8 — Scalabilite et haute disponibilite.
-- ============================================================================

-- 1. Renommer la table existante
ALTER TABLE calendar_days RENAME TO calendar_days_old;

-- 2. Supprimer les index de l'ancienne table pour eviter les conflits de noms
DROP INDEX IF EXISTS idx_calendar_days_property_date_status;
DROP INDEX IF EXISTS idx_calendar_days_org;
DROP INDEX IF EXISTS idx_calendar_days_reservation;

-- 3. Creer la table partitionnee (meme schema)
-- Dans une table partitionnee, la cle de partition (date) DOIT faire partie
-- de toute contrainte UNIQUE ou PRIMARY KEY.
CREATE TABLE calendar_days (
    id              BIGSERIAL,
    organization_id BIGINT NOT NULL,
    property_id     BIGINT NOT NULL,
    date            DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    reservation_id  BIGINT,
    nightly_price   DECIMAL(10,2),
    min_stay        INTEGER DEFAULT 1,
    source          VARCHAR(30) DEFAULT 'MANUAL',
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (id, date),
    CONSTRAINT uq_calendar_days_property_date UNIQUE (property_id, date)
) PARTITION BY RANGE (date);

-- 4. Creer les partitions : 12 mois passes + 24 mois futurs + default
DO $$
DECLARE
    start_month DATE;
    end_month DATE;
    partition_name TEXT;
    m DATE;
BEGIN
    start_month := date_trunc('month', CURRENT_DATE - INTERVAL '12 months');
    end_month := date_trunc('month', CURRENT_DATE + INTERVAL '24 months');

    m := start_month;
    WHILE m < end_month LOOP
        partition_name := 'calendar_days_' || to_char(m, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF calendar_days FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            m,
            m + INTERVAL '1 month'
        );
        m := m + INTERVAL '1 month';
    END LOOP;
END $$;

-- Partition par defaut pour les dates hors range
CREATE TABLE calendar_days_default PARTITION OF calendar_days DEFAULT;

-- 5. Copier les donnees de l'ancienne table
INSERT INTO calendar_days (id, organization_id, property_id, date, status,
    reservation_id, nightly_price, min_stay, source, notes, created_at, updated_at)
SELECT id, organization_id, property_id, date, status,
    reservation_id, nightly_price, min_stay, source, notes, created_at, updated_at
FROM calendar_days_old;

-- 6. Reattacher la sequence
SELECT setval('calendar_days_id_seq',
    COALESCE((SELECT MAX(id) FROM calendar_days), 0) + 1);

-- 7. Recreer les index
CREATE INDEX idx_calendar_days_property_date_status
    ON calendar_days(property_id, date, status);
CREATE INDEX idx_calendar_days_org
    ON calendar_days(organization_id);
CREATE INDEX idx_calendar_days_reservation
    ON calendar_days(reservation_id);

-- 8. Supprimer l'ancienne table
DROP TABLE calendar_days_old;
