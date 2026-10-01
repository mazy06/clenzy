import { useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CurrencyDisplayProvider } from '../../src/hooks/currencyDisplayContext';
import { formatCurrency } from '../../src/utils/currencyUtils';
import {
  CURRENCY_NAMES,
  DEMO_CURRENCY_RATIOS,
  convertDemoMoney,
  useSiteCurrency,
} from '../lib/siteCurrency';
import { useSiteLanguage } from '../lib/siteLanguage';
import SiteMoney from './SiteMoney';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export default function ProjectionRuntime({
  children,
}: {
  children: ReactNode;
}) {
  const { currency: selected, select } = useSiteCurrency();
  const { language } = useSiteLanguage();
  const currency = selected ?? 'MAD';
  // Read-only fixture data; never reads or writes a visitor's PMS preferences.
  const value = useMemo(
    () => ({
      currency,
      setCurrency: select,
      currencySymbol: currency,
      currencyLabel: CURRENCY_NAMES[language][currency],
      convert: (amount: number) => convertDemoMoney(amount, 'MAD', currency),
      convertAndFormat: (amount: number | null | undefined) =>
        amount == null
          ? '—'
          : formatCurrency(convertDemoMoney(amount, 'MAD', currency), currency),
      renderAmount: (
        amount: number,
        options: { decimals?: number; symbolSize?: number },
      ) => (
        <SiteMoney
          value={amount}
          from="MAD"
          currency={currency}
          decimals={options.decimals}
          size={options.symbolSize}
        />
      ),
      isConverting: currency !== 'MAD',
      rateDate: null,
      rates: DEMO_CURRENCY_RATIOS,
      ratesLoading: false,
    }),
    [currency, language, select],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyDisplayProvider value={value}>
        {children}
      </CurrencyDisplayProvider>
    </QueryClientProvider>
  );
}
