import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Workspace, { groupStayPeriods, initialStayPeriod } from '../BaitlyStayRulesWorkspace';
import RestrictionsPanel from '../RestrictionsPanel';
import type { BookingRestriction } from '../../../services/api/calendarPricingApi';

const mocks = vi.hoisted(() => ({
  t: (key: string, fallback: unknown) => {
    if (typeof fallback === 'string') return fallback;
    const options = fallback as Record<string, unknown> | undefined;
    return String(options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));
  },
  getBookingRestrictions: vi.fn(), createBookingRestriction: vi.fn(), updateBookingRestriction: vi.fn(), deleteBookingRestriction: vi.fn(),
}));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: mocks.t, currentLanguage: 'fr' }) }));
vi.mock('../../../hooks/useDateFormat', () => ({ useDateFormat: () => ({ language: 'fr', weekStartsOn: 1 }) }));
vi.mock('../../../services/api/calendarPricingApi', () => ({ calendarPricingApi: mocks }));
const rule: BookingRestriction = { id: 1, propertyId: 82, startDate: '2027-06-15', endDate: '2027-08-31',
  minStay: 7, maxStay: 28, daysOfWeek: null, priority: 2, gapDays: 1, advanceNoticeDays: 3 };
const arrival = { ...rule, id: 2, minStay: null, maxStay: null, closedToArrival: true, daysOfWeek: [1, 2, 3, 4, 5, 7] };
const winter = { ...rule, id: 3, startDate: '2026-12-18', endDate: '2027-01-04', minStay: 5, maxStay: 21 };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBookingRestrictions.mockResolvedValue([rule, arrival]);
  mocks.updateBookingRestriction.mockImplementation(async (_id, data) => ({ ...data, id: 1 }));
});
afterEach(cleanup);
function renderPanel() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RestrictionsPanel propertyId={82} /></QueryClientProvider>);
}
describe('Visual stay rules', () => {
  it('groups only identical periods without losing individual weekday scopes and priorities', () => {
    const periods = groupStayPeriods([rule, arrival, winter]);
    expect(periods.map(period => period.rules.map(item => item.id))).toEqual([[3], [1, 2]]);
    expect(periods[1].rules[1].daysOfWeek).toEqual([1, 2, 3, 4, 5, 7]);
    expect(periods[1].rules[0].priority).toBe(2);
  });
  it('initially selects the current period, then the nearest future or last past period', () => {
    const periods = groupStayPeriods([rule, winter]);
    expect(initialStayPeriod(periods, '2027-06-20')?.rules[0].id).toBe(1);
    expect(initialStayPeriod(periods, '2026-10-08')?.rules[0].id).toBe(3);
    expect(initialStayPeriod(periods, '2028-01-01')?.rules[0].id).toBe(1);
  });
  it('switches periods and shows calendar coverage, stay lengths and plain arrival labels', () => {
    const { container } = render(<Workspace restrictions={[rule, arrival, winter]} loading={false} deleting={false} editor={null} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /15.*2027.*31/ }));
    expect(screen.getByText('7 à 28 nuits')).toBeVisible();
    expect(screen.getByText('Arrivées bloquées')).toBeVisible();
    expect(screen.queryByText('CTA')).toBeNull();
    expect(container.querySelectorAll('.bs-rule')).toHaveLength(2);
    expect(container.querySelectorAll('.bs-covered-day').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /18.*2026.*4.*2027/ }));
    expect(screen.getByText('5 à 21 nuits')).toBeVisible();
    expect(screen.queryByText('Arrivées bloquées')).toBeNull();
  });
  it('opens an inline editor and preserves advanced settings when saving an existing rule', async () => {
    renderPanel();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Modifier' }))[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.updateBookingRestriction).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Séjour min (nuits)'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(mocks.updateBookingRestriction).toHaveBeenCalledWith(1, expect.objectContaining({
      propertyId: 82, minStay: 8, maxStay: 28, gapDays: 1, advanceNoticeDays: 3, priority: 2, daysOfWeek: null,
    })));
  });
  it('blocks invalid stay lengths and retains the editor after a failed save', async () => {
    renderPanel();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Modifier' }))[0]);
    fireEvent.change(screen.getByLabelText('Séjour max (nuits)'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText(/Utilisez un nombre entier/)).toBeVisible();
    expect(mocks.updateBookingRestriction).not.toHaveBeenCalled();
    mocks.updateBookingRestriction.mockRejectedValueOnce(new Error('network'));
    fireEvent.change(screen.getByLabelText('Séjour max (nuits)'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText("Échec de l'enregistrement de la restriction.")).toBeVisible();
    expect(screen.getByLabelText('Séjour max (nuits)')).toHaveValue(30);
  });
});
