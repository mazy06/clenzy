import { STAGE_IMAGES as I } from '../baitly/stageImages';

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

/**
 * Les trois illustrations du rail, une par étape — des natures mortes déjà
 * livrées avec l'application (voir `baitly/stageImages`). Clé : `module.écran`.
 */
export const FIRST_USE_IMAGES: Record<string, readonly [string, string, string]> = {
  'reservations.reservations': [I.bookings, I.welcomeGuide, I.departures],
  'interventions.calendar': [I.calendar, I.cleaning, I.assignment],
  'interventions.service-requests': [I.inbox, I.workReview, I.assignment],
  'interventions.interventions': [I.assignment, I.cleaning, I.workReview],
  'interventions.issues': [I.propertyMaintenance, I.maintenance, I.workReview],
  'quotes.quotes': [I.quotes, I.approval, I.taskAssigned],
  'messaging.messaging': [I.conversation, I.inbox, I.translation],
  'contracts.contracts': [I.mandate, I.travelerForm, I.ownerReport],
  'billing.payments': [I.pending, I.received, I.refund],
  'billing.invoices': [I.documents, I.ownerReport, I.received],
  'billing.wallets': [I.revenue, I.transfer, I.pending],
  'billing.payouts': [I.ownerTransfer, I.pending, I.received],
  'billing.expenses': [I.servicePayment, I.documents, I.ownerReport],
  'billing.housekeeper-payouts': [I.workReview, I.serviceTransfer, I.received],
  'billing.reports': [I.touristTax, I.documents, I.ownerReport],
  'reports.overview': [I.timeSaved, I.pricingUp, I.workReview],
  'reports.revenue': [I.revenue, I.distribution, I.servicePayment],
  'reports.occupancy': [I.occupancy, I.bookings, I.channelSync],
  'reports.pricing': [I.adr, I.revpan, I.pricingSeasons],
  'reports.pace': [I.bookings, I.calendar, I.pricingUp],
  'reports.properties': [I.revpan, I.capacity, I.surface],
  'reports.interventions': [I.cleanings, I.taskOverdue, I.taskAssigned],
  'reports.teams': [I.team, I.taskAssigned, I.taskOverdue],
  'reports.custom': [I.ownerReport, I.documents, I.inbox],
};
