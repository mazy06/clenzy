import React from 'react';
import {
  AccountBalance,
  AccountBalanceWallet,
  AccountTree,
  Assessment,
  Assignment,
  BugReport,
  Build,
  Business,
  Cable,
  CalendarMonth,
  Category,
  ChatBubbleOutline,
  CleaningServices,
  CompareArrows,
  CorporateFare,
  Description,
  Devices,
  Forum,
  GppGood,
  History,
  Home,
  Inventory2,
  LocalLaundryService,
  LocalOffer,
  ManageAccounts,
  Outbox,
  Payment,
  Payments,
  People,
  PersonSearch,
  Public,
  Receipt,
  ReportProblem,
  Sync,
  Timer,
  TrendingUp,
  ViewList,
  VolumeUp,
  Yard,
} from '../icons';
import { MANAGER_ROLES, OPERATIONAL_ROLES } from '../constants/roles';

/**
 * Registre des ONGLETS d'écran — le niveau 2 de la navigation.
 *
 * <p>{@code navigationHubs.ts} décrit le niveau 1 (un hub → ses écrans, une
 * route par écran). Ce fichier-ci décrit ce qui vit DANS un écran : ses onglets,
 * adressables par l'URL sous {@code ?tab=<clé>} (cf.
 * {@code components/tabKeyParam.ts}).</p>
 *
 * <p><b>Pourquoi un registre, alors que chaque page connaît déjà ses
 * onglets ?</b> Parce que la barre latérale doit montrer les onglets d'un écran
 * que l'on n'a pas ouvert — son troisième tiroir déplie les onglets de l'écran
 * survolé. Les pages sont chargées en {@code lazy} : leurs listes d'onglets
 * n'existent qu'une fois la route montée, donc jamais au moment où la barre en a
 * besoin. Le registre est la seule liste lisible depuis les deux côtés.</p>
 *
 * <p><b>Il est la source UNIQUE.</b> Les pages ne redéclarent pas leurs onglets :
 * elles les lisent ici via {@code useScreenTabs(path)} et n'y ajoutent que ce qui
 * ne peut venir que d'elles (une pastille de compteur, un onglet désactivé le
 * temps d'un chargement). Une liste tenue en double aurait dérivé au premier
 * onglet ajouté d'un seul côté, et la barre aurait promis un onglet inexistant.</p>
 *
 * <p><b>L'ordre est celui de l'affichage</b>, et le premier onglet VISIBLE est
 * l'onglet d'entrée de l'écran — celui qu'on obtient sans {@code ?tab=}. C'est
 * vrai des deux côtés : {@code useTabKeyParam} replie sur l'index 0 des onglets
 * visibles, et la barre marque ce même premier onglet comme courant quand l'URL
 * ne porte pas de paramètre.</p>
 */

/** Ce qu'il faut savoir de l'utilisateur pour filtrer les onglets. */
export interface ScreenTabAccess {
  /** `user.permissions` — claims agrégées du JWT. */
  permissions: string[];
  /** `user.roles` — rôles plateforme ET métier, tels que les lit `hasAnyRole`. */
  roles: string[];
  /**
   * `user.platformRole` — champ DISTINCT de `roles`, seul consulté par
   * l'écran « Réservation & accueil » pour réserver son onglet Booking Engine.
   * Le reprendre tel quel évite de déplacer une frontière d'accès au passage.
   */
  platformRole?: string;
}

export interface ScreenTabDef {
  /** Clé stable — valeur de `?tab=`. Ne JAMAIS la renommer : elle vit dans les URLs. */
  key: string;
  translationKey: string;
  fallbackLabel: string;
  icon?: React.ReactNode;
  /** Visible pour cet utilisateur ? Absent = toujours visible. */
  isAccessible?: (access: ScreenTabAccess) => boolean;
}

const has = (a: ScreenTabAccess, permission: string) => a.permissions.includes(permission);
const hasRole = (a: ScreenTabAccess, ...roles: readonly string[]) =>
  roles.some((role) => a.roles.includes(role));

/** Staff plateforme au sens de `platformRole` (cf. `ScreenTabAccess.platformRole`). */
const isPlatformStaff = (a: ScreenTabAccess) =>
  a.platformRole === 'SUPER_ADMIN' || a.platformRole === 'SUPER_MANAGER';

// ── Interventions ────────────────────────────────────────────────────────────
// Les trois prédicats de l'écran, écrits une fois : « Demandes » ouvre
// « Interventions », et « Anomalies » suppose les deux périmètres à la fois.
const canViewServiceRequests = (a: ScreenTabAccess) =>
  has(a, 'service-requests:view') || hasRole(a, ...OPERATIONAL_ROLES);
const canViewInterventions = (a: ScreenTabAccess) =>
  has(a, 'interventions:view') || canViewServiceRequests(a);
