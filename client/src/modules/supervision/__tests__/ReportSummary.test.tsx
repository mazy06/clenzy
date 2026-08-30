// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { renderWithProviders as render, screen, fireEvent, waitFor } from '../../../test/renderWithProviders';
import { SupervisionPanel } from '../components/SupervisionPanel';
import { MockSupervisionProvider } from '../provider/MockSupervisionProvider';

/**
 * Le bilan tenait une rangée pleine SOUS la constellation : quatre boutons de
 * période et trois chiffres, permanents, pour une information qu'on consulte
 * de loin en loin. Il est passé dans l'en-tête, replié derrière une icône.
 *
 * <p>L'affichage large commence à 840 px — une tablette tactile en paysage
 * l'atteint. Une carte qui ne s'ouvrirait qu'au survol y serait morte, sans
 * que rien ne le dise : ces tests couvrent les DEUX pointeurs.</p>
 */

vi.mock('../core/useSupervisionReport', () => ({
  useSupervisionReport: () => ({
    report: { windowDays: 30, autoActions: 38, acceptanceRate: 0.21, estimatedTimeSaved: '≈ 5 h 40' },
  }),
}));

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getTotalLength?: () => number };
  if (!proto.getTotalLength) proto.getTotalLength = () => 100;
});

/** Fait répondre `(hover: hover)` — le défaut de jsdom est « pas de survol ». */
const withPointer = (fine: boolean) => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: fine && query.includes('hover: hover'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })) as unknown as typeof window.matchMedia;
  return () => { window.matchMedia = original; };
};

let restore: (() => void) | null = null;
afterEach(() => { restore?.(); restore = null; });

const open = () => {
  const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
  return render(<SupervisionPanel createProvider={() => provider} deps={['1']} />);
};

const ready = async (container: HTMLElement) =>
  waitFor(() => expect(container.querySelector('[data-agent="com"]')).toBeTruthy());

describe('le bilan replié dans l’en-tête', () => {
  it('ne montre aucun chiffre tant qu’on ne le demande pas', async () => {
    const { container } = open();
    await ready(container);

    expect(screen.getByRole('button', { name: 'Bilan' })).toBeTruthy();
    expect(screen.queryByText('Temps gagné')).toBeNull();
    expect(screen.queryByText('≈ 5 h 40')).toBeNull();
  });

  it('s’ouvre à l’appui — le seul geste dont dispose une tablette', async () => {
    restore = withPointer(false);
    const { container } = open();
    await ready(container);

    fireEvent.click(screen.getByRole('button', { name: 'Bilan' }));

    await waitFor(() => expect(screen.getByText('Temps gagné')).toBeTruthy());
    expect(screen.getByText('≈ 5 h 40')).toBeTruthy();
    expect(screen.getByText('38')).toBeTruthy();
    expect(screen.getByText('21 %')).toBeTruthy();
    // Le sélecteur reste ACTIONNABLE : c'est ce qu'une simple infobulle ne
    // permettait pas — elle se referme dès qu'on va vers ses boutons.
    expect(screen.getByRole('button', { name: 'Mois' })).toBeTruthy();
  });

  it('s’ouvre AUSSI au survol quand l’appareil sait survoler', async () => {
    restore = withPointer(true);
    const { container } = open();
    await ready(container);

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Bilan' }));

    await waitFor(() => expect(screen.getByText('Temps gagné')).toBeTruthy());
  });

  it('ne s’ouvre PAS au survol sur un écran tactile', async () => {
    // Sinon un effleurement de doigt suffirait à la faire surgir, puis à la
    // laisser ouverte : le tactile n'émet pas de « pointerleave ».
    restore = withPointer(false);
    const { container } = open();
    await ready(container);

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Bilan' }));

    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByText('Temps gagné')).toBeNull();
  });
});
