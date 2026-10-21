import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useNavigationMenu } from './useNavigationMenu';
import { useDocumentsFailedCount } from '../modules/documents/useDocumentsFailedCount';
import { useContactUnreadCount } from './useContactUnreadCount';

const access = vi.hoisted(() => {
  const state = { permissions: [] as string[], roles: ['SUPER_ADMIN'] };
  return { state, auth: {
    user: state,
    isAdmin: () => state.roles.includes('SUPER_ADMIN'),
    isManager: () => state.roles.includes('SUPER_MANAGER'),
    hasAnyRole: (roles: string[]) => roles.some(role => state.roles.includes(role)),
  } };
});
vi.mock('./useAuth', () => ({ useAuth: () => access.auth }));
vi.mock('../modules/supervision/useCanSuperviseAgents', () => ({ useCanSuperviseAgents: () => ({ canView: false }) }));
vi.mock('../modules/supervision/useSupervisionConfig', () => ({ useSupervisionConfig: () => ({ data: undefined }) }));
vi.mock('../modules/supervision/useSupervisionPendingCounts', () => ({ useSupervisionPendingCounts: () => ({ total: 0 }) }));
vi.mock('../modules/documents/useDocumentsFailedCount', () => ({ useDocumentsFailedCount: vi.fn(() => 3) }));
vi.mock('./useContactUnreadCount', () => ({ useContactUnreadCount: vi.fn(() => 7) }));

beforeEach(() => {
  vi.clearAllMocks();
  access.state.roles = ['SUPER_ADMIN'];
  access.state.permissions = ['contact:view', 'teams:view', 'documents:view', 'payments:view', 'payments:manage', 'tarification:view'];
});
afterEach(cleanup);

it('promotes management screens with their routes, icons and badges, without parent groups', async () => {
  const { result } = renderHook(() => useNavigationMenu());
  await waitFor(() => expect(result.current.menuItems.some(item => item.path === '/billing')).toBe(true));
  const management = result.current.menuItems.filter(item => item.group === 'management');
  expect(management.map(item => item.path)).toEqual(['/contact', '/directory', '/documents', '/contracts', '/billing', '/tarification']);
  expect(management.every(item => !item.children?.length && item.icon != null)).toBe(true);
  expect(management.find(item => item.path === '/billing')?.matchPaths).toContain('/payments');
  expect(management.find(item => item.path === '/contact')?.badge).toBe(7);
  expect(management.find(item => item.path === '/documents')?.badge).toBe(3);
  expect(management.find(item => item.path === '/directory')?.badge).toBeUndefined();
  expect(management.some(item => item.id.startsWith('hub:'))).toBe(false);
});

it('keeps each promoted screen permission and disables hidden counters', async () => {
  access.state.permissions = ['payments:view'];
  const { result } = renderHook(() => useNavigationMenu());
  await waitFor(() => expect(result.current.menuItems.some(item => item.path === '/billing')).toBe(true));
  expect(result.current.menuItems.filter(item => item.group === 'management').map(item => item.path)).toEqual(['/billing']);
  expect(useDocumentsFailedCount).toHaveBeenLastCalledWith(false);
  expect(useContactUnreadCount).toHaveBeenLastCalledWith(false);
});

it('retains messaging for a field worker without exposing management screens', async () => {
  access.state.roles = ['TECHNICIAN'];
  const { result } = renderHook(() => useNavigationMenu());
  await waitFor(() => expect(result.current.menuItems.some(item => item.path === '/contact')).toBe(true));
  expect(result.current.menuItems.filter(item => item.group === 'management').map(item => item.path)).toEqual(['/contact']);
});
