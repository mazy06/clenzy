# BRIEF DESIGN — Template « Recherche Catalogue » pour le Booking Engine Baitly

> Prompt à copier-coller dans **Claude Design**. Premier d'une série : **un template par parcours de
> réservation (funnel)**. On commence par le plus complet et le plus populaire : **Recherche Catalogue**.
> Les autres funnels (Logement unique, Demande de devis, Séjour + extras, Panier multi-séjours,
> Réservation express) réutiliseront la même trame.

---

## 1. Contexte produit
Baitly est un PMS SaaS de location courte durée. Son **booking engine** est un module de
réservation **embarquable** sur le site d'un hébergeur (conciergerie, agence, multi-propriétés).
Les **templates** sont des sites complets (multi-pages, HTML + CSS standard) que nos utilisateurs
chargent en 1 clic puis personnalisent.

Point clé d'architecture — **les widgets de réservation sont « headless »** : le SDK injecte le
HTML fonctionnel (calendrier, sélecteur de voyageurs, liste de logements, paiement…) **sans aucun
style imposé**. C'est **le CSS du template** qui les habille, via un contrat de classes `.cb-*` et
des variables `--cb-*` (détaillé §6). Ton template doit donc **fournir le style de ces widgets**,
au même titre que celui des sections marketing.

## 2. Ta mission
Concevoir **UN template complet** pour **un seul parcours de réservation : « Recherche Catalogue »**
(le plus complet et le plus populaire). Le design et la complexité doivent être **adaptés au persona
de ce parcours** (§3). Tu dois :
1. **Proposer 2 directions de design** (concept + rationale court : ambiance, palette, typo, principes
   de mise en page) et **recommander la meilleure**.
2. Livrer le **template complet, prêt à intégrer**, pour la direction recommandée, au **format §7**.

## 3. Le funnel « Recherche Catalogue » — persona & parcours
- **Persona** : un hébergeur avec **plusieurs logements** (conciergerie de riads, gîtes, résidence,
  multi-appartements). Le voyageur **explore et compare plusieurs biens** avant de réserver.
- **Enjeux UX** : recherche puissante, **grille de résultats lisible et comparable**, filtres,
  fiche logement riche (galerie, équipements, prix), signaux de confiance, parcours de paiement
  rassurant. C'est le parcours **le plus riche** (≠ mono-bien minimaliste).
- **Parcours** : `Accueil/Recherche → Résultats → Fiche logement → Réservation/Paiement → Confirmation`.

## 4. Architecture des pages à produire
Produis ces pages (chacune = HTML + CSS) ; chaque page a un **rôle**, un **chemin** et un **type** :

| Rôle | Chemin | Type | Contenu clé |
|---|---|---|---|
| Accueil | `/` | `HOME` | Hero + **barre de recherche** + **logements en vedette** + preuve sociale / avantages / FAQ |
| Résultats | `/logements` | `PROPERTY_LIST` | Barre de recherche (affiner) + **grille de résultats** + filtres |
| Fiche logement | `/logement` | `CUSTOM` | **Fiche** (galerie/nom/lieu/prix) + **équipements** + **dates + voyageurs** + **récap prix** + CTA réserver |
| Réservation | `/reserver` | `CUSTOM` | Récap logement + **récap prix** + **coordonnées** + **paiement** |
| Confirmation | `/confirmation` | `CUSTOM` | **Écran de confirmation** post-paiement |
| (optionnel) À propos / Contact | `/a-propos`, `/contact` | `CUSTOM` | Pages marketing, sans widget booking |

Navigation entre pages via les attributs `data-clenzy-next` (étape suivante) et `data-clenzy-return`
(page de retour après paiement) — voir §5.

## 5. Marqueurs booking à placer (le SEUL élément non-standard)
Aux emplacements fonctionnels, place un `<div>` **vide** portant `data-clenzy-widget="<id>"`.
Le SDK le remplace par le widget réel. **Ne mets aucun contenu dedans**, seulement le marqueur.

**Marqueurs « parcours » (recommandés pour le flux principal) :**
- `search` — barre de recherche complète (ville + dates + voyageurs + type + bouton). Ajoute
  `data-clenzy-next="/logements"`.
- `results` — grille de logements disponibles (cartes cliquables). Ajoute `data-clenzy-next="/logement"`.
- `property` — fiche du logement sélectionné (photo, nom, lieu, prix).
- `price` — récapitulatif détaillé du prix.
- `guest-form` — formulaire de coordonnées voyageur.
- `checkout` — bouton de paiement (Stripe). Ajoute `data-clenzy-return="/confirmation"`.
- `confirmation` — écran de confirmation (lit le retour de paiement).
- Atomiques si besoin : `dates`, `guests`, `currency`.

**Marqueurs « granulaires » (plus fins, optionnels pour enrichir une fiche) :**
`booking-amenities` (équipements), `booking-property-summary`, `booking-price-summary`,
`booking-property-results`, `booking-property-type`, `booking-filter`, `booking-add-to-cart`, etc.

Exemple :
```html
<section class="hero">
  <h1>…</h1>
  <div class="hero__search"><div data-clenzy-widget="search" data-clenzy-next="/logements"></div></div>
</section>
…
<div class="lodgings"><div data-clenzy-widget="results" data-clenzy-next="/logement"></div></div>
```

## 6. Widgets headless — contrat CSS à respecter
Les widgets rendent un DOM avec des classes stables `.cb-*` que **ton CSS doit styliser**. Pilote-les
de préférence par variables (un template = une palette), puis surcharge au besoin. Ne style **jamais**
via `:host` (les widgets sont en light DOM, pas en Shadow DOM).

