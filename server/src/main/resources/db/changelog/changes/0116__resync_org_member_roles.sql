-- ============================================================================
-- 0116: Resync organization member roles after 0096 backfill bug
-- ============================================================================
-- Migration 0096__backfill_organization_members.sql intended to backfill
-- missing rows in organization_members with the right role:
--   - If org has NO existing members  -> user becomes OWNER
--   - If org already has members      -> user becomes MEMBER
--
-- The third NOT EXISTS check ("the org has no members") is evaluated against
-- the table snapshot BEFORE the INSERT runs. When multiple users in the same
-- empty org all qualified, they ALL got inserted as OWNER simultaneously.
--
-- Symptoms: organizations with multiple OWNERs (impossible by design, OWNER
-- is meant to be unique per org).
--
-- This migration:
--   1. For each org with >1 OWNER, keeps the canonical OWNER (priority:
--      user.role='HOST', then earliest joined_at).
--   2. Remaps the other OWNERs to their proper role based on user.role,
--      mirroring UserService.mapUserRoleToOrgRole logic.
--   3. HOST users that are NOT the canonical OWNER are downgraded to MEMBER
--      (they joined an existing org, they are not its creator).
--
-- Idempotent: re-running is a no-op once no org has multiple OWNERs.
-- (Pilot test — comment-only edit to trigger ci-liquibase-validate.yml)
-- ============================================================================

WITH orgs_with_multiple_owners AS (
    SELECT organization_id
    FROM organization_members
    WHERE role_in_org = 'OWNER'
    GROUP BY organization_id
    HAVING COUNT(*) > 1
),
canonical_owners AS (
    SELECT DISTINCT ON (om.organization_id)
        om.organization_id,
        om.id AS member_id
    FROM organization_members om
    JOIN users u ON u.id = om.user_id
    WHERE om.organization_id IN (SELECT organization_id FROM orgs_with_multiple_owners)
      AND om.role_in_org = 'OWNER'
    ORDER BY om.organization_id, (u.role = 'HOST') DESC, om.joined_at ASC
)
UPDATE organization_members om
SET role_in_org = CASE u.role
    WHEN 'SUPER_ADMIN'    THEN 'ADMIN'
    WHEN 'SUPER_MANAGER'  THEN 'ADMIN'
    WHEN 'HOST'           THEN 'MEMBER'
    WHEN 'SUPERVISOR'     THEN 'SUPERVISOR'
    WHEN 'HOUSEKEEPER'    THEN 'HOUSEKEEPER'
    WHEN 'TECHNICIAN'     THEN 'TECHNICIAN'
    WHEN 'LAUNDRY'        THEN 'LAUNDRY'
    WHEN 'EXTERIOR_TECH'  THEN 'EXTERIOR_TECH'
    ELSE 'MEMBER'
END
FROM users u
WHERE om.user_id = u.id
  AND om.organization_id IN (SELECT organization_id FROM orgs_with_multiple_owners)
  AND om.role_in_org = 'OWNER'
  AND om.id NOT IN (SELECT member_id FROM canonical_owners);

-- ---------------------------------------------------------------------------
-- Verification: warn if any org still has multiple OWNERs after the update.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    affected_orgs INTEGER;
BEGIN
    SELECT COUNT(*) INTO affected_orgs
    FROM (
        SELECT organization_id
        FROM organization_members
        WHERE role_in_org = 'OWNER'
        GROUP BY organization_id
        HAVING COUNT(*) > 1
    ) AS x;

    IF affected_orgs > 0 THEN
        RAISE WARNING '0116: % organisation(s) ont encore plusieurs OWNERs apres resync, revue manuelle requise', affected_orgs;
    END IF;
END $$;
