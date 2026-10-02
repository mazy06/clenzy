import type { BaitlyNavPreviewKind } from '../components/BaitlyNavPreview';

/** Les modules et outils se reconnaissent par leur fonction, pas par une photo d'ambiance. */
export const BAITLY_NAV_PREVIEWS: Readonly<
  Partial<Record<string, BaitlyNavPreviewKind>>
> = {
  'pms-channel-manager': 'sync',
  'livret-accueil': 'guide',
  'agents-ia': 'agents',
  'revenue-market-data': 'revenue',
  'paiements-finances': 'finance',
  'operations-menage': 'operations',
  'objets-connectes': 'devices',
  'portail-proprietaire': 'owners',
  barometre: 'market',
  calculateur: 'calculator',
  obligations: 'obligations',
  academie: 'academy',
  blog: 'editorial',
  glossaire: 'glossary',
  conciergeries: 'concierge',
  'hotes-independants': 'host',
  'riads-maisons-dhotes': 'riad',
  'arabie-saoudite': 'saudi',
  maroc: 'morocco',
  france: 'france',
  'multi-proprietaires': 'multi-owner',
};
