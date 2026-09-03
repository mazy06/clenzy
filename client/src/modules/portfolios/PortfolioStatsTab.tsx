import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import StatusChip from '../../components/StatusChip';
import {
  Card,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Progress,
  Spinner,
  type CarouselApi,
  type ChartConfig,
} from '../../components/ui';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useViewportFill } from '../../hooks/useViewportFill';
import {
  portfoliosApi,
  portfoliosKeys,
  type PortfolioStats,
} from '../../services/api/portfoliosApi';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import {
  CHART_HEIGHT,
  CoverageChart,
  DonutChart,
  HistogramChart,
  SERIES_TOKENS,
  TimelineChart,
} from './PortfolioCharts';

/** Le `t` du hook, plutot qu'une signature reecrite a la main qui diverge. */
type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * Statistiques des portefeuilles.
 *
 * <p>Refonte : la composition n'occupait qu'une carte minuscule en haut d'une
 * colonne vide sur toute sa hauteur, pendant que la colonne voisine deroulait
 * six lignes identiques — meme horodatage, meme badge-icone repete. Les
 * chiffres, eux, n'etaient que des chiffres : rien ne se comparait d'un coup
 * d'oeil.</p>
 *
 * <p>La composition devient un vrai graphique — les primitives du kit
 * (`ChartContainer`, recharts habille des jetons du theme), pas un dessin
 * maison —, ce qui remplit la colonne et rend les portefeuilles comparables.
 * L'etat du parc passe par une barre segmentee, mais SEULEMENT s'il y a
 * quelque chose a signaler : une barre a 100 % sur tous les ecrans n'apprend
 * rien.</p>
 */
const PortfolioStatsTab: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  // Appele AVANT tout retour anticipe : regle des Hooks.
  const [fillRef, fillHeight] = useViewportFill<HTMLDivElement>();

  const statsQuery = useQuery({
    queryKey: portfoliosKeys.stats(user?.id ?? ''),
    queryFn: () => portfoliosApi.getStatsByManager(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const stats = statsQuery.data;

  if (statsQuery.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (statsQuery.isError) {
    return (
      <p className="py-6 text-center text-sm text-destructive">
        {t('portfolios.errors.connectionError')}
      </p>
    );
  }

  if (!stats) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t('portfolios.statistics.noDataAvailable')}
      </p>
    );
  }

  // Le nom du portefeuille sur chaque ligne d'activite est du bruit quand il
  // n'y en a qu'un : il ne distingue rien.
  const manyPortfolios = stats.portfolioBreakdown.length > 1;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="mb-0.5 text-balance text-base font-semibold tracking-tight text-foreground">
          {t('portfolios.statistics.title')}
        </h2>
        <p className="m-0 text-xs text-muted-foreground">
          {t('portfolios.statistics.subtitleStats')}
        </p>
      </div>

      <SummaryBand stats={stats} t={t} />

      {/* La hauteur mesuree descend ici. `min-h-0` leve le plancher
          `min-height: auto` des elements de grille : sans lui la colonne
          d'activite ne pourrait pas devenir plus courte que son contenu, donc
          ne defilerait jamais et etirerait la page. */}
      <div
        ref={fillRef}
        style={fillHeight ? { height: fillHeight } : undefined}
        className="grid grid-cols-1 items-stretch gap-3 min-[1100px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] min-[1100px]:grid-rows-[minmax(0,1fr)]"
      >
        <ChartCarousel stats={stats} t={t} />
        <RecentActivity
          assignments={stats.recentAssignments}
          showPortfolio={manyPortfolios}
          t={t}
        />
      </div>
    </div>
  );
};

// ─── Bande de synthese ───────────────────────────────────────────────────────

