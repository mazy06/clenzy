-- Matches BaitlyPublicProfile @Table/@Column names and existing organizations/users.
CREATE TABLE baitly_public_profiles (
    id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    author_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(20) NOT NULL CHECK(role IN ('OWNER','CONCIERGE')),
    name VARCHAR(150) NOT NULL,
    organization VARCHAR(150), city VARCHAR(150), bio VARCHAR(1000),
    booking_url VARCHAR(2048), avatar_url VARCHAR(2048),
    property_ids JSONB NOT NULL DEFAULT '[]',
    management_services JSONB NOT NULL DEFAULT '[]',
    seeking_management BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(organization_id,author_user_id),
    CHECK(jsonb_typeof(property_ids)='array'), CHECK(jsonb_typeof(management_services)='array')
);
CREATE INDEX baitly_public_profiles_directory ON baitly_public_profiles(role,updated_at DESC) WHERE published;
