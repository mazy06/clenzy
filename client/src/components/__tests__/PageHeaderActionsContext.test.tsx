import { describe, it, expect } from 'vitest';
import { resolveTabHeader, type TabHeaderMeta } from '../PageHeaderActionsContext';

describe('resolveTabHeader', () => {
  const META: Record<string, TabHeaderMeta> = {
    'Général': { subtitle: 'Subtitle for general' },
    'Notifications': { subtitle: 'Subtitle for notifications' },
    'Commodités OTA': { subtitle: 'Mappez les équipements OTA' },
  };
  const TABS = ['Général', 'Notifications', 'Commodités OTA'];

  // ─── Title ──────────────────────────────────────────────────────────────────
  // Le titre ne porte que le nom de l'ecran : l'onglet actif lui est accole par
  // PageTitle (« Parametres │ Notifications »), a partir de ce que PageTabs
  // publie. Le renvoyer ici l'afficherait deux fois.

  it('returns the root title on the first tab', () => {
    const result = resolveTabHeader('Paramètres', 'Default subtitle', TABS, 0, META);
    expect(result.title).toBe('Paramètres');
  });

  it('keeps the root title on any other tab', () => {
    expect(resolveTabHeader('Paramètres', 'Default subtitle', TABS, 1, META).title)
      .toBe('Paramètres');
    expect(resolveTabHeader('Paramètres', 'Default subtitle', TABS, 2, META).title)
      .toBe('Paramètres');
  });

  // ─── Subtitle ───────────────────────────────────────────────────────────────

  it('returns tab-specific subtitle when meta exists for active tab', () => {
    const result = resolveTabHeader('Paramètres', 'Default subtitle', TABS, 1, META);
    expect(result.subtitle).toBe('Subtitle for notifications');
  });

  it('returns default subtitle when active tab has no meta', () => {
    const tabsWithoutMeta = ['Général', 'UnknownTab'];
    const result = resolveTabHeader('Paramètres', 'Default subtitle', tabsWithoutMeta, 1, META);
    expect(result.subtitle).toBe('Default subtitle');
  });

  it('returns default subtitle when meta object is empty', () => {
    const result = resolveTabHeader('Paramètres', 'Default subtitle', TABS, 0, {});
    expect(result.subtitle).toBe('Default subtitle');
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────────

  it('returns root title and default subtitle when activeIndex is out of bounds', () => {
    const result = resolveTabHeader('Paramètres', 'Default subtitle', TABS, 99, META);
    expect(result.title).toBe('Paramètres');
    expect(result.subtitle).toBe('Default subtitle');
  });

  it('returns root title and default subtitle when tabLabels is empty', () => {
    const result = resolveTabHeader('Paramètres', 'Default subtitle', [], 0, META);
    expect(result.title).toBe('Paramètres');
    expect(result.subtitle).toBe('Default subtitle');
  });

  it('works with negative activeIndex (out of bounds)', () => {
    const result = resolveTabHeader('Paramètres', 'Default subtitle', TABS, -1, META);
    expect(result.title).toBe('Paramètres');
    expect(result.subtitle).toBe('Default subtitle');
  });

  it('never bakes a path separator into the title (PageTitle accole l\'onglet)', () => {
    const result = resolveTabHeader('Paramètres', 'Default', TABS, 1, META);
    expect(result.title).not.toContain('›');
    expect(result.title).not.toContain('│');
    expect(result.title).not.toContain(' > ');
  });
});
