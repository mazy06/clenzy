import { describe, it, expect } from 'vitest';
import { resolveTabHeader, type TabHeaderMeta } from '../PageHeaderActionsContext';

describe('resolveTabHeader', () => {
  const META: Record<string, TabHeaderMeta> = {
    'Général': { subtitle: 'Subtitle for general' },
    'Notifications': { subtitle: 'Subtitle for notifications' },
    'Commodités OTA': { subtitle: 'Mappez les équipements OTA' },
  };
  const TABS = ['Général', 'Notifications', 'Commodités OTA'];

  // ─── Title (breadcrumb) ─────────────────────────────────────────────────────

  it('returns root title alone when active tab is index 0 (root)', () => {
    const result = resolveTabHeader('Paramètres', 'Default subtitle', TABS, 0, META);
    expect(result.title).toBe('Paramètres');
  });

  it('returns "Root › Tab" when active tab > 0', () => {
    const result = resolveTabHeader('Paramètres', 'Default subtitle', TABS, 1, META);
    expect(result.title).toBe('Paramètres › Notifications');
  });

  it('handles the last tab correctly', () => {
    const result = resolveTabHeader('Paramètres', 'Default subtitle', TABS, 2, META);
    expect(result.title).toBe('Paramètres › Commodités OTA');
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

  it('preserves the typographic chevron › (not ASCII >) in title', () => {
    const result = resolveTabHeader('Paramètres', 'Default', TABS, 1, META);
    expect(result.title).toContain(' › ');
    expect(result.title).not.toContain(' > ');
  });
});
