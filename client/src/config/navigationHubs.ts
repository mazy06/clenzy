/**
 * Registre des hubs de navigation — regroupement validé (2026-06-12).
 *
 * 16 entrées sidebar → 9 : chaque hub = 1 entrée sidebar + onglets de
 * niveau 1 pilotés par la ROUTE (les URLs historiques restent canoniques,
 * aucun bookmark cassé, les fiches détail conservent leurs routes).
 * Les sous-onglets internes des écrans (`?tab=…`) restent le niveau 2.
 *
 * L'accès par onglet réplique exactement les contrôles historiques de
 * useNavigationMenu : un onglet inaccessible est masqué, un hub sans
 * onglet accessible disparaît de la sidebar.
 */

export interface HubAccess {
  /** user.permissions (claims agrégées du JWT) */
  permissions: string[];
  isAdmin: boolean;
  isManager: boolean;
}

export interface HubTab {
  /** Route canonique de l'onglet (cible de navigation). */
  path: string;
  /** Préfixes de routes additionnels couverts par l'onglet (état actif). */
  matchPrefixes?: string[];
  translationKey: string;
  fallbackLabel: string;
  /** true si l'onglet est visible pour cet utilisateur. */
  isAccessible: (access: HubAccess) => boolean;
}

export interface HubDef {
  id: string;
  /** Clé i18n du libellé sidebar. */
  translationKey: string;
  fallbackLabel: string;
  group: 'main' | 'management' | 'admin';
  tabs: HubTab[];
}

const has = (access: HubAccess, permission: string) => access.permissions.includes(permission);

export const NAVIGATION_HUBS: HubDef[] = [
  {
    id: 'exploitation',
    translationKey: 'navigation.exploitation',
    fallbackLabel: 'Exploitation',
    group: 'main',
    tabs: [
      {
        path: '/properties',
        matchPrefixes: ['/connected-objects'],
        translationKey: 'navigation.properties',
        fallbackLabel: 'Propriétés',
        isAccessible: (a) => has(a, 'properties:view'),
      },
      {
        path: '/reservations',
        matchPrefixes: ['/calendar'],
        translationKey: 'navigation.reservations',
        fallbackLabel: 'Réservations',
        isAccessible: (a) => has(a, 'reservations:view'),
      },
      {
        path: '/interventions',
        matchPrefixes: ['/service-requests'],
        translationKey: 'navigation.interventions',
        fallbackLabel: 'Interventions',
        isAccessible: (a) => has(a, 'interventions:view') || has(a, 'service-requests:view'),
      },
    ],
  },
  {
    id: 'contacts',
    translationKey: 'navigation.contactsHub',
    fallbackLabel: 'Contacts',
    group: 'management',
    tabs: [
      {
        path: '/contact',
        translationKey: 'navigation.messaging',
        fallbackLabel: 'Messagerie',
        isAccessible: (a) => has(a, 'contact:view'),
      },
      {
        path: '/directory',
        matchPrefixes: ['/users', '/teams', '/portfolios'],
        translationKey: 'navigation.directory',
        fallbackLabel: 'Annuaire',
        isAccessible: (a) =>
          has(a, 'teams:view') || has(a, 'portfolios:view') || has(a, 'guests:view') || has(a, 'users:manage'),
      },
    ],
  },
  {
    id: 'documents',
    translationKey: 'navigation.documents',
    fallbackLabel: 'Documents',
    group: 'management',
    tabs: [
      {
        path: '/documents',
        translationKey: 'navigation.documents',
        fallbackLabel: 'Documents',
        isAccessible: (a) => has(a, 'documents:view'),
      },
      {
        path: '/contracts',
        translationKey: 'navigation.contracts',
        fallbackLabel: 'Contrats de gestion',
        isAccessible: (a) => has(a, 'payments:manage'),
      },
    ],
  },
  {
    id: 'finances',
    translationKey: 'navigation.finances',
    fallbackLabel: 'Finances',
    group: 'management',
    tabs: [
      {
        path: '/billing',
        matchPrefixes: ['/payments'],
        translationKey: 'navigation.billing',
        fallbackLabel: 'Facturation',
        isAccessible: (a) => has(a, 'payments:view'),
      },
      {
        path: '/tarification',
        translationKey: 'navigation.tarification',
        fallbackLabel: 'Tarification',
        isAccessible: (a) => has(a, 'tarification:view'),
      },
    ],
  },
  {
    id: 'distribution',
    translationKey: 'navigation.distribution',
    fallbackLabel: 'Distribution',
    group: 'management',
    // Ordre d'affichage : Réservation & accueil, puis Boutique, puis Channels.
    // tabs[0] est aussi la cible par défaut de l'entrée sidebar du hub (useNavigationMenu).
    tabs: [
      {
        path: '/booking-engine',
        translationKey: 'guestExperience.navLabel',
        fallbackLabel: 'Réservation & accueil',
        isAccessible: (a) => has(a, 'properties:view'),
      },
      {
        path: '/shop',
        translationKey: 'navigation.shop',
        fallbackLabel: 'Boutique',
        // Historique : /shop n'a jamais été gaté par permission dans hasMenuAccess.
        isAccessible: () => true,
      },
      {
        path: '/channels',
        translationKey: 'navigation.channels',
        fallbackLabel: 'Channels',
        isAccessible: (a) => has(a, 'properties:view'),
      },
    ],
  },
  {
    id: 'platform-tools',
    translationKey: 'navigation.platformTools',
    fallbackLabel: 'Outils plateforme',
    group: 'admin',
    tabs: [
      {
        path: '/admin/sync',
        translationKey: 'navigation.syncDiagnostics',
        fallbackLabel: 'Diagnostics sync',
        isAccessible: (a) => has(a, 'users:manage') && a.isAdmin,
      },
      {
        path: '/admin/kpi',
        translationKey: 'navigation.kpiReadiness',
        fallbackLabel: 'KPI readiness',
        isAccessible: (a) => has(a, 'users:manage') && a.isAdmin,
      },
      {
        path: '/admin/exchange-rates',
        translationKey: 'navigation.exchangeRates',
        fallbackLabel: 'Taux de change',
        isAccessible: (a) => has(a, 'users:manage') && a.isAdmin,
      },
      {
        path: '/admin/database',
        translationKey: 'navigation.database',
        fallbackLabel: 'Base de données',
        isAccessible: (a) => has(a, 'users:manage') && a.isAdmin,
      },
      {
        path: '/admin/promo-codes',
        translationKey: 'navigation.promoCodes',
        fallbackLabel: 'Codes promo',
        isAccessible: (a) => has(a, 'users:manage'),
      },
    ],
  },
];

