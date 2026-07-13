# Plan de lancement Baitly

> **Objectif** : passer du produit construit à un produit **stable, complet et vendable**, le plus tôt possible.
>
> **Cadre retenu (2026-07-13)** : marché de lancement = **Maroc d'abord** · périmètre = **produit complet** · mise sur le marché = **self-serve**.
>
> ⚠️ C'est la **combinaison la plus exigeante** des trois : tout stabiliser + automatiser la vente + conformité Maroc. Le plan vise malgré tout le chemin le plus court, et signale un **point dur** (l'encaissement au Maroc).

---

## État des lieux — audit du 2026-07-13

**Bonne nouvelle : le code est propre et synchronisé.**
- `main` = `origin/main` : **aucun travail local non poussé**, working tree propre.
- Le produit est **très complet** et **entièrement commité**.

**Le vrai écart : le produit complet n'est pas déployé.**
- **31 commits sont sur `main` mais PAS en production** (prod figée au **2026-07-09**, `main` au 2026-07-12).
- Ils incluent nos **différenciateurs clés** :

| Livré sur `main`, pas en prod | Ce que c'est |
|---|---|
| **Moteur Ménage** (Phases 1-4) | Le 2ᵉ moat : prix conseillé, payout à la preuve, anomalie→maintenance |
| **Constellation** autonomie déterministe (Vagues 1-3) | L'IA qui agit : blocage, cautions, relances, Règles de Confiance |
| **Channex** (intégration complète + certification) | Channel manager natif |
| Perf (N+1, bundle, dashboard agrégé) · versements prestataires · fix déconnexions (session BFF) | Stabilité & fiabilité |

> **1ʳᵉ action de consolidation** : **déployer `main` → production** (PR `main → production` → CD Deploy → migrations Liquibase au boot). C'est ce qui met le « produit complet » **réellement en ligne**.

---

## Les 3 conditions pour vendre

1. **Ça tient** — stable, fiable, monitoré.
2. **On peut encaisser** — facturation self-serve + paiements.
3. **C'est conforme et légal** — Maroc + RGPD.

*Le go-to-market se prépare en parallèle.*

---

## Phase 0 — Consolider l'existant

- ✅ **Inventaire de l'état réel** (ci-dessus) — fait.
- **Déployer les 31 commits `main → production`** (par lots si besoin), avec vérification après chaque déploiement.
- **Environnement staging/démo stable** (données mock existantes).
- **Figer le périmètre v1** : liste explicite des modules « GA » (généralement disponibles).
- **DoD** : tout le produit complet tourne en prod/staging, démo-able de bout en bout.

## Phase 1 — Stabilité & fiabilité *(le produit doit tenir)*

- **Money paths en Stripe test-mode** : payout ménage *(blocker connu)*, caution pré-autorisée, checkout booking, remboursements. **DoD** : chaque flux prouvé.
- **Parcours critiques E2E** (drivés au navigateur) : inscription → org → propriété → sync canal → réservation → paiement → ménage → payout → facture. **DoD** : 0 erreur bloquante.
- **Monitoring / alerting** (Grafana/Prometheus déjà en place) + error tracking + uptime (5xx, jobs, sync).
- **Sécurité** : re-vérifier l'audit (pas de régression), isolation multi-tenant.
- **Robustesse UX** : états empty/error/loading, i18n complet **fr/en/ar + RTL** (l'arabe compte pour le Maroc).
- **Data** : backups + restauration testée.

## Phase 2 — Monétisation self-serve *(vendre sans intervention)*

- ⚠️ **Décision prix requise** (per-listing + socle + add-ons).
- **Facturation SaaS abonnement** (Stripe Billing) pour NOS clients — distincte des paiements voyageurs : plans, essai gratuit, upgrade/downgrade, proration, relances d'impayés, factures.
- **Parcours d'inscription self-serve** : signup → vérif email → création org → choix plan → paiement → activation.
- **Onboarding guidé** (wizard) : connecter les canaux, ajouter/importer les propriétés, inviter l'équipe, 1er logement en ligne.
- **Espace facturation client** (factures, moyen de paiement, plan).
- **DoD** : un prospect s'inscrit, paie et devient opérationnel **sans intervention humaine**.

## Phase 3 — Conformité marché Maroc

- **Déclaration voyageurs DGSN** (sous 24h) — brancher / vérifier le connecteur.
- **Fiscalité** : IR locatif + **taxe de séjour** (~15 MAD/pers/nuit) dans la facturation & le reporting.
- **Devise MAD** + langue **arabe (RTL)** + formats locaux.
- **Légal** : CGU/CGV, politique de confidentialité (**RGPD + loi marocaine 09-08**), DPA, bandeau cookies.
- **DoD** : une conciergerie marocaine peut opérer **en conformité** via Baitly.

## Phase 4 — Go-to-market

- **Landing + page pricing** (charte Baitly).
- ⚠️ **Rebrand domaine/app en Baitly** (customer-facing) — migration coordonnée (aujourd'hui `clenzy`).
- **Démo publique** (données mock) + **centre d'aide** / onboarding docs.
- **Support** (canal + SLA) + **analytics** d'activation/rétention.

## Phase 5 — Pilote & lancement

- **Beta fermée** : 3-5 conciergeries marocaines.
- Boucle feedback → corrections → **checklist Go / No-Go** → lancement public.

---

## ⚠️ Décisions ouvertes à trancher

1. **Encaissement au Maroc — LE point dur *(recherche 2026-07-13)*.** **Stripe ne supporte pas le Maroc** (contrôle des changes de l'Office des Changes) ; seul *Stripe Tax* y est dispo, contournement = *Stripe Atlas* (entité US). Or **notre stack paiement est 100 % Stripe**. Trois flux à traiter séparément :
   - **Abonnement SaaS** (nos clients nous paient) → **PayZone** (fintech MA, récurrent natif MAD, onboarding 48-72h) ou facturation EUR via entité FR/US.
   - **Paiements voyageurs** (checkout, caution) biens MA → Stripe KO ; PSP local (**CMI** 95 % des cartes / PayZone) *à intégrer*, ou **hors-plateforme** au lancement.
   - **Payout ménage** (Connect Express) → **pas de Maroc** ; versement **manuel/virement local** au lancement, Baitly trace le montant dû (le *gaté preuve photo* reste).
   - **Reco MVP** : abonnement via **PayZone** ; encaissement voyageur + payout ménage **pilotés mais versés hors plateforme** au lancement ; automatisation des rails MAD locaux **post-lancement**. → préserve le délai, garde la valeur opérationnelle + conformité.
2. **Prix exact** (per-listing + plans + add-ons) — requis pour la facturation.
3. **Rebrand domaine Baitly** au lancement (oui / quand) — le customer-facing doit être Baitly.
4. **« Produit complet » = tous les modules GA** (IA, IoT, booking engine) — alourdit la stabilisation. **Levier** : tout garder visible mais marquer certains modules **« beta »** pour réduire le risque.

---

## Prochaines actions immédiates

1. **Déployer `main → production`** — met le produit complet (2 moats + Channex) en ligne.
2. **Tests E2E au navigateur** sur le parcours critique — mesurer la vraie stabilité.
3. **Investiguer l'encaissement Maroc** — le point dur du combo Maroc + self-serve.

> Ce plan est un document vivant : il évolue à mesure qu'on tranche les décisions ouvertes et qu'on avance dans les phases.
