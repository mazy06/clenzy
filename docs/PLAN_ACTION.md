# PLAN D'ACTION CLENZY PMS

## Vue d'ensemble

Ce plan est organisé en **3 phases séquentielles** :
1. **Phase 1 — Nettoyage** (suppression code mort, console.log, TODO)
2. **Phase 2 — Refactoring** (client API, formulaires, composants, état global)
3. **Phase 3 — Nouvelles fonctionnalités** (notifications, calendrier, photos, rapports, etc.)

---

# PHASE 1 — NETTOYAGE

> Objectif : Réduire le bruit, supprimer le code inutile, préparer le terrain pour le refactoring.

## 1.1 Suppression des console.log (590 statements dans 60+ fichiers)

### Par priorité de volume :

| Module | Fichiers | Total | Pires fichiers |
|--------|----------|-------|-----------------|
| Interventions | 7 fichiers | 102 | InterventionDetails (46), InterventionsList (21) |
| Portfolios | 7 fichiers | 90 | ClientPropertyAssignmentForm (37), PortfoliosPage (23) |
| Hooks | 8 fichiers | 78 | useAuth (32), useRolePermissions (19) |
| Service-Requests | 5 fichiers | 63 | ServiceRequestsList (31), ServiceRequestForm (17) |
| Services | 4 fichiers | 49 | TokenService (32) |
| Properties | 4 fichiers | 43 | PropertyForm (20), PropertiesList (11) |
| Users | 4 fichiers | 29 | UsersList (13), UserEdit (8) |
| Reports | 1 fichier | 26 | ReportDetails (26) |
| Components | 9 fichiers | 22 | PermissionConfig (8), TokenMonitoring (5) |
| Teams | 4 fichiers | 20 | TeamsList (9), TeamForm (5) |
| Dashboard | 7 fichiers | 20 | AlertsWidget (9), useDashboardStats (7) |
| App.tsx | 1 fichier | 18 | App.tsx (18) |
| Contact | 3 fichiers | 8 | ContactForm (4) |
| Auth | 1 fichier | 6 | Login.tsx (6) |
| Config | 1 fichier | 8 | console.ts (8) |

**Action :** Supprimer tous les console.log/warn/error de debug. Créer un service de logging optionnel pour le dev.

---

## 1.2 Suppression du code mort (17 fichiers, ~1 200+ lignes)

### Fichiers à supprimer :

**Variations ClientAssignmentPage inutilisées :**
- [ ] `modules/portfolios/ClientAssignmentPage.tsx` (361 lignes — importé mais aucune route)
- [ ] `modules/portfolios/ClientAssignmentPageSimple.tsx` (33 lignes)
- [ ] `modules/portfolios/ClientAssignmentPageMinimal.tsx` (22 lignes)
- [ ] `modules/portfolios/ClientAssignmentPageStandalone.tsx` (48 lignes)

**Composants AccessDenied module-spécifiques (non utilisés — ProtectedRoute a son propre UI) :**
- [ ] `components/modules/DashboardAccessDenied.tsx`
- [ ] `components/modules/PropertiesAccessDenied.tsx`
- [ ] `components/modules/ServiceRequestsAccessDenied.tsx`
- [ ] `components/modules/InterventionsAccessDenied.tsx`
- [ ] `components/modules/TeamsAccessDenied.tsx`
- [ ] `components/modules/ReportsAccessDenied.tsx`
- [ ] `components/modules/UsersAccessDenied.tsx`
- [ ] `components/modules/SettingsAccessDenied.tsx`
- [ ] `components/modules/AccessDeniedDemo.tsx`
- [ ] `components/modules/index.ts`

**Composants de démo/test :**
- [ ] `components/PermissionDemo.tsx` (153 lignes — non importé)

**Wrappers inutilisés :**
- [ ] `components/NavigationDrawer.tsx` (non importé)
- [ ] `components/UltraSimpleAppWrapper.tsx` (composant de test)

