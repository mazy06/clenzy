# Stratégie — Devenir leader du booking engine (Baitly / Baitly Studio)

> **But** : plan détaillé pour faire du booking engine de Baitly le **meilleur du marché** sur son créneau,
> en s'appuyant sur l'analyse [B11](benchmark/B11-booking-engine-builder.md). **Date** : 2026-06-20.
> **Sources concurrents** : RoomRaccoon, Lodgify, Hostaway, Smoobu, Guesty, Cloudbeds, Mews, **Asterio/Septeo**.

---

## 0. Thèse (positionnement en une phrase)

> **Le seul booking engine qui va du template clé-en-main à la liberté totale (import de n'importe quel
> site existant), porté par un widget JS moderne et l'IA — pensé pour les conciergeries et la conformité FR.**

Le « wedge » : on **matche la norme** du marché (template + éditeur visuel, façon Lodgify/Hostaway) **par
défaut**, et on **dépasse** par 4 choses que personne ne combine : **import multi-standards**, **SDK moderne
(vs jQuery legacy)**, **IA native**, **profondeur conciergerie/FR**.

---

## 1. Diagnostic — les failles du marché = nos ouvertures

| Concurrent | Sa force | Sa faille | Ce que Baitly exploite |
|---|---|---|---|
| **Lodgify / Hostaway** | Template + éditeur visuel complet (la norme STR) | Pas d'import externe ; pas de profondeur FR/conciergerie | **Import** + conformité + conciergerie multi-marque |
| **RoomRaccoon / Smoobu / Guesty** | Simplicité (template bridé) | Personnalisation faible, pas d'import | Liberté progressive (guidé → libre) |
| **Cloudbeds** | Échappatoire HTML/CSS | Pas d'import, hôtel-centric | Import + STR/conciergerie |
| **Mews** | Headless API (flexible) | Pas de builder (tout à faire) | Builder **+** API (les deux) |
| **Asterio / Septeo** (FR) | Multi-activités (resto/spa/bons cadeaux) ; service « fait-pour-vous » | **Booking engine en jQuery legacy** (confirmé) ; pas de self-service | **SDK moderne** (perf/SSR) + self-serve + option assistée |

**4 ouvertures nettes :**
1. **Personne n'importe** Elementor/Divi/Webflow/HTML → différenciateur unique.
2. **Le marché hôtelier FR tourne en jQuery legacy** (Asterio) → notre SDK moderne est un avantage réel.
3. **L'IA est naissante** (seul Hostaway génère le contenu) → on a déjà assistant + RAG + `AiDesignMatcher`.
4. **Les généralistes sont faibles** sur conciergerie + conformité FR (NF, loi Le Meur) → notre niche défendable.

---

## 2. Les 5 piliers stratégiques

| # | Pilier | Atout déjà là (refonte `booking-engine-wip`) | À construire | Contre qui ça gagne |
|---|---|---|---|---|
| **P1** | **Builder « dual »** : guidé (template + drag-drop) par défaut, libre + import en avancé | GrapesJS + `ImportGallery` + `bookingWidgetDefs` (blocs) + `import/` (adaptateurs) | Bibliothèque de **N templates** ; UX « niveau 1 / niveau 2 » | Lodgify/Hostaway (on matche **et** on importe) |
| **P2** | **IA native** : générer site/contenu/SEO depuis les données propriété | Assistant multi-provider + RAG pgvector + `AiDesignMatcher` | « Décris ton bien → site généré » ; copy/SEO auto ; suggestions de blocs | Hostaway (on rattrape **et** on va plus loin via les données PMS) |
| **P3** | **Widget SDK moderne** : booking engine embarquable partout, SSR/perf/SEO | `sdk/core` (StateManager+API+i18n) + `sdk/primitives` + `sdk/components` + marqueur `data-clenzy-widget` (hydratation) | Finaliser SSR ; « 1 ligne pour ajouter le direct booking à n'importe quel site » | **Asterio (jQuery legacy)**, moteurs hôteliers FR |
| **P4** | **Conciergerie / agence-first** : multi-marque, multi-propriété, + option **« done-with-you »** | Multi-tenant, multi-property, Studio admin | Setup assisté / templates clé-en-main (créneau « fait-pour-vous » d'Asterio) ; gestion multi-sites | Asterio (service) + généralistes (niche) |
| **P5** | **Économie du direct + conformité FR** (moat) | Direct booking sans commission, socle conformité (NF, fiscal) | Leviers anti-OTA, trust accounting, badges conformité | OTA + concurrents non-FR |

---

## 3. Différenciateurs & douves (defensibility)

| Douve | Pourquoi c'est dur à copier |
|---|---|
| **Bibliothèque d'adaptateurs d'import** (Elementor/Divi/Webflow/HTML…) | Chaque standard supporté = travail d'ingénierie + couverture ; effet « plus on en a, plus on est incontournable » |
| **IA + données PMS** (RAG, AiDesignMatcher) | Génération nourrie par les **vraies données** du bien (photos, équipements, tarifs) — un concurrent sans PMS profond ne peut pas |
| **SDK moderne + SSR** | Réécriture lourde pour les legacy (jQuery → moderne) ; on part déjà moderne |
| **Conciergerie + conformité FR** | Connaissance métier + réglementaire (NF, loi Le Meur) que les généralistes US n'ont pas |
| **Switching cost** | Multi-propriété + multi-marque + site + booking + PMS intégrés = écosystème collant |

---

## 4. Roadmap — Now / Next / Later

### NOW (débloque tout) — porter la refonte sur `main`
- **Intégration GrapesJS + SDK moderne + import** (plan P0→P5 : cf. mémoire réconciliation). Garder le Studio/settings actuels.
- **Matcher la norme** : galerie de templates + drag-drop opérationnels (niveau « guidé »).
- **Finaliser le SSR** du site public (perf/SEO).
- *Sortie* : un builder qui fait déjà template + drag-drop + import + widget moderne.

> **Principe directeur (non négociable)** : on **ne sacrifie ni le design ni les fonctionnalités existants**
> pour s'adapter à GrapesJS — **c'est GrapesJS qui s'adapte** (UI thémée Baitly, blocs custom, canvas = design
> actuel). Toute **impossibilité technique** est **remontée au fil de l'eau** pour résolution conjointe, jamais
> de régression silencieuse. **Le pricing et la liste/construction des templates cibles sont traités À LA FIN**
> (après portage + validation), pas dans cette phase.

