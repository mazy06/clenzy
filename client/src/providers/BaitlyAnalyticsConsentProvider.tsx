import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getBaitlyAnalyticsActor, setBaitlyAnalyticsConsent, subscribeBaitlyAnalytics } from '../services/baitlyAnalytics';
import type { BaitlyAnalyticsActor } from '../services/baitlyTelemetryPrivacy';
import { userUiPreferencesApi } from '../services/api/userUiPreferencesApi';
import { hasPendingAnalyticsWithdrawal, setPendingAnalyticsWithdrawal, STORAGE_KEYS } from '../services/storageService';

// Ownership is enforced by the existing JWT-scoped preferences API.
export const analyticsConsentKey = (actor: BaitlyAnalyticsActor) => `privacy.analytics.v1.${actor.organization}`;
const scopeOf = (actor: BaitlyAnalyticsActor) => `${actor.id}:${actor.organization}`;
export function analyticsConsentRecord(actor: BaitlyAnalyticsActor, granted: boolean) {
  return { version: 1, granted, userRef: actor.id, organizationRef: actor.organization, updatedAt: new Date().toISOString() };
}
export function isAnalyticsConsentGranted(value: unknown, actor: BaitlyAnalyticsActor): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as ReturnType<typeof analyticsConsentRecord>;
  return record.version === 1 && record.granted === true && record.userRef === actor.id
    && record.organizationRef === actor.organization && typeof record.updatedAt === 'string'
    && Number.isFinite(Date.parse(record.updatedAt));
}

type State = { actor?: BaitlyAnalyticsActor; granted: boolean; busy: boolean; error: 'load' | 'save' | 'withdraw' | null };
type Consent = Omit<State, 'actor'> & { available: boolean; change: (granted: boolean) => Promise<void>; retry: () => void };
const Context = createContext<Consent | null>(null);

/** Restores backend consent on every screen, independently of visiting Settings. */
export function BaitlyAnalyticsConsentProvider({ children }: { children: React.ReactNode }) {
  const actor = useSyncExternalStore(subscribeBaitlyAnalytics, getBaitlyAnalyticsActor, () => undefined);
  const [state, setState] = useState<State>({ granted: false, busy: true, error: null });
  const sequence = useRef(0);
  const saving = useRef(false);
  const refreshAfterSave = useRef(false);
  const denied = useRef(new Set<string>());
  const current = (who: BaitlyAnalyticsActor, request: number) => getBaitlyAnalyticsActor() === who && sequence.current === request;

  const refresh = useCallback(async () => {
    if (!actor || getBaitlyAnalyticsActor() !== actor) return;
    if (saving.current) {
      refreshAfterSave.current = true;
      return;
    }
    const request = ++sequence.current;
    const scope = scopeOf(actor);
    setBaitlyAnalyticsConsent(false);
    setState({ actor, granted: false, busy: true, error: null });
    try {
      if (denied.current.has(scope) || hasPendingAnalyticsWithdrawal(scope)) {
        denied.current.add(scope);
        const response = await userUiPreferencesApi.upsert(analyticsConsentKey(actor), analyticsConsentRecord(actor, false));
        if (!current(actor, request)) return;
        if (response.key !== analyticsConsentKey(actor) || response.value?.granted !== false) throw new Error('Invalid withdrawal acknowledgement');
        setPendingAnalyticsWithdrawal(scope, false);
        denied.current.delete(scope);
        setState({ actor, granted: false, busy: false, error: null });
        return;
      }
      const preferences = await userUiPreferencesApi.list();
      if (!current(actor, request)) return;
      const granted = isAnalyticsConsentGranted(preferences[analyticsConsentKey(actor)], actor);
      setState({ actor, granted, busy: false, error: null });
      setBaitlyAnalyticsConsent(granted);
    } catch {
      if (current(actor, request)) setState({ actor, granted: false, busy: false,
        error: denied.current.has(scope) ? 'withdraw' : 'load' });
    }
  }, [actor]);

  useEffect(() => {
    saving.current = false;
    refreshAfterSave.current = false;
    void refresh();
    const reload = () => { void refresh(); };
    const withdrawalInAnotherTab = (event: StorageEvent) => {
      if (!actor || event.key !== STORAGE_KEYS.ANALYTICS_WITHDRAWALS) return;
      const scope = scopeOf(actor);
      let observedRefusal = false;
      try { observedRefusal = JSON.parse(event.newValue || '{}')?.[scope] === true; }
      catch { observedRefusal = true; }
      // The sending tab may already have cleared its outbox after an API acknowledgement.
      if (!observedRefusal && !hasPendingAnalyticsWithdrawal(scope)) return;
      denied.current.add(scope);
      setBaitlyAnalyticsConsent(false);
      setState({ actor, granted: false, busy: true, error: null });
      void refresh();
    };
    window.addEventListener('focus', reload);
    window.addEventListener('online', reload);
    window.addEventListener('storage', withdrawalInAnotherTab);
    return () => {
      sequence.current++;
      setBaitlyAnalyticsConsent(false);
      window.removeEventListener('focus', reload);
      window.removeEventListener('online', reload);
      window.removeEventListener('storage', withdrawalInAnotherTab);
    };
  }, [refresh]);

  const change = async (granted: boolean) => {
    if (!actor || getBaitlyAnalyticsActor() !== actor || saving.current) return;
    const request = ++sequence.current;
    const scope = scopeOf(actor);
    saving.current = true;
    // Revoke before network work. Failed withdrawal must never roll back to granted.
    setBaitlyAnalyticsConsent(false);
    if (!granted) {
      denied.current.add(scope);
      setPendingAnalyticsWithdrawal(scope, true);
    }
    setState({ actor, granted: false, busy: true, error: null });
    try {
      const response = await userUiPreferencesApi.upsert(analyticsConsentKey(actor), analyticsConsentRecord(actor, granted));
      if (!current(actor, request)) return;
      if (response.key !== analyticsConsentKey(actor) || (granted && !isAnalyticsConsentGranted(response.value, actor))
        || (!granted && response.value?.granted !== false)) throw new Error('Invalid consent acknowledgement');
      // Another tab may withdraw while this grant's request is still in flight.
      // Preserve its refusal and reassert it when the request has settled.
      if (granted && denied.current.has(scope)) {
        refreshAfterSave.current = true;
        return;
      }
      denied.current.delete(scope);
      setPendingAnalyticsWithdrawal(scope, false);
      setState({ actor, granted, busy: false, error: null });
      setBaitlyAnalyticsConsent(granted);
    } catch {
      if (current(actor, request)) setState({ actor, granted: false, busy: false, error: granted ? 'save' : 'withdraw' });
    } finally {
      if (current(actor, request)) {
        saving.current = false;
        if (refreshAfterSave.current) {
          refreshAfterSave.current = false;
          void refresh();
        }
      }
    }
  };

  const visible = state.actor === actor && actor ? state : { granted: false, busy: true, error: null };
  return <Context.Provider value={{ ...visible, available: !!actor, change, retry: () => { void refresh(); } }}>{children}</Context.Provider>;
}

export function useBaitlyAnalyticsConsent(): Consent {
  const context = useContext(Context);
  if (!context) throw new Error('Baitly analytics consent provider is required');
  return context;
}
