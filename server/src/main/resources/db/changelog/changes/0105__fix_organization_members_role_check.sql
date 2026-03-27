-- Update organization_members role_in_org CHECK to include all OrgMemberRole values
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_in_org_check;

ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_in_org_check
    CHECK (role_in_org::text = ANY(ARRAY[
        'OWNER','ADMIN','MANAGER','SUPERVISOR',
        'HOUSEKEEPER','TECHNICIAN','HOST',
        'LAUNDRY','EXTERIOR_TECH','MEMBER'
    ]::text[]));
