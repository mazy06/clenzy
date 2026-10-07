/** Preserve financial deep links, including their filters and highlighted record. */
export function canonicalFinanceParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  const aliases: Record<string, [string, string]> = {
    'housekeeper-payouts': ['payouts', 'providers'],
    'payout-tracking': ['payouts', 'tracking'],
    wallets: ['reports', 'ledger'],
  };
  const alias = aliases[next.get('tab') ?? ''];
  if (alias) { next.set('tab', alias[0]); next.set('view', alias[1]); }
  return next;
}