### NEXT (différenciation) — 1 à 2 trimestres
- **Bibliothèque de templates** : passer de 1 (`conciergerieMarrakech`) à **N**, pro, par segment (conciergerie, villa, appart, B&B, ville). C'est ce qui rivalise avec les galeries Lodgify/Hostaway.
- **IA-native** : « décris ton bien → template + contenu + SEO générés » (assistant + AiDesignMatcher) ; suggestions de blocs.
- **Modes guidé/avancé** explicites (bridage par défaut, import en mode pro).
- **Croissance** : lead capture, relance panier, parrainage (déjà amorcé côté settings).

### LATER (extension de marché) — 6 mois+
- **Multi-activités** (resto / spa / extras / bons cadeaux) — le terrain d'Asterio, ouvre l'hôtellerie.
- **Marketplace** de templates/blocs (communauté/agences) → effet réseau.
- **Service « done-with-you »** (setup assisté payant) — capter les non-bricoleurs.
- **Plus d'adaptateurs d'import** (Wix, Squarespace, Shopify…) → élargir la douve.

---

## 5. Go-to-market & pricing

| Axe | Reco |
|---|---|
| **Cible primaire** | Conciergeries FR/EU (multi-propriété), puis hosts/petits hôtels indépendants |
| **Message « wedge »** | « Importe ton site existant + ajoute le direct booking en 1 ligne » (personne d'autre ne le permet) |
| **Modèle pricing** | Builder **inclus / add-on** dans l'offre PMS (≈ Hostaway gratuit pour clients) ; option « setup assisté » payante (créneau Asterio) ; per-property cohérent avec le marché |
| **Preuve** | Templates de démo par segment + cas conciergerie (multi-marque) + perf SSR (Lighthouse) |

---

## 6. Métriques de leadership (KPIs)

| Catégorie | KPI |
|---|---|
| **Couverture** | # templates en galerie · # standards d'import supportés · # blocs booking |
| **Adoption** | # sites publiés · time-to-publish (objectif < 1h) · % sites avec import |
| **Performance** | Conversion direct booking · Lighthouse/LCP du site public (SSR) · part trafic SEO |
| **IA** | % de sites/contenus générés par IA · temps gagné vs manuel |
| **Business** | % réservations directes (vs OTA) · rétention conciergeries · revenu builder |

---

## 7. Risques & garde-fous

| Risque | Garde-fou |
|---|---|
| **Complexité GrapesJS** vs simplicité attendue | Mode **guidé bridé par défaut** ; le mode libre/import est opt-in |
| **Scope** (multi-pages, multi-activités) | Multi-pages **différé** ; multi-activités en Later ; livrer le cœur d'abord |
| **Coût IA** | Quasi-négligeable par génération (cf. RAG) ; cap + cache |
| **Maintenance des adaptateurs d'import** | Couche d'adaptation isolée, tests par standard ; prioriser les 3-4 plus utilisés |
| **Rattrapage IA des concurrents** | Avance par les **données PMS** (RAG) qu'ils n'ont pas ; itérer vite |
| **Dépendance GrapesJS (lib externe)** | Encapsuler ; le SDK/`sdk/core` reste maison (pas verrouillé à GrapesJS) |

---

## 8. Synthèse — la phrase à retenir

On **matche la norme** (template + drag-drop, façon Lodgify/Hostaway) **par défaut**, et on **gagne** par
**l'import multi-standards** (unique), le **widget moderne** (vs jQuery legacy d'Asterio), l'**IA nourrie aux
données PMS**, et la **profondeur conciergerie/FR**. La séquence : **porter la refonte (NOW)** → **templates +
IA (NEXT)** → **multi-activités + marketplace + done-with-you (LATER)**.
