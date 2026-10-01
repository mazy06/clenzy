import { memo, useMemo, type ReactNode } from 'react';
import { CalendarDays, CircleAlert, Star } from 'lucide-react';
import { StockActionThumbnail } from '../../stock/StockActionThumbnail';
import { Money } from '../../../components/Money';
import { useTranslation } from '../../../hooks/useTranslation';
import { intlLocale } from '../../../utils/localeDate';
import {
  actionFacts, readActionParams, descriptionHighlights, descriptionParts, isoDay, parseNoShowDescription,
  parseQuoteDescription, parseReviewMotif, parseStockDescription, parseOwnerRevenueDescription,
  parsePrivacyDescription, type DescriptionFact,
} from '../core/actionDescription';
import type { PendingAction } from '../types';
import { RevenuePricePreview } from './RevenuePricePreview';
import '../supervision-surfaces.css';
import './action-description.css';

function HighlightedText({ text }: { text: string }) {
  return <>{descriptionHighlights(text).map((part, i) => part.important
    ? <strong key={i}>{part.text}</strong> : part.text)}</>;
}

/** Plain React text, never HTML. All information remains visible, including
 * unfamiliar descriptions and messages from agents added in the future. */
export function DescriptionNarrative({ text }: { text: string }) {
  const parts = useMemo(() => descriptionParts(text), [text]);
  return <div className="baitly-description-narrative">
    {parts.map((part, index) => {
      // Long quotations are content, while short quoted CTA labels stay inline.
      const quote = part.match(/^(.*?)«\s*([^»]{45,})\s*»([\s\S]*)$/s);
      return quote ? <div key={index}>
        {quote[1].trim() && <p dir="auto"><HighlightedText text={quote[1]} /></p>}
        <blockquote dir="auto" className="baitly-description-quote">{quote[2]}</blockquote>
        {quote[3].trim() && <p dir="auto"><HighlightedText text={quote[3]} /></p>}
      </div> : <p dir="auto" key={index}><HighlightedText text={part} /></p>;
    })}
  </div>;
}

