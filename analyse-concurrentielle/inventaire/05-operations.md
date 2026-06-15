# Inventaire interne — Domaine 5 : Opérations (Ménage & Maintenance)

> **Méthode :** vérité terrain depuis le code (`server/src/main/java/com/clenzy/` + `mobile/src/`). Statut + preuve fichier:ligne.
> **Date :** 2026-06-13 • **Grille :** 0 absent / 1 basique / 2 standard marché / 3 avancé-différenciant.

---

## 1. Modèle de données & couverture fonctionnelle

### 1.1 Interventions (cœur du domaine)

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| Entité `Intervention` | Cycle de vie complet, 17 KB | `model/Intervention.java` |
| **Types d'intervention** | **19 types** : `CLEANING, EXPRESS_CLEANING, DEEP_CLEANING, WINDOW_CLEANING, FLOOR_CLEANING, KITCHEN_CLEANING, BATHROOM_CLEANING, PREVENTIVE_MAINTENANCE, EMERGENCY_REPAIR, ELECTRICAL_REPAIR, PLUMBING_REPAIR, HVAC_REPAIR, APPLIANCE_REPAIR, GARDENING, EXTERIOR_CLEANING, PEST_CONTROL, DISINFECTION, RESTORATION, OTHER` | `model/InterventionType.java` |
| **Statuts** | `PENDING → AWAITING_VALIDATION → AWAITING_PAYMENT → IN_PROGRESS → COMPLETED / CANCELLED` (machine à états) | `model/InterventionStatus.java` |
| Cycle de vie | `startIntervention`, `completeIntervention`, `reopenIntervention`, `updateStatus`, `validateIntervention(estimatedCost)` | `service/InterventionLifecycleService.java:61-300` |
| Progression terrain | Service dédié de suivi d'avancement | `service/InterventionProgressService.java` |
| Politique d'accès rôle | Contrôle d'accès dédié (qui voit/agit selon rôle) | `service/InterventionAccessPolicy.java` |
| Mapping DTO | Records, pas d'entité exposée | `service/InterventionMapper.java` |

**Score sous-domaine : 3.** Profondeur de typage (19 types, 7 dédiés ménage) et machine à états supérieures au standard marché. Le statut `AWAITING_PAYMENT` intègre l'intervention au flux de facturation (différenciant côté conciergerie facturant le ménage au propriétaire).

### 1.2 Photos avant/après + anomalie

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| Entité `InterventionPhoto` | Photos rattachées à l'intervention | `model/InterventionPhoto.java` |
| **Phases** | `BEFORE / AFTER / ISSUE` — **la phase `ISSUE` EST le canal photo d'anomalie** rattaché à l'intervention | `model/InterventionPhoto.java:24-25,55-57` |
| Service photos | Upload via `PhotoStorageService` (S3 ou BYTEA selon profil) | `service/InterventionPhotoService.java` |
| Capture mobile | Écran dédié technicien + housekeeper | `mobile/.../technician/PhotoDocScreen.tsx`, `housekeeper/PhotoCaptureScreen.tsx` |

**Score sous-domaine : 3.** Avant/après natif + phase `ISSUE` pour photographier un défaut **dans** l'intervention. Égale les spécialistes (Breezeway/Operto exigent photos de preuve ; Turno = photos horodatées). Réserve : pas d'évidence de photos de **référence** (« voilà à quoi ça doit ressembler ») comme Breezeway.

### 1.3 Équipes & assignation

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| `Team` / `TeamMember` / `TeamRole` | Équipes + membres + rôles terrain | `model/Team.java`, `TeamMember.java`, `TeamRole.java` |
| `TeamCoverageZone` | **Zones géographiques de couverture** par équipe | `model/TeamCoverageZone.java` |
| `PropertyTeam` | Équipe assignée à une propriété | `model/PropertyTeam.java` |
| `ManagerTeam` / `PortfolioTeam` | Équipes au niveau gestionnaire / portefeuille | `model/ManagerTeam.java`, `PortfolioTeam.java` |
| **Auto-assignation géographique** | `findAvailableTeamForProperty` : (1) équipe assignée à la propriété, sinon (2) fallback recherche par **zone géo + type de service + disponibilité** | `service/PropertyTeamService.java:126-180` (`tryGeographicSearch`) |
| Disponibilité | `checkTeamMemberAvailability`, `checkUserAvailability` | `service/InterventionPlanningService.java:177-249` |
| Rôles opérationnels | `TECHNICIAN / HOUSEKEEPER / SUPERVISOR / LAUNDRY / EXTERIOR_TECH` | `primer.md` + navigateurs mobile |

