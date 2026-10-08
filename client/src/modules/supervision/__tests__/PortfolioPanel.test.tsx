// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { renderWithProviders as render, screen, waitFor, fireEvent, within } from '../../../test/renderWithProviders';
import { PortfolioPanel } from '../components/PortfolioPanel';
import { MockPortfolioProvider } from '../provider/MockSupervisionProvider';
import { buildPortfolioSnapshot } from '../provider/mockData';
import { usePropertiesList } from '../../../hooks/usePropertiesList';
import { ScreenChromeProvider, useScreenChrome } from '../../../components/ScreenChrome';

vi.mock('../../../hooks/usePropertiesList', () => ({ usePropertiesList: vi.fn() }));
vi.mock('../core/useSupervisionReport', () => ({ useSupervisionReport: () => ({ loading: false, report: null }) }));

beforeEach(() => {
  vi.mocked(usePropertiesList).mockReturnValue({ properties: [], isLoading: false, isError: false, error: null, deleteProperty: vi.fn(), isDeleting: false });
});

function SearchHarness() {
  const chrome = useScreenChrome();
  return <input aria-label="Recherche du header" value={chrome.search?.value ?? ''} onChange={e => chrome.setSearchValue(e.target.value)} />;
}

/**
 * La vue d'ensemble répond à « où dois-je agir ? ».
 *
 * <p>Elle ne déverse plus toutes les cartes du parc côte à côte : à gauche les
 * logements, triés par ce qui presse ; à droite, celui qui est ouvert. Ces
 * tests décrivaient l'écran d'avant cette refonte et échouaient depuis —
 * ils affirmaient trois cartes visibles là où le parc en montre une par
 * logement.</p>
 */

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getTotalLength?: () => number };
  if (!proto.getTotalLength) proto.getTotalLength = () => 100;
});

const open = () => {
  const provider = new MockPortfolioProvider({ latencyMs: 0 });
  return render(<PortfolioPanel createProvider={() => provider} deps={['portfolio']} />);
};

