-- Exact table and column names verified against NoiseDevice and changesets 0036/0274.
ALTER TABLE noise_devices ADD COLUMN simulation BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX uq_noise_devices_baitly_external_id ON noise_devices (external_device_id)
    WHERE device_type = 'BAITLY';
