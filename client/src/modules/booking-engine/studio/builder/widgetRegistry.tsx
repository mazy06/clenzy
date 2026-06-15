import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import {
  Search, CalendarDays, Users, Home, SlidersHorizontal, Coins, ArrowRight, ReceiptText,
  LayoutGrid, Building2, ShoppingCart, Plus, Sparkles, LogIn, RotateCcw, UserRound, ListChecks,
  type LucideIcon,
} from 'lucide-react';

/**
 * Registre des MICRO-WIDGETS du composeur de barre de réservation (Studio).
 *
 * Philosophie : pas de gros composant agrégé figé — des petits widgets (recherche, dates, voyageurs,
 * résultats, panier, connexion, récap…) qu'on utilise seuls OU qu'on glisse dans un conteneur `group`
 * (« composant vide adaptable ») pour composer sa propre barre / sa propre carte / son propre panier.
 * Même modèle d'instance que les blocs de page (`{ type, props, children? }`), persisté dans
 * `config.componentConfig`.
 *
 * Le `render` ici = APERÇU Studio (représentatif). Le rendu RÉEL sur le site (mapping vers
 * PropertyList / DatePicker / GuestSelector / CartList / PriceSummary / RebookStrip… du SDK) est fait
 * par `BaitlyWidget.buildLayoutWidget`. Chaque type ci-dessous a un équivalent fonctionnel côté SDK.
 */

export type WidgetType =
  // Recherche
  | 'citySearch'
  | 'dates'
  | 'guests'
  | 'propertyType'
  | 'filter'
  | 'currency'
  | 'searchButton'
  // Résultats & récap
  | 'propertyResults'
  | 'priceSummary'
  // Panier
  | 'cart'
  | 'addToCart'
  | 'addons'
  // Coordonnées & réservation
  | 'stepper'
  | 'guestForm'
  // Compte
  | 'account'
  | 'rebook'
  // Conteneur
  | 'group';

export type WidgetCategory = 'layout' | 'search' | 'results' | 'cart' | 'checkout' | 'account';

export type WidgetProps = Record<string, string | number | boolean>;

export interface WidgetDef {
  type: WidgetType;
  label: string;
  description: string;
  icon: LucideIcon;
  category: WidgetCategory;
  /** Conteneur (`group`) : peut contenir d'autres micro-widgets (pas d'imbrication de `group`). */
  isContainer?: boolean;
  defaultProps: WidgetProps;
  /** Aperçu Studio. `children` = contenu rendu des micro-widgets (conteneur `group` uniquement). */
  render: (props: WidgetProps, children?: ReactNode) => ReactNode;
}

const s = (v: unknown) => String(v ?? '');

/** Champ « pilule » réutilisé pour l'aperçu des micro-widgets de saisie. */
function field(icon: ReactNode, label: string): ReactNode {
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0,
      px: 1.5, height: 44, borderRadius: 999, border: '1px solid var(--line)', bgcolor: 'var(--card)',
      color: 'var(--ink)', fontSize: 14, whiteSpace: 'nowrap',
    }}>
      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}>{icon}</Box>
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>
    </Box>
  );
}

/** Bouton « pilule » (CTA secondaire) réutilisé pour panier / compte. */
function ghostButton(icon: ReactNode, label: string): ReactNode {
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 44, px: 2,
      borderRadius: 999, border: '1px solid var(--line)', bgcolor: 'var(--card)', color: 'var(--ink)',
      fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}>{icon}</Box>{label}
    </Box>
  );
}

const CITY_SEARCH: WidgetDef = {
  type: 'citySearch',
  label: 'Recherche ville',
  description: 'Champ destination / ville.',
  icon: Search,
  category: 'search',
  defaultProps: { placeholder: 'Où souhaitez-vous aller ?' },
  render: (p) => field(<Search size={16} strokeWidth={2} />, s(p.placeholder) || 'Destination'),
};

const DATES: WidgetDef = {
  type: 'dates',
  label: 'Dates',
  description: 'Sélecteur de dates (arrivée → départ).',
  icon: CalendarDays,
  category: 'search',
  defaultProps: { label: 'Arrivée — Départ' },
  render: (p) => field(<CalendarDays size={16} strokeWidth={2} />, s(p.label) || 'Arrivée — Départ'),
};

const GUESTS: WidgetDef = {
  type: 'guests',
  label: 'Voyageurs',
  description: 'Nombre de voyageurs (adultes / enfants).',
  icon: Users,
  category: 'search',
  defaultProps: { label: 'Voyageurs' },
  render: (p) => field(<Users size={16} strokeWidth={2} />, s(p.label) || 'Voyageurs'),
};

