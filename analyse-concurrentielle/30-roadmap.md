# Phase 2 — Roadmap (juin 2026 + révision juillet 2026)

> **Historique RICE juin** conservé pour traçabilité + **bilan de statut** (§1), **backlog résiduel prioritaire** (§2), **nouvelle roadmap 2026-H2 → 2027** (§3).
> RICE = (Reach × Impact × Confiance) ÷ Effort. Catégories : `Rattrapage` · `Différenciation` · `Optimisation` · `Innovation`.

> ⚠️ **Révision 2026-07-12.** La roadmap de juin partait du constat « capacités construites mais coupées » → beaucoup de « déverrouillages ». **La majorité est livrée** (vagues V2 juin + V3 juillet). Statut : **✅ Fait · 🟡 Partiel · ⬜ À faire / oublié**.

---

## 1. Bilan de la roadmap de juin — statut par initiative

### Top 15 (RICE juin) → statut juillet

| # | Initiative | RICE | **Statut** | Note |
|---|-----------|:----:|:----------:|------|
| 1 | Activer l'IA de suggestion de réponse + RAG inbox | 8.1 | ✅ **Fait** | Copilote de réponse + RAG/KB (agent Com) |
| 2 | Email de confirmation booking direct + rappels | 6.3 | ✅ **Fait** | Emails confirmation + relance panier |
| 3 | Synchro OTA au socle + Yield IA en add-on | 5.4 | 🟡 Partiel | Yield HITL livré ; « OTA au socle » = décision pricing (Axe 5) non prise |
| 4 | Comparaison N vs N-1 | 4.8 | ✅ **Fait** | Serveur + agrégation multi-devise |
| 5 | 2FA/TOTP obligatoire | 4.8 | ✅ **Fait** | Policy org `mfaRequired` (Keycloak) |
| 6 | Connecteur Zapier/Make | 4.2 | ⬜ **À faire** | Webhooks sortants prêts, connecteur non fait |
| 7 | Programme partenaire conciergerie | 4.2 | ⬜ **À faire** | GTM, pas du code |
| 8 | Module SEO du site direct | 4.05 | ✅ **Fait** | SSR + JSON-LD/sitemap/hreflang |
| 9 | Caution/dépôt pré-auth Stripe | 4.05 | ✅ **Fait** | Pré-auth + exécuteurs release/refund (V3) |
| 10 | Aligner pitch & pricing sur le code | 3.8 | 🟡 Partiel | Rebrand Baitly fait ; alignement pricing non tranché |
| 11 | Câbler/retirer la biométrie mobile | 3.6 | ⬜ **À faire** | Toujours déclarée non câblée |
| 12 | Mapping restrictions Channex + tests | 3.6 | ✅ **Fait** | Restrictions + reconciliation/watchdog + certif Channex |
| 13 | Déclaration voyageurs FR (Chekin) ⏰ | 3.6 | ✅ **Fait** | `GuestDeclaration` + soumission Chekin réelle |
| 14 | Relevé propriétaire transparent (PDF + portail) | 3.6 | 🟡 Partiel | Relevé email + montants ; **portail propriétaire** manquant |
| 15 | Ticket d'anomalie 1er ordre (Issue → bon de travail) | 3.6 | ✅ **Fait** | Entité `Issue` → maintenance chiffrée (juillet) |

**Top 15 : 9 ✅ · 3 🟡 · 3 ⬜.**

### Horizons NOW / NEXT / LATER → statut synthétique

**✅ Fait (au-delà du Top 15) :** auto-traduction inbox · édition groupée planning · **multi-agent (constellation DÉPLOYÉE, pas bêta)** · report builder léger · **website builder (Studio GrapesJS)** · KB messagerie RAG · injection taxes/frais dans la simulation de prix · détection d'anomalies (double-booking).

**🟡 Partiel :** OTA longue traîne (quelques-unes) · adapter Airbnb host-profile (sans statut partenaire) · grille de commission dégressive (`ManagementContract` livré, grille dégressive non exposée) · vision métier IA (images) · forecast CA (basique) · dashboard santé OTA (watchdog back, UI manquante) · multi-langue/RTL guest (contenu oui, layout RTL partiel).

