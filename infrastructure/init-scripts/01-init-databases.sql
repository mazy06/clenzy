-- Script d'initialisation des bases de données pour Clenzy
-- Ce script s'exécute automatiquement au premier démarrage de PostgreSQL

-- Créer la base de données pour Keycloak (seulement si elle n'existe pas)
SELECT 'CREATE DATABASE keycloak_dev' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak_dev')\gexec

-- La base clenzy_dev est créée automatiquement par POSTGRES_DB
-- Pas besoin de la créer ici

-- Accorder tous les privilèges à l'utilisateur clenzy
GRANT ALL PRIVILEGES ON DATABASE keycloak_dev TO clenzy;
GRANT ALL PRIVILEGES ON DATABASE clenzy_dev TO clenzy;

-- Se connecter à la base keycloak_dev pour créer les extensions nécessaires
\c keycloak_dev;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Se connecter à la base clenzy_dev pour créer les extensions nécessaires
\c clenzy_dev;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Message de confirmation
SELECT 'Bases de données initialisées avec succès!' as status;
