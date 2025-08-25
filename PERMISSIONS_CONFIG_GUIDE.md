# 🔧 Guide de Configuration des Permissions

## 📋 Vue d'ensemble

Le système de configuration des permissions permet aux administrateurs de **modifier les permissions des rôles en temps réel** et de **persister ces changements** pour qu'ils affectent immédiatement l'interface utilisateur.

## 🎯 Fonctionnalités

### ✅ **Configuration des Rôles**
- **Sélection du rôle** à configurer (ADMIN, MANAGER, HOST, TECHNICIAN, HOUSEKEEPER, SUPERVISOR)
- **Modification des permissions** par clic sur les chips
- **Réinitialisation** des permissions aux valeurs par défaut
- **Sauvegarde** des modifications avec persistance côté serveur

### ✅ **Interface Utilisateur Améliorée**
- **PageHeader** avec titre et boutons d'action organisés
- **Boutons d'action** : Réinitialiser et Sauvegarder
- **Système d'onglets** pour organiser les fonctionnalités
- **Indicateurs visuels** du statut des modifications
- **Notifications** de succès/erreur lors de la sauvegarde

### ✅ **Système d'Onglets**
- **Onglet 1** : ⚙️ Édition des Permissions - Configuration et modification des permissions
- **Onglet 2** : 🧪 Démonstration des Effets - Visualisation des impacts des permissions

### ✅ **Effets en Temps Réel**
- **Interface qui se met à jour** automatiquement selon les permissions
- **Menus qui apparaissent/disparaissent** selon les permissions
- **Composants qui s'adaptent** aux permissions actuelles
- **Démonstration visuelle** des effets des permissions

### ✅ **Sécurité et Validation**
- **Permissions validées** côté serveur
- **Accès restreint** aux administrateurs uniquement
- **Cache intelligent** pour optimiser les performances

## 🚀 Utilisation

### 1. **Accéder à la Configuration**
```
Menu: Roles & Permissions
Route: /permissions-test
```

### 2. **Sélectionner un Rôle**
- Cliquer sur le chip du rôle à configurer
- Le rôle sélectionné est mis en évidence
- Les permissions actuelles du rôle s'affichent

### 3. **Naviguer entre les Onglets**
- **Onglet "⚙️ Édition des Permissions"** : Pour modifier les permissions
- **Onglet "🧪 Démonstration des Effets"** : Pour voir les impacts

### 4. **Modifier les Permissions (Onglet 1)**
- **Cliquer sur une permission** pour l'activer/désactiver
- **Permissions actives** : Chips verts avec ✅
- **Permissions inactives** : Chips gris avec ❌
- **Changements appliqués** immédiatement

### 5. **Visualiser les Effets (Onglet 2)**
- **Démonstration en temps réel** des impacts des permissions
- **Affichage des menus** accessibles/inaccessibles
- **Explication des restrictions** selon les permissions

### 6. **Gérer les Modifications**
- **Bouton "🔄 Réinitialiser"** : Remet les permissions aux valeurs par défaut définies dans le code
- **Bouton "🗄️ Réinitialiser aux Valeurs Initiales"** : Remet les permissions aux valeurs initiales stockées en base de données
- **Bouton "💾 Sauvegarder"** : Persiste les modifications en base de données
- **Indicateurs visuels** : Montrent le statut des modifications

## 🔄 Options de Réinitialisation

### **Deux Types de Réinitialisation**

#### 1. **🔄 Réinitialiser (Valeurs par défaut)**
- **Action** : Remet les permissions aux valeurs par défaut définies dans le code de l'application
- **Utilisation** : Utile pour revenir à un état connu et stable
- **Portée** : Affecte uniquement la session en cours
- **Bouton** : Couleur orange (warning)

#### 2. **🗄️ Réinitialiser aux Valeurs Initiales**
- **Action** : Remet les permissions aux valeurs initiales stockées en base de données
- **Utilisation** : Utile en cas de problème ou pour restaurer un état de production
- **Portée** : Récupère les vraies valeurs initiales depuis la base
- **Bouton** : Couleur rouge (error)
- **Sécurité** : Fonction de récupération d'urgence

### **Quand Utiliser Chaque Option**

| Situation | Bouton à Utiliser | Raison |
|-----------|-------------------|---------|
| Test de configuration | 🔄 Réinitialiser | Retour rapide aux valeurs connues |
| Problème de permissions | 🗄️ Réinitialiser aux Valeurs Initiales | Récupération depuis la base |
| Sauvegarde des changements | 💾 Sauvegarder | Persistance des modifications |

## 🔍 Architecture Technique

