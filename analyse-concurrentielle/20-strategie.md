# Phase 2 — Axes stratégiques

> Appuyés sur la synthèse (`10-synthese.md`), les 13 benchmarks (`benchmark/`) et l'inventaire code (`inventaire/`). Date : 2026-06-13.

> ⚠️ **Amendement 2026-06-14 (décision utilisateur) :** la Décision n°1 ci-dessous (« niche France-only ») est **remplacée par un cap MULTI-PAYS — France + Maroc + Arabie Saoudite**. La conformité reste le fossé, mais devient **multi-juridiction**. Voir [42-objectifs-techniques.md](42-objectifs-techniques.md), [41-strategie-multipays.md](41-strategie-multipays.md) et [data/40-feature-evolution.csv](data/40-feature-evolution.csv).

> ⚠️ **Amendement 2026-07-12 — état des axes après les livraisons V2 (juin) et V3 (juillet).** Les axes restent directionnellement justes, mais **2 sur 5 sont largement accomplis** et un **6ᵉ axe** est né. Ce qu'on « doit faire » se resserre nettement :
> - **Axe 3 (déverrouiller l'IA) — LARGEMENT ACCOMPLI.** La prémisse « IA codée mais OFF » est **obsolète** : constellation multi-agents **déployée** + autonomie déterministe opt-in + copilote de réponse + RAG inbox + détection d'anomalies (D13 1.2→2.4, D6 1.6→2.2). **Reste** : IA de tarification (verrouillée, différée HP-12), autopilot messagerie complet. → passe de « chantier » à **« acquis à valoriser dans le pitch »**.
> - **Axe 4 (booking direct + channel) — LARGEMENT ACCOMPLI.** Studio GrapesJS + SSR/SEO + génération de site par IA + SDK (booking 1.4→2.7) ; sync 2-way + restrictions + CM natif (channel 2.0→2.5). **Reste** : **Zapier/Make** (toujours absent), statut partenaire OTA.
> - **Axe 1 (niche conciergerie) — renforcé** par le **Moteur Ménage** (nouveau pilier back-office + 2ᵉ moat, cf. Axe 6). **Reste** : packaging offre conciergerie + programme partenaire (**GTM, pas du code**).
> - **Axe 2 (conformité) — partiellement livré** : déclaration voyageurs (Chekin), ZATCA PIH, socle Country multi-pays. **Reste** : **Factur-X + pont PDP** (échéance 09/2026) — le vrai chantier restant.
> - **Axe 5 (repricing per-listing) — NON FAIT.** Modèle toujours par siège. → **désormais LA priorité stratégique n°1** (la seule des 3 décisions centrales encore non tranchée).
> **Priorités resserrées 2026-07 : (A) repricing per-listing · (B) Factur-X/PDP · (C) GTM conciergerie incluant le Moteur Ménage · (D) Zapier/Make.**

**Fil directeur :** Baitly n'a pas vocation à battre Guesty/Hostaway sur la breadth. Sa victoire est de **posséder la niche « OS de la conciergerie conforme, multi-pays FR/MA/KSA »**, de **déverrouiller la valeur déjà construite mais coupée**, et d'**aligner prix & discours sur la réalité**.

---

## Axe 1 — Assumer et armer la niche « conciergerie conforme, multi-pays FR/MA/KSA » (cœur de différenciation) — *amendé*

**Rationnel (données).** Baitly est **n°1 du panel** sur Finance/Compta (2.2), Opérations (2.2), Mobile (2.5) et co-leader sur le multi-tenant (2.6). Personne dans le panel n'adresse la conformité **FR ni MENA** (NF/FEC FR, **e-invoicing ZATCA KSA**, DGI Maroc, déclarations Shomoos/DGSN). L'axe 2 confirme : les conciergeries opèrent leur back-office **au manuel/Excel** — précisément le terrain fort de Baitly. C'est une **niche défendable multi-juridiction** que les leaders US/global ne couvrent pas, et un marché MENA (KSA/MA) en structuration réglementaire où le « first-mover conforme » a un avantage net.

**Mouvements.**
- Packager une offre « **conciergerie** » : reversements multi-propriétaires + relevé propriétaire transparent + contrats de mandat signés + facture de commission NF + app terrain.
- **Programme partenaire conciergerie** (tarif multi-org dégressif, onboarding white-glove). **Garde-fou absolu : ne jamais prendre de mandat en propre** (cannibalisation des clients).
- Capitaliser sur le **trust accounting câblé** (Wallet/LedgerEntry/Escrow/Split) comme argument « Guesty-grade, sans le prix Guesty ».

**Risques.** Marché de niche au TAM plus étroit (loi Le Meur réduit le parc amateur) ; dépendance au marché FR.
**Indicateurs de succès.** % de clients « conciergerie » (multi-owner) ; nb de propriétaires reversés/mois ; volume de payouts ; NPS conciergeries.

---

## Axe 2 — Faire de la conformité réglementaire FR/UE un fossé daté (fenêtre 2026-2027)

**Rationnel (données).** Triple échéance **confirmée** : registre national loi Le Meur **20/05/2026**, règlement UE 2024/1028 **20/05/2026**, **facturation électronique Factur-X** (GE/ETI 09/2026, PME/TPE 09/2027). Baitly génère déjà des documents NF → il est à **1 pas** de la conformité e-invoicing, alors que les concurrents partent de zéro sur la France.

**Mouvements.**
- Livrer un **générateur Factur-X + pont PDP** (réforme e-invoicing) — différenciateur réglementaire majeur.
- **Câbler la déclaration voyageurs** (sortir du stub `compliance/` Chekin) avant l'échéance registre.
- **Kit conformité « facture électronique B2B »** packagé et commercialisé aux conciergeries.
- Corriger l'écart de crédibilité : retirer les claims faux (« 4 QTSP FR » tant que non branchés) — ou **brancher Yousign/DocuSeal** (déjà codés) pour rendre le claim vrai.

**Risques.** Paramètres réglementaires mouvants (chiffres Le Meur à reconfirmer) ; effort PDP non trivial.
**Indicateurs.** Conformité Factur-X livrée avant 09/2026 ; nb de déclarations voyageurs émises ; 0 claim non étayé dans le pitch.

---

## Axe 3 — Déverrouiller l'IA déjà construite (rattrapage à coût faible → différenciation)

**Rationnel (données).** Le retard IA (1.2) est largement **artificiel** : suggestion de réponse messagerie, IA pricing, multi-agent, insight analytics sont **codés mais OFF**. Le socle (multi-provider + RAG pgvector 2-stage + 27 tools + mémoire) est **supérieur aux PMS classiques**. Le marché 2025-2026 s'est déplacé vers l'**IA livrée** (Guesty Copilot/ReplyAI, Hospitable) — Baitly a les munitions, pas le tir.

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

**Rationnel (données).** Le marché est **unanimement per-listing** ; Baitly facture **par siège** → une conciergerie 50 lots/5 sièges paie ~70 €/mois vs ~1 000 €/mois en per-listing. Baitly est **massivement sous-prixé sur sa cible** — l'inverse de l'optimum. Le « 39 €/bien » du pitch n'existe pas dans le code.

**Mouvements.**
- Basculer la **métrique socle vers le per-listing** (hybride : quota de sièges généreux inclus comme anti-Smoobu) ; **grandfathering** des clients actuels.
- **Synchro OTA dans le socle** (fonction n°1 du STR) ; **Yield IA, IoT, signature QTSP, IA premium en add-ons** facturables.
- Paliers dégressifs par volume + minimum mensuel sur plan Business (modèle Avantio/Guesty).
- **Aligner le pitch sur le code** (supprimer « 39 €/bien », exprimer en €/logement, claims signature/SMS honnêtes).

**Risques.** Hausse de facture des clients actuels (résistance) ; complexité de migration tarifaire.
**Indicateurs.** ARPA (revenu moyen par compte) ; expansion revenue (add-ons) ; churn post-migration ; cohérence pitch/produit.

---

## Axe 6 — L'économie du ménage comme 2ᵉ moat (nouveau, 2026-07)

**Rationnel (données).** Livré en juillet, le **Moteur Ménage** fait passer les Opérations de 2.2 à **2.8 (n°1 net du panel)**. Benchmark juillet : **aucun PMS ne calcule un prix de ménage conseillé** (partout champ libre, forfait fixe, ou marketplace d'enchères externe), et la chaîne complète « prix conseillé → tarif prestataire cadré → **paiement à la complétion gaté par preuve photo** → anomalie monétisée » **n'existe nulle part en natif**. Concurrent FR le plus proche (Superhote) : tarif prestataire + dû auto, mais **sans** prix conseillé ni payout intégré ni gate photo. C'est un **fossé défendable universel** (indépendant de la juridiction) qui capitalise sur un socle d'exécution déjà au niveau des spécialistes (routing géo, app terrain offline) que les leaders délèguent à Turno/Breezeway.

**Mouvements.**
- **Argument phare du pitch conciergerie** (Axe 1) : « le seul PMS qui pilote l'économie du ménage de bout en bout ».
- Finaliser la **vérification Stripe test-mode** du payout prestataire (pré-requis déploiement).
- **Add-on facturable** potentiel (paie prestataire à la preuve) — cohérent avec le repricing (Axe 5).

**Risques.** Money-path (payout) à sécuriser ; pas de marketplace de sourcing de prestataires (moat Turno) — hors modèle B2B conciergerie.
**Indicateurs.** % de ménages au prix conseillé ; volume de payouts prestataires ; taux de complétion gaté photo.

---

## Arbitrage stratégique central (les décisions à prendre)

### Décision n°0 (fondatrice) : notre marché de lancement — **à trancher**

> Remarque de Khaoula, juste : le doc parlait de « conciergerie conforme » sans dire **par où on lance**. Or **tout en découle** — stratégie commerciale ET financement. On la pose ici, en décision n°0.

Trois marchés, trois logiques (nos 3 fondateurs les couvrent) :

| Marché | Pourquoi c'est fort | Limites | Financement associé |
|---|---|---|---|
| **France** | Moat conformité le plus tranchant (échéance facture électronique **2026**), écosystème de financement mûr | Plus concurrentiel (Smoobu & co.), features conformité à finir | Bpifrance, JEI, CIR/CII |
| **Maroc** | **Premiers clients faciles** : marché greenfield (peu de vrais PMS — *à vérifier*), avantage terrain, coûts bas | Tickets plus petits, moat conformité moins « daté » | 212 Founders, Technopark, Maroc PME |
| **Arabie Saoudite** | Le gros pari : Vision 2030 + conformité **ZATCA** alignée + financement abondant + Amro sur place | Cycles longs, mise en conformité régionale | Monsha'at, SVC, NTDP |

**Distinguer deux questions :** (a) où trouver les **premiers clients** vite (validation) ? (b) quel est le marché **stratégique** (moat + financement) ?

**Recommandation (à valider ensemble) :** viser les **premiers clients au Maroc** (rapide, greenfield, terrain) *pendant* qu'on structure la **France comme marché phare** (moat conformité 2026 + Bpi/JEI/CIR), et **préparer l'Arabie Saoudite via Amro** comme pari de scale. Si on veut **un seul focus de lancement**, la **France** se défend (moat + financement) — mais le Maroc-premiers-clients est un vrai raccourci de traction.

> **À trancher : notre marché de lancement n°1.** Les axes ci-dessous et la partie 7 (Financement) s'alignent sur ce choix.

### Éclairage marché — Maroc *(recherche 2026-07)*

> Vérification de l'intuition « peu de vrais PMS au Maroc » : **partiellement confirmée, et plutôt favorable**. Chiffres et sources datés — à réactualiser avant la décision finale.

**Un marché STR réel et en forte croissance.**

| Indicateur | Donnée |
|---|---|
| Annonces actives Marrakech (S1 2026) | ≈ **21 400** · **+17 %** sur un an — l'un des marchés STR les plus développés d'Afrique |
| Touristes au Maroc (2025) | **19,8 M** (record national) |
| Tarif moyen / occupation (Marrakech) | ADR ≈ **137 $**/nuit · occupation ≈ **49-62 %** |
| Pôles actifs | Marrakech, Casablanca, Rabat, Tanger, Agadir |

**Adoption des PMS — le point clé.**
- Les PMS **internationaux existent et sont connus** (Hostaway, Guesty, Hospitable, Hostfully, PriceLabs, AirDNA…) → le marché n'est **pas vierge** d'outils.
- **Mais aucun PMS local conforme au droit marocain** : les outils présents sont **US/globaux**, sans la fiscalité ni les déclarations marocaines → **greenfield sur notre angle « conforme »**.
- Marché **très orienté agences de services** : beaucoup de conciergeries opèrent au **manuel/Excel** — ce sont **nos acheteurs**, pas des concurrents.

**Les conciergeries = nos clients cibles (échantillon réel).**
Welbnb, Morokeys, HouseMe, Kridarek, Cohost, BnB Maroc, AgenceBnB, ALL-IN, Sucasa… présentes à Marrakech, Casablanca, Rabat, Tanger et Agadir. Commission d'agence typique : **15-25 % des revenus**.

**Notre moat conformité s'applique au Maroc.** La réglementation s'est durcie (2023-2025) et recoupe ce qu'on gère déjà :

| Obligation | Détail |
|---|---|
| **Autorisation de louer** | Loi n° **80-14** + décret **2.23.441** (2023) : autorisation locale obligatoire |
| **Déclaration des revenus** | Avant le **1ᵉʳ mars** chaque année ; sanctions **> 50 000 MAD** + redressements rétroactifs |
| **Impôt sur le revenu locatif (IR)** | Abattement **40 %** ; option libératoire **20 %** au-delà de 120 000 MAD/an |
| **Taxe de séjour** | ≈ **15 MAD / personne / nuit** (grandes villes touristiques) |
| **Déclaration voyageurs DGSN** | Sous **24 h** après l'arrivée ; amende + **fermeture administrative** possible en cas de récidive |

> La **déclaration DGSN sous 24 h** est exactement la brique « déclaration voyageurs MENA » qu'on cite déjà. Notre différenciateur conformité **n'est pas qu'un argument FR/KSA — il vaut aussi au Maroc.**

**Ce que ça implique pour la décision.**
- Marché **en croissance** + **acheteurs identifiables** (conciergeries) + **fossé conformité réel** + **aucune concurrence native conforme** → un **terrain de premiers clients solide**.
- Renforce l'option **« premiers clients au Maroc »** de la recommandation (décision n°0), tout en gardant la **France comme marché phare** (moat + financement).
- **À vérifier avant lancement** : taux réel d'équipement PMS des conciergeries, capacité et volonté de payer un abonnement, et l'intérêt concret pour l'automatisation de la conformité (DGSN / IR / taxe de séjour).

*Sources (2024-2026, indicatives) : AirDNA & AirROI (données Marrakech) · guides hôtes Airbnb Maroc · annuaires de conciergeries (YourHostHelper, Kridarek…) · analyses réglementaires LCD Maroc (MyPrivateVilla, StaySign, Lodgify). À réactualiser avant toute décision engageante.*

### Les 3 décisions produit / business

> **Mise à jour 2026-07 :** Décision 1 (niche) **confirmée** ; Décision 2 (activer l'IA) **prise ET exécutée** (constellation déployée) ; **seule la Décision 3 (repricing per-listing) reste ouverte** — et devient la priorité n°1.

1. **Niche assumée vs généraliste ?** → Recommandation : **niche « conciergerie conforme »** sur le marché de lancement retenu (décision n°0), pas la course breadth contre Guesty/Hostaway.
2. **Activer l'IA maintenant vs attendre la maturité ?** → Recommandation : **activer l'existant en quick wins** (axe 3) — le coût est marginal, le retard perçu est cher.
3. **Repricer (per-listing) malgré le risque de churn ?** → Recommandation : **oui, avec grandfathering** (axe 5) — la sous-valorisation actuelle est le plus gros frein à la viabilité économique sur la cible.
