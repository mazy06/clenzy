-- BaitlySocialProfile / BaitlyReel @Table and @Column names.
-- Existing Organization/User entities use organizations/users.
CREATE TABLE baitly_social_profiles (
    id UUID PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    author_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(150) NOT NULL,
    instagram_url VARCHAR(2048), tiktok_url VARCHAR(2048), youtube_url VARCHAR(2048),
    published BOOLEAN NOT NULL DEFAULT FALSE,
    instagram_user_id VARCHAR(100), instagram_username VARCHAR(150),
    instagram_token_encrypted TEXT, instagram_token_expires_at TIMESTAMPTZ,
    UNIQUE(organization_id,author_user_id)
);
CREATE TABLE baitly_reels (
    id UUID PRIMARY KEY,
    social_profile_id UUID NOT NULL REFERENCES baitly_social_profiles(id) ON DELETE CASCADE,
    instagram_media_id VARCHAR(100) NOT NULL,
    permalink VARCHAR(2048) NOT NULL,
    thumbnail_url VARCHAR(4096),
    caption VARCHAR(500) NOT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE(social_profile_id,instagram_media_id)
);
CREATE INDEX baitly_reels_feed ON baitly_reels(created_at DESC,id DESC) WHERE published;
CREATE INDEX baitly_reels_author ON baitly_reels(social_profile_id,created_at DESC);
