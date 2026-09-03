import React from 'react';
import StatusChip from '../../components/StatusChip';
import {
  Card,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  Spinner,
} from '../../components/ui';
import { Business, People, Group, Schedule } from '../../icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { portfoliosApi, portfoliosKeys } from '../../services/api/portfoliosApi';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';

/**
 * Statistiques des portefeuilles.
 *
 * <p>L'écran affichait quatre grandes tuiles identiques en rang, dont l'une
 * portait pour titre le message d'erreur d'i18next — {@code t('teams.members')}
 * pointe sur un OBJET, pas une chaîne. Il répétait « Statistiques des
 * Portefeuilles » en titre de page puis en titre de panneau, promettait en
 * sous-titre de « gérer » ce qu'on ne peut que consulter ici, et intitulait un
 * panneau « Associé le » — un libellé de champ promu en titre.</p>
 *
 * <p>La bande de synthèse reprend l'idiome du portefeuille par ville : une
 * répartition sur une ligne plutôt que des grands nombres isolés. « 1 »
 * portefeuille en gros caractères n'apprend rien à personne.</p>
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

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

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

  // Le nom du portefeuille sur chaque ligne est du bruit quand il n'y en a
  // qu'un : il ne distingue rien.
  const manyPortfolios = stats.portfolioBreakdown.length > 1;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="mb-0.5 text-balance text-base font-semibold tracking-tight text-foreground">
          {t('portfolios.statistics.title')}
        </h2>
        <p className="m-0 text-xs text-muted-foreground">
          {/* L'ancien sous-titre promettait de « gérer » : rien ne se gère ici. */}
          {t('portfolios.statistics.subtitleStats')}
        </p>
      </div>

      <Card className="flex flex-row flex-wrap items-baseline gap-x-6 gap-y-2 border-border p-3">
        <Figure value={stats.totalPortfolios} label={t('portfolios.statistics.portfolios')} />
        <Figure value={stats.totalClients} label={t('portfolios.statistics.clients')} />
        <Figure value={stats.totalProperties} label={t('portfolios.statistics.properties')} />
        {/* `teams.members` renvoyait un objet : i18next affichait alors son
            message d'erreur en guise de titre de KPI. */}
        <Figure value={stats.totalTeamMembers} label={t('portfolios.statistics.staff')} />
        {stats.inactivePortfolios > 0 ? (
          <Figure
            value={stats.inactivePortfolios}
            label={t('portfolios.teamManagement.inactive')}
            alert
          />
        ) : null}
      </Card>

      {/* Deux panneaux de hauteurs libres : forcer `h-full` sur un panneau qui
          porte un seul élément laissait un grand vide à côté d'une liste. */}
      <div className="grid grid-cols-1 items-start gap-3 min-[900px]:grid-cols-2">
        <Card className="flex flex-col gap-2 border-border p-3.5">
          <h3 className="m-0 text-sm font-semibold tracking-tight text-foreground">
            {t('portfolios.statistics.composition')}
          </h3>
          {stats.portfolioBreakdown.length === 0 ? (
            <p className="m-0 py-3 text-center text-xs text-muted-foreground">
              {t('portfolios.statistics.noDataAvailable')}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.portfolioBreakdown.map((portfolio) => (
                <div key={portfolio.portfolioId} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {portfolio.portfolioName}
                    </span>
                    <StatusChip
                      tone={portfolio.isActive ? 'ok' : 'neutral'}
                      label={
                        portfolio.isActive
                          ? t('portfolios.teamManagement.active')
                          : t('portfolios.teamManagement.inactive')
                      }
                      className="h-[20px] text-[0.6rem]"
                    />
                  </div>
                  {/* Ce que porte le portefeuille, chiffré et nommé — plutôt
                      qu'un « 51 membres » sans unité de comparaison. */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      <b className="font-semibold text-foreground">{portfolio.clientCount}</b>{' '}
                      {t('portfolios.statistics.clientsLabel')}
                    </span>
                    <span className="tabular-nums">
                      <b className="font-semibold text-foreground">{portfolio.teamMemberCount}</b>{' '}
                      {t('portfolios.statistics.staff')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-2 border-border p-3.5">
          <h3 className="m-0 text-sm font-semibold tracking-tight text-foreground">
            {/* Le titre nomme le contenu du panneau. Il portait « Associé le »,
                qui est le libellé d'une colonne, pas d'une section. */}
            {t('portfolios.statistics.recent')}
          </h3>
          {stats.recentAssignments.length === 0 ? (
            <p className="m-0 py-3 text-center text-xs text-muted-foreground">
              {/* L'état vide annonçait « Aucun client associé » alors que la
                  liste mêle clients et équipes. */}
              {t('portfolios.statistics.noRecent')}
            </p>
          ) : (
            <ItemGroup>
              {stats.recentAssignments.slice(0, 6).map((assignment, index, shown) => (
                <React.Fragment key={`${assignment.type}-${assignment.id}`}>
                  <Item size="xs" className="px-0">
                    <ItemMedia
                      variant="icon"
                      className={cn(
                        'size-7 rounded-md',
                        assignment.type === 'CLIENT'
                          ? 'bg-success-soft text-success'
                          : 'bg-info-soft text-info',
                      )}
                    >
                      {assignment.type === 'CLIENT' ? (
                        <People size={14} strokeWidth={1.75} aria-hidden="true" />
                      ) : (
                        <Group size={14} strokeWidth={1.75} aria-hidden="true" />
                      )}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="text-[0.82rem] font-semibold">
                        {assignment.name}
                      </ItemTitle>
                      {manyPortfolios ? (
                        <ItemDescription className="text-[0.7rem]">
                          {assignment.portfolioName}
                        </ItemDescription>
                      ) : null}
                      <span className="mt-0.5 flex items-center gap-1 text-[0.65rem] tabular-nums text-muted-foreground">
                        <Schedule size={12} strokeWidth={1.75} aria-hidden="true" />
                        {formatDate(assignment.assignedAt)}
                      </span>
                    </ItemContent>
                  </Item>
                  {index < shown.length - 1 ? <ItemSeparator /> : null}
                </React.Fragment>
              ))}
            </ItemGroup>
          )}
        </Card>
      </div>
    </div>
  );
};

const Figure: React.FC<{ value: number; label: string; alert?: boolean }> = ({
  value,
  label,
  alert,
}) => (
  <span className="flex items-baseline gap-1.5">
    <b
      className={cn(
        'font-display text-lg font-bold tabular-nums',
        alert ? 'text-warning-ink' : 'text-foreground',
      )}
    >
      {value}
    </b>
    <span className="text-xs text-muted-foreground">{label}</span>
  </span>
);

export default PortfolioStatsTab;
