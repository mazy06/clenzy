CREATE TABLE incidents (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(10) NOT NULL DEFAULT 'P1',
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    service_name VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_minutes DECIMAL(8,2),
    auto_detected BOOLEAN NOT NULL DEFAULT TRUE,
    auto_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_opened_at ON incidents(opened_at);
CREATE INDEX idx_incidents_type ON incidents(type);
