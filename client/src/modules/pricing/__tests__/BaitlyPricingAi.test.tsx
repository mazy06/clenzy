import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BaitlyPricingAiPanel, { proposalEndDate } from '../BaitlyPricingAiPanel';
import PricingCalendarView from '../PricingCalendarView';
import PricingOverviewView from '../PricingOverviewView';
import type { BaitlyPricingAiSelection } from '../BaitlyPricingProposal';
import type { Property } from '../../../services/api/propertiesApi';

const fixture = vi.hoisted(() => ({
  loading: false,
  recommendation: { date: '2026-10-31', suggestedPrice: 124.5, confidence: .68,
    explanation: 'Demande modérée.', marketComparison: '', factors: [] },
}));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({
  t: (key: string, fallback: unknown) => typeof fallback === 'string' ? fallback : key,
}) }));
vi.mock('../../../hooks/useAi', () => ({ useAiPricingPredictions: () => ({ data: fixture.loading ? [] : [fixture.recommendation], isLoading: fixture.loading, isError: false }) }));
vi.mock('../../../services/api/calendarPricingApi', () => ({
  calendarPricingApi: { getPricing: vi.fn().mockResolvedValue([{ date: '2026-10-31', nightlyPrice: 170, currency: 'MAD', priceSource: 'BASE' }]) },
}));
vi.mock('../../supervision/renderers/AgentPortrait', () => ({ AgentPortrait: () => <img alt="" src="/images/supervision-agents/rev.webp" /> }));
afterEach(() => { cleanup(); fixture.loading = false; });

function mount(content: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{content}</MemoryRouter></QueryClientProvider>);
}
const selection: BaitlyPricingAiSelection = { propertyId: 82, propertyName: 'Duplex', currency: 'MAD',
  currentPrice: 170, recommendation: fixture.recommendation };

describe('Calendar AI proposals', () => {
  it('explains the AI loading state and keeps applied prices visible while cell proposals load', () => {
    fixture.loading = true;
    const { container } = mount(<>
      <BaitlyPricingAiPanel selection={null} propertyId={82} from="2026-10-01" to="2026-10-31"
        enabled loading={false} onApply={vi.fn()} onDismiss={vi.fn()} />
      <PricingCalendarView selectedPropertyId={82} currentMonth={new Date(2026, 9, 1)}
        onPrevMonth={vi.fn()} onNextMonth={vi.fn()} calendarPricing={[{ date: '2026-10-08', nightlyPrice: 170, priceSource: 'BASE' }]}
        calendarPricingLoading={false} updatePriceLoading={false} onUpdatePrice={vi.fn()} proposalsLoading />
    </>);
    expect(screen.getByRole('status')).toHaveTextContent('Revenue prépare les propositions');
    expect(container.querySelectorAll('.bp-ai-proposal-loading')).toHaveLength(31);
    expect(screen.getByRole('button', { name: '2026-10-08, 170 EUR' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Appliquer à cette nuit' })).toBeNull();
  });
  it('opens a proposal without modifying the applied price or selecting a manual range', () => {
    const select = vi.fn(), update = vi.fn();
    mount(<PricingCalendarView selectedPropertyId={82} propertyName="Duplex" currency="MAD"
      currentMonth={new Date(2026, 9, 1)} onPrevMonth={vi.fn()} onNextMonth={vi.fn()}
      calendarPricing={[{ date: '2026-10-31', nightlyPrice: 170, priceSource: 'BASE' }]}
      calendarPricingLoading={false} updatePriceLoading={false} onUpdatePrice={update}
      proposals={new Map([[fixture.recommendation.date, fixture.recommendation]])} onSelectProposal={select} />);
    fireEvent.click(screen.getByRole('button', { name: 'baitlyPricing.ai.cellLabel' }));
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 82, currency: 'MAD', currentPrice: 170 }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'dynamicPricing.calendar.editPrice' })).toBeNull();
  });
  it('only saves after explicit approval and uses an exclusive end date at month boundaries', async () => {
    const apply = vi.fn().mockResolvedValue(undefined);
    mount(<BaitlyPricingAiPanel selection={selection} propertyId={82} from="2026-10-01" to="2026-10-31"
      enabled loading={false} onApply={apply} onDismiss={vi.fn()} />);
    expect(apply).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Appliquer à cette nuit' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(apply).toHaveBeenCalledWith({ propertyId: 82, from: '2026-10-31', to: '2026-11-01', nightlyPrice: 124.5, currency: 'MAD' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Le tarif a été appliqué');
    expect(proposalEndDate('2028-02-29')).toBe('2028-03-01');
  });
  it('retains the proposal and reports an unsuccessful save', async () => {
    const apply = vi.fn().mockRejectedValue(new Error('offline'));
    mount(<BaitlyPricingAiPanel selection={selection} propertyId={82} from="2026-10-01" to="2026-10-31"
      enabled loading={false} onApply={apply} onDismiss={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Appliquer à cette nuit' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByText('Enregistrement impossible. Vos modifications sont conservées.')).toBeVisible();
    expect(button).toBeVisible();
    expect(screen.getByText('Duplex')).toBeVisible();
  });
  it('shows property thumbnails in the portfolio and selects the proposal for the correct property', async () => {
    const select = vi.fn();
    const { container } = mount(<PricingOverviewView properties={[{ id: 76, name: 'Studio', type: 'studio' } as Property]}
      propertiesLoading={false} currentMonth={new Date(2026, 9, 1)} from="2026-10-01" to="2026-10-31"
      onPrevMonth={vi.fn()} onNextMonth={vi.fn()} aiEnabled onSelectProposal={select} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'baitlyPricing.ai.cellLabel' })).toBeVisible());
    expect(container.querySelector('.bp-portfolio-property img')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'baitlyPricing.ai.cellLabel' }));
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 76, propertyName: 'Studio', currency: 'MAD' }));
  });
});
