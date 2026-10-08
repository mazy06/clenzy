import * as React from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartBarBigIcon, ChartPieIcon, ChevronRightIcon } from '../../../icons/glyphs';
import { Link } from 'react-router-dom';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../../../components/ui/chart';
import { cn } from '../../../utils/cn';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  useDashboardOccupancyByProperty,
  useDashboardRevenueSplit,
} from '../../../hooks/useDashboardAnalyticsBlocks';
import type { DashboardPeriod } from '../DashboardDateFilter';
import { useDashboardOverview } from '../../../hooks/useDashboardOverview';
import { DashboardWidgetState } from '../DashboardWidgetState';
import { activeIntlLocale, activeIntlLocaleGregorian } from '../../../utils/activeLocale';
import RevenueByChannelCard from '../../../components/baitly/RevenueByChannelCard';
import { channelLabel } from './DashboardOperationsBlocks';
import { WidgetPanel } from '../../../components/baitly/WidgetPanel';
import { PropertyThumbnail } from '../../../components/baitly/PropertyThumbnail';
import { Money } from '../../../components/baitly/Money';
import { useCurrency } from '../../../hooks/currencyDisplayContext';
import { useDashboardPropertyPhotos } from '../useDashboardPropertyPhotos';
import '../dashboardInsights.css';

/**
 * Blocs analytiques du Dashboard portés depuis la projection
 * (`DASHBOARD-PARITY.md` §3 et §7).
 *
 * Aucun endpoint n'a été créé pour eux : le moteur de rapports sait déjà croiser
 * période × canal, et les analytics du portefeuille exposent déjà l'occupation
 * par logement.
 */

/**
 * Un bâton par mois = le revenu, décomposé en ce qu'il est devenu. L'ordre des
 * segments suit le trajet de l'argent : ce que le canal prélève, ce que coûte
 * l'exploitation, ce qui part au propriétaire, ce qui reste.
 */
// ─── §3 · Revenus mensuels, direct vs OTA ───────────────────────────────────

export function MonthlyRevenueSplitCard({ year = new Date().getFullYear() }: { year?: number }) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const { data, isLoading, isError, refetch } = useDashboardRevenueSplit(year);
  const config = {
    fees: { label: t('dashboard.revenueSplit.fees', 'Commissions'), color: 'var(--db-chart-teal)' },
    interventions: { label: t('dashboard.revenueSplit.interventions', 'Interventions'), color: 'var(--bui-warning)' },
    payout: { label: t('dashboard.revenueSplit.payouts', 'Versements'), color: 'var(--db-chart-slate)' },
    retained: { label: t('dashboard.revenueSplit.retained', 'Reste'), color: 'var(--bui-navy)' },
  } satisfies ChartConfig;
  const title = t('dashboard.revenueSplit.title', 'Revenus et versements');
  if (isLoading || isError) return <DashboardWidgetState title={title} error={isError} onRetry={() => { void refetch(); }} />;
  const rows = data ?? [];
  const sourceCurrency = rows[0]?.currency ?? currency;
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  const payouts = rows.reduce((sum, row) => sum + row.payout, 0);
  return <WidgetPanel title={title} className="db-revenue-split"
    caption={t('dashboard.revenueSplit.yearCaption', 'Janvier à décembre {{year}} · {{currency}}', { year: year.toLocaleString(activeIntlLocaleGregorian(), { useGrouping: false }), currency: sourceCurrency })}
    footer={rows.length > 0 ? <>
      <span>{t('dashboard.revenueSplit.total', 'Revenus')} <strong><Money value={total} from={sourceCurrency} decimals={0} /></strong></span>
      <span>{t('dashboard.revenueSplit.payouts', 'Versements')} <strong><Money value={payouts} from={sourceCurrency} decimals={0} /></strong></span>
    </> : undefined}>
    <ul className="db-revenue-legend" aria-label={t('dashboard.revenueSplit.legend', 'Légende du graphique')}>
      {Object.entries(config).map(([key, item]) => <li key={key}>
        <span aria-hidden="true" style={{ background: item.color }} />{item.label}
      </li>)}
    </ul>
    {rows.length === 0 ? <p className="bui-widget-panel__empty">{t('dashboard.revenueSplit.empty', 'Aucun revenu enregistré sur la période.')}</p> :
      <ChartContainer config={config} className="db-widget-chart db-revenue-chart">
        <BarChart accessibilityLayer data={rows} stackOffset="sign" maxBarSize={42} margin={{ top: 14, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--bui-border)" strokeDasharray="3 5" />
          <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} interval={0} height={60} tick={<RevenueMonthTick />} />
          <YAxis width={48} tickLine={false} axisLine={false} tickCount={4}
            tickFormatter={(value: number) => value.toLocaleString(activeIntlLocale(), { notation: 'compact', maximumFractionDigits: 1 })} />
          <ReferenceLine y={0} stroke="var(--bui-border)" />
          <ChartTooltip cursor={{ fill: 'var(--bui-navy-soft)' }}
            content={<ChartTooltipContent labelFormatter={formatChartMonth}
              formatter={(value, name, item) => <div className="db-revenue-tooltip-row">
                <span aria-hidden="true" style={{ background: item.color }} />
                <span>{config[name as keyof typeof config]?.label ?? name}</span>
                <strong><Money value={Number(value)} from={sourceCurrency} decimals={0} /></strong>
              </div>} />} />
          <Bar dataKey="fees" stackId="m" fill="var(--color-fees)" isAnimationActive={false} />
          <Bar dataKey="interventions" stackId="m" fill="var(--color-interventions)" isAnimationActive={false} />
          <Bar dataKey="payout" stackId="m" fill="var(--color-payout)" isAnimationActive={false} />
          <Bar dataKey="retained" stackId="m" fill="var(--color-retained)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>}
  </WidgetPanel>;
}

function RevenueMonthTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return <g transform={`translate(${x},${y})`}>
    <text dy={12} textAnchor="middle" fill="var(--bui-muted-foreground)" className="db-revenue-month-label">{formatChartMonth(payload?.value ?? '')}</text>
  </g>;
}

function formatChartMonth(value: unknown): string {
  const bucket = String(value);
  if (!/^\d{4}-\d{2}$/.test(bucket)) return bucket;
  return new Date(`${bucket}-01T12:00:00`).toLocaleDateString(activeIntlLocaleGregorian(), { month: 'short' });
}

// ─── §7 · Occupation par logement ───────────────────────────────────────────

/** Seuils de couleur repris de la projection : ≥ 70 % succès, ≥ 50 % primaire, sinon warning. */
/** Mêmes seuils, en valeur de couleur : Recharts peint en CSS, pas en classes. */
function occupancyColor(rate: number): string {
  if (rate >= 70) return 'var(--db-chart-teal)';
  if (rate >= 50) return 'var(--bui-navy)';
  return 'var(--bui-warning)';
}

/**
 * Arrondi d'affichage.
 *
 * <p>Le plafond à 100 % qui vivait ici a été retiré : il masquait un bug de
 * calcul (les nuits hors fenêtre et les séjours qui se chevauchent étaient
 * comptés) au lieu de le montrer. `PortfolioAnalyticsService` borne désormais
 * l'occupation à la source, en marquant les nuits plutôt qu'en les additionnant.
 * Si un taux repassait au-dessus de 100 %, il doit se voir.</p>
 */
function clampRate(rate: number): number {
  return Math.max(0, Math.round(rate));
}

type OccupancyView = 'bars' | 'radial';

interface OccupancyRow {
  propertyId: number;
  name: string;
  rate: number;
  occupiedNights: number;
  totalNights: number;
}

/* ─── Vue radiale ────────────────────────────────────────────────────────────
 *
 * Anneaux concentriques dessinés en SVG à la main, et non avec le `RadialBar`
 * de Recharts : ses secteurs n'émettent aucun évènement de souris ici · ni son
 * infobulle ni un `onMouseEnter` posé dessus ne s'arment. Or le survol est
 * précisément ce qu'on demande à cette vue. Un anneau de progression n'est
 * qu'un cercle à `stroke-dasharray` : le tracer directement coûte moins de code
 * que de contourner la bibliothèque, et rend le survol trivial.
 */

const RADIAL_SIZE = 208;
const RADIAL_OUTER = 96;
const RADIAL_INNER_MIN = 30;

/**
 * Bornes du disque à l'écran, en pixels.
 *
 * <p>Le tracé est en unités de `viewBox` : il s'étire donc sans rien recalculer.
 * Ce qui a besoin de bornes, c'est le résultat · sous 140 px les anneaux
 * deviennent des cheveux, et au-delà de 300 px un camembert de la hauteur d'une
 * colonne n'informe pas mieux, il occupe.</p>
 */
