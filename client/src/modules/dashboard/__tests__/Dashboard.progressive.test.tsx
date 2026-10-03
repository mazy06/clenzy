import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeferredDashboardWidget, DashboardWidgetState } from '../DashboardWidgetState';
import { DEFAULT_LAYOUT_ROWS } from '../dashboardDefaults';
import { mergeLayoutRows } from '../../../hooks/useDashboardLayout';
import DashboardWidgetGrid from '../DashboardWidgetGrid';
import RevenueByChannelCard from '../../../components/baitly/RevenueByChannelCard';

vi.mock('../../../components/baitly/Money', () => ({ Money: ({ value, from }: { value: number; from?: string }) => <span>{value} {from}</span> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('dashboard progressive rendering', () => {
  it('keeps expensive report hooks unmounted until the widget approaches the viewport', () => {
    let notify: IntersectionObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe() {}
      disconnect = disconnect;
    });
    const mounted = vi.fn();
    function Report() { mounted(); return <p>Report ready</p>; }
    render(<DeferredDashboardWidget title="Revenue"><Report /></DeferredDashboardWidget>);
    expect(mounted).not.toHaveBeenCalled();
    act(() => notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByText('Report ready')).toBeInTheDocument();
    expect(disconnect).toHaveBeenCalled();
  });

  it('shows an actionable error instead of a misleading empty state', () => {
    const retry = vi.fn();
    render(<DashboardWidgetState title="Revenue" error onRetry={retry} />);
    fireEvent.click(screen.getByRole('button'));
    expect(retry).toHaveBeenCalledOnce();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('does not save or normalize preferences while merely displaying a dashboard', () => {
    const save = vi.fn();
    render(<DashboardWidgetGrid widgets={[
      { id: 'a', label: 'A', node: <p>Alpha</p> },
      { id: 'b', label: 'B', node: <p>Beta</p> },
    ]} rows={[{ ids: ['a', 'b'], sizes: [65, 35] }]} editing={false} stacked={false}
      onRowSizes={save} onMoveNextTo={save} onMoveToOwnRow={save} onShiftWithinRow={save} onRemove={save} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="resizable-panel-group"]')).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps old imported widgets and widths when applying the lighter default', () => {
    const saved = { rows: [{ ids: ['revenue-by-channel', 'import:reports.revenue:channels'], sizes: [40, 60] }], hidden: ['kpis'] };
    const result = mergeLayoutRows(saved, DEFAULT_LAYOUT_ROWS.flat(), DEFAULT_LAYOUT_ROWS, { isImported: (id) => id.startsWith('import:') });
    expect(result[0]).toEqual(saved.rows[0]);
    expect(result.flatMap((row) => row.ids)).not.toContain('kpis');
    expect(DEFAULT_LAYOUT_ROWS.flat().filter((id) => id.startsWith('import:'))).toHaveLength(0);
  });

  it('lets users reveal every channel and keeps the source currency', () => {
    const channels = Array.from({ length: 8 }, (_, i) => ({ name: `Channel ${i}`, amount: 100 + i, pct: 12.5, color: 'var(--bui-primary)' }));
    render(<RevenueByChannelCard channels={channels} fromCurrency="EUR" />);
    expect(screen.queryByText('Channel 7')).toBeNull();
    expect(screen.getByText('100 EUR')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('Channel 7')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByText('Channel 7')).toBeNull();
  });
});
