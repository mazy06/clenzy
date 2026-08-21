-- Disponibilites d'un prestataire (equipe classique ou equipe PERSONNELLE d'un
-- intervenant independant).
--
-- Le moteur d'affectation ne savait jusqu'ici qu'une chose : cette equipe
-- a-t-elle deja une intervention sur le creneau. Il proposait donc des missions
-- le dimanche a 6 h a qui ne travaille que du lundi au vendredi — « libre » et
-- « disponible » ne sont pas la meme chose.
--
-- DEUX tables et non une seule a discriminant : un creneau hebdomadaire (« le
-- mardi de 9 h a 17 h ») et une absence datee (« du 12 au 19 aout ») n'ont ni
-- les memes colonnes ni la meme duree de vie. Les melanger obligerait a laisser
-- la moitie des colonnes vides sur chaque ligne.

CREATE TABLE IF NOT EXISTS team_weekly_availability (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT,
    team_id         BIGINT      NOT NULL,
    -- ISO-8601 : 1 = lundi … 7 = dimanche, comme java.time.DayOfWeek.
    day_of_week     SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time      TIME        NOT NULL,
    end_time        TIME        NOT NULL,
    created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_weekly_availability_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
    CONSTRAINT chk_weekly_availability_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_weekly_availability_team ON team_weekly_availability (team_id);

CREATE TABLE IF NOT EXISTS team_absences (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT,
    team_id         BIGINT      NOT NULL,
    -- Bornes INCLUSES : une absence « du 12 au 19 » couvre le 19 entier.
    start_date      DATE        NOT NULL,
    end_date        DATE        NOT NULL,
    reason          VARCHAR(200),
    created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_absences_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
    CONSTRAINT chk_absences_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_absences_team ON team_absences (team_id);
CREATE INDEX IF NOT EXISTS idx_absences_dates ON team_absences (team_id, start_date, end_date);

COMMENT ON TABLE team_weekly_availability IS
    'Creneaux hebdomadaires recurrents d''un prestataire. Aucune ligne = disponible par defaut.';
COMMENT ON TABLE team_absences IS
    'Absences datees d''un prestataire (conges, indisponibilites). Bornes incluses.';
