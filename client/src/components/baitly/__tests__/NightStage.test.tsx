import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NightStage, StageFoot, StageRail, useStageScene, type RailStep } from '../NightStage';
import ShowcaseEmpty from '../ShowcaseEmpty';
import { STAGE_IMAGES } from '../stageImages';
import PlanningEmptyShowcase from '../../../modules/planning/PlanningEmptyShowcase';
import DashboardEmptyShowcase from '../../../modules/dashboard/DashboardEmptyShowcase';
import i18n from '../../../i18n/config';

const STEPS: RailStep[] = [
  { key: 'a', label: 'Alpha', image: STAGE_IMAGES.calendar },
  { key: 'b', label: 'Bravo', image: STAGE_IMAGES.cleaning },
  { key: 'c', label: 'Charlie', image: STAGE_IMAGES.revenue },
];

function Harness() {
  const stage = useStageScene(STEPS.length, 1000);
  return (
    <NightStage
      eyebrow="Eyebrow" title="Titre" actions={<button>Go</button>}
      visual={<p data-testid="scene">{stage.scene}</p>}
      onVisualFocus={stage.takeOver}
      rail={<StageRail steps={STEPS} scene={stage} label="Étapes" />}
    />
  );
}

function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
const mockMotion = (reduced: boolean) => vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
  matches: reduced, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
  addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
}));

beforeEach(async () => { await i18n.changeLanguage('fr'); mockMotion(false); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Scène bleu nuit', () => {
  it('pose l’écran sur l’îlot sombre de la sidebar et nomme sa section par son titre', () => {
    const { container } = render(<NightStage headingId="t" eyebrow="E" title="Un titre" visual={<span>v</span>} />);
    expect(container.querySelector('section[data-night]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Un titre' })).toHaveAttribute('id', 't');
  });

  it('occupe toute la largeur quand il n’y a pas de schéma', () => {
    const { container } = render(<NightStage eyebrow="E" title="Seul" />);
    expect(container.querySelector('.ns-grid')).toHaveAttribute('data-solo', 'true');
    expect(container.querySelector('.ns-visual')).toBeNull();
  });

  it('fait défiler les étapes, puis laisse la main dès un clic', () => {
    vi.useFakeTimers();
    render(<Harness />);
    expect(screen.getByRole('button', { name: /Alpha/ })).toHaveAttribute('aria-current', 'step');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('button', { name: /Bravo/ })).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByTestId('scene')).toHaveTextContent('0');
    expect(screen.getByRole('list', { name: 'Étapes' })).toHaveAttribute('data-auto', 'false');
  });

  it('laisse la main aussi quand le focus entre dans le schéma', () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.focus(screen.getByTestId('scene'));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByTestId('scene')).toHaveTextContent('0');
  });

  it('ne défile pas sous mouvement réduit et garde chaque étape accessible', () => {
    vi.useFakeTimers();
    mockMotion(true);
    render(<Harness />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByTestId('scene')).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button', { name: /Charlie/ }));
    expect(screen.getByTestId('scene')).toHaveTextContent('2');
  });

  it('porte le sens par l’image : une illustration décorative par étape, sans texte alternatif', () => {
    const { container } = render(<Harness />);
    const images = Array.from(container.querySelectorAll('.ns-rail-btn img'));
    expect(images.map((image) => image.getAttribute('src'))).toEqual(STEPS.map((step) => step.image));
    images.forEach((image) => expect(image).toHaveAttribute('alt', ''));
    expect(STEPS.every((step) => /^\/images\/.+\.(webp|png)$/.test(step.image))).toBe(true);
  });

  it('affiche la ligne de pied avec sa sortie de secours', () => {
    render(<StageFoot note="Un seul logement suffit.">{<a href="#x">Sortir</a>}</StageFoot>);
    expect(screen.getByText('Un seul logement suffit.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sortir' })).toBeVisible();
  });
});

describe('ShowcaseEmpty en scène nuit', () => {
  it('montre une illustration, une ligne et la sortie de secours', () => {
    const { container } = render(
      <ShowcaseEmpty eyebrow={{ label: 'Voyageurs' }} title="Chaque voyageur" description="Une ligne."
        image={STAGE_IMAGES.capacity} action={<button>Importer</button>} fallback={<>Autrement ? <a href="#x">Créer</a></>} />,
    );
    expect(container.querySelector('[data-night]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Chaque voyageur' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Importer' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Créer' })).toBeVisible();
    expect(container.querySelector('.ns-art img')).toHaveAttribute('src', STAGE_IMAGES.capacity);
  });

  it('préfère un aperçu fourni à l’illustration', () => {
    const { container } = render(<ShowcaseEmpty title="T" image={STAGE_IMAGES.capacity} preview={<span data-testid="preview">aperçu</span>} />);
    expect(screen.getByTestId('preview')).toBeInTheDocument();
    expect(container.querySelector('.ns-art')).toBeNull();
  });
});

