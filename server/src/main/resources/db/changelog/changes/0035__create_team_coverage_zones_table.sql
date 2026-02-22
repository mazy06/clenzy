-- Zones de couverture geographique des equipes
-- Une equipe peut couvrir plusieurs departements/arrondissements
CREATE TABLE team_coverage_zones (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL,
    department VARCHAR(3) NOT NULL,
    arrondissement VARCHAR(5),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, department, arrondissement),
    CONSTRAINT fk_tcz_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);
CREATE INDEX idx_tcz_team_id ON team_coverage_zones(team_id);
CREATE INDEX idx_tcz_department ON team_coverage_zones(department);