**Variables à définir (sur `.cb-widget` ou un parent) :**
`--cb-accent` (couleur principale), `--cb-on-accent` (texte sur accent), `--cb-font`, `--cb-text`,
`--cb-muted` (texte secondaire), `--cb-surface` (fond contrôles/cartes), `--cb-border`,
`--cb-radius`, `--cb-control-h` (hauteur des champs/boutons).

**Sélecteurs principaux à habiller (+ états) :**
- Champs : `.cb-input`, `.cb-textarea`, `.cb-date-input`, `.cb-guests-toggle` (état `.cb-open`) ;
- Bouton d'action : `.cb-cta` (`:hover`, `:disabled`) ;
- Voyageurs : `.cb-guests-panel`, `.cb-guests-row`, `.cb-counter__btn` ;
- Calendrier : `.cb-calendar-grid`, `.cb-calendar-day` (états `.cb-selected`, `.cb-in-range`, `.cb-today`, `.cb-disabled`), `.cb-calendar-nav`, `.cb-calendar-weekday` ;
- Résultats : `.cb-property-card` (`:hover`, `.cb-selected`), `.cb-property-card__img`, `.cb-property-card__body`, `.cb-property-summary`, `.cb-amenities__list`, `.cb-amenity`, `.cb-badge` ;
- Prix : `.cb-price-line`, `.cb-price-total` ;
- Étapes/confirmation : `.cb-stepper`, `.cb-step` (`.cb-active`), `.cb-confirmation`, `.cb-confirmation__icon` ;
- Utilitaires : `.cb-text-sm` / `.cb-text-lg` / `.cb-text-muted`, `.cb-row`, `.cb-col`.

Le conteneur du widget porte `.cb-widget` (ou `.cb-widget.cb-widget--composed`). Donne au composite de
recherche une **disposition en rangée** responsive (champs qui grandissent, bouton à taille fixe).

## 7. Format de livraison (standard → intégration directe)
- **HTML standard et sémantique** par page : fournis **uniquement le contenu du `<body>`** (pas de
  `<!doctype>`, `<html>`, `<head>`). Aucune dépendance JS, aucun framework. Polices via Google Fonts
  (lien) autorisées.
- **CSS standard** par page (ou un CSS commun réutilisé sur toutes les pages), **préfixé** par des
  classes propres au template (ex. `.tpl-…`) pour éviter toute collision, **plus** les règles `.cb-*`
  du §6. Pas de `<style>` inline dispersés : un bloc CSS clair et commenté.
- **Responsive** obligatoire (375 / 768 / 1024 / 1440) et **accessible** (contraste ≥ 4.5:1, focus
  visible clavier, `alt`, landmarks, `prefers-reduced-motion`).
- **Thème** : indique la **couleur de marque** (`primaryColor`) et la **police** (`fontFamily`)
  retenues, et mappe-les sur les variables `--cb-*`.
- Structure la réponse **page par page** (titre du rôle + chemin + type + HTML + CSS) pour que
  l'intégration dans notre format `GalleryTemplate` (un objet `pages[]`) soit directe.

## 8. Règles de design Baitly (do / don't)
- **Interdits (AI-slop)** : dégradés purple→blue, texte en dégradé, glassmorphism décoratif, glow néon,
  bord latéral coloré >1px, 3 cartes identiques en rang, badge-icône arrondi au-dessus de chaque titre,
  noir/blanc purs, em-dash décoratifs, copy « Elevate / Seamless / Unleash ».
- **Attendus** : hiérarchie typo claire (3 paliers), `tabular-nums` sur prix/dates, `cursor:pointer`
  sur tout cliquable, transitions 150–300 ms `ease-out`, états hover/focus/disabled soignés, ombres
  **teintées** (pas de noir générique), `text-wrap: balance` sur les titres, skeletons / empty states.
- Icônes : style **lucide** (trait), jamais d'emoji. Pas de scale-transform au hover (layout shift).

## 9. Livrables attendus
1. **2 directions de design** (concept + palette + typo + principes de layout) + **recommandation**.
2. Pour la direction recommandée : le **template complet** au **format §7** (toutes les pages du §4).
3. La **liste des marqueurs** `data-clenzy-widget` utilisés et leur emplacement.
4. Le **mapping thème** : `primaryColor`, `fontFamily`, et les valeurs des variables `--cb-*`.
5. **Notes responsive & accessibilité**.

> Itération : commence par les 2 directions + la recommandation, puis livre le template complet de la
> direction recommandée. Tu pourras ensuite ajuster une page ou basculer de direction.

---

## Annexe — Notes d'intégration (côté Baitly, ne pas envoyer à Claude Design)
- La sortie devient un fichier `client/src/modules/booking-engine/studio/grapes/import/templates/<id>.ts`
  exportant un `GalleryTemplate` `{ id, name, description, theme:{primaryColor, fontFamily}, pages:[{path,type,title,seoTitle,seoDescription,html,css}] }`,
  puis ajouté à `GALLERY_TEMPLATES` dans `import/galleryTemplates.ts`.
- Types de page valides (`SitePageType`) utilisés : `HOME`, `PROPERTY_LIST`, `CUSTOM` (l'accueil **doit**
  être `HOME`).
- Contrat des marqueurs : vocabulaire « parcours » câblé par `STEP_TO_DEF_ID` (`search`, `results`,
  `property`, `price`, `guest-form`, `checkout`, `confirmation`, `dates`, `guests`, `currency`) + ids
  granulaires `booking-*` (cf. `bookingWidgetDefs`). Navigation : `data-clenzy-next` / `data-clenzy-return`.
- Contrat CSS complet des widgets : `client/src/modules/booking-engine/sdk/styles/WIDGET-CSS-CONTRACT.md`.
- Le skin par défaut (réutilisable / variables) : `sdk/styles/widget-skin.css`.