const PROPERTY_TYPE: WidgetDef = {
  type: 'propertyType',
  label: 'Type de logement',
  description: 'Filtre par type (appartement, villa, riad…).',
  icon: Home,
  category: 'search',
  defaultProps: { label: 'Type de logement' },
  render: (p) => field(<Home size={16} strokeWidth={2} />, s(p.label) || 'Type de logement'),
};

const FILTER: WidgetDef = {
  type: 'filter',
  label: 'Filtre',
  description: 'Filtre additionnel (équipement, budget…).',
  icon: SlidersHorizontal,
  category: 'search',
  defaultProps: { label: 'Filtres' },
  render: (p) => field(<SlidersHorizontal size={16} strokeWidth={2} />, s(p.label) || 'Filtres'),
};

const CURRENCY: WidgetDef = {
  type: 'currency',
  label: 'Devise',
  description: 'Sélecteur de devise.',
  icon: Coins,
  category: 'search',
  defaultProps: { label: 'EUR' },
  render: (p) => field(<Coins size={16} strokeWidth={2} />, s(p.label) || 'EUR'),
};

const SEARCH_BUTTON: WidgetDef = {
  type: 'searchButton',
  label: 'Bouton Rechercher',
  description: 'Bouton de validation de la recherche.',
  icon: ArrowRight,
  category: 'search',
  defaultProps: { label: 'Rechercher' },
  render: (p) => (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 44, px: 2.5,
      borderRadius: 999, bgcolor: 'var(--accent)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {s(p.label) || 'Rechercher'} <ArrowRight size={16} strokeWidth={2.2} />
    </Box>
  ),
};

/** Mini-carte de logement pour l'aperçu de la liste des résultats. */
function miniPropertyCard(name: string, meta: string, price: string): ReactNode {
  return (
    <Box sx={{ display: 'flex', gap: 1, p: 1, borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--card)' }}>
      <Box sx={{ width: 52, height: 52, borderRadius: 'var(--radius-sm)', bgcolor: 'var(--field)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
        <Building2 size={18} strokeWidth={1.75} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</Box>
        <Box sx={{ fontSize: 12, color: 'var(--muted)' }}>{meta}</Box>
        <Box sx={{ fontSize: 12, color: 'var(--ink)', mt: 0.25 }}><b>{price}</b> <span style={{ color: 'var(--muted)' }}>/ nuit</span></Box>
      </Box>
    </Box>
  );
}

const PROPERTY_RESULTS: WidgetDef = {
  type: 'propertyResults',
  label: 'Logements disponibles',
  description: 'Liste des logements disponibles (résultats de recherche, cliquables).',
  icon: Building2,
  category: 'results',
  defaultProps: {},
  render: () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 240 }}>
      {miniPropertyCard('Riad Médina', 'Marrakech · 3 ch.', '180 €')}
      {miniPropertyCard('Villa Atlas', 'Agadir · 4 ch.', '320 €')}
    </Box>
  ),
};

const PRICE_SUMMARY: WidgetDef = {
  type: 'priceSummary',
  label: 'Récap prix',
  description: 'Récapitulatif détaillé du prix du séjour.',
  icon: ReceiptText,
  category: 'results',
  defaultProps: {},
  render: () => (
    <Box sx={{ minWidth: 220, p: 1.25, borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--card)', fontSize: 13, color: 'var(--ink)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>3 nuits</span><span>540 €</span></Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>Ménage</span><span>45 €</span></Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, mt: 0.5, pt: 0.5, borderTop: '1px solid var(--line)' }}><span>Total</span><span>585 €</span></Box>
    </Box>
  ),
};

const CART: WidgetDef = {
  type: 'cart',
  label: 'Panier',
  description: 'Panier multi-séjours : liste des séjours ajoutés + total + validation.',
  icon: ShoppingCart,
  category: 'cart',
  defaultProps: {},
  render: () => (
    <Box sx={{ minWidth: 240, p: 1.25, borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--card)', fontSize: 13 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontWeight: 700, color: 'var(--ink)', mb: 0.75 }}>
        <ShoppingCart size={15} strokeWidth={2} /> Votre panier
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>Riad Médina · 3 nuits</span><span>585 €</span></Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, mt: 0.5, pt: 0.5, borderTop: '1px solid var(--line)', color: 'var(--ink)' }}><span>Total</span><span>585 €</span></Box>
    </Box>
  ),
};

const ADD_TO_CART: WidgetDef = {
  type: 'addToCart',
  label: 'Ajouter au panier',
  description: 'Ajoute le séjour courant au panier (multi-séjours).',
  icon: Plus,
  category: 'cart',
  defaultProps: { label: 'Ajouter au panier' },
  render: (p) => ghostButton(<Plus size={16} strokeWidth={2.2} />, s(p.label) || 'Ajouter au panier'),
};

