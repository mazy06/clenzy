-- JDBC table name verified in changeset 0572 and BaitlyCrmCampaigns; no JPA entity owns this table.
-- NULL keeps existing user-created templates independent from the built-in catalogue.
ALTER TABLE baitly_crm_campaign_templates ADD COLUMN default_key varchar(80);
ALTER TABLE baitly_crm_campaign_templates
    ADD CONSTRAINT baitly_campaign_template_default UNIQUE (organization_id,default_key);
