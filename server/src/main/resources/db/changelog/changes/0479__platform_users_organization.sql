-- Baitly platform staff (SUPER_ADMIN / SUPER_MANAGER) may have no organization.
-- User.organizationId, autoProvisionUser and TenantFilter already support this.
-- Migration 0037 imposed NOT NULL; 0232 excluded users without removing it.
-- Keep the foreign key, tenant checks, memberships and existing roles unchanged.
SET LOCAL lock_timeout = '5s';
ALTER TABLE users ALTER COLUMN organization_id DROP NOT NULL;
