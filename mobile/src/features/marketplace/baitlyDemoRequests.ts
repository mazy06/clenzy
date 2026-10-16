import { baitlyDataMode } from '@/config/baitlyDataMode';
import { allowedQuoteActions } from './domain';
import type { QuoteRequest, QuoteSide, QuoteStatus, QuoteAction } from './api';
import { useBaitlyDemoProfile, isBaitlyProfilePreview } from '@/config/baitlyDemoProfileState';

/** Local fixtures never use IDs belonging to real requests. */
export const baitlyDemoRequests: QuoteRequest[] = [
  { id: -901, providerId: -1, providerName: 'Dar Zellige · Démo', requesterOrganizationName: 'Maison Safran · Démo', title: 'Ménage entre deux séjours', status: 'QUOTED', quotedAmount: 420, quotedCurrency: 'MAD', message: 'Préparer le logement avant l’arrivée des voyageurs.', quoteMessage: 'Ménage complet, linge et contrôle de l’inventaire inclus.', expired: false },
  { id: -902, providerId: -2, providerName: 'Piscines Ourika · Démo', requesterOrganizationName: 'Riad Horizon · Démo', title: 'Entretien de la piscine', status: 'ACCEPTED', quotedAmount: 680, quotedCurrency: 'MAD', message: 'Nettoyage et contrôle de la filtration.', expired: false },
  { id: -903, providerId: -3, providerName: 'Jardins de l’Atlas · Démo', requesterOrganizationName: 'Villa Ourika · Démo', title: 'Remise en état du jardin', status: 'SENT', message: 'Tailler les haies et entretenir les massifs.', expired: false },
  { id: -904, providerId: -4, providerName: 'Riad Services · Démo', requesterOrganizationName: 'Maison Safran · Démo', title: 'Contrôle de la climatisation', status: 'DECLINED', quotedAmount: 950, quotedCurrency: 'MAD', decisionReason: 'Le budget proposé dépasse le montant prévu.', expired: false },
  { id: -905, providerId: -5, providerName: 'Blanchisserie Atlas · Démo', requesterOrganizationName: 'Riad Horizon · Démo', title: 'Collecte du linge de maison', status: 'EXPIRED', quotedAmount: 240, quotedCurrency: 'MAD', expired: true },
  { id: -906, providerId: -4, providerName: 'Riad Services · Démo', requesterOrganizationName: 'Villa Ourika · Démo', title: 'Réparation d’une serrure', status: 'WITHDRAWN', message: 'La réparation a déjà été réalisée.', expired: false },
];
export function demoRequestsPage(side: QuoteSide, status?: QuoteStatus) {
  const key = isBaitlyProfilePreview() ? useBaitlyDemoProfile.getState().key : null;
  const providers = key === 'cleaning' ? [-1] : key === 'maintenance' ? [-4] : key === 'laundry' ? [-5] : key === 'exterior' ? [-2, -3] : undefined;
  const items = baitlyDemoRequests.map(item => demoRequest(item.id)!).filter(item => (!status || item.status === status) && (side !== 'received' || !providers || providers.includes(item.providerId)));
  return { items, page: 0, totalPages: 1, totalElements: items.length };
}

const decisions = new Map<string, QuoteRequest>();
const decisionKey = (id: number) => `${useBaitlyDemoProfile.getState().key ?? 'account'}:${id}`;
export function demoRequest(id: number) { return decisions.get(decisionKey(id)) ?? baitlyDemoRequests.find(item => item.id === id); }
export function decideDemoRequest(id: number, action: QuoteAction, side: QuoteSide): QuoteRequest {
  const item = demoRequest(id);
  if (baitlyDataMode() !== 'demo' || id >= 0 || !item) throw { status: 404 };
  if (!allowedQuoteActions(item, side).includes(action)) throw { status: 409 };
  const status: QuoteStatus = action === 'accept' ? 'ACCEPTED' : action === 'withdraw' ? 'WITHDRAWN' : 'DECLINED';
  const updated = { ...item, status }; decisions.set(decisionKey(id), updated); return updated;
}
