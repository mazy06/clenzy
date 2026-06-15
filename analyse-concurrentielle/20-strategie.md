# Phase 2 — Axes stratégiques

> Appuyés sur la synthèse (`10-synthese.md`), les 13 benchmarks (`benchmark/`) et l'inventaire code (`inventaire/`). Date : 2026-06-13.

> ⚠️ **Amendement 2026-06-14 (décision utilisateur) :** la Décision n°1 ci-dessous (« niche France-only ») est **remplacée par un cap MULTI-PAYS — France + Maroc + Arabie Saoudite**. La conformité reste le fossé, mais devient **multi-juridiction**. Voir [42-objectifs-techniques.md](42-objectifs-techniques.md), [41-strategie-multipays.md](41-strategie-multipays.md) et [data/40-feature-evolution.csv](data/40-feature-evolution.csv).

**Fil directeur :** Clenzy n'a pas vocation à battre Guesty/Hostaway sur la breadth. Sa victoire est de **posséder la niche « OS de la conciergerie conforme, multi-pays FR/MA/KSA »**, de **déverrouiller la valeur déjà construite mais coupée**, et d'**aligner prix & discours sur la réalité**.

---

## Axe 1 — Assumer et armer la niche « conciergerie conforme, multi-pays FR/MA/KSA » (cœur de différenciation) — *amendé*

**Rationnel (données).** Clenzy est **n°1 du panel** sur Finance/Compta (2.2), Opérations (2.2), Mobile (2.5) et co-leader sur le multi-tenant (2.6). Personne dans le panel n'adresse la conformité **FR ni MENA** (NF/FEC FR, **e-invoicing ZATCA KSA**, DGI Maroc, déclarations Shomoos/DGSN). L'axe 2 confirme : les conciergeries opèrent leur back-office **au manuel/Excel** — précisément le terrain fort de Clenzy. C'est une **niche défendable multi-juridiction** que les leaders US/global ne couvrent pas, et un marché MENA (KSA/MA) en structuration réglementaire où le « first-mover conforme » a un avantage net.

**Mouvements.**
- Packager une offre « **conciergerie** » : reversements multi-propriétaires + relevé propriétaire transparent + contrats de mandat signés + facture de commission NF + app terrain.
- **Programme partenaire conciergerie** (tarif multi-org dégressif, onboarding white-glove). **Garde-fou absolu : ne jamais prendre de mandat en propre** (cannibalisation des clients).
- Capitaliser sur le **trust accounting câblé** (Wallet/LedgerEntry/Escrow/Split) comme argument « Guesty-grade, sans le prix Guesty ».

**Risques.** Marché de niche au TAM plus étroit (loi Le Meur réduit le parc amateur) ; dépendance au marché FR.
**Indicateurs de succès.** % de clients « conciergerie » (multi-owner) ; nb de propriétaires reversés/mois ; volume de payouts ; NPS conciergeries.

---

## Axe 2 — Faire de la conformité réglementaire FR/UE un fossé daté (fenêtre 2026-2027)

**Rationnel (données).** Triple échéance **confirmée** : registre national loi Le Meur **20/05/2026**, règlement UE 2024/1028 **20/05/2026**, **facturation électronique Factur-X** (GE/ETI 09/2026, PME/TPE 09/2027). Clenzy génère déjà des documents NF → il est à **1 pas** de la conformité e-invoicing, alors que les concurrents partent de zéro sur la France.

**Mouvements.**
- Livrer un **générateur Factur-X + pont PDP** (réforme e-invoicing) — différenciateur réglementaire majeur.
- **Câbler la déclaration voyageurs** (sortir du stub `compliance/` Chekin) avant l'échéance registre.
- **Kit conformité « facture électronique B2B »** packagé et commercialisé aux conciergeries.
- Corriger l'écart de crédibilité : retirer les claims faux (« 4 QTSP FR » tant que non branchés) — ou **brancher Yousign/DocuSeal** (déjà codés) pour rendre le claim vrai.

**Risques.** Paramètres réglementaires mouvants (chiffres Le Meur à reconfirmer) ; effort PDP non trivial.
**Indicateurs.** Conformité Factur-X livrée avant 09/2026 ; nb de déclarations voyageurs émises ; 0 claim non étayé dans le pitch.

---

## Axe 3 — Déverrouiller l'IA déjà construite (rattrapage à coût faible → différenciation)