/** Tous les préfixes de routes couverts par un onglet (path + matchPrefixes). */
export function tabRoutePrefixes(tab: HubTab): string[] {
  return [tab.path, ...(tab.matchPrefixes ?? [])];
}

/** true si pathname appartient à l'onglet (route exacte ou sous-route). */
export function tabMatchesPath(tab: HubTab, pathname: string): boolean {
  return tabRoutePrefixes(tab).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Hub auquel appartient la route courante (ou undefined). */
export function findHubForPath(pathname: string): HubDef | undefined {
  return NAVIGATION_HUBS.find((hub) => hub.tabs.some((tab) => tabMatchesPath(tab, pathname)));
}

/** Onglets visibles d'un hub pour un utilisateur. */
export function accessibleHubTabs(hub: HubDef, access: HubAccess): HubTab[] {
  return hub.tabs.filter((tab) => tab.isAccessible(access));
}

export function findHubById(id: string): HubDef | undefined {
  return NAVIGATION_HUBS.find((hub) => hub.id === id);
}

export interface HubScreenContext {
  hub: HubDef;
  /** Onglets accessibles (= écrans frères) du hub. */
  tabs: HubTab[];
  /** Route canonique de l'onglet actif (celui dont la racine == pathname). */
  activeTabPath: string;
}

/**
 * Écrans-MENU autonomes (hors hub) — Tableau de bord, Planning, Assistant,
 * Rapports, Paramètres, Rôles, Monitoring. Pour la cohérence visuelle, ils
 * affichent leur identité dans la MÊME signature que les hubs : une pastille +
 * une pilule unique (switcher à un seul écran). `iconKey` = route, résolue en
 * icône côté HubScreenSwitcher.
 */
export interface StandaloneScreen {
  path: string;
  translationKey: string;
  fallbackLabel: string;
}

export const STANDALONE_SCREENS: StandaloneScreen[] = [
  { path: '/planning', translationKey: 'navigation.planning', fallbackLabel: 'Planning' },
  { path: '/dashboard', translationKey: 'navigation.dashboard', fallbackLabel: 'Tableau de bord' },
  { path: '/reports', translationKey: 'navigation.reports', fallbackLabel: 'Rapports' },
  { path: '/settings', translationKey: 'navigation.settings', fallbackLabel: 'Paramètres' },
  { path: '/automation-rules', translationKey: 'navigation.automationRules', fallbackLabel: 'Automatisations' },
  { path: '/permissions-test', translationKey: 'navigation.rolesPermissions', fallbackLabel: 'Rôles & permissions' },
  { path: '/admin/monitoring', translationKey: 'navigation.monitoring', fallbackLabel: 'Monitoring' },
];

/**
 * Identité d'écran rendue par PageHeader, dans une signature unique :
 *   - `switcher` : page-racine d'un hub avec ≥2 écrans accessibles → pilules multiples.
 *   - `single`   : écran autonome OU hub à 1 seul écran accessible → pilule unique.
 * `null` = page de détail (/properties/123…) ou route inconnue → titre classique.
 */
export type ScreenIdentity =
  | ({ kind: 'switcher' } & HubScreenContext)
  | { kind: 'single'; iconKey: string; translationKey: string; fallbackLabel: string };

/**
 * Résout l'identité d'écran pour PageHeader. Le match d'un hub se fait sur la
 * RACINE EXACTE d'un onglet (pas une sous-route de détail comme /properties/123),
 * sinon on retombe sur les écrans autonomes, sinon null (titre classique).
 */
export function getScreenIdentity(pathname: string, access: HubAccess): ScreenIdentity | null {
  const hub = findHubForPath(pathname);
  if (hub) {
    const tabs = accessibleHubTabs(hub, access);
    const active = tabs.find((tab) => tabRoutePrefixes(tab).some((prefix) => prefix === pathname));
    if (active) {
      if (tabs.length >= 2) return { kind: 'switcher', hub, tabs, activeTabPath: active.path };
      return {
        kind: 'single',
        iconKey: active.path,
        translationKey: active.translationKey,
        fallbackLabel: active.fallbackLabel,
      };
    }
  }
  const screen = STANDALONE_SCREENS.find((s) => s.path === pathname);
  if (screen) {
    return {
      kind: 'single',
      iconKey: screen.path,
      translationKey: screen.translationKey,
      fallbackLabel: screen.fallbackLabel,
    };
  }
  return null;
}
