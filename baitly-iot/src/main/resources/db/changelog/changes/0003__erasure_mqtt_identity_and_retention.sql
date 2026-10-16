-- Erasure is requested by the runtime (UPDATE only); the separate retention role deletes the rows.
ALTER TABLE baitly_iot_devices ADD COLUMN erasure_requested_at TIMESTAMP WITH TIME ZONE;
-- MQTT certificate CN, independent from the HTTP bearer secret. Existing devices keep the CN
-- that their current certificate already carries (previously the credential fingerprint).
ALTER TABLE baitly_iot_devices ADD COLUMN mqtt_identity CHAR(64);
UPDATE baitly_iot_devices SET mqtt_identity = token_hash;
ALTER TABLE baitly_iot_devices ALTER COLUMN mqtt_identity SET NOT NULL;
ALTER TABLE baitly_iot_devices ADD CONSTRAINT uq_baitly_iot_devices_mqtt_identity UNIQUE (mqtt_identity);
-- Retention deletes by age across every device.
CREATE INDEX idx_baitly_iot_noise_measured_at ON baitly_iot_noise_measurements (measured_at);
