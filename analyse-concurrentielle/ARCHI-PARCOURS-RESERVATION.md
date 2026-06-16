# Architecture — Parcours de réservation « template-driven » (multi-pages)

> Doc de conception. **Aucun code tant que ce doc n'est pas validé.**
> Principe directeur (décision utilisateur) : **le parcours de réservation émerge du template**, le SDK
> n'impose AUCUNE séquence. Les étapes sont des **primitives** placées par le template sur ses propres
> **pages**, reliées par un **état partagé persistant** qui survit à la navigation. Pas de fallback
> « express » mono-marqueur (choix assumé : pur template-driven).

---

## 1. Constat — ce qui est imposé aujourd'hui

`sdk/BaitlyWidget.ts` est une **machine à 3 pages figées** (`types.ts:70` : `'search' | 'form' | 'payment' | 'confirmation'`) :
- 3 pages HTML rendues en dur (`BaitlyWidget.ts:154-163`), basculées par `state.page` via l'event `pageChange` (`175-181`).
- Transitions câblées : bouton **« Réserver »** → `goToForm()` (exige propriété+dates, `190-195`) → page `form` (GuestForm figé) → submit → `handleCheckout()` (`619-668`) → `/reserve` → `/checkout` → **redirection Stripe** (`window.location.href`).
- **État en mémoire, UNE instance par montage** (`state.ts`, `new StateManager()`), **ne survit PAS** à une navigation de page.
- **Seule la page `search` est composable** via `componentConfig.widgetLayout` (les 17 micro-widgets). Pages `form`/`confirmation`, transitions, checkout, « Powered by Baitly » = **imposés**.

**À renverser** : les 3 pages, les transitions, le GuestForm figé, le checkout-redirection, la marque,
et surtout le **scope mono-montage** de l'état.

**Déjà bon à réutiliser** : les 17 micro-widgets (primitives quasi prêtes), le `StateManager`
(observable), la couche `BookingApi` (`reserve`/`checkout`/`reserveBatch`), le thème.

---

## 2. Modèle cible

```
Template (site GrapesJS, multi-pages)            BaitlyBookingCore (singleton, persistant)
  /            → [search] [results]            ┌─ état durable (sélection, dates, voyageurs,
  /logements   → [results] [filters]           │   panier, brouillon coordonnées, reservationCode)
  /logement/:id→ [property][availability][cta] │─ actions (search, selectProperty, setDates,
  /reservation → [guest-form][price][checkout] │   addToCart, reserve, checkout)
  /merci       → [confirmation]                └─ events (subscribe → re-render des primitives)
        │                                                    ▲
        └── marqueurs data-clenzy-widget="…" ── hydratés ────┘  (sur CHAQUE page)
```

Le parcours = **la structure de pages du template**. Le SDK ne fait que (a) fournir des **primitives**
hydratables, (b) maintenir un **cœur d'état partagé persistant**, (c) exposer des **actions**.

---

## 3. Composants de l'architecture

### 3.1 `BaitlyBookingCore` (cœur headless, nouveau)
Extrait l'état + l'API + les actions HORS de l'UI à 3 pages.
- **Singleton par session de site** (clé = apiKey/org), pas par montage.
- **État durable** persisté en **`sessionStorage`** (par onglet) + bits clés en **query string** (propertyId,
  dates → liens partageables / retour navigateur). Réhydraté au chargement de CHAQUE page.
- **Actions** : `loadProperties`, `search(filters)`, `selectProperty(id)`, `setDates`, `setGuests`,
  `addToCart`, `fetchPricing`, `reserve()`, `checkout({ returnUrl })`.
- **Events** : réutilise le pattern `StateManager.on(event)` ; les primitives s'abonnent.
- **Ne persiste PAS** de données sensibles de paiement ; le brouillon coordonnées (PII) reste en
  sessionStorage par onglet (à arbitrer — cf. §6 sécurité).

### 3.2 Primitives = marqueurs hydratés (réutilisent les 17 micro-widgets)
Un **bootstrap** scanne le DOM de chaque page et monte, pour chaque `data-clenzy-widget="<step>"`, la
primitive correspondante, **branchée sur le cœur partagé** :

| Marqueur | Rôle | Action déclenchée |
|---|---|---|
| `search` | ville + dates + voyageurs + bouton | `search()` puis navigation (cf. 3.3) |
| `results` / `property-list` | liste/cartes des logements | `selectProperty` → navigation détail |
| `property` | logement sélectionné | lecture état |
| `availability` / `dates` | calendrier du logement | `setDates` |
| `guests` | voyageurs | `setGuests` |
| `cart` | panier multi-séjours | `addToCart` / lecture |
| `price` | récap prix | lecture (`fetchPricing`) |
| `guest-form` | coordonnées | maj `core.guestForm` |
| `checkout` | bouton paiement | `reserve` + `checkout` → Stripe |
| `confirmation` | statut après retour Stripe | lit `?reservation=…` + re-fetch |

