-- V37: Create property_teams table for property-to-team default mapping
-- One property can have at most one default team (UNIQUE on property_id)

CREATE TABLE property_teams (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id),
    CONSTRAINT fk_property_teams_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT fk_property_teams_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX idx_property_teams_property_id ON property_teams(property_id);
CREATE INDEX idx_property_teams_team_id ON property_teams(team_id);
