import { memo, useMemo } from 'react';
import { ArrowForward } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { intlLocale } from '../../../utils/localeDate';
import { DAY_MS, parseRevenueOccupancy, parseRevenuePricePlan } from '../core/revenuePricePreview';
import '../supervision-surfaces.css';
import './revenue-price-preview.css';

interface RevenuePricePreviewProps {
  actionParams?: string;
  motif: string;
}

/** Read-only proposal. Editing and applying remain in PriceAdjustmentModal. */
export const RevenuePricePreview = memo(function RevenuePricePreview({ actionParams, motif }: RevenuePricePreviewProps) {
  const { t, currentLanguage } = useTranslation();
  const plan = useMemo(() => parseRevenuePricePlan(actionParams), [actionParams]);
  const context = useMemo(() => plan ? parseRevenueOccupancy(motif, plan.segments.length) : null, [motif, plan]);
  const formats = useMemo(() => {
    const locale = intlLocale(currentLanguage);
    return {
      date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      full: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
      year: new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone: 'UTC' }),
      percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }),
    };
  }, [currentLanguage]);

  if (!plan) return <p dir="auto" className="m-0 mt-2 text-[13px] leading-relaxed text-muted-foreground">{motif}</p>;

  const dateAt = (day: number) => new Date(day * DAY_MS);
  const crossYear = formats.year.format(dateAt(plan.start)) !== formats.year.format(dateAt(plan.end - 1));
  const dateFormat = crossYear ? formats.full : formats.date;
  const percent = (value: number) => formats.percent.format(value / 100);
  const changeLabel = t(`supervision.price.preview.${plan.direction === 'up' ? 'increase' : 'decrease'}`);
  const maxPercent = Math.max(...plan.segments.map((segment) => segment.percent));
  const span = plan.end - plan.start;

  return (
    <div className="baitly-supervision-surface baitly-revenue-preview">
      {context ? (
        <div className="baitly-revenue-context">
          <div className="baitly-revenue-context-labels">
            <span>{t('supervision.price.occ')} <strong>{percent(context.occupancy)}</strong></span>
            {context.threshold != null && <span>{t('supervision.price.preview.threshold', { value: percent(context.threshold) })}</span>}
          </div>
          <div
            className="baitly-revenue-occupancy"
            role="meter"
            aria-label={t('supervision.price.occ')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={context.occupancy}
            aria-valuetext={percent(context.occupancy)}
          >
            <span className="baitly-revenue-occupancy-fill" style={{ width: `${context.occupancy}%` }} />
            {context.threshold != null && <span className="baitly-revenue-threshold" style={{ insetInlineStart: `${context.threshold}%` }} />}
          </div>
          <p className="baitly-revenue-horizon">{t('supervision.price.preview.horizon', { count: context.days })}</p>
          {context.strongDemand && <p className="m-0 mt-1 text-xs text-muted-foreground">{t('supervision.price.preview.strongDemand')}</p>}
        </div>
      ) : <p dir="auto" className="m-0 mb-3 text-[13px] leading-relaxed text-muted-foreground">{motif}</p>}

      <div className="baitly-revenue-summary">
        <span>{t('supervision.price.preview.periods', { count: plan.segments.length })}</span>
        <span>{t('supervision.price.preview.nights', { count: plan.nights })}</span>
      </div>
      <div className="baitly-revenue-axis" aria-hidden>
        <span>{t('supervision.price.preview.nightDates')}</span>
        <span className="baitly-revenue-timeline-axis">
          <span>{formats.full.format(dateAt(plan.start))}</span>
          {span > 1 && <span>{formats.full.format(dateAt(plan.end - 1))}</span>}
        </span>
        <span>{changeLabel}</span>
      </div>
      <ol className="baitly-revenue-periods" aria-label={t('supervision.price.preview.nightDates')}>
        {plan.segments.map((segment) => {
          // `to` is exclusive in the API; display the last affected NIGHT.
          const lastNight = segment.toDay - 1;
          const lastIso = dateAt(lastNight).toISOString().slice(0, 10);
          return (
            <li key={`${segment.from}/${segment.to}`} className="baitly-revenue-period">
              <div className="baitly-revenue-period-copy">
                <div className="baitly-revenue-dates">
                  <time dateTime={segment.from} title={formats.full.format(dateAt(segment.fromDay))}>{dateFormat.format(dateAt(segment.fromDay))}</time>
                  {segment.nights > 1 && <>
                    <ArrowForward size={12} aria-hidden className="shrink-0 rtl:rotate-180" />
                    <span className="sr-only">{t('supervision.price.preview.to')}</span>
                    <time dateTime={lastIso} title={formats.full.format(dateAt(lastNight))}>{dateFormat.format(dateAt(lastNight))}</time>
                  </>}
                </div>
                <span className="baitly-revenue-night-count">{t('supervision.price.preview.nights', { count: segment.nights })}</span>
              </div>
              <span className="baitly-revenue-track" aria-hidden>
                <span className="baitly-revenue-range" style={{
                  insetInlineStart: `${((segment.fromDay - plan.start) / span) * 100}%`,
                  width: `${(segment.nights / span) * 100}%`,
                  opacity: 0.45 + 0.55 * segment.percent / maxPercent,
                }} />
              </span>
              <span className="baitly-revenue-change" aria-label={`${changeLabel} : ${percent(segment.percent)}`}>
                <bdi dir="ltr">{plan.direction === 'up' ? '+' : '−'}{percent(segment.percent)}</bdi>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
});
