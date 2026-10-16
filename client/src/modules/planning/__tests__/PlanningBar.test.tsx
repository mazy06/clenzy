import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlanningBar from '../PlanningBar';
import type { BarLayout, PlanningEvent } from '../types';

// ─── Mock @dnd-kit ──────────────────────────────────────────────────────────

const mockSetNodeRef = vi.fn();

vi.mock('@dnd-kit/core', () => ({
  useDraggable: vi.fn(() => ({
    attributes: { role: 'button', tabIndex: 0 },
    listeners: {
      onPointerDown: vi.fn(),
    },
    setNodeRef: mockSetNodeRef,
    isDragging: false,
  })),
}));

// ─── Mock useAuth ───────────────────────────────────────────────────────────

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { roles: ['SUPER_ADMIN'], orgRole: 'ADMIN' },
  }),
}));

// useCurrency depend de CurrencyProvider + react-query. Stub deterministe
// pour eviter de monter tout le provider stack dans un test unitaire.
vi.mock('../../../hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'EUR',
    setCurrency: vi.fn(),
    currencySymbol: '€',
    currencyLabel: 'EUR (€)',
    convertAndFormat: (amount: number | null | undefined) =>
      amount == null ? '—' : `${amount.toFixed(2)} €`,
    convert: (amount: number) => amount,
    isConverting: false,
    rateDate: null,
    rates: null,
    ratesLoading: false,
  }),
}));

// ─── Test fixtures ──────────────────────────────────────────────────────────


const baseEvent: PlanningEvent = {
  id: 'res-1',
  type: 'reservation',
  propertyId: 1,
  startDate: '2026-03-01',
  endDate: '2026-03-05',
  label: 'John Doe',
  status: 'confirmed',
  color: '#4CAF50',
};

const baseLayout: BarLayout = {
  event: baseEvent,
  left: 100,
  width: 200,
  top: 4,
  height: 34,
  layer: 'primary',
};

function renderBar(props?: Partial<React.ComponentProps<typeof PlanningBar>>) {
  return render(
      <PlanningBar
        layout={baseLayout}
        zoom="week"
        isSelected={false}
        isConflict={false}
        isDragActive={false}
        resizeWidth={null}
        resizeConflict={false}
        onClick={vi.fn()}
        {...props}
      />
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PlanningBar', () => {
  it('garde l’alerte d’e-mail visible sur une réservation courte', () => {
    const event = { ...baseEvent, reservation: { id: 1, guestEmail: '' } as PlanningEvent['reservation'] };
    const { container } = renderBar({ layout: { ...baseLayout, width: 60, event } });
    expect(container.querySelector('[role="img"][aria-label]')).toBeTruthy();
    expect(container.querySelector('[data-planning-bar]')?.getAttribute('aria-label')).toContain('manquant');
  });
  it('permet d’ouvrir une prestation repliée sans ouvrir le récapitulatif du séjour', () => {
    const onClick = vi.fn();
    const intervention = { ...baseEvent, id: 'int-12', type: 'cleaning', label: 'Ménage de départ' } as PlanningEvent;
    renderBar({ layout: { ...baseLayout, width: 90 }, linkedInterventions: [intervention], onClick });
    fireEvent.click(screen.getByRole('button', { name: /indicateur/i }));
    fireEvent.click(screen.getByRole('button', { name: /^ménage$/i }));
    expect(onClick).toHaveBeenCalledWith(intervention);
  });
  it.each(['', '   ', 'guest@example.com'])('signals a missing email for "%s"', (guestEmail) => {
    const event = { ...baseEvent, reservation: { id: 1, guestEmail } as PlanningEvent['reservation'] };
    const { container } = renderBar({ layout: { ...baseLayout, event } });
    const bar = container.querySelector('[data-planning-bar]')!;
    expect(bar.classList.contains('pl-email-missing')).toBe(!guestEmail.trim());
  });

  it('renders with data-planning-bar attribute for drag detection', () => {
    const { container } = renderBar();
    const barElement = container.querySelector('[data-planning-bar]');
    expect(barElement).toBeTruthy();
  });

  it('has touch-action: none for @dnd-kit touch support', () => {
    const { container } = renderBar();
    const barElement = container.querySelector('[data-planning-bar]') as HTMLElement;
    expect(barElement).toBeTruthy();
    // Le style vient desormais de la classe Tailwind `touch-none`, plus d'un sx
    // inline. jsdom ne charge aucune feuille de style : `getComputedStyle` y
    // renverrait toujours vide. On verifie donc la classe, qui EST la
    // declaration. (Rendu reel controle au navigateur : touch-action = none.)
    expect(barElement.className).toContain('touch-none');
  });

  it('shows pointer cursor on the bar (drag reste actif via dnd-kit)', () => {
    // Spec .s-brick : le curseur est volontairement « pointer » (et non « grab ») ;
    // le drag reste géré par @dnd-kit. cf. PlanningBar.tsx.
    const { container } = renderBar();
    const barElement = container.querySelector('[data-planning-bar]') as HTMLElement;
    expect(barElement).toBeTruthy();
    expect(barElement.className).toContain('cursor-pointer');
  });

  it('displays the event label when bar is wide enough', () => {
    renderBar();
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('calls onClick when a non-reservation bar is clicked (no drag active)', () => {
    // Le clic sur une RÉSERVATION ouvre désormais un popover récap (cf.
    // PlanningBar.tsx) ; onClick(event) reste déclenché pour les interventions
    // (ménage/maintenance), testé ici via un événement de ménage.
    const handleClick = vi.fn();
    const cleaningEvent: PlanningEvent = { ...baseEvent, id: 'clean-1', type: 'cleaning' };
    const { container } = renderBar({
      layout: { ...baseLayout, event: cleaningEvent },
      onClick: handleClick,
    });
    const barElement = container.querySelector('[data-planning-bar]') as HTMLElement;
    fireEvent.click(barElement);
    expect(handleClick).toHaveBeenCalledWith(cleaningEvent);
  });

  it('does NOT call onClick when drag is active', () => {
    const handleClick = vi.fn();
    const { container } = renderBar({ onClick: handleClick, isDragActive: true });
    const barElement = container.querySelector('[data-planning-bar]') as HTMLElement;
    fireEvent.click(barElement);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('opens an intervention with Enter', () => {
    const handleClick = vi.fn();
    const cleaning = { ...baseEvent, type: 'cleaning' as const };
    const { container } = renderBar({ layout: { ...baseLayout, event: cleaning }, onClick: handleClick });
    fireEvent.keyDown(container.querySelector('[data-planning-bar]')!, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledWith(cleaning);
  });

  it('does not open an intervention while finishing a keyboard drag', () => {
    const onClick = vi.fn();
    const { container } = renderBar({ layout: { ...baseLayout, event: { ...baseEvent, type: 'cleaning' } }, onClick, isDragActive: true });
    fireEvent.keyDown(container.querySelector('[data-planning-bar]')!, { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('hides a cancelled stay with the keyboard without opening its recap', () => {
    const onHide = vi.fn();
    const cancelled = { ...baseEvent, status: 'cancelled' };
    renderBar({ layout: { ...baseLayout, event: cancelled }, onHide });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Masquer du planning' }), { key: 'Enter' });
    expect(onHide).toHaveBeenCalledWith(cancelled);
  });

  it('renders with position: absolute for absolute positioning in row', () => {
    const { container } = renderBar();
    const barElement = container.querySelector('[data-planning-bar]') as HTMLElement;
    expect(barElement.className).toContain('absolute');
  });
});
