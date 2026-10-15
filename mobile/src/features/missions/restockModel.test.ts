import { stockNumber, stockPrice, needsRestock } from './restockModel';
it('keeps items below or at a configured threshold and excludes healthy or untracked stock', () => {
  expect(needsRestock({ quantity: 2, threshold: 2 })).toBe(true);
  expect(needsRestock({ quantity: 1, threshold: 2 })).toBe(true);
  expect(needsRestock({ quantity: 3, threshold: 2 })).toBe(false);
  expect(needsRestock({ quantity: 0, threshold: 0 })).toBe(false);
});
it('accepts whole stock counts and explicit local decimal prices', () => {
  expect(stockNumber('12')).toBe(12); expect(stockNumber('1.5')).toBeNull(); expect(stockNumber('-1')).toBeNull();
  expect(stockPrice('2,45')).toBe(2.45); expect(stockPrice('0')).toBe(0);
  expect(stockPrice('')).toBeNull(); expect(stockPrice('1.234')).toBeNull();
});
