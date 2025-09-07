-- Création de la table manager_properties pour gérer l'assignation spécifique des propriétés aux managers
-- Une propriété peut être assignée à plusieurs managers, mais chaque assignation est unique
CREATE TABLE manager_properties (
    id BIGSERIAL PRIMARY KEY,
    manager_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes d'unicité pour éviter les doublons
    UNIQUE(manager_id, property_id),
    
    -- Clés étrangères
    CONSTRAINT fk_manager_properties_manager 
        FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_manager_properties_property 
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX idx_manager_properties_manager_id ON manager_properties(manager_id);
CREATE INDEX idx_manager_properties_property_id ON manager_properties(property_id);

-- Commentaires
COMMENT ON TABLE manager_properties IS 'Table pour gérer l''assignation spécifique des propriétés aux managers';
COMMENT ON COLUMN manager_properties.manager_id IS 'ID du manager qui gère la propriété';
COMMENT ON COLUMN manager_properties.property_id IS 'ID de la propriété assignée';
COMMENT ON COLUMN manager_properties.assigned_at IS 'Date et heure d''assignation de la propriété';
COMMENT ON COLUMN manager_properties.notes IS 'Notes optionnelles sur l''assignation';