### **Backend (Spring Boot)**
```
PermissionController.java     # API REST pour la gestion des permissions
├── GET /api/permissions/roles                    # Liste des rôles
├── GET /api/permissions/roles/{role}             # Permissions d'un rôle
├── PUT /api/permissions/roles/{role}             # Mise à jour des permissions
├── POST /api/permissions/roles/{role}/reset      # Réinitialisation aux valeurs par défaut
├── POST /api/permissions/roles/{role}/reset-to-initial  # Réinitialisation aux valeurs initiales
├── POST /api/permissions/roles/{role}/save       # Sauvegarde persistante
├── GET /api/permissions/user/{role}              # Permissions d'un utilisateur
└── GET /api/permissions/default                  # Permissions par défaut

PermissionService.java        # Logique métier et persistance
RolePermissionsDto.java       # DTO pour les permissions des rôles
```

### **Frontend (React)**
```
useRolePermissions.ts         # Hook pour gérer les permissions des rôles
usePermissionRefresh.ts       # Hook pour rafraîchir les permissions
PermissionConfig.tsx          # Interface de configuration avec onglets
PermissionEffectsDemo.tsx     # Démonstration des effets
```

### **Communication**
```
Frontend ←→ Backend via API REST
Permissions stockées en mémoire (serveur)
Événements globaux pour synchronisation
Sauvegarde persistante via endpoint /save
```

## 📊 Permissions par Module

### **Dashboard**
- `dashboard:view` - Accès au tableau de bord

### **Propriétés**
- `properties:view` - Voir les propriétés
- `properties:create` - Créer des propriétés
- `properties:edit` - Modifier les propriétés
- `properties:delete` - Supprimer les propriétés

### **Demandes de Service**
- `service-requests:view` - Voir les demandes
- `service-requests:create` - Créer des demandes
- `service-requests:edit` - Modifier les demandes
- `service-requests:delete` - Supprimer les demandes

### **Interventions**
- `interventions:view` - Voir les interventions
- `interventions:create` - Créer les interventions
- `interventions:edit` - Modifier les interventions
- `interventions:delete` - Supprimer les interventions

### **Équipes**
- `teams:view` - Voir les équipes
- `teams:create` - Créer les équipes
- `teams:edit` - Modifier les équipes
- `teams:delete` - Supprimer les équipes

### **Paramètres**
- `settings:view` - Voir les paramètres
- `settings:edit` - Modifier les paramètres

### **Utilisateurs**
- `users:manage` - Gérer les utilisateurs (Admin uniquement)

### **Rapports**
- `reports:view` - Accès aux rapports

## 🔄 Synchronisation en Temps Réel

### **Événements Globaux**
```typescript
// Déclenchement lors de la modification des permissions
window.dispatchEvent(new CustomEvent('permissions-refreshed'));

// Écoute dans les composants
window.addEventListener('permissions-refreshed', handleRefresh);
```

### **Rafraîchissement Automatique**
1. **Modification** d'une permission
2. **Événement** global déclenché
3. **Interface** se met à jour automatiquement
4. **Menus** s'adaptent aux nouvelles permissions

## 🛡️ Sécurité

### **Contrôles d'Accès**
- **Endpoint protégé** : `@PreAuthorize("hasRole('ADMIN')")`
- **Validation** des permissions côté serveur
- **Authentification** requise pour toutes les opérations

### **Validation des Données**
- **Permissions existantes** vérifiées
- **Rôles valides** contrôlés
- **Données sanitizées** avant traitement

## 📝 Exemples d'Usage

### **Scénario 1 : Configuration complète d'un rôle**
1. **Sélectionner le rôle** "HOST" à configurer
2. **Aller dans l'onglet "⚙️ Édition des Permissions"**
3. **Modifier les permissions** (ex: désactiver "dashboard:view")
4. **Voir l'indicateur** "⚠️ Modifié" apparaître
5. **Cliquer sur "💾 Sauvegarder"** pour persister
6. **Aller dans l'onglet "🧪 Démonstration des Effets"**
7. **Vérifier que** le menu "Tableau de Bord" est inaccessible

### **Scénario 2 : Test des effets en temps réel**
1. **Sélectionner un rôle** (ex: MANAGER)
2. **Aller dans l'onglet "🧪 Démonstration des Effets"**
3. **Observer l'état actuel** des menus selon les permissions
4. **Retourner à l'onglet "⚙️ Édition des Permissions"**
5. **Modifier une permission** (ex: activer "users:manage")
6. **Aller dans l'onglet "🧪 Démonstration des Effets"**
7. **Voir le changement** en temps réel

### **Scénario 3 : Réinitialisation et sauvegarde**
1. **Modifier plusieurs permissions** d'un rôle
2. **Voir l'indicateur** "⚠️ Modifié" apparaître
3. **Cliquer sur "🔄 Réinitialiser"** pour revenir aux valeurs par défaut
4. **Vérifier l'indicateur** "✅ Par défaut"
5. **Cliquer sur "💾 Sauvegarder"** pour confirmer

## ⚠️ Limitations et Points d'Attention

