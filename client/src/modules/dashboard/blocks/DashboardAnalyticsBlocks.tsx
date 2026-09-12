import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { ChartBarBigIcon, ChartPieIcon } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../../../components/ui/chart';
import { cn } from '../../../utils/cn';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  useDashboardOccupancyByProperty,
  useDashboardRevenueSplit,
} from '../../../hooks/useDashboardAnalyticsBlocks';
import type { DashboardPeriod } from '../DashboardDateFilter';
import { useQuery } from '@tanstack/react-query';
import { dashboardBillingApi } from '../../../services/api/dashboardBillingApi';
import RevenueByChannelCard from '../../../components/baitly/RevenueByChannelCard';
import { channelColor } from './DashboardOperationsBlocks';

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
const REVENUE_CHART_CONFIG = {
  fees: { label: 'Commissions', color: 'var(--bui-chart-2)' },
  interventions: { label: 'Interventions', color: 'var(--bui-chart-4)' },
  payout: { label: 'Versements', color: 'var(--bui-chart-3)' },
  retained: { label: 'Reste', color: 'var(--bui-chart-1)' },
} satisfies ChartConfig;

// ─── §3 — Revenus mensuels, direct vs OTA ───────────────────────────────────

export function MonthlyRevenueSplitCard({ months = 6 }: { months?: number }) {
  const { t } = useTranslation();
  const { data, isLoading } = useDashboardRevenueSplit(months);

  if (isLoading) return null;
  const rows = data ?? [];

  return (
    // `ring-1` et non `border` — même métrique de boîte que le `Card` du design
    // system, sinon cette carte se décale d'un pixel face à sa voisine de ligne
    // (rationnel détaillé sur `BlockCard`, DashboardOperationsBlocks).
    // PAS de `h-full` ici : l'étirement à la hauteur de la ligne est déjà posé
    // par le panneau redimensionnable, qui applique `[&>*]:h-full` à son enfant
    // direct (DashboardWidgetGrid). Le redéclarer était sans effet sur desktop
    // et desastreux en mobile : les widgets y sont EMPILÉS, sans panneau, donc
    // `h-full` valait 100 % de toute la colonne — la carte passait de 294 px à
    // 2167 px, avec un graphique étiré sur toute la hauteur de l'écran.
    <section className="flex flex-col rounded-xl bg-card ring-1 ring-foreground/10 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="cn-font-heading m-0 text-[15px] font-semibold tracking-tight text-foreground">
          {t('dashboard.revenueSplit.title', 'Revenus et versements')} — {months}{' '}
          {t('dashboard.revenueSplit.lastMonths', 'derniers mois')}
        </h3>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          {[
            { key: 'fees', dot: 'bg-chart-2', label: t('dashboard.revenueSplit.fees', 'Commissions') },
            { key: 'interventions', dot: 'bg-chart-4', label: t('dashboard.revenueSplit.interventions', 'Interventions') },
            { key: 'payout', dot: 'bg-chart-3', label: t('dashboard.revenueSplit.payouts', 'Versements') },
            { key: 'retained', dot: 'bg-chart-1', label: t('dashboard.revenueSplit.retained', 'Reste') },
          ].map((item) => (
            <span key={item.key} className="flex items-center gap-1">
              <span className={cn('inline-block size-2 rounded-[3px]', item.dot)} />
              {item.label}
            </span>
          ))}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="m-0 py-6 text-sm text-muted-foreground">
          {t('dashboard.revenueSplit.empty', 'Aucun revenu enregistré sur la période.')}
        </p>
      ) : (
        /* `min-h-52` conserve une hauteur naturelle décente pour la carte ;
           `flex-1` lui laisse prendre davantage si la ligne est plus haute. */
        <ChartContainer config={REVENUE_CHART_CONFIG} className="min-h-52 w-full flex-1">
          <BarChart accessibilityLayer data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={8}
              axisLine={false}
              tickFormatter={(value: string) => value.slice(0, 3)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {/* UN seul `stackId` : les quatre segments s'additionnent au revenu
                du mois. C'est ce qui autorise l'empilement — mettre le revenu ET
                ses sorties dans le même bâton compterait le même argent deux
                fois. Seul le segment du bas porte l'arrondi bas, seul celui du
                haut porte l'arrondi haut. */}
            <Bar dataKey="fees" stackId="m" fill="var(--color-fees)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="interventions" stackId="m" fill="var(--color-interventions)" />
            <Bar dataKey="payout" stackId="m" fill="var(--color-payout)" />
            <Bar dataKey="retained" stackId="m" fill="var(--color-retained)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </section>
  );
}

// ─── §7 — Occupation par logement ───────────────────────────────────────────

/** Seuils de couleur repris de la projection : ≥ 70 % succès, ≥ 50 % primaire, sinon warning. */
function occupancyTone(rate: number): string {
  if (rate >= 70) return 'bg-success';
  if (rate >= 50) return 'bg-primary';
  return 'bg-warning';
}

/** Mêmes seuils, en valeur de couleur : Recharts peint en CSS, pas en classes. */
function occupancyColor(rate: number): string {
  if (rate >= 70) return 'var(--bui-success)';
  if (rate >= 50) return 'var(--bui-primary)';
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
 * de Recharts : ses secteurs n'émettent aucun évènement de souris ici — ni son
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
 * Ce qui a besoin de bornes, c'est le résultat — sous 140 px les anneaux
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
 * que le disque détermine — la vue rétrécirait d'elle-même à chaque passe. Ses
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
  /** Rendu « 12 nuits sur 30 » — la formulation vient de l'appelant (i18n). */
  nightsLabel: (occupied: number, total: number) => string;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState({ side: RADIAL_MIN_PX, beside: false });

  /*
   * Le disque est carré : c'est le plus petit des deux côtés qui le borne, une
   * fois la place de l'encart retirée.
   *
   * L'encart se met à CÔTÉ dès que la largeur le permet — le tableau de bord
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
          role="img"
          aria-label={averageLabel}
        >
          {data.map((row, index) => {
            const radius = RADIAL_OUTER - index * pitch - stroke / 2;
            const circumference = 2 * Math.PI * radius;
            return (
              <g
                key={row.propertyId}
                onMouseEnter={() => setHovered(index)}
                className="cursor-default"
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
                  strokeDasharray={`${(circumference * row.rate) / 100} ${circumference}`}
                  transform={`rotate(-90 ${centre} ${centre})`}
                  className="pointer-events-none"
                />
                {/* Repli natif : le nom reste accessible même sans notre infobulle. */}
                <title>{`${row.name} — ${row.rate}%`}</title>
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
            {boxRate}%
          </span>
        </div>

      </div>

      {/* Encart À CÔTÉ du disque, dans le flux — sous lui quand la largeur
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
          // texte fait bouger tout ce que le conteneur centre — le disque se
          // déplaçait sous la souris. Le nom est tronqué plutôt que la boîte
          // élargie ; la première ligne reste donc unique, et la hauteur aussi.
          'pointer-events-none w-52 rounded-lg border border-border bg-card px-2.5 py-1',
          // Aligné à gauche quand il est posé de côté : centré, ses deux lignes
          // de longueurs différentes dessinaient un axe qui ne correspond à rien.
          beside ? 'text-start' : 'text-center',
        )}
        aria-live="polite"
      >
        <p className="m-0 truncate text-xs font-medium text-foreground">{boxLabel}</p>
        <p
          className={cn(
            'm-0 mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground',
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
  const { data, isLoading } = useDashboardOccupancyByProperty(period);
  // `null` tant que rien n'a été choisi : la vue par défaut suit alors le nombre
  // de logements. Dès que l'utilisateur bascule, son choix prime. ⚠️ Déclaré
  // avant tout early return (règles des hooks).
  const [chosenView, setChosenView] = React.useState<OccupancyView | null>(null);

  if (isLoading) return null;
  const rows = (data ?? []).map((row) => ({ ...row, rate: clampRate(row.rate) }));
  const single = rows.length === 1;
  // Une barre solitaire ne compare rien : à un seul logement, l'anneau dit mieux
  // « 90 % de rempli » qu'une piste remplie aux neuf dixièmes.
  const view: OccupancyView = chosenView ?? (single ? 'radial' : 'bars');

  return (
    // La colonne flex reste — le `flex-1` de la vue radiale a besoin d'un axe
    // pour réclamer son espace. En revanche PAS de `h-full` : le panneau
    // redimensionnable le pose déjà sur son enfant direct, et en mobile, où les
    // widgets sont empilés sans panneau, il valait 100 % de toute la colonne.
    <section className="flex flex-col rounded-xl bg-card ring-1 ring-foreground/10 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('dashboard.occupancyByProperty.title', 'Occupation par logement')}
        </h3>
        {/* La bascule n'apparaît qu'à partir de deux logements : sur un seul, les
            deux vues diraient la même chose et le choix serait décoratif. */}
        {rows.length > 1 && (
          <div className="flex items-center gap-0.5">
            {(
              [
                { key: 'bars', Icon: ChartBarBigIcon,
                  label: t('dashboard.occupancyByProperty.viewBars', 'Vue en barres') },
                { key: 'radial', Icon: ChartPieIcon,
                  label: t('dashboard.occupancyByProperty.viewRadial', 'Vue en anneaux') },
              ] as const
            ).map(({ key, Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setChosenView(key)}
                aria-pressed={view === key}
                aria-label={label}
                title={label}
                className={cn(
                  'flex size-6 cursor-pointer items-center justify-center rounded-md',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  view === key ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="m-0 py-2 text-sm text-muted-foreground">
          {t('dashboard.occupancyByProperty.empty', 'Aucun logement sur la période.')}
        </p>
      ) : view === 'radial' ? (
        /* Le composant porte lui-même son `flex-1` et se mesure : il réclame ce
           qui reste sous l'en-tête, puis y dessine le plus grand disque que cet
           espace admet. La carte est étirée à la hauteur de sa voisine de ligne,
           et cette hauteur n'est connue qu'à l'exécution. */
        <OccupancyRadial
          rows={rows}
          averageLabel={t('dashboard.occupancyByProperty.average', 'Moyenne du portefeuille')}
          nightsLabel={(occupied, total) =>
            t('dashboard.occupancyByProperty.nights', {
              occupied,
              total,
              defaultValue: '{{occupied}} nuits sur {{total}}',
            })
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((row) => {
            const rate = row.rate;
            return (
              <div key={row.propertyId} className="flex items-center gap-2.5">
                <span className="w-32 truncate text-xs font-medium text-foreground" title={row.name}>
                  {row.name}
                </span>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={rate}
                  aria-label={row.name}
                  className="h-2 flex-1 overflow-hidden rounded-full bg-field"
                >
                  <div
                    className={cn('h-full rounded-full', occupancyTone(rate))}
                    style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-end text-xs text-muted-foreground tabular-nums">
                  {rate}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── §4 — Répartition du revenu par canal ───────────────────────────────────

/**
 * Remplace `BillingOverviewWidget` (MUI) par la carte Baitly de la projection.
 *
 * Le bascule mois / année de l'ancien widget est conservé : c'est le seul
 * réglage qu'il portait, et il ne figure pas dans la projection — le perdre
 * aurait été une régression silencieuse.
 */
export function RevenueByChannelBlock() {
  const { t } = useTranslation();
  const [scope, setScope] = React.useState<'month' | 'year'>('month');
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'billing-overview', scope],
    queryFn: () => dashboardBillingApi.getOverview(scope),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return null;

  const channels = (data?.channels ?? []).map((channel) => ({
    name: channel.label,
    pct: channel.pct,
    amount: channel.amount,
    color: channelColor(channel.source),
  }));

  // Le basculement mois / année occupe le slot d'en-tête de la carte : posé
  // au-dessus, il flottait détaché, sans rien pour le rattacher au titre.
  const scopeToggle = (
    <div className="flex items-center gap-1">
      {(['month', 'year'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setScope(value)}
          aria-pressed={scope === value}
          className={`cursor-pointer rounded-md px-2 py-0.5 text-xs transition-colors duration-150 ${
            scope === value
              ? 'bg-accent font-medium text-foreground'
              : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          {value === 'month'
            ? t('dashboard.revenueByChannel.month', 'Mois')
            : t('dashboard.revenueByChannel.year', 'Année')}
        </button>
      ))}
    </div>
  );

  return <RevenueByChannelCard channels={channels} headerAction={scopeToggle} />;
}
