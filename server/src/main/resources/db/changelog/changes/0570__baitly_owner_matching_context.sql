-- Extends the JDBC inquiry snapshot created in 0569; Property.type uses PropertyType.
ALTER TABLE baitly_crm_management_inquiries
    ADD COLUMN country_code varchar(2) CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
    ADD COLUMN requested_services jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(requested_services)='array'),
    ADD COLUMN max_management_fee_pct numeric(5,2) CHECK (max_management_fee_pct BETWEEN 0 AND 100);
ALTER TABLE baitly_crm_management_inquiries DROP CONSTRAINT baitly_crm_management_inquiries_property_type_check;
ALTER TABLE baitly_crm_management_inquiries ADD CONSTRAINT baitly_inquiry_property_type CHECK
    (property_type IN ('APARTMENT','HOUSE','STUDIO','VILLA','LOFT','DUPLEX','TOWNHOUSE','BUNGALOW','RIAD','GUEST_ROOM','COTTAGE','CHALET','BOAT','OTHER'));