### **Limitations Actuelles**
- **Stockage en mémoire** côté serveur (perte au redémarrage)
- **Rechargement de page** nécessaire pour certains composants
- **Permissions par rôle uniquement** (pas de permissions individuelles)

### **Améliorations Futures**
- **Persistance en base de données** pour les permissions personnalisées
- **Synchronisation Keycloak** pour la cohérence des rôles
- **Audit trail** des modifications de permissions
- **Permissions granulaires** par utilisateur

## 🧪 Tests et Validation

### **Test des Permissions**
1. **Connectez-vous en tant qu'Admin**
2. **Accédez à "Config Permissions"**
3. **Sélectionnez un rôle** à configurer
4. **Testez les deux onglets** pour comprendre leur fonctionnement
5. **Modifiez les permissions** dans l'onglet 1
6. **Vérifiez les effets** dans l'onglet 2
7. **Testez la persistance** en rechargeant la page

### **Test de la Sauvegarde**
1. **Modifiez des permissions** d'un rôle dans l'onglet 1
2. **Vérifiez l'indicateur** "⚠️ Modifié"
3. **Cliquez sur "💾 Sauvegarder"**
4. **Vérifiez la notification** de succès
5. **Rechargez la page** pour confirmer la persistance

### **Test des Onglets**
1. **Sélectionnez un rôle** sans permissions
2. **Vérifiez que les onglets sont désactivés**
3. **Sélectionnez un rôle** avec permissions
4. **Naviguez entre les onglets** pour vérifier le contenu
5. **Modifiez des permissions** dans l'onglet 1
6. **Vérifiez les changements** dans l'onglet 2

### **Validation des Effets**
- **Menus** apparaissent/disparaissent selon les permissions
- **Composants** s'adaptent aux permissions actuelles
- **Navigation** respecte les restrictions de permissions
- **Interface** se met à jour en temps réel

## 🔧 Dépannage

### **Problèmes Courants**
- **Permissions non mises à jour** : Vérifier la console pour les erreurs
- **Interface qui ne se rafraîchit pas** : Recharger la page manuellement
- **Erreurs 403** : Vérifier que l'utilisateur est Admin
- **Sauvegarde qui échoue** : Vérifier les logs serveur
- **Onglets désactivés** : Vérifier qu'un rôle est sélectionné

### **Correction du Bug de Démonstration des Effets**
**Problème identifié** : Le composant `PermissionEffectsDemo` affichait toujours les permissions de l'utilisateur connecté (Admin) au lieu des permissions du rôle sélectionné.

**Solution implémentée** :
- Le composant `PermissionEffectsDemo` accepte maintenant les permissions du rôle sélectionné en paramètres
- Les effets affichés correspondent exactement aux permissions du rôle configuré
- La démonstration se met à jour en temps réel selon le rôle sélectionné

**Vérification** :
- Sélectionnez un rôle avec des permissions limitées (ex: HOST)
- Allez dans l'onglet "🧪 Démonstration des Effets"
- Vérifiez que seuls les menus avec les permissions accordées sont marqués "Accessible"
- Modifiez les permissions dans l'onglet 1 et vérifiez les changements en temps réel dans l'onglet 2

### **Logs et Debug**
- **Console navigateur** : Logs des opérations de permissions
- **Logs serveur** : Opérations de permissions côté backend
- **Événements** : Suivi des événements de rafraîchissement
- **Notifications** : Suivi des opérations de sauvegarde

## 🎨 Interface Utilisateur

### **PageHeader**
- **Titre** : "⚙️ Configuration des Permissions"
- **Sous-titre** : Informations sur l'utilisateur connecté
- **Boutons d'action** : Réinitialiser et Sauvegarder
- **Organisation** : Titre à gauche, actions à droite

### **Système d'Onglets**
- **Onglet 1** : "⚙️ Édition des Permissions" - Configuration des permissions
- **Onglet 2** : "🧪 Démonstration des Effets" - Visualisation des impacts
- **Navigation** : Onglets désactivés si aucun rôle n'est sélectionné

### **Indicateurs Visuels**
- **Chips de statut** : "Modifié" (orange) ou "Par défaut" (vert)
- **Alertes** : Warning pour modifications, Success pour par défaut
- **Notifications** : Snackbar pour les opérations de sauvegarde

### **Organisation des Composants**
1. **PageHeader** avec titre et boutons d'action
2. **Sélection du rôle** à configurer
3. **Système d'onglets** avec contenu organisé
   - **Onglet 1** : Configuration des permissions par module
   - **Onglet 2** : Démonstration des effets en temps réel
4. **Statut des modifications** avec indicateurs
5. **Résumé des permissions** avec compteurs
6. **Notifications** de sauvegarde

---

💡 **Conseil** : Utilisez les onglets pour séparer la configuration (onglet 1) de la visualisation des effets (onglet 2) !
