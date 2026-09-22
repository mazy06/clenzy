import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BaitlyTurnstile from './BaitlyTurnstile';

describe('Baitly Turnstile token lifecycle', () => {
  let options: Record<string, unknown>;
  beforeEach(() => {
    window.turnstile = {
      render: vi.fn((_element, value) => { options = value; return 'widget'; }),
      remove: vi.fn(),
    };
  });
  afterEach(() => { delete window.turnstile; });

  it('clears expired tokens, uses an explicit action and retries without submitting the form', async () => {
    const onToken = vi.fn();
    render(<BaitlyTurnstile siteKey="public-key" action="login" onToken={onToken} />);
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledOnce());
    expect(options.action).toBe('login');
    act(() => (options.callback as (token: string) => void)('one-use-token'));
    expect(onToken).toHaveBeenLastCalledWith('one-use-token');
    act(() => (options['expired-callback'] as () => void)());
    expect(onToken).toHaveBeenLastCalledWith(null);
    const retry = screen.getByRole('button', { name: 'Relancer la vérification' });
    expect(retry.getAttribute('type')).toBe('button');
    fireEvent.click(retry);
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledTimes(2));
    expect(window.turnstile?.remove).toHaveBeenCalledWith('widget');
  });

  it('does not remount on callback changes and ignores callbacks after unmount', async () => {
    const first = vi.fn();
    const next = vi.fn();
    const view = render(<BaitlyTurnstile siteKey="key" action="login" onToken={first} />);
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledOnce());
    view.rerender(<BaitlyTurnstile siteKey="key" action="login" onToken={next} />);
    act(() => (options.callback as (token: string) => void)('fresh'));
    expect(next).toHaveBeenLastCalledWith('fresh');
    expect(window.turnstile?.render).toHaveBeenCalledOnce();
    view.unmount();
    next.mockClear();
    act(() => (options.callback as (token: string) => void)('stale'));
    expect(next).not.toHaveBeenCalled();
  });

  it('invalidates a consumed token before a new attempt', async () => {
    const onToken = vi.fn();
    const view = render(<BaitlyTurnstile siteKey="key" action="marketplace-application" resetKey={0} onToken={onToken} />);
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledOnce());
    act(() => (options.callback as (token: string) => void)('consumed'));
    view.rerender(<BaitlyTurnstile siteKey="key" action="marketplace-application" resetKey={1} onToken={onToken} />);
    expect(onToken).toHaveBeenLastCalledWith(null);
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledTimes(2));
  });

  it('keeps submission unverified when the public key is missing', () => {
    const onToken = vi.fn();
    render(<BaitlyTurnstile siteKey="" action="login" onToken={onToken} />);
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(window.turnstile?.render).not.toHaveBeenCalled();
  });
});
