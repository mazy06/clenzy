/** Présentations Baitly : les clés d'onglet restent celles du registre de navigation. */
export const FIRST_USE_MODULES = {
  reservations: { path: '/reservations', title: 'reservations.title', screens: ['reservations'] },
  interventions: { path: '/interventions', title: 'workOrders.title', screens: ['calendar', 'service-requests', 'interventions', 'issues'] },
  quotes: { path: '/devis', title: 'marketplaceQuotes.sentTitle', screens: ['quotes'] },
  messaging: { path: '/contact', title: 'messagingHub.title', screens: ['messaging'] },
  contracts: { path: '/contracts', title: 'contracts.title', screens: ['contracts'] },
  billing: { path: '/billing', title: 'tabHeaders.billing.title', screens: ['payments', 'invoices', 'wallets', 'payouts', 'expenses', 'housekeeper-payouts', 'reports'] },
  reports: { path: '/reports', title: 'tabHeaders.reports.title', screens: ['overview', 'revenue', 'occupancy', 'pricing', 'pace', 'properties', 'interventions', 'teams', 'custom'] },
} as const;

export type FirstUseModule = keyof typeof FIRST_USE_MODULES;
export type DemoKind = 'reservation' | 'calendar' | 'tasks' | 'quote' | 'messages' | 'contract' | 'ledger' | 'document' | 'chart' | 'occupancy';

export function demoKind(module: FirstUseModule, screen: string): DemoKind {
  if (module === 'reservations') return 'reservation';
  if (module === 'interventions') return screen === 'calendar' ? 'calendar' : 'tasks';
  if (module === 'quotes') return 'quote';
  if (module === 'messaging') return 'messages';
  if (module === 'contracts') return 'contract';
  if (module === 'billing') return screen === 'invoices' || screen === 'reports' ? 'document' : 'ledger';
  if (screen === 'occupancy') return 'occupancy';
  if (screen === 'custom') return 'document';
  return 'chart';
}
