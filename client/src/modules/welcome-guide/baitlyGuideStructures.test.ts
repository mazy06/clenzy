import { describe, expect, it } from 'vitest';
import { parseSections, serializeSections } from '../../services/api/welcomeGuideApi';
import { BAITLY_GUIDE_STRUCTURES, buildBaitlyGuideDraft, buildBaitlyPropertyGuideDraft } from './baitlyGuideStructures';
import { normalizeTheme } from './welcomeBookThemes';
import { GUIDE_ICON_OPTIONS } from './guideIcons';

describe('Baitly guide structure drafts', () => {
  it('uses the property values in the shared preview and creation draft', () => {
    const draft = buildBaitlyPropertyGuideDraft('fr', 'essentiel', {
      description: 'Une maison avec terrasse.',
      practical: { houseRules: 'Respectez le calme du voisinage.', additionalNotes: 'La terrasse est accessible par le salon.' },
    });
    expect(draft.welcomeMessage).toBe('Une maison avec terrasse.');
    expect(draft.sections[0].body).toBe('La terrasse est accessible par le salon.');
    expect(draft.sections[1].body).toBe('Respectez le calme du voisinage.');
    expect(draft.activities).toEqual([]);
    expect(draft.pois).toEqual([]);
  });

  it('retains configured property content and signature instead of replacing them with samples', () => {
    const sourceGuide = {
      welcomeMessage: 'Bienvenue à la Villa Atlas.', hostNames: 'Amina', logoUrl: '/logo.svg',
      sections: JSON.stringify([{ id: 'custom', icon: 'info', title: 'Infos de la villa', layout: 'text', body: 'Votre terrasse privée.', items: [] }]),
      pois: '[]', curatedActivities: '[]',
    };
    const draft = buildBaitlyPropertyGuideDraft('fr', 'essentiel', { sourceGuide });
    expect(draft.sections[0].title).toBe('Infos de la villa');
    expect(draft.welcomeMessage).toBe('Bienvenue à la Villa Atlas.');
    expect(draft.hostNames).toBe('Amina');
    expect(draft.logoUrl).toBe('/logo.svg');
    const blank = buildBaitlyPropertyGuideDraft('fr', 'essentiel', { sourceGuide }, true);
    expect(blank.welcomeMessage).toBe('');
    expect(blank.sections).toEqual([]);
    expect(blank.hostNames).toBeNull();
  });
  it('uses registered icons for every section and item', () => {
    for (const { id } of BAITLY_GUIDE_STRUCTURES) {
      for (const section of buildBaitlyGuideDraft('fr', id).sections) {
        expect(GUIDE_ICON_OPTIONS).toContain(section.icon);
        for (const item of section.items) expect(GUIDE_ICON_OPTIONS).toContain(item.icon);
      }
    }
  });
  it('creates five distinct section plans that survive API serialization', () => {
    const plans = BAITLY_GUIDE_STRUCTURES.map(({ id, recommendedTheme }) => {
      const draft = buildBaitlyGuideDraft('fr', id);
      expect(parseSections(serializeSections(draft.sections))).toEqual(draft.sections);
      expect(normalizeTheme(recommendedTheme)).toBe(recommendedTheme);
      return draft.sections.map((section) => section.title).join('|');
    });
    expect(new Set(plans).size).toBe(5);
  });

  it('keeps essentials focused and enables discovery only where requested', () => {
    const essential = buildBaitlyGuideDraft('fr', 'essentiel');
    expect(essential.sections.map((section) => section.title)).toEqual(['Bon à savoir', 'Règlement intérieur']);
    expect(essential.pois).toEqual([]);
    expect(essential.activities).toEqual([]);
    expect(essential.upsellsEnabled).toBe(false);
    const city = buildBaitlyGuideDraft('fr', 'cityguide');
    expect(city.sections[0].title).toBe('Transports');
    expect(city.pois.length).toBeGreaterThan(0);
    expect(city.activitiesEnabled).toBe(true);
    expect(city.upsellsEnabled).toBe(false);
  });

  it('gives longer stays and concierge stays their own content and options', () => {
    const longer = buildBaitlyGuideDraft('fr', 'longue');
    const concierge = buildBaitlyGuideDraft('fr', 'conciergerie');
    expect(longer.sections[0].title).toBe('Votre quotidien');
    expect(longer.activitiesEnabled).toBe(false);
    expect(concierge.sections[0].title).toBe('Votre conciergerie');
    expect(concierge.upsellsEnabled).toBe(true);
    expect(concierge.sections[0].items.every((item) => item.detail === '')).toBe(true);
  });

  it.each(['fr', 'en', 'ar'])('creates a genuinely blank guide in %s', (lang) => {
    const draft = buildBaitlyGuideDraft(lang, 'complet', true);
    expect(draft).toEqual({ welcomeMessage: '', sections: [], pois: [], activities: [],
      activitiesEnabled: false, upsellsEnabled: false, guestbookEnabled: false });
  });

  it('localises the additional sections and isolates edits between drafts', () => {
    const first = buildBaitlyGuideDraft('en', 'longue');
    expect(first.sections[0].title).toBe('Everyday living');
    expect(buildBaitlyGuideDraft('ar', 'conciergerie').sections[0].title).toBe('خدمة الكونسيرج');
    first.sections[0].items[0].label = 'Edited';
    expect(buildBaitlyGuideDraft('en', 'longue').sections[0].items[0].label).toBe('Looking after the home');
  });
});
