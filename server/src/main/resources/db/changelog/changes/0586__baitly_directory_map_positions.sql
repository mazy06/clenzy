-- Baitly: shared JDBC table created by 0577 and extended by 0583/0585.
-- Supports viewport coverage and detail queries without indexing withdrawn references.
CREATE INDEX idx_baitly_directory_map_positions
    ON baitly_directory_professionals ((coalesce(latitude,sirene_latitude)),(coalesce(longitude,sirene_longitude)))
    INCLUDE (id)
    WHERE suppressed=false AND source_active=true;
