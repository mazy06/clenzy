ALTER TABLE guest_reviews ADD COLUMN baitly_public_author_name VARCHAR(100);
ALTER TABLE guest_reviews ADD COLUMN baitly_public_author_avatar VARCHAR(2048);
ALTER TABLE baitly_public_profiles ADD COLUMN management_fee_pct NUMERIC(5,2)
    CHECK (management_fee_pct BETWEEN 0 AND 100);
