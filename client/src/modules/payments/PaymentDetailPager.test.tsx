import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PaymentDetailPager from './PaymentDetailPager';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Pagination du détail sans défilement', () => {
  it('keeps every item reachable and recalculates pages when the available height changes', () => {
    let availableHeight = 110;
    let resized = () => {};
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('payment-detail-pager__body') ? availableHeight : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ height: 50 } as DOMRect));
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resized = callback; }
      observe() {}
      disconnect() {}
    });
    render(<PaymentDetailPager items={['Photo avant', 'Photo après', 'Justificatif'].map(label => <button>{label}</button>)} />);
    expect(screen.getByRole('button', { name: 'Photo avant' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Photo après' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Justificatif' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Go to next page' }));
    expect(screen.getByRole('button', { name: 'Justificatif' })).toBeVisible();
    expect(screen.getByText('Photo avant').parentElement?.inert).toBe(true);
    availableHeight = 180;
    act(() => resized());
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('link', { name: '1 / 1' })).toBeVisible();
  });
});