const ADDONS: WidgetDef = {
  type: 'addons',
  label: 'Options & extras',
  description: 'Services additionnels du séjour (transfert, ménage, petit-déjeuner…).',
  icon: Sparkles,
  category: 'cart',
  defaultProps: {},
  render: () => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {['Transfert aéroport · 35 €', 'Petit-déjeuner · 12 €', 'Ménage final · 45 €'].map((x) => (
        <Box key={x} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, height: 32, borderRadius: 999, border: '1px solid var(--line)', bgcolor: 'var(--card)', fontSize: 12.5, color: 'var(--ink)' }}>
          <Sparkles size={13} strokeWidth={2} style={{ color: 'var(--accent)' }} /> {x}
        </Box>
      ))}
    </Box>
  ),
};

const ACCOUNT: WidgetDef = {
  type: 'account',
  label: 'Connexion / compte',
  description: 'Bouton de connexion au compte voyageur (favoris, re-booking).',
  icon: LogIn,
  category: 'account',
  defaultProps: { label: 'Se connecter' },
  render: (p) => ghostButton(<LogIn size={16} strokeWidth={2} />, s(p.label) || 'Se connecter'),
};

const REBOOK: WidgetDef = {
  type: 'rebook',
  label: 'Réserver à nouveau',
  description: 'Re-booking 1-clic pour le voyageur connecté (séjours passés).',
  icon: RotateCcw,
  category: 'account',
  defaultProps: {},
  render: () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent)', bgcolor: 'var(--card)', fontSize: 13, color: 'var(--ink)' }}>
      <RotateCcw size={15} strokeWidth={2} style={{ color: 'var(--accent)' }} />
      Réserver à nouveau <b>Riad Médina</b>
    </Box>
  ),
};

const STEPPER: WidgetDef = {
  type: 'stepper',
  label: 'Étapes (progression)',
  description: 'Indicateur de progression : séjour → identité → validation → confirmation.',
  icon: ListChecks,
  category: 'checkout',
  defaultProps: {},
  render: () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {i > 0 && <Box sx={{ width: 24, height: 2, bgcolor: 'var(--line)' }} />}
          <Box sx={{ width: 14, height: 14, borderRadius: 999, bgcolor: i === 0 ? 'var(--accent)' : 'var(--field)', border: '1px solid var(--line)' }} />
        </Box>
      ))}
    </Box>
  ),
};

