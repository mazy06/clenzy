import React from 'react';
import {
  DonutChart,
  GroupedBarChart,
  HistogramChart,
  TrendAreaChart,
  TrendLineChart,
  type SeriesDef,
} from '../../../components/stats';
import { useTranslation } from '../../../hooks/useTranslation';
import { reportDocumentCopy, reportSectionTone } from './baitlyReportDocument';
import './baitly-report-document.css';
import { cn } from '../../../utils/cn';
import type {
  ReportChart,
  ReportNote,
  ReportSection,
  ReportSnapshot,
} from '../../../services/api/reportDocumentsApi';
import { activeIntlLocale } from '../../../utils/activeLocale';

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
  const { currentLanguage } = useTranslation();
  const copy = reportDocumentCopy(currentLanguage);
  let chapter = 0;

  return (
    <article className="br-document" data-profile={meta.profile}>
      <CoverBand snapshot={snapshot} />
      <section className="br-summary" aria-label={copy.summary}>
        <h3>{copy.summary}</h3>
        <dl className="br-kpis">
          {snapshot.kpis.map(kpi => <div key={kpi.key} className="br-kpi">
            <dt>{kpi.label}</dt><dd>{kpi.value}</dd>
            <dd className="br-kpi-comparisons">
              <KpiDelta value={kpi.deltaPreviousPct} higherIsBetter={kpi.higherIsBetter} label={copy.previous} />
              <KpiDelta value={kpi.deltaLastYearPct} higherIsBetter={kpi.higherIsBetter} label={copy.lastYear} />
            </dd>
          </div>)}
        </dl>
        <p className="br-as-of">{copy.asOf} {new Date(meta.dataAsOf).toLocaleString(activeIntlLocale(), {
          day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })}</p>
      </section>
      {snapshot.sections.map(section => <SectionView key={section.id} section={section} currency={meta.currency}
        chapter={['glossary', 'notice'].includes(section.id) ? undefined : ++chapter} />)}
    </article>
  );
};

const KpiDelta: React.FC<{ value: number | null; higherIsBetter: boolean; label: string }> = ({ value, higherIsBetter, label }) => {
  if (value == null) return null;
  const favorable = higherIsBetter ? value > 0 : value < 0;
  return <p><span data-direction={value === 0 ? 'neutral' : favorable ? 'positive' : 'negative'}>
    {value > 0 ? '+' : ''}{value.toLocaleString(activeIntlLocale(), { maximumFractionDigits: 1 })} %
  </span> {label}</p>;
};

const CoverBand: React.FC<{ snapshot: ReportSnapshot }> = ({ snapshot: { meta } }) => {
  const { currentLanguage } = useTranslation();
  const copy = reportDocumentCopy(currentLanguage);
  const profileLabel = meta.profile === 'OWNER' ? copy.owner : meta.profile === 'INTERNAL' ? copy.internal : copy.prospect;
  return <header className="br-cover">
    <div className="br-cover-masthead"><p>{meta.issuerName}</p><span className="br-profile">{profileLabel}</span></div>
    <h2>{meta.title}</h2>
    {meta.recipientName && <p className="br-recipient">{copy.recipient} <strong>{meta.recipientName}</strong></p>}
    <p className="br-period">{new Date(meta.periodStart).toLocaleDateString(activeIntlLocale())} → {new Date(meta.periodEnd).toLocaleDateString(activeIntlLocale())}</p>
    <dl className="br-cover-facts">
      <div><dt>{copy.scope}</dt><dd>{meta.scopeLabels.length} {meta.scopeLabels.length === 1 ? copy.property : copy.properties}</dd></div>
      <div><dt>{copy.currency}</dt><dd>{meta.currency}</dd></div>
      {meta.documentNumber && <div><dt>{copy.reference}</dt><dd>{meta.documentNumber} · {copy.version} {meta.version}</dd></div>}
    </dl>
    {meta.scopeLabels.length > 0 && <p className="br-scope">{meta.scopeLabels.join(' · ')}</p>}
    {meta.scopeNote && <p className="br-scope">{meta.scopeNote}</p>}
  </header>;
};

const SectionView: React.FC<{ section: ReportSection; currency: string; chapter?: number }> = ({
  section,
  currency,
  chapter,
}) => {
  const { currentLanguage } = useTranslation();
  const copy = reportDocumentCopy(currentLanguage);
  const chart = section.chart && section.chart.series.length > 0 ? section.chart : null;
  const table = section.table && section.table.rows.length > 0 ? section.table : null;

  return (
    // `fluid` toujours : dans un DOCUMENT les sections s'enchaînent, elles ne se
    // partagent pas la hauteur d'une grille. C'est le graphique qui porte la
    // sienne, juste en dessous.
    <section className="br-section" data-tone={reportSectionTone(section.id)}>
      <header className="br-section-heading">
        {chapter != null && <span>{copy.chapter} {String(chapter).padStart(2, '0')}</span>}
        <h3>{section.title}</h3>{section.subtitle && <p>{section.subtitle}</p>}
      </header>
      <div className="flex flex-col gap-3">
        {section.narrative ? (
          <p className="br-narrative">
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
            <table className="br-table">
              <thead>
                <tr>
                  {table.columns.map((column, index) => (
                    <th
                      key={column}
                      className={cn(
                        '' ,
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
                          '',
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
                          '',
                          section.kind === 'PNL' && 'br-cascade',
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
          <ul className="br-notes">
            {section.notes.map((note) => (
              <NoteRow key={note.label} note={note} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
};

const NoteRow: React.FC<{ note: ReportNote }> = ({ note }) => (
  <li className="br-note" data-tone={note.tone}>
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
      {note.detail ? <span className="text-muted-foreground"> · {note.detail}</span> : null}
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
    const compact = new Intl.NumberFormat(activeIntlLocale(), { notation: 'compact', maximumFractionDigits: 1 });
    return (value: number) => `${compact.format(value)} ${symbol}`;
  }
  if (unit === 'percent') {
    return (value: number) => `${value.toLocaleString(activeIntlLocale(), { maximumFractionDigits: 1 })} %`;
  }
  return (value: number) => value.toLocaleString(activeIntlLocale());
};

export default SnapshotView;
