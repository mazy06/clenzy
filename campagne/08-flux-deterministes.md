# Analyse — Flux & sous-flux déterministes (zéro LLM)

> Campagne Baitly, arbitrage n°1. Produit le 2026-07-02 à partir de deux inventaires exhaustifs
> du backend (sources d'événements + actions métier automatisables). Objectif : lister TOUT ce
> qui peut s'enchaîner de façon déterministe, prêt pour priorisation.

## 1. Constat central

**Le système possède déjà toute l'infrastructure événementielle ET un moteur de règles — il manque surtout des câblages.**

- **Événements** : outbox transactionnel → Kafka `calendar.updates` (BOOKED / CANCELLED / BLOCKED / UNBLOCKED / PRICE_UPDATED, 3 consumers), `payment.events`, `minut.webhooks` (bruit), webhooks Nuki/KeyNest (serrures), 15+ webhooks OTA/paiement, ~30 schedulers.
- **Moteur de règles existant** (`AutomationRule` + `AutomationSchedulerService` + `AutomationConditionEvaluator`, org-scopé, conditions JSON) :
  - Déclencheurs : `RESERVATION_CONFIRMED`, `CHECK_IN_APPROACHING`, `CHECK_IN_DAY`, `CHECK_OUT_DAY`, `CHECK_OUT_PASSED`, `REVIEW_REMINDER`
  - Actions : `SEND_MESSAGE` (câblée), **`SEND_CHECKIN_LINK`, `SEND_GUIDE`, `SEND_REVIEW_REQUEST` : déclarées mais JAMAIS câblées**
- **Chaînes déjà opérationnelles** (référence de style) : OTA→facture auto→commission ; SR→auto-assign→paiement→intervention ; messages check-in/out J (scheduler horaire, fuseau logement, code d'accès + lien livret injectés) ; libération caution post-check-in ; factures OVERDUE (sans relance) ; payouts quotidiens ; alertes bruit 5 min + notification.

## 2. Architecture recommandée (pas de nouveau moteur)

1. **Flux temporels** (J-X, jour J, J+X) → **étendre le moteur AutomationRule existant** : nouvelles valeurs d'enums + exécution dans `AutomationSchedulerService`. Idempotence par `AutomationExecution` (règle × réservation).
2. **Flux événementiels immédiats** (réaction à BOOKED/CANCELLED/paiement/bruit) → **un consumer Kafka dédié** `DeterministicFlowListener` sur les topics existants (groupe propre, pattern `SupervisionCalendarTriggerListener`), contexte via `TenantScopedExecutor`, chaque action best-effort indépendante (pas de saga v1 — les actions sont réversibles ou re-jouables).
3. **Aucun LLM sur ces chemins** : 0 crédit, prévisible, testable — complète (ne remplace pas) le scan supervision premium X8-b.

## 3. Catalogue des flux candidats

Notation : 🟢 = toutes les briques existent (câblage pur) · 🟡 = brique principale existante, logique à écrire · 🔴 = service métier à créer. Effort S/M/L. Risque = impact d'un faux déclenchement.

### F1 — Nouvelle réservation (`calendar.updates` action BOOKED)
| # | Sous-flux | Briques | État | Effort | Risque |
|---|---|---|---|---|---|
| F1a | **Créer l'intervention ménage post-checkout** (planifiée à la date de check-out, auto-assignée) | `ServiceRequestService.create` + `attemptAutoAssign` + `InterventionService` — LE trou le plus cité (« interventions automatiques » vendues au forfait, `cleaningFrequency=AFTER_CHECKOUT` jamais exploité) | 🟡 | M | Moyen (doublon si résa modifiée → clé d'idempotence par résa) |
| F1b | Message de confirmation/bienvenue immédiat | Trigger `RESERVATION_CONFIRMED` + `SEND_MESSAGE` existants | 🟢 | S | Faible |
| F1c | Génération anticipée du code d'accès | `AccessCodeResolverService` (aujourd'hui résolu à l'envoi du message J) | 🟢 | S | Faible |

### F2 — Annulation (action CANCELLED)
| # | Sous-flux | Briques | État | Effort | Risque |
|---|---|---|---|---|---|
| F2a | Annuler l'intervention ménage liée (si F1a) | `Reservation.intervention` (lien existant) + `InterventionLifecycleService` | 🟡 | S | Faible |
| F2b | Remboursement caution automatique | `CancellationRefundService` + `SecurityDepositService` (existants, appel MANUEL aujourd'hui) | 🟡 | M | **Élevé (argent)** → HITL ou seuil |
| F2c | Notification propriétaire/owner de l'annulation | `NotificationService` | 🟢 | S | Faible |

### F3 — Avant l'arrivée (J-X, moteur AutomationRule)
| # | Sous-flux | Briques | État | Effort | Risque |
|---|---|---|---|---|---|
| F3a | **Envoi du livret J-X** (câbler `SEND_GUIDE`) | Token + lien + interpolation existants ; l'action enum existe sans exécuteur | 🟢 | S | Faible |
| F3b | Message pré-check-in J-1 (câbler `CHECK_IN_APPROACHING`) | Scheduler messaging existant (ne fait que J exact) | 🟢 | S | Faible |
| F3c | Câbler `SEND_CHECKIN_LINK` (instructions + code) | `CheckInInstructions` + `AccessCodeResolverService` | 🟢 | S | Faible |

### F4 — Départ (CHECK_OUT_DAY / CHECK_OUT_PASSED)
| # | Sous-flux | Briques | État | Effort | Risque |
|---|---|---|---|---|---|
| F4a | **Demande d'avis post-séjour** (câbler `SEND_REVIEW_REQUEST` + relance `REVIEW_REMINDER` J+7 si pas d'avis) | Enums existants sans exécuteur ; `ReviewSyncService` pour détecter l'avis reçu | 🟢 | S/M | Faible |
| F4b | Révocation/rotation du code d'accès au checkout | `AccessCodeRotationScheduler` (rotation 24 h existe, pas liée au checkout) | 🟡 | S | Moyen (guest late checkout) |
| F4c | Remboursement caution post-checkout (auto, délai J+X) | `EscrowReleaseScheduler` (pattern) + `SecurityDepositService` | 🟡 | M | **Élevé (argent)** → délai + plafond |
| F4d | Filet : créer le ménage si F1a absent (résas legacy) | Idem F1a | 🟡 | S | Faible |

### F5 — Paiements & factures (`payment.events`, scheduler)
| # | Sous-flux | Briques | État | Effort | Risque |
|---|---|---|---|---|---|
| F5a | **Relances factures impayées** (J+3/J+7/J+15, email + notif) | `InvoiceOverdueScheduler` marque OVERDUE mais NE NOTIFIE PAS ; templates email existants | 🟡 | M | Moyen (spam si mal borné) |
| F5b | Relance caution/acompte non payé | `BookingCautionScheduler` (base) | 🟡 | M | Moyen |
| F5c | Notification interne « paiement échoué » → tâche de suivi | Webhook Stripe `charge.failed` déjà reçu | 🟢 | S | Faible |

### F6 — Alertes bruit (Minut/Tuya, temps réel)
| # | Sous-flux | Briques | État | Effort | Risque |
|---|---|---|---|---|---|
| F6a | Message guest automatique au 1er dépassement | Template Meta `clenzy_noise_alert_v1` EXISTE (WhatsApp) + alerte créée — le pont alerte→guest n'est pas câblé | 🟢 | S | Moyen (fausse alerte capteur) |
| F6b | Escalade : N alertes en X h → création incident/intervention + notification renforcée | `NoiseAlertService` (compteurs) + `InterventionService` | 🟡 | M | Moyen |
| F6c | Fermeture calendrier après incident grave | `CalendarEngine.block` | 🟡 | M | **Élevé** → jamais sans HITL |

### F7 — Santé IoT (webhooks Nuki, polling)
| # | Sous-flux | Briques | État | Effort | Risque |
|---|---|---|---|---|---|
| F7a | Batterie faible serrure → intervention maintenance préventive | Webhook Nuki `batteryCritical` DÉJÀ reçu + `create_intervention` | 🟢 | S | Faible |
| F7b | Capteur/serrure offline > X h → notification + tâche | Événements `device_offline` Minut déjà en Kafka | 🟢 | S | Faible |

### F8 — Pricing (P3, à cadrer avec le métier)
| # | Sous-flux | Briques | État | Effort | Risque |
|---|---|---|---|---|---|
| F8a | Yield rules automatiques (le modèle `YieldRules` existe, scheduler jamais fini) | PriceEngine niveaux existants | 🔴 | L | **Élevé (revenus)** |
| F8b | Alerte « tarif sous plancher » (lecture seule) | `PricingPushScheduler` + notification | 🟡 | S | Faible |

### F9 — Relation propriétaire (cron)
| # | Sous-flux | Briques | État | Effort | Risque |
|---|---|---|---|---|---|
| F9a | **Relevé propriétaire mensuel automatique** (cron le 1er, opt-in par org) | `OwnerStatementService.sendStatement` COMPLET (appelé manuellement/via agent T-09) ; « cron mensuel » prévu par la fiche agent Propriétaire | 🟢 | S | Faible |
| F9b | Relance payouts en attente d'approbation > X jours | `PayoutGenerationScheduler` (génère déjà) | 🟢 | S | Faible |

## 4. Priorisation proposée (pour arbitrage)

**Vague 1 — câblages purs, valeur immédiate, risque faible (tous 🟢, ~1 session)**
F3a livret J-X · F3b message J-1 · F3c instructions check-in · F4a demande d'avis + relance · F9a relevé mensuel auto · F7a/F7b santé IoT · F1b confirmation résa · F5c suivi paiement échoué.

**Vague 2 — le trou produit majeur + relances (🟡, logique à écrire, idempotence)**
F1a ménage auto post-checkout (+ F2a annulation liée + F4d filet) · F5a relances factures · F6a message bruit guest · F6b escalade bruit · F9b relance payouts.

**Vague 3 — flux « argent » et actions lourdes (HITL/plafonds obligatoires, arbitrage cas par cas)**
F2b remboursement annulation · F4c caution post-checkout · F4b révocation code · F6c fermeture calendrier · F8a yield rules.

## 5. Règles transverses (issues des leçons d'audit, non négociables)

- Idempotence par clé métier (règle × réservation × action) via `AutomationExecution` — jamais de double envoi/double création sur redelivery Kafka.
- Contexte tenant : `TenantScopedExecutor` partout (jamais de `tenantContext.set` nu).
- Argent : montants recalculés serveur, jamais d'appel Stripe en transaction DB, HITL en dessous d'aucun seuil (vague 3).
- Timezone : TOUJOURS `property.getTimezone()` (les J-X/J+X ont déjà causé l'overbooking Z5-BUGS-08).
- Chaque flux : toggle par org (pattern `MessagingAutomationConfig`), OFF par défaut, log + métrique `automation.flow.executed{flow,org}`.
- Échec d'action : retry Kafka/DLT ou statut explicite notifié — jamais de catch avaleur.
