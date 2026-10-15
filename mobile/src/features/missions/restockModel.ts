export function stockNumber(value: string): number | null {
  return /^\d{1,5}$/.test(value) && Number(value) <= 10000 ? Number(value) : null;
}
export function stockPrice(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(normalized) && Number(normalized) <= 100000 ? Number(normalized) : null;
}
export function needsRestock(item: { quantity: number; threshold: number }) {
  return item.threshold > 0 && item.quantity <= item.threshold;
}
