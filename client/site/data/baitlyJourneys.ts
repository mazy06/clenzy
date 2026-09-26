import type { BaitlySolutionPreviewKind } from '../components/BaitlySolutionNavPreview';
import { SITE_PHOTOS } from './baitlyPhotography';

const {
  solutionConcierge: terrace,
  solutionHost: bedroom,
  solutionRiad: riad,
  solutionOwners: pool,
} = SITE_PHOTOS;

export const BAITLY_ACTIVITY_JOURNEYS: ReadonlyArray<{
  id: string;
  kind: BaitlySolutionPreviewKind;
  photo: string;
  photoKey: keyof typeof SITE_PHOTOS;
  modules: readonly string[];
}> = [
  {
    id: 'conciergeries',
    kind: 'concierge',
    photo: terrace,
    photoKey: 'solutionConcierge',
    modules: [
      'pms-channel-manager',
      'operations-menage',
      'portail-proprietaire',
    ],
  },
  {
    id: 'hotes-independants',
    kind: 'host',
    photo: bedroom,
    photoKey: 'solutionHost',
    modules: ['agents-ia', 'livret-accueil', 'booking-engine'],
  },
  {
    id: 'riads-maisons-dhotes',
    kind: 'riad',
    photo: riad,
    photoKey: 'solutionRiad',
    modules: ['booking-engine', 'livret-accueil', 'operations-menage'],
  },
  {
    id: 'multi-proprietaires',
    kind: 'multi-owner',
    photo: pool,
    photoKey: 'solutionOwners',
    modules: [
      'pms-channel-manager',
      'portail-proprietaire',
      'paiements-finances',
    ],
  },
];
export const BAITLY_COUNTRY_JOURNEYS = [
  { id: 'maroc', code: 'MA', currency: 'MAD' },
  { id: 'arabie-saoudite', code: 'SA', currency: 'SAR' },
  { id: 'france', code: 'FR', currency: 'EUR' },
] as const;
