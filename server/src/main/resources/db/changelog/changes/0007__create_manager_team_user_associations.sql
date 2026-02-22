-- Créer la table pour les associations manager-équipe
CREATE TABLE IF NOT EXISTS manager_teams (
    id BIGSERIAL PRIMARY KEY,
    manager_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_id, team_id),
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Créer la table pour les associations manager-utilisateur
CREATE TABLE IF NOT EXISTS manager_users (
    id BIGSERIAL PRIMARY KEY,
    manager_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_id, user_id),
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_manager_teams_manager_id ON manager_teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_teams_team_id ON manager_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_manager_teams_active ON manager_teams(is_active);

CREATE INDEX IF NOT EXISTS idx_manager_users_manager_id ON manager_users(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_users_user_id ON manager_users(user_id);
CREATE INDEX IF NOT EXISTS idx_manager_users_active ON manager_users(is_active);
