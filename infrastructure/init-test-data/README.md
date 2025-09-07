# Scripts de Données de Test

Ce dossier contient les scripts SQL pour alimenter la base de données avec des données de test pour le développement et les tests.

## 📁 Fichiers disponibles

### 1. `seed_test_users.sql`
**Description** : Crée des utilisateurs de test pour tous les rôles (sauf ADMIN)

**Utilisateurs créés** :
- **MANAGER** : 2 utilisateurs (manager1@clenzy.fr, manager2@clenzy.fr)
- **HOST** : 2 utilisateurs (host1@clenzy.fr, host2@clenzy.fr)
- **SUPERVISOR** : 2 utilisateurs (supervisor1@clenzy.fr, supervisor2@clenzy.fr)
- **TECHNICIAN** : 2 utilisateurs (technician1@clenzy.fr, technician2@clenzy.fr)
- **HOUSEKEEPER** : 2 utilisateurs (housekeeper1@clenzy.fr, housekeeper2@clenzy.fr)

**Caractéristiques** :
- Mot de passe uniforme : `password` (hash BCrypt)
- Emails vérifiés
- Téléphones français réalistes
- Avatars générés automatiquement
- Timestamps réalistes

### 2. `seed_teams.sql`
**Description** : Crée des équipes de test avec leurs membres

**Équipes créées** :
- **Équipe Nettoyage Premium** (CLEANING)
  - Leader : Housekeeper Un
  - Member : Housekeeper Deux
- **Équipe Maintenance Technique** (MAINTENANCE)
  - Leader : Technician Un
  - Member : Technician Deux

### 3. `seed_properties.sql`
**Description** : Crée des logements de test répartis entre les utilisateurs HOST

**Logements créés** :
- **Host Un** (host1@clenzy.fr) : 5 logements
  - Appartement moderne - Paris (Champs-Élysées) - 120€/nuit
  - Studio cosy - Paris (Montmartre) - 85€/nuit
  - Villa de luxe - Nice (Côte d'Azur) - 350€/nuit
  - Loft industriel - Lyon - 95€/nuit (EN MAINTENANCE)
  - Chalet traditionnel - Chamonix - 180€/nuit
- **Host Deux** (host2@clenzy.fr) : 4 logements
  - Maison de ville - Bordeaux - 110€/nuit
  - Appartement design - Marseille - 75€/nuit
  - Cottage breton - Perros-Guirec - 90€/nuit
  - Chambre d'hôte - Aix-en-Provence - 65€/nuit (INACTIF)

## 🚀 Utilisation

### Prérequis
- Docker Compose démarré
- Base de données PostgreSQL accessible

### Exécution des scripts

```bash
# Se placer dans le dossier infrastructure
cd infrastructure

# Exécuter le script des utilisateurs
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev < init-test-data/seed_test_users.sql

# Exécuter le script des équipes
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev < init-test-data/seed_teams.sql

# Exécuter le script des logements
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev < init-test-data/seed_properties.sql
```

### Exécution en une seule commande
```bash
# Exécuter tous les scripts
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev < init-test-data/seed_test_users.sql && \
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev < init-test-data/seed_teams.sql && \
docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev < init-test-data/seed_properties.sql
```

## 📊 Données créées

### Utilisateurs
- **Total** : 11 utilisateurs (10 nouveaux + 1 admin mis à jour)
- **Rôles** : Tous les rôles sauf ADMIN (qui existe déjà)
- **Mot de passe** : `password` pour tous

### Équipes
- **Total** : 2 équipes
- **Membres** : 4 membres au total (2 par équipe)
- **Types** : CLEANING et MAINTENANCE

### Logements
- **Total** : 9 logements
- **Propriétaires** : 2 HOST (5 + 4 logements)
- **Types** : 8 types différents (APARTMENT, STUDIO, VILLA, LOFT, CHALET, HOUSE, COTTAGE, GUEST_ROOM)
- **Statuts** : 7 ACTIF, 1 INACTIF, 1 EN MAINTENANCE
- **Prix** : De 65€ à 350€/nuit

## 🔐 Informations de connexion

### Base de données
- **Host** : localhost:5433
- **Database** : clenzy_dev
- **User** : clenzy
- **Password** : clenzy123

### Utilisateurs de test
- **Email** : [role][numéro]@clenzy.fr (ex: manager1@clenzy.fr)
- **Mot de passe** : password
- **Keycloak ID** : keycloak-[role]-[numéro] (ex: keycloak-manager-001)

## ⚠️ Notes importantes

1. **Keycloak** : Les utilisateurs ont des `keycloak_id` factices. Pour une intégration complète, créer les utilisateurs correspondants dans Keycloak.

2. **Données de test** : Ces scripts sont destinés au développement et aux tests uniquement.

3. **Sécurité** : Le mot de passe `password` est utilisé uniquement pour faciliter les tests.

4. **Ordre d'exécution** : 
   - `seed_test_users.sql` (utilisateurs)
   - `seed_teams.sql` (équipes - référencent les utilisateurs)
   - `seed_properties.sql` (logements - référencent les utilisateurs HOST)

## 🧹 Nettoyage

Pour supprimer les données de test :

```sql
-- Supprimer les logements de test
DELETE FROM properties WHERE owner_id IN (SELECT id FROM users WHERE keycloak_id LIKE 'keycloak-host-%');

-- Supprimer les équipes et leurs membres
DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE name LIKE 'Équipe%');
DELETE FROM teams WHERE name LIKE 'Équipe%';

-- Supprimer les utilisateurs de test
DELETE FROM users WHERE keycloak_id LIKE 'keycloak-%';
```
