import { parseActivities, parsePois, parseSections, type GuideSection, type PublicGuidePractical, type WelcomeGuide } from '../../services/api/welcomeGuideApi';
import { buildTemplateActivities, buildTemplatePois, buildTemplateSections, templateWelcomeMessage } from './guideTemplate';
import type { WelcomeBookThemeId } from './welcomeBookThemes';

export type BaitlyGuideStructureId = 'essentiel' | 'complet' | 'cityguide' | 'longue' | 'conciergerie';

/** Content presets use the existing persisted sections and feature flags, including on the guest page. */
export const BAITLY_GUIDE_STRUCTURES: {
  id: BaitlyGuideStructureId;
  recommendedTheme: WelcomeBookThemeId;
  sectionOrder: number[];
  neighbourhood: boolean;
  activities: boolean;
  services: boolean;
}[] = [
  { id: 'essentiel', recommendedTheme: 'atelier', sectionOrder: [3, 1], neighbourhood: false, activities: false, services: false },
  { id: 'complet', recommendedTheme: 'jardin', sectionOrder: [0, 1, 2, 3], neighbourhood: true, activities: true, services: true },
  { id: 'cityguide', recommendedTheme: 'azur', sectionOrder: [2, 3, 1], neighbourhood: true, activities: true, services: false },
  { id: 'longue', recommendedTheme: 'brume', sectionOrder: [0, 3, 1], neighbourhood: true, activities: false, services: false },
  { id: 'conciergerie', recommendedTheme: 'noir', sectionOrder: [0, 1, 3], neighbourhood: true, activities: true, services: true },
];

const EXTENDED_SECTIONS = {
  fr: {
    longue: ['Votre quotidien', 'Les repères pour un séjour prolongé', 'Entretien du logement', 'Collecte des déchets', 'Linge et ménage', 'Contacter votre hôte'],
    conciergerie: ['Votre conciergerie', 'Un interlocuteur pour votre séjour', 'Contacter la conciergerie', 'Organiser votre arrivée', 'Demander un service', 'Préparer votre départ'],
  },
  en: {
    longue: ['Everyday living', 'Your guide to a longer stay', 'Looking after the home', 'Waste collection', 'Linen and housekeeping', 'Contact your host'],
    conciergerie: ['Your concierge', 'A point of contact for your stay', 'Contact the concierge', 'Plan your arrival', 'Request a service', 'Prepare your departure'],
  },
  ar: {
    longue: ['حياتك اليومية', 'معلومات لإقامة طويلة', 'العناية بالمسكن', 'جمع النفايات', 'البياضات والتنظيف', 'التواصل مع المضيف'],
    conciergerie: ['خدمة الكونسيرج', 'جهة اتصال طوال إقامتك', 'التواصل مع الكونسيرج', 'تنظيم الوصول', 'طلب خدمة', 'الاستعداد للمغادرة'],
  },
};

export function buildBaitlyGuideDraft(lang: string, structureId: BaitlyGuideStructureId = 'complet', blank = false) {
  const structure = BAITLY_GUIDE_STRUCTURES.find((item) => item.id === structureId) ?? BAITLY_GUIDE_STRUCTURES[1];
  const allSections = buildTemplateSections(lang);
  const sections = blank ? [] : structure.sectionOrder.map((index) => allSections[index]);
  if (!blank && (structureId === 'longue' || structureId === 'conciergerie')) {
    const copy = EXTENDED_SECTIONS[lang as keyof typeof EXTENDED_SECTIONS] ?? EXTENDED_SECTIONS.fr;
    const [title, subtitle, ...labels] = copy[structureId];
    const section: GuideSection = {
      id: `baitly-${structureId}-${Date.now()}`, title, subtitle,
      icon: structureId === 'longue' ? 'clock' : 'concierge-bell', layout: 'list', body: '',
      items: labels.map((label, index) => ({
        id: `baitly-${structureId}-item-${index}`,
        icon: (structureId === 'longue'
          ? ['sofa', 'trash-2', 'bed', 'phone']
          : ['phone', 'key-round', 'concierge-bell', 'door-open'])[index],
        label, detail: '', steps: [],
      })),
    };
    sections.unshift(section);
  }
  return {
    welcomeMessage: blank ? '' : templateWelcomeMessage(lang),
    sections,
    pois: !blank && structure.neighbourhood ? buildTemplatePois(lang) : [],
    activities: !blank && structure.activities ? buildTemplateActivities(lang) : [],
    activitiesEnabled: !blank && structure.activities,
    upsellsEnabled: !blank && structure.services,
    guestbookEnabled: !blank && structureId !== 'essentiel',
  };
}

/** Shared by the studio and creation: the editor starts with exactly the content that was previewed. */
export function buildBaitlyPropertyGuideDraft(lang: string, structureId: BaitlyGuideStructureId, data: {
  description?: string;
  sourceGuide?: Pick<WelcomeGuide, 'sections' | 'pois' | 'curatedActivities' | 'welcomeMessage' | 'hostNames' | 'logoUrl'>;
  practical?: Pick<PublicGuidePractical, 'houseRules' | 'additionalNotes'> | null;
}, blank = false) {
  const draft = buildBaitlyGuideDraft(lang, structureId, blank);
  if (blank) return { ...draft, hostNames: null, logoUrl: null };
  const existingSections = parseSections(data.sourceGuide?.sections);
  const structure = BAITLY_GUIDE_STRUCTURES.find((item) => item.id === structureId)!;
  return {
    ...draft,
    welcomeMessage: data.sourceGuide?.welcomeMessage || data.description || draft.welcomeMessage,
    sections: draft.sections.map((section) => {
      const existing = existingSections.find((item) => item.icon === section.icon);
      if (existing) return existing;
      const body = section.icon === 'info' ? data.practical?.additionalNotes
        : section.icon === 'scroll-text' ? data.practical?.houseRules : null;
      return body ? { ...section, layout: 'text' as const, body, items: [] } : section;
    }),
    pois: structure.neighbourhood ? parsePois(data.sourceGuide?.pois) : [],
    activities: draft.activitiesEnabled ? parseActivities(data.sourceGuide?.curatedActivities) : [],
    hostNames: data.sourceGuide?.hostNames ?? null,
    logoUrl: data.sourceGuide?.logoUrl ?? null,
  };
}
