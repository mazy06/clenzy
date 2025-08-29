-- Script de récupération des keycloak_id perdus
-- À exécuter après que Keycloak soit redémarré et stable

-- Vérifier l'état actuel des utilisateurs
SELECT id, email, role, keycloak_id FROM users ORDER BY id;

-- Mettre à jour les keycloak_id avec les valeurs connues
UPDATE users SET keycloak_id = '6cdc8cc5-266f-4072-9c64-b087448fd21e' WHERE email = 'admin@clenzy.fr';
UPDATE users SET keycloak_id = 'ee29b505-15a2-4fc7-8b2c-0da5650a45be' WHERE email = 'host2@clenzy.fr';
UPDATE users SET keycloak_id = '24bf70ff-33cd-4fbb-964d-99e6b6006408' WHERE email = 'host@clenzy.fr';
UPDATE users SET keycloak_id = 'c50f889a-673c-4213-9817-a7bcd2bf738e' WHERE email = 'housekeeper2@clenzy.fr';
UPDATE users SET keycloak_id = '42dd6d2e-1680-4859-bfbd-b2b73615e2b2' WHERE email = 'housekeeper@clenzy.fr';
UPDATE users SET keycloak_id = '42b95ebe-c4d3-4d90-8b2d-3ca5361b3614' WHERE email = 'khaoula@clenzy.fr';
UPDATE users SET keycloak_id = '11b1cc79-cbe8-4037-8c53-71ff2f3596dc' WHERE email = 'superviseur@clenzy.fr';
UPDATE users SET keycloak_id = '69073956-359c-4cd3-8bfd-43bdc4a44d10' WHERE email = 'technicien2@clenzy.fr';
UPDATE users SET keycloak_id = '9e172107-7d66-41ef-8cff-813066cfdaf0' WHERE email = 'technicien@clenzy.fr';

-- Vérifier que les mises à jour ont été appliquées
SELECT id, email, role, keycloak_id FROM users ORDER BY id;

-- Vérifier qu'il n'y a plus d'utilisateurs sans keycloak_id
SELECT COUNT(*) as users_without_keycloak_id FROM users WHERE keycloak_id IS NULL OR keycloak_id = '';