const SummaryBand: React.FC<{ stats: PortfolioStats; t: Translate }> = ({
  stats,
  t,
}) => {
  const totalPortfolios = stats.totalPortfolios;
  const inactive = stats.inactivePortfolios;
  const activeShare = totalPortfolios > 0 ? (stats.activePortfolios / totalPortfolios) * 100 : 0;

  // Deux ratios que les totaux bruts ne disent pas : combien d'intervenants
  // pour tenir un logement, et quelle taille de parc par client.
  const staffPerProperty =
    stats.totalProperties > 0 ? stats.totalTeamMembers / stats.totalProperties : null;
  const propertiesPerClient =
    stats.totalClients > 0 ? stats.totalProperties / stats.totalClients : null;

  return (
    <Card className="flex flex-col gap-2.5 border-border p-3">
      <div className="flex flex-row flex-wrap items-baseline gap-x-6 gap-y-2">
        <Figure value={totalPortfolios} label={t('portfolios.statistics.portfolios')} />
        <Figure value={stats.totalClients} label={t('portfolios.statistics.clients')} />
        <Figure value={stats.totalProperties} label={t('portfolios.statistics.properties')} />
        <Figure value={stats.totalTeamMembers} label={t('portfolios.statistics.staff')} />
        {staffPerProperty !== null ? (
          <Figure
            value={staffPerProperty.toFixed(1)}
            label={t('portfolios.statistics.staffPerProperty', 'intervenants / logement')}
            muted
          />
        ) : null}
        {propertiesPerClient !== null ? (
          <Figure
            value={propertiesPerClient.toFixed(1)}
            label={t('portfolios.statistics.propertiesPerClient', 'logements / client')}
            muted
          />
        ) : null}
      </div>

      {/* La barre n'apparait QUE s'il y a un portefeuille inactif. Une jauge
          bloquee a 100 % sur tous les ecrans est une decoration, pas une
          statistique — et le chiffre en rouge suffit a alerter. */}
      {inactive > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {stats.activePortfolios}/{totalPortfolios}{' '}
              {t('portfolios.statistics.activeShare', 'actifs')}
            </span>
            <span className="font-semibold tabular-nums text-warning-ink">
              {inactive} {t('portfolios.teamManagement.inactive')}
            </span>
          </div>
          <Progress value={activeShare} className="h-1.5" />
        </div>
      ) : null}
    </Card>
  );
};

