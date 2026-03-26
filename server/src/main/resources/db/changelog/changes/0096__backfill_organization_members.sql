-- ============================================================================
-- 0096: Backfill missing organization_members from users table
-- ============================================================================
-- Some users have organization_id set but no corresponding row in
-- organization_members. This migration inserts the missing rows.
--
-- Logic:
--   - If the org has NO existing members → user becomes OWNER
--   - If the org already has members   → user becomes MEMBER
-- ============================================================================

-- Step 1: Insert as OWNER for users in orgs with zero members
INSERT INTO organization_members (organization_id, user_id, role_in_org, joined_at)
SELECT u.organization_id, u.id, 'OWNER', u.created_at
FROM users u
WHERE u.organization_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = u.organization_id AND om.user_id = u.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = u.organization_id
  );

-- Step 2: Insert as MEMBER for users in orgs that already have members
INSERT INTO organization_members (organization_id, user_id, role_in_org, joined_at)
SELECT u.organization_id, u.id, 'MEMBER', u.created_at
FROM users u
WHERE u.organization_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = u.organization_id AND om.user_id = u.id
  );
