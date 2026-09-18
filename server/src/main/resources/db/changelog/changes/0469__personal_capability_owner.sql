-- Baitly : une identité personnelle possède un seul profil de capacités,
-- quel que soit le nombre de ses rattachements opérationnels aux organisations.
CREATE TABLE personal_capability_owners (
    user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    team_id bigint NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE
);
INSERT INTO personal_capability_owners(user_id,team_id)
SELECT t.personal_user_id,min(t.id) FROM teams t JOIN users u ON u.id=t.personal_user_id
GROUP BY t.personal_user_id;
