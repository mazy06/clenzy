# Inventaire interne — Domaine 4 : Tarification dynamique / Yield

> Colonne « Clenzy » de l'analyse concurrentielle. Établi à partir de l'inventaire fourni
> (pas de relecture exhaustive du code). Périmètre : moteur de prix, règles de yield,
> intégrations tierces, IA, restrictions de séjour, frais/dépôts/taxes, données marché.
> Dernière mise à jour : 2026-06-13.

## Vue d'ensemble

Clenzy dispose d'un **moteur de tarification propriétaire structuré** (`PriceEngine`) couplé à
des **règles de yield automatiques** (`YieldRule`) et à une **intégration native PriceLabs**.
Le moteur IA existe mais reste **désactivé en production** (feature-flag OFF). Les taxes ne
font pas partie du pipeline de prix (moteur fiscal séparé). Score auto-évalué du domaine : **2/3**.

## Composants implémentés

### 1. PriceEngine — résolution en 8 niveaux (Implémenté)

Pipeline de résolution déterministe, du plus prioritaire au plus générique :

1. **RateOverride** — surcharge manuelle d'un prix sur une date/période donnée
2. **PROMOTIONAL** — prix promotionnel
3. **EVENT** — prix lié à un évènement
4. **WEEKEND** — majoration/minoration week-end
5. **SEASONAL** — prix saisonnier
6. **EARLY_BIRD** — réservation anticipée
7. **LAST_MINUTE** — réservation de dernière minute
8. **BASE** → repli `Property.nightlyPrice`

C'est un moteur **basé sur des règles configurées** (rule-based déterministe), pas un moteur
prédictif statistique. Il couvre les leviers classiques de tarification manuelle structurée.

### 2. YieldRule — ajustements automatiques (Implémenté)

Règles d'ajustement automatique (en % ou en montant) déclenchées par des conditions :

- **OCCUPANCY_THRESHOLD** — ajustement selon un seuil de taux d'occupation
- **DAYS_BEFORE_ARRIVAL** — ajustement selon le nombre de jours avant arrivée (courbe de lead time)
- **LAST_MINUTE_FILL** — remplissage dernière minute
- **GAP_FILL** — remplissage des trous de calendrier (gap nights / orphan days)

C'est la brique de yield la plus proche d'un automatisme « occupancy-based » : la décision
reste pilotée par des règles déclaratives, pas par un modèle de demande appris.

### 3. Intégration PriceLabs native (Implémenté)

- `PriceLabsService` implémentant l'interface `ExternalPricingService`
- Communication REST + **circuit breaker** (résilience)
- Connecteur natif vers le leader du marché de la tarification dynamique STR

C'est le point fort « parité marché » : Clenzy peut déléguer la tarification à PriceLabs
comme le font la quasi-totalité des PMS concurrents.

### 4. Restrictions de séjour & opérations de prix (Implémenté)

- **Min / max nights**
- **Gap rules** (règles de trous de calendrier)
- **Lead time** (délai avant arrivée)
- **Bulk update** des prix (mise à jour en masse)

## Composants partiels

### 5. AiPricingService — IA de tarification (Partiel)

- Approche **hybride** : rule-based + LLM Claude
- **Derrière le feature-flag `clenzy.ai.features.pricing-ai` = OFF en production**
- Donc : capacité présente dans le code, mais **non exposée aux clients prod** aujourd'hui

Conséquence benchmark : on ne peut pas créditer Clenzy d'un moteur IA « livré » ; il s'agit
d'un actif latent (différenciateur potentiel si activé et fiabilisé).

### 6. Taxes (séjour / TVA) — hors pipeline pricing (Partiel pour le yield)

- Calculées par un **FiscalEngine séparé**, en dehors du `PriceEngine`
- Du point de vue « tarification dynamique / yield », la fiscalité n'est donc pas un levier
  intégré au prix optimisé : c'est une couche fiscale en aval

Pour ce domaine précis, on note la fonctionnalité « taxes auto » comme **partielle** : elle
existe au niveau produit mais n'est pas pilotée par le moteur de yield.

## Composants absents

### 7. Beyond Pricing — interface stub (Absent)

- Une **interface stub existe, sans implémentation**
- Donc pas de connecteur Beyond Pricing fonctionnel en prod

### 8. Wheelhouse / DPGO — non documenté

- Aucun connecteur Wheelhouse ni DPGO dans l'inventaire fourni → considéré **absent**

### 9. Market data / comps natifs — non documenté

- Pas de moteur de données marché / comparables propriétaire dans l'inventaire (au-delà de
  ce que PriceLabs apporte en délégation). Les comps « maison » sont donc **absents**.

## Synthèse pour le scoring

| Capacité | État Clenzy |
|---|---|
| Moteur de prix structuré (multi-niveaux) | Implémenté (8 niveaux) |
| Règles de yield automatiques (occupancy, lead time, gap) | Implémenté (4 types) |
| Connecteur PriceLabs natif | Implémenté |
| Connecteur Beyond Pricing | Absent (stub) |
| Connecteur Wheelhouse / DPGO | Absent / non documenté |
| Moteur IA propriétaire **livré** | Partiel (présent mais flag OFF en prod) |
| Min / max nights, gap rules, lead time, bulk update | Implémenté |
| Orphan-day rules dédiées | Partiel (couvert par GAP_FILL, pas de feature « orphan » nommée) |
| Frais / dépôts dans le pipeline pricing | Non documenté dans le domaine |
| Taxes auto pilotées par le yield | Partiel (FiscalEngine séparé) |
| Market data / comps propriétaires | Absent (délégué à PriceLabs) |

**Score auto-évalué du domaine : 2/3.** Socle solide (moteur structuré + yield rules +
connecteur PriceLabs), mais pas de moteur IA réellement livré en prod, pas de second
connecteur (Beyond), et pas de données marché propriétaires.
