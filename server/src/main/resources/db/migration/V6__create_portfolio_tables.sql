-- Migration V6: Création des tables de portefeuilles
-- Date: 2024-12-19

-- Table des portefeuilles
CREATE TABLE portfolios (
    id BIGSERIAL PRIMARY KEY,
    manager_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table des clients des portefeuilles
CREATE TABLE portfolio_clients (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT
);

-- Table des membres d'équipe des portefeuilles
CREATE TABLE portfolio_teams (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    team_member_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_team VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT
);

-- Index pour améliorer les performances
CREATE INDEX idx_portfolios_manager ON portfolios(manager_id);
CREATE INDEX idx_portfolios_active ON portfolios(is_active);
CREATE INDEX idx_portfolios_created_at ON portfolios(created_at);

CREATE INDEX idx_portfolio_clients_portfolio ON portfolio_clients(portfolio_id);
CREATE INDEX idx_portfolio_clients_client ON portfolio_clients(client_id);
CREATE INDEX idx_portfolio_clients_active ON portfolio_clients(is_active);

CREATE INDEX idx_portfolio_teams_portfolio ON portfolio_teams(portfolio_id);
CREATE INDEX idx_portfolio_teams_member ON portfolio_teams(team_member_id);
CREATE INDEX idx_portfolio_teams_active ON portfolio_teams(is_active);
CREATE INDEX idx_portfolio_teams_role ON portfolio_teams(role_in_team);

-- Contraintes de validation
ALTER TABLE portfolios ADD CONSTRAINT chk_portfolio_name_not_empty CHECK (name != '');
ALTER TABLE portfolio_teams ADD CONSTRAINT chk_role_in_team_valid CHECK (role_in_team IN ('TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR', 'LEADER'));

-- Contraintes d'unicité
ALTER TABLE portfolio_clients ADD CONSTRAINT uk_portfolio_client UNIQUE (portfolio_id, client_id);
ALTER TABLE portfolio_teams ADD CONSTRAINT uk_portfolio_team_member UNIQUE (portfolio_id, team_member_id);

-- Commentaires
COMMENT ON TABLE portfolios IS 'Portefeuilles clients des managers';
COMMENT ON TABLE portfolio_clients IS 'Clients (HOSTs) associés aux portefeuilles';
COMMENT ON TABLE portfolio_teams IS 'Membres d''équipe associés aux portefeuilles';
COMMENT ON COLUMN portfolios.manager_id IS 'ID du manager responsable du portefeuille';
COMMENT ON COLUMN portfolio_clients.client_id IS 'ID du client HOST';
COMMENT ON COLUMN portfolio_teams.team_member_id IS 'ID du membre d''équipe (TECHNICIAN, HOUSEKEEPER, SUPERVISOR)';
COMMENT ON COLUMN portfolio_teams.role_in_team IS 'Rôle du membre dans l''équipe du portefeuille';
