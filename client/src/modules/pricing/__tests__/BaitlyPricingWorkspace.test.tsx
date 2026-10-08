// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DynamicPricing from '../DynamicPricing';
import PricingCalendarView from '../PricingCalendarView';
import RatePlanForm from '../RatePlanForm';

const state = vi.hoisted(() => ({ aiEnabled: false, role: 'HOST', propertyId: null as number | null, setProperty: vi.fn(), updatePrice: vi.fn(), createPlan: vi.fn() }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ currentLanguage: 'fr', t: (key: string) => key }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { platformRole: state.role } }) }));
vi.mock('../../../hooks/useAi', () => ({ useIsAiFeatureEnabled: () => state.aiEnabled, useAiPricingPredictions: () => ({ data: state.aiEnabled ? ['2026-10-01', '2026-10-08', '2026-10-09'].map(date => ({ date, suggestedPrice: 124, confidence: .68, explanation: 'Demande modérée.' })) : [], isLoading: false }) }));
vi.mock('../../../hooks/useScreenTabs', () => ({ useScreenTabs: () => ['calendar', 'strategy', 'restrictions'].map((key) => ({ key, label: key, hidden: false })) }));
vi.mock('../../../hooks/useDynamicPricing', async (original) => ({
  ...await original<object>(),
  useDynamicPricing: () => ({
    properties: [{ id: 1, name: 'Riad Atlas', ownerId: 2, ownerName: 'Owner' }, { id: 2, name: 'Studio', ownerId: 3, ownerName: 'Other owner' }], propertiesLoading: false,
    selectedPropertyId: state.propertyId, setSelectedPropertyId: state.setProperty,
    currentMonth: new Date(2026, 9, 1), from: '2026-10-01', to: '2026-10-31',
    goToPrevMonth: vi.fn(), goToNextMonth: vi.fn(), calendarPricing: [], calendarPricingLoading: false,
    ratePlans: [], ratePlansLoading: false, updatePrice: state.updatePrice,
    createRatePlan: state.createPlan, updateRatePlan: vi.fn(), deleteRatePlan: vi.fn(),
  }),
}));
vi.mock('../../../components/PageHeader', () => ({ default: ({ actions, inlineControls }: { actions: React.ReactNode; inlineControls: React.ReactNode }) => <header>{inlineControls}{actions}</header> }));
vi.mock('../../../components/PageTabs', () => ({ default: ({ options, onChange }: { options: { label: string }[]; onChange: (index: number) => void }) => <nav>{options.map((option, index) => <button key={index} onClick={() => onChange(index)}>{option.label}</button>)}</nav> }));
vi.mock('../BaitlyPricingAiPanel', () => ({ default: ({ selection, onDismiss }: { selection: { recommendation: { date: string } } | null; onDismiss: (selection: unknown) => void }) => <aside>{selection && <><p data-testid="proposal-preview">{selection.recommendation.date}</p><button onClick={() => onDismiss(selection)}>dismiss preview</button></>}</aside> }));
vi.mock('../MarketPositioningCard', () => ({ default: () => <div>market</div> }));
vi.mock('../PricingOverviewView', () => ({ default: () => <div>portfolio</div> }));
vi.mock('../RestrictionsPanel', () => ({ default: () => <div>stay rules</div> }));
vi.mock('../YieldRulesPanel', () => ({ default: () => <div>organization automation</div> }));
vi.mock('../PricingEditDialog', () => ({ default: ({ open, onApply }: { open: boolean; onApply: (price: number) => Promise<void> }) => open ? <button onClick={() => void onApply(145)}>confirm price</button> : null }));
vi.mock('../MinNightsEditDialog', () => ({ default: () => null }));
vi.mock('../../../components/MiniDateRangePicker', () => ({ default: () => null }));

function mount(children: React.ReactNode, route = '/dynamic-pricing') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}>{children}</MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); state.propertyId = 1; state.role = 'HOST'; state.aiEnabled = false; state.updatePrice.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

function ScopeUrl() {
  return <output data-testid="scope-url">{useLocation().search}</output>;
}

