-- Onboarding adaptatif par rôle : persistance de la progression
CREATE TABLE user_onboarding (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(30)  NOT NULL,
    step_key   VARCHAR(50)  NOT NULL,
    completed  BOOLEAN      NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP,
    dismissed  BOOLEAN      NOT NULL DEFAULT FALSE,
    organization_id BIGINT,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role, step_key)
);

CREATE INDEX idx_user_onboarding_user_role ON user_onboarding(user_id, role);
