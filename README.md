# 🏠 Clenzy - Plateforme de Gestion Airbnb

Clenzy est une plateforme complète de gestion de propriétés Airbnb, conçue pour simplifier la gestion des locations, des interventions de maintenance et du nettoyage.

## ✨ Fonctionnalités

### 🎯 Tableau de bord
- Vue d'ensemble des statistiques clés
- Activités récentes et notifications
- Métriques de performance et satisfaction

### 🏘️ Gestion des propriétés
- Catalogue complet des propriétés
- Filtres par type, statut et localisation
- Gestion des photos et descriptions
- Suivi des disponibilités

### 🔧 Demandes de service
- Création et suivi des demandes
- Gestion des priorités et échéances
- Assignation aux équipes
- Historique complet

### 🛠️ Interventions
- Planification des interventions
- Suivi en temps réel
- Gestion des équipes
- Rapports de fin d'intervention

### 👥 Gestion des équipes
- Organisation des équipes par spécialité
- Gestion des disponibilités
- Évaluation des performances
- Planning des interventions

### ⚙️ Paramètres
- Configuration des notifications
- Paramètres de sécurité
- Préférences d'affichage
- Configuration entreprise

## 🚀 Technologies utilisées

### Backend
- **Spring Boot 3.x** - Framework Java
- **Spring Data JPA** - Persistance des données
- **Spring Security** - Sécurité et authentification
- **Keycloak** - Gestion des identités et accès
- **PostgreSQL** - Base de données principale
- **H2** - Base de données de développement
- **Maven** - Gestion des dépendances

### Frontend
- **React 18** - Interface utilisateur
- **TypeScript** - Typage statique
- **Material-UI (MUI)** - Composants UI
- **React Router** - Navigation
- **Keycloak JS** - Intégration authentification
- **Vite** - Build tool

### Infrastructure
- **Docker** - Conteneurisation
- **Docker Compose** - Orchestration multi-services
- **Nginx** - Serveur web frontend
- **Keycloak** - Serveur d'authentification

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Keycloak      │
│   React + MUI   │◄──►│   Spring Boot   │◄──►│   Auth Server   │
│   Port 3000     │    │   Port 8084     │    │   Port 8083     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   Port 5433     │
                       └─────────────────┘
```

## 🚀 Installation et démarrage

### Prérequis
- Docker et Docker Compose
- Java 17+ (pour le développement local)
- Node.js 18+ (pour le développement frontend)

### Démarrage rapide

1. **Cloner le repository**
```bash
git clone <repository-url>
cd clenzy
```

2. **Démarrer l'infrastructure**
```bash
cd infrastructure
docker compose up -d
```

3. **Accéder à l'application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8084
- Keycloak: http://localhost:8083
- Swagger UI: http://localhost:8084/swagger-ui.html

### Configuration Keycloak

1. Accéder à Keycloak: http://localhost:8083
2. Se connecter avec `admin/admin`
3. Importer le realm depuis `clenzy-infra/keycloak/realm-clenzy.json`
4. Récupérer le client secret de `clenzy-web`
5. Mettre à jour `docker-compose.yml` avec le secret

## 🔧 Développement

### Backend

```bash
cd server
mvn spring-boot:run
```

**Profils disponibles:**
- `dev` : Base H2, sécurité désactivée
- `prod` : PostgreSQL, Keycloak, sécurité activée

### Frontend

```bash
cd client
npm install
npm run dev
```

### Structure des dossiers

```
clenzy/
├── server/                 # Backend Spring Boot
│   ├── src/main/java/
│   │   ├── controller/    # Contrôleurs REST
│   │   ├── service/       # Logique métier
│   │   ├── repository/    # Accès aux données
│   │   ├── model/         # Entités JPA
│   │   ├── dto/          # Objets de transfert
│   │   └── config/       # Configuration
│   └── src/main/resources/
├── client/                # Frontend React
│   ├── src/
│   │   ├── modules/      # Composants principaux
│   │   ├── theme/        # Thème Material-UI
│   │   └── keycloak.ts   # Configuration Keycloak
│   └── public/
clenzy-infra/              # Infrastructure (projet séparé)
    ├── docker-compose.dev.yml
    ├── docker-compose.prod.yml
    ├── docker-compose.staging.yml
    └── keycloak/
```

## 🔐 Authentification

L'application utilise Keycloak pour la gestion des identités :

- **Realm**: `clenzy`
- **Clients**: 
  - `clenzy-api` (backend)
  - `clenzy-web` (frontend)
- **Rôles**: ADMIN, MANAGER, HOST, TECHNICIAN, HOUSEKEEPER, SUPERVISOR

### Utilisateurs de test
- **admin@clenzy.fr** / `admin` - Rôle ADMIN
- **host@clenzy.fr** / `host` - Rôle HOST
- **technician@clenzy.fr** / `technician` - Rôle TECHNICIAN

## 📊 API REST

### Endpoints principaux

- `GET /api/me` - Informations utilisateur connecté
- `GET /api/properties` - Liste des propriétés
- `GET /api/service-requests` - Demandes de service
- `GET /api/interventions` - Interventions
- `GET /api/teams` - Équipes

### Documentation API
- Swagger UI: http://localhost:8084/swagger-ui.html
- OpenAPI JSON: http://localhost:8084/v3/api-docs

## 🎨 Interface utilisateur

### Design System
- **Thème**: Material-UI personnalisé
- **Couleurs**: Palette Clenzy (bleu professionnel + orange)
- **Typographie**: Inter (moderne et lisible)
- **Responsive**: Mobile-first design

### Composants principaux
- Navigation latérale avec menu principal
- Cartes de statistiques avec tendances
- Tableaux de données avec filtres
- Formulaires de création/édition
- Modales de confirmation

## 🧪 Tests

### Backend
```bash
cd server
mvn test
```

### Frontend
```bash
cd client
npm test
```

## 📦 Déploiement

### Production
```bash
# Build des images
docker compose -f docker-compose.prod.yml build

# Démarrage
docker compose -f docker-compose.prod.yml up -d
```

### Variables d'environnement
- `SPRING_PROFILES_ACTIVE=prod`
- `KEYCLOAK_CLIENT_SECRET=<secret>`
- `DATABASE_URL=<postgres-url>`

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🆘 Support

Pour toute question ou problème :
- Créer une issue sur GitHub
- Contacter l'équipe de développement
- Consulter la documentation technique

---

**Clenzy** - Simplifiez la gestion de vos propriétés Airbnb 🏠✨
