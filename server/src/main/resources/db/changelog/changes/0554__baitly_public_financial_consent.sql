-- BaitlyPublicProfile @Table: baitly_public_profiles (0551).
-- Existing publications do not authorize financial data by default.
ALTER TABLE baitly_public_profiles ADD COLUMN publish_financial_performance BOOLEAN NOT NULL DEFAULT FALSE;