describe('Baitly pricing workspace', () => {
  it.each(['property', 'portfolio'])('selects today’s proposal in the %s view and advances when dismissed without saving', (view) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 8, 12));
    state.aiEnabled = true;
    mount(<DynamicPricing />, '/dynamic-pricing?view=' + view);
    expect(screen.getByTestId('proposal-preview')).toHaveTextContent('2026-10-08');
    expect(state.updatePrice).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'dismiss preview' }));
    expect(screen.getByTestId('proposal-preview')).toHaveTextContent('2026-10-09');
    expect(state.updatePrice).not.toHaveBeenCalled();
  });
  it('defaults to the first property while preserving the bookmarked month and tab', () => {
    state.propertyId = null;
    mount(<><DynamicPricing /><ScopeUrl /></>, '/dynamic-pricing?tab=strategy&month=2027-02');
    expect(screen.getByTestId('scope-url')).toHaveTextContent('property=1');
    expect(screen.getByTestId('scope-url')).toHaveTextContent('month=2027-02');
    expect(screen.getByTestId('scope-url')).toHaveTextContent('tab=strategy');
  });
  it('defaults to the first property belonging to the selected owner', () => {
    state.role = 'SUPER_ADMIN';
    state.propertyId = null;
    mount(<><DynamicPricing /><ScopeUrl /></>, '/dynamic-pricing?owner=3');
    expect(screen.getByTestId('scope-url')).toHaveTextContent('owner=3&property=2');
  });
  it('preserves an existing property selection', () => {
    state.propertyId = 2;
    mount(<><DynamicPricing /><ScopeUrl /></>, '/dynamic-pricing?property=2');
    expect(screen.getByTestId('scope-url')).toHaveTextContent('property=2');
  });
  it('opens the strategy from its URL and only opens the editor on request', () => {
    mount(<DynamicPricing />, '/dynamic-pricing?tab=strategy');
    expect(screen.queryByLabelText('dynamicPricing.ratePlan.name')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'dynamicPricing.ratePlan.create' }));
    expect(screen.getByLabelText('dynamicPricing.ratePlan.name')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(screen.queryByLabelText('dynamicPricing.ratePlan.name')).toBeNull();
  });
  it('keeps organization automations accessible without selecting a property', () => {
    state.propertyId = null;
    mount(<DynamicPricing />, '/dynamic-pricing?tab=strategy&section=automation');
    expect(screen.getByText('organization automation')).toBeVisible();
  });
  it('switches to the portfolio and removes the redundant property menu', () => {
    mount(<DynamicPricing />);
    fireEvent.click(screen.getByRole('button', { name: 'baitlyPricing.portfolio' }));
    expect(screen.getByText('portfolio')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Riad Atlas' })).toBeNull();
  });
  it('shows the owner filter only for platform staff, inside the header', () => {
    const first = mount(<DynamicPricing />);
    expect(screen.queryByLabelText('dynamicPricing.selectOwner')).toBeNull();
    first.unmount();
    state.role = 'SUPER_ADMIN';
    mount(<DynamicPricing />, '/dynamic-pricing?owner=2');
    expect(screen.getByLabelText('dynamicPricing.selectOwner').closest('header')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Riad Atlas' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('applies a keyboard-selected range with an exclusive API end date', async () => {
    mount(<PricingCalendarView selectedPropertyId={1} currentMonth={new Date(2026, 9, 1)} onPrevMonth={vi.fn()} onNextMonth={vi.fn()}
      calendarPricing={[]} calendarPricingLoading={false} onUpdatePrice={state.updatePrice} updatePriceLoading={false} />);
    fireEvent.keyDown(screen.getByRole('button', { name: '2026-10-05, – EUR' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('button', { name: '2026-10-08, – EUR' }), { key: 'Enter', shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'dynamicPricing.calendar.editPrice' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm price' }));
    await waitFor(() => expect(state.updatePrice).toHaveBeenCalledWith({ propertyId: 1, from: '2026-10-05', to: '2026-10-09', nightlyPrice: 145 }));
  });
  it('preserves the plan currency and retains entered data after a save failure', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('offline'));
    mount(<RatePlanForm propertyId={1} currency="EUR" editingPlan={{ id: 4, propertyId: 1, name: 'Été', type: 'SEASONAL', currency: 'MAD', nightlyPrice: 1500, priority: 1, isActive: true }} onSave={onSave} onCancel={vi.fn()} loading={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ currency: 'MAD', nightlyPrice: 1500 })));
    expect(await screen.findByText('baitlyPricing.saveError')).toBeVisible();
    expect(screen.getByLabelText('dynamicPricing.ratePlan.name')).toHaveValue('Été');
  });
});