describe('<PortfolioPanel>', () => {
  it('rend la liste des logements et, sous son onglet, le journal', async () => {
    // Deux choses ont changé avec la refonte : la constellation a quitté cet
    // écran — le parc y est un tableau de bord, pas un diagramme — et le
    // journal est passé derrière un onglet. L'ancienne version les cherchait
    // toutes deux au premier rendu.
    const { container } = open();

    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBeGreaterThan(0));
    expect(container.querySelectorAll('[aria-current]').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('radio', { name: 'Activité' }));
    await waitFor(() => expect(container.querySelector('[data-activity-feed]')).toBeTruthy());
  });

  it('n’ouvre qu’un logement à la fois, et montre SES cartes', async () => {
    const { container } = open();

    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBeGreaterThan(0));
    // Le parc a trois décisions sur trois logements distincts. En afficher
    // trois ensemble reviendrait à ne plus savoir laquelle concerne quoi.
    expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });

  it('ouvrir un autre logement change les cartes affichées', async () => {
    const { container } = open();

    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBeGreaterThan(0));
    const first = container.querySelector('[data-pending-action]')!.getAttribute('data-pending-action');

    fireEvent.click(container.querySelector('[aria-current="false"]')!);

    await waitFor(() => {
      const next = container.querySelector('[data-pending-action]')?.getAttribute('data-pending-action');
      expect(next).not.toBe(first);
    });
  });

  it('filtrer par agent ne garde que les logements où il a quelque chose', async () => {
    const { container } = open();

    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBeGreaterThan(0));
    const before = container.querySelectorAll('[aria-current]').length;

    // « Revenue » n'a de décisions que sur deux des trois logements en attente.
    fireEvent.click(screen.getByRole('button', { name: /Revenue/ }));

    await waitFor(() => expect(container.querySelectorAll('[aria-current]').length).toBeLessThan(before));
  });

  it('la recherche du header filtre aussi la ville et ignore les accents', async () => {
    vi.mocked(usePropertiesList).mockReturnValue({ ...usePropertiesList(), properties: [
      { id: 'p-marais', name: 'Duplex Marais', city: 'Évry', imageUrl: '/images/property-test.webp' } as ReturnType<typeof usePropertiesList>['properties'][number],
    ] });
    const provider = new MockPortfolioProvider({ latencyMs: 0 });
    const { container } = render(<ScreenChromeProvider><SearchHarness /><PortfolioPanel createProvider={() => provider} deps={['portfolio']} /></ScreenChromeProvider>);
    await screen.findByRole('complementary', { name: 'Vos logements' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Recherche du header' }), { target: { value: 'evry' } });
    expect(container.querySelectorAll('[data-property-id]')).toHaveLength(1);
    expect(container.querySelector('[data-property-id]')).toHaveAttribute('data-property-id', 'p-marais');
    fireEvent.click(screen.getByRole('button', { name: 'Effacer', exact: true }));
    expect(container.querySelectorAll('[data-property-id]').length).toBeGreaterThan(1);
  });

  it('garde les logements sans décision et utilise leur vraie photo', async () => {
    vi.mocked(usePropertiesList).mockReturnValue({ ...usePropertiesList(), properties: [
      { id: 'quiet-home', name: 'Maison paisible', city: 'Rabat', imageUrl: '/images/quiet-home.webp' } as ReturnType<typeof usePropertiesList>['properties'][number],
    ] });
    const { container } = open();
    const home = await screen.findByRole('button', { name: /Maison paisible/ });
    expect(home.querySelector('img')?.getAttribute('src')).toMatch(/\/images\/quiet-home\.webp$/);
    expect(home).toHaveTextContent('Rien à valider');
    fireEvent.click(home);
    expect(container.querySelector('[data-pending-empty]')).toBeTruthy();
    expect(container.querySelector('[data-pending-action]')).toBeNull();
  });

  it('le retour mobile conserve le logement et le filtre choisis', async () => {
    const { container } = open();
    await screen.findByRole('complementary', { name: 'Vos logements' });
    fireEvent.click(screen.getByRole('button', { name: /Revenue/ }));
    const home = screen.getByRole('button', { name: /Studio Montmartre/ });
    fireEvent.click(home);
    expect(container.querySelector('.baitly-portfolio')).toHaveAttribute('data-detail', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Tous les logements', exact: true }));
    expect(container.querySelector('.baitly-portfolio')).not.toHaveAttribute('data-detail');
    expect(home).toHaveAttribute('aria-current', 'true');
    expect(within(screen.getByRole('group', { name: 'Filtrer par agent' })).getByRole('button', { name: /Revenue/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filtre les actions par agent sans afficher celles des autres agents', async () => {
    const { container } = open();
    await screen.findByRole('complementary', { name: 'Vos logements' });
    fireEvent.click(screen.getByRole('button', { name: /Revenue/ }));
    const cards = container.querySelectorAll('[data-pending-action]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) expect(card).toHaveAttribute('data-agent-id', 'rev');
    expect(container.querySelector('video')).toBeNull();
  });

  it('retire les alertes de parc même si le serveur les fournit', async () => {
    const provider = new MockPortfolioProvider({ latencyMs: 0 });
    vi.spyOn(provider, 'getSnapshot').mockResolvedValue({ ...buildPortfolioSnapshot(), orgAlerts: [
      { title: 'Nuits vacantes élevées', description: 'Revoir les tarifs', severity: 'critical' },
      { title: "Taux d’occupation critique", description: 'Revoir le parc', severity: 'warning' },
    ] });
    render(<PortfolioPanel createProvider={() => provider} deps={['portfolio']} />);
    await screen.findByRole('complementary', { name: 'Vos logements' });
    expect(screen.queryByText('Nuits vacantes élevées')).not.toBeInTheDocument();
    expect(screen.queryByText('Taux d’occupation critique')).not.toBeInTheDocument();
  });

  it('présente le bilan comme global et conserve la sélection au retour', async () => {
    open();
    const home = await screen.findByRole('button', { name: /Studio Montmartre/ });
    fireEvent.click(home);
    fireEvent.click(screen.getByRole('radio', { name: 'Bilan' }));
    expect(screen.getByRole('region', { name: 'Bilan du parc' })).toHaveTextContent('Résultats de tous vos logements');
    fireEvent.click(screen.getByRole('radio', { name: /À valider/ }));
    expect(within(screen.getByRole('region', { name: 'Studio Montmartre' })).getByRole('heading', { name: 'Studio Montmartre' })).toBeTruthy();
  });
});