**Rationnel (données).** Le retard IA (1.2) est largement **artificiel** : suggestion de réponse messagerie, IA pricing, multi-agent, insight analytics sont **codés mais OFF**. Le socle (multi-provider + RAG pgvector 2-stage + 27 tools + mémoire) est **supérieur aux PMS classiques**. Le marché 2025-2026 s'est déplacé vers l'**IA livrée** (Guesty Copilot/ReplyAI, Hospitable) — Clenzy a les munitions, pas le tir.

**Mouvements (séquencés).**
1. **Quick wins** : activer l'IA de suggestion de réponse (flag ON + UX inbox), lever `analytics-ai`, brancher le RAG à l'inbox guest.
2. **Next** : IA pricing en mode shadow/reco ; multi-agent en bêta encadrée ; résumés/vision métier.
3. **Différenciation** : autopilot guest avec garde-fous ; **détection d'anomalies/fraude paiement** (absente, gap vs Guesty PayProtect).

**Risques.** Banalisation de l'IA ; coûts tokens (budgets déjà en place) ; qualité/garde-fous de l'autopilot.
**Indicateurs.** % de réponses assistées par IA ; temps de réponse voyageur ; adoption pricing IA ; anomalies détectées.

---

## Axe 4 — Réparer le « moins d'OTA » : booking direct + channel crédibles

**Rationnel (données).** Booking (1.4) et Channel (2.0) sont sous le marché. La promesse « réduire la dépendance OTA » est affaiblie par l'absence de **site builder/SEO** et un channel **revendeur** sans statut partenaire. Or le direct booking est un levier de marge clé pour conciergerie (commissions OTA 12-20 %).

**Mouvements.**
- **Site builder no-code + templates STR + SEO** (meta/schema.org/sitemap/hreflang) ; **brancher l'email de confirmation** du booking direct.
- **Fiabiliser le channel** : mapping complet des restrictions via Channex + tests anti-régression ; finaliser l'adapter Airbnb (host-profile) et viser un statut partenaire ; activer 3-5 OTA longue traîne.
- **Zapier/Make** sur les webhooks existants (déblocage d'écosystème à faible effort).

**Risques.** Effort builder/SEO élevé ; dépendance Channex persistante.
**Indicateurs.** % de réservations directes ; nb d'OTA actifs ; taux d'erreur de sync ; sites directs publiés.

---

## Axe 5 — Réaligner le business model sur la valeur (pricing & discours)

**Rationnel (données).** Le marché est **unanimement per-listing** ; Clenzy facture **par siège** → une conciergerie 50 lots/5 sièges paie ~70 €/mois vs ~1 000 €/mois en per-listing. Clenzy est **massivement sous-prixé sur sa cible** — l'inverse de l'optimum. Le « 39 €/bien » du pitch n'existe pas dans le code.

**Mouvements.**
- Basculer la **métrique socle vers le per-listing** (hybride : quota de sièges généreux inclus comme anti-Smoobu) ; **grandfathering** des clients actuels.
- **Synchro OTA dans le socle** (fonction n°1 du STR) ; **Yield IA, IoT, signature QTSP, IA premium en add-ons** facturables.
- Paliers dégressifs par volume + minimum mensuel sur plan Business (modèle Avantio/Guesty).
- **Aligner le pitch sur le code** (supprimer « 39 €/bien », exprimer en €/logement, claims signature/SMS honnêtes).

**Risques.** Hausse de facture des clients actuels (résistance) ; complexité de migration tarifaire.
**Indicateurs.** ARPA (revenu moyen par compte) ; expansion revenue (add-ons) ; churn post-migration ; cohérence pitch/produit.

---

## Arbitrage stratégique central (les 3 décisions à prendre)

1. **Niche assumée vs généraliste ?** → Recommandation : **niche conciergerie FR conforme** (axes 1+2), pas la course breadth contre Guesty/Hostaway.
2. **Activer l'IA maintenant vs attendre la maturité ?** → Recommandation : **activer l'existant en quick wins** (axe 3) — le coût est marginal, le retard perçu est cher.
3. **Repricer (per-listing) malgré le risque de churn ?** → Recommandation : **oui, avec grandfathering** (axe 5) — la sous-valorisation actuelle est le plus gros frein à la viabilité économique sur la cible.
