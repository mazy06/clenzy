-- BaitlyPublicProfile maps to baitly_public_profiles, created by 0551.
ALTER TABLE baitly_public_profiles ADD COLUMN hide_last_name BOOLEAN NOT NULL DEFAULT FALSE;
