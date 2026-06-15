# Inventaire interne — Domaine 11 : Application mobile

> **Méthode :** vérité terrain depuis `mobile/` (Expo / React Native). Statut + preuve fichier.
> **Date :** 2026-06-13 • **Grille :** 0 absent / 1 basique / 2 standard marché / 3 avancé-différenciant.

---

## 1. Nature de l'application

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| **Type** | **Application native** React Native / **Expo** (pas une PWA, pas un wrapper webview) | `mobile/package.json`, `mobile/app.json` |
| **Plateformes** | iOS + Android (Expo, build EAS) | `mobile/eas.json` |
| **Nombre d'écrans** | **85 écrans `.tsx`** | décompte réel `mobile/src/screens/**` |
| Stack | React Native + Expo, zustand (state), TanStack React Query v5 (data) | `package.json` |

### Décompte réel des écrans (vérité terrain — diffère légèrement du pitch)

| Rôle | Écrans | Vocation |
|------|:------:|----------|
| **host** | **50** | Gestion (propriétés, résa, calendrier, pricing, factures, payouts, messagerie, IoT, équipes, interventions…) |
| **manager** | **9** | Opérations terrain : planning, interventions, équipes, incidents, demandes, validation tâches |
| **housekeeper** | **6** | Terrain ménage : missions, checklist, photo, anomalie, signature, historique |
| **common** | **6** | Profil, abonnement, suppression de compte |
| **technician** | **5** | Terrain maintenance : file tickets, diagnostic, photo, rapport, signature |
| **admin** | **4** | Utilisateurs (liste/détail/édition/invitation) |
| **shared** | **4** | Conversations, templates de message, viewer PDF |
| **auth** | **1** | Login |
| **TOTAL** | **85** | |

> **Couverture = gestionnaire ET terrain.** L'app n'est pas seulement « terrain » : les 50 écrans `host` + 9 `manager` + 4 `admin` couvrent une **gestion nomade complète** (résa, facturation, payouts, pricing, IoT), et 11 écrans (technician+housekeeper) couvrent l'**exécution terrain**. C'est une couverture **double** rare dans les apps PMS (généralement soit app host « consultation », soit app cleaner séparée).

---

## 2. Capacités techniques

### 2.1 Offline (différenciant)

| Capacité | Constat code | Preuve |
|----------|--------------|--------|
| **Stockage local MMKV** | `react-native-mmkv` v4 — stockage synchrone rapide | `package.json`, `mobile/src/lib/storage.ts` |
| **Persistance du cache requêtes** | TanStack Query + `query-async-storage-persister` + `react-query-persist-client` → données consultables hors-ligne | `package.json`, `mobile/src/config/queryClient.ts` |
| **File de synchronisation offline (mutations)** | `mobile/src/services/offlineSync/syncEngine.ts` : file persistante d'actions, **retry exponentiel** (`getRetryDelay`, backoff jusqu'à 30 s), **4xx non-retryables** (sauf 408/429), **ordonnancement par dépendances** (`areDependenciesMet`), **flush automatique au retour réseau** (`startSyncListener`) | `syncEngine.ts:8-124` + `__tests__/syncEngine.test.ts` |
| Statut réseau | Hook `useNetworkStatus` (NetInfo) | `mobile/src/hooks/useNetworkStatus.ts`, `@react-native-community/netinfo` |
| Brouillons terrain | Checklist de ménage et chrono persistés MMKV (`checklist-drafts`) | `housekeeper/CleaningChecklistScreen.tsx:19-66` |

**Score offline : 3.** Une vraie **file de mutations offline avec retry/dépendances/auto-flush** (testée) dépasse le simple cache de lecture. C'est le niveau « cleaner work in the field, offline-ready » des spécialistes (Breezeway sync offline).

### 2.2 Push

