-- Horaires de sollicitation et consentement explicite à l'astreinte critique.
-- Aucun calendrier de disponibilité supplémentaire : celui des prestataires reste canonique.
CREATE TABLE service_assignment_contact_preferences (
    user_id bigint PRIMARY KEY REFERENCES users(id),
    from_hour integer NOT NULL CHECK (from_hour>=0 AND from_hour<24),
    until_hour integer NOT NULL CHECK (until_hour>from_hour AND until_hour<=24),
    critical_on_call boolean NOT NULL DEFAULT false
);
