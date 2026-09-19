// @vitest-environment jsdom
import React from 'react';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import i18n from '../../i18n/config';
import MiniDateRangePicker from '../MiniDateRangePicker';
import { formatWeekdayShort } from '../../utils/localeDate';

/**
 * Le mini selecteur de plage, temoin de la famille des selecteurs partages :
 * sa grille partait du LUNDI en dur, y compris en arabe, ou la semaine ouvree
 * va du dimanche au jeudi.
 */

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

/** Octobre 2024 : le 1er tombe un mardi. */
function mount() {
  return render(
    <MiniDateRangePicker
      startDate="2024-10-01"
      endDate="2024-10-05"
      onChangeStart={() => {}}
      onChangeEnd={() => {}}
    />,
  );
}

/** Les sept initiales de colonnes, dans l'ordre du rendu. */
function headerLabels(container: HTMLElement): string[] {
  const rows = container.querySelectorAll('.grid');
  return Array.from(rows[0]?.querySelectorAll('span') ?? []).map((el) => el.textContent ?? '');
}

afterAll(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

describe('Semaine du mini selecteur de plage', () => {
  it('ouvre la semaine au lundi en francais — un seul jour de debordement', async () => {
    await i18n.changeLanguage('fr');
    const { container } = mount();

    expect(headerLabels(container)[0]).toBe('L');
    // Mardi 1er octobre : seul lundi 30 septembre precede dans la grille.
    const firstCell = container.querySelectorAll('.grid')[1]?.firstElementChild;
    expect(firstCell?.textContent).toContain('30');
    cleanup();
  });

  it('ouvre la semaine au dimanche en arabe', async () => {
    await i18n.changeLanguage('ar');
    const { container } = mount();

    expect(headerLabels(container)[0]).toBe(formatWeekdayShort(at(2024, 10, 20), 'ar'));
    // Deux jours precedent alors le mardi 1er : dimanche 29 et lundi 30.
    const cells = container.querySelectorAll('.grid')[1]?.children ?? [];
    expect(cells[0]?.textContent).toContain('29');
    expect(cells[1]?.textContent).toContain('30');
    cleanup();
  });
});
