import * as React from 'react';
import type { StatBucket, ValueFormatter } from './charts';
import { activeIntlLocale } from '../../utils/activeLocale';

/** Full labels and exact values, with a shared scale for positive and negative bars. */
export function WidgetRanking({ buckets, label, color, colorFor, formatValue }: {
  buckets: StatBucket[];
  label: string;
  color: string;
  colorFor?: (bucket: StatBucket) => string;
  formatValue?: ValueFormatter;
}) {
  const low = Math.min(0, ...buckets.map((bucket) => bucket.count));
  const high = Math.max(0, ...buckets.map((bucket) => bucket.count));
  const span = high - low || 1;
  const origin = -low / span * 100;
  const format = formatValue ?? ((value: number) => value.toLocaleString(activeIntlLocale()));
  return <dl className="db-data-ranking" aria-label={label}>
    {buckets.map((bucket, index) => <div className="db-data-ranking__row" key={`${bucket.label}:${index}`}>
      <dt><span className="db-data-ranking__number" aria-hidden="true">{(index + 1).toLocaleString(activeIntlLocale(), { minimumIntegerDigits: 2 })}</span><span dir="auto">{bucket.label}</span></dt>
      <dd>{format(bucket.count)}</dd>
      <div className="db-data-ranking__track" aria-hidden="true">
        {low < 0 && high > 0 && <span className="db-data-ranking__zero" style={{ insetInlineStart: `${origin}%` }} />}
        <span className="db-data-ranking__bar" style={{
          insetInlineStart: `${Math.min(origin, (bucket.count - low) / span * 100)}%`,
          inlineSize: `${Math.abs(bucket.count) / span * 100}%`,
          backgroundColor: colorFor?.(bucket) ?? color,
        }} />
      </div>
    </div>)}
  </dl>;
}
