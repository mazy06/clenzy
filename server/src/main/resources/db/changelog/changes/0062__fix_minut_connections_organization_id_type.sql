-- ============================================================================
-- 0062 : Fix minut_connections.organization_id column type
-- ============================================================================
-- V40 created organization_id as VARCHAR(255) (Minut's org ID).
-- V41/0037 should have renamed it to minut_organization_id and added
-- a new organization_id BIGINT, but if the rename didn't apply correctly,
-- the column might still be VARCHAR(255).
--
-- This migration safely fixes the column type with proper guards.
-- ============================================================================

DO $$
BEGIN
    -- Step 1: If organization_id is still VARCHAR (not renamed by 0037),
    -- rename it to minut_organization_id first
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'minut_connections'
          AND column_name = 'organization_id'
          AND data_type = 'character varying'
    ) THEN
        -- Check if minut_organization_id already exists (partial migration state)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'minut_connections'
              AND column_name = 'minut_organization_id'
        ) THEN
            -- Rename the VARCHAR organization_id to minut_organization_id
            ALTER TABLE minut_connections
                RENAME COLUMN organization_id TO minut_organization_id;

            -- Add the new BIGINT organization_id
            ALTER TABLE minut_connections
                ADD COLUMN organization_id BIGINT;

            RAISE NOTICE 'minut_connections: renamed organization_id -> minut_organization_id, added new organization_id BIGINT';
        ELSE
            -- minut_organization_id exists but organization_id is still VARCHAR
            -- This means organization_id was re-created as VARCHAR somehow
            -- Drop and recreate as BIGINT
            ALTER TABLE minut_connections
                DROP COLUMN organization_id;
            ALTER TABLE minut_connections
                ADD COLUMN organization_id BIGINT;

            RAISE NOTICE 'minut_connections: dropped VARCHAR organization_id, recreated as BIGINT';
        END IF;
    END IF;

    -- Step 2: If organization_id exists but is INTEGER (not BIGINT),
    -- cast it to BIGINT
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'minut_connections'
          AND column_name = 'organization_id'
          AND data_type = 'integer'
    ) THEN
        ALTER TABLE minut_connections
            ALTER COLUMN organization_id SET DATA TYPE BIGINT;

        RAISE NOTICE 'minut_connections: cast organization_id from INTEGER to BIGINT';
    END IF;

    -- Ensure minut_organization_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'minut_connections'
          AND column_name = 'minut_organization_id'
    ) THEN
        ALTER TABLE minut_connections
            ADD COLUMN minut_organization_id VARCHAR(255);

        RAISE NOTICE 'minut_connections: added missing minut_organization_id column';
    END IF;
END $$;
