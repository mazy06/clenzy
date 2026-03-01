-- V59: Table device_tokens pour push notifications mobile (FCM/Expo)
CREATE TABLE IF NOT EXISTS device_tokens (
    id              BIGSERIAL PRIMARY KEY,
    user_id         VARCHAR(255) NOT NULL,
    token           VARCHAR(512) NOT NULL,
    platform        VARCHAR(10)  NOT NULL CHECK (platform IN ('ios', 'android')),
    organization_id BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_device_token UNIQUE (token)
);

CREATE INDEX idx_device_tokens_user_id ON device_tokens (user_id);
CREATE INDEX idx_device_tokens_platform ON device_tokens (platform);
