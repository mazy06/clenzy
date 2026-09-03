import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import StatusChip from '../../components/StatusChip';
import {
  Card,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Progress,
  Spinner,
  type ChartConfig,
} from '../../components/ui';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import {
  portfoliosApi,
  portfoliosKeys,
  type PortfolioStats,
} from '../../services/api/portfoliosApi';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';

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

      {/* Le graphique prend deux tiers : c'est lui qui porte la comparaison.
          `items-start` empeche la colonne courte de s'etirer sur la hauteur de
          l'autre — c'est ce qui creusait le grand vide. */}
      <div className="grid grid-cols-1 items-start gap-3 min-[1000px]:grid-cols-[2fr_1fr]">
        <CompositionChart breakdown={stats.portfolioBreakdown} t={t} />
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

  return (
    <Card className="flex flex-col gap-2.5 border-border p-3">
      <div className="flex flex-row flex-wrap items-baseline gap-x-6 gap-y-2">
        <Figure value={totalPortfolios} label={t('portfolios.statistics.portfolios')} />
        <Figure value={stats.totalClients} label={t('portfolios.statistics.clients')} />
        <Figure value={stats.totalProperties} label={t('portfolios.statistics.properties')} />
        <Figure value={stats.totalTeamMembers} label={t('portfolios.statistics.staff')} />
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

const Figure: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <span className="flex items-baseline gap-1.5">
    <b className="font-[family-name:var(--font-display)] text-lg font-bold tabular-nums text-foreground">{value}</b>
    <span className="text-xs text-muted-foreground">{label}</span>
  </span>
);

// ─── Composition : le graphique ──────────────────────────────────────────────

/** Hauteur par portefeuille, plus la place des axes et de la legende. */
const ROW_HEIGHT = 46;
const CHART_CHROME = 64;

const CompositionChart: React.FC<{
  breakdown: PortfolioStats['portfolioBreakdown'];
  t: Translate;
}> = ({ breakdown, t }) => {
  const labelClients = t('portfolios.statistics.clientsLabel');
  const labelStaff = t('portfolios.statistics.staff');

  const config: ChartConfig = {
    clients: { label: labelClients, color: 'var(--bui-chart-1)' },
    staff: { label: labelStaff, color: 'var(--bui-chart-2)' },
  };

  const data = breakdown.map((portfolio) => ({
    name: portfolio.portfolioName,
    clients: portfolio.clientCount,
    staff: portfolio.teamMemberCount,
  }));

  return (
    <Card className="flex flex-col gap-2.5 border-border p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold tracking-tight text-foreground">
          {t('portfolios.statistics.composition')}
        </h3>
        {/* Le graphique ne montre pas les logements : `portfolioBreakdown` ne
            les compte pas par portefeuille. Autant le dire plutot que de
            laisser croire a un parc absent. */}
        <p className="m-0 text-2xs text-muted-foreground">
          {t('portfolios.statistics.chartScope', 'Clients et intervenants rattachés')}
        </p>
      </div>

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
            style={{ height: data.length * ROW_HEIGHT + CHART_CHROME }}
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
    </Card>
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
    <Card className="flex flex-col gap-2 border-border p-3.5">
      <h3 className="m-0 text-sm font-semibold tracking-tight text-foreground">
        {t('portfolios.statistics.recent')}
      </h3>

      {assignments.length === 0 ? (
        <p className="m-0 py-3 text-center text-xs text-muted-foreground">
          {t('portfolios.statistics.noRecent')}
        </p>
      ) : (
        // Defilement borne, barre masquee : la liste ne doit pas etirer la
        // colonne au-dela du graphique voisin.
        <div className="no-scrollbar flex max-h-[320px] flex-col gap-3 overflow-y-auto">
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
