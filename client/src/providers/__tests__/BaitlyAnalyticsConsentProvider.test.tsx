import React from 'react';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ actor: undefined as any, listeners: new Set<() => void>(), consent: vi.fn(), list: vi.fn(), upsert: vi.fn() }));
vi.mock('../../services/baitlyAnalytics', () => ({
  getBaitlyAnalyticsActor: () => mocks.actor,
  subscribeBaitlyAnalytics: (listener: () => void) => { mocks.listeners.add(listener); return () => mocks.listeners.delete(listener); },
  setBaitlyAnalyticsConsent: mocks.consent,
}));
vi.mock('../../services/api/userUiPreferencesApi', () => ({ userUiPreferencesApi: { list: mocks.list, upsert: mocks.upsert } }));
import { BaitlyAnalyticsConsentProvider, analyticsConsentKey, analyticsConsentRecord, isAnalyticsConsentGranted, useBaitlyAnalyticsConsent } from '../BaitlyAnalyticsConsentProvider';
import { hasPendingAnalyticsWithdrawal } from '../../services/storageService';
import AnalyticsConsentSection from '../../modules/settings/AnalyticsConsentSection';
const first = { id: `bt_${'a'.repeat(64)}`, organization: `bt_${'b'.repeat(64)}` };
const second = { id: `bt_${'c'.repeat(64)}`, organization: `bt_${'d'.repeat(64)}` };
const wrapper = ({ children }: { children: React.ReactNode }) => <BaitlyAnalyticsConsentProvider>{children}</BaitlyAnalyticsConsentProvider>;
const mount = () => renderHook(() => useBaitlyAnalyticsConsent(), { wrapper });
const switchActor = (actor: any) => act(() => { mocks.actor = actor; mocks.listeners.forEach(listener => listener()); });

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); mocks.actor = first;
  mocks.list.mockResolvedValue({});
  mocks.upsert.mockImplementation(async (key, value) => ({ key, value }));
});

describe('Backend-persisted analytics consent', () => {
  it('defaults to refusal and rejects bare booleans, obsolete versions and another actor', async () => {
    mocks.list.mockResolvedValue({ [analyticsConsentKey(first)]: true });
    const { result } = mount();
    expect(result.current.granted).toBe(false);
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(mocks.consent).not.toHaveBeenCalledWith(true);
    expect(isAnalyticsConsentGranted(analyticsConsentRecord(second, true), first)).toBe(false);
    expect(isAnalyticsConsentGranted(analyticsConsentRecord({ ...first, id: second.id }, true), first)).toBe(false);
    expect(isAnalyticsConsentGranted({ ...analyticsConsentRecord(first, true), version: 0 }, first)).toBe(false);
  });

  it('restores a saved choice on startup without visiting Settings', async () => {
    mocks.list.mockResolvedValue({ [analyticsConsentKey(first)]: analyticsConsentRecord(first, true) });
    const { result } = mount();
    await waitFor(() => expect(result.current.granted).toBe(true));
    expect(mocks.consent).toHaveBeenLastCalledWith(true);
  });

  it('waits for grant acknowledgement and remains off on save failure', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.busy).toBe(false));
    let reject!: (reason: unknown) => void;
    mocks.upsert.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    let save!: Promise<void>;
    act(() => { save = result.current.change(true); });
    expect(result.current.granted).toBe(false);
    expect(mocks.consent).not.toHaveBeenCalledWith(true);
    await act(async () => { reject(new Error('offline')); await save; });
    expect(result.current.error).toBe('save');
    expect(mocks.consent).toHaveBeenLastCalledWith(false);
  });

  it('saves an explicit choice bound to the user and organization before enabling', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.busy).toBe(false));
    await act(async () => result.current.change(true));
    expect(mocks.upsert).toHaveBeenCalledWith(analyticsConsentKey(first), expect.objectContaining({ version: 1, granted: true, userRef: first.id, organizationRef: first.organization }));
    expect(result.current.granted).toBe(true);
  });

  it('withdraws immediately, never rolls back on failure, and retries after reload', async () => {
    mocks.list.mockResolvedValue({ [analyticsConsentKey(first)]: analyticsConsentRecord(first, true) });
    const hook = mount();
    await waitFor(() => expect(hook.result.current.granted).toBe(true));
    let reject!: (reason: unknown) => void;
    mocks.upsert.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    let save!: Promise<void>;
    act(() => { save = hook.result.current.change(false); });
    expect(mocks.consent).toHaveBeenLastCalledWith(false);
    expect(hook.result.current.granted).toBe(false);
    await act(async () => { reject(new Error('offline')); await save; });
    expect(hook.result.current.error).toBe('withdraw');
    expect(hasPendingAnalyticsWithdrawal(`${first.id}:${first.organization}`)).toBe(true);
    hook.unmount(); mocks.consent.mockClear();
    const next = mount();
    await waitFor(() => expect(next.result.current.busy).toBe(false));
    expect(next.result.current.granted).toBe(false);
    expect(mocks.consent).not.toHaveBeenCalledWith(true);
    expect(mocks.upsert).toHaveBeenLastCalledWith(analyticsConsentKey(first), expect.objectContaining({ granted: false }));
    expect(hasPendingAnalyticsWithdrawal(`${first.id}:${first.organization}`)).toBe(false);
  });

  it('ignores an old grant acknowledgement after an account switch and clears on logout', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.busy).toBe(false));
    let resolve!: (value: any) => void;
    mocks.upsert.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    let save!: Promise<void>;
    act(() => { save = result.current.change(true); });
    switchActor(second);
    await waitFor(() => expect(result.current.busy).toBe(false));
    await act(async () => { resolve({ key: analyticsConsentKey(first), value: analyticsConsentRecord(first, true) }); await save; });
    expect(result.current.granted).toBe(false);
    expect(mocks.consent).not.toHaveBeenCalledWith(true);
    switchActor(undefined);
    expect(result.current.available).toBe(false);
    expect(mocks.consent).toHaveBeenLastCalledWith(false);
  });

  it('fails closed on backend error and refreshes other-device withdrawal on focus', async () => {
    mocks.list.mockRejectedValueOnce(new Error('offline'));
    const { result } = mount();
    await waitFor(() => expect(result.current.error).toBe('load'));
    mocks.list.mockResolvedValueOnce({ [analyticsConsentKey(first)]: analyticsConsentRecord(first, true) });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.granted).toBe(true));
    mocks.list.mockResolvedValueOnce({ [analyticsConsentKey(first)]: analyticsConsentRecord(first, false) });
    act(() => window.dispatchEvent(new Event('focus')));
    expect(mocks.consent).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.granted).toBe(false);
  });

  it('exposes an accessible Settings switch for both granting and withdrawing', async () => {
    const view = render(<BaitlyAnalyticsConsentProvider><AnalyticsConsentSection /></BaitlyAnalyticsConsentProvider>);
    const toggle = view.getByRole('switch', { name: /Partager des statistiques/ });
    await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(toggle);
    expect(mocks.consent).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(mocks.upsert).toHaveBeenLastCalledWith(analyticsConsentKey(first), expect.objectContaining({ granted: false }));
  });

  it('does not restore an in-flight stale read after a withdrawal', async () => {
    let resolve!: (value: any) => void;
    mocks.list.mockReturnValue(new Promise(done => { resolve = done; }));
    const { result } = mount();
    await act(async () => result.current.change(false));
    await act(async () => resolve({ [analyticsConsentKey(first)]: analyticsConsentRecord(first, true) }));
    expect(result.current.granted).toBe(false);
    expect(mocks.consent).not.toHaveBeenCalledWith(true);
  });
});
