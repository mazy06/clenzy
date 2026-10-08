import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardKpiSummary from '../DashboardKpiSummary';
import type { FinancialKpis } from '../../../hooks/useDashboardOverview';

vi.mock('../../../components/baitly/Money', () => ({ Money: ({ value }: { value: number }) => <span>{value} €</span> }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const kpis: FinancialKpis = { occupancyRate: { value: 80, previousValue: 70, growth: 14.3 },
  totalRevenue: { value: 1000, previousValue: 5000, growth: -80 }, adr: { value: 120, previousValue: 100, growth: 20 },
  revPAN: { value: 96, previousValue: 70, growth: 37.1 }, bookings: { value: 10, previousValue: 10, growth: 0 },
  guestRating: { average: 0, count: 0 } };
const mount = () => render(<DashboardKpiSummary kpis={kpis} activeProperties={4} period="month" />);
const el = (label: string) => screen.getByRole('button', { name: new RegExp('^' + label) });
const tick = async (time: number) => { await act(async () => { vi.advanceTimersByTime(time); }); };
function desktop() {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: true, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}
// jsdom may not expose PointerEvent; define the pointerType on the dispatched event.
function pointer(target: Element, type: 'pointerover' | 'pointerout', pointerType = 'mouse') {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  fireEvent(target, event);
}

describe('dashboard KPI disclosures', () => {
  it('only shows image, label and value at rest, with no recommendation taking up space', () => {
    mount();
    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Catastrophique')).not.toBeInTheDocument();
    expect(el('Revenus')).toHaveAttribute('aria-expanded', 'false');
    expect(within(el('Revenus')).getByText('1000 €')).toBeVisible();
  });

  it('opens on click on touch devices, toggles off, and only opens one KPI at a time', async () => {
    vi.useFakeTimers();
    mount();
    pointer(el('Revenus'), 'pointerover', 'touch');
    await tick(250);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(el('Revenus'));
    expect(screen.getByRole('dialog', { name: 'Revenus' })).toBeVisible();
    expect(el('Revenus').parentElement).toHaveAttribute('data-expanded', 'true');
    expect(screen.getByText(/Les revenus chutent fortement/)).toBeVisible();
    fireEvent.click(el('Note voyageurs'));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(el('Revenus').parentElement).toHaveAttribute('data-expanded', 'false');
    expect(el('Note voyageurs').parentElement).toHaveAttribute('data-expanded', 'true');
    expect(screen.getByText(/Aucun avis exploitable/)).toBeVisible();
    expect(screen.getByText('Données insuffisantes')).toBeVisible();
    fireEvent.click(el('Note voyageurs'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not use hover when a tablet reports a mouse but not the desktop media query', async () => {
    vi.useFakeTimers();
    mount();
    pointer(el('Revenus'), 'pointerover');
    await tick(300);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on desktop hover, lets the pointer enter the drawer, then closes on leaving', async () => {
    vi.useFakeTimers();
    desktop();
    mount();
    pointer(el('Occupation'), 'pointerover');
    await tick(200);
    const dialog = screen.getByRole('dialog', { name: 'Occupation' });
    expect(dialog).toBeVisible();
    expect(screen.getByText('+10 pts')).toBeVisible();
    pointer(el('Occupation'), 'pointerout');
    pointer(dialog, 'pointerover');
    await tick(300);
    expect(dialog).toBeVisible();
    pointer(dialog, 'pointerout');
    await tick(250);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancels a passing hover before opening and keeps a clicked drawer open on pointer leave', async () => {
    vi.useFakeTimers();
    desktop();
    mount();
    pointer(el('Occupation'), 'pointerover');
    pointer(el('Occupation'), 'pointerout');
    await tick(300);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(el('Occupation'));
    pointer(el('Occupation'), 'pointerout');
    await tick(300);
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('can move from a clicked KPI to a hovered one without restoring focus to the old tile', async () => {
    vi.useFakeTimers();
    desktop();
    mount();
    fireEvent.click(el('Revenus'));
    pointer(el('Occupation'), 'pointerover');
    await tick(200);
    await tick(1);
    expect(screen.getByRole('dialog', { name: 'Occupation' })).toBeVisible();
    expect(el('Revenus')).not.toHaveFocus();
  });

  it('restores keyboard focus on Escape and keeps the level explanation available', async () => {
    vi.useFakeTimers();
    mount();
    el('Occupation').focus();
    fireEvent.click(el('Occupation'));
    const summary = screen.getByText('Comprendre les niveaux');
    fireEvent.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
    expect(screen.getByText(/Repères Baitly indicatifs/)).toBeVisible();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await tick(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(el('Occupation')).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    mount();
    fireEvent.click(el('Revenus'));
    await screen.findByRole('dialog');
    await new Promise((resolve) => setTimeout(resolve, 10)); // Radix defers its outside pointer listener.
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('disables details while loading', () => {
    render(<DashboardKpiSummary kpis={kpis} period="month" loading />);
    expect(el('Revenus')).toBeDisabled();
    fireEvent.click(el('Revenus'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