### 3.3 Navigation = déclarée par le template (jamais imposée)
- Convention légère : attribut optionnel **`data-clenzy-next="/chemin"`** sur les primitives actionnables
  (ex. le bouton `search` va vers la page résultats du template ; sélectionner un logement va vers le
  détail). À défaut, le template utilise ses **propres liens** (`<a href>`).
- **`data-clenzy-return="/merci"`** sur `checkout` → `return_url` Stripe = page confirmation du template.
- Aucune transition `pageChange` interne imposée : la « page » = une vraie page du site.

### 3.4 Retour Stripe
`checkout()` envoie `return_url` = page confirmation déclarée. Après paiement, l'utilisateur atterrit sur
cette page avec `?reservation=CODE&status=…` ; la primitive `confirmation` lit ces paramètres + re-fetch
le statut via l'API. Le cœur persistant permet aussi de vider le panier au retour.

### 3.5 Intégration GrapesJS + SSR
- **Éditeur** : chaque primitive devient un **composant GrapesJS** (on étend `bookingComponents` : une
  entrée par étape au lieu du monolithe), placeholder neutre en édition, marqueur à l'export.
- **SSR (clenzy-sites, G4)** : chaque page rendue inclut le **bootstrap SDK** qui hydrate tous les
  marqueurs présents + partage le cœur persistant. **Réconcilier le marqueur** : le SDK pose aujourd'hui
  `data-clenzy-booking`, les composants GrapesJS posent `data-clenzy-widget="booking"` → unifier sur
  `data-clenzy-widget="<step>"`.

---

## 4. Plan par phases

| Phase | Contenu | Livrable vérifiable |
|---|---|---|
| **B1** | `BaitlyBookingCore` : extraire état+API+actions, **persistance sessionStorage+URL** + réhydratation. Le monolithe actuel est refactoré pour CONSOMMER le cœur (rien ne casse pendant la migration). | tsc 0 ; le widget actuel marche toujours sur le cœur. |
| **B2** | **Bootstrap d'hydratation** : scanne `data-clenzy-widget` sur une page, monte les primitives (wrappers minces sur les builders existants), branchées au cœur. Unification du marqueur. | Plusieurs marqueurs sur une page → primitives synchronisées via le cœur. |
| **B3** | **Navigation template-driven** (`data-clenzy-next`/`data-clenzy-return`) + retour Stripe + primitive `confirmation`. | Parcours réparti sur 2-3 pages, état persistant entre elles, retour paiement OK. |
| **B4** | **Composants GrapesJS par primitive** + **SSR clenzy-sites** hydrate tous les marqueurs (rejoint G4). | Un site GrapesJS multi-pages exécute un parcours complet. |
| **B5** | **Retrait du monolithe 3-pages** imposé une fois les primitives couvrantes. | Plus aucune séquence imposée dans le SDK. |

---

## 5. Migration / non-régression
- Pendant B1-B4, **le monolithe `BaitlyWidget` reste fonctionnel** (refactoré sur le cœur) → aucune
  rupture du widget déployé. Il n'est retiré qu'en **B5**, quand les primitives couvrent le parcours.
- Greenfield assumé côté Studio (pas de contenu publié à migrer).

---

## 6. Risques & décisions ouvertes
- **R1 — Persistance de PII** : le brouillon coordonnées (nom/email/tel) en sessionStorage. Acceptable
  (par onglet, volatile), mais à valider ; jamais de données carte (Stripe gère). Pas de token en
  localStorage (règle sécurité #7).
- **R2 — Clé d'état partagé** : par apiKey/org. Que se passe-t-il si 2 sites/orgs sur le même domaine ?
  Préfixer la clé par apiKey.
- **R3 — Déclaration de navigation** : `data-clenzy-next` (convention) vs liens natifs du template seuls.
  Reco : supporter les deux, `data-clenzy-next` optionnel.
- **R4 — Cohérence éditeur ↔ runtime** : en édition, les primitives montrent un aperçu neutre (pas de
  parcours réel) ; le parcours ne s'exécute qu'au runtime (site publié).
- **R5 — Marqueur unifié** `data-clenzy-widget="<step>"` : impacte SSR (G4) + composants GrapesJS + SDK.

---

## 7. Fichiers (prévision)
- **Nouveau** : `sdk/core/BaitlyBookingCore.ts` (état+actions+persistance), `sdk/bootstrap.ts` (scan+hydrate
  marqueurs), `sdk/primitives/*` (wrappers minces réutilisant `sdk/components/*`).
- **Modifiés** : `sdk/BaitlyWidget.ts` (consomme le cœur ; retiré en B5), `sdk/state.ts` (persistance),
  `studio/grapes/bookingComponents.ts` + `bookingWidgetDefs.ts` (une primitive par étape),
  `clenzy-sites/*` (bootstrap d'hydratation par page, G4).

---

*Décision pivot validée : parcours MULTI-PAGES, pur template-driven (pas d'express). Suite : implémenter B1 (cœur headless + persistance).*
