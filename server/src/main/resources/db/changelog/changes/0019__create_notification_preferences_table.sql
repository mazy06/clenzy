-- V23: Ajout du champ notification_key sur notifications + table notification_preferences

-- Ajouter la colonne notification_key a la table notifications (nullable pour backward compatibility)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_key VARCHAR(60);
CREATE INDEX IF NOT EXISTS idx_notification_key ON notifications(notification_key);

-- Creer la table notification_preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    notification_key VARCHAR(60) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uk_notif_pref_user_key UNIQUE (user_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_notif_pref_user_id ON notification_preferences(user_id);
