import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useOnboarding } from '../useOnboarding';
import onboardingApi, { type OnboardingStatus } from '../../services/api/onboardingApi';
import { getOnboardingSteps } from '../../config/onboardingConfig';

vi.mock('../useAuth', () => ({ useAuth: () => ({ user: { roles: ['HOST'] } }) }));
vi.mock('../../services/api/onboardingApi', () => ({
  default: { getMyStatus: vi.fn(), completeStep: vi.fn(), dismiss: vi.fn(), reset: vi.fn() },
}));

describe('optional PMS migration onboarding', () => {
  it.each(['SUPER_ADMIN', 'SUPER_MANAGER'])('does not block %s on a legacy personal payout step', async role => {
    vi.mocked(onboardingApi.getMyStatus).mockResolvedValue({ role, dismissed: false,
      steps: [
        ...getOnboardingSteps(role).map(step => ({ key: step.key, completed: true, completedAt: null })),
        { key: 'setup_payment', completed: false, completedAt: null },
      ] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const hook = renderHook(useOnboarding, { wrapper });
    await waitFor(() => expect(hook.result.current.isAllCompleted).toBe(true));
    expect(hook.result.current.totalCount).toBe(8);
    expect(hook.result.current.completedCount).toBe(8);
    expect(hook.result.current.activeStep).toBeNull();
    expect(hook.result.current.steps.some(step => step.key === 'setup_payment')).toBe(false);
    hook.unmount(); client.clear();
  });

  it.each(['HOST', 'PROPERTY_OWNER', 'HOUSEKEEPER', 'TECHNICIAN', 'SUPERVISOR', 'LAUNDRY', 'EXTERIOR_TECH'])(
    'keeps beneficiary payout setup required for %s', role => {
      const step = getOnboardingSteps(role).find(step => ['setup_payouts', 'setup_payout_account'].includes(step.key));
      expect(step).toBeDefined();
      expect(step?.skippable).not.toBe(true);
    },
  );

  it('uses the server role to keep multi-role users on the same progression', async () => {
    vi.mocked(onboardingApi.getMyStatus).mockResolvedValue({ role: 'PROPERTY_OWNER', dismissed: false,
      steps: getOnboardingSteps('PROPERTY_OWNER').map(step => ({ key: step.key, completed: false, completedAt: null })) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const hook = renderHook(useOnboarding, { wrapper });
    await waitFor(() => expect(hook.result.current.totalCount).toBe(3));
    expect(hook.result.current.steps.map(step => step.key)).toEqual(['complete_profile', 'setup_payouts', 'setup_notifications']);
    hook.unmount(); client.clear();
  });
  it('unlocks property setup after skipping migration and keeps that choice on remount', async () => {
    let status: OnboardingStatus = {
      role: 'HOST', dismissed: false,
      steps: getOnboardingSteps('HOST').map(step => ({
        key: step.key, completed: step.key === 'complete_profile', completedAt: null,
      })),
    };
    vi.mocked(onboardingApi.getMyStatus).mockImplementation(async () => status);
    vi.mocked(onboardingApi.completeStep).mockImplementation(async key => {
      status = { ...status, steps: status.steps.map(step =>
        step.key === key ? { ...step, completed: true } : step) };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const first = renderHook(useOnboarding, { wrapper });
    await waitFor(() => expect(first.result.current.activeStep?.key).toBe('migrate_pms'));
    expect(first.result.current.activeStep?.skippable).toBe(true);
    act(() => first.result.current.completeStep('migrate_pms'));
    await waitFor(() => expect(first.result.current.activeStep?.key).toBe('create_property'));
    first.unmount();
    client.clear();
    const reloaded = renderHook(useOnboarding, { wrapper });
    await waitFor(() => expect(reloaded.result.current.activeStep?.key).toBe('create_property'));
    expect(reloaded.result.current.steps.find(step => step.key === 'migrate_pms')?.completed).toBe(true);
    reloaded.unmount();
    client.clear();
  });

  it.each(['HOST', 'SUPER_ADMIN', 'SUPER_MANAGER'])('offers migration early and optionally for %s', role => {
    const step = getOnboardingSteps(role)[1];
    expect(step).toMatchObject({ key: 'migrate_pms', skippable: true, navigationPath: '/settings?tab=migration' });
  });

  it.each(['HOUSEKEEPER', 'TECHNICIAN', 'SUPERVISOR', 'LAUNDRY', 'EXTERIOR_TECH'])('does not offer migration to %s', role => {
    expect(getOnboardingSteps(role).some(step => step.key === 'migrate_pms')).toBe(false);
  });
});