**⬜ À faire / oublié :** réception & émission **Factur-X + PDP** ⏰ · **per-listing** + paliers + catalogue add-ons · IA de tarification (shadow/reco, `pricing-ai` OFF) · **SMS natif** · KYC réel (Sumsub) · checklists custom par unité · sync réelle QuickBooks/Xero · connecteur Beyond Pricing · orphan-day/gap-fill · optimisation de tournée · autopilot guest IA · connectivité + déclaration voyageurs **MENA** · SOC 2 · marketplace ouvert · Key Data · rapprochement bancaire · activités affiliées Viator.

> **Hors roadmap de juin, livrés en plus (juillet) :** **Moteur Ménage complet** (prix conseil + tarifs prestataires + payout gaté preuve photo + anomalie→maintenance + score qualité) · **autonomie déterministe de la constellation** (AutoApplyGate + Règles de Confiance) · versements prestataires (onglet Finance) · parité mobile pro (tarifs/versements/signalements) + locale arabe.

---

## 2. Manques de la roadmap de juin — à traiter EN PREMIER

> Le résidu du 🟡/⬜, ordonné par priorité. C'est le **socle de la nouvelle roadmap** avant d'ajouter du neuf.

1. **Repricing per-listing hybride** + grandfathering + **catalogue d'add-ons facturables** *(Axe 5 — priorité stratégique n°1 ; frein économique majeur, produit sous-valorisé sur la cible conciergerie).*
2. **Conformité e-invoicing : réception Factur-X ⏰ (09/2026) → émission + pont PDP** *(Axe 2 — daté, fossé réglementaire).*
3. **Zapier/Make** sur les webhooks existants *(faible effort, gros déblocage d'écosystème).*
4. **GTM :** programme partenaire conciergerie + alignement pitch/pricing + **portail propriétaire transparent** (relevé + payouts + docs signés — killer feature conciergerie).
5. **Vérification Stripe test-mode du payout ménage** *(pré-requis de déploiement — money-path non exercé en réel).*
6. **IA de tarification** en mode reco (`pricing-ai`) · **SMS natif** · **KYC Sumsub** réel · checklists custom · sync réelle QuickBooks/Xero · statut partenaire Airbnb + OTA longue traîne.
7. *(Later)* SOC 2 Type II · connectivité + déclaration voyageurs **MENA** · marketplace ouvert · forecast CA complet · rapprochement bancaire.

---

## 3. Nouvelle roadmap 2026-H2 → 2027 (nouveaux éléments détaillés)

### North star
> Baitly a rattrapé la parité (V3 = 2.31, ex æquo Hostaway) et détient **2 moats** (conformité multi-pays + économie du ménage). La prochaine étape n'est plus le rattrapage : c'est **capturer la valeur créée**, rendre les 2 moats **irrattrapables**, et fermer les **2 derniers trous core** (Yield 1.9, Intégrations 1.5).

<!--ROADMAP-TIMELINE-->

### Les 3 paris structurants

**Pari 1 — Capturer la valeur (levier n°1, surtout non-technique).**
Bascule **per-listing hybride** (quota de sièges généreux inclus, anti-Smoobu) + grandfathering des clients actuels + **catalogue d'add-ons** : payout ménage à la preuve, IA premium, yield, IoT, signature QTSP. *Rationnel : une conciergerie 50 lots paie ~70 €/mois pour du Guesty-grade → ARPA potentiellement ×5 sans nouvelle feature. Composants : refonte des plans, `ManagementContract`, facturation.*

**Pari 2 — Hisser le Yield au niveau marché (dernier trou core).**
Déverrouiller l'**IA de tarification** en gradué **shadow → reco → auto** via l'agent **Revenue de la constellation** (réutilise cartes HITL + autonomie) ; **connecteurs PriceLabs/Beyond** ; **market data** ; yield avancé (**orphan-day / gap-fill**, pricing événementiel, injection taxes/TTC déjà là). *Rationnel : Tarification/Yield = 1.9, le domaine core le plus faible (Guesty/Hostaway 2.7) — meilleur ROI compétitif. Composants : `YieldRule`, `pricing-ai`, `ExternalPricingService`.*

**Pari 3 — Creuser le moat ménage jusqu'au bout.**
On a la chaîne économique ; il manque le **seul avantage restant de Turno** : **marketplace de sourcing de prestataires** + **auto-assignation par score qualité** (déjà calculé) + **inspection photo par IA (vision)** + suivi des consommables + notation croisée. *Rationnel : faire du ménage un « mini-Turno intégré » — impossible à répliquer pour un PMS généraliste sans refondre ses opérations. Composants : `HousekeeperRate`, score qualité, `InterventionPhotoService`, Vision.*

### 🟢 NOW (0-3 mois) — capturer, déverrouiller, finir le réglementaire

| Initiative | Détail | Pari / Axe |
|---|---|---|
| **Repricing per-listing hybride** | Métrique socle par logement + quota sièges inclus + grandfathering ; migration tarifaire outillée | Pari 1 |
| **Catalogue d'add-ons facturables** | Payout ménage à la preuve, IA premium, yield, IoT, signature — en options | Pari 1 |
| **IA de tarification en reco** | Déverrouiller `pricing-ai` en mode shadow/reco via l'agent Revenue (cartes HITL) | Pari 2 |
| **Réception Factur-X ⏰** | Capacité de réception avant l'échéance 09/2026 | Axe 2 |
| **Zapier/Make** | Connecteur sur les webhooks sortants existants (HMAC/retry déjà là) | Axe 4 |
| **Vérif Stripe test-mode payout ménage → déploiement** | AccountLink + Account Sessions + Transfers en test-mode, puis prod | Pari 3 |
| **Portail propriétaire transparent** | Relevé + payouts + documents signés en self-service — killer conciergerie | Pari 1 / GTM |

### 🟡 NEXT (3-9 mois) — creuser les moats, fermer les gaps

| Initiative | Détail | Pari / Axe |
|---|---|---|
| **Marketplace prestataires ménage** | Vivier de prestataires bookables + backup auto | Pari 3 |
| **Auto-assignation par score qualité** | Le score 30 j pilote l'attribution des missions | Pari 3 |
| **Inspection photo par IA (Vision)** | Contrôle qualité automatique des photos de fin de mission | Pari 3 |
| **Yield avancé** | PriceLabs/Beyond, market data, orphan-day/gap-fill, pricing événementiel | Pari 2 |
| **Factur-X émission + PDP · ZATCA émission live (KSA)** | Émission conforme multi-pays | Axe 2 |
| **Autopilot messagerie IA** | Réponses auto sous garde-fous, via l'agent Com | Axe 3 |
| **SMS natif · KYC Sumsub réel · sync QuickBooks/Xero** | Combler les gaps résiduels | Axes 2/4 |

### 🔵 LATER (9m+) — expansion & fondations

| Initiative | Détail | Pari / Axe |
|---|---|---|
| **MENA go-live** | Shomoos/DGSN, connectivité OTA régionale, layout RTL guest | Axes 1/2 |
| **Constellation v2** | Orchestration cross-domaine + **prédictif** (anticiper annulations/incidents) + agent portefeuille | Axe 3 |
| **Marketplace ouvert** | Portail développeur + intégrations self-service | Axe 4 |
| **SOC 2 Type II** | Trajectoire de certification | Axe 2 |
| **Revenue management suite** | Forecast CA, pacing, benchmarking (Key Data) | Pari 2 |

### Fil rouge — la constellation comme multiplicateur
Chaque nouvelle capacité (Yield IA, autopilot, prédictif, auto-assign ménage) se branche sur **le même socle multi-agent** (agent dédié + cartes HITL + autonomie graduée déjà construits). C'est un **avantage cumulatif** que les concurrents à IA « bolt-on » n'ont pas : plus on ajoute de domaines, plus l'orchestration prend de valeur.