const GUEST_FORM: WidgetDef = {
  type: 'guestForm',
  label: 'Coordonnées voyageur',
  description: 'Formulaire de contact (nom, e-mail, téléphone) → bouton de paiement.',
  icon: UserRound,
  category: 'checkout',
  defaultProps: {},
  render: () => (
    <Box sx={{ minWidth: 240, p: 1.5, borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--card)', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Box sx={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Vos informations</Box>
      {['Nom', 'E-mail', 'Téléphone'].map((l) => (
        <Box key={l} sx={{ height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', bgcolor: 'var(--field)', display: 'flex', alignItems: 'center', px: 1, fontSize: 12, color: 'var(--muted)' }}>{l}</Box>
      ))}
      <Box sx={{ mt: 0.5, height: 36, borderRadius: 999, bgcolor: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>Continuer vers le paiement</Box>
    </Box>
  ),
};

const GAP_PX: Record<string, string> = { sm: '8px', md: '12px', lg: '20px' };

const GROUP: WidgetDef = {
  type: 'group',
  label: 'Conteneur',
  description: 'Agrège des micro-widgets (ligne/colonne) : barre de recherche, carte, panier…',
  icon: LayoutGrid,
  category: 'layout',
  isContainer: true,
  defaultProps: { direction: 'row', gap: 'md', wrap: true },
  render: (p, children) => (
    <Box sx={{
      display: 'flex',
      flexDirection: s(p.direction) === 'column' ? 'column' : 'row',
      flexWrap: p.wrap === false ? 'nowrap' : 'wrap',
      alignItems: s(p.direction) === 'column' ? 'stretch' : 'center',
      gap: GAP_PX[s(p.gap)] ?? GAP_PX.md,
      // Rayon BORNÉ (pas 999) : une pilule sur un conteneur multi-lignes a des coins ≈ demi-hauteur,
      // les widgets près des coins déborderaient de la courbe. radius-lg = arrondi sûr en 1 ou N lignes.
      p: 1.25, borderRadius: 'var(--radius-lg)', bgcolor: 'var(--card)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-card, 0 6px 20px rgba(20,24,28,0.08))',
      width: s(p.direction) === 'column' ? 'auto' : 'fit-content', maxWidth: '100%',
    }}>
      {children}
    </Box>
  ),
};

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDef> = {
  citySearch: CITY_SEARCH,
  dates: DATES,
  guests: GUESTS,
  propertyType: PROPERTY_TYPE,
  filter: FILTER,
  currency: CURRENCY,
  searchButton: SEARCH_BUTTON,
  propertyResults: PROPERTY_RESULTS,
  priceSummary: PRICE_SUMMARY,
  cart: CART,
  addToCart: ADD_TO_CART,
  addons: ADDONS,
  stepper: STEPPER,
  guestForm: GUEST_FORM,
  account: ACCOUNT,
  rebook: REBOOK,
  group: GROUP,
};

/**
 * Catégories de la palette, ordonnées selon le PARCOURS de réservation (recherche → résultats →
 * panier → coordonnées/paiement → compte). Permet de retrouver chaque micro-widget par étape.
 */
export const WIDGET_CATEGORIES: { category: WidgetCategory; label: string; types: WidgetType[] }[] = [
  { category: 'layout', label: 'Mise en page', types: ['group'] },
  { category: 'search', label: 'Recherche', types: ['citySearch', 'dates', 'guests', 'propertyType', 'filter', 'currency', 'searchButton'] },
  { category: 'results', label: 'Résultats & prix', types: ['propertyResults', 'priceSummary'] },
  { category: 'cart', label: 'Panier & options', types: ['cart', 'addToCart', 'addons'] },
  { category: 'checkout', label: 'Coordonnées & réservation', types: ['stepper', 'guestForm'] },
  { category: 'account', label: 'Compte', types: ['account', 'rebook'] },
];

/** Ordre à plat dans la palette du composeur (conteneur en premier). */
export const WIDGET_ORDER: WidgetType[] = WIDGET_CATEGORIES.flatMap((c) => c.types);

/** Micro-widgets autorisés DANS un conteneur (tout sauf `group` — pas d'imbrication). */
export const NESTABLE_WIDGET_ORDER: WidgetType[] = WIDGET_ORDER.filter((t) => t !== 'group');

export function getWidgetDef(type: WidgetType): WidgetDef {
  return WIDGET_REGISTRY[type];
}

export function isWidgetType(t: unknown): t is WidgetType {
  return typeof t === 'string' && t in WIDGET_REGISTRY;
}

/**
 * Aperçu « headless » (toggle « Design du template » OFF) : HTML NATIF sans aucun style — reflète
 * l'absence de CSS du widget réel (`styleMode: 'none'`). C'est ensuite au template / au CSS de la page
 * de styler ces éléments. Le conteneur `group` reste un simple `<div>` (aucun layout forcé).
 */
export function renderRawWidget(type: WidgetType, props: WidgetProps, children?: ReactNode): ReactNode {
  switch (type) {
    case 'group':
      return <div className="cb-wgroup">{children}</div>;
    case 'citySearch':
      return <input type="text" placeholder={s(props.placeholder) || 'Destination'} />;
    case 'dates':
      return <input type="text" placeholder={s(props.label) || 'Arrivée — Départ'} />;
    case 'guests':
      return <input type="number" placeholder={s(props.label) || 'Voyageurs'} />;
    case 'propertyType':
      return <select><option>{s(props.label) || 'Type de logement'}</option></select>;
    case 'filter':
      return <select><option>{s(props.label) || 'Filtres'}</option></select>;
    case 'currency':
      return <select><option>{s(props.label) || 'EUR'}</option></select>;
    case 'searchButton':
      return <button type="button">{s(props.label) || 'Rechercher'}</button>;
    case 'addToCart':
      return <button type="button">{s(props.label) || 'Ajouter au panier'}</button>;
    case 'account':
      return <button type="button">{s(props.label) || 'Se connecter'}</button>;
    case 'propertyResults':
      return <ul><li>Riad Médina — 180 €/nuit</li><li>Villa Atlas — 320 €/nuit</li></ul>;
    case 'priceSummary':
      return <div><div>3 nuits — 540 €</div><div>Ménage — 45 €</div><div><b>Total — 585 €</b></div></div>;
    case 'cart':
      return <div><div><b>Votre panier</b></div><div>Riad Médina · 3 nuits — 585 €</div><button type="button">Continuer</button></div>;
    case 'addons':
      return <ul><li><label><input type="checkbox" /> Transfert aéroport — 35 €</label></li><li><label><input type="checkbox" /> Petit-déjeuner — 12 €</label></li></ul>;
    case 'stepper':
      return <ol><li>Séjour</li><li>Identité</li><li>Validation</li><li>Confirmation</li></ol>;
    case 'guestForm':
      return (
        <form>
          <div><label>Nom<br /><input type="text" /></label></div>
          <div><label>E-mail<br /><input type="email" /></label></div>
          <div><label>Téléphone<br /><input type="tel" /></label></div>
          <button type="submit">Continuer vers le paiement</button>
        </form>
      );
    default:
      return <span>{getWidgetDef(type).label}</span>;
  }
}
