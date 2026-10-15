import { useBaitlyDataMode } from './baitlyDataMode';
import { useBaitlyDemoProfile, isBaitlyProfilePreview } from './baitlyDemoProfileState';
import { demoMissionsForProfile } from '@/features/missions/baitlyDemoMissions';
import { demoRequestsPage } from '@/features/marketplace/baitlyDemoRequests';
jest.mock('@/store/authStore', () => ({ useAuthStore: jest.fn() }));
import { baitlyDemoProfiles, demoProfileCapabilities } from './baitlyDemoProfiles';

it('gives the concierge a host role and business capabilities without an administrator role', () => {
  const concierge = baitlyDemoProfiles.find(profile => profile.key === 'concierge');
  expect(concierge).toMatchObject({ role: 'HOST', organizationType: 'CONCIERGE' });
  expect(baitlyDemoProfiles.every(profile => !['ADMIN', 'SUPER_ADMIN', 'SUPER_MANAGER', 'SUPERVISOR'].includes(profile.role))).toBe(true);
  useBaitlyDataMode.getState().setMode('demo');
  useBaitlyDemoProfile.getState().select('concierge');
  expect(demoProfileCapabilities()).toMatchObject({ canViewOwnerSpace: true, canManagePrivateNetwork: true });
});

afterEach(() => { useBaitlyDemoProfile.getState().select(null); useBaitlyDataMode.getState().setMode('real'); });
it('activates previews only in demo mode and immediately restores real mode', () => {
  useBaitlyDemoProfile.getState().select('laundry');
  useBaitlyDataMode.getState().setMode('demo');
  expect(isBaitlyProfilePreview()).toBe(true);
  useBaitlyDataMode.getState().setMode('real');
  expect(isBaitlyProfilePreview()).toBe(false);
});
it('shows trade-specific tasks and only that provider’s received requests', () => {
  useBaitlyDataMode.getState().setMode('demo');
  useBaitlyDemoProfile.getState().select('laundry');
  expect(demoMissionsForProfile('2026-10-12', 'laundry')[0].title).toBe('Collecte du linge');
  expect(demoRequestsPage('received').items.map(item => item.providerId)).toEqual([-5]);
  expect(demoRequestsPage('sent').items.length).toBe(6);
});
