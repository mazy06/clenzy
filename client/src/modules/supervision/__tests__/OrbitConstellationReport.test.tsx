// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { renderWithProviders as render, screen, fireEvent, waitFor } from '../../../test/renderWithProviders';
import { AgentConstellation } from '../components/AgentConstellation';
import { OrbitConstellation } from '../renderers/OrbitConstellation';
import { buildPropertySnapshot } from '../provider/mockData';

/**
 * Le bilan sur tablette et téléphone.
 *
 * <p>Il tenait une pastille pleine largeur dans le rail, à égalité avec
 * « À traiter » — une information qu'on consulte de loin en loin au même rang
 * que celle sur laquelle on agit. Il passe dans la barre d'outils, comme un
 * outil parmi les autres (même famille que « Fil »), et le rail ne porte plus
 * que les surfaces actionnables.</p>
 *
 * <p>Sa surface reste le TIROIR, pas une bulle : en étroit l'écran est
 * tactile, et un panneau qui monte du bas se lit et se ferme au pouce.</p>
 */

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getTotalLength?: () => number };
  if (!proto.getTotalLength) proto.getTotalLength = () => 100;
});

const REPORT = { windowDays: 30, autoActions: 38, acceptanceRate: 0.21, estimatedTimeSaved: '≈ 5 h 40' };

const open = () =>
  render(
    <AgentConstellation
      snapshot={buildPropertySnapshot('1')}
      renderer={OrbitConstellation}
      compact
      report={REPORT}
      reportWindow={30}
      onReportWindowChange={() => {}}
    />,
  );

describe('le bilan en étroit', () => {
  it('n’occupe plus une pastille du rail', () => {
    open();

    // Le rail ne garde que ce sur quoi on agit : un seul « Bilan », rangé dans
    // la barre d'outils avec les autres outils, jamais une pastille pleine
    // largeur dans le rail.
    const pills = screen.queryAllByRole('button', { name: 'Bilan' });
    expect(pills).toHaveLength(1);
    expect(pills[0].className).toContain('baitly-constellation-tool');
    expect(pills[0].className).not.toMatch(/\bw-full\b/);
    expect(pills[0].closest('.baitly-constellation-toolbar')).not.toBeNull();
  });

  it('l’icône ouvre le tiroir, qui porte les chiffres', async () => {
    open();

    expect(screen.queryByText('Temps gagné')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bilan' }));

    await waitFor(() => expect(screen.getByText('Temps gagné')).toBeTruthy());
    expect(screen.getByText('≈ 5 h 40')).toBeTruthy();
    expect(screen.getByText('38')).toBeTruthy();
  });

  it('un second appui referme le tiroir', async () => {
    open();
    const icon = screen.getByRole('button', { name: 'Bilan' });

    fireEvent.click(icon);
    await waitFor(() => expect(screen.getByText('Temps gagné')).toBeTruthy());
    expect(icon.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(icon);
    await waitFor(() => expect(screen.queryByText('Temps gagné')).toBeNull());
  });
});
