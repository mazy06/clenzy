# Benchmark B3 — Tarification dynamique / Yield

> Domaine 4 de l'analyse concurrentielle du PMS Clenzy.
> Cible : conciergeries / gestionnaires pro + propriétaires multi-biens, marché France.
> Concurrents : Hostaway, Guesty, Smoobu, Lodgify, Hospitable, Avantio, Smily.
> Grille 0–3. Clenzy noté via inventaire interne ; concurrents via recherche web 2025-2026 (datée, sourcée, avec niveau de confiance).
> Date : 2026-06-13.

---

## 1. Méthodologie & grille de notation

**Échelle 0–3 appliquée à chaque fonctionnalité :**

- **0** — Absent / non documenté
- **1** — Présent mais limité, ou uniquement via connecteur tiers basique
- **2** — Solide / standard du marché (natif ou intégration mature)
- **3** — Différenciateur : moteur propriétaire avancé ou couverture exhaustive

**Sources Clenzy** : inventaire interne fourni (pas de relecture exhaustive du code).
**Sources concurrents** : pages produit officielles, centres d'aide, comparatifs sectoriels
2025-2026 (Hotel Tech Report, StaySTRA, Capterra, G2, PriceLabs/Beyond partner pages, support
docs éditeurs). Confiance indiquée par ligne dans `data/04-pricing-yield.csv`.

**Distinction structurante du domaine** : moteur **IA / data-science propriétaire** livré en
prod versus simple **connecteur** vers un moteur tiers (PriceLabs, Beyond, Wheelhouse, DPGO).
C'est le clivage qui sépare les leaders (Hostaway, Guesty, Hospitable) des PMS « hub »
(Smoobu, Smily) qui délèguent intégralement la tarification.

---

## 2. Panorama du marché (2025-2026)

Le marché de la tarification dynamique STR s'est polarisé :

- **PriceLabs** est devenu le standard de fait : 150+ intégrations PMS/channel managers,
  ~500 000 logements, algorithme « Hyper Local Pulse » au niveau quartier (confiance 0.8).
  Quasiment **tous** les PMS du panel l'intègrent nativement.
- **Beyond Pricing** et **Wheelhouse** sont les deux autres connecteurs majeurs ; **DPGO**
  est un acteur IA plus récent, moins universellement intégré.
- Tendance 2025-2026 : la tarification dynamique **s'internalise dans les PMS**. Hospitable a
  bundlé son moteur propriétaire dans tous ses plans payants sans surcoût (confiance 0.8) ;
  Hostaway revendique un algorithme maison (+25,1 % de revenu/listing annoncé, confiance 0.6) ;
  Guesty pousse **PriceOptimizer**, moteur ML développé avec sa data-science team (confiance 0.7).
- Innovations 2025-2026 : Wheelhouse teste des « Dynamic Discounts » (ajustant aussi frais de
  ménage et durée min), PriceLabs annonce des suggestions de prix conversationnelles via API
  LLM, et « Dynamic Min Stay » (durée minimale pilotée par la demande) se généralise (confiance 0.6).

**Implication pour Clenzy** : posséder un moteur structuré + un connecteur PriceLabs natif est
une **parité de base** indispensable (acquise). Le terrain de différenciation s'est déplacé
vers (a) l'**IA propriétaire livrée** et (b) la **donnée marché / comps** — deux points où
Clenzy est en retard (IA sous flag OFF, pas de comps natifs).

---

## 3. Scores par acteur

| Acteur | Score moyen (0–3) | Lecture |
|---|---|---|
| **Hostaway** | **2,7** | Moteur IA propriétaire + tous les connecteurs majeurs |
| **Guesty** | **2,7** | PriceOptimizer ML natif + écosystème d'intégrations le plus large |
| **Hospitable** | **2,4** | Moteur propriétaire bundlé, orphan/gap natif fort, connecteurs PriceLabs/Wheelhouse |
| **Lodgify** | **2,2** | Dynamic Pricing maison (40+ attributs, 18 mois) + PriceLabs ; cible petits hôtes |
| **Avantio** | **2,2** | Pas de moteur maison fort mais 4 connecteurs (PriceLabs, Beyond, Key Data, Transparent) |
| **Clenzy** | **1,7** | Moteur structuré + yield rules + PriceLabs natif ; IA OFF, pas de Beyond, pas de comps |
| **Smoobu** | **1,6** | « Hub » : aucun moteur propriétaire, tout délégué (PriceLabs/Beyond/Wheelhouse) |
| **Smily** | **1,5** | « Hub » : pas de moteur propriétaire documenté, intégrations tierces |

> Note : Clenzy noté sur l'état **prod** (IA sous feature-flag = non livrée). Si l'IA était
> activée et fiabilisée, le score remonterait vers ~2,1–2,3 (cf. initiatives section 7).

---

## 4. Moteur IA propriétaire vs simple connecteur (analyse clé demandée)

