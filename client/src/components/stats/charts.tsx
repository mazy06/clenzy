import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../ui';

/**
 * Les graphiques du langage « statistiques » de Baitly.
 *
 * <p>Ils sont nés dans l'onglet Statistiques de l'Annuaire et vivent ici parce
 * que les Rapports en tiennent désormais le même discours : une tuile, un
 * titre, un graphique qui remplit la place qu'on lui donne — jamais une
 * hauteur qu'il réclame pour lui.</p>
 *
 * <p>Toutes les couleurs sont des JETONS de série (`--bui-chart-*`), jamais des
 * hexadécimaux : c'est ainsi que le thème clair et le thème sombre suivent sans
 * qu'on ait à les traiter séparément.</p>
 */
export const SERIES_TOKENS = [
  'var(--bui-chart-1)',
  'var(--bui-chart-2)',
  'var(--bui-chart-3)',
  'var(--bui-chart-4)',
  'var(--bui-chart-5)',
];

/** Teintes sémantiques, pour les séries qui portent un jugement (bon / mauvais). */
export const TONE_TOKENS = {
  success: 'var(--bui-success)',
  warning: 'var(--bui-warning)',
  destructive: 'var(--bui-destructive)',
  info: 'var(--bui-info)',
  primary: 'var(--bui-primary)',
  /** Série de référence — un N-1, une projection : présente, mais en retrait. */
  neutral: 'var(--bui-faint)',
} as const;

export type SeriesTone = keyof typeof TONE_TOKENS;

/** Une part d'une répartition : un libellé, un effectif. */
export interface StatBucket {
  label: string;
  count: number;
}

/** Une série d'un graphique multi-séries. */
export interface SeriesDef {
  /** Clé lue dans les points de données. */
  key: string;
  label: string;
  /** Index dans {@link SERIES_TOKENS}. Ignoré si `tone` est donné. */
  tokenIndex?: number;
  tone?: SeriesTone;
  /** Trait pointillé — pour une série de référence (N-1, projection). */
  dashed?: boolean;
  /** Empilement : les séries qui partagent une pile s'additionnent. */
  stackId?: string;
}

export type ValueFormatter = (value: number) => string;

/**
 * Largeur rendue de l'element, pour les decisions que le CSS ne peut pas prendre.
 *
 * <p>La reference se pose sur un conteneur, jamais sur `ChartContainer` : en
 * React 18 une `ref` passee a un composant fonction sans `forwardRef` est
 * ignoree en silence — la mesure ne serait jamais declenchee et le defaut
 * s'appliquerait partout sans que rien ne le signale.</p>
 */
function useMeasuredWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

/**
 * Gouttière de l'axe des ordonnées.
 *
 * <p>La marge négative colle l'axe au bord : elle est taillée pour des
 * effectifs à deux ou trois chiffres. Un montant ou un taux formaté y est rogné
 * par la gauche — « 12 000,00 € » se lisait « 0,00 € » à toutes les
 * graduations. Dès qu'un formateur est fourni, l'axe reprend sa largeur.</p>
 */
const axisGutter = (formatValue?: ValueFormatter) =>
  formatValue ? { margin: 0, width: 62 } : { margin: -16, width: undefined };

/**
 * Coupe un libellé trop long pour sa colonne.
 *
 * <p>Recharts REPLIE un libellé qui déborde au lieu de le couper : « Cottage
 * des Tanneurs » passait sur deux lignes et mordait sur la barre du dessous.
 * Six pixels par caractère à 10 px de corps — le nom entier reste dans
 * l'infobulle.</p>
 */