const RADIAL_MIN_PX = 140;
const RADIAL_MAX_PX = 300;

/**
 * Place réservée à l'encart, gouttière comprise : sa largeur quand il se pose à
 * côté du disque, sa hauteur quand il passe dessous.
 *
 * <p>Des constantes et non une seconde mesure : mesurer l'encart <i>dans</i> le
 * conteneur qu'on mesure déjà ferait dépendre la taille du disque d'une place
 * que le disque détermine · la vue rétrécirait d'elle-même à chaque passe. Ses
 * deux lignes courtes ne varient pas.</p>
 */
const LABEL_WIDTH_PX = 220;
const LABEL_HEIGHT_PX = 52;

function OccupancyRadial({
  rows,
  averageLabel,
  nightsLabel,
}: {
  rows: OccupancyRow[];
  averageLabel: string;
  /** Rendu « 12 nuits sur 30 » · la formulation vient de l'appelant (i18n). */
  nightsLabel: (occupied: number, total: number) => string;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState({ side: RADIAL_MIN_PX, beside: false });

  /*
   * Le disque est carré : c'est le plus petit des deux côtés qui le borne, une
   * fois la place de l'encart retirée.
   *
   * L'encart se met à CÔTÉ dès que la largeur le permet · le tableau de bord
   * est large et la carte haute, poser deux lignes de texte sous un disque y
   * gaspille de la hauteur que le disque pourrait prendre. En dessous du seuil
   * (colonne étroite, mobile), il repasse sous le disque plutôt que de l'écraser.
   */
  React.useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const measure = () => {
      const rect = box.getBoundingClientRect();
      const beside = rect.width - LABEL_WIDTH_PX >= RADIAL_MIN_PX;
      const available = beside
        ? Math.min(rect.width - LABEL_WIDTH_PX, rect.height)
        : Math.min(rect.width, rect.height - LABEL_HEIGHT_PX);
      setLayout({
        side: Math.max(RADIAL_MIN_PX, Math.min(RADIAL_MAX_PX, Math.floor(available))),
        beside,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const { side, beside } = layout;

  // Le plus occupé à l'extérieur : l'anneau le plus long est aussi le plus lisible.
  const data = [...rows].sort((a, b) => b.rate - a.rate);

  const pitch = (RADIAL_OUTER - RADIAL_INNER_MIN) / data.length;
  const stroke = Math.max(6, Math.min(18, pitch * 0.72));
  const centre = RADIAL_SIZE / 2;

  // Tous les logements partagent la même fenêtre de jours (cf. `computeOccupancy`),
  // donc la moyenne des taux est bien le taux du portefeuille.
  const average = Math.round(data.reduce((sum, row) => sum + row.rate, 0) / (data.length || 1));
  const focus = hovered != null ? data[hovered] : null;
  const single = data.length === 1;

  // Contenu de l'encart : le portefeuille par défaut, le logement au survol.
  const boxLabel = focus ? focus.name : single ? data[0].name : averageLabel;
  const boxRate = focus ? focus.rate : single ? data[0].rate : average;
  const boxOccupied = focus ? focus.occupiedNights : data.reduce((s, r) => s + r.occupiedNights, 0);
  const boxTotal = focus ? focus.totalNights : data.reduce((s, r) => s + r.totalNights, 0);

  return (
    // Le composant occupe lui-même la place restante et s'y mesure : la carte
    // est étirée à la hauteur de sa voisine de ligne, et cette hauteur n'est
    // connue de personne à l'écriture. Un disque de taille fixe y flottait au
    // milieu d'un vide de plusieurs centaines de pixels.
    //
    // Pas de `min-h-0` ici, à dessein : sans hauteur définie du parent (mobile,
    // widgets empilés) `flex-1` se résout à zéro, et c'est la hauteur minimale
    // du contenu qui sauve la vue. La borne basse fait le reste.
    <div
      ref={boxRef}
      className={cn(
        'relative flex w-full flex-1 items-center justify-center gap-3',
        beside ? 'flex-row' : 'flex-col',
      )}
    >
      <div
        className="relative"
        style={{ width: side, height: side }}
        onMouseLeave={() => setHovered(null)}
      >
        <svg
          viewBox={`0 0 ${RADIAL_SIZE} ${RADIAL_SIZE}`}
          className="size-full"
          role="group"
          aria-label={averageLabel}
        >
          {data.map((row, index) => {
            const radius = RADIAL_OUTER - index * pitch - stroke / 2;
            const circumference = 2 * Math.PI * radius;
            return (
              <g
                key={row.propertyId}
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                onClick={() => setHovered(index)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setHovered(index); } }}
                tabIndex={0}
                role="button"
                aria-label={`${row.name}, ${row.rate.toLocaleString(activeIntlLocale())} %`}
                className="cursor-pointer"
              >
                {/* La piste porte le survol : elle couvre toute la circonférence,
                    donc un logement à 5 % reste survolable sur tout son anneau. */}
                <circle
                  cx={centre}
                  cy={centre}
                  r={radius}
                  fill="none"
                  stroke="var(--bui-field)"
                  strokeWidth={stroke}
                />
                <circle
                  cx={centre}
                  cy={centre}
                  r={radius}
                  fill="none"
                  stroke={occupancyColor(row.rate)}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${(circumference * Math.min(100, row.rate)) / 100} ${circumference}`}
                  transform={`rotate(-90 ${centre} ${centre})`}
                  className="pointer-events-none"
                />
                {/* Repli natif : le nom reste accessible même sans notre infobulle. */}
                <title>{`${row.name} · ${row.rate}%`}</title>
              </g>
            );
          })}
        </svg>

        {/* Le taux seul au centre : le libellé vit dans l'encart flottant, on ne
            le dit pas deux fois. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {/* Le chiffre suit le disque : à 24 px fixes, il se perdait au centre
              d'un anneau de 300 px. */}
          <span
            className="font-semibold tracking-tight tabular-nums"
            style={{ fontSize: Math.round(side * 0.14) }}
          >
            {boxRate.toLocaleString(activeIntlLocale())}%
          </span>
        </div>

      </div>

      {/* Encart À CÔTÉ du disque, dans le flux · sous lui quand la largeur
          manque. Superposé, il masquait le bas des anneaux, c'est-à-dire les
          logements les moins occupés : ceux qu'on regarde. Sa place est réservée
          au moment de la mesure, elle ne se prend donc pas sur le graphique.

          Toujours visible : il porte le portefeuille au repos et bascule sur le
          logement survolé. Une infobulle qui n'existe qu'au survol laisserait la
          vue muette tant qu'on ne bouge pas la souris, et inaccessible au
          clavier ou au tactile. */}
      <div
        className={cn(
          // Largeur FIXE, et non `w-max` : le contenu change au survol (« Moyenne
          // du portefeuille » puis le nom du logement), et une boîte qui suit son
          // texte fait bouger tout ce que le conteneur centre · le disque se
          // déplaçait sous la souris. Le nom est tronqué plutôt que la boîte
          // élargie ; la première ligne reste donc unique, et la hauteur aussi.
          'pointer-events-none w-52 px-2.5 py-1',
          // Aligné à gauche quand il est posé de côté : centré, ses deux lignes
          // de longueurs différentes dessinaient un axe qui ne correspond à rien.
          beside ? 'text-start' : 'text-center',
        )}
        aria-live="polite"
      >
        <p className="m-0 truncate text-xs font-medium text-foreground">{boxLabel}</p>
        <p
          className={cn(
            'm-0 mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground',
            beside ? 'justify-start' : 'justify-center',
          )}
        >
          <span
            className="inline-block size-2 shrink-0 rounded-full"
            style={{ background: occupancyColor(boxRate) }}
          />
          <span className="tabular-nums">{nightsLabel(boxOccupied, boxTotal)}</span>
        </p>
      </div>
    </div>
  );
}
export function OccupancyByPropertyCard({ period }: { period: DashboardPeriod }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useDashboardOccupancyByProperty(period);
  const photos = useDashboardPropertyPhotos();
  const [chosenView, setChosenView] = React.useState<OccupancyView | null>(null);
  const title = t('dashboard.occupancyByProperty.title', 'Occupation par logement');
  if (isLoading || isError) return <DashboardWidgetState title={title} error={isError} onRetry={() => { void refetch(); }} />;
  const rows = (data ?? []).map((row) => ({ ...row, rate: clampRate(row.rate) }));
  const view = chosenView ?? (rows.length === 1 ? 'radial' : 'bars');
  const nightsLabel = (occupied: number, total: number) => t('dashboard.occupancyByProperty.nights', {
    occupied: occupied.toLocaleString(activeIntlLocale()), total: total.toLocaleString(activeIntlLocale()),
    defaultValue: '{{occupied}} nuits sur {{total}}',
  });
  return <WidgetPanel title={title} count={rows.length} className="db-occupancy"
    caption={t('dashboard.occupancyByProperty.caption', 'Nuits réservées sur la période sélectionnée')}
    action={rows.length > 1 && <div className="bui-widget-panel__switch">
      {([
        { key: 'bars', Icon: ChartBarBigIcon, label: t('dashboard.occupancyByProperty.viewBars', 'Vue en barres') },
        { key: 'radial', Icon: ChartPieIcon, label: t('dashboard.occupancyByProperty.viewRadial', 'Vue en anneaux') },
      ] as const).map(({ key, Icon, label }) => <button key={key} type="button" onClick={() => setChosenView(key)}
        aria-pressed={view === key} aria-label={label} title={label}><Icon aria-hidden="true" /></button>)}
    </div>}
    footer={rows.length > 0 && <Link className="bui-widget-panel__link" to="/properties">
      {t('dashboard.occupancyByProperty.seeProperties', 'Voir les logements')}<ChevronRightIcon className="cn-rtl-flip" aria-hidden="true" />
    </Link>}>
    <div className="db-widget-body db-occupancy__body" tabIndex={0} role="region" aria-label={title}>
      {rows.length === 0 ? <p className="bui-widget-panel__empty">{t('dashboard.occupancyByProperty.empty', 'Aucun logement sur la période.')}</p>
        : view === 'radial' ? <OccupancyRadial rows={rows} averageLabel={t('dashboard.occupancyByProperty.average', 'Moyenne du portefeuille')} nightsLabel={nightsLabel} />
        : <ul className="db-occupancy-list">{rows.map((row) => <li key={row.propertyId} className="db-occupancy-row">
          <PropertyThumbnail name={row.name} src={photos.get(row.propertyId)} />
          <div className="db-occupancy-row__content">
            <div className="db-occupancy-row__heading"><span dir="auto">{row.name}</span><strong>{row.rate.toLocaleString(activeIntlLocale())}<small> %</small></strong></div>
            <div className="db-occupancy-row__track" role="progressbar" aria-label={row.name} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.min(100, row.rate)} aria-valuetext={nightsLabel(row.occupiedNights, row.totalNights)}>
              <div style={{ width: `${Math.min(100, row.rate)}%`, background: occupancyColor(row.rate) }} />
            </div>
            <span className="db-occupancy-row__nights">{nightsLabel(row.occupiedNights, row.totalNights)}</span>
          </div>
        </li>)}</ul>}
    </div>
  </WidgetPanel>;
}

// ─── §4 · Répartition du revenu par canal ───────────────────────────────────

/** Même définition, période et devise que les KPI, sans nouvelle requête. */
export function RevenueByChannelBlock({ period }: { period: DashboardPeriod }) {
  const { t } = useTranslation();
  const { revenueByChannel, financialContext, loading, error, refreshAll } = useDashboardOverview({ period, t });
  const title = t('dashboard.widgets.revenueByChannel', 'Revenus par canal');
  if (loading || error || !revenueByChannel || !financialContext) return <DashboardWidgetState
    title={title} error={!loading} onRetry={refreshAll} />;
  const format = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(activeIntlLocale(), { day: 'numeric', month: 'short' });
  const end = new Date(`${financialContext.toExclusive}T12:00:00`);
  end.setDate(end.getDate() - 1);
  const subtitle = t('dashboard.revenueByChannel.context', 'Hébergement · {{from}} au {{to}}', {
    from: format(financialContext.from),
    to: end.toLocaleDateString(activeIntlLocale(), { day: 'numeric', month: 'short' }),
  });
  return <RevenueByChannelCard title={title} subtitle={subtitle} fromCurrency={financialContext.currency}
    channels={revenueByChannel.map((channel) => ({
      source: channel.source,
      name: channelLabel(channel.source, channel.label === channel.source ? null : channel.label),
      pct: channel.pct,
      amount: channel.amount,
      comparePct: channel.comparePct ?? undefined,
      color: 'var(--bui-navy)',
    }))} />;
}