| Acteur | Moteur propriétaire livré ? | Nature | Confiance |
|---|---|---|---|
| **Guesty** | Oui — **PriceOptimizer** | ML entraîné sur données de réservation réelles par la data-science team | 0.7 |
| **Hostaway** | Oui — **Dynamic Pricing** | Algorithme maison (saisonnalité, demande locale, dispo, facteur temps) ; +25,1 % revenu annoncé | 0.6 |
| **Hospitable** | Oui — moteur natif bundlé | « Millions de data points », maj quotidienne, stratégies conservative/recommended/aggressive ; orphan/gap auto | 0.8 |
| **Lodgify** | Oui — **Dynamic Pricing** (in-house) | 40+ attributs, 18 mois de prix, comp analysis ; fee 0,8 %/résa | 0.7 |
| **Avantio** | Non (pas de moteur maison fort) | S'appuie sur connecteurs (Beyond, PriceLabs, Key Data, Transparent) | 0.7 |
| **Smoobu** | **Non** | Hub : tarification 100 % déléguée aux connecteurs tiers | 0.8 |
| **Smily** | **Non** | Hub : pas de moteur propriétaire documenté | 0.6 |
| **Clenzy** | **Partiel — non livré** | `AiPricingService` (rule-based + LLM Claude) existe mais flag `pricing-ai` OFF en prod | 0.7 (interne) |