const clipLabel = (width: number, value: string) => {
  // 6,6 px par caractere a 12 px de corps, moins la marge du tick : une
  // majuscule de plus et le libelle mordait sur le bord de la tuile.
  const max = Math.floor((width - 14) / 6.6);
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

/**
 * Libellé de catégorie sur UNE ligne.
 *
 * <p>Recharts passe la largeur de l'axe à son composant `Text`, qui replie au
 * mot dès qu'il la croit dépassée — et il la croit dépassée à tort : il mesure
 * avec la police par défaut du SVG alors que le corps réel (12 px) vient d'une
 * classe CSS posée par le conteneur. « Appartement Médina », large de 112 px
 * dans une colonne de 132, passait ainsi sur deux lignes et mordait sur la
 * barre voisine.</p>
 *
 * <p>Un `<text>` sans prop `width` ne peut pas se replier. Recharts l'enveloppe
 * dans le groupe `.recharts-cartesian-axis-tick`, d'où la teinte et le corps
 * des autres graduations — rien à styler à la main.</p>
 */
/**
 * Libelle d'abscisse en biais, coupe a la place disponible.
 *
 * <p>A -22 degres, un libelle de L pixels en occupe environ 0,37 L en hauteur.
 * La bande d'axe fait 52 px : au-dela d'une vingtaine de caracteres le nom
 * deborde et vient chevaucher la legende — « Equipe Entretien Clenzy - Paris »
 * la traversait de part en part sur telephone.</p>
 */
const ANGLED_MAX_CHARS = 20;

const angledTick = ({
  x,
  y,
  payload,
}: {
  x?: string | number;
  y?: string | number;
  payload?: { value?: unknown };
}) => {
  const raw = String(payload?.value ?? '');
  const label = raw.length > ANGLED_MAX_CHARS ? `${raw.slice(0, ANGLED_MAX_CHARS - 1)}…` : raw;
  return (
    <text x={x} y={y} dy={10} textAnchor="end" transform={`rotate(-22, ${x}, ${y})`}>
      {label}
    </text>
  );
};

const categoryTick =
  (width: number) =>
  ({
    x,
    y,
    payload,
  }: {
    x?: string | number;
    y?: string | number;
    payload?: { value?: unknown };
  }) => (
    <text x={x} y={y} dy={4} textAnchor="end">
      {clipLabel(width, String(payload?.value ?? ''))}
    </text>
  );

/**
 * Teinte d'une série.
 *
 * <p>Une teinte inconnue retombe sur le jeton de série. Sans ce repli, elle
 * valait `undefined` : recharts recevait un `fill` vide et dessinait la barre
 * en NOIR, sans qu'aucun typecheck ne le signale — la série venait d'une source
 * serveur, dont les chaînes ne sont pas contraintes par le type local.</p>
 */
export const seriesColor = (series: SeriesDef, fallbackIndex = 0): string => {
  const token = SERIES_TOKENS[(series.tokenIndex ?? fallbackIndex) % SERIES_TOKENS.length];
  if (!series.tone) return token;
  return TONE_TOKENS[series.tone] ?? token;
};

const buildConfig = (series: SeriesDef[]): ChartConfig =>
  Object.fromEntries(
    series.map((s, i) => [s.key, { label: s.label, color: seriesColor(s, i) }]),
  );

/**
 * Valeurs formatées dans l'infobulle.
 *
 * <p>Le contenu par défaut affiche `toLocaleString()` : un montant y perd sa
 * devise et un taux son signe pourcent. Ce formateur rend la rangée complète —
 * c'est le contrat de `ChartTooltipContent`, qui remplace toute la ligne dès
 * qu'un formateur est fourni.</p>
 */
export const tooltipValue =
  (format: ValueFormatter) =>
  (
    value: unknown,
    name: unknown,
    item: { color?: string; payload?: { fill?: string } },
  ) => (
    <>
      <span
        aria-hidden="true"
        className="mt-[3px] size-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: item?.color ?? item?.payload?.fill ?? 'var(--bui-primary)' }}
      />
      <span className="flex-1 text-muted-foreground">{String(name ?? '')}</span>
      <span className="font-medium tabular-nums text-foreground">
        {format(Number(value))}
      </span>
    </>
  );

/** Une part sans effectif ne se voit pas ; inutile de la porter à l'anneau. */
const positive = (buckets: StatBucket[]) => buckets.filter((b) => b.count > 0);

/**
 * Une barre à zéro n'apprend rien, mais une barre NÉGATIVE si : un pace de
 * −12 % est précisément ce qu'on vient lire.
 */
const nonZero = (buckets: StatBucket[]) => buckets.filter((b) => b.count !== 0);

export const EmptyChart: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
    {message ?? 'Aucune donnée à représenter.'}
  </div>
);

