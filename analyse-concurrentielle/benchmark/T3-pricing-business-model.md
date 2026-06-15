# T3 — Pricing & business model des PMS (analyse transverse)

> **Agent :** T3 — Pricing & Business Model.
> **Produit analysé :** Clenzy (PMS SaaS multi-tenant STR ; cible conciergeries/gestionnaires pro B2B2C + propriétaires multi-biens ; France).
> **Date :** 2026-06-13. Tous les prix sont datés et sourcés (§7), avec niveau de confiance.
> **Vérité terrain interne :** lue dans le code (`PricingConfigService.java`), pas dans le pitch marketing.

---

## 1. Périmètre & méthode

**Objectif.** Établir les grilles tarifaires des PMS comparables, cartographier les modèles de facturation du marché STR, confronter le modèle Clenzy (par siège) au standard du marché (par logement), et recommander un packaging.

**Acteurs benchmarkés (7) :** Hostaway, Guesty, Smoobu, Lodgify, Hospitable, Avantio, Smily (ex-BookingSync).

**Méthode.**
- **Vérité interne Clenzy** : relevée directement dans `server/src/main/java/com/clenzy/service/PricingConfigService.java` (constantes `DEFAULT_*`).
- **Concurrents** : recherche web 2025-2026, prix datés + URL + niveau de confiance. « Non documenté » quand introuvable. Aucune extrapolation chiffrée inventée.
- **Devise** : prix laissés dans leur devise d'origine (USD pour acteurs US, EUR pour acteurs EU). À 2026-06 l'EUR ≈ 1,08-1,15 USD selon période — ne pas convertir mécaniquement, signalé quand la comparaison l'exige.

**Limite de fiabilité importante.** Les acteurs « pro » (Hostaway, Guesty Pro/Enterprise, Avantio, Smily) **ne publient pas de grille** : tarif sur devis. Les chiffres rapportés viennent d'agrégateurs tiers (Capterra, ITQlick, costbench, blogs spécialisés) → confiance « Probable » et non « Confirmé ». Les acteurs « self-serve » (Smoobu, Hospitable, Lodgify) ont une page publique → confiance plus haute.

### Rappel — modèle Clenzy tel qu'implémenté (preuve code)

`PricingConfigService.java:63-66` :
- `DEFAULT_PMS_MONTHLY_CENTS = 3000` → **base 30 €/mois/org**.
- `DEFAULT_PMS_PER_SEAT_CENTS = 1000` → **+10 €/siège** au-delà du 1er.
- `DEFAULT_PMS_FREE_SEATS = 1` → **1 siège inclus** (le propriétaire).
- `DEFAULT_PMS_SYNC_CENTS = 1500` → **add-on « synchro auto » 15 €/mois** (channel-manager). *(Non mentionné dans le cadrage Phase 0 — à retenir.)*
- Calcul (`computeMonthlyPmsCostCents`, l.384) : `base + max(0, sièges − 1) × 10 €`.
- Périodes (cadrage §6, `BillingPeriod`) : MONTHLY ×1.0 / **ANNUAL ×0.80 (−20 %)** / **BIENNIAL ×0.65 (−35 %)**.

**Clarification forfaits.** ESSENTIEL / CONFORT / PREMIUM (`DEFAULT_BASE_ESSENTIEL/CONFORT/PREMIUM = 50/75/100`, l.59-61) sont les **prix d'une prestation de ménage** (devis prospects, méthode `computeDevisQuote` l.264) — **ils ne sont PAS l'abonnement SaaS**. Confirmé par lecture du code. Le « 39 €/bien/mois » du pitch n'existe nulle part dans le code : **narratif commercial**.

---

## 2. Grilles tarifaires concurrents (datées)

> Légende confiance : **Confirmé** (page officielle/source primaire) · **Probable** (agrégateurs tiers concordants) · **À vérifier** (source unique).

### 2.1 Hostaway — *par logement dégressif, sur devis* — Confiance : Probable
- **Prix d'entrée** : ~**40 USD/logement/mois**, descendant jusqu'à ~20 USD/unité à volume (HotelMinder / rakidzich, 2025-2026).
- **Paliers observés** : 1-4 lots ≈ **125-175 USD/mois** ; 5-9 lots ≈ **175-250 USD/mois**. Coût/lot dégressif.
- **Setup** : **100 à 1 000 USD** one-time selon source (300-1 000 USD côté rakidzich).
- **Engagement** : annuel payé d'avance la norme, ou mensuel avec lock-in 12 mois.
- **Free trial** : aucun en self-serve — démo + devis personnalisé. **Pas de page tarif publique** → deux clients à portefeuille identique peuvent payer des prix différents.

