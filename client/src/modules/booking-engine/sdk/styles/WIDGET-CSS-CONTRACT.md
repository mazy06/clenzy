# Contrat CSS des widgets de réservation (mode headless)

> Les widgets sont rendus **vierges** en light DOM (cf. `headless.ts`). Le **template** les habille via
> son CSS, qui atteint désormais les widgets. Ce document liste **tous les points d'accroche** (`.cb-*`)
> et leurs états, pour styler 100 % des widgets sans en oublier.
>
> Deux couches :
> - **`structural.css`** (injecté par le SDK) : mise en page invisible (display/grid/flex/position). **Ne pas dupliquer.**
> - **`widget-skin.css`** (asset de template, injecté dans le CSS de la page) : le cosmétique, piloté par variables.
>
> Pour démarrer : bouton **« Styles widgets »** du Studio (dépose le skin) — ou personnalise les sélecteurs ci-dessous.

## Variables de marque (à poser sur `.cb-widget` ou un parent)

| Variable | Rôle | Défaut (fallback) |
|---|---|---|
| `--cb-accent` | Couleur principale (boutons, sélection, accents) | `#6B8A9A` |
| `--cb-on-accent` | Texte/icône sur l'accent | `#ffffff` |
| `--cb-font` | Police | `inherit` (template) |
| `--cb-text` | Couleur de texte | `inherit` (template) |
| `--cb-muted` | Texte secondaire | `rgba(0,0,0,.55)` |
| `--cb-surface` | Fond des contrôles / cartes | `#ffffff` |
| `--cb-border` | Bordures | `rgba(0,0,0,.14)` |
| `--cb-radius` | Arrondi | `10px` |
| `--cb-control-h` | Hauteur des contrôles (inputs/boutons) | `48px` |

```css
/* Exemple : aligner les widgets sur la marque du template */
.cb-widget { --cb-accent: #c2674a; --cb-font: 'Manrope', sans-serif; --cb-radius: 8px; }
```

## Conteneur

| Sélecteur | Élément |
|---|---|
| `.cb-widget` | Racine d'un widget (porter ici les variables ; pas de cosmétique imposé) |
| `.cb-widget.cb-widget--composed` | Widget en mode composé (conteneur de mise en page seul) |
| `.cb-section` | Bloc/section interne |
| `.cb-section-label` | Intitulé de section (capitales discrètes) |

## Recherche

| Sélecteur | Élément / état |
|---|---|
| `.cb-input`, `.cb-textarea` | Champs texte (`:focus`) |
| `.cb-dates`, `.cb-date-input` | Bloc dates / un champ date |
| `.cb-cta` | Bouton d'action (`:hover`, `:disabled`) — Rechercher / Payer / Ajouter |
| `.cb-guests-toggle` | Déclencheur du sélecteur de voyageurs (`.cb-open`) |
| `.cb-guests-toggle__label`, `.cb-guests-toggle__value`, `.cb-guests-toggle__chevron` | Sous-éléments (chevron pivote en `.cb-open`) |
| `.cb-guests-panel` | Panneau déroulant (`.cb-open`) |
| `.cb-guests-row`, `.cb-guests-row__info`, `.cb-guests-row__title` | Ligne (adultes/enfants…) |
| `.cb-counter`, `.cb-counter__btn`, `.cb-counter__value` | Compteur +/− (`:disabled`) |
| `.cb-currency-selector`, `.cb-currency-select` | Sélecteur de devise |

## Calendrier

| Sélecteur | Élément / état |
|---|---|
| `.cb-calendar-wrapper` | Conteneur repliable (`.cb-open`) |
| `.cb-calendar-header`, `.cb-calendar-nav` | En-tête + flèches (`:disabled`) |
| `.cb-calendar-month` | Libellé du mois |
| `.cb-calendar-weekdays`, `.cb-calendar-weekday` | Ligne des jours de la semaine |
| `.cb-calendar-grid` | Grille des jours (7 colonnes) |
| `.cb-calendar-day` | Jour. États : `.cb-selected`, `.cb-in-range`, `.cb-today`, `.cb-disabled` |

## Résultats & prix

| Sélecteur | Élément / état |
|---|---|
| `.cb-property-card` | Carte logement (`:hover`, `.cb-selected`) |
| `.cb-property-card__img`, `.cb-property-card__body` | Image / corps |
| `.cb-property-card--horizontal`, `.cb-property-card--overlay` | Variantes de disposition |
| `.cb-property-summary`, `.cb-property-summary__image` | Détail du logement |
| `.cb-amenities__list`, `.cb-amenity` | Équipements (puces) |
| `.cb-price-line`, `.cb-price-total` | Lignes de prix / total |
| `.cb-property-tabs` | Onglets (scroll horizontal) |
| `.cb-badge` | Badge (ex. « Populaire ») |

## Panier & options

| Sélecteur | Élément |
|---|---|
| `.cb-cart__item`, `.cb-cart__item-right`, `.cb-cart__total` | Lignes du panier + total |
| `.cb-addon`, `.cb-addon__info`, `.cb-addon__check` | Option/extra (`.cb-selected`) |

## Coordonnées & réservation

| Sélecteur | Élément |
|---|---|
| `.cb-form-row`, `.cb-input-group` | Disposition du formulaire |
| `.cb-stepper`, `.cb-step`, `.cb-step__dot`, `.cb-step__line` | Progression (`.cb-active`) |
| `.cb-confirmation`, `.cb-confirmation__icon`, `.cb-confirmation__title`, `.cb-confirmation__subtitle`, `.cb-confirmation__details` | Écran de confirmation |

## Compte

| Sélecteur | Élément |
|---|---|
| `.cb-rebook__row`, `.cb-rebook__card`, `.cb-rebook__cta` | Re-booking |
| `.cb-lead-overlay`, `.cb-lead-card`, `.cb-lead-card__close`, `.cb-lead-form`, `.cb-lead-consent` | Modales (compte / capture de lead) |
| `.cb-auth-row` | Ligne de boutons d'authentification |

## Utilitaires

| Sélecteur | Rôle |
|---|---|
| `.cb-text-xs/sm/md/lg/xl` | Échelle typographique relative (`em`) |
| `.cb-text-medium`, `.cb-text-semibold` | Graisses |
| `.cb-text-muted`, `.cb-text-secondary` | Texte atténué |
| `.cb-row`, `.cb-row-between`, `.cb-col`, `.cb-gap-1..4` | Helpers de flux |
| `.cb-spinner`, `.cb-spinner--sm`, `.cb-spinner--lg` | Indicateur de chargement |

---

### Règles d'or
1. **Ne stylez jamais via `:host`** : le widget n'est plus en Shadow DOM (light DOM).
2. **Posez les variables sur `.cb-widget`** (ou un parent) ; surchargez un sélecteur précis pour le sur-mesure.
3. Le **structurel** (layout) est déjà géré par le SDK — n'y touchez que pour le cosmétique.
4. Pensez aux **états** (`:hover`, `:focus`, `:disabled`, `.cb-open`, `.cb-selected`, `.cb-in-range`, `.cb-active`).