/**
 * Répartition en anneau, avec sa légende chiffrée.
 *
 * <p>Un anneau plutôt qu'un camembert plein : le centre libre porte le total,
 * et l'œil compare mieux des arcs que des secteurs. Au-delà de six parts la
 * queue est regroupée sous « Autres » — un anneau à quinze parts n'est plus
 * lisible et ses libellés se chevauchent.</p>
 *
 * <p>La légende donne l'effectif ET la part, alignés en chiffres tabulaires
 * pour que les colonnes se comparent verticalement. Elle passe à côté de
 * l'anneau quand la tuile est large, dessous quand elle est étroite.</p>
 */
export const DonutChart: React.FC<{
  buckets: StatBucket[];
  totalLabel: string;
  /** Formatage des valeurs (montants, taux). Par défaut, l'entier brut. */
  formatValue?: ValueFormatter;
  /**
   * Formatage du TOTAL au centre. Le trou de l'anneau fait une centaine de
   * pixels : « 17 132,00 € » en déborde. Par défaut, `formatValue`.
   */
  formatTotal?: ValueFormatter;
  otherLabel?: string;
}> = ({ buckets, totalLabel, formatValue, formatTotal, otherLabel = 'Autres' }) => {
  const parts = positive(buckets);
  const MAX_SLICES = 6;
  const shown =
    parts.length > MAX_SLICES
      ? [
          ...parts.slice(0, MAX_SLICES - 1),
          {
            label: otherLabel,
            count: parts.slice(MAX_SLICES - 1).reduce((sum, b) => sum + b.count, 0),
          },
        ]
      : parts;

  const total = shown.reduce((sum, b) => sum + b.count, 0);
  const format = formatValue ?? ((v: number) => `${v}`);
  const formatCenter = formatTotal ?? format;

  const config: ChartConfig = Object.fromEntries(
    shown.map((b, i) => [
      b.label,
      { label: b.label, color: SERIES_TOKENS[i % SERIES_TOKENS.length] },
    ]),
  );

  if (shown.length === 0) return <EmptyChart />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 @[380px]:flex-row">
      <div className="min-h-0 min-w-0 flex-1">
        <ChartContainer config={config} className="aspect-auto h-full w-full">
          <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <ChartTooltip
              content={
                <ChartTooltipContent nameKey="label" formatter={tooltipValue(format)} />
              }
            />
            <Pie
              data={shown}
              dataKey="count"
              nameKey="label"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={2}
              cornerRadius={3}
              strokeWidth={0}
            >
              {shown.map((b, i) => (
                <Cell key={b.label} fill={SERIES_TOKENS[i % SERIES_TOKENS.length]} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                  const { cx, cy } = viewBox as { cx: number; cy: number };
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan
                        x={cx}
                        dy="-0.15em"
                        className="fill-foreground text-xl font-bold"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatCenter(total)}
                      </tspan>
                      <tspan x={cx} dy="1.5em" className="fill-muted-foreground text-2xs">
                        {totalLabel}
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>

      {/* Empilee, la legende `shrink-0` gardait sa hauteur entiere et rognait la
          couronne au-dessus d'elle. A cote, elle reprend sa largeur fixe. */}
      <ul className="no-scrollbar m-0 flex min-h-0 list-none flex-col justify-center gap-1 overflow-y-auto p-0 @[380px]:max-h-full @[380px]:w-[46%] @[380px]:shrink-0">
        {shown.map((b, i) => (
          <li key={b.label} className="flex items-baseline gap-1.5 text-2xs">
            <span
              aria-hidden="true"
              className="mt-1 size-2 shrink-0 rounded-[2.5px]"
              style={{ backgroundColor: SERIES_TOKENS[i % SERIES_TOKENS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground" title={b.label}>
              {b.label}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {format(b.count)}
            </span>
            <span className="w-8 shrink-0 text-end tabular-nums text-muted-foreground">
              {total > 0 ? Math.round((b.count / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Histogramme horizontal d'une répartition.
 *
 * <p>Horizontal : les libellés sont des noms — de ville, de bien, d'équipe —
 * qui tiennent sur une ligne mais seraient tronqués ou pivotés sous une colonne
 * verticale.</p>
 */
export const HistogramChart: React.FC<{
  buckets: StatBucket[];
  label: string;
  tokenIndex?: number;
  tone?: SeriesTone;
  formatValue?: ValueFormatter;
  /** Teinte par barre — pour une échelle de jugement (vert / ambre / rouge). */
  colorFor?: (bucket: StatBucket) => string;
  labelWidth?: number;
}> = ({ buckets, label, tokenIndex = 0, tone, formatValue, colorFor, labelWidth = 96 }) => {
  const parts = nonZero(buckets);
  const base = tone ? TONE_TOKENS[tone] : SERIES_TOKENS[tokenIndex % SERIES_TOKENS.length];
  const config: ChartConfig = { count: { label, color: base } };
  const [boxRef, boxWidth] = useMeasuredWidth<HTMLDivElement>();

  // Une colonne de 132 px prend 38 % d'un ecran de telephone : il ne reste plus
  // de quoi comparer les barres. Au-dela du tiers de la largeur, on rogne — la
  // graduation se coupe alors plus court, jamais elle ne se replie.
  const gutter = boxWidth > 0 ? Math.max(56, Math.min(labelWidth, boxWidth * 0.34)) : labelWidth;

  if (parts.length === 0) return <EmptyChart />;

  return (
    <div ref={boxRef} className="h-full w-full">
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <BarChart
        accessibilityLayer
        layout="vertical"
        data={parts}
        margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          tickFormatter={formatValue}
        />
        <YAxis
          type="category"
          dataKey="label"
          axisLine={false}
          tickLine={false}
          width={gutter}
          tickMargin={6}
          interval={0}
          tick={categoryTick(gutter)}
        />
        <ChartTooltip
          content={
            formatValue ? <ChartTooltipContent formatter={tooltipValue(formatValue)} /> : <ChartTooltipContent />
          }
        />
        <Bar dataKey="count" name={label} fill="var(--color-count)" radius={[0, 3, 3, 0]} maxBarSize={18}>
          {colorFor
            ? parts.map((bucket) => <Cell key={bucket.label} fill={colorFor(bucket)} />)
            : null}
        </Bar>
      </BarChart>
    </ChartContainer>
    </div>
  );
};

interface MultiSeriesProps<P> {
  data: P[];
  series: SeriesDef[];
  formatValue?: ValueFormatter;
  /** Masque la légende quand une seule série est tracée. */
  hideLegend?: boolean;
}

/**
 * Plusieurs répartitions comparées catégorie par catégorie.
 *
 * <p>Groupées côte à côte par défaut ; empilées si les séries partagent un
 * `stackId` — on empile quand la question est le total autant que sa
 * composition, on juxtapose quand c'est l'écart entre les séries.</p>
 */
export const GroupedBarChart = <P extends { label: string }>({
  data,
  series,
  formatValue,
  hideLegend,
  angled,
}: MultiSeriesProps<P> & { angled?: boolean }) => {
  const config = buildConfig(series);
  const [boxRef, boxWidth] = useMeasuredWidth<HTMLDivElement>();

  if (data.length === 0) return <EmptyChart />;

  const last = series.length - 1;
  const gutter = axisGutter(formatValue);

  // Un axe en biais force toutes les graduations : douze noms d'equipe sur une
  // tuile pleine largeur se lisent, les memes sur un telephone forment une
  // bouillie. Sous ~40 px par categorie, recharts ne garde que ce qui tient.
  const dense = boxWidth > 0 && boxWidth / data.length < 40;
  const interval: 0 | 'preserveStartEnd' | 'preserveEnd' = angled
    ? dense
      ? 'preserveStartEnd'
      : 0
    : 'preserveEnd';

  return (
    <div ref={boxRef} className="h-full w-full">
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ top: 4, right: 8, bottom: angled ? 8 : 0, left: gutter.margin }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={6}
          height={angled ? 56 : undefined}
          interval={interval}
          tick={angled ? angledTick : undefined}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={gutter.width}
          tickFormatter={formatValue}
        />
        <ChartTooltip
          content={
            formatValue ? <ChartTooltipContent formatter={tooltipValue(formatValue)} /> : <ChartTooltipContent />
          }
        />
        {hideLegend ? null : <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId={s.stackId}
            fill={seriesColor(s, i)}
            radius={s.stackId && i !== last ? undefined : [3, 3, 0, 0]}
            maxBarSize={22}
          />
        ))}
      </BarChart>
    </ChartContainer>
    </div>
  );
};

/**
 * Évolution dans le temps, en aires.
 *
 * <p>Une aire parce que la question est le volume ; empilée quand les séries se
 * composent, superposée en transparence quand elles se comparent.</p>
 */
export const TrendAreaChart = <P extends { label: string }>({
  data,
  series,
  formatValue,
  hideLegend,
  stacked,
}: MultiSeriesProps<P> & { stacked?: boolean }) => {
  const config = buildConfig(series);
  if (data.length === 0) return <EmptyChart />;

  const gutter = axisGutter(formatValue);

  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ top: 4, right: 8, bottom: 0, left: gutter.margin }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={6} />
        <YAxis
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={gutter.width}
          tickFormatter={formatValue}
        />
        <ChartTooltip
          content={
            formatValue ? <ChartTooltipContent formatter={tooltipValue(formatValue)} /> : <ChartTooltipContent />
          }
        />
        {hideLegend ? null : <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stackId={stacked ? 'a' : undefined}
            stroke={seriesColor(s, i)}
            strokeWidth={1.75}
            strokeDasharray={s.dashed ? '5 3' : undefined}
            fill={seriesColor(s, i)}
            fillOpacity={0.22}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
};

/**
 * Évolution dans le temps, en courbes.
 *
 * <p>Des traits plutôt que des aires quand les séries n'ont pas d'unité
 * commune à additionner : un prix moyen et un RevPAN se comparent, ils ne
 * s'empilent pas.</p>
 */
export const TrendLineChart = <P extends { label: string }>({
  data,
  series,
  formatValue,
  hideLegend,
  referenceValue,
  referenceLabel,
}: MultiSeriesProps<P> & { referenceValue?: number; referenceLabel?: string }) => {
  const config = buildConfig(series);
  if (data.length === 0) return <EmptyChart />;

  const gutter = axisGutter(formatValue);

  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <LineChart
        accessibilityLayer
        data={data}
        margin={{ top: 4, right: 8, bottom: 0, left: gutter.margin }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={6} />
        <YAxis axisLine={false} tickLine={false} width={gutter.width} tickFormatter={formatValue} />
        <ChartTooltip
          content={
            formatValue ? <ChartTooltipContent formatter={tooltipValue(formatValue)} /> : <ChartTooltipContent />
          }
        />
        {hideLegend ? null : <ChartLegend content={<ChartLegendContent />} />}
        {referenceValue !== undefined ? (
          <ReferenceLine
            y={referenceValue}
            stroke="var(--bui-faint)"
            strokeDasharray="4 4"
            label={{
              value: referenceLabel,
              position: 'insideTopRight',
              fill: 'var(--bui-muted-foreground)',
              fontSize: 10,
            }}
          />
        ) : null}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={seriesColor(s, i)}
            strokeWidth={1.75}
            strokeDasharray={s.dashed ? '5 3' : undefined}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
};
