# Sidebar — contrat de non-régression (migration vers Baitly UI)

> Inventaire exhaustif de `components/Sidebar.tsx` (716 l.) et
> `components/SidebarNavItem.tsx` (167 l.), établi **avant** migration.
>
> **Statut : migration faite.** Les deux fichiers d'origine sont supprimés ;
> la navigation vit dans `components/AppSidebar.tsx`, montée par
> `modules/layout/MainLayoutFull.tsx` sous `SidebarProvider`.
>
> Légende : `[x]` repris à l'identique · `[~]` équivalent fonctionnel, mécanisme
> ou rendu différent · `[ ]` **non repris**, justifié en §D.
> Aucun écart n'est coché comme tenu.
>
> Décisions de migration : coquille shadcn complète · palette `--bui-sidebar-*`
> · clic sur un hub = dépliage, navigation par les onglets.

## A. Ce que la projection ne montre PAS — à préserver impérativement

### A.1 Les quatre boutons du pied de sidebar

La projection n'a qu'une carte utilisateur. Le réel a **quatre boutons d'action**
sous cette carte, disposés en **ligne** (déplié) ou en **colonne** (réduit) :

- [x] **Préférences** (icône `Faders`) — ouvre un menu à trois sections :
  - [x] *Apparence* : **7 pastilles de teinte d'accent** (`ACCENT_OPTIONS`,
        `useAccent` → `data-accent` sur `<html>`, optimiste + PUT préférences)
  - [x] *Apparence* : **mode clair / sombre / auto** (`useThemeMode`, optimiste + backend)
  - [x] *Langue* : **fr / en / ar** (`changeLanguage`), coche sur l'actif
  - [x] *Devise* : `CURRENCY_OPTIONS` avec `<CurrencySymbol>` (MAD/SAR en icône,
        € textuel), coche sur l'actif
  - [x] *Devise* : ligne « taux au JJ/MM » + état `ratesLoading`, affichée
        seulement si `currency !== 'EUR'`
  - [x] Ancrage du menu inversé en RTL (`anchorOrigin`/`transformOrigin`)
- [x] **Notifications** (cloche) → `/notifications`
  - [x] **Pastille de non-lus** : composant isolé `UnreadNotificationsDot`,
        React Query, `refetchInterval` 30 s, **poll coupé si l'onglet est caché**,
        **poll arrêté** si `notificationsApi._endpointAvailable === false`.
        ⚠️ L'isolation est délibérée : le tick ne doit re-rendre que la pastille,
        pas les 700 lignes de la sidebar.
- [x] **Déconnexion** — `authApi.logout()` → `clearTokens()` → reset
      `keycloak.token`/`refreshToken`/`authenticated` → `clearUser()` →
      `dispatchEvent('keycloak-auth-logout')`, le tout dans un `try/catch` silencieux
- [x] **Réduire / étendre** — **desktop uniquement**, doubles chevrons dont le
      sens s'inverse en RTL et selon l'état

### A.2 Comportements de navigation

- [x] **Préchargement de route** : `prefetchRoute(item.path)` sur `mouseenter`
      ET sur `focus` — le clic n'attend plus le chunk
- [x] **Actif par préfixes** : `isActive` = chemin exact **ou** n'importe quel
      `matchPaths` (préfixe + sous-routes détail). C'est ce qui garde un hub
      actif sur tous ses onglets.
- [x] **Logo cliquable** → `/dashboard`, `role="button"`, `tabIndex`, clavier
      Entrée/Espace, `aria-label`
- [x] **Carte utilisateur cliquable** → `/settings`, mêmes affordances clavier

### A.3 Badges

