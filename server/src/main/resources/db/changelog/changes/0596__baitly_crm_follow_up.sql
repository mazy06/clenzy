-- JDBC-owned table, verified against changeset 0574 and BaitlyCrmDetails.
ALTER TABLE baitly_crm_contact_details
    ADD COLUMN last_exchange_on date,
    ADD COLUMN next_action varchar(400),
    ADD COLUMN next_action_on date,
    ADD CONSTRAINT baitly_crm_follow_up_action_check CHECK (
      (NULLIF(btrim(next_action),'') IS NULL AND next_action_on IS NULL)
      OR (NULLIF(btrim(next_action),'') IS NOT NULL AND next_action_on IS NOT NULL)
    );
