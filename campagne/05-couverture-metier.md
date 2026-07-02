# Phase 5 — Couverture métier complète (16 domaines × 3 segments)

> Campagne multi-agent Baitly — livrable Gate 5. Date : 2026-07-02.
> Format par domaine : ce que fait un pro → agent(s) porteur(s) (Phase 3) → outils (Phase 4, `(N)` = à créer) → autonomie par défaut → KPI → segments → scénario end-to-end chiffré en crédits (grille Phase 2). Statut : ✅ couvert à l'issue des vagues V1-V2 · 🔶 V3 (services préalables) · P/C/H = particulier / conciergerie / petit hôtel.

---

### 1. Revenue / Yield management ✅
- **Pro** : prix par nuit ajustés à la demande, saisonnalité, événements, gap nights comblés, min-stay dynamique, revue hebdo du RevPAR vs marché.
- **Agent** : Revenue/Pricing (tier fort). **Outils** : get_price_quote, set_rate_override, recommend/simulate/benchmark/forecast, apply_pricing_rule (N), set_min_stay (N), get_local_events.
- **Autonomie** : suggérer (→ notifier via validations apprises, Phase 6). **KPI** : RevPAR vs comparables, % suggestions acceptées, gap nights comblées.
- **Segments** : P = suggestions simples hebdo ; C = multi-propriétés + arbitrage propriétaire ; H = logique chambre/type (V3 si segment ouvert).
- **Scénario** : cron dimanche → Revenue détecte 4 week-ends creux + concert local → `simulate_pricing_change` ×2 → 3 suggestions (cartes HITL org-scopées, « −8 % sem. 32, min-stay 2 » ) → host approuve → `apply_pricing_rule`. **Coût : ~35 crédits (PREMIUM_AUTO)** ; résultat attendu +2-4 % RevPAR mensuel.

### 2. Distribution / Channel management ✅ (V2)
- **Pro** : dispos et prix identiques partout, contenu à jour, zéro overbooking, réaction < 1 h aux ruptures de sync.
- **Agent** : Distribution/Channel. **Outils** : get_channel_sync_status/attribution, trigger_channel_sync (N), check_rate_parity (N), open_close_channel_availability (N), push_listing_content (N).
- **Autonomie** : notifier. **KPI** : lag de sync, incidents de parité, overbookings évités.
- **Segments** : P = 2-3 canaux iCal ; C = mix API/iCal + attribution ; H = GDS hors scope actuel.
- **Scénario** : événement Kafka « échec sync Airbnb » → Distribution vérifie (`get_channel_sync_status`), relance (`trigger_channel_sync`), contrôle la parité → notifie « resync OK, 2 nuits étaient exposées ». **Coût : ~8 crédits (SOCLE si simple alerte, PREMIUM_AUTO si correction)**.

### 3. Cycle de vie réservation ✅
- **Pro** : demande→départ sans friction ; modifs/annulations selon politique ; litiges documentés ; cautions gérées.
- **Agent** : Réservations. **Outils** : list/get/create/cancel/update, modify_reservation_dates (N), manage_deposit (N), open_dispute_case (N).
- **Autonomie** : confirmer (invariant). **KPI** : délai de traitement des demandes, litiges résolus < 7 j.
- **Segments** : P = volumes faibles, tout en confirmer ; C = politique par mandat ; H = groupes hors scope.
- **Scénario** : guest demande décalage de 2 nuits → Réservations vérifie dispo + delta tarif (`get_availability`, `get_price_quote`) → carte HITL « modifier + facturer 46 € d'écart ? » → approbation → `modify_reservation_dates` + message guest. **Coût : ~12 crédits (INTERACTIVE)**.

### 4. Communication voyageur ✅
- **Pro** : réponse < 15 min, multilingue, contextuelle (résa, logement, météo), priorisation, escalade humaine sur signal faible.
- **Agent** : Communication Voyageur. **Outils** : send_guest_message, prioritize_inbox (N), escalate_to_human (N), translate_message (N), manage_message_template (N), segment_guests.
- **Autonomie** : notifier ; auto-réponses FAQ = **socle (autonome, 0 crédit)**. **KPI** : temps de 1re réponse, taux d'escalade pertinente.
- **Segments** : P = ton chaleureux, tout-auto ; C = SLA + templates par marque ; H = réception 24/7.
- **Scénario** : message 22 h « code ne marche pas » → priorisé URGENT → réponse contextuelle (instructions serrure + code re-vérifié via SmartLockService) envoyée, host notifié ; si signal d'échec → `escalate_to_human` + `open_incident`. **Coût : 0 (socle) ; escalade ~6 crédits**.

### 5. Check-in / check-out / accès ✅ (partiel — exceptions V2)
- **Pro** : arrivée autonome fiable (serrures, codes bornés à la résa), instructions claires multilingues, gestion des exceptions (retard, clé perdue).
- **Agents** : Communication + Incident (exceptions). **Outils** : send_guest_message, get_reservation_details, run_incident_playbook (N) ; s'appuie sur SmartLock/KeyExchange/OnlineCheckIn existants.
- **Autonomie** : socle pour l'envoi d'instructions ; incident = confirmer. **KPI** : check-ins autonomes réussis, exceptions résolues < 30 min.
- **Scénario** : vol retardé 2 h du matin → guest prévient → instructions arrivée autonome re-générées (code re-validé), housekeeping du lendemain décalé (`plan_turnover_schedule`). **Coût : ~5 crédits**.