**Lecture stratégique** : Clenzy se situe entre les deux mondes. Il a plus qu'un simple hub
(moteur structuré 8 niveaux + 4 yield rules, ce que Smoobu/Smily n'ont pas), mais **moins**
qu'un moteur IA livré (Hostaway/Guesty/Hospitable/Lodgify). L'atout `AiPricingService` couplé
à Claude est un **différenciateur potentiel unique** (LLM-driven, rare sur ce marché) — mais
il reste un actif latent tant qu'il est OFF.

---

## 5. Analyse fonctionnelle détaillée

### Connecteurs tiers (parité)
- **PriceLabs** : intégré par **tous** les acteurs du panel, Clenzy compris (natif, REST +
  circuit breaker). Parité totale (confiance 0.9).
- **Beyond Pricing** : Hostaway, Guesty, Avantio, Smoobu, Smily, Lodgify l'ont ; **Clenzy ne
  l'a pas** (interface stub sans impl) — c'est le gap connecteur le plus net. Hospitable ne le
  met pas en avant non plus (confiance 0.8).
- **Wheelhouse** : large couverture concurrente ; Clenzy absent (confiance 0.7).
- **DPGO** : couverture inégale chez tous, peu différenciant (confiance 0.5).

### Règles de yield & restrictions
- **Min/max nights** : standard universel, parité (Clenzy = 3, confiance 0.8).
- **Gap nights / orphan days** : Hospitable se distingue (orphan days surlignés + résolution
  auto, confiance 0.6). Clenzy couvre via `GAP_FILL` mais sans feature « orphan » dédiée nommée → 2.
- **Lead time / days-before-arrival** : Clenzy fort (`DAYS_BEFORE_ARRIVAL` + `EARLY_BIRD` +
  `LAST_MINUTE`), au niveau des leaders (confiance 0.6).
- **Occupancy-based** : Clenzy a `OCCUPANCY_THRESHOLD` (règle), mais pas de recommandation
  data-driven occupancy comme les moteurs ML → noté 1 vs 3 pour Hostaway/Guesty/Hospitable.
- **Bulk update** : parité (Clenzy = 3).

### Données marché / comparables (comps)
- Guesty/Hostaway/Hospitable/Lodgify exposent des comps et signaux marché (natifs ou via
  moteur). **Clenzy = 0** (délégué à PriceLabs uniquement) — gap structurel (confiance 0.5).

### Frais / dépôts / taxes
- Les leaders intègrent frais, dépôts et **taxes auto** (séjour/TVA) dans le flux de prix.
- **Clenzy** : frais/dépôts présents au niveau produit (2) ; **taxes via FiscalEngine séparé**,
  hors pipeline yield (2). Wheelhouse pousse même l'ajustement dynamique des frais de ménage
  (Dynamic Discounts) — frontière prix/frais qui s'efface (confiance 0.6).

---

## 6. Forces, gaps et parités de Clenzy

### Top 3 avantages de Clenzy
1. **Moteur de prix propriétaire le plus structuré du segment « non-IA »** — résolution
   déterministe en **8 niveaux** (RateOverride → Promo → Event → Weekend → Seasonal →
   Early-bird → Last-minute → Base). Plus riche que les hubs (Smoobu/Smily = 1) et lisible/
   auditable. C'est le seul score 3 « solo » de Clenzy.
2. **Yield rules automatiques natives** (OCCUPANCY_THRESHOLD, DAYS_BEFORE_ARRIVAL,
   LAST_MINUTE_FILL, GAP_FILL) — les hubs n'en ont pas ; cela place Clenzy au-dessus de
   Smoobu/Smily/Avantio sur l'automatisme de yield rule-based.
3. **Actif IA différenciant latent** : `AiPricingService` couplé à **Claude (LLM)** — approche
   conversationnelle rare sur ce marché (PriceLabs n'annonce ses suggestions LLM que comme
   roadmap). Levier de différenciation si activé.

### Top 3 gaps de Clenzy
1. **Pas de moteur IA livré en prod** — flag `pricing-ai` OFF. Les 4 leaders (Hostaway,
   Guesty, Hospitable, Lodgify) ont un moteur propriétaire actif. Gap n°1 sur la valeur perçue.
2. **Pas de connecteur Beyond Pricing** (stub vide) ni Wheelhouse — réduit le choix client vs
   tous les concurrents qui offrent 2-4 connecteurs. Gap de parité d'intégration.
3. **Aucune donnée marché / comps propriétaire** — pas de signal de demande/competitive set
   natif. Le yield reste « interne » (occupancy de l'org) sans benchmark de marché hors PriceLabs.

### Parités acquises
- Connecteur **PriceLabs natif** (parité totale, confiance 0.9).
- **Min/max nights**, **lead time rules**, **bulk update** (au niveau des leaders).
- Frais/dépôts (standard) et taxes (présentes, mais hors pipeline yield).

---

## 7. Initiatives recommandées

Format : `Titre | Type | Impact (1-3) | Effort (S/M/L) | Reach (1-3) | Confiance (0.1-1.0)`

1. **Activer l'IA de tarification en prod (mode shadow → recommandations)** | Différenciation | 3 | M | 3 | 0.7
   *Lever le flag `pricing-ai` en mode « recommandation » (pas auto-apply) : afficher la
   suggestion LLM/rule-based à côté du prix résolu, mesurer l'écart, gagner la confiance. Comble
   le gap n°1 et exploite l'actif Claude unique. Effort M (fiabilisation + garde-fous + UI).*

2. **Implémenter le connecteur Beyond Pricing** | Parité | 2 | M | 2 | 0.8
   *Remplir le stub `ExternalPricingService` pour Beyond (même pattern que `PriceLabsService`).
   Ferme le gap de parité d'intégration le plus visible ; effort M car infra connecteur déjà en place.*

3. **Orphan-day / gap-fill explicite avec recommandation de prix** | Parité+ | 2 | S | 2 | 0.6
   *Promouvoir `GAP_FILL` en feature nommée « jours orphelins » : détection + surlignage calendrier
   + baisse de prix/min-stay suggérée (à la Hospitable). Effort S (la brique existe, surtout UX).*

4. **Injecter taxes/frais dans la simulation de prix (devis « tout compris »)** | Amélioration | 2 | M | 3 | 0.6
   *Faire dialoguer FiscalEngine et PriceEngine pour afficher un prix net affiché vs prix
   propriétaire, dans la lignée des Dynamic Discounts (frais variables). Forte portée (chaque devis).*

5. **Surface de données marché légère via PriceLabs (comps in-app)** | Différenciation | 2 | L | 2 | 0.5
   *Rapatrier et afficher dans Clenzy les signaux marché/comps déjà disponibles côté PriceLabs
   plutôt que de renvoyer l'utilisateur sur l'UI PriceLabs. Comble partiellement le gap comps
   sans bâtir un moteur de données. Effort L (dépend de l'étendue de l'API PriceLabs, confiance 0.5).*

---

## Sources principales (2025-2026)

- Hostaway — Dynamic Pricing & AI Pricing : hostaway.com (blog, glossary, get.hostaway.com/ai)
- Guesty — PriceOptimizer (ML natif) : guesty.com/features/guesty-priceoptimizer, help.guesty.com ; case study Forbytes
- Hospitable — moteur natif bundlé, orphan/gap : help.hospitable.com (déterminants du prix), hospitable.com/dynamic-pricing-feature-update
- Lodgify — Dynamic Pricing in-house (40+ attributs, fee 0,8 %) : lodgify.com/dynamic-pricing, reviews stayfi/gosummer
- Avantio — 4 connecteurs (Beyond, PriceLabs, Key Data, Transparent) : avantio.com/increase-your-revenue, beyondpricing.com/eu-blog
- Smoobu / Smily — connecteurs PriceLabs/Beyond/Wheelhouse, pas de moteur propriétaire : smoobu.com/en/integrations, hello.pricelabs.co/integration/bookingsync
- PriceLabs (standard marché, Hyper Local Pulse, Dynamic Min Stay) : hello.pricelabs.co, hoteltechreport.com, rentalscaleup.com
- Comparatifs sectoriels : StaySTRA (PriceLabs vs Wheelhouse vs Beyond vs DPGO 2026), Hotel Tech Report, Capterra, G2
