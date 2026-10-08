import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import YieldRulesPanel from '../YieldRulesPanel';
import { groupYieldRules } from '../BaitlyYieldWorkspace';
import type { Property } from '../../../services/api/propertiesApi';
import type { YieldRuleV1 } from '../../../services/api/yieldRulesApi';

const mocks = vi.hoisted(() => ({
  t: (key: string, fallback: unknown) => typeof fallback === 'string' ? fallback : key,
  getConfig: vi.fn(), listRules: vi.fn(), listPropertyBounds: vi.fn(), getJournal: vi.fn(),
  updateConfig: vi.fn(), createRule: vi.fn(), updateRule: vi.fn(), deleteRule: vi.fn(), updatePropertyBounds: vi.fn(),
}));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock('../../../services/api/yieldRulesApi', () => ({ yieldRulesApi: mocks }));
const property = { id: 82, name: 'Duplex Hivernage', type: 'apartment' } as Property;
const rule: YieldRuleV1 = { id: 1, propertyId: 82, name: 'Faible occupation', comparison: 'BELOW',
  occupancyThresholdPct: 40, windowDaysAhead: 30, adjustmentPct: 5, maxDailyChangePct: 10, active: true, priority: 0 };
const config = { enabled: true, mode: 'SIMULATION', orphanGapEnabled: true, orphanGapMaxNights: 3,
  orphanGapDiscountPct: 15, minStayAutoEnabled: true, minStayReduceWithinDays: 14, minStayReducedValue: 1 };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConfig.mockResolvedValue(config);
  mocks.listRules.mockResolvedValue([rule, { ...rule, id: 2, propertyId: 83, name: 'Autre logement' }]);
  mocks.listPropertyBounds.mockResolvedValue([{ propertyId: 82, propertyName: property.name, floor: 80, ceiling: 250 }]);
  mocks.getJournal.mockResolvedValue({ content: [], page: 0, size: 25, totalElements: 0 });
  mocks.updateConfig.mockImplementation(async next => next);
  mocks.createRule.mockImplementation(async next => ({ ...next, id: 3 }));
  mocks.updatePropertyBounds.mockImplementation(async (propertyId, floor, ceiling) => ({ propertyId, propertyName: property.name, floor, ceiling }));
});
afterEach(cleanup);

describe('Visual yield scenarios', () => {
  it('groups duplicate scenarios while retaining distinct limits, priorities and statuses', () => {
    const groups = groupYieldRules([rule, { ...rule, id: 2, propertyId: 83, adjustmentPct: -5 }, { ...rule, id: 3, priority: 2 },
      { ...rule, id: 4, active: false }, { ...rule, id: 5, maxDailyChangePct: 20 }]);
    expect(groups.map(group => group.length)).toEqual([2, 1, 1, 1]);
    expect(groups[0].map(item => item.id)).toEqual([1, 2]);
  });
  it('shows scenarios and guardrails for the selected property without writing on load', async () => {
    const { container } = render(<YieldRulesPanel property={property} currency="MAD" />);
    expect(await screen.findByText('Faible occupation')).toBeVisible();
    expect(screen.queryByText('Autre logement')).toBeNull();
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByText('Combler les nuits entre deux séjours')).toBeVisible();
    expect(screen.getByLabelText('Plancher (MAD)')).toHaveValue('80');
    expect(mocks.getJournal).toHaveBeenCalledWith({ page: 0, propertyId: 82 });
    expect(mocks.updateConfig).not.toHaveBeenCalled();
    expect(mocks.updatePropertyBounds).not.toHaveBeenCalled();
  });
  it('creates a rule in the page with the selected property scope', async () => {
    render(<YieldRulesPanel property={property} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une règle' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Dernières disponibilités' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
    await waitFor(() => expect(mocks.createRule).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 82, name: 'Dernières disponibilités', comparison: 'BELOW', adjustmentPct: 5 })));
  });
  it('keeps invalid bounds unsaved and supports clearing both limits', async () => {
    render(<YieldRulesPanel property={property} />);
    const floor = await screen.findByLabelText('Plancher (EUR)');
    const ceiling = screen.getByLabelText('Plafond (EUR)');
    fireEvent.change(floor, { target: { value: '300' } });
    expect(screen.getByRole('button', { name: 'Enregistrer les bornes' })).toBeDisabled();
    expect(mocks.updatePropertyBounds).not.toHaveBeenCalled();
    fireEvent.change(floor, { target: { value: '' } });
    fireEvent.change(ceiling, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les bornes' }));
    await waitFor(() => expect(mocks.updatePropertyBounds).toHaveBeenCalledWith(82, null, null));
  });
  it('saves mode changes through the existing organization configuration', async () => {
    render(<YieldRulesPanel property={property} />);
    fireEvent.click(await screen.findByRole('button', { name: /Suggestion/ }));
    await waitFor(() => expect(mocks.updateConfig).toHaveBeenCalledWith({ ...config, mode: 'SUGGEST' }));
  });
});