### 2.2 Guesty — *par logement, 5 tiers* — Confiance : Confirmé (Lite) / Probable (Pro+)
- **Lite (≤3 lots)** : Pay-As-You-Grow **9 USD/listing/mois + 1 % par réservation** ; **annuel 20 USD/listing/mois** ; **mensuel 29 USD/listing/mois** (page officielle + costbench, vérifié 2026-05-29).
- **Pro (4-199 lots)** : **custom** (plancher reporté ~120 USD/mois ; minimum 2 lots).
- **Enterprise (200+ lots)** : **custom**.
- **Setup/onboarding** : **150 à 2 000 USD** (témoignages utilisateurs).
- **Add-on** : génération de code serrure connectée **0,75 USD/code**.
- **Free trial** : **14 jours** (Lite).

### 2.3 Smoobu — *abonnement par logement, self-serve* — Confiance : Confirmé (page officielle)
- **Professional Flex** : **29 €/mois** (1er logement) + **0,9 % booking fee**.
- **Professional Prepaid** (le + populaire) : **35 €/mois**, **0 % fee** ; **annuel 31,50 €/mois (−10 %)** ; **2 ans 25,20 €/mois (−20 %)**.
- **Teams Pro+** : **55 €/mois** (annuel 49,50 € ; 2 ans 44 €) — features PMS avancées, e-invoicing, dynamic pricing 2 mois offerts.
- **Unité supplémentaire** : à partir de **9,60 €/mois**. **Compte « accès écriture » supplémentaire** : à partir de **12 €/mois**.
- **Add-on dynamic pricing** : **12,99 €/mois/logement** (hors Teams Pro+).
- **Free trial** : **14 jours sans CB**. Setup : non documenté (aucun).

> Note : Smoobu **facture aussi les sièges supplémentaires** (« compte accès écriture » à 12 €) en plus des logements. C'est le concurrent le plus proche d'un modèle hybride logement + utilisateur.

### 2.4 Lodgify — *abonnement par palier (orienté booking direct)* — Confiance : Probable
- **Basic** : **14 USD/mois** ; **Starter** : ~**20-26 USD/mois + 1,9 % booking fee** ; **Professional** : ~**42-50 USD/mois (0 % fee)** ; **Ultimate** : ~**62-73 USD/mois (0 % fee)**.
- **Annuel** : à partir de **14 USD/mois**, 0 % fee sur tous les plans.
- **Particularité** : booking fee uniquement sur Starter ; les plans hauts l'éliminent contre un abonnement plus élevé (arbitrage volume de réservations vs. abonnement). Forte composante **site direct / website builder**.
- **Setup** : non documenté. **Free trial** : oui (durée non précisée).

### 2.5 Hospitable — *abonnement par palier + propriétés supp., self-serve* — Confiance : Confirmé (page officielle)
- **Essentials** : **gratuit à vie** (pas un trial — pas de frais de base ni par propriété active).
- **Host** : **29 USD/mois** (1 propriété ; +10 USD la 2e).
- **Professional** : **59 USD/mois** (2 propriétés ; +15 USD/extra).
- **Mogul** : **99 USD/mois** (3 propriétés ; +20 USD/extra).
- **Add-on dynamic pricing** : **15 USD/propriété/mois** après trial.
- **Setup** : aucun. Très orienté hôtes indépendants / automatisation messagerie.

### 2.6 Avantio — *par logement dégressif + minimum mensuel, sur devis* — Confiance : Probable
- **Prix d'entrée** : ~**25 €/logement/mois** (rapporté ~23 USD descendant à ~14 USD à volume).
- **Minimum mensuel** : **250 €/mois** (base ~10 lots). **Cible explicite : portefeuilles 20+ lots** — « pas adapté aux petits opérateurs ».
- **Commission** : **0 %** sur les réservations.
- **Add-on dynamic pricing** : **6 €/logement/mois** (2025).
- **Setup** : non documenté. **Free trial** : aucun (démo).

