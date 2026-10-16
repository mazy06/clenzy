ALTER TABLE interventions ADD COLUMN baitly_paused_at TIMESTAMP;
ALTER TABLE interventions ADD COLUMN baitly_pause_seconds BIGINT NOT NULL DEFAULT 0;
ALTER TABLE issues ADD COLUMN baitly_damage_cause VARCHAR(30);
ALTER TABLE issues ADD COLUMN baitly_damage_room VARCHAR(40);
ALTER TABLE issues ADD COLUMN baitly_damage_item_id BIGINT;
ALTER TABLE issues ADD COLUMN baitly_damage_element_category VARCHAR(30);
ALTER TABLE issues ADD COLUMN baitly_damage_element_code VARCHAR(80);
ALTER TABLE issues ADD COLUMN baitly_damage_element_name VARCHAR(150);
