import { describe, expect, it } from 'vitest';
import { financeAmountGroups, sumFinanceAmounts } from './financeAmounts';

it('combines partial refunds of stays and missions without counting customer credit as cash', () => {
  const groups=financeAmountGroups([
    { status:'PARTIALLY_REFUNDED', amount:35, refundedAmount:5, currency:'EUR' },
    { status:'PARTIALLY_REFUNDED', amount:200, creditAppliedAmount:20, refundedAmount:100, currency:'EUR' },
  ],'payments');
  expect(groups.find(g=>g.key==='done')?.totals).toEqual([['EUR',110]]);
  expect(groups.find(g=>g.key==='pending')?.count).toBe(0);
});

describe('Finance monetary indicators', () => {
  it('keeps a retained expense outstanding until the provider transfer is confirmed', () => {
    const groups = financeAmountGroups([
      { status: 'INCLUDED', amount: 5, currency: 'EUR' },
      { status: 'APPROVED', amount: 12, currency: 'EUR' },
      { status: 'PAID', amount: 7, currency: 'EUR' },
    ], 'expenses');
    expect(groups.find(g => g.key === 'pending')?.totals).toEqual([['EUR', 17]]);
    expect(groups.find(g => g.key === 'done')?.totals).toEqual([['EUR', 7]]);
  });
  it('counts only the retained amount of a partial refund as paid and never as a pending debt', () => {
    const groups = financeAmountGroups([{ status: 'PARTIALLY_REFUNDED', amount: 35, refundedAmount: 5, currency: 'EUR' }], 'payments');
    expect(groups.find(g => g.key === 'done')?.totals).toEqual([['EUR', 30]]);
    expect(groups.find(g => g.key === 'all')?.totals).toEqual([['EUR', 30]]);
    expect(groups.find(g => g.key === 'pending')?.count).toBe(0);
    const unknown = financeAmountGroups([{ status: 'PARTIALLY_REFUNDED', amount: 35, currency: 'EUR' }], 'payments');
    expect(unknown.find(g => g.key === 'done')?.unavailable).toBe(1);
  });
  it('never adds currencies together and sums minor units exactly', () => {
    expect(sumFinanceAmounts([
      { status: 'PAID', amount: .1, currency: 'EUR' }, { status: 'PAID', amount: .2, currency: 'eur' },
      { status: 'PAID', amount: 500, currency: 'MAD' }, { status: 'PAID', amount: 120, currency: 'SAR' },
    ]).totals).toEqual([['EUR', .3], ['MAD', 500], ['SAR', 120]]);
  });
  it('uses net outstanding amounts without inventing a partial payment balance', () => {
    const groups = financeAmountGroups([
      { status: 'PENDING', amount: 100, dueAmount: 60, currency: 'EUR' },
      { status: 'PARTIALLY_PAID', amount: 100, currency: 'EUR' },
      { status: 'PARTIALLY_PAID', amount: 100, dueAmount: 0, currency: 'EUR' },
      { status: 'UNKNOWN', amount: 500, currency: 'MAD' },
    ], 'payments');
    expect(groups[1]).toMatchObject({ count: 3, totals: [['EUR', 60]], unavailable: 1 });
    expect(groups.find(group => group.key === 'review')?.totals).toEqual([['MAD', 500]]);
  });
  it('does not call an approved payout paid, and interprets SENT by document type', () => {
    const records = [{ status: 'APPROVED', amount: 90, currency: 'EUR' }, { status: 'SENT', amount: 80, currency: 'EUR' }];
    expect(financeAmountGroups(records, 'payouts')[1].totals).toEqual([['EUR', 90]]);
    expect(financeAmountGroups(records, 'payouts')[2].totals).toEqual([['EUR', 80]]);
    expect(financeAmountGroups(records, 'invoices')[1].totals).toEqual([['EUR', 170]]);
    expect(financeAmountGroups(records, 'invoices')[2].totals).toEqual([['EUR', 0]]);
  });
  it('excludes cancelled, refunded, credit-note and not-required amounts from active volume', () => {
    const records = ['CANCELLED', 'REFUNDED', 'CREDIT_NOTE', 'NOT_REQUIRED'].map(status => ({ status, amount: 100, currency: 'EUR' }));
    expect(financeAmountGroups(records, 'payments').every(group => group.count === 0 && group.totals.length === 0)).toBe(true);
  });
  it('keeps missing or non-finite amounts distinct from a genuine zero', () => {
    expect(sumFinanceAmounts([
      { status: 'PAID', amount: NaN, currency: 'EUR' }, { status: 'PAID', amount: undefined, currency: 'EUR' },
      { status: 'PAID', amount: 42, currency: '' }, { status: 'PAID', amount: 0, currency: 'EUR' },
    ])).toEqual({ totals: [['EUR', 0]], unavailable: 3 });
  });
  it('counts only confirmed OTA payments in their KPI, not pending or uncertain amounts', () => {
    const groups = financeAmountGroups([
      { status: 'PAID', amount: 100, currency: 'EUR', paidToOta: true },
      { status: 'PAID', amount: 25, currency: 'EUR' },
      { status: 'UNKNOWN', amount: 500, currency: 'MAD', paidToOta: true },
      { status: 'REFUNDED', amount: 60, currency: 'EUR', paidToOta: true },
    ], 'payments');
    expect(groups.find(group => group.key === 'ota')).toMatchObject({ count: 1, totals: [['EUR', 100]] });
    expect(groups.find(group => group.key === 'done')?.totals).toEqual([['EUR', 125]]);
  });
});