### 6. Ménage / turnover ✅
- **Pro** : planification auto sur les check-outs, affectation par charge/zone, contrôle qualité, linge suivi, aucun turnover raté.
- **Agent** : Housekeeping. **Outils** : list_cleaning_tasks, create/assign/update_intervention, plan_turnover_schedule (N), rate_intervention_quality (N).
- **Autonomie** : **autonome** (planification, socle) ; réaffectations sensibles = confirmer. **KPI** : turnovers à l'heure, qualité moyenne.
- **Segments** : P = 1 prestataire ; C = équipes + rotation ; H = staff planning (V3).
- **Scénario** : annulation J-1 puis nouvelle résa same-day → replanification auto du ménage (fenêtre 11 h-15 h), housekeeper notifiée mobile, photo qualité notée à la clôture. **Coût : 0 (socle, scanner déterministe + 1 appel léger)**.

### 7. Maintenance ✅ (V2)
- **Pro** : curatif tracé avec prestataires, préventif calendarisé (chaudière, clim, détecteurs), prédiction sur signaux IoT.
- **Agent** : Maintenance. **Outils** : predict_maintenance_needs, detect_operational_risks, create_intervention, schedule_preventive_maintenance (N), manage_service_provider (N), get_noise_alerts.
- **Autonomie** : confirmer ; préventif planifié = notifier. **KPI** : % préventif, délai de résolution, pannes évitées.
- **Scénario** : Minut remonte température anormale 3 jours → Maintenance corrèle avec l'âge du chauffe-eau → carte « intervention préventive 120 € vs risque panne week-end complet » → approbation → `create_intervention` + prestataire notifié. **Coût : ~10 crédits (PREMIUM_AUTO)**.

### 8. Finance & paiements ✅
- **Pro** : facturation systématique, encaissements suivis, payouts à date, rapprochement mensuel, remboursements selon politique.
- **Agent** : Finance/Compta. **Outils** : get_financial_summary/billing_overview, list/create_invoice, settle_intervention_payment, detect_unpaid_interventions, initiate_refund (N), reconcile_payment (N), trigger_owner_payout (N).
- **Autonomie** : confirmer (invariant). **KPI** : impayés < X j, écarts de rapprochement.
- **Scénario** : annulation J-10 politique flexible → Finance calcule le remboursement serveur (politique, jamais le montant du LLM) → carte « rembourser 320 € ? » → approbation → `initiate_refund` (idempotent, hors transaction) → ledger + guest notifié. **Coût : ~8 crédits**.

### 9. Fiscalité & conformité 🔶 V3
- **Pro** : taxe de séjour exacte par commune, numéros d'enregistrement, plafonds (Paris 120 j), TVA para-hôtelière, déclarations à date.
- **Agent** : Conformité/Fiscalité (tier fort). **Outils** (V3, service `TouristTaxService` à étendre + référentiel réglementaire) : calculate_tourist_tax, check_registration_compliance, list_tax_deadlines, export_compliance_report.
- **Autonomie** : notifier. **KPI** : échéances tenues 100 %, anomalies détectées avant contrôle.
- **Segments** : P = sa commune ; C = multi-communes multi-mandats (critique) ; H = régime hôtelier distinct.
- **Scénario** : cron mensuel → agent détecte propriété Paris à 108 jours loués → alerte « plafond 120 j dans ~5 semaines au rythme actuel » + simulation blocage calendrier → carte suggestion. **Coût : ~15 crédits (PREMIUM_AUTO)**.

### 10. Avis & réputation ✅
- **Pro** : sollicitation post-séjour systématique, réponse < 48 h à tout avis, sentiment suivi, plan qualité alimenté par les motifs récurrents.
- **Agent** : Réputation/Avis. **Outils** : list/analyze_reviews, reply_to_review, request_review (N), build_quality_plan (N).
- **Autonomie** : sollicitation = socle autonome ; réponses = suggérer. **KPI** : note moyenne, taux de réponse, délais.
- **Scénario** : avis 3★ « propreté douche » → réponse proposée (suggérer) + motif ajouté au plan qualité + Housekeeping reçoit un point de contrôle douche sur ce logement. **Coût : ~7 crédits**.

### 11. Relation propriétaire (conciergerie) ✅ (V1 — levier n°1)
- **Pro** : relevé mensuel clair, reversement à date, transparence sur commissions et interventions, communication proactive.
- **Agent** : Propriétaire. **Outils** : get_owner_payout_summary, get_property_pnl, generate_owner_statement (N), send_owner_report (N), get_commission_breakdown (N).
- **Autonomie** : relevés = socle ; envois = notifier. **KPI** : relevés à date, churn propriétaires.
- **Segments** : C uniquement (cœur) ; P = sans objet ; H = sans objet.
- **Scénario** : 1er du mois → relevés générés par mandat (commissions `CommissionInvoiceService`), synthèse par propriétaire (« 92 % occupation, 2 interventions, reversement 2 340 € le 5 ») → envoi notifié au gestionnaire → vue Constellation propriétaire (Phase 6) mise à jour. **Coût : 0 socle (génération déterministe) + ~4 crédits/synthèse rédigée**.

