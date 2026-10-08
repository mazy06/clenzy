// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BaitlyVerifyPayment from './BaitlyVerifyPayment';
import { paymentsApi } from '../../services/api/paymentsApi';
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../services/api/paymentsApi', () => ({ paymentsApi: { getSessionStatus: vi.fn() } }));
vi.mock('../../components/ui', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>, Spinner: () => <span />,
  Tooltip: ({ children }: any) => <>{children}</>, TooltipTrigger: ({ children }: any) => children, TooltipContent: () => null,
}));
afterEach(() => { cleanup();vi.clearAllMocks(); });
it('checks once while pending, refreshes only after the response', async () => {
  let resolve!: (value: any) => void;
  vi.mocked(paymentsApi.getSessionStatus).mockReturnValue(new Promise(r => { resolve=r; }));
  const refreshed=vi.fn();render(<BaitlyVerifyPayment session="cs_test_history" onVerified={refreshed} />);
  fireEvent.click(screen.getByRole('button'));fireEvent.click(screen.getByRole('button'));
  expect(paymentsApi.getSessionStatus).toHaveBeenCalledTimes(1);expect(refreshed).not.toHaveBeenCalled();
  resolve({ paymentStatus:'PAID' });await waitFor(()=>expect(refreshed).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('status').textContent).toContain('confirmed');
});
it('keeps an unavailable proof in review and never treats it as failure of payment', async () => {
  vi.mocked(paymentsApi.getSessionStatus).mockRejectedValue(new Error('404'));
  const refreshed=vi.fn();render(<BaitlyVerifyPayment session="cs_old" onVerified={refreshed} />);
  fireEvent.click(screen.getByRole('button'));await screen.findByRole('alert');expect(refreshed).not.toHaveBeenCalled();
});
it('ignores an answer after switching dossiers', async () => {
  let resolve!: (value: any) => void;
  vi.mocked(paymentsApi.getSessionStatus).mockReturnValue(new Promise(r=>{resolve=r;}));
  const refreshed=vi.fn();const view=render(<BaitlyVerifyPayment session="cs_old" onVerified={refreshed} />);
  fireEvent.click(screen.getByRole('button'));view.rerender(<BaitlyVerifyPayment session="cs_new" onVerified={refreshed} />);
  resolve({ paymentStatus:'PAID' });await waitFor(()=>expect(screen.queryByRole('status')).toBeNull());expect(refreshed).not.toHaveBeenCalled();
});
