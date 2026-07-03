# Phase 4 — Catalogue d'outils enrichi

> Campagne multi-agent Baitly — livrable Gate 4. Date : 2026-07-02.
> Base : inventaire Phase 0 (60 outils : 45 R / 15 W, tous mutateurs sous HITL) + roster/vagues Phase 3. Infrastructure conservée : `ToolHandler`/`ToolDescriptor` (JSON Schema + `requiresConfirmation`), `ToolRegistry` (unicité au boot), `ToolScopeSelector`, `AgentActionAuditService`.

---

## 1. Principes de conception (normalisation, applicable aux 60 existants et aux nouveaux)

1. **Un outil = une action métier atomique**, nom français `verbe_objet` sans ambiguïté (convention existante conservée : `create_reservation`… ; nouveaux outils en anglais technique cohérent avec l'existant).
2. **Effets déclarés** : `ToolDescriptor` étendu d'un champ `mutating: boolean` explicite (aujourd'hui implicite via `requiresConfirmation`) — c'est lui qui pilote le gate d'autonomie 4 niveaux (Phase 3 §6) : un mutateur exécuté par un agent en mode `confirmer` → pending_action ; en mode `notifier`/`autonome` → exécution + trace + notification.
3. **Idempotence obligatoire pour tout mutateur à effet externe** (paiement, envoi, création) : clé `run_id:step_seq:tool` transmise au service (pattern `StripeGateway` existant). Mutateurs internes : opérations naturellement idempotentes (upsert, state machine) ou contrainte unique DB.
4. **Auth par outil côté backend** : la validation tenant reste dans le service métier (architecture actuelle saine) MAIS règle nouvelle issue de l'audit : **tout nouveau service appelé par un outil doit prouver son check tenant** (`requireSameOrganization` / filtre Hibernate) — ajouté à la checklist de revue (§4) car c'est le seul maillon dont dépend toute la chaîne.
5. **Retours compacts structurés** : JSON, listes paginées max 50 (existant), cap 8k chars (existant), `displayHint` pour widgets. Nouveauté : champ `summary` court en tête de tout retour volumineux (le LLM peut souvent s'en contenter → tokens).
6. **Descriptions ≤150 chars** + schémas sans propriétés redondantes (levier L3 Phase 1).
7. **Coût annoncé** : les outils déclencheurs d'actions coûteuses (analyses, générations) exposent `estimatedCredits` dans leur descriptor → estimation pré-action UX (Phase 2 §8) sans appel supplémentaire.

## 2. Mapping agent → outils (roster Phase 3)

`(E)` = outil existant, `(N)` = à créer. ≤10 outils par agent (contrainte `AbstractAgentSpecialist` conservée).

| Agent | Outils |
|---|---|
| **Revenue/Pricing** | get_price_quote (E), set_rate_override (E), recommend_price_adjustments (E), simulate_pricing_change (E), benchmark_competition (E), forecast_demand_longterm (E), **apply_pricing_rule (N)**, **set_min_stay (N)**, get_local_events (E) |
| **Distribution/Channel** | get_channel_sync_status (E), get_channel_attribution (E), **trigger_channel_sync (N)**, **check_rate_parity (N)**, **open_close_channel_availability (N)**, **push_listing_content (N)** |
| **Réservations** | list/get/create/cancel/update_reservation* (E×5), **modify_reservation_dates (N)**, **manage_deposit (N)**, **open_dispute_case (N)** |
| **Communication Voyageur** | send_guest_message (E), list_guests (E), segment_guests (E), **prioritize_inbox (N)**, **escalate_to_human (N)**, **translate_message (N)**, **manage_message_template (N)** |
| **Housekeeping** | list_cleaning_tasks (E), create/assign/update_intervention* (E×3), **plan_turnover_schedule (N)**, **rate_intervention_quality (N)** |
| **Maintenance** | predict_maintenance_needs (E), detect_operational_risks (E), create_intervention (E), **schedule_preventive_maintenance (N)**, **manage_service_provider (N)**, get_noise_alerts (E) |
| **Finance/Compta** | get_financial_summary (E), list/create_invoice (E×2), settle_intervention_payment (E), detect_unpaid_interventions (E), get_billing_overview (E), **initiate_refund (N)**, **reconcile_payment (N)**, **trigger_owner_payout (N)** |
| **Conformité/Fiscalité** (V3) | **calculate_tourist_tax (N — service `TouristTaxService` à étendre)**, **check_registration_compliance (N)**, **list_tax_deadlines (N)**, **export_compliance_report (N)** |
| **Réputation/Avis** | list_reviews (E), analyze_reviews (E), reply_to_review (E), **request_review (N)**, **build_quality_plan (N)** |
| **Propriétaire** | get_owner_payout_summary (E), get_property_pnl (E), **generate_owner_statement (N — service `OwnerStatementService` existant)**, **send_owner_report (N)**, **get_commission_breakdown (N — `CommissionInvoiceService` existant)** |
| **Analytics/Prévision** | analyze_portfolio (E), get_dashboard_summary (E), get_business_insights (E), get_occupancy_forecast (E), get_reservation_trend (E), get_ops_analytics (E), **detect_anomalies (N — généralisation scanners supervision)** |
| **Marketing/Annonces** (V3) | **audit_listing_content (N)**, **optimize_listing_seo (N)**, **get_direct_booking_stats (N — booking engine existant)**, suggest_upsells (E) |
| **Screening/Sécurité** (V3) | **score_guest_risk (N — fraud scoring booking engine existant, à exposer)**, **verify_guest_identity (N — service KYC préalable)**, **manage_blocklist (N)** |
| **Incident/Crise** | **open_incident (N — `IncidentService` à étendre)**, **run_incident_playbook (N)**, **notify_emergency_contacts (N)**, create_intervention (E), send_guest_message (E), block_calendar_day (E) |
| **Approvisionnement/Stocks** (V3) | **check_inventory_levels (N — `PropertyInventoryService` à étendre)**, **set_restock_thresholds (N)**, **order_supplies (N)** |
| **Upsell** | suggest_upsells (E), **create_upsell_offer (N — primitive upsells booking engine existante)**, **track_upsell_conversion (N)** |
| **Transverse crédits (Phase 2)** | **get_credit_balance (N)**, **estimate_action_cost (N)** — lecture seule, socle |

## 3. Outils manquants priorisés (32 nouveaux)

| Prio | Outil | Vague | Service d'ancrage | R/W | HITL défaut | Idempotence |
|---|---|---|---|---|---|---|
| 1 | initiate_refund | V1 | `CancellationRefundService` + `StripeGateway` (existants) | W | confirmer (invariant) | clé Stripe (pattern canonique) |
| 2 | modify_reservation_dates | V1 | `ReservationService` (existant) | W | confirmer | vérif dispo + state machine |
| 3 | generate_owner_statement | V1 | `OwnerStatementService` (existant) | W (génère doc) | notifier | par période (unique) |
| 4 | apply_pricing_rule / set_min_stay | V1 | `AdvancedRateManager`/YieldRules (existants) | W | confirmer (invariant tarif) | upsert par règle |
| 5 | request_review | V1 | messaging existant + template | W | autonome-socle possible | 1/résa (contrainte unique) |
| 6 | escalate_to_human / prioritize_inbox | V1 | notifications + conversations (existants) | W/R | notifier | n/a |
| 7 | translate_message | V1 | LLM tier petit (pattern `translate-html` existant) | R | — | n/a |
| 8 | get_credit_balance / estimate_action_cost | V1 | Phase 2 (`CreditMeteringService`) | R | — | n/a |
| 9 | trigger_channel_sync / open_close_channel_availability | V2 | `ChannelSyncService` + CalendarEngine (existants, mutateurs à exposer) | W | notifier | outbox pattern existant |
| 10 | check_rate_parity | V2 | nouveau service (lecture multi-canal) | R | — | n/a |
| 11 | manage_deposit / open_dispute_case | V2 | cautions existantes + workflow litige (nouveau léger) | W | confirmer | state machine |
| 12 | plan_turnover_schedule / rate_intervention_quality | V2 | `InterventionPlanningService` (existant) | W | autonome (planif) | recalcul idempotent |
| 13 | schedule_preventive_maintenance / manage_service_provider | V2 | `InterventionService` + modèle prestataires (léger nouveau) | W | confirmer | par plan |
| 14 | reconcile_payment / trigger_owner_payout | V2 | `ReconciliationService` + `PayoutExecutionService` (existants) | W | confirmer (invariant) | clés paiement |
| 15 | open_incident / run_incident_playbook / notify_emergency_contacts | V2 | `IncidentService` à étendre + playbooks (config) | W | confirmer | par incident |
| 16 | manage_message_template / build_quality_plan / detect_anomalies / push_listing_content / create_upsell_offer / track_upsell_conversion / send_owner_report / get_commission_breakdown | V2 | services existants à exposer | mixte | selon effet | selon effet |
| 17 | outils Conformité (×4), Screening (×3), Marketing (×3), Stocks (×3) | V3 | **services PMS à créer d'abord** (Phase 5) | mixte | notifier/confirmer | à spécifier avec les services |

**Exemple de spec complète (gabarit pour toutes les fiches d'implémentation)** — `initiate_refund` :
- Signature : `{reservationId: long, amountCents?: int, reason: enum[CANCELLATION|GESTURE|DISPUTE], note?: string}` — sans `amountCents`, le serveur calcule depuis la politique d'annulation (**jamais de montant client-trusted** ; s'il est fourni : cross-check, 400 si écart) .
- Service : `CancellationRefundService` → `StripeGateway` (RequestOptions + idempotency key `run_id:step:refund:{reservationId}`), appel Stripe **hors transaction DB** (règle absolue n°2).
- Auth : service valide org + statut résa remboursable ; rôle ≥ HOST.
- Retour : `{refundId, amountCents, status, summary}`.
- HITL : `confirmer` quel que soit le niveau d'autonomie (invariant paiement).
- Audit : AgentActionAuditService (write) + ligne ledger crédits du run.

## 4. Checklist sécurité & auditabilité (revue obligatoire de tout nouvel outil)

- [ ] Le service appelé valide le tenant (`requireSameOrganization` / filtre Hibernate) — **prouvé, pas supposé** (le seul maillon critique identifié en Phase 0).
- [ ] Aucun paramètre `organizationId`/montant/prix venant du LLM n'est de confiance : recalcul ou cross-check serveur (règle absolue n°1).
- [ ] Mutateur → `requiresConfirmation` par défaut ; dérogation = décision explicite tracée dans la matrice d'autonomie.
- [ ] Idempotence spécifiée (clé ou nature de l'opération) avant merge.
- [ ] Appels externes hors transaction DB (règle n°2) ; effets post-commit via `afterCommit`.
- [ ] Description ≤150 chars, schéma minimal, retour avec `summary`.
- [ ] Audit : write → `AgentActionAuditService` (PII maskée) + `agent_step` (D-001) ; sortie de raisonnement sanitizée avant affichage (échappement HTML — `StringUtils.escapeHtml`, règle n°4).
- [ ] Test : au minimum un test du refus cross-tenant + un test d'idempotence pour les mutateurs.
- [ ] Enregistrement `ToolScopeSelector` (domaine) + `RoleToolPolicy` (rôles autorisés) + tier/scope agent (mapping §2).

## 5. Corrections sur l'existant (dette outillage, Phase 0)

1. `set_rate_override` : rejeter les dates passées (aligné sur `block_calendar_day`).
2. Compression des 60 descriptions existantes au gabarit ≤150 chars (levier L3).
3. Étendre `ToolDescriptor` : `mutating`, `estimatedCredits` (principes 2 et 7).
4. Renommer `multiagent.ConfirmationRequiredException` → `MultiAgentConfirmationRequiredException` (collision de noms, dette Phase 0 #7).