function Facts({ children }: { children: ReactNode }) {
  return <dl className="baitly-description-facts">{children}</dl>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function Meter({ label, value, max, suffix }: { label: string; value: number; max: number; suffix: ReactNode }) {
  return <div className="baitly-description-meter-group">
    <div className="baitly-description-meter-label"><span>{label}</span><strong>{suffix}</strong></div>
    <div className="baitly-description-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${Math.min(100, value / max * 100)}%` }} />
    </div>
  </div>;
}

export const ActionDescription = memo(function ActionDescription({ action, stockOrderEditable = false }: { action: PendingAction; stockOrderEditable?: boolean }) {
  const { t, currentLanguage } = useTranslation();
  const locale = intlLocale(currentLanguage);
  const formats = useMemo(() => ({
    date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    number: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    language: new Intl.DisplayNames([locale], { type: 'language' }),
  }), [locale]);
  const label = (key: string) => t(`supervision.description.${key}`);
  const date = (value: string) => <time dateTime={value}>{formats.date.format(isoDay(value)!)}</time>;
  const stock = parseStockDescription(action);
  const quotes = parseQuoteDescription(action);
  const noShow = parseNoShowDescription(action);
  const revenue = parseOwnerRevenueDescription(action);
  const privacy = parsePrivacyDescription(action);
  const review = action.agentId === 'rep' ? parseReviewMotif(action.motif) : null;
  const facts = useMemo(() => actionFacts(action), [action]);
  const factValue = (fact: DescriptionFact): ReactNode => {
    if (fact.kind === 'date') return date(String(fact.value));
    if (fact.kind === 'percent') return `${fact.label === 'adjustment' && Number(fact.value) > 0 ? '+' : ''}${formats.number.format(Number(fact.value))} %`;
    if (fact.kind === 'number') return formats.number.format(Number(fact.value));
    if (fact.kind === 'nights' || fact.kind === 'days') return t(`supervision.description.${fact.kind}`, { count: Number(fact.value) });
    if (fact.label === 'scope') return label(String(fact.value));
    if (fact.kind === 'language') return formats.language.of(String(fact.value)) ?? String(fact.value);
    return <bdi>{fact.value}</bdi>;
  };

  if (action.applyActionType === 'PRICE_DROP' && action.kind !== 'payment' && action.kind !== 'reminder') {
    return <div className="baitly-supervision-surface">
      <RevenuePricePreview actionParams={action.actionParams} motif={action.motif} />
      {action.amountEur != null && Number.isFinite(action.amountEur) && <div className="baitly-action-description"><Facts><Fact label={label('estimatedAmount')}><Money value={action.amountEur} from="EUR" /></Fact></Facts></div>}
    </div>;
  }

  let content: ReactNode;
  if (action.kind === 'payment') {
    // The deposit-stage API sends the DEPOSIT as amountEur, not a quote total.
    // Never infer the future balance by subtracting it a second time.
    const amount = action.amountEur;
    const deposit = action.depositEur;
    const validAmount = amount != null && Number.isFinite(amount) && amount >= 0;
    const validDeposit = deposit != null && Number.isFinite(deposit) && deposit > 0;
    const staged = action.paymentStage === 'deposit' || (action.paymentStage === 'balance' && validDeposit);
    content = <>
      {!staged && validAmount && <Facts>
        <Fact label={label('amountDue')}><Money value={amount} from="EUR" /></Fact>
        {validDeposit && <Fact label={label(action.depositPaid ? 'depositPaid' : 'depositBeforeWork')}><Money value={deposit} from="EUR" /></Fact>}
      </Facts>}
      {staged && <ol className="baitly-description-payment-steps" aria-label={label('paymentSchedule')}>
        <li data-current={action.paymentStage === 'deposit' || undefined}>
          <span>{label(action.depositPaid ? 'depositPaid' : 'depositBeforeWork')}</span>
          {(action.paymentStage === 'deposit' ? validAmount : validDeposit) && <strong><Money value={action.paymentStage === 'deposit' ? amount : deposit} from="EUR" /></strong>}
        </li>
        <li data-current={action.paymentStage === 'balance' || undefined}>
          <span>{label('balanceAfterWork')}</span>
          <strong>{action.paymentStage === 'balance' && validAmount ? <Money value={amount} from="EUR" /> : label('balancePending')}</strong>
        </li>
      </ol>}
      <p className="baitly-description-note">{label('paymentConfirm')}</p>
    </>;
  } else if (stock) {
    content = <>
      <div className="baitly-description-stock">
        <StockActionThumbnail stockItemId={readActionParams(action.actionParams).stockItemId} name={stock.name} />
        <div><strong>{t('supervision.description.remaining', { count: stock.remaining })}</strong><span>{t('supervision.description.stockThreshold', { count: stock.threshold })}</span></div>
        <span className="baitly-description-status">{label('lowStock')}</span>
      </div>
      {stock.quantity != null ? <>
        <Facts>
          {!stockOrderEditable && <Fact label={label('orderQuantity')}>{formats.number.format(stock.quantity)} <bdi>{stock.unit}</bdi></Fact>}
          <Fact label={label('supplier')}><bdi>{stock.supplier}</bdi></Fact>
        </Facts>
        {!stockOrderEditable && <p className="baitly-description-note">{label('purchaseOrder')}</p>}
      </> : <p className="baitly-description-attention"><CircleAlert size={15} aria-hidden />{label('supplierMissing')}</p>}
      <DescriptionNarrative text={stock.note} />
    </>;
  } else if (quotes) {
    content = <>
      <p className="baitly-description-subject" dir="auto">{quotes.title}</p>
      <div className="baitly-description-quote-head"><span>{t('supervision.description.quotes', { count: quotes.rows.length })}</span><span>{label('amount')}</span></div>
      <ul className="baitly-description-quotes">
        {quotes.rows.map((quote, i) => <li key={i}>
          <div><strong dir="auto">{quote.provider}</strong><span>{quote.date ? <>{label('availableFrom')} {date(quote.date)}</> : label('availabilityUnknown')}</span></div>
          <strong><bdi>{formats.number.format(quote.amount)} {quote.currency}</bdi></strong>
        </li>)}
      </ul>
      <DescriptionNarrative text={quotes.note} />
    </>;
  } else if (noShow) {
    content = <>
      <div className="baitly-description-date"><CalendarDays size={22} aria-hidden /><div><span>{label('expectedArrival')}</span><strong>{date(noShow.date)}</strong></div></div>
      <ul className="baitly-description-signals">
        <li><CircleAlert size={14} aria-hidden />{label('guestFormMissing')}</li>
        <li><CircleAlert size={14} aria-hidden />{label('noMessage')}</li>
      </ul>
      <DescriptionNarrative text={noShow.note} />
    </>;
  } else if (revenue) {
    const max = Math.max(revenue.current, revenue.previous);
    content = <>
      <p className="baitly-description-subject">{label('period')} <strong>{revenue.month}</strong></p>
      <div className="baitly-description-comparison">
        {[{ label: 'currentRevenue', value: revenue.current }, { label: 'previousRevenue', value: revenue.previous }].map((row) => <div key={row.label}>
          <div><span>{label(row.label)}</span><strong><Money value={row.value} from="EUR" /></strong></div>
          <span className="baitly-description-comparison-track" aria-hidden><span style={{ width: `${row.value / max * 100}%` }} /></span>
        </div>)}
      </div>
      <DescriptionNarrative text={revenue.note} />
    </>;
  } else if (privacy) {
    content = <>
      <Facts><Fact label={label('requester')}><bdi>{privacy.email}</bdi></Fact><Fact label={label('legalDeadline')}>{date(privacy.due)}</Fact></Facts>
      <p className="baitly-description-note">{label('receivedOn')} <time dateTime={privacy.received}>{privacy.received.replace('T', ' ')}</time></p>
      <DescriptionNarrative text={privacy.note} />
    </>;
  } else if (review) {
    content = <>
      <div className="baitly-description-review-meta">
        <span className="baitly-description-rating"><Star size={15} aria-hidden /><strong>{review.rating}/5</strong></span>
        <span dir="auto">{review.meta}</span>
      </div>
      <blockquote dir="auto" className="baitly-description-quote">{review.quote}</blockquote>
      <DescriptionNarrative text={review.rest} />
    </>;
  } else {
    const battery = action.applyActionType === 'LOCK_BATTERY_REPLACE' ? action.title.match(/^Batterie serrure à (\d+) % [—–]/) : null;
    const quality = action.agentId === 'gro' ? action.title.match(/^Score d'annonce (\d+)\/100$/) : null;
    const measured = battery ?? quality;
    const value = measured ? Number(measured[1]) : null;
    content = <>
      {value != null && value >= 0 && value <= 100 && <Meter label={label(battery ? 'battery' : 'listingQuality')} value={value} max={100} suffix={`${value}${battery ? ' %' : '/100'}`} />}
      {/* Amounts are snapshots, not guaranteed revenue. In particular costs and
          refunds must never be presented as a positive gain. */}
      {(facts.length > 0 || (action.amountEur != null && Number.isFinite(action.amountEur))) && <Facts>
        {facts.map((fact) => <Fact key={fact.label} label={label(fact.label)}>{factValue(fact)}</Fact>)}
        {action.amountEur != null && Number.isFinite(action.amountEur) && <Fact label={label('estimatedAmount')}><Money value={action.amountEur} from="EUR" /></Fact>}
      </Facts>}
      <DescriptionNarrative text={action.motif} />
    </>;
  }

  return <div className="baitly-supervision-surface baitly-action-description" data-description-type={action.kind === 'payment' ? 'payment' : action.applyActionType ?? action.agentId}>{content}</div>;
});