### 2.7 Smily (ex-BookingSync) — *par logement, sur devis* — Confiance : Probable
- **Prix d'entrée** : à partir de **25 €/logement/mois** (modèle par rental, **pas** par réservation).
- **Paliers détaillés** : **non documenté** (devis selon besoins).
- **Setup / engagement / free trial** : **non documenté**. Origine française, cible agences/PM.

### 2.8 Tableau de synthèse — prix d'entrée

| Acteur | Métrique | Prix d'entrée | Add-on dynamic pricing | Setup | Free trial | Confiance |
|---|---|---|---|---|---|---|
| **Guesty** Lite | par logement | 9 USD/listing/mois (+1 %) | — | 150-2 000 USD | 14 j | Confirmé |
| **Lodgify** Basic | par palier | 14 USD/mois | inclus selon plan | — | oui | Probable |
| **Smoobu** | par logement | 29 €/mois (+9,60 €/unité) | 12,99 €/mois/lot | aucun | 14 j | Confirmé |
| **Hospitable** Host | par palier | 29 USD/mois (gratuit Essentials) | 15 USD/lot/mois | aucun | gratuit à vie | Confirmé |
| **Hostaway** | par logement | ~40 USD/logement/mois | — | 100-1 000 USD | démo | Probable |
| **Avantio** | par logement | ~25 €/logement/mois (min. 250 €) | 6 €/lot/mois | — | démo | Probable |
| **Smily** | par logement | dès 25 €/logement/mois | non doc. | non doc. | démo | Probable |
| **Clenzy** *(code)* | **par siège** | **30 €/mois/org (1 siège inclus)** | synchro auto 15 €/mois | aucun | non doc. | Confirmé |

---

## 3. Modèles de tarification du marché & sensibilité prix

### 3.1 Le modèle dominant : per-listing dégressif
Le **standard incontesté** du PMS STR est le **prix par logement (per-listing/per-unit), dégressif** avec le volume. Tous les acteurs « pro » l'utilisent (Hostaway, Guesty Pro, Avantio, Smily), et les acteurs self-serve le déclinent en paliers de propriétés (Hospitable, Smoobu, Lodgify). Raisons :
- **Alignement valeur ↔ facturation** : la valeur d'un PMS croît avec le nombre de logements gérés (calendriers, sync OTA, messages). Le client comprend immédiatement « je paie pour ce que je gère ».
- **Prévisibilité** : coût linéaire/dégressif modélisable à l'avance, contrairement au pourcentage de CA.
- **Comparabilité** : tous les concurrents s'expriment dans la même unité → le prospect compare en €/logement.

### 3.2 Les déclinaisons
- **Minimum mensuel (plancher)** : très courant côté pro (Avantio 250 €/mois ; Guesty Pro ~120 USD). Protège la marge sur les petits portefeuilles et signale un positionnement « entreprise ».
- **% de réservation / booking fee** : utilisé en bas de gamme comme alternative à l'abonnement (Guesty Lite +1 %, Smoobu Flex 0,9 %, Lodgify Starter 1,9 %). Le client « grandit en payant au succès », puis bascule vers l'abonnement plat dès que le volume rend le % plus cher. Les plans hauts **éliminent** le fee.
- **% du CA (revenue share)** : réservé à l'**enterprise** et reste minoritaire ; le marché documente clairement que « le % grignote la marge à mesure qu'on grandit, le flat per-property garde le coût prévisible » → argument de vente du per-listing.
- **Add-ons facturables** : dynamic pricing (6-15 €/lot/mois), site direct, e-invoicing, sièges/comptes supplémentaires, codes de serrure à l'unité (Guesty 0,75 USD).
- **Setup fee** : présent surtout chez les pro à onboarding lourd (Hostaway 100-1 000 USD, Guesty 150-2 000 USD) ; **absent** chez les self-serve.

### 3.3 Sensibilité prix par segment

