-- Ajout des champs geographiques aux proprietes
-- department: code departement (ex: "75", "2A", "971")
-- arrondissement: code arrondissement pour Paris/Lyon/Marseille (ex: "75101")
ALTER TABLE properties ADD COLUMN department VARCHAR(3);
ALTER TABLE properties ADD COLUMN arrondissement VARCHAR(5);
CREATE INDEX idx_properties_department ON properties(department);
