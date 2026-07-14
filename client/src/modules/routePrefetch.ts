/**
 * Préchargement des chunks de routes (perf navigation).
 *
 * Les pages du PMS sont code-splittées (React.lazy dans AuthenticatedApp) :
 * sans préchargement, chaque clic de navigation paie le téléchargement du
 * chunk à froid (spinner RouteFallback le temps du fetch réseau). Ce module
 * expose les mêmes `import()` que les React.lazy — Rollup dédoublonne les
 * imports dynamiques d'un même module, donc précharger ici remplit le cache
 * de modules et rend la navigation instantanée.
 *
 * Deux points d'entrée :
 * - {@link prefetchRoute} : au survol/focus d'un item de la sidebar.
 * - {@link warmHotRoutes} : au boot authentifié, pendant l'idle du navigateur,
 *   pour les destinations les plus fréquentes.
 */

// Préfixe de route → import() du chunk de page (mêmes modules que les lazy()
// d'AuthenticatedApp — garder les deux listes alignées quand une route bouge).
const ROUTE_IMPORTS: Record<string, () => Promise<unknown>> = {
  '/planning': () => import('./planning/PlanningPage'),
  '/dashboard': () => import('./dashboard/Dashboard'),
  '/properties': () => import('./properties/PropertiesPage'),
  '/reservations': () => import('./reservations/ReservationsList'),
  '/interventions': () => import('./work-orders/WorkOrdersPage'),
  '/contact': () => import('./messaging/MessagingHubPage'),
  '/directory': () => import('./directory/DirectoryPage'),
  '/documents': () => import('./documents/DocumentsPage'),
  '/contracts': () => import('./contracts/ManagementContractsPage'),
  '/billing': () => import('./billing/BillingPage'),
  '/tarification': () => import('./tarification/Tarification'),
  '/booking-engine': () => import('./guest-experience/GuestExperiencePage'),
  '/shop': () => import('./shop/ShopPage'),
  '/channels': () => import('./channels/ChannelsPage'),
  '/calendar': () => import('./calendar/CalendarPage'),
  '/reports': () => import('./reports/Reports'),
  '/settings': () => import('./settings/Settings'),
  '/automation-rules': () => import('./automation/AutomationRulesPage'),
  '/owner-portal': () => import('./owner-portal/OwnerPortalPage'),
  '/notifications': () => import('./notifications/NotificationsPage'),
  '/promotions': () => import('./promotions/ChannelPromotionsPage'),
  '/mes-tarifs-travaux': () => import('./tarification/TechnicianTravaux'),
  '/permissions-test': () => import('../components/PermissionConfig'),
  '/admin/monitoring': () => import('./admin/MonitoringPage'),
  '/admin/sync': () => import('./admin/SyncAdminPage'),
  '/admin/kpi': () => import('./admin/KpiReadinessPage'),
  '/admin/exchange-rates': () => import('./admin/ExchangeRateHistoryPage'),
  '/admin/database': () => import('./admin/DatabaseAdminPage'),
  '/admin/promo-codes': () => import('./admin/PromoCodesPage'),
};

// Destinations les plus fréquentes, préchargées à l'idle après le boot
// authentifié (le Planning est la route d'atterrissage par défaut).
const HOT_ROUTES = ['/planning', '/dashboard', '/properties'];

const prefetched = new Set<string>();

function resolveImport(path: string): { key: string; load: () => Promise<unknown> } | null {
  const pathname = path.split('?')[0].split('#')[0];
  // Match exact d'abord, puis par préfixe le plus long (sous-routes détail).
  if (ROUTE_IMPORTS[pathname]) {
    return { key: pathname, load: ROUTE_IMPORTS[pathname] };
  }
  const prefix = Object.keys(ROUTE_IMPORTS)
    .filter((p) => pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? { key: prefix, load: ROUTE_IMPORTS[prefix] } : null;
}

/**
 * Précharge le chunk de la route ciblée (no-op si déjà fait ou route inconnue).
 * Les échecs sont avalés : un prefetch raté (offline, déploiement en cours)
 * ne doit jamais casser l'UI — la navigation réelle retentera l'import.
 */
export function prefetchRoute(path: string): void {
  const target = resolveImport(path);
  if (!target || prefetched.has(target.key)) return;
  prefetched.add(target.key);
  target.load().catch(() => {
    prefetched.delete(target.key);
  });
}

/** Précharge les routes chaudes pendant l'idle du navigateur (boot authentifié). */
export function warmHotRoutes(): void {
  const warm = () => HOT_ROUTES.forEach(prefetchRoute);
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(warm, { timeout: 5_000 });
  } else {
    window.setTimeout(warm, 2_000);
  }
}