**Imports morts à nettoyer :**
- [ ] `AuthenticatedApp.tsx` : retirer l'import de `ClientAssignmentPage` (ligne 64)
- [ ] `AuthenticatedApp.tsx` : retirer l'import de `TeamAssignmentPage` (ligne 67) si pas de route
- [ ] Retirer la route `/test-no-auth` (ClientAssignmentPageNoAuth) — route de dev

---

## 1.3 Résolution des TODO (15 items)

| Fichier | Ligne | TODO | Action |
|---------|-------|------|--------|
| InterventionDetails.tsx | 1351 | Vérifier si l'utilisateur fait partie de l'équipe | Implémenter la vérification |
| InterventionDetails.tsx | 1357 | Vérifier si l'utilisateur est assigné | Implémenter la vérification |
| InterventionsList.tsx | 362 | Vérifier si l'utilisateur fait partie de l'équipe | Implémenter la vérification |
| InterventionsList.tsx | 368 | Vérifier si l'utilisateur est assigné | Implémenter la vérification |
| InterventionsList.tsx | 403 | Filtrer par propriétés du host | Implémenter le filtre |
| PropertiesList.tsx | 254 | Implement delete logic | Implémenter la suppression |
| ServiceRequestsList.tsx | 348 | Appeler l'endpoint pour annuler | Implémenter l'annulation |
| Settings.tsx | 131 | Implement save logic | Implémenter la sauvegarde |
| Settings.tsx | 138 | Implement reset logic | Implémenter le reset |
| ClientAssignmentPage.tsx | 70,110,128 | Remplacer par vrais appels API | Fichier à supprimer (1.2) |
| TeamAssignmentPage.tsx | 82,136,154 | Remplacer par vrais appels API | Implémenter les appels API |

---

## 1.4 Externalisation des URLs hardcodées (6 occurrences)

**Fichiers concernés :**
- `keycloak.ts` ligne 5 : `http://localhost:8083`
- `config/api.ts` lignes 4, 16-18, 24 : `http://localhost:8084` et `http://localhost:8083`

**Action :**
- [ ] Créer un fichier `.env` avec `VITE_API_URL` et `VITE_KEYCLOAK_URL`
- [ ] Créer un fichier `.env.development` pour les valeurs localhost
- [ ] Créer un fichier `.env.production` pour les valeurs de prod
- [ ] Modifier `config/api.ts` pour utiliser `import.meta.env.VITE_*`
- [ ] Modifier `keycloak.ts` pour utiliser les variables d'env
- [ ] Ajouter `.env` au `.gitignore` + créer `.env.example`

---

## 1.5 Correction du typage `any` (86 occurrences dans 30+ fichiers)

### Par priorité :

**Critique (28 `any` — useDashboardStats.ts) :**
- [ ] Créer des interfaces pour les réponses API du dashboard
- [ ] Typer toutes les fonctions de fetch et leurs retours

**Élevé (4+ `any`) :**
- [ ] ReportDetails.tsx (4)
- [ ] ServiceRequestsList.tsx (4)
- [ ] InterventionEdit.tsx (3)
- [ ] useTokenHealth.ts (3)
- [ ] useLayoutState.ts (3)

**Moyen (2 `any`) :**
- [ ] ServiceRequestForm.tsx, ServiceRequestEdit.tsx, UpcomingInterventions.tsx
- [ ] PortfoliosPage.tsx, TeamForm.tsx, UserEdit.tsx, TokenService.ts
- [ ] keycloak.ts, console.ts, FilterSearchBar.tsx

**Faible (1 `any` — 15 fichiers) :**
- Corriger au fur et à mesure du refactoring Phase 2

---

# PHASE 2 — REFACTORING

> Objectif : Centraliser les patterns répétitifs, découper les gros composants, améliorer la maintenabilité.

## 2.1 Créer un client API centralisé

**Problème actuel :** 150+ appels `fetch()` directs avec token localStorage à chaque fois.