### 12. Analytics / BI / prévision ✅
- **Pro** : occupation/ADR/RevPAR à jour, prévisions 90 j, anomalies détectées avant qu'elles coûtent, briefing quotidien.
- **Agent** : Analytics/Prévision. **Outils** : analyze_portfolio, get_dashboard_summary/business_insights/occupancy_forecast/reservation_trend/ops_analytics, detect_anomalies (N).
- **Autonomie** : lecture seule ; briefing = socle. **KPI** : précision forecast, anomalies détectées J-avant.
- **Scénario** : briefing 7 h (Haiku, socle) : « rythme de résa août −18 % vs N-1 sur 2 logements → délégation Revenue suggérée » → l'utilisateur clique → run Revenue (scénario 1). **Coût : 0 (socle) puis 35 si analyse déclenchée**.

### 13. Marketing & réservation directe 🔶 V3
- **Pro** : annonces optimisées (photos, titres, SEO), site direct performant, fidélisation des repeat guests.
- **Agent** : Marketing/Annonces. **Outils** (V3) : audit_listing_content, optimize_listing_seo, get_direct_booking_stats, suggest_upsells. S'appuie sur le Booking Engine/Studio existant.
- **Autonomie** : suggérer. **KPI** : part de résa directe, conversion des annonces.
- **Scénario** : audit mensuel → « annonce Duplex : 12 photos vs 25 médian marché, titre sans mot-clé quartier » → suggestions de contenu + estimation d'impact → application via Studio. **Coût : ~20 crédits (PREMIUM_AUTO)**.

### 14. Screening & sécurité voyageur 🔶 V3
- **Pro** : scoring de risque à la demande de résa, vérification d'identité sur signaux faibles, cautions ajustées, liste noire.
- **Agent** : Screening/Sécurité. **Outils** : score_guest_risk (N — fraud scoring booking engine existant à exposer), verify_guest_identity (N — KYC préalable), manage_blocklist (N).
- **Autonomie** : confirmer. **KPI** : fraudes bloquées, faux positifs < seuil.
- **Scénario** : résa directe 1 nuit samedi, guest créé il y a 1 h, paiement étranger → score élevé → carte « demander vérification d'identité + caution majorée ? » → approbation → flux KYC envoyé au guest. **Coût : ~6 crédits**.

### 15. Approvisionnement & stocks 🔶 V3
- **Pro** : consommables suivis par logement, seuils, réassort anticipé sur l'occupation prévue.
- **Agent** : Approvisionnement/Stocks. **Outils** (V3, `PropertyInventoryService` à étendre) : check_inventory_levels, set_restock_thresholds, order_supplies.
- **Autonomie** : autonome sous seuils configurés. **KPI** : ruptures évitées, surstock.
- **Scénario** : housekeeper note « plus que 2 kits accueil » à la clôture d'intervention → sous le seuil (5) → commande du pack standard chez le fournisseur configuré, host notifié. **Coût : ~3 crédits (PREMIUM_AUTO)**.

### 16. Incidents & gestion de crise ✅ (V2, playbook minimal en V1)
- **Pro** : playbooks (panne, dégât des eaux, plainte bruit, no-show prestataire), escalade automatique, communication guest d'urgence, post-mortem.
- **Agent** : Incident/Crise (tier fort). **Outils** : open_incident (N), run_incident_playbook (N), notify_emergency_contacts (N), + create_intervention, send_guest_message, block_calendar_day.
- **Autonomie** : confirmer (coordination proposée en un clic). **KPI** : prise en charge < 15 min, résolution < 2 h.
- **Scénario** : alerte bruit Minut 1 h du matin + plainte voisin → Incident ouvre le dossier, propose le playbook « nuisance nocturne » : message WhatsApp template au guest (existant `clenzy_noise_alert_v1`), notification host, si récidive 30 min → contact d'urgence → 1 clic pour dérouler. **Coût : ~12 crédits**.

---

## Synthèse de couverture cible

| | V1 (outils existants) | V2 (nouveaux mutateurs) | V3 (services préalables) |
|---|---|---|---|
| Domaines complets | 1, 3, 4, 6, 8, 10, 11, 12 + 16 minimal | 2, 5, 7, 16 complet | 9, 13, 14, 15 |
| Couverture | 9/16 | 13/16 | 16/16 |

Lecture segment : **particulier** servi à ~90 % dès V1 (l'essentiel de son besoin est socle + suggestions) ; **conciergerie** différenciée dès V1 (Propriétaire + autonomie premium), complète en V2 ; **petit hôtel** reste conditionné à la décision produit (staff/groupes/GDS — Phase 6 §positionnement).
