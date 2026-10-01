export const DAY_MS = 86_400_000;

export interface RevenuePriceSegment {
  from: string;
  to: string;
  fromDay: number;
  toDay: number;
  nights: number;
  percent: number;
}

export interface RevenuePricePlan {
  direction: 'up' | 'down';
  segments: RevenuePriceSegment[];
  nights: number;
  start: number;
  end: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function dateDay(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date.getTime() / DAY_MS
    : null;
}

/** Read the actual proposed rates; never infer dates or percentages from prose. */
export function parseRevenuePricePlan(actionParams?: string): RevenuePricePlan | null {
  if (!actionParams) return null;
  try {
    const raw: unknown = JSON.parse(actionParams);
    if (!isRecord(raw) || (raw.direction != null && raw.direction !== 'up' && raw.direction !== 'down')) return null;
    const entries = Array.isArray(raw.segments) ? raw.segments : [raw];
    if (!entries.length) return null;
    const segments: RevenuePriceSegment[] = [];
    for (const entry of entries) {
      if (!isRecord(entry)) return null;
      const fromDay = dateDay(entry.from);
      const toDay = dateDay(entry.to);
      if (fromDay == null || toDay == null || toDay <= fromDay
        || typeof entry.percent !== 'number' || !Number.isFinite(entry.percent)
        || entry.percent <= 0 || entry.percent > 100) return null;
      segments.push({
        from: entry.from as string,
        to: entry.to as string,
        fromDay, toDay, nights: toDay - fromDay, percent: entry.percent,
      });
    }
    segments.sort((a, b) => a.fromDay - b.fromDay);
    // Avoid silently counting the same night twice or hiding an invalid segment.
    if (segments.some((segment, i) => i > 0 && segment.fromDay < segments[i - 1].toDay)) return null;
    return {
      direction: raw.direction === 'up' ? 'up' : 'down',
      segments,
      nights: segments.reduce((sum, segment) => sum + segment.nights, 0),
      start: segments[0].fromDay,
      end: segments[segments.length - 1].toDay,
    };
  } catch {
    return null;
  }
}

/** BusinessAnalyticsScanner's context is currently sent as French prose. */
export function parseRevenueOccupancy(motif: string, segmentCount: number) {
  const match = motif.match(/^Occupation de (\d+(?:[.,]\d+)?)\s*% sur les (\d+) prochains jours(?: \(seuil (\d+(?:[.,]\d+)?)\s*%\)\. (\d+) créneaux? creux à optimiser| : demande forte, prix possiblement sous-évalués\. (\d+) créneaux? encore libres? à revaloriser)\s*:/u);
  if (!match || Number(match[4] ?? match[5]) !== segmentCount) return null;
  const occupancy = Number(match[1].replace(',', '.'));
  const days = Number(match[2]);
  const threshold = match[3] ? Number(match[3].replace(',', '.')) : undefined;
  if (occupancy > 100 || days <= 0 || (threshold != null && threshold > 100)) return null;
  return { occupancy, days, threshold, strongDemand: match[5] != null };
}