**Solution :**
- [ ] Créer `services/apiClient.ts` basé sur Axios ou wrapper fetch
  - Intercepteur automatique pour le token `Authorization: Bearer`
  - Intercepteur de réponse pour erreurs 401 (refresh token)
  - Base URL depuis variables d'environnement
  - Gestion centralisée des erreurs
  - Support d'annulation (AbortController)
  - Méthodes typées : `get<T>()`, `post<T>()`, `put<T>()`, `delete<T>()`

- [ ] Créer des services par domaine :
  - `services/api/propertiesApi.ts`
  - `services/api/interventionsApi.ts`
  - `services/api/serviceRequestsApi.ts`
  - `services/api/teamsApi.ts`
  - `services/api/usersApi.ts`
  - `services/api/portfoliosApi.ts`
  - `services/api/dashboardApi.ts`
  - `services/api/contactApi.ts`
  - `services/api/reportsApi.ts`
  - `services/api/authApi.ts`

- [ ] Migrer tous les composants vers les nouveaux services API

---

## 2.2 Créer une abstraction localStorage

**Problème actuel :** 150+ accès directs à localStorage dans 52 fichiers.

**Solution :**
- [ ] Créer `services/storageService.ts`
  - Méthodes typées : `getToken()`, `setToken()`, `clearTokens()`
  - Clés centralisées en constantes
  - Gestion d'erreur (quota, availability)
  - Méthodes génériques : `get<T>(key)`, `set<T>(key, value)`

- [ ] Migrer tous les accès directs vers le service

---

## 2.3 Système de gestion de formulaires

**Problème actuel :** 8 formulaires de 400-900 lignes avec gestion manuelle useState.

**Solution :**
- [ ] Installer `react-hook-form` + `zod` (validation)
- [ ] Créer des schémas de validation Zod :
  - `schemas/propertySchema.ts`
  - `schemas/interventionSchema.ts`
  - `schemas/serviceRequestSchema.ts`
  - `schemas/teamSchema.ts`
  - `schemas/userSchema.ts`
  - `schemas/contactSchema.ts`

- [ ] Refactorer chaque formulaire avec react-hook-form :
  - PropertyForm.tsx (696 → ~300 lignes estimées)
  - InterventionForm.tsx (683 → ~300 lignes)
  - ServiceRequestForm.tsx (745 → ~350 lignes)
  - TeamForm.tsx (610 → ~250 lignes)
  - UserForm.tsx (458 → ~200 lignes)
  - ContactForm.tsx (404 → ~200 lignes)
  - ClientPropertyAssignmentForm.tsx (889 → ~400 lignes)
  - TeamUserAssignmentForm.tsx (799 → ~350 lignes)

**Gain estimé :** ~2 350 lignes supprimées

---

## 2.4 Découpage des gros composants

**Composants critiques (> 800 lignes) :**