**Score sous-domaine : 3.** Auto-assignation par **zone géographique + type + disponibilité** = mécanique de routing de niveau spécialiste, rarement native dans un PMS généraliste (souvent déléguée à Turno/Breezeway).

### 1.4 Inventaire de propriété

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| `PropertyInventoryItem` | Items d'inventaire par propriété | `model/PropertyInventoryItem.java` |
| Service + checks | CRUD + vérifications d'inventaire | `service/PropertyInventoryService.java`, `controller/PropertyInventoryController.java` |

**Score sous-domaine : 2.** Inventaire + checks présents (linge, consommables). Pas d'évidence de seuils de réappro automatiques.

### 1.5 Demandes de service → interventions (orchestration)

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| `ServiceRequest` | Demande de prestation (entrée du flux) | `model/ServiceRequest.java` (11.8 KB) |
| Service (40 KB) | `create`, `refuse`, `manualAssign`, `attemptAutoAssign`, `attemptAutoAssignByOrgId`, `createInterventionFromPaidServiceRequest` | `service/ServiceRequestService.java:97-714` |
| **Auto-assignation activable/désactivable** | Réglage org `isAutoAssignInterventions()` | `scheduler/AutoAssignScheduler.java` + `WorkspaceSettings` |
| **Retry d'auto-assignation** | Job toutes les **15 min** sur les SR `PENDING` non assignées, avec `MAX_AUTO_ASSIGN_RETRIES` (≈10) et `autoAssignStatus='exhausted'` | `scheduler/AutoAssignScheduler.java:retryPendingAutoAssignment` |
| Paiement de prestation | `ServiceRequestPaymentService`, `InterventionPaymentService` | `service/*PaymentService.java` |

### 1.6 **Déclenchement automatique du ménage depuis le check-out** (point clé, mieux que « partiel »)

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| **`ICalCleaningScheduler`** | Crée (ou relance) **automatiquement** une demande de ménage à partir des **réservations importées iCal**, **si l'auto-création est activée** (`isAutoCreateInterventions()`) | `service/ical/ICalCleaningScheduler.java:48-173` |
| Date de la demande | **Date du check-out + heure par défaut de la propriété** (respecte la timezone propriété, conforme règle CLAUDE.md #9) | `ICalCleaningScheduler.java:103` |
| Idempotence | Re-vérifie même si la réservation est un doublon (permet d'activer l'auto-ménage *après* un 1er import) | `ICalCleaningScheduler.java:48-72` |
| Post-commit | Auto-assignation différée **après commit** de l'import (`session.srsToAutoAssign`) | header du fichier + `AutoAssignScheduler` |
| Intervention après paiement | L'intervention est matérialisée **après paiement** de la SR (modèle conciergerie facturant) | `createInterventionFromPaidServiceRequest` |

> **Correction de l'hypothèse de cadrage :** le « planning auto partiel » est en réalité un **pipeline checkout → demande de ménage automatique → auto-assignation géographique → retry planifié**. C'est un standard marché atteint, voire au-dessus pour le routing géo. Le « partiel » ne concerne plus le déclenchement (présent) mais : pas de planning visuel d'optimisation de tournée, pas d'optimisation d'itinéraire, pas de récurrence calendaire native côté SR (la récurrence vient des réservations).

**Score sous-domaine orchestration : 3** (déclenchement auto + routing + retry).

### 1.7 Compte-rendu & signature terrain

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| Compte-rendu | `technicianNotes` / `customerFeedback` | `model/Intervention.java` |
| Rapport technicien | Écran dédié | `mobile/.../technician/TechReportScreen.tsx`, `DiagnosticFormScreen.tsx` |
| **Signature de fin** | Capture visuelle via `react-native-signature-canvas` | `mobile/.../technician/TechSignatureScreen.tsx`, `housekeeper/SignatureScreen.tsx` |
| Validation manager | Écran `TaskValidationScreen` (validation des tâches terrain) | `mobile/.../manager/TaskValidationScreen.tsx` |

**Score sous-domaine : 2.** Signature = **capture visuelle** (preuve d'exécution), **pas une e-signature légale** (la SES interne `CLENZY_CUSTOM` du domaine 12 n'est pas branchée ici). Compte-rendu + validation manager = standard.

### 1.8 Anomalies / incidents terrain

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| **`AnomalyReportScreen`** | Signalement d'anomalie par le **housekeeper** depuis le terrain | `mobile/.../housekeeper/AnomalyReportScreen.tsx` |
| Photo d'anomalie | Phase `ISSUE` sur `InterventionPhoto` (rattachée à l'intervention) | `model/InterventionPhoto.java:25` |
| `Incident` (modèle backend) | **⚠️ Incident SYSTÈME/SRE** (`SERVICE_DOWN, DOUBLE_BOOKING, CRITICAL_KPI_FAILURE, SYNC_UNAVAILABLE`, sévérité P1/P2/P3) — détection automatique via `IncidentDetectionScheduler`, **PAS un incident métier terrain** | `model/Incident.java:18-33` |
| `IncidentService` / `IncidentController` | Gestion de ces incidents techniques | `service/IncidentService.java` |

