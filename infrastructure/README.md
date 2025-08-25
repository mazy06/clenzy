# 🐳 Configuration Docker Clenzy

Ce dossier contient toutes les configurations Docker pour les différents environnements de la plateforme Clenzy.

## 📁 Structure des Fichiers

```
infrastructure/
├── docker-compose.yml          # Configuration principale (développement par défaut)
├── docker-compose.dev.yml      # Configuration de développement
├── docker-compose.prod.yml     # Configuration de production
├── start-dev.sh               # Script de démarrage développement
├── start-prod.sh              # Script de démarrage production
├── postgres-data/             # Données PostgreSQL persistantes
├── keycloak/                  # Configuration Keycloak
└── README.md                  # Ce fichier
```

## 🚀 Démarrage Rapide

### Développement

#### **Mode Interactif (Logs en Direct)**
```bash
# Depuis le dossier racine du projet
cd infrastructure
./start-dev.sh

# Ou manuellement
docker-compose -f docker-compose.dev.yml up --build
```

#### **Mode Détaché (En Arrière-plan)**
```bash
cd infrastructure
./start-dev-detached.sh

# Ou manuellement
docker-compose -f docker-compose.dev.yml up -d --build
```

### Production

#### **Mode Interactif (Logs en Direct)**
```bash
cd infrastructure
./start-prod.sh

# Ou manuellement
docker-compose -f docker-compose.prod.yml up --build
```

#### **Mode Détaché (En Arrière-plan)**
```bash
cd infrastructure
./start-prod-detached.sh

# Ou manuellement
docker-compose -f docker-compose.prod.yml up -d --build
```

## 🔧 Profils Disponibles

### 1. **Développement** (`docker-compose.dev.yml`)
- **Ports** : Frontend (3000), Backend (8084), DB (5433), Keycloak (8083)
- **Volumes** : Code source monté pour le hot-reload
- **Base de données** : `clenzy_dev`
- **Persistance** : `./postgres-data/` (local)

### 2. **Production** (`docker-compose.prod.yml`)
- **Ports** : Frontend (80/443), Backend (8080), DB (5432), Keycloak (8081)
- **Volumes** : Images construites, pas de code source
- **Base de données** : `clenzy_prod`
- **Persistance** : `./postgres-data/` (local)
- **SSL** : Configuration HTTPS avec Nginx

### 3. **Principal** (`docker-compose.yml`)
- **Ports** : Frontend (3000), Backend (8080), DB (8082), Keycloak (8081)
- **Base de données** : `clenzy`
- **Persistance** : `./postgres-data/` (local)

## 💾 Persistance des Données

### Solution Implémentée : Volume Local
```yaml
volumes:
  - ./postgres-data:/var/lib/postgresql/data
```

**Avantages** :
- ✅ **Données persistantes** même après redémarrage Docker
- ✅ **Sauvegarde facile** (copie du dossier)
- ✅ **Transparence** (vous voyez les fichiers de données)
- ✅ **Contrôle total** sur la persistance

**Localisation** : `infrastructure/postgres-data/`

## 🛠️ Commandes Utiles

### Vérifier le statut
```bash
# Développement
docker-compose -f docker-compose.dev.yml ps

# Production
docker-compose -f docker-compose.prod.yml ps

# Principal
docker-compose ps
```

### Arrêter les services
```bash
# Développement
docker-compose -f docker-compose.dev.yml down

# Production
docker-compose -f docker-compose.prod.yml down

# Principal
docker-compose down
```

### Voir les logs
```bash
# Développement
docker-compose -f docker-compose.dev.yml logs -f

# Production
docker-compose -f docker-compose.prod.yml logs -f
```

### Reconstruire les images
```bash
# Développement
docker-compose -f docker-compose.dev.yml build --no-cache

# Production
docker-compose -f docker-compose.prod.yml build --no-cache
```

## 🔐 Variables d'Environnement

### Développement
Les variables sont définies directement dans `docker-compose.dev.yml`

### Production
Les variables doivent être définies dans l'environnement :
```bash
export POSTGRES_PASSWORD="votre_mot_de_passe"
export KEYCLOAK_HOSTNAME="votre_domaine"
export KEYCLOAK_CLIENT_SECRET="votre_secret"
export JWT_SECRET="votre_jwt_secret"
export DOMAIN="votre_domaine"
export KEYCLOAK_ADMIN="admin"
export KEYCLOAK_ADMIN_PASSWORD="votre_admin_password"
export KEYCLOAK_DB_PASSWORD="votre_db_password"
```

## 🚨 Dépannage

### Problème de ports
Si un port est déjà utilisé :
```bash
# Vérifier les ports utilisés
lsof -i :3000
lsof -i :8080
lsof -i :5432

# Arrêter le processus ou changer le port dans la config
```

### Problème de permissions
```bash
# Rendre les scripts exécutables
chmod +x start-dev.sh start-prod.sh

# Vérifier les permissions du dossier postgres-data
ls -la postgres-data/
```

### Problème de persistance
```bash
# Vérifier que le dossier existe
ls -la postgres-data/

# Recréer le dossier si nécessaire
mkdir -p postgres-data
```

## 📝 Notes Importantes

1. **Toujours utiliser les scripts** `start-dev.sh` ou `start-prod.sh` pour un démarrage propre
2. **Arrêter tous les services** avant de changer de profil
3. **Les données sont persistantes** dans `./postgres-data/`
4. **Vérifier les variables d'environnement** pour la production
5. **Utiliser `docker-compose down`** pour arrêter proprement les services

## 🔄 Migration des Données

Si vous aviez des données dans l'ancien volume Docker :
```bash
# Créer une sauvegarde
docker exec clenzy-postgres pg_dump -U clenzy clenzy > backup.sql

# Restaurer dans le nouveau volume
docker exec -i clenzy-postgres psql -U clenzy clenzy < backup.sql
```
