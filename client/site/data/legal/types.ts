import type { LegalArticleSlug } from './articleImages';

export type LegalCountry = 'MA' | 'FR' | 'SA';
export type LegalTopic =
  'autorisation' | 'voyageurs' | 'fiscalite' | 'exploitation';
export type LegalStage = 'ouvrir' | 'accueillir' | 'suivre';
export interface LegalArticle {
  slug: LegalArticleSlug;
  country: LegalCountry;
  topic: LegalTopic;
  stage: LegalStage;
  title: string;
  description: string;
  scope: string;
  facts: { value: string; label: string }[];
  sections: { title: string; paragraphs: string[]; sources: string[] }[];
  checklist: string[];
  faq: { q: string; a: string }[];
  guide: Record<'en' | 'ar', { title: string; copy: string }>;
}

/** The date records an actual editorial source check, never the build date. */
export const LEGAL_REVIEWED_AT = '2026-10-01';
export const LEGAL_SOURCES: Record<string, { label: string; url: string }> = {
  maLaw: {
    label: 'Maroc · Loi 80-14, articles 29 à 38 et 43 à 48',
    url: 'https://mtaess.gov.ma/wp-content/uploads/2024/09/Loi-n%C2%B080-14-Hebergement-touristique.pdf',
  },
  maPermit: {
    label: 'Maroc · Décret 2-23-441, articles 60 à 67',
    url: 'https://mtaess.gov.ma/wp-content/uploads/2026/02/Decret-2.23.441-Etablissements-touristiques-et-autres-formes-dhebergement-touristique-5.pdf',
  },
  maGuests: {
    label: 'Maroc · Décret 2-15-865, articles 1 à 6 et annexe 1',
    url: 'https://mtaess.gov.ma/wp-content/uploads/2025/06/Decret-n%C2%B02-15-865-teledec.pdf',
  },
  maTax: {
    label: 'Trésorerie générale du Royaume · Loi 47-06, articles 70 à 76',
    url: 'https://www.tgr.gov.ma/wps/wcm/connect/33c059d4-b7db-4904-83ca-762e8efeaa30/dahir+1-07-195+portant+loi+47-06.pdf?MOD=AJPERES',
  },
  frRegistration: {
    label: 'Légifrance · Code du tourisme, article L324-1-1',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050623378',
  },
  frDge: {
    label: 'Direction générale des entreprises · API meublés et enregistrement',
    url: 'https://www.entreprises.gouv.fr/espace-entreprises/s-informer-sur-la-reglementation/lapi-meubles-guichet-unique-de-centralisation',
  },
  frHome: {
    label: 'Service Public · Louer sa résidence principale',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F33175',
  },
  frSecond: {
    label: 'Service Public · Louer sa résidence secondaire',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2043',
  },
  frDpe: {
    label: 'Légifrance · Code de la construction, article L631-10',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050623427',
  },
  frReform: {
    label: 'Légifrance · Loi 2024-1039, articles 3, 8 et 9',
    url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000050612711',
  },
  frMicro: {
    label:
      'Légifrance · Code général des impôts, article 50-0 (1er juillet 2026)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373853',
  },
  frLmp: {
    label: 'Légifrance · Code général des impôts, article 155 IV',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053544949',
  },
  frPolice: {
    label: 'Service Public · Fiche individuelle de police',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F33458',
  },
  frTax: {
    label: 'Service Public Entreprendre · Taxe de séjour',
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F743',
  },
  saPrivate: {
    label:
      'Umm Al-Qura · Règlement des unités de séjour privées, 11 septembre 2026',
    url: 'https://www.uqn.gov.sa/decisions-and-regulations/4001819',
  },
};
