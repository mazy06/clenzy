-- Exact existing names: Organization/organizations, Prospect/prospects and changesets 0569/0570.
-- A recruitment page belongs to an organization, without requiring publication of a concierge profile.
CREATE TABLE baitly_crm_recruitment_pages (
    id uuid PRIMARY KEY,
    organization_id bigint NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    published boolean NOT NULL DEFAULT false,
    recipient_name varchar(150) NOT NULL CHECK (length(btrim(recipient_name))>0),
    title varchar(160) NOT NULL CHECK (length(btrim(title))>0),
    city varchar(150) NOT NULL CHECK (length(btrim(city))>0),
    country_code varchar(2) CHECK (country_code ~ '^[A-Z]{2}$'),
    description text,
    services jsonb NOT NULL CHECK (jsonb_typeof(services)='array' AND jsonb_array_length(services)>0),
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT baitly_recruitment_org_identity UNIQUE (organization_id,id)
);
ALTER TABLE baitly_crm_management_inquiries DROP CONSTRAINT baitly_crm_management_inquiries_purpose_check;
ALTER TABLE baitly_crm_management_inquiries ADD CONSTRAINT baitly_inquiry_purpose CHECK (purpose IN ('MANAGEMENT','ESTIMATE','APPLICATION')),
    ADD COLUMN recruitment_id uuid,
    ADD COLUMN recruitment_title varchar(160),
    ADD COLUMN application_services jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(application_services)='array'),
    ADD COLUMN application_availability varchar(500),
    ADD CONSTRAINT baitly_inquiry_recruitment FOREIGN KEY (organization_id,recruitment_id)
        REFERENCES baitly_crm_recruitment_pages(organization_id,id) ON DELETE SET NULL (recruitment_id),
    ADD CONSTRAINT baitly_inquiry_application CHECK (purpose<>'APPLICATION' OR (profile_id IS NULL AND recruitment_title IS NOT NULL AND jsonb_array_length(application_services)>0));
CREATE INDEX baitly_inquiry_recruitment_idx ON baitly_crm_management_inquiries(organization_id,recruitment_id) WHERE recruitment_id IS NOT NULL;
