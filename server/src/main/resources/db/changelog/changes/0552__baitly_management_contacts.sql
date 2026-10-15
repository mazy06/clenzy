-- Matches BaitlyManagementContact and existing publication/users/organizations entities.
CREATE TABLE baitly_management_contacts (
    id UUID PRIMARY KEY,
    target_profile_id UUID NOT NULL REFERENCES baitly_public_profiles(id) ON DELETE CASCADE,
    sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    message VARCHAR(1500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX baitly_management_contacts_sender ON baitly_management_contacts(sender_user_id,created_at DESC);
CREATE INDEX baitly_management_contacts_target ON baitly_management_contacts(target_profile_id,created_at DESC);
