import React from 'react';
import StatusChip from '../../components/StatusChip';
import { Spinner } from '../../components/ui';
import {
  Card,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '../../components/ui';
import {
  Business,
  People,
  Group,
  Assignment,
  Schedule,
} from '../../icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { portfoliosApi, portfoliosKeys } from '../../services/api/portfoliosApi';
import { useTranslation } from '../../hooks/useTranslation';
import StatTile from '../../components/baitly/StatTile';

// ─── Teintes d'icone des stat tiles (classes Baitly UI) ─────────────────────

const STAT_COLORS = {
  portfolios: 'text-primary',
  clients:    'text-success',
  properties: 'text-info',
  members:    'text-warning',
} as const;

// ─── Main component ──────────────────────────────────────────────────────────

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (statsQuery.isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (statsQuery.isError) {
    return (
      <p className="text-sm text-destructive text-center py-6">
        {t('portfolios.errors.connectionError')}
      </p>
    );
  }

  if (!stats) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        {t('portfolios.statistics.noDataAvailable')}
      </p>
    );
  }

  return (
    <div>
      <h6 className="text-base font-semibold tracking-tight text-balance mb-0.5">
        {t('portfolios.statistics.title')}
      </h6>
      <p className="text-xs text-muted-foreground mb-4">
        {t('portfolios.subtitle')}
      </p>

      {/* Stat tiles (primitive partagée) */}
      <div className="grid grid-cols-12 gap-3 mb-[18px]">
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={<Business />}
            value={stats.totalPortfolios}
            label={t('portfolios.statistics.portfolios')}
            iconClassName={STAT_COLORS.portfolios}
          />
        </div>
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={<People />}
            value={stats.totalClients}
            label={t('portfolios.statistics.clients')}
            iconClassName={STAT_COLORS.clients}
          />
        </div>
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={<Assignment />}
            value={stats.totalProperties}
            label={t('portfolios.statistics.properties')}
            iconClassName={STAT_COLORS.properties}
          />
        </div>
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={<Group />}
            value={stats.totalTeamMembers}
            label={t('teams.members')}
            iconClassName={STAT_COLORS.members}
          />
        </div>
      </div>

      {/* Detail sections */}
      <div className="grid grid-cols-12 gap-3">
        {/* Portfolio breakdown */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card className="gap-0 py-0 p-3.5 h-full">
            <h6 className="text-sm font-semibold tracking-tight mb-2">
              {t('portfolios.statistics.title')}
            </h6>
            {stats.portfolioBreakdown.length > 0 ? (
              <ItemGroup>
                {stats.portfolioBreakdown.map((portfolio, index) => (
                  <React.Fragment key={portfolio.portfolioId}>
                    <Item size="xs" className="px-0">
                      <ItemMedia
                        variant="icon"
                        className={
                          'size-7 rounded-md '
                          + (portfolio.isActive
                            ? 'bg-primary-soft text-primary'
                            : 'bg-muted text-muted-foreground')
                        }
                      >
                        <Business size={14} strokeWidth={1.75} />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="text-[0.82rem] font-semibold">
                          {portfolio.portfolioName}
                        </ItemTitle>
                        <ItemDescription className="flex gap-2 text-[0.7rem]">
                          <span>
                            {portfolio.clientCount} client{portfolio.clientCount > 1 ? 's' : ''}
                          </span>
                          <span>
                            {portfolio.teamMemberCount} {t('portfolios.fields.members')}
                          </span>
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <StatusChip
                          tone={portfolio.isActive ? 'ok' : 'neutral'}
                          label={portfolio.isActive ? t('portfolios.teamManagement.active') : t('portfolios.teamManagement.inactive')}
                          className="h-[20px] text-[0.6rem]"
                        />
                      </ItemActions>
                    </Item>
                    {index < stats.portfolioBreakdown.length - 1 && <ItemSeparator />}
                  </React.Fragment>
                ))}
              </ItemGroup>
            ) : (
              <p className="text-muted-foreground text-center py-4 text-[0.82rem]">
                {t('portfolios.statistics.noDataAvailable')}
              </p>
            )}
          </Card>
        </div>

        {/* Recent assignments */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card className="gap-0 py-0 p-3.5 h-full">
            <h6 className="text-sm font-semibold tracking-tight mb-2">
              {t('portfolios.fields.associatedOn')}
            </h6>
            {stats.recentAssignments.length > 0 ? (
              <ItemGroup>
                {stats.recentAssignments.slice(0, 5).map((assignment, index) => (
                  <React.Fragment key={assignment.id}>
                    <Item size="xs" className="px-0">
                      <ItemMedia
                        variant="icon"
                        className={
                          'size-7 rounded-md '
                          + (assignment.type === 'CLIENT'
                            ? 'bg-success-soft text-success'
                            : 'bg-info-soft text-info')
                        }
                      >
                        {assignment.type === 'CLIENT' ? (
                          <People size={14} strokeWidth={1.75} />
                        ) : (
                          <Group size={14} strokeWidth={1.75} />
                        )}
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="text-[0.82rem] font-semibold">
                          {assignment.name}
                        </ItemTitle>
                        <ItemDescription className="text-[0.7rem]">
                          {assignment.portfolioName}
                        </ItemDescription>
                        <span className="mt-0.5 flex items-center gap-0.5 text-[0.65rem] text-muted-foreground">
                          <span className="inline-flex"><Schedule size={12} strokeWidth={1.75} /></span>
                          {formatDate(assignment.assignedAt)}
                        </span>
                      </ItemContent>
                    </Item>
                    {index < Math.min(stats.recentAssignments.length, 5) - 1 && <ItemSeparator />}
                  </React.Fragment>
                ))}
              </ItemGroup>
            ) : (
              <p className="text-muted-foreground text-center py-4 text-[0.82rem]">
                {t('portfolios.fields.noClientAssociated')}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PortfolioStatsTab;