### InterventionDetails.tsx (2 790 lignes → objectif 5-8 fichiers)
- [ ] Extraire `InterventionHeader.tsx` (infos principales)
- [ ] Extraire `InterventionStatusSection.tsx` (statut, progression)
- [ ] Extraire `InterventionAssignmentSection.tsx` (assignation)
- [ ] Extraire `InterventionPhotosSection.tsx` (photos)
- [ ] Extraire `InterventionActionsBar.tsx` (boutons d'action)
- [ ] Extraire `InterventionValidationDialog.tsx` (modale validation)
- [ ] Extraire `InterventionPaymentSection.tsx` (paiement)
- [ ] Créer un hook `useInterventionDetails.ts` (logique métier)

### ServiceRequestsList.tsx (1 162 lignes)
- [ ] Extraire `ServiceRequestFilters.tsx`
- [ ] Extraire `ServiceRequestCard.tsx` (si pas déjà existant)
- [ ] Extraire `ServiceRequestActions.tsx`
- [ ] Créer un hook `useServiceRequests.ts`

### Dashboard.tsx (959 lignes → objectif 4-5 fichiers)
- [ ] Séparer `DashboardAdmin.tsx`
- [ ] Séparer `DashboardHost.tsx`
- [ ] Séparer `DashboardTechnician.tsx`
- [ ] Extraire `DashboardStatsGrid.tsx`
- [ ] Extraire `DashboardQuickActions.tsx`

### PortfoliosPage.tsx (938 lignes)
- [ ] Séparer les tabs en composants individuels
- [ ] Créer un hook `usePortfolios.ts`

### ClientPropertyAssignmentForm.tsx (889 lignes)
- [ ] Extraire les étapes du stepper en composants séparés
- [ ] Créer un hook `useClientPropertyAssignment.ts`

### InterventionsList.tsx (819 lignes)
- [ ] Extraire les filtres
- [ ] Extraire la logique dans un hook `useInterventionsList.ts`

### Autres composants > 600 lignes (8 fichiers)
- [ ] ServiceRequestEdit.tsx (778) — fusionner avec ServiceRequestForm
- [ ] PropertyEdit.tsx (747) — fusionner avec PropertyForm
- [ ] ServiceRequestForm.tsx (745) — refactored en 2.3
- [ ] UsersList.tsx (722) — extraire filtres + hook
- [ ] InterventionEdit.tsx (705) — fusionner avec InterventionForm
- [ ] PropertyForm.tsx (696) — refactored en 2.3
- [ ] InterventionForm.tsx (683) — refactored en 2.3
- [ ] PermissionConfig.tsx (668) — extraire sections

---

## 2.5 Unifier les pages Create/Edit

**Problème :** Duplication entre les pages Create et Edit pour chaque entité.

**Solution :** Fusionner en un seul composant Form qui gère les 2 modes.
- [ ] `PropertyForm.tsx` ← fusionner `PropertyCreate` + `PropertyEdit` (747 lignes récupérées)
- [ ] `InterventionForm.tsx` ← fusionner `InterventionEdit` (705 lignes récupérées)
- [ ] `ServiceRequestForm.tsx` ← fusionner `ServiceRequestEdit` (778 lignes récupérées)
- [ ] `UserForm.tsx` ← fusionner `UserEdit` (573 lignes récupérées)
- [ ] `TeamForm.tsx` ← fusionner `TeamEdit` (478 lignes récupérées)

**Gain estimé :** ~3 281 lignes supprimées

---

## 2.6 Centraliser la gestion d'erreurs et loading

**Problème :** 280+ try-catch identiques, 142 loading states séparés.

**Solution :**
- [ ] Créer un hook `useApiQuery.ts` (inspiré React Query)
  - Gestion loading/error/data automatique
  - Retry automatique
  - Cache optionnel
  - Annulation à l'unmount

- [ ] Créer un hook `useApiMutation.ts` pour les écritures
  - Loading/error/success states
  - Callback onSuccess, onError
  - Invalidation de cache

- [ ] Créer `components/ApiErrorAlert.tsx` — composant d'erreur standard
- [ ] Créer `components/PageLoader.tsx` — loading page standard
- [ ] Ajouter ErrorBoundary par module (pas seulement au root)

---

## 2.7 Améliorer le hook useAuth

**Problème :** useAuth.ts (406 lignes) mélange trop de responsabilités.

**Solution :**
- [ ] Créer un `AuthContext` global (Provider dans App.tsx)
- [ ] Séparer en hooks spécialisés :
  - `useAuth.ts` → authentification uniquement (login, logout, token)
  - `useCurrentUser.ts` → données utilisateur + rôle
  - `usePermissions.ts` → vérification de permissions (simplifié)
- [ ] Supprimer le prop drilling de `user` et `permissions`

---

## 2.8 Créer des types/interfaces complets

**Problème :** 86 `any` types, interfaces manquantes pour les réponses API.

**Solution :**
- [ ] Créer `types/api.ts` — types de réponse API génériques
- [ ] Créer `types/property.ts` — interfaces Property complètes
- [ ] Créer `types/intervention.ts` — interfaces Intervention complètes
- [ ] Créer `types/serviceRequest.ts` — interfaces ServiceRequest complètes
- [ ] Créer `types/team.ts` — interfaces Team complètes
- [ ] Créer `types/user.ts` — interfaces User complètes
- [ ] Créer `types/portfolio.ts` — interfaces Portfolio complètes
- [ ] Créer `types/dashboard.ts` — interfaces Dashboard stats complètes
- [ ] Créer `types/contact.ts` — interfaces Contact complètes

---

# PHASE 3 — NOUVELLES FONCTIONNALITÉS

> Objectif : Compléter les fonctionnalités manquantes pour un PMS production-ready.

## 3.1 Variables d'environnement complètes

- [ ] `.env.development` — URLs locales
- [ ] `.env.production` — URLs de production
- [ ] `.env.example` — Template documenté
- [ ] Adapter Vite config si nécessaire
- [ ] Adapter Docker Compose pour injecter les variables

---

## 3.2 Service de logging

- [ ] Créer `services/logger.ts`
  - Niveaux : debug, info, warn, error
  - Actif uniquement en développement (basé sur `import.meta.env.DEV`)
  - Préfixes par module
  - Désactivé en production (ou envoi vers service externe)

---

## 3.3 Système de notifications

- [ ] Backend : créer entité `Notification`, service, controller, repository
- [ ] Backend : notifications déclenchées par événements métier
  - Nouvelle intervention assignée
  - Service request validée/rejetée
  - Intervention terminée
  - Nouveau message contact
  - Changement de statut
- [ ] Frontend : `NotificationCenter` dans TopNavigation (badge + dropdown)
- [ ] Frontend : hook `useNotifications.ts`
- [ ] Frontend : page `/notifications` pour l'historique
- [ ] API : GET `/api/notifications`, PUT `/api/notifications/:id/read`
- [ ] Optionnel : WebSocket pour temps réel

---

## 3.4 Vue calendrier/planning

- [ ] Installer une librairie calendrier (FullCalendar ou react-big-calendar)
- [ ] Créer page `/planning` ou `/calendar`
- [ ] Afficher les interventions sur un calendrier (jour/semaine/mois)
- [ ] Filtres par équipe, type d'intervention, propriété
- [ ] Vue par technicien/équipe
- [ ] Drag & drop pour reprogrammer (optionnel)
- [ ] API : GET `/api/interventions/calendar?start=...&end=...`

---

## 3.5 Upload de photos

- [ ] Backend : intégration stockage (S3 ou local)
- [ ] Backend : endpoints upload/download
- [ ] Frontend : composant `ImageUpload.tsx` réutilisable
  - Drag & drop
  - Preview
  - Multi-fichiers
  - Compression côté client
- [ ] Intégrer dans PropertyForm (photos de propriété)
- [ ] Intégrer dans InterventionDetails (photos avant/après)
- [ ] Intégrer dans ServiceRequestForm (photos du problème)
- [ ] Galerie d'images dans les pages de détail

---

## 3.6 Module Rapports complet

- [ ] Backend : services d'agrégation de données
  - Rapport financier (revenus, coûts, marges)
  - Rapport interventions (performance, durées, statuts)
  - Rapport équipes (charge de travail, disponibilité)
  - Rapport propriétés (occupation, maintenance)
- [ ] Frontend : page Reports avec filtres de dates
- [ ] Frontend : graphiques (Chart.js ou Recharts)
  - Graphiques en barres, camemberts, lignes
- [ ] Export PDF (iText côté backend déjà disponible)
- [ ] Export CSV/Excel
- [ ] Filtres : période, propriété, équipe, type

---

## 3.7 Finaliser les paiements Stripe

- [ ] Frontend : formulaire de paiement Stripe Elements
- [ ] Page récapitulatif avant paiement
- [ ] Historique des paiements par intervention
- [ ] Factures automatiques (PDF)
- [ ] Webhooks Stripe (backend déjà en place)
- [ ] Remboursements (optionnel)

---

## 3.8 Système d'emails

- [ ] Backend : service d'envoi d'emails (Spring Mail + template engine)
- [ ] Templates d'email :
  - Bienvenue nouvel utilisateur
  - Intervention assignée
  - Service request validée
  - Rappel intervention planifiée
  - Paiement confirmé
- [ ] Configuration SMTP dans application.yml
- [ ] Préférences email par utilisateur

---

## 3.9 Suivi financier

- [ ] Dashboard financier pour ADMIN/MANAGER
- [ ] Revenus par propriété, par mois
- [ ] Coûts des interventions
- [ ] Marges bénéficiaires
- [ ] Graphiques d'évolution
- [ ] Backend : endpoints agrégation financière

---

## 3.10 Page activités complète

- [ ] Implémenter `/dashboard/activities`
- [ ] Liste paginée de toutes les activités
- [ ] Filtres par type, utilisateur, date
- [ ] Détails cliquables
- [ ] Backend : endpoint `/api/activities` avec pagination

---

## 3.11 Améliorations UX

- [ ] Dark mode (ThemeProvider toggle)
- [ ] Opérations en masse (sélection multiple + actions groupées)
- [ ] Breadcrumbs de navigation
- [ ] Raccourcis clavier
- [ ] Tour guidé pour nouveaux utilisateurs (optionnel)

---

# ORDRE D'EXÉCUTION RECOMMANDÉ

```
PHASE 1 — NETTOYAGE (estimé : 4-6 sessions)
├── 1.1 Supprimer console.log (1 session)
├── 1.2 Supprimer code mort (1 session)
├── 1.3 Résoudre les TODO (1 session)
├── 1.4 Externaliser URLs → .env (1 session)
└── 1.5 Corriger types `any` (1-2 sessions)

PHASE 2 — REFACTORING (estimé : 10-15 sessions)
├── 2.1 Client API centralisé (2 sessions)
├── 2.2 Abstraction localStorage (1 session)
├── 2.3 react-hook-form + Zod (2-3 sessions)
├── 2.4 Découpage gros composants (3-4 sessions)
├── 2.5 Fusionner Create/Edit (2 sessions)
├── 2.6 Gestion erreurs/loading centralisée (1-2 sessions)
├── 2.7 Refactorer useAuth (1 session)
└── 2.8 Types/interfaces complets (1 session)

PHASE 3 — NOUVELLES FONCTIONNALITÉS (estimé : 12-18 sessions)
├── 3.1 Variables d'environnement (1 session)
├── 3.2 Service de logging (1 session)
├── 3.3 Notifications (2-3 sessions)
├── 3.4 Calendrier/planning (2-3 sessions)
├── 3.5 Upload photos (2 sessions)
├── 3.6 Module rapports (2-3 sessions)
├── 3.7 Paiements Stripe (1-2 sessions)
├── 3.8 Emails (1-2 sessions)
├── 3.9 Suivi financier (1-2 sessions)
├── 3.10 Page activités (1 session)
└── 3.11 Améliorations UX (1-2 sessions)
```

---

# MÉTRIQUES DE SUCCÈS

| Métrique | Avant | Objectif |
|----------|-------|----------|
| Console.log | 590 | 0 |
| Fichiers morts | 17 | 0 |
| Types `any` | 86 | < 5 |
| TODO comments | 15 | 0 |
| URLs hardcodées | 6 | 0 |
| Taille max composant | 2 790 lignes | < 400 lignes |
| Appels fetch directs | 150+ | 0 (via apiClient) |
| Accès localStorage directs | 150+ | 0 (via storageService) |
| Try-catch dupliqués | 280+ | < 10 (via hooks centralisés) |
| Taille moyenne composant | 350 lignes | < 200 lignes |
