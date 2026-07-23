# Baitly UI — Analyse d'écart vs shadcn/ui (2026-07-23)

> ✅ **RÉSOLU le 2026-07-23** : l'intégralité des écarts ci-dessous a été portée
> (sauf `message-scroller`, qui exige React 19 via `@shadcn/react`). La lib est
> passée sur la source `bases/radix` + feuille `style-nova` (classes cn-*), et
> les 353 exemples du site sont branchés dans la galerie via
> `design-system/demos/` (manifeste `EXAMPLE_DEMOS`). Ce document reste comme
> trace de la méthode d'audit.

> Source : registry `ui.shadcn.com/r/index.json` (61 composants) + MDX docs
> `apps/v4/content/docs/components/radix/*.mdx` (exemples `ComponentPreview`).
> Les exemples `*-rtl` du site sont EXCLUS des manques : notre galerie a un
> toggle RTL global qui couvre ce cas pour toutes les sections.

## A. Composants ABSENTS de la bibliothèque (9)

| Composant | Rôle | Intérêt PMS | Dépendances |
|---|---|---|---|
| **combobox** | Select avec recherche (Popover + Command) | ⭐⭐⭐ sélecteur logement/guest partout | aucune (on a déjà popover+command) |
| **navigation-menu** | Menu de navigation horizontal riche | ⭐⭐ header marketing/booking engine | radix-ui |
| **native-select** | `<select>` natif stylé | ⭐⭐ formulaires simples, mobile | aucune |
| **attachment** | Pièce jointe (fichier/image, états, groupes) | ⭐⭐ chat guest, documents | aucune |
| **message** | Bulle de message de chat (avatar, header, actions) | ⭐⭐ messagerie guest | aucune |
| **message-scroller** | Zone de chat scrollable (ancrage, streaming) | ⭐⭐ messagerie guest + assistant | aucune |
| **bubble** | Bulles de chat (variantes, réactions, groupes) | ⭐ alternative à message | aucune |
| **marker** | Pastille/marqueur de statut (shimmer, bordures) | ⭐ statuts compacts planning | aucune |
| **direction** | Provider RTL (`dir`) | ⭐ utilitaire — notre toggle couvre déjà | aucune |

## B. Variantes manquantes par composant (présents dans la lib)

Format : **composant (nous / site hors RTL)** — exemples manquants (prioritaires en gras).

### Onglet Formulaires
- **button (3/14)** — **button-rounded** (pill), **button-aschild** (lien stylé bouton) ; le reste (variants isolés, spinner) couvert par nos 3 vues.
- **input (2/14)** — **input-invalid** (aria-invalid), **input-file**, input-required, input-disabled isolé, combos field/input-group/badge.
- **checkbox (1/7)** — **checkbox-description**, **checkbox-group**, checkbox-invalid, checkbox-table, checkbox-disabled isolé.
- **radio-group (1/6)** — **radio-group-choice-card** (cartes cliquables), radio-group-description, fieldset, disabled, invalid.
- **switch (1/6)** — **switch-sizes**, **switch-choice-card**, switch-description, disabled, invalid.
- **select (2/6)** — **select-scrollable** (longues listes), select-disabled, select-invalid, select-align-item.
- **slider (1/6)** — **slider-range** (2 poignées — filtre prix !), slider-vertical, slider-controlled, slider-multiple, slider-disabled.
- **toggle (2/5)** — toggle-sizes, toggle-text, toggle-disabled.
- **toggle-group (1/7)** — **toggle-group-sizes**, toggle-group-vertical, toggle-group-spacing, toggle-group-disabled, font-weight-selector.
- **button-group (1/11)** — **button-group-split** (bouton + caret), **button-group-dropdown**, button-group-select, orientation, size, nested, input, popover.
- **input-group (1/13)** — **input-group-kbd** (raccourci affiché), **input-group-spinner**, input-group-dropdown, block-start/end, textarea, custom.
- **input-otp (4/9)** — input-otp-invalid, input-otp-disabled, input-otp-four-digits, input-otp-form.
- **field (1/12)** — **field-choice-card**, **field-fieldset**, field-select/slider/checkbox/radio/switch/textarea, field-group, field-responsive.
- **form** — pas de page radix (notre port + démo suffisent).
- **textarea (1/5)** — textarea-invalid, textarea-disabled, textarea-button.
- **calendar (9/10)** — **calendar-hijri** (calendrier hégirien — marché arabe !), calendar-time (avec heure), calendar-week-numbers, calendar-custom-days.