const canViewIssues = (a: ScreenTabAccess) =>
  hasRole(a, ...MANAGER_ROLES) && canViewServiceRequests(a) && canViewInterventions(a);

/**
 * Onglets par route d'écran. La clé est la route CANONIQUE de l'écran, celle que
 * porte la barre latérale (`navigationHubs.ts`) — pas une de ses redirections.
 *
 * <p>Un écran absent d'ici n'a pas d'onglets, ou n'est pas une destination de la
 * barre : il n'ouvre alors aucun tiroir.</p>
 */
export const SCREEN_TABS: Record<string, ScreenTabDef[]> = {
  '/properties': [
    { key: 'properties', translationKey: 'propertiesPage.tabs.properties', fallbackLabel: 'Propriétés', icon: <Home /> },
    { key: 'pricing', translationKey: 'propertiesPage.tabs.pricing', fallbackLabel: 'Prix dynamique', icon: <TrendingUp /> },
    { key: 'vouchers', translationKey: 'propertiesPage.tabs.vouchers', fallbackLabel: 'Codes promo', icon: <LocalOffer /> },
    { key: 'connected-objects', translationKey: 'propertiesPage.tabs.connectedObjects', fallbackLabel: 'Objets connectés', icon: <Inventory2 /> },
  ],

  // Le calendrier est en tête : c'est la vue d'entrée de l'écran (URL sans `?tab=`).
  '/interventions': [
    { key: 'calendar', translationKey: 'workOrders.tabs.calendar', fallbackLabel: 'Calendrier', icon: <CalendarMonth />, isAccessible: canViewInterventions },
    { key: 'service-requests', translationKey: 'workOrders.tabs.serviceRequests', fallbackLabel: 'Demandes de service', icon: <Assignment />, isAccessible: canViewServiceRequests },
    { key: 'interventions', translationKey: 'workOrders.tabs.interventions', fallbackLabel: 'Interventions', icon: <Build />, isAccessible: canViewInterventions },
    { key: 'issues', translationKey: 'workOrders.tabs.issues', fallbackLabel: 'Anomalies', icon: <ReportProblem />, isAccessible: canViewIssues },
  ],

  '/directory': [
    { key: 'users', translationKey: 'directoryPage.tabs.users', fallbackLabel: 'Utilisateurs', icon: <ManageAccounts />, isAccessible: (a) => has(a, 'users:manage') },
    { key: 'teams', translationKey: 'directoryPage.tabs.teams', fallbackLabel: 'Équipes', icon: <People />, isAccessible: (a) => has(a, 'teams:view') },
    { key: 'portfolios', translationKey: 'directoryPage.tabs.portfolios', fallbackLabel: 'Portefeuilles', icon: <Business />, isAccessible: (a) => has(a, 'portfolios:view') },
    { key: 'organizations', translationKey: 'directoryPage.tabs.organizations', fallbackLabel: 'Organisations', icon: <CorporateFare />, isAccessible: (a) => has(a, 'users:manage') },
    { key: 'guests', translationKey: 'directoryPage.tabs.guests', fallbackLabel: 'Voyageurs', icon: <PersonSearch />, isAccessible: (a) => has(a, 'guests:view') },
    { key: 'prospection', translationKey: 'directoryPage.tabs.prospection', fallbackLabel: 'Prospection', icon: <TrendingUp />, isAccessible: (a) => has(a, 'teams:view') && hasRole(a, 'SUPER_ADMIN', 'SUPER_MANAGER') },
  ],

  '/documents': [
    { key: 'catalog', translationKey: 'documents.tabs.catalog', fallbackLabel: 'Catalogue', icon: <ViewList /> },
    { key: 'message-templates', translationKey: 'documents.tabs.messageTemplates', fallbackLabel: 'Templates messages', icon: <ChatBubbleOutline /> },
    { key: 'whatsapp-templates', translationKey: 'documents.tabs.whatsappTemplates', fallbackLabel: 'Templates WhatsApp', icon: <Forum /> },
    { key: 'document-templates', translationKey: 'documents.tabs.documentTemplates', fallbackLabel: 'Templates documents', icon: <Description /> },
    { key: 'history', translationKey: 'documents.tabs.history', fallbackLabel: 'Historique', icon: <History /> },
    { key: 'variables', translationKey: 'documents.tabs.variablesAndTags', fallbackLabel: 'Variables & Tags', icon: <LocalOffer /> },
    { key: 'compliance', translationKey: 'documents.tabs.compliance', fallbackLabel: 'Conformité', icon: <GppGood /> },
    { key: 'amendments', translationKey: 'amendmentLibrary.title', fallbackLabel: 'Avenants', icon: <Description /> },
  ],

  '/billing': [
    { key: 'payments', translationKey: 'billing.tabs.payments', fallbackLabel: 'Paiements', icon: <Payment /> },
    { key: 'invoices', translationKey: 'billing.tabs.invoices', fallbackLabel: 'Factures', icon: <Receipt />, isAccessible: (a) => has(a, 'reports:view') },
    { key: 'wallets', translationKey: 'navigation.wallets', fallbackLabel: 'Portefeuille', icon: <AccountBalanceWallet />, isAccessible: (a) => has(a, 'payments:manage') },
    { key: 'payouts', translationKey: 'billing.tabs.payouts', fallbackLabel: 'Reversements', icon: <AccountBalance />, isAccessible: (a) => hasRole(a, 'SUPER_ADMIN', 'SUPER_MANAGER') },
    { key: 'expenses', translationKey: 'billing.tabs.expenses', fallbackLabel: 'Dépenses', icon: <Category />, isAccessible: (a) => hasRole(a, 'SUPER_ADMIN', 'SUPER_MANAGER') },
    { key: 'housekeeper-payouts', translationKey: 'billing.tabs.housekeeperPayouts', fallbackLabel: 'Versements prestataires', icon: <Payments />, isAccessible: (a) => hasRole(a, 'SUPER_ADMIN', 'SUPER_MANAGER') },
    { key: 'reports', translationKey: 'billing.tabs.reportsExports', fallbackLabel: 'Rapports & Exports', icon: <Assessment />, isAccessible: (a) => hasRole(a, 'SUPER_ADMIN', 'SUPER_MANAGER') },
  ],

  '/tarification': [
    { key: 'pms', translationKey: 'tarification.tabs.pms', fallbackLabel: 'Abonnement PMS', icon: <Devices /> },
    { key: 'entretien', translationKey: 'tarification.tabs.entretien', fallbackLabel: 'Entretien', icon: <CleaningServices /> },
    { key: 'menage', translationKey: 'tarification.tabs.menage', fallbackLabel: 'Ménage', icon: <Timer /> },
    { key: 'travaux', translationKey: 'tarification.tabs.travaux', fallbackLabel: 'Travaux', icon: <Build /> },
    { key: 'exterieur', translationKey: 'tarification.tabs.exterieur', fallbackLabel: 'Extérieur', icon: <Yard /> },
    { key: 'blanchisserie', translationKey: 'tarification.tabs.blanchisserie', fallbackLabel: 'Blanchisserie', icon: <LocalLaundryService /> },
    { key: 'monitoring', translationKey: 'tarification.tabs.monitoring', fallbackLabel: 'Monitoring', icon: <VolumeUp /> },
  ],

  // Booking Engine en tête : c'est la vue d'entrée du staff plateforme. Masqué
  // pour un HOST, le premier onglet visible devient le livret d'accueil — son
  // entrée à lui. Rien à arbitrer en plus : l'ordre porte les deux défauts.
  '/booking-engine': [
    { key: 'booking-engine', translationKey: 'guestExperience.tabs.bookingEngine', fallbackLabel: 'Booking Engine', icon: <Public />, isAccessible: isPlatformStaff },
    { key: 'welcome-guide', translationKey: 'guestExperience.tabs.welcomeGuide', fallbackLabel: "Livret d'accueil", icon: <Description /> },
    { key: 'upsells', translationKey: 'guestExperience.tabs.upsells', fallbackLabel: 'Services payants', icon: <LocalOffer /> },
  ],

  '/admin/sync': [
    { key: 'connections', translationKey: 'tabHeaders.syncAdmin.tabs.connections', fallbackLabel: 'Connexions', icon: <Cable /> },
    { key: 'sync-events', translationKey: 'tabHeaders.syncAdmin.tabs.syncEvents', fallbackLabel: 'Sync Events', icon: <Sync /> },
    { key: 'outbox', translationKey: 'tabHeaders.syncAdmin.tabs.outbox', fallbackLabel: 'Outbox', icon: <Outbox /> },
    { key: 'calendar', translationKey: 'tabHeaders.syncAdmin.tabs.calendar', fallbackLabel: 'Calendrier', icon: <CalendarMonth /> },
    { key: 'mappings', translationKey: 'tabHeaders.syncAdmin.tabs.mappings', fallbackLabel: 'Mappings', icon: <AccountTree /> },
    { key: 'diagnostics', translationKey: 'tabHeaders.syncAdmin.tabs.diagnostics', fallbackLabel: 'Diagnostics', icon: <BugReport /> },
    { key: 'reconciliation', translationKey: 'tabHeaders.syncAdmin.tabs.reconciliation', fallbackLabel: 'Réconciliation', icon: <CompareArrows /> },
  ],
};

/** Onglets déclarés pour cette route, ou `[]` si l'écran n'en a pas. */
export function screenTabsFor(path: string): ScreenTabDef[] {
  return SCREEN_TABS[path] ?? [];
}
