-- ============================================================================
-- 0174 : Cameras (Phase 2 — supervision video via passerelle media go2rtc)
-- ============================================================================
-- Table org-scopee. L'URL RTSP (credentials) est chiffree (AES-256-GCM, comme
-- les tokens OAuth). stream_name = identifiant du flux cote go2rtc (unique).
-- ============================================================================

CREATE TABLE cameras (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL,
    user_id             VARCHAR(255) NOT NULL,
    name                VARCHAR(255) NOT NULL,
    property_id         BIGINT NOT NULL,
    room_name           VARCHAR(255),
    brand               VARCHAR(50),
    rtsp_url_encrypted  TEXT,
    stream_name         VARCHAR(120) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
    recording           BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at        TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP
);

CREATE INDEX idx_cameras_org_id ON cameras(organization_id);
CREATE INDEX idx_cameras_property_id ON cameras(property_id);
CREATE INDEX idx_cameras_user_id ON cameras(user_id);
CREATE UNIQUE INDEX uq_cameras_stream_name ON cameras(stream_name);