| Capacité | Constat code | Preuve |
|----------|--------------|--------|
| Notifications push | `expo-notifications`, token Expo Push | `package.json`, `mobile/src/hooks/usePushNotifications.ts`, `services/push/pushService.ts` |
| Préférences notif | Écran dédié | `host/NotificationsScreen.tsx` |

**Score push : 3.** Push natif complet (enregistrement token + service + préférences).

### 2.3 Mises à jour OTA

| Capacité | Constat code | Preuve |
|----------|--------------|--------|
| **EAS Update / OTA** | `expo-updates` v29, channels (livraison sans repasser par les stores) | `package.json`, `mobile/app.json`, `mobile/eas.json` |

**Score OTA : 3.** Capacité de patch instantané rare hors apps natives Expo.

### 2.4 Signature & média

| Capacité | Constat code | Preuve |
|----------|--------------|--------|
| Signature canvas | `react-native-signature-canvas` v5 | `technician/TechSignatureScreen.tsx`, `housekeeper/SignatureScreen.tsx` |
| Caméra / galerie | `expo-camera`, `expo-image-picker` | `package.json`, écrans photo |
| Viewer PDF | Écran `PdfViewerScreen` | `shared/PdfViewerScreen.tsx` |

**Score : 2.** Capture de signature visuelle (preuve d'exécution), photos, PDF.

### 2.5 Sécurité (token au repos / biométrie)

| Capacité | Constat code | Preuve |
|----------|--------------|--------|
| **Token au repos** | `expo-secure-store` (Keychain iOS / Keystore Android) | `mobile/src/api/apiClient.ts`, `store/authStore.ts` — conforme règle sécurité #7 (jamais en clair) |
| **Biométrie** | ⚠️ **`expo-local-authentication` est DÉCLARÉE dans `package.json` mais N'EST PAS importée/utilisée dans `src/`** (aucun `import ... 'expo-local-authentication'`, aucun `authenticateAsync`/`hasHardwareAsync`) | grep exhaustif `mobile/src/` = 0 occurrence |

> **Correction du cadrage :** l'item « biométrie (`expo-local-authentication`) — Implémenté » est **inexact en l'état**. La dépendance est **provisionnée mais non câblée** : pas de verrouillage biométrique à l'ouverture ni de re-auth biométrique. À reclasser **« prévu / non implémenté »**. Le stockage sécurisé du token (`expo-secure-store`), lui, **est** bien en place.

**Score sécurité mobile : 2.** Token au repos sécurisé (bon) mais **biométrie absente du code** (à corriger ou retirer de la promesse).

### 2.6 Tests

| Capacité | Constat code | Preuve |
|----------|--------------|--------|
| Tests unitaires | `syncEngine.test.ts`, `authStore.test.ts` | `mobile/src/**/__tests__/` |

---

## 3. Synthèse domaine 11

| Capacité | Score | Commentaire |
|----------|:-----:|-------------|
| Native iOS/Android | 3 | RN/Expo natif, pas PWA |
| Couverture gestionnaire | 3 | 50 host + 9 manager + 4 admin = gestion nomade complète |
| Couverture terrain | 3 | 11 écrans technician+housekeeper dédiés exécution |
| Offline (mutations + cache) | 3 | File de sync testée (retry/dépendances/auto-flush) + MMKV + persist |
| Push | 3 | Natif complet |
| OTA updates | 3 | EAS Update channels |
| Signature / média | 2 | Capture visuelle + photos + PDF |
| Token au repos | 2 | `expo-secure-store` (Keychain/Keystore) |
| **Biométrie** | **0–1** | **Dépendance présente mais NON câblée** — promesse à corriger |

> **Score « nous » domaine 11 : 3.** App **native double couverture** (gestionnaire + terrain) avec offline robuste, push, OTA — au-dessus de la plupart des apps PMS (souvent app host consultation OU app cleaner tierce). **Réserve unique notable :** la biométrie annoncée n'est pas implémentée (dépendance dormante).
