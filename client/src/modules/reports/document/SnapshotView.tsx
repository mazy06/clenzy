import React from 'react';
import {
  ChartTile,
  DonutChart,
  GroupedBarChart,
  HistogramChart,
  StatsBand,
  StatsLayout,
  TrendAreaChart,
  TrendLineChart,
  type SeriesDef,
  type StatFigure,
} from '../../../components/stats';
import { Card } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import type {
  ReportChart,
  ReportNote,
  ReportSection,
  ReportSnapshot,
} from '../../../services/api/reportDocumentsApi';

/**
 * Le snapshot, à l'écran.
 *
 * <p>Ce composant ne calcule RIEN : toutes les valeurs qu'il affiche sont des
 * chaînes déjà formatées par le serveur. C'est ce qui garantit que l'aperçu et
 * le PDF disent la même chose — un montant arrondi différemment entre les deux
 * est une réclamation client, pas un détail cosmétique.</p>
 */
const SnapshotView: React.FC<{ snapshot: ReportSnapshot }> = ({ snapshot }) => {
  const { meta } = snapshot;

  const figures: StatFigure[] = snapshot.kpis.map((kpi) => ({
    key: kpi.key,
    value: kpi.value,
    label: kpi.label,
    delta: kpi.deltaLastYearPct,
    deltaInverted: !kpi.higherIsBetter,
  }));

  return (
    <StatsLayout>
      <CoverBand snapshot={snapshot} />
      <StatsBand
        figures={figures}
        footer={
          <p className="m-0 text-2xs text-muted-foreground">
            Écarts affichés face à la même période l'an dernier · données arrêtées le{' '}
            {new Date(meta.dataAsOf).toLocaleString('fr-FR', {
              day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        }
      />

      {snapshot.sections.map((section) => (
        <SectionView key={section.id} section={section} currency={meta.currency} />
      ))}
    </StatsLayout>
  );
};

/**
 * L'en-tête du document.
 *
 * <p>Périmètre et date d'arrêté ne sont pas de la décoration : sans eux, un
 * chiffre n'est pas défendable. Ils ouvrent donc l'aperçu comme ils ouvrent
 * le PDF.</p>
 */
const CoverBand: React.FC<{ snapshot: ReportSnapshot }> = ({ snapshot }) => {
  const { meta } = snapshot;
  return (
    <Card className="flex flex-col gap-2 border-border p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-2xs font-bold uppercase tracking-[0.06em] text-muted-foreground">
            {meta.issuerName}
          </p>
          <h2 className="m-0 font-[family-name:var(--font-display)] text-lg font-bold text-foreground">
            {meta.title}
          </h2>
          {meta.recipientName ? (
            <p className="m-0 text-xs text-muted-foreground">Établi pour {meta.recipientName}</p>
          ) : null}
        </div>
        <div className="text-end text-xs text-muted-foreground">
          <p className="m-0">
            {new Date(meta.periodStart).toLocaleDateString('fr-FR')} —{' '}
            {new Date(meta.periodEnd).toLocaleDateString('fr-FR')}
          </p>
          <p className="m-0 tabular-nums">
            {meta.scopeLabels.length} bien{meta.scopeLabels.length > 1 ? 's' : ''} · {meta.currency}
          </p>
        </div>
      </div>
      {meta.scopeLabels.length > 0 ? (
        <p className="m-0 truncate text-2xs text-muted-foreground" title={meta.scopeLabels.join(' · ')}>
          {meta.scopeLabels.join(' · ')}
        </p>
      ) : null}
    </Card>
  );
};

const SectionView: React.FC<{ section: ReportSection; currency: string }> = ({
  section,
  currency,
}) => {
  const chart = section.chart && section.chart.series.length > 0 ? section.chart : null;
  const table = section.table && section.table.rows.length > 0 ? section.table : null;

  return (
    // `fluid` toujours : dans un DOCUMENT les sections s'enchaînent, elles ne se
    // partagent pas la hauteur d'une grille. C'est le graphique qui porte la
    // sienne, juste en dessous.
    <ChartTile title={section.title} hint={section.subtitle ?? undefined} fluid>
      <div className="flex flex-col gap-3">
        {section.narrative ? (
          <p className="m-0 shrink-0 border-s-2 border-primary ps-3 text-xs leading-relaxed text-foreground">
            {section.narrative}
          </p>
        ) : null}

        {chart ? (
          // Hauteur EXPLICITE, et non un `min-height` : les enfants du graphique
          // se dimensionnent en pourcentage, et un pourcentage ne se résout pas
          // contre un parent dont la hauteur vient d'un `min-height`. Il tombait
          // à zéro — le titre s'affichait, la place restait blanche.
          //
          // En style en ligne parce que la valeur est CALCULÉE : une classe
          // Tailwind ne naît jamais d'une variable.
          <div className="w-full shrink-0" style={{ height: chartHeight(chart) }}>
            <ChartView chart={chart} currency={currency} />
          </div>
        ) : null}

        {section.body ? (
          <div className="shrink-0 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
            {section.body}
          </div>
        ) : null}

        {table ? (
          <div className="no-scrollbar shrink-0 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {table.columns.map((column, index) => (
                    <th
                      key={column}
                      className={cn(
                        'border-b border-foreground/70 px-2 py-1.5 text-2xs font-bold uppercase tracking-[0.05em] text-muted-foreground',
                        alignClass(table.aligns[index], index),
                      )}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.join('|')}>
                    {row.map((cell, index) => (
                      <td
                        key={`${index}-${cell}`}
                        className={cn(
                          'border-b border-border px-2 py-1.5 tabular-nums',
                          alignClass(table.aligns[index], index),
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {table.totals.length > 0 ? (
                <tfoot>
                  <tr>
                    {table.totals.map((cell, index) => (
                      <td
                        key={`total-${index}-${cell}`}
                        className={cn(
                          'border-t border-foreground/70 px-2 py-2 font-semibold tabular-nums',
                          section.kind === 'PNL' && 'bg-muted/40 text-sm',
                          alignClass(table.aligns[index], index),
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        ) : null}

        {section.notes.length > 0 ? (
          <ul className="m-0 shrink-0 list-none space-y-1.5 p-0">
            {section.notes.map((note) => (
              <NoteRow key={note.label} note={note} />
            ))}
          </ul>
        ) : null}
      </div>
    </ChartTile>
  );
};

const NoteRow: React.FC<{ note: ReportNote }> = ({ note }) => (
  <li className="flex items-baseline gap-2 border-b border-border pb-1.5 text-xs last:border-b-0 last:pb-0">
    <span
      aria-hidden="true"
      className={cn('mt-1 size-1.5 shrink-0 rounded-full', {
        'bg-success': note.tone === 'positive',
        'bg-warning': note.tone === 'warning',
        'bg-destructive': note.tone === 'critical',
        'bg-muted-foreground': note.tone === 'neutral',
      })}
    />
    <span className="min-w-0 flex-1">
      <span className="font-semibold text-foreground">{note.label}</span>
      {note.detail ? <span className="text-muted-foreground"> — {note.detail}</span> : null}
    </span>
    {note.impact ? (
      <span className="shrink-0 font-semibold tabular-nums text-foreground">{note.impact}</span>
    ) : null}
  </li>
);

/**
 * Traduit un graphique du snapshot vers le kit de l'interface.
 *
 * <p>Les formes du contrat sont volontairement peu nombreuses : chacune doit
 * exister à la fois ici et dans le générateur SVG du PDF. Une forme qui
 * n'existerait que d'un côté romprait la promesse.</p>
 */
const ChartView: React.FC<{ chart: ReportChart; currency: string }> = ({ chart, currency }) => {
  const format = formatterFor(chart.valueUnit, currency);
  const series: SeriesDef[] = chart.series.map((s, index) => ({
    key: s.key,
    label: s.label,
    tokenIndex: index,
    tone: (s.tone as SeriesDef['tone']) ?? undefined,
    dashed: s.dashed,
    stackId: chart.type === 'STACKED_BARS' ? 'stack' : undefined,
  }));

  const data = chart.categories.map((label, index) => {
    const point: Record<string, unknown> = { label };
    chart.series.forEach((s) => {
      point[s.key] = s.values[index] ?? null;
    });
    return point as { label: string } & Record<string, number | null>;
  });

  if (chart.type === 'DONUT') {
    const first = chart.series[0];
    return (
      <DonutChart
        buckets={chart.categories.map((label, index) => ({
          label,
          count: first?.values[index] ?? 0,
        }))}
        totalLabel={first?.label ?? ''}
        formatValue={format}
      />
    );
  }

  if (chart.type === 'HORIZONTAL_BARS') {
    const first = chart.series[0];
    return (
      <HistogramChart
        buckets={chart.categories.map((label, index) => ({
          label,
          count: first?.values[index] ?? 0,
        }))}
        label={first?.label ?? ''}
        formatValue={format}
        tokenIndex={1}
        labelWidth={132}
      />
    );
  }

  if (chart.type === 'LINES') {
    return <TrendLineChart data={data} series={series} formatValue={format} />;
  }

  if (chart.type === 'AREA') {
    return <TrendAreaChart stacked data={data} series={series} formatValue={format} />;
  }

  return <GroupedBarChart data={data} series={series} formatValue={format} />;
};

/**
 * Hauteur d'un graphique.
 *
 * <p>Les barres horizontales portent une ligne par catégorie : dix logements
 * dans 260 px donnent des bandes de trois pixels. Elles grandissent donc avec
 * leur contenu, les autres formes gardent une hauteur stable.</p>
 */
const chartHeight = (chart: ReportChart): number => {
  if (chart.type === 'HORIZONTAL_BARS') {
    return Math.min(520, Math.max(260, chart.categories.length * 30 + 70));
  }
  return 300;
};

const alignClass = (align: 'START' | 'CENTER' | 'END' | undefined, index: number) => {
  const resolved = align ?? (index === 0 ? 'START' : 'END');
  if (resolved === 'CENTER') return 'text-center';
  return resolved === 'END' ? 'text-end' : 'text-start';
};

/**
 * Formatage des graduations.
 *
 * <p>Les valeurs des tableaux arrivent déjà formatées ; seuls les AXES doivent
 * l'être ici, à partir des valeurs brutes des séries.</p>
 */
const formatterFor = (unit: string | null, currency: string) => {
  const symbol = currency === 'EUR' ? '€' : currency;
  if (unit === 'money') {
    const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
    return (value: number) => `${compact.format(value)} ${symbol}`;
  }
  if (unit === 'percent') {
    return (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
  }
  return (value: number) => value.toLocaleString('fr-FR');
};

export default SnapshotView;
