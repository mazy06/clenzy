-- Add widget position fields for booking engine integration preview
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS widget_position VARCHAR(10) DEFAULT 'bottom';
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS inline_target_id VARCHAR(50);
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS inline_placement VARCHAR(10) DEFAULT 'after';
