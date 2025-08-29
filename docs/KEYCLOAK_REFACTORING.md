# 🔄 Refactorisation vers l'Architecture Keycloak

## 📋 Vue d'ensemble

Cette refactorisation transforme l'architecture de gestion des utilisateurs pour utiliser **Keycloak comme source unique de vérité** pour l'identité et l'authentification, éliminant ainsi les problèmes de synchronisation bidirectionnelle.

## 🎯 Objectifs

- **Éliminer la synchronisation bidirectionnelle** entre la base métier et Keycloak
- **Centraliser la gestion des identités** dans Keycloak
- **Simplifier la maintenance** et réduire les risques d'erreur
- **Améliorer la sécurité** en évitant la duplication des mots de passe
- **Faciliter l'évolution** vers d'autres fournisseurs d'identité

## 🏗️ Nouvelle Architecture

### Avant (Architecture de synchronisation)
```
Base Métier ←→ UserSyncService ←→ Keycloak
     ↑              ↑              ↑
  Users        Synchronisation  Identity
  (Password)      Bidirection   (Password)
```

### Après (Architecture Keycloak-first)
```
Keycloak (Source unique) → KeycloakService → NewUserService → Base Métier
     ↑                        ↑                ↑              ↑
  Identity               API Client      Business Logic    Business Data
  (Password)            (Admin)         (Orchestration)   (Role, Status)
```

## 🔧 Composants créés

### 1. KeycloakService
- **Responsabilité** : Interface avec Keycloak pour toutes les opérations d'identité
- **Méthodes** : `getUser()`, `createUser()`, `updateUser()`, `deleteUser()`, etc.
- **Avantages** : Centralisation, gestion d'erreur robuste, pas de duplication

### 2. NewUserService
- **Responsabilité** : Orchestration entre Keycloak et la base métier
- **Méthodes** : `getUserProfile()`, `createUser()`, `updateUser()`, etc.
- **Avantages** : Logique métier centralisée, fusion des données

### 3. NewUserController
- **Responsabilité** : API REST pour la gestion des utilisateurs
- **Endpoint** : `/api/v2/users/*`
- **Avantages** : Interface claire, validation, gestion d'erreur

## 📊 Changements dans la base de données

### Table `users` refactorisée
```sql
-- Colonnes supprimées (gérées par Keycloak)
ALTER TABLE users DROP COLUMN password;
ALTER TABLE users DROP COLUMN email;
ALTER TABLE users DROP COLUMN first_name;
ALTER TABLE users DROP COLUMN last_name;

-- Colonnes renommées
ALTER TABLE users RENAME COLUMN keycloak_id TO external_id;

-- Nouvelles colonnes
ALTER TABLE users ADD COLUMN identity_source VARCHAR(20) DEFAULT 'keycloak';
```

### Données conservées
- `external_id` : ID Keycloak (anciennement `keycloak_id`)
- `role` : Rôle métier
- `status` : Statut métier
- `phone_number` : Numéro de téléphone
- `profile_picture_url` : URL de la photo de profil
- `created_at` / `updated_at` : Timestamps métier

## 🚀 Migration progressive

### Phase 1 : Préparation ✅
- [x] Création du `KeycloakService`
- [x] Création du `NewUserService`
- [x] Création du `NewUserController`
- [x] Création des DTOs nécessaires
- [x] Migration SQL V8

### Phase 2 : Tests et validation
- [ ] Tests des nouveaux endpoints
- [ ] Validation de la création d'utilisateurs
- [ ] Validation de la mise à jour d'utilisateurs
- [ ] Tests de performance

### Phase 3 : Migration des services existants
- [ ] Mise à jour du `UserService` existant
- [ ] Mise à jour des contrôleurs existants
- [ ] Tests d'intégration

### Phase 4 : Nettoyage
- [ ] Suppression de l'ancien `UserSyncService`
- [ ] Suppression des anciens endpoints
- [ ] Nettoyage des migrations obsolètes

## 🔍 Utilisation des nouveaux services

### Création d'un utilisateur
```java
@Autowired
private NewUserService newUserService;

CreateUserDto createUserDto = new CreateUserDto();
createUserDto.setFirstName("John");
createUserDto.setLastName("Doe");
createUserDto.setEmail("john.doe@example.com");
createUserDto.setPassword("securePassword123");
createUserDto.setRole("HOST");

UserProfileDto newUser = newUserService.createUser(createUserDto);
```

### Récupération d'un profil utilisateur
```java
UserProfileDto userProfile = newUserService.getUserProfile("keycloak-user-id");
// Combine automatiquement les données Keycloak et métier
```

## ⚠️ Points d'attention

### 1. Gestion des erreurs
- Les erreurs Keycloak sont capturées et transformées en exceptions métier
- Fallback vers les données locales en cas d'indisponibilité de Keycloak

### 2. Performance
- Les appels Keycloak sont optimisés (pas de requêtes multiples)
- Cache possible pour les données fréquemment utilisées

### 3. Sécurité
- Aucun mot de passe stocké en base métier
- Authentification gérée entièrement par Keycloak
- Rôles et permissions centralisés

## 🧪 Tests

### Tests unitaires
```bash
# Tests du KeycloakService
mvn test -Dtest=KeycloakServiceTest

# Tests du NewUserService
mvn test -Dtest=NewUserServiceTest
```

### Tests d'intégration
```bash
# Tests des endpoints
mvn test -Dtest=NewUserControllerIntegrationTest
```

## 📚 Documentation API

### Endpoints disponibles
- `GET /api/v2/users` - Liste des utilisateurs
- `GET /api/v2/users/{id}` - Profil d'un utilisateur
- `POST /api/v2/users` - Création d'utilisateur
- `PUT /api/v2/users/{id}` - Mise à jour d'utilisateur
- `DELETE /api/v2/users/{id}` - Suppression d'utilisateur
- `POST /api/v2/users/{id}/reset-password` - Réinitialisation du mot de passe

## 🔮 Évolutions futures

### 1. Support multi-fournisseurs
- Ajout de Cognito AWS
- Support des fournisseurs OAuth2 externes
- Authentification locale en fallback

### 2. Améliorations de performance
- Cache Redis pour les données Keycloak
- Pagination des listes d'utilisateurs
- Requêtes optimisées

### 3. Fonctionnalités avancées
- Gestion des groupes Keycloak
- Synchronisation des attributs personnalisés
- Audit trail des modifications

## 📞 Support et maintenance

### En cas de problème
1. Vérifier les logs Keycloak
2. Contrôler la connectivité réseau
3. Valider la configuration des clients Keycloak
4. Consulter les métriques de performance

### Maintenance préventive
- Surveillance des performances Keycloak
- Sauvegarde régulière des configurations
- Mise à jour des versions Keycloak
- Tests de récupération après sinistre