> **Précision importante :** la mention « anomalies `IncidentService` séparé des interventions » du cadrage est à **requalifier**. Le `IncidentService` backend gère la **fiabilité système** (SRE), pas les défauts physiques d'un logement. Le **signalement d'anomalie terrain** existe bien, mais via : (a) l'écran mobile `AnomalyReportScreen` (housekeeper) et (b) la phase photo `ISSUE`. Il n'y a **pas d'entité métier `Issue`/`Defect`** unifiée transformable en ticket de maintenance avec son propre cycle de vie (à la Breezeway « report an issue → create work order »). C'est le vrai gap, pas une « séparation ».

**Score sous-domaine : 1–2.** Signalement présent mais pas de **ticket d'anomalie de premier ordre** (cycle de vie, conversion en bon de travail, suivi cross-intervention).

---

## 2. Couverture mobile terrain (lien avec domaine 11)

| Rôle | Écrans terrain | Fichiers |
|------|----------------|----------|
| **Technician** (5) | File de tickets, formulaire diagnostic, doc photo, rapport, signature | `TicketQueueScreen, DiagnosticFormScreen, PhotoDocScreen, TechReportScreen, TechSignatureScreen` |
| **Housekeeper** (6) | Missions du jour, checklist de ménage (templates par pièce), capture photo, signalement anomalie, signature, historique | `TodayMissionsScreen, CleaningChecklistScreen, PhotoCaptureScreen, AnomalyReportScreen, SignatureScreen, HistoryScreen` |
| **Manager** (9) | Dashboard planning, création/détail/liste interventions, liste incidents, demandes de service, validation tâches, assignation/liste équipes | `PlanningDashboardScreen, CreateInterventionScreen, InterventionDetail/ListScreen, IncidentListScreen, ServiceRequestListScreen, TaskValidationScreen, TeamAssignmentScreen, TeamListScreen` |

**Checklist de ménage** (`CleaningChecklistScreen.tsx`) : templates **par pièce** (Entrée/Salon/Cuisine/SdB/Chambre, items pré-remplis), brouillon persistant **MMKV** (`checklist-drafts`), **chronomètre** de durée, items cochables. → niveau spécialiste (Breezeway/Operto/Turno) sur la checklist, mais templates **codés en dur par défaut**, pas de checklist **custom par unité** côté gestionnaire (gap).

---

## 3. Synthèse domaine 5

| Sous-domaine | Score | Commentaire |
|--------------|:-----:|-------------|
| Interventions (modèle + cycle de vie) | 3 | 19 types, machine à états, intégration paiement |
| Photos avant/après + ISSUE | 3 | Native ; manque photos de référence |
| Équipes + auto-assign géo | 3 | Routing zone+type+dispo natif (rare en PMS) |
| Inventaire propriété | 2 | Présent ; pas de réappro auto |
| Orchestration checkout → ménage auto | 3 | `ICalCleaningScheduler` + retry 15 min + post-commit |
| Compte-rendu & signature | 2 | Capture visuelle, pas e-sign légale |
| Anomalies terrain (ticket de 1er ordre) | 1–2 | Signalement oui ; pas d'entité `Issue`→work order |
| Checklist de ménage mobile | 2–3 | Templates par pièce + chrono + MMKV ; pas de custom par unité |
| **Marketplace de prestataires (sourcing cleaners)** | **0** | `MarketplaceService` = **catalogue d'intégrations** (Pennylane, serrures…), **pas** un marketplace de cleaners type Turno |

> **Score « nous » domaine 5 : 3.** Profondeur native (typage, routing géo, déclenchement auto, photos, checklist) qui rivalise avec les spécialistes sur l'exécution. **Gaps assumés :** ticket d'anomalie de premier ordre, checklists custom par unité, optimisation de tournée, sourcing de prestataires (marketplace), e-signature légale des bons de travail.