- [x] **5 couleurs** mappées sur les tokens : `warning` → `--warn`, `error` → `--err`,
      `success` → `--ok`, `info` → `--info`, `primary` → `--accent`
      (la projection n'en a que 2)
- [x] Badge **actif** : fond `rgba(255,255,255,.25)` sur item sélectionné
- [x] Déplié = pastille compteur (`99+` au-delà de 99) poussée à la fin
- [x] **Réduit = point 8 px ancré au coin de l'ICÔNE**, pas du bouton
      (sinon il flotte au-dessus du rail)

### A.4 Modes et responsive

- [~] **Mobile** : équivalent fonctionnel — feuille latérale du kit à la place du
      `Drawer variant="temporary"`. Ouverture, fermeture après navigation et
      montage permanent conservés ; largeur et rendu diffèrent (cf. §D.3).
- [~] **Desktop** : équivalent fonctionnel — la gouttière du kit
      (`sidebar-gap`) remplace le `Drawer variant="permanent"`. L'espace reste
      réservé dans le flex, le mécanisme n'est plus le même.
- [x] Transition de largeur `.2s`, neutralisée sous `prefers-reduced-motion`
- [x] Le bouton réduire n'existe pas sur mobile

### A.5 États réduits

- [~] Logo : **disposition de la projection** retenue à la place du traitement
      d'origine (mark + nom sur deux lignes, au lieu de mark + wordmark SVG).
      Mark 40 px déployé, 32 px en mode icônes.
- [ ] Libellé de groupe remplacé par un **point médian centré** — **non repris**,
      le kit masque le libellé sans rien laisser (cf. §D.1).
- [x] **Tooltip** sur chaque item, placement inversé en RTL
- [x] Carte utilisateur : avatar seul, sans fond ni bordure ; tooltip enrichi
      « nom — email »
- [~] Boutons de pied en colonne — largeur pleine du rail plutôt que 40 px fixes.

### A.6 Utilisateur

- [x] Photo de profil via `userAvatarSrc(user)`, repli sur **2 initiales**
- [x] Nom affiché : `prénom nom` → `username` → `t('navigation.defaultUser')`
- [x] **Rôle affiché** sous le nom : `t('navigation.roles.<role>')`
- [x] Tooltip = email (déplié) / « nom — email » (réduit)

### A.7 RTL et accessibilité

- [x] Placement des tooltips inversé (`left`/`right`)
- [x] Sens des chevrons inversé
- [x] Propriétés logiques partout (`insetInlineEnd`, `marginInlineStart`, `px`)
- [~] `focus-visible` sur tous les éléments interactifs — via l'anneau du kit
      (`ring-sidebar-ring`) au lieu du contour 2 px `--accent`.
- [x] `prefers-reduced-motion` sur **toutes** les transitions

### A.8 Performance

- [ ] `SidebarNavItem` est un `React.memo` — **non repris** (cf. §D.2).
- [x] `groupMenuItems` mémoïsé
- [x] La pastille de non-lus est isolée du reste de l'arbre

## B. Ce que la projection apporte — les gains visés

- [x] **Sous-menus dépliables** par hub (`SidebarMenuSub`). Adossés à des données
      réelles : `config/navigationHubs.ts` définit déjà les `tabs` de chaque hub.
      C'est le vrai gain fonctionnel de la migration.
- [x] `SidebarRail` — poignée de repli sur le bord
- [x] En-tête produit (nom + sous-titre) — repris tel quel de la projection :
      mark + « Baitly » + « Property Management ». Remplace le wordmark SVG.
- [x] Tokens `--bui-sidebar-*` au lieu des `sx` MUI

## C. Points de vigilance identifiés

1. **Le shell**. `MainLayoutFull` est un flex MUI où le `Drawer variant="permanent"`
   réserve lui-même sa place. Le `Sidebar` shadcn fonctionne autrement
   (`SidebarProvider` + éléments `fixed` + `SidebarInset`). Les deux modèles ne se
   superposent pas : adopter le shell shadcn impose de restructurer le layout
   (bannière hors ligne, hamburger mobile, dock assistant, bandeau PWA compris).
2. **La palette**. Le réel utilise les tokens `--nav-*` (dégradé sombre de la
   signature). La projection utilise `--bui-sidebar-*`. Changer de palette est un
   changement visible pour l'utilisateur, indépendant de la migration technique.
3. **Les sous-menus changent la navigation** : aujourd'hui une entrée de hub
   navigue directement vers son premier onglet. Avec des sous-items, il faut
   trancher entre « le clic navigue » et « le clic déplie ».

## D. Écarts assumés après migration

Trois points n'ont **pas** été reproduits à l'identique. Aucun n'est une perte de
fonctionnalité, mais ils changent le rendu — à valider à l'œil.

1. **Le point médian des libellés de groupe en mode icônes.** L'ancienne sidebar
   affichait un « · » centré à la place du libellé. Le kit masque le libellé
   (opacité + marge négative) et ne laisse rien. Simplification retenue plutôt
   que de contrefaire le comportement du kit.
2. **`NavEntry` n'est plus mémoïsé.** `SidebarNavItem` était un `React.memo`.
   Mémoïser ici supposerait de stabiliser les rappels passés en props ; l'effet
   était de toute façon annulé à chaque navigation, puisque `isActive` change.
   À reprendre si le profilage le justifie.
3. **Le tiroir mobile est une feuille latérale du kit**, pas un
   `Drawer variant="temporary"` MUI. Comportement équivalent (ouverture,
   fermeture après navigation, `keepMounted` implicite), rendu différent.

### Corrections apportées pendant la migration

- **`prefers-reduced-motion`** : le kit anime largeur, marge et opacité sans
  garde. Une règle scopée a été ajoutée en fin de `theme/baitly-ui.css` plutôt
  que de modifier la feuille Nova portée.
- **Logo en mode icônes** : le kit se contente de rogner le contenu débordant.
  Le rendu est donc piloté en JS (`state === 'collapsed' && !isMobile`) pour
  retrouver le traitement d'origine — mark seul agrandi avec animation au repos
  replié, mark réduit sans animation + wordmark déployé.
- **Définition unique de « mobile »** : le kit utilise 768 px, `useSidebarState`
  utilisait le palier `md` de MUI (900 px). Entre les deux, la barre mobile et
  la sidebar permanente se seraient affichées ensemble. `MobileTopBar` consomme
  désormais le `isMobile` du kit — une seule définition.

### Ce qui reste à vérifier à l'œil

La galerie et l'application sont derrière l'authentification : **rien de ce qui
précède n'a été vu à l'écran.** En priorité :
- le rail de 3 rem en mode icônes (logo, pastilles de badge, pied en colonne) ;
- le sous-menu déplié sur un hub actif, et l'exception « clic = navigation » en
  mode icônes ;
- le panneau de préférences en RTL (ancrage, pastilles d'accent) ;
- la zone de contenu : `h-svh` + `overflow-hidden` doivent conserver le scroll
  interne des pages qui gèrent le leur (Planning, Studio full-bleed).

## E. Tablette et mobile

Non traité au premier jet — ajouté après coup. **Une régression avait été
introduite** : deux échelles de points de rupture cohabitaient.

| Échelle | `md` | `lg` |
|---|---|---|
| Tailwind — le kit, `hooks/use-mobile` | **768** | 1024 |
| MUI — ancien `useSidebarState` | **900** | 1200 |

Entre **768 et 900 px**, le kit se croyait sur desktop pendant que le repli
forcé ne s'était pas encore déclenché : une tablette en portrait affichait la
sidebar **déployée sur 16 rem**, là où l'ancienne version la masquait en tiroir.

### Régimes retenus

La tablette bascule en **feuille latérale**, comme le mobile. Un rail d'icônes y
aurait reposé entièrement sur des infobulles au survol — qui n'existent pas au doigt.

| Largeur | Rendu | Repli |
|---|---|---|
| **< 1024 px** | Feuille latérale déployée, ouverte par la barre supérieure | sans objet |
| **≥ 1024 px** | Sidebar permanente, rail d'icônes au choix | préférence utilisateur, persistée par appareil |

Mise en œuvre : `SIDEBAR_SHEET_BREAKPOINT = 1024` dans `ui/sidebar.tsx`,
`useIsMobile(breakpoint)` rendu paramétrable (défaut 768 pour tout autre usage),
et les classes `md:block` / `md:flex` de la coquille desktop passées en `lg:`.
`useSidebarState` ne gère donc plus aucun palier : il ne porte que la préférence
desktop.

### Cibles tactiles

Sous 1024 px la sidebar est manipulée au doigt ; les hauteurs desktop y sont trop justes.

- Entrées de navigation : `h-8` → **`max-lg:h-10`**
- Sous-items de hub : `h-7` → **`max-lg:h-9`**
- Boutons du pied : `h-8` → **`max-lg:h-11`**

### Piège relevé sur le logo

`SidebarMenuButton` impose `[&_svg]:size-4` à **tous** ses SVG descendants : la
prop `size` de `BaitlyMarkLogo` était silencieusement écrasée à 16 px — y compris
dans la projection de galerie. Le wrapper rétablit la taille avec `!`, et la
réduit en mode icônes où le bouton n'est plus qu'un carré de 32 px.

### Reste ouvert

- La feuille latérale ne propose pas de fermeture par glissement (le kit ferme
  au tap sur le fond ou après navigation).
- Aucun régime spécifique en **paysage sur mobile** (hauteur < 480 px) : le pied
  à quatre boutons et la carte utilisateur peuvent y comprimer la liste.
- `navigation.productTagline` n'a **pas** de traduction : le libellé
  « Property Management » s'affiche tel quel dans les trois langues, comme dans
  la projection. La clé existe pour être localisée plus tard.
