-- ============================================================================
-- V53 : Security Audit Log
-- ============================================================================
-- Exigence Airbnb Partner Niveau 7 : audit trail securite avec event types
-- specifiques (LOGIN_SUCCESS, LOGIN_FAILURE, PERMISSION_DENIED, DATA_ACCESS,
-- ADMIN_ACTION, SECRET_ROTATION, SUSPICIOUS_ACTIVITY).
-- Separee de l'audit_log metier existant (retention et requetes differentes).
-- ============================================================================

CREATE TABLE security_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    event_type      VARCHAR(50) NOT NULL,
    actor_id        VARCHAR(255),
    actor_email     VARCHAR(255),
    actor_ip        VARCHAR(45),
    resource_type   VARCHAR(50),
    resource_id     VARCHAR(255),
    action          VARCHAR(50),
    result          VARCHAR(20),
    details         JSONB,
    organization_id BIGINT,
    user_agent      VARCHAR(500),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sec_audit_event_type ON security_audit_log(event_type);
CREATE INDEX idx_sec_audit_created_at ON security_audit_log(created_at);
CREATE INDEX idx_sec_audit_actor ON security_audit_log(actor_id, created_at DESC);
CREATE INDEX idx_sec_audit_org ON security_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_sec_audit_result_type ON security_audit_log(result, event_type);