| Segment | Élasticité | Attentes tarifaires | Implication |
|---|---|---|---|
| **Hôte indépendant (1-3 lots)** | Très élevée | Prix bas, self-serve, free trial, **pas de setup fee**, pas d'engagement | Plan d'entrée < 30 €/mois ou gratuit (Hospitable Essentials). Le setup fee tue la conversion. |
| **Petit PM / conciergerie (5-30 lots)** | Moyenne | Veut un coût/lot dégressif, multi-utilisateurs sans surcoût punitif, onboarding accompagné | Cœur de cible Clenzy. Sensible au **coût total à l'échelle**, pas au prix d'entrée. |
| **Conciergerie moyenne (30-200 lots)** | Plus faible | Tolère un minimum mensuel et un setup fee si l'outil remplace 3-4 logiciels ; négocie le €/lot | Recherche features pro (trust accounting, owner portals, reversements) → le pricing devient secondaire vs. fonctionnalités. |
| **Enterprise (200+ lots)** | Faible | Custom, account management, SLA, parfois % de CA | Hors cible primaire Clenzy aujourd'hui. |

**Insight clé pour Clenzy.** La cible primaire (conciergerie 5-200 lots) **n'achète pas au prix d'entrée** mais au **coût total à l'échelle** et à la **couverture fonctionnelle**. Le modèle par siège y est un signal trompeur (voir §4).

---

## 4. Modèle Clenzy (par siège) vs marché (par logement)

### 4.1 Ce que fait Clenzy aujourd'hui
Facturation **par siège** : 30 €/org + 10 €/siège au-delà du 1er. La métrique de croissance facturée est le **nombre d'utilisateurs**, pas le nombre de logements.

### 4.2 Avantages du modèle par siège
- **Simplicité de lecture** pour une petite équipe : « 30 € + 10 €/collègue ».
- **Pas de pénalité à la croissance du portefeuille** : un gestionnaire qui passe de 20 à 200 lots avec la même équipe paie le même prix → **très attractif pour une conciergerie qui scale en lots sans grossir en effectifs**.
- **Aligné sur un coût marginal logiciel réel** (sièges = comptes/charge support), pas sur la valeur captée.

