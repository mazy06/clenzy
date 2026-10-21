import { Filter } from '../../icons/glyphs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import type { BaitlyQuoteView } from '../../hooks/useBaitlyQuotes';
import { quoteInboxMessages } from './baitlyQuoteInboxMessages';

/** Un seul contrôle de statut, porté par le header et son repli responsive. */
export default function BaitlyQuoteStatusFilter({ value, onChange, audience = 'customer' }: { value: BaitlyQuoteView; onChange: (value: BaitlyQuoteView) => void; audience?: 'customer' | 'provider' }) {
  const { t, currentLanguage } = useTranslation();
  const copy = quoteInboxMessages(currentLanguage);
  const options: { value: BaitlyQuoteView; label: string }[] = [
    { value: 'ALL', label: audience === 'provider' ? copy.allRequests : copy.all },
    { value: 'DECIDE', label: t(audience === 'provider' ? 'marketplaceQuotes.toQuote' : 'marketplaceQuotes.toDecide') },
    { value: 'WAITING', label: t(audience === 'provider' ? 'marketplaceQuotes.waitingClient' : 'marketplaceQuotes.waiting') },
    { value: 'ACCEPTED', label: t('marketplaceQuotes.accepted') },
    ...(audience === 'customer' ? [{ value: 'CLOSED' as const, label: copy.closed }] : []),
  ];
  return <Select value={value} onValueChange={next => onChange(next as BaitlyQuoteView)} dir={currentLanguage?.startsWith('ar') ? 'rtl' : 'ltr'}>
    <SelectTrigger size="sm" aria-label={audience === 'provider' ? copy.filterRequests : copy.filterStatus} className="baitly-quotes-status-filter" data-active={value !== 'ALL'}>
      <Filter size={14} aria-hidden /><SelectValue />
    </SelectTrigger>
    <SelectContent position="popper" align="end">
      {options.map(option => <SelectItem key={option.value} value={option.value} className="cursor-pointer">
        {option.label}
      </SelectItem>)}
    </SelectContent>
  </Select>;
}
