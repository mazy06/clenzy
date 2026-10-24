-- Baitly: scope and bound the cooldown lookup performed under the configuration lock.
-- Table/columns verified against NoiseAlert and changeset 0054.
CREATE INDEX idx_baitly_noise_alert_cooldown ON noise_alerts (organization_id,property_id,severity,created_at);