### 4.3 Risques et angles morts
1. **Désalignement valeur ↔ revenu (le problème central).** La valeur délivrée croît avec les **logements** (sync, calendriers, réservations, reversements multi-propriétaires) ; le revenu Clenzy croît avec les **sièges**. Une conciergerie qui gère 300 lots à 4 personnes paie **30 + 30 = 60 €/mois** — soit ~0,20 €/lot, là où le marché facture 14-40 €/lot. **Clenzy laisse énormément sur la table sur exactement sa cible cœur.**
2. **Incomparabilité commerciale.** Tous les concurrents s'expriment en €/logement. Un prospect ne peut pas comparer 30 €/org + 10 €/siège à 25 €/lot → friction cognitive en démo, et le pitch « 39 €/bien » (qui *est* comparable) ne correspond pas au code → **incohérence pitch/produit risquée en négociation**.
3. **Incitation perverse au partage de comptes.** Facturer le siège pousse une équipe à mutualiser un login (mauvais pour l'audit, la sécurité RBAC — alors que Clenzy a justement 8 rôles + 84 permissions) afin d'éviter le surcoût.
4. **Plafond de revenu bas.** Un modèle par siège plafonne mécaniquement : peu d'orgs ont >10-15 sièges. Le marché capture la croissance là où elle a lieu (les lots), Clenzy non.
5. **Add-on synchro 15 €/mois mal positionné.** Facturer la synchro OTA en option suggère qu'un PMS peut fonctionner sans channel manager — or c'est la **fonction n°1** du STR (cadrage : domaine 1 pondéré 11 %). Le découpler du socle affaiblit la proposition de valeur et complique la lecture.

### 4.4 Positionnement prix de Clenzy vs marché : **sous le marché**
Sur sa cible (conciergerie multi-lots), le modèle par siège place Clenzy **nettement en-dessous** du marché en revenu capté :
- Conciergerie 50 lots / 5 sièges : **Clenzy = 30 + 40 = 70 €/mois**. Marché per-listing (~20 €/lot dégressif) ≈ **1 000 €/mois**. **Écart d'un ordre de grandeur.**
- Hôte indé 2 lots / 1 siège : **Clenzy = 30 €/mois**. Marché (Hospitable Host 29 USD, Smoobu 29-35 €) ≈ **aligné**.

→ **Clenzy est aligné sur le segment indé (où il capte peu de valeur) et massivement sous-prixé sur le segment conciergerie (sa cible déclarée).** C'est l'inverse de l'optimum.

---

## 5. Recommandation de packaging & pricing

### 5.1 Métrique de facturation recommandée : **hybride par logement + sièges**
**Recommandation : passer le socle au per-listing (métrique principale), garder les sièges en métrique secondaire au-delà d'un quota généreux.**

Justification :
- **Aligne revenu et valeur** (les lots) → capte la croissance là où elle a lieu, sur la cible cœur.
- **Rend Clenzy comparable** au marché (€/lot) → enlève la friction commerciale et réconcilie le pitch « par bien » avec le produit.
- **Garde une touche de différenciation** via des sièges généreusement inclus : argument anti-Smoobu (qui surfacture les comptes écriture à 12 €) et anti-Guesty (per-listing pur).
- **Évite le %-de-CA** : trop intrusif pour une cible PME sensible à la prévisibilité, et lourd techniquement (Clenzy n'a pas le revenue-tracking enterprise de Guesty).

### 5.2 Structure de plans proposée (à valider commercialement)

| Plan | Cible | Socle | Métrique | Inclus | Notes |
|---|---|---|---|---|---|
| **Starter** | Hôte indé (1-3 lots) | ~19-29 €/mois | par logement (3 inclus) | sync OTA + booking direct + 2 sièges | **Inclure la synchro** (ne plus la vendre en add-on). Free trial 14 j. |
| **Pro** | Conciergerie 5-50 lots | dès ~12-15 €/lot/mois dégressif | par logement | sièges illimités ou large quota (ex. 10), reversements, owner portal | Cœur de cible. Dégressivité par paliers. |
| **Business** | Conciergerie 50-200 lots | ~8-10 €/lot dégressif + minimum mensuel (~250 €) | par logement | trust accounting NF, API, multi-org | Minimum mensuel comme Avantio/Guesty Pro → signal pro + plancher de marge. |
| **Enterprise** | 200+ lots | sur devis | custom | SLA, onboarding dédié | Tarif négocié. |

**Add-ons facturables** (cohérent avec le marché) :
- **Tarification dynamique / Yield IA** : 6-15 €/lot/mois (marché : Avantio 6 €, Smoobu/Hospitable 12-15 €) — Clenzy a `PriceEngine` 8 niveaux + PriceLabs natif → monétisable.
- **Signature électronique avancée (QTSP)** : à l'usage, *quand réellement branché* (aujourd'hui seul SES interne actif — cf. cadrage §8, ne pas survendre).
- **IoT / serrures connectées** : à l'unité ou en pack (Nuki/Minut/KeyNest/caméras) — cf. Guesty 0,75 USD/code.
- **IA assistant / RAG** : au-delà d'un quota de tokens inclus.
- **NE PAS** mettre la synchro OTA en add-on : elle doit être dans le socle (fonction n°1 du STR).

### 5.3 Positionnement prix cible
- **Indé** : aligné marché (~25 €/mois socle), sans setup fee, free trial — pour ne pas perdre la conversion self-serve face à Hospitable/Smoobu.
- **Conciergerie** : **légèrement sous Hostaway/Guesty** (~12-15 €/lot vs ~20-40 USD) pour pénétrer, avec la **conformité NF / reversements multi-propriétaires** (le « bunker » Clenzy, domaine 8 score 3) comme justification de valeur — un différenciateur fort sur le marché FR que les concurrents US ne couvrent pas. **Le per-listing permet enfin de capturer cette valeur.**
- **Setup fee** : optionnel et seulement sur Business/Enterprise (onboarding accompagné), jamais sur Starter/Pro.

### 5.4 Risque de migration
Le passage par siège → par logement **augmente la facture des conciergeries actuelles** (de 60 € à plusieurs centaines €). À gérer par : grandfathering des clients existants, communication sur la valeur (NF, reversements, channel manager inclus), et paliers dégressifs généreux. Décision **commerciale**, pas technique — à arbitrer par la direction.

---

## 6. Initiatives

| Titre | Type | Impact (1-3) | Effort (S/M/L) | Reach (1-3) | Confiance (0.1-1.0) |
|---|---|:---:|:---:|:---:|:---:|
| Basculer la métrique socle de « par siège » vers « par logement » (hybride avec sièges inclus) | Business model / Pricing | 3 | L | 3 | 0.8 |
| Intégrer la synchro OTA (15 €/mois aujourd'hui en add-on) dans le socle, et sortir Yield IA en add-on facturable | Packaging | 2 | S | 3 | 0.9 |
| Aligner le pitch commercial sur le code (supprimer « 39 €/bien » fictif, exprimer le tarif réel en €/logement) | Cohérence GTM | 2 | S | 2 | 0.95 |
| Introduire des paliers dégressifs par volume + minimum mensuel sur le plan Business (modèle Avantio/Guesty Pro) | Pricing | 3 | M | 2 | 0.75 |
| Catalogue d'add-ons monétisables (dynamic pricing, IoT/serrures, IA, signature QTSP quand branchée) aligné marché | Monétisation | 2 | M | 3 | 0.7 |

---

## 7. Sources (URL | date | confiance)

| # | Source (URL) | Date consultée | Objet | Confiance |
|---|---|---|---|---|
| 1 | https://www.hotelminder.com/partner=Hostaway | 2026-06-13 | Hostaway prix/lot, paliers | Probable |
| 2 | https://www.rakidzich.com/articles/how-much-does-hostaway-cost-2026 | 2026-06-13 | Hostaway paliers, setup 300-1000 USD | Probable |
| 3 | https://www.hostaway.com/blog/property-management-software-cost/ | 2026-06-13 | Modèles de pricing PMS (générique) | Probable |
| 4 | https://www.guesty.com/pricing/ | 2026-06-13 | Guesty structure de tiers | Confirmé |
| 5 | https://costbench.com/software/vacation-rental-software/guesty/ | 2026-05-29 (vérif. source) | Guesty Lite/Pro/Enterprise, onboarding, min. | Confirmé (Lite) / Probable (Pro+) |
| 6 | https://stayfi.com/vrm-insider/2025/04/03/guesty-pricing-is-it-worth-the-investment/ | 2026-06-13 | Guesty contexte pricing | Probable |
| 7 | https://www.smoobu.com/en/pricing/ | 2026-06-13 | Smoobu plans, unités/comptes supp., remises | Confirmé |
| 8 | https://support.smoobu.com/hc/en-us/articles/21966779906834 | 2026-06-13 | Smoobu dynamic pricing 12,99 € | Confirmé |
| 9 | https://www.lodgify.com/pricing/ (403, données via recherche) | 2026-06-13 | Lodgify plans Basic/Starter/Pro/Ultimate | Probable |
| 10 | https://www.keevee.com/lodgify-pricing | 2026-06-13 | Lodgify prix détaillés et booking fee | Probable |
| 11 | https://hospitable.com/pricing | 2026-06-13 | Hospitable Host/Pro/Mogul/Essentials | Confirmé |
| 12 | https://help.hospitable.com/en/articles/4596748 | 2026-06-13 | Hospitable coûts, dynamic pricing 15 USD | Confirmé |
| 13 | https://www.capterra.com/p/134278/Avantio/pricing/ | 2026-06-13 | Avantio prix/lot, minimum 250 € | Probable |
| 14 | https://www.avantio.com/blog/subscription-vs-commission-based-software-for-vacation-rentals/ | 2026-06-13 | Avantio 0 % commission, dynamic pricing 6 € | Probable |
| 15 | https://strspecialist.com/reviews/smily-bookingsync-pms-review | 2026-06-13 | Smily dès 25 €/logement/mois | Probable |
| 16 | https://www.smily.com/software/pricing | 2026-06-13 | Smily page pricing (paliers non publiés) | À vérifier |
| 17 | `server/src/main/java/com/clenzy/service/PricingConfigService.java` (l.59-66, 233, 384) | 2026-06-13 | **Modèle Clenzy (vérité code)** | Confirmé |
| 18 | https://join.globalvacationrentals.com/blog/vacation-rental-property-management-fees/ | 2026-06-13 | Modèles per-listing vs % de CA | Probable |

> Réserve méthodologique : les prix « pro » (Hostaway, Guesty Pro/Enterprise, Avantio, Smily) ne sont pas publiés officiellement — confiance plafonnée à « Probable ». Les self-serve (Smoobu, Hospitable, Guesty Lite) sont « Confirmé » (page officielle). EUR/USD non convertis mécaniquement.