describe('Planning sans logement', () => {
  const renderPlanning = (onImport = vi.fn()) => ({ onImport, ...render(<MemoryRouter><PlanningEmptyShowcase onImport={onImport} /><Location /></MemoryRouter>) });

  it('promet un seul calendrier en une phrase, avec deux gestes et les badges partenaires', () => {
    const { container, onImport } = renderPlanning();
    expect(screen.getByRole('heading', { name: i18n.t('planning.empty.showcase.title') })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('planning.empty.showcase.addProperty') }));
    expect(screen.getByTestId('location')).toHaveTextContent('/properties/new');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('planning.empty.showcase.importChannel') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('planning.empty.showcase.importWithCalendars') }));
    expect(onImport).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('.ns-logos img')).toHaveLength(4);
    expect(container.querySelector('[data-night]')).not.toBeNull();
  });

  it('est épuré : plus de blocs « mécanisme », « garde-fous » ni de liste de services', () => {
    const { container } = renderPlanning();
    expect(container.querySelectorAll('h3')).toHaveLength(0);
    expect(container.querySelectorAll('li').length).toBeLessThanOrEqual(8); // 4 badges + 4 étapes
    const longest = Math.max(...Array.from(container.querySelectorAll('p')).map((node) => node.textContent?.length ?? 0));
    expect(longest).toBeLessThan(70);
  });

  it('pilote la grille par le rail : déplacer un séjour renvoie les disponibilités aux canaux', () => {
    const { container } = renderPlanning();
    expect(container.querySelectorAll('.pl-empty-sync .ns-pop')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('planning.empty.showcase.milestones.move') }));
    expect(screen.getByRole('button', { name: i18n.t('planning.empty.showcase.milestones.move') })).toHaveAttribute('aria-current', 'step');
    expect(container.querySelectorAll('.pl-empty-sync .ns-pop')).toHaveLength(3);
  });

  it.each(['fr', 'en', 'ar'])('se lit en %s sans clé brute', async (language) => {
    await i18n.changeLanguage(language);
    const { container } = renderPlanning();
    expect(container.textContent).not.toMatch(/planning\.empty\./);
    expect(container.querySelectorAll('.ns-rail-btn')).toHaveLength(4);
  });
});

describe('Tableau de bord sans logement', () => {
  const renderDashboard = (onConnect = vi.fn()) => ({ onConnect, ...render(<MemoryRouter><DashboardEmptyShowcase onConnect={onConnect} /><Location /></MemoryRouter>) });

  it('ouvre les vrais parcours depuis ses deux gestes', () => {
    const { onConnect } = renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dashboard.firstUse.addProperty') }));
    expect(screen.getByTestId('location')).toHaveTextContent('/properties/new');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dashboard.firstUse.connectChannels') }));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('montre les indicateurs par leurs illustrations et se pilote par le rail', () => {
    const { container } = renderDashboard();
    const kpiImages = Array.from(container.querySelectorAll('.db-kpi img')).map((image) => image.getAttribute('src'));
    expect(kpiImages).toEqual([STAGE_IMAGES.occupancy, STAGE_IMAGES.revenue, STAGE_IMAGES.bookings]);
    expect(container.querySelector('.db-today-item')).toHaveAttribute('data-hl', 'true');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dashboard.firstUse.scenes.performance') }));
    expect(container.querySelector('.db-kpi')).toHaveAttribute('data-hl', 'true');
    expect(container.querySelector('.db-today-item')).toHaveAttribute('data-hl', 'false');
  });

  it('traite une priorité et ajoute un widget dans l’aperçu, sans toucher au compte', () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dashboard.firstUse.demo.assignCleaning') }));
    expect(screen.getByRole('button', { name: i18n.t('dashboard.firstUse.demo.assigned') })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dashboard.firstUse.demo.addWidget') }));
    expect(screen.getByRole('img', { name: new RegExp(i18n.t('dashboard.firstUse.demo.propertyOccupancy')) })).toBeVisible();
  });

  it.each(['fr', 'en', 'ar'])('se lit en %s sans clé brute', async (language) => {
    await i18n.changeLanguage(language);
    const { container } = renderDashboard();
    expect(container.textContent).not.toMatch(/dashboard\.firstUse\./);
    expect(container.querySelectorAll('.ns-rail-btn')).toHaveLength(4);
  });
});