const Figure: React.FC<{ value: number | string; label: string; muted?: boolean }> = ({
  value,
  label,
  muted,
}) => (
  <span className="flex items-baseline gap-1.5">
    <b
      className={cn(
        'font-[family-name:var(--font-display)] text-lg font-bold tabular-nums',
        muted ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {value}
    </b>
    <span className="text-xs text-muted-foreground">{label}</span>
  </span>
);

// ─── Le carrousel de graphiques ──────────────────────────────────────────────

interface Vue {
  cle: string;
  titre: string;
  precision?: string;
  render: () => React.ReactNode;
}

/**
 * Les graphiques defilent au lieu de s'empiler.
 *
 * <p>Six vues cote a cote se reduiraient a des vignettes illisibles, et les
 * empiler ferait defiler la page sur trois hauteurs d'ecran. Le carrousel
 * n'est donc pas un ornement : il donne a chaque graphique la largeur qu'il
 * lui faut. Le titre et la position restent HORS du carrousel, pour qu'on sache
 * toujours ce qu'on regarde et combien il reste a voir.</p>
 */
const ChartCarousel: React.FC<{ stats: PortfolioStats; t: Translate }> = ({ stats, t }) => {
  const [api, setApi] = useState<CarouselApi>();
  const [courant, setCourant] = useState(0);

  React.useEffect(() => {
    if (!api) return undefined;
    const sync = () => setCourant(api.selectedScrollSnap());
    sync();
    api.on('select', sync);
    return () => {
      api.off('select', sync);
    };
  }, [api]);

  const labelClients = t('portfolios.statistics.clientsLabel');
  const labelStaff = t('portfolios.statistics.staff');
  const labelProperties = t('portfolios.statistics.properties');

  // Une vue dont la donnee est vide n'entre pas dans le carrousel : faire
  // defiler jusqu'a un graphique vide est une promesse non tenue.
  const vues: Vue[] = ([
    {
      cle: 'composition',
      titre: t('portfolios.statistics.composition'),
      precision: t('portfolios.statistics.chartScope', 'Clients et intervenants rattachés'),
      render: () => <CompositionChart breakdown={stats.portfolioBreakdown} t={t} />,
    },
    // Deux mois au minimum : une aire tracee sur un seul point ne dessine
    // rien, et « dans le temps » ne veut rien dire sur un mois unique.
    stats.assignmentsByMonth.length > 1 && {
      cle: 'timeline',
      titre: t('portfolios.statistics.overTime', 'Rattachements dans le temps'),
      precision: t('portfolios.statistics.overTimeHint', 'Par mois, clients et intervenants'),
      render: () => (
        <TimelineChart
          points={stats.assignmentsByMonth}
          clientsLabel={labelClients}
          staffLabel={labelStaff}
        />
      ),
    },
    stats.staffByTrade.length > 0 && {
      cle: 'trades',
      titre: t('portfolios.statistics.byTrade', 'Intervenants par métier'),
      render: () => <DonutChart buckets={stats.staffByTrade} totalLabel={labelStaff} />,
    },
    (stats.propertiesByCity.length > 0 || stats.staffByCity.length > 0) && {
      cle: 'coverage',
      titre: t('portfolios.statistics.coverage', 'Couverture par ville'),
      precision: t(
        'portfolios.statistics.coverageHint',
        'Une ville sans intervenant appelle un rattachement',
      ),
      render: () => (
        <CoverageChart
          properties={stats.propertiesByCity}
          staff={stats.staffByCity}
          propertiesLabel={labelProperties}
          staffLabel={labelStaff}
        />
      ),
    },
    stats.propertiesByType.length > 0 && {
      cle: 'types',
      titre: t('portfolios.statistics.byPropertyType', 'Logements par type'),
      render: () => <DonutChart buckets={stats.propertiesByType} totalLabel={labelProperties} />,
    },
    stats.staffByCity.length > 0 && {
      cle: 'staffCity',
      titre: t('portfolios.statistics.staffByCity', 'Intervenants par ville'),
      render: () => <HistogramChart buckets={stats.staffByCity} label={labelStaff} tokenIndex={1} />,
    },
  ] as Array<Vue | false>).filter(Boolean) as Vue[];

  const vue = vues[Math.min(courant, vues.length - 1)];

  return (
    <Card className="flex min-h-0 flex-col gap-2.5 border-border p-3.5">
      {/* Titre HORS du carrousel : il doit rester lisible pendant la
          transition, et c'est lui qui dit ce qu'on regarde. */}
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-sm font-semibold tracking-tight text-foreground">
            {vue?.titre}
          </h3>
          {vue?.precision ? (
            <p className="m-0 mt-0.5 truncate text-2xs text-muted-foreground">{vue.precision}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
          {courant + 1} / {vues.length}
        </span>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <Carousel setApi={setApi} opts={{ align: 'start', loop: false }}>
          <CarouselContent className="ms-0">
            {vues.map((v) => (
              <CarouselItem key={v.cle} className="ps-0">
                {v.render()}
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Les fleches ne servent a rien sur une vue unique. */}
          {vues.length > 1 ? (
            <>
              <CarouselPrevious className="-start-1 size-7" />
              <CarouselNext className="-end-1 size-7" />
            </>
          ) : null}
        </Carousel>
      </div>

      {/* Des puces cliquables : sur six vues, viser directement vaut mieux que
          cinq clics sur une fleche. Ce sont de vrais boutons, donc focusables
          au clavier et annonces comme actionnables. */}
      {vues.length > 1 ? (
        <div className="flex shrink-0 flex-wrap justify-center gap-1.5">
          {vues.map((v, i) => (
            <button
              key={v.cle}
              type="button"
              onClick={() => api?.scrollTo(i)}
              aria-label={v.titre}
              aria-current={i === courant}
              className={cn(
                'h-1.5 cursor-pointer rounded-full transition-all duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                i === courant ? 'w-5 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground',
              )}
            />
          ))}
        </div>
      ) : null}
    </Card>
  );
};

// ─── Composition par portefeuille ──────────────────────────────────────────────

const CompositionChart: React.FC<{
  breakdown: PortfolioStats['portfolioBreakdown'];
  t: Translate;
}> = ({ breakdown, t }) => {
  const config: ChartConfig = {
    clients: { label: t('portfolios.statistics.clientsLabel'), color: SERIES_TOKENS[0] },
    staff: { label: t('portfolios.statistics.staff'), color: SERIES_TOKENS[1] },
  };

  const data = breakdown.map((portfolio) => ({
    name: portfolio.portfolioName,
    clients: portfolio.clientCount,
    staff: portfolio.teamMemberCount,
  }));

  return (
    <div className="flex flex-col gap-2">
      {data.length === 0 ? (
        <p className="m-0 py-6 text-center text-xs text-muted-foreground">
          {t('portfolios.statistics.noDataAvailable')}
        </p>
      ) : (
        <>
          {/* Barres HORIZONTALES : un nom de portefeuille tient sur une ligne,
              pas sous une colonne verticale ou il serait tronque ou pivote. */}
          <ChartContainer
            config={config}
            className="aspect-auto w-full"
            style={{ height: CHART_HEIGHT }}
          >
            <BarChart
              accessibilityLayer
              layout="vertical"
              data={data}
              margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={120}
                tickMargin={6}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="clients" fill="var(--color-clients)" radius={[0, 3, 3, 0]} maxBarSize={14} />
              <Bar dataKey="staff" fill="var(--color-staff)" radius={[0, 3, 3, 0]} maxBarSize={14} />
            </BarChart>
          </ChartContainer>

          {/* L'etat de chaque portefeuille reste une information textuelle :
              une couleur de barre ne doit pas avoir a la porter. */}
          <div className="flex flex-wrap gap-1.5">
            {breakdown.map((portfolio) => (
              <StatusChip
                key={portfolio.portfolioId}
                tone={portfolio.isActive ? 'ok' : 'neutral'}
                dot
                label={
                  portfolio.isActive
                    ? portfolio.portfolioName
                    : `${portfolio.portfolioName} · ${t('portfolios.teamManagement.inactive')}`
                }
                className="h-[20px] text-[0.6rem]"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Activite recente ────────────────────────────────────────────────────────

const RecentActivity: React.FC<{
  assignments: PortfolioStats['recentAssignments'];
  showPortfolio: boolean;
  t: Translate;
}> = ({ assignments, showPortfolio, t }) => {
  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const formatDay = (value: string) =>
    new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Regroupe par jour : six lignes repetant la meme date en toutes lettres
  // faisaient passer l'horodatage pour l'information principale.
  const days: Array<{ day: string; items: PortfolioStats['recentAssignments'] }> = [];
  assignments.forEach((assignment) => {
    const day = formatDay(assignment.assignedAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(assignment);
    else days.push({ day, items: [assignment] });
  });

  return (
    <Card className="flex min-h-0 flex-col gap-2 border-border p-3.5">
      <h3 className="m-0 shrink-0 text-sm font-semibold tracking-tight text-foreground">
        {t('portfolios.statistics.recent')}
      </h3>

      {assignments.length === 0 ? (
        <p className="m-0 py-3 text-center text-xs text-muted-foreground">
          {t('portfolios.statistics.noRecent')}
        </p>
      ) : (
        // Defilement borne, barre masquee : la liste ne doit pas etirer la
        // colonne au-dela du graphique voisin.
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {days.map(({ day, items }) => (
            <div key={day} className="flex flex-col gap-1.5">
              <p className="m-0 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {day}
              </p>
              {items.map((assignment) => (
                <div
                  key={`${assignment.type}-${assignment.id}`}
                  className="flex items-baseline gap-2"
                >
                  {/* Une pastille, plus un badge-icone carre de 28 px repete a
                      chaque ligne. Le type se lit a la couleur ET au libelle. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1 size-2 shrink-0 rounded-[2.5px]',
                      assignment.type === 'CLIENT' ? 'bg-success-ink' : 'bg-info-ink',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.82rem] font-semibold text-foreground">
                      {assignment.name}
                    </span>
                    <span className="block truncate text-2xs text-muted-foreground">
                      {assignment.type === 'CLIENT'
                        ? t('portfolios.statistics.typeClient', 'Client')
                        : t('portfolios.statistics.typeTeam', 'Intervenant')}
                      {showPortfolio ? ` · ${assignment.portfolioName}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                    {formatTime(assignment.assignedAt)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default PortfolioStatsTab;
