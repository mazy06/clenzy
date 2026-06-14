# Phase 2 — Roadmap priorisée (RICE)

> Agrège les initiatives des 13 sous-agents. **RICE = (Reach × Impact × Confiance) ÷ Effort**, avec Reach 1–3, Impact 1–3, Confiance 0–1, Effort S=1 / M=2 / L=3. Score élevé = priorité haute.
> Catégories : `Rattrapage` (gap critique) · `Différenciation` · `Optimisation` · `Innovation`. Date : 2026-06-13.

**Insight de priorisation :** beaucoup des meilleurs scores RICE sont des **déverrouillages** (activer un flag, brancher l'existant) — impact fort, effort minime. C'est la conséquence directe du constat « capacités construites mais coupées ».

---

## Top 15 initiatives (par RICE)

| # | Initiative | Domaine | Catégorie | R | I | C | Eff | **RICE** | Horizon |
|---|-----------|---------|-----------|:-:|:-:|:-:|:-:|:----:|:------:|
| 1 | Activer l'IA de suggestion de réponse + brancher RAG à l'inbox | Communication/IA | Différenciation | 3 | 3 | 0.9 | S | **8.1** | Now |
| 2 | Brancher l'email de confirmation du booking direct + rappels | Booking | Rattrapage | 3 | 3 | 0.7 | S | **6.3** | Now |
| 3 | Intégrer la synchro OTA au socle + Yield IA en add-on | Pricing/Packaging | Optimisation | 3 | 2 | 0.9 | S | **5.4** | Now |
| 4 | Exposer la comparaison N vs N-1 (dashboards & rapports) | Reporting | Rattrapage | 3 | 2 | 0.8 | S | **4.8** | Now |
| 5 | 2FA/TOTP applicative obligatoire (via Keycloak) | Sécurité | Rattrapage | 3 | 2 | 0.8 | S | **4.8** | Now |
| 6 | Connecteur Zapier/Make sur les webhooks existants | Intégrations | Rattrapage | 3 | 3 | 0.7 | S+ | **4.2** | Now |
| 7 | Programme partenaire conciergerie (multi-org, white-glove) | GTM | Différenciation | 3 | 2 | 0.7 | S | **4.2** | Now |
| 8 | Module SEO du site direct (meta/schema/sitemap/hreflang) | Booking | Différenciation | 3 | 3 | 0.9 | M | **4.05** | Now→Next |
| 9 | Caution/dépôt via pré-autorisation Stripe (auth-hold) | Finance/GuestExp | Rattrapage | 3 | 3 | 0.9 | M | **4.05** | Now |
| 10 | Aligner pitch & pricing sur le code (retirer « 39 €/bien », claims honnêtes) | GTM | Optimisation | 2 | 2 | 0.95 | S | **3.8** | Now |
| 11 | Câbler la biométrie mobile OU retirer la promesse | Mobile | Optimisation | 2 | 2 | 0.9 | S | **3.6** | Now |
| 12 | Mapping complet des restrictions Channex + tests anti-régression | Channel | Rattrapage | 3 | 3 | 0.8 | M | **3.6** | Now |
| 13 | Déclaration voyageurs FR via Chekin (sortir du stub) ⏰ | Conformité | Rattrapage | 3 | 3 | 0.8 | M | **3.6** | Now (urgent) |
| 14 | Relevé propriétaire transparent (PDF multi-période + portail) | Finance/GTM | Différenciation | 3 | 3 | 0.8 | M | **3.6** | Now→Next |
| 15 | Ticket d'anomalie de 1er ordre (Issue → bon de travail) | Opérations | Rattrapage | 3 | 3 | 0.8 | M | **3.6** | Next |

---

## Horizon NOW (0–3 mois) — quick wins, urgences réglementaires, gaps critiques

| Initiative | Domaine | Catégorie | RICE | Dépendances |
|-----------|---------|-----------|:----:|-------------|
| Activer l'IA de suggestion de réponse + RAG inbox | Communication/IA | Différenciation | 8.1 | flags `messaging-ai` ; UX inbox |
| Brancher l'email de confirmation booking direct + rappels | Booking | Rattrapage | 6.3 | templates ; `PublicBookingService` |
| Synchro OTA au socle + Yield IA en add-on | Packaging | Optimisation | 5.4 | refonte plans (init. pricing) |
| Exposer la comparaison N vs N-1 | Reporting | Rattrapage | 4.8 | donnée déjà présente |
| 2FA/TOTP obligatoire | Sécurité | Rattrapage | 4.8 | Keycloak |
| Connecteur Zapier/Make | Intégrations | Rattrapage | 4.2 | webhooks existants |
| Programme partenaire conciergerie | GTM | Différenciation | 4.2 | grille pricing multi-org |
| Caution via pré-autorisation Stripe | Finance/GuestExp | Rattrapage | 4.05 | `StripeGateway` ; check-in |
| Aligner pitch & pricing sur le code | GTM | Optimisation | 3.8 | décision commerciale |
| Câbler/retirer la biométrie mobile | Mobile | Optimisation | 3.6 | `expo-local-authentication` |
| Mapping restrictions Channex + tests | Channel | Rattrapage | 3.6 | API Channex |
| **Déclaration voyageurs FR (Chekin) ⏰** | Conformité | Rattrapage | 3.6 | échéance registre 20/05/2026 **dépassée** |
| **Capacité de réception Factur-X ⏰** | Conformité | Rattrapage | 3.5 | échéance 01/09/2026 |
| Activités affiliées live (Viator) + reporting commission | GuestExp | Innovation | 3.2 | clé partenaire Viator |
| Livrer l'insight IA reporting (lever `analytics-ai`) | Reporting/IA | Rattrapage | 2.8 | flag |

## Horizon NEXT (3–9 mois) — différenciation & rattrapages structurants

| Initiative | Domaine | Catégorie | RICE | Dépendances |
|-----------|---------|-----------|:----:|-------------|
| Module SEO du site direct | Booking | Différenciation | 4.05 | — |
| Relevé propriétaire transparent (PDF + portail) | Finance/GTM | Différenciation | 3.6 | owner-portal |
| Ticket d'anomalie de 1er ordre | Opérations | Rattrapage | 3.6 | modèle `Issue` |
| Activer l'IA de tarification (shadow/reco) | Pricing/IA | Différenciation | 3.15 | flag `pricing-ai` |
| Auto-traduction bidirectionnelle inbox | Communication | Optimisation | 3.2 | `TranslationService` |
| OTA longue traîne via Channex (Agoda, GVR, Trip.com) | Channel | Optimisation | 2.8 | Channex |
| Canal SMS natif (`SmsChannel`) | Communication | Rattrapage | 2.7 | provider SMS |
| Grille de commission dégressive (`ManagementContract`) | Finance | Optimisation | 2.6 | — |
| Bascule pricing per-listing hybride + grandfathering | Business model | Différenciation | 2.4 | migration tarifaire |
| **Générateur Factur-X + pont PDP (émission) ⏰** | Conformité | Différenciation | 2.4 | échéance 09/2027 PME |
| Édition groupée (bulk) depuis le planning | Calendrier | Optimisation | 2.4 | — |
| Checklists custom par unité + photos de référence | Opérations | Optimisation | 2.4 | — |
| Brancher KYC réel (Sumsub) au check-in | Conformité/GuestExp | Rattrapage | 2.4 | `integration/kyc` |
| Orphan-day / gap-fill explicite avec reco | Pricing | Optimisation | 2.4 | `YieldRule` |
| Paliers dégressifs + minimum mensuel (plan Business) | Pricing | Optimisation | 2.25 | refonte plans |
| Report builder léger (vues sauvegardables + partage) | Reporting | Rattrapage | 2.1 | — |
| Multi-agent IA en bêta encadrée | IA | Différenciation | 2.1 | flag multi-agent |
| Finaliser l'adapter Airbnb (host-profile) + statut partenaire | Channel | Rattrapage | 2.1 | API Airbnb |
| Catalogue d'add-ons aligné marché | Monétisation | Optimisation | 2.1 | refonte plans |
| Injecter taxes/frais dans la simulation de prix | Pricing | Optimisation | 1.8 | `FiscalEngine` |
| Sync réelle QuickBooks + Xero | Finance | Rattrapage | 1.7 | OAuth déjà câblé |
| Connecteur Beyond Pricing | Pricing | Optimisation | 1.6 | interface `ExternalPricingService` |
| KB messagerie branchée à l'IA (RAG) | Communication/IA | Différenciation | 1.6 | RAG pgvector |

## Horizon LATER (9+ mois) — innovation, gros efforts, expansion

| Initiative | Domaine | Catégorie | RICE | Dépendances |
|-----------|---------|-----------|:----:|-------------|
| Website builder no-code + templates STR | Booking | Différenciation | 2.4 | gros chantier front |
| Détection d'anomalies / fraude paiement | IA/Sécurité | Rattrapage | 1.6 | socle IA |
| Autopilot guest IA avec garde-fous | IA | Différenciation | 1.4 | init. IA messagerie |
| Dashboard santé connectivité OTA (watchdog UI) | Channel | Différenciation | 1.4 | OTA watchdog |
| Vision métier + résumés IA | IA | Optimisation | 1.4 | `VisionTokenUsageService` |
| Multi-langue auto-traduit + RTL côté guest | GuestExp | Différenciation | 1.4 | (ambition MENA) |
| Approfondir le portail propriétaire côté calendrier | Calendrier | Différenciation | 1.4 | owner-portal |
| Compléter le forecast (projection CA + horizon) | Reporting | Différenciation | 1.2 | `AiAnalyticsService` |
| Optimisation de tournée (ordonnancement géo) | Opérations/Mobile | Optimisation | 1.2 | auto-assign |
| Connectivité OTA MENA (Almosafer/Cleartrip/Hala) | Channel | Innovation | 1.2 | partenariats régionaux |
| Trajectoire SOC 2 Type I → II | Sécurité | Différenciation | 1.2 | audit externe |
| Marketplace ouvert (portail dev + self-service) | Intégrations | Différenciation | 0.8 | — |
| Déclaration/registration voyageurs MENA | Conformité | Différenciation | 0.8 | (ambition MENA) |
| Connecteur données marché (Key Data) | Reporting | Différenciation | 0.67 | partenariat data |
| Rapprochement bancaire via Open Banking | Finance | Différenciation | 0.4 | Open Banking PIS |

---

## Vue timeline (Now / Next / Later)

```
        NOW (0-3 mois)            NEXT (3-9 mois)              LATER (9+ mois)
        ┌───────────────────┐    ┌───────────────────────┐    ┌────────────────────────┐
IA      │ Activer IA msg/RAG │    │ IA pricing · multi-ag │    │ Autopilot · anomalies  │
        │ Insight IA report  │    │ KB messagerie         │    │ Vision · résumés       │
Conf.   │ Décl. voyageurs ⏰ │    │ Factur-X émission ⏰  │    │ Décl. MENA · SOC 2     │
        │ Réception Factur-X │    │ KYC Sumsub check-in   │    │                        │
Finance │ Caution Stripe     │    │ Relevé proprio · QB/Xero │ Rappro. bancaire       │
Channel │ Restrictions Channex│   │ OTA traîne · Airbnb HP │    │ MENA · watchdog UI     │
Booking │ Email confirm.     │    │ SEO site direct       │    │ Website builder        │
Reporting│ N vs N-1          │    │ Report builder        │    │ Forecast CA · Key Data │
Pricing │ OTA socle+add-on   │    │ Per-listing · paliers │    │                        │
Comm.   │                    │    │ SMS · auto-traduction │    │                        │
Ops/Mob │ Biométrie          │    │ Ticket anomalie · checklists │ Optim. tournée      │
Sécu/Int│ 2FA · Zapier       │    │                       │    │ Marketplace ouvert     │
GTM     │ Partenaire · pitch │    │ Add-ons · commission dégr. │                        │
        └───────────────────┘    └───────────────────────┘    └────────────────────────┘
```

⏰ = échéance réglementaire critique. Les quick wins NOW (RICE > 4) sont majoritairement des **activations de l'existant** — à traiter en premier (ROI immédiat).