### Onglet Affichage
- **badge (1/6)** — **badge-icon**, **badge-spinner**, badge-link, badge-colors.
- **card (1/5)** — **card-image**, card-small, card-spacing, card-edge-to-edge.
- **table (1/3)** — **table-footer** (totaux), **table-actions** (menu par ligne).
- **alert (2/5)** — **alert-action** (bouton dans l'alerte), alert-colors.
- **avatar (1/9)** — **avatar-group** + group-count (déjà exportés, non démontrés !), avatar-badge, avatar-size, avatar-dropdown.
- **progress (1/3)** — progress-label, progress-controlled.
- **skeleton (1/6)** — **skeleton-card**, skeleton-avatar, skeleton-text, skeleton-form, skeleton-table.
- **separator (1/4)** — separator-menu, separator-list.
- **item (1/10)** — item-variant/size/icon/avatar/image/group/header/link/dropdown.
- **empty (1/6)** — empty-outline, empty-background, empty-avatar(-group), empty-input-group.
- **accordion (1/6)** — **accordion-multiple**, accordion-disabled, accordion-borders, accordion-card.
- **collapsible (1/4)** — collapsible-settings, collapsible-file-tree.
- **hover-card (1/2)** — hover-card-sides.
- **scroll-area (1/2)** — **scroll-area-horizontal**.
- **carousel (1/6)** — carousel-orientation (vertical), carousel-api (dots/compteur), carousel-size, carousel-spacing, carousel-plugin (autoplay → dep `embla-carousel-autoplay`).
- **resizable (1/3)** — resizable-vertical, resizable-handle.
- **aspect-ratio (0/3)** — ⚠️ exporté mais AUCUNE démo dans la galerie : aspect-ratio-demo, square, portrait.

### Onglet Overlays
- **dialog (1/5)** — **dialog-scrollable-content**, dialog-sticky-footer, dialog-no-close-button.
- **alert-dialog (1/6)** — **alert-dialog-media**, alert-dialog-small, alert-dialog-destructive (variante bouton rouge).
- **sheet (1/3)** — **sheet-side** (4 côtés), sheet-no-close-button.
- **drawer (1/4)** — **drawer-sides**, drawer-scrollable-content, drawer-dialog (responsive dialog↔drawer).
- **tooltip (1/4)** — **tooltip-sides**, tooltip-keyboard (raccourci), tooltip-disabled.
- **popover (1/4)** — **popover-form**, popover-alignments.
- **dropdown-menu (1/12)** — **dropdown-menu-checkboxes**, **dropdown-menu-radio-group**, **dropdown-menu-submenu**, icons, avatar, complex.
- **context-menu (1/9)** — submenu, shortcuts, groups, icons, checkboxes, radio.
- **menubar (1/5)** — menubar-checkbox, menubar-radio, menubar-submenu, menubar-icons.
- **sonner (1/4 types partiels)** — sonner-types (tous les types dont warning/info/loading), sonner-position, sonner-description.
- **command (1/5)** — command-shortcuts, command-scrollable, command-groups (partiellement couvert).

### Onglet Navigation
- **tabs (2/5)** — **tabs-vertical**, tabs-icons, tabs-disabled.
- **breadcrumb (1/6)** — breadcrumb-dropdown, breadcrumb-ellipsis, breadcrumb-separator custom, breadcrumb-link.
- **pagination (1/3)** — pagination-simple, pagination-icons-only.
- **sidebar (1/1)** — ✅ couvert.

### Onglet Fondations
- **chart (8 types/8 exemples docs)** — ✅ types couverts ; exemples de config restants : chart-example-legend (légende), grid/axis variations. (Le site /charts a en plus ~50 blocks par type.)
- **kbd (1/5)** — kbd-button, kbd-tooltip, kbd-input-group.
- **spinner (2/7)** — spinner-size, spinner-custom, spinner-badge, spinner-empty, spinner-input-group.

## C. Chiffres

- Composants : **52/61** portés (9 absents, section A).
- Exemples documentés (hors `*-rtl`) : ~360 sur le site ; ~75 démontrés chez nous.
- Aucun manque ne requiert de nouvelle dépendance npm, sauf carousel-plugin (`embla-carousel-autoplay`).

## D. Priorités suggérées (valeur PMS)

1. **combobox** (composant) + select-scrollable — sélecteurs logement/guest.
2. **calendar-hijri** — marché Maroc/arabe (aligné i18n ar existant).
3. **slider-range** — filtre prix booking engine.
4. **table-footer / table-actions** — listes métier à migrer.
5. **dropdown-menu checkboxes/radio/submenu** — menus d'actions réels.
6. **skeleton-card/text/table** — états de chargement de la migration.
7. **avatar-group (+count)** — équipes/housekeepers (code déjà porté).
8. **dialog-scrollable + sheet-side + drawer-dialog responsive** — patterns de détail.
9. **radio/switch/field choice-card** — écrans de settings.
10. **native-select, attachment, message/message-scroller** — messagerie guest (phase dédiée).
