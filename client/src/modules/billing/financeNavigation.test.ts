import { expect, it } from 'vitest';
import { canonicalFinanceParams } from './financeNavigation';
import { canViewFinanceLedger, canViewFinanceReports } from '../../config/screenTabs';

it.each([
  ['housekeeper-payouts', 'payouts', 'providers'],
  ['payout-tracking', 'payouts', 'tracking'],
  ['wallets', 'reports', 'ledger'],
])('keeps legacy %s links and their selected record usable', (oldTab, tab, view) => {
  const original = new URLSearchParams({ tab: oldTab, highlight: '31', ownerId: '4' });
  const next = canonicalFinanceParams(original);
  expect(Object.fromEntries(next)).toEqual({ tab, view, highlight: '31', ownerId: '4' });
  expect(original.get('tab')).toBe(oldTab);
});

it('preserves independent permissions for reports and the financial ledger', () => {
  expect(canViewFinanceReports({ roles: ['SUPER_MANAGER'], permissions: [] })).toBe(true);
  expect(canViewFinanceLedger({ roles: ['SUPER_MANAGER'], permissions: [] })).toBe(false);
  expect(canViewFinanceReports({ roles: ['OWNER'], permissions: ['payments:manage'] })).toBe(false);
  expect(canViewFinanceLedger({ roles: ['OWNER'], permissions: ['payments:manage'] })).toBe(true);
  expect(canViewFinanceLedger({ roles: ['OWNER'], permissions: ['payments:view'] })).toBe(false);
});
