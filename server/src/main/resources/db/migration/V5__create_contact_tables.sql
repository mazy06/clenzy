-- Migration V5: Création des tables de contact
-- Date: 2024-12-19

-- Table des messages de contact
CREATE TABLE contact_messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id BIGINT REFERENCES properties(id) ON DELETE SET NULL,
    message_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OUVERT',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table des pièces jointes
CREATE TABLE contact_attachments (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_contact_messages_sender ON contact_messages(sender_id);
CREATE INDEX idx_contact_messages_recipient ON contact_messages(recipient_id);
CREATE INDEX idx_contact_messages_property ON contact_messages(property_id);
CREATE INDEX idx_contact_messages_status ON contact_messages(status);
CREATE INDEX idx_contact_messages_priority ON contact_messages(priority);
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at);

CREATE INDEX idx_contact_attachments_message ON contact_attachments(message_id);

-- Contraintes de validation
ALTER TABLE contact_messages 
ADD CONSTRAINT chk_message_type 
CHECK (message_type IN ('QUESTION_FACTURATION', 'DEMANDE_ADMINISTRATIVE', 'CLARIFICATION_CONTRAT', 
                       'QUESTION_PORTEFEUILLE', 'SUGGESTION', 'PROBLEME_COMMUNICATION', 
                       'DEMANDE_RENDEZ_VOUS', 'REMARQUE_FEEDBACK', 'QUESTION_GENERALE'));

ALTER TABLE contact_messages 
ADD CONSTRAINT chk_priority 
CHECK (priority IN ('BASSE', 'MOYENNE', 'HAUTE', 'URGENTE'));

ALTER TABLE contact_messages 
ADD CONSTRAINT chk_status 
CHECK (status IN ('OUVERT', 'EN_COURS', 'RESOLU', 'FERME'));

-- Commentaires pour la documentation
COMMENT ON TABLE contact_messages IS 'Table des messages de contact entre utilisateurs';
COMMENT ON TABLE contact_attachments IS 'Table des pièces jointes des messages de contact';
COMMENT ON COLUMN contact_messages.message_type IS 'Type de message (QUESTION_FACTURATION, DEMANDE_ADMINISTRATIVE, etc.)';
COMMENT ON COLUMN contact_messages.priority IS 'Priorité automatique basée sur le type de message';
COMMENT ON COLUMN contact_messages.status IS 'Statut du message (OUVERT, EN_COURS, RESOLU, FERME)';
