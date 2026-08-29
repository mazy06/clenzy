import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BanknoteIcon,
  CalendarCheckIcon,
  FileTextIcon,
  ClipboardCheckIcon,
  EuroIcon,
  PercentIcon,
  StarIcon,
  TrendingUpIcon,
  WalletIcon,
  WrenchIcon,
} from 'lucide-react';
import { GridView } from '../../icons';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useDashboardOverview } from '../../hooks/useDashboardOverview';
import { housekeeperRatesApi } from '../../services/api/housekeeperRatesApi';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useMyPendingPayout } from '../../hooks/usePendingPayouts';
import { useDashboardReady } from '../../hooks/useDashboardReady';
import { useDashboardUpcomingArrivals } from '../../hooks/useDashboardOperations';
import { useDashboardLayout } from '../../hooks/useDashboardLayout';
import { useIsMobile } from '../../hooks/use-mobile';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import StatTile from '../../components/baitly/StatTile';
import StatTileRow from '../../components/baitly/StatTileRow';
import { Money } from '../../components/baitly/Money';
import { Button, Skeleton } from '../../components/ui';
import { cn } from '../../utils/cn';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import DashboardWidgetGrid, { type DashboardWidgetEntry } from './DashboardWidgetGrid';
import MissingContractsDashboardAlert from './MissingContractsDashboardAlert';
import {
  ActionItemsCard,
  TodayOperationsSection,
  UpcomingArrivalsCard,
} from './blocks/DashboardOperationsBlocks';
import {
  MissionProposalsCard,
  MyFollowUpsSection,
  MyNextMissionCard,
  MyQuotesCard,
  MyWeekCard,
  ProviderComplianceAlert,
  useMyEarnings,
  useMyQuoteTotals,
} from './blocks/FieldWorkerBlocks';
import { CLEANING_ROLES, FIELD_ROLES, TRADE_ROLES } from '../../utils/fieldRoles';
import {
  MonthlyRevenueSplitCard,
  OccupancyByPropertyCard,
  RevenueByChannelBlock,
} from './blocks/DashboardAnalyticsBlocks';
import type { DashboardPeriod } from './DashboardDateFilter';

/**
 * Vue d'ensemble du Dashboard.
 *
 * Rendue **entièrement** avec le kit Baitly UI, sur la disposition de la
 * projection de galerie (`DASHBOARD-PARITY.md` §2 à §8). Les widgets MUI
 * historiques — statut des services, compteurs d'action, mini-planning, usage
 * IA, colonne latérale, bandeau contrats — ont été retirés : ils ne figurent pas
 * dans la projection et faisaient cohabiter deux langages visuels sur un même
 * écran.
 *
 * Deux choses subsistent hors projection, délibérément :
 *  - le **guide de démarrage**, qui disparaît de lui-même une fois terminé ;
 *  - la variante **rôles opérationnels** (ménage, technicien, blanchisserie) :
 *    la projection ne décrit que la vue gestionnaire, et un intervenant n'a que
 *    faire d'un RevPAN. Elle est invisible pour les rôles que la projection vise.
 */

interface DashboardOverviewProps {
  period: DashboardPeriod;
}

/** Squelette de chargement — même trame que la grille finale, sans décalage. */
function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[88px] w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Variation vs période précédente — en points pour un taux, en % sinon. */
function TrendHint({
  growth,
  unit,
  t,
}: {
  growth: number;
  unit: 'pts' | '%';
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <>
      <b>
        {growth > 0 ? '+' : ''}
        {growth}
        {unit === 'pts' ? ' pts' : ' %'}
      </b>{' '}
      {t('dashboard.analytics.vsPreviousPeriod', 'vs période préc.')}
    </>
  );
}

const DashboardOverview: React.FC<DashboardOverviewProps> = React.memo(({ period }) => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { stats, financialKpis: kpis, loading } = useDashboardOverview({ period, t });
  const { data: myPayoutData } = useMyPendingPayout();
  // Déjà chargé par « Prochaines arrivées » : React Query dédoublonne, aucun
  // appel supplémentaire.
  // ─── Périmètre par rôle ─────────────────────────────────────────────────
  // Résolu AVANT les requêtes : les arrivées à venir n'alimentent qu'une tuile
  // de la vue gestionnaire, et les charger pour un intervenant est un appel
  // pour rien.
  const roles = useMemo(() => user?.roles ?? [], [user?.roles]);
  const isOperational = FIELD_ROLES.some((role) => roles.includes(role));
  /**
   * Metiers de travaux : leurs indicateurs sont les devis, pas le score et les
   * versements du circuit menage — qui restent structurellement a zero pour
   * eux, cf. `utils/fieldRoles`.
   */
  const isTradeWorker = TRADE_ROLES.some((role) => roles.includes(role))
    && !CLEANING_ROLES.some((role) => roles.includes(role));
  /** La projection décrit la vue gestionnaire : elle ne s'applique qu'à ces rôles. */
  const showManagementView = !isOperational;

  const { data: upcomingArrivals } = useDashboardUpcomingArrivals(7, showManagementView);
  const upcomingCount = upcomingArrivals?.length ?? 0;

  // Remuneration et score : deux lectures propres aux roles terrain. Les hooks
  // sont appeles inconditionnellement (regles des hooks) mais ne servent que la
  // branche terrain — leurs requetes sont peu couteuses et mises en cache.
  const earnings = useMyEarnings();
  const quotes = useMyQuoteTotals();
  const { data: myRates } = useQuery({
    queryKey: ['field', 'rates'],
    queryFn: () => housekeeperRatesApi.getMy(),
    staleTime: 300_000,
  });
  const qualityScore = myRates?.score ?? null;

  // Le guide de demarrage vit dans le dock flottant : le tableau de bord n'a
  // plus besoin que du chargement de son statut pour se declarer pret. Il ne
  // FLOUTE plus ses tuiles tant que la configuration n'est pas finie — le guide
  // porte deja le message, rendre l'ecran illisible n'aidait personne.
  const { isLoading: onboardingLoading } = useOnboarding();

  // ─── Prêt à afficher ────────────────────────────────────────────────────
  const readyKeys = useMemo(() => ['kpis', 'onboarding'], []);
  const { isReady, markReady } = useDashboardReady(readyKeys);
  const kpisReadyFired = useRef(false);
  useEffect(() => {
    if (!loading && !kpisReadyFired.current) {
      kpisReadyFired.current = true;
      markReady('kpis');
    }
  }, [loading, markReady]);
  // Le guide de demarrage vit desormais dans le dock flottant global
  // (`OnboardingDockMount`), plus dans le tableau de bord : c'est donc le
  // chargement du statut qui libere l'affichage, et non plus un composant local.
  useEffect(() => {
    if (!onboardingLoading) markReady('onboarding');
  }, [onboardingLoading, markReady]);

  // ─── Registre des tuiles ────────────────────────────────────────────────
  // ⚠️ Les identifiants sont persistés dans les préférences utilisateur : les
  // renommer ferait perdre sa disposition à tout le monde.
  const widgets: DashboardWidgetEntry[] = [];

  if (showManagementView) {
    widgets.push({
      id: 'kpis',
      label: t('dashboard.widgets.kpis', 'Indicateurs'),
      node: (
        <DashboardErrorBoundary widgetName="KPIs">
          <StatTileRow columns={3} className="xl:grid-cols-6">
            <StatTile
              icon={<PercentIcon />}
              label={t('dashboard.analytics.occupancyShort', 'Occupation')}
              value={kpis ? kpis.occupancyRate.value : '—'}
              unit="%"
              loading={loading}
              hint={
                kpis ? <TrendHint growth={kpis.occupancyRate.growth} unit="pts" t={t} /> : undefined
              }
            />
            <StatTile
              icon={<EuroIcon />}
              label={t('dashboard.analytics.revenueShort', 'Revenus')}
              value={kpis ? <Money value={kpis.totalRevenue.value} decimals={0} /> : '—'}
              iconClassName="text-success"
              loading={loading}
              hint={kpis ? <TrendHint growth={kpis.totalRevenue.growth} unit="%" t={t} /> : undefined}
            />
            <StatTile
              icon={<TrendingUpIcon />}
              label="ADR"
              value={kpis ? <Money value={kpis.adr.value} decimals={0} /> : '—'}
              loading={loading}
              hint={t('dashboard.analytics.adrHint', 'prix moyen par nuit vendue')}
            />
            <StatTile
              icon={<BanknoteIcon />}
              // « RevPAR » au sens de la location saisonnière : le dénominateur
              // est le nombre de nuits-logements disponibles. En hôtellerie ce
              // serait un RevPAN — le champ serveur s'appelle d'ailleurs `revPan`.
              label="RevPAR"
              value={kpis ? <Money value={kpis.revPAN.value} decimals={0} /> : '—'}
              loading={loading}
              hint={t('dashboard.analytics.revenuePerNight', 'revenu par nuit disponible')}
            />
            <StatTile
              icon={<CalendarCheckIcon />}
              label={t('dashboard.analytics.bookings', 'Réservations')}
              value={kpis ? kpis.bookings.value : '—'}
              loading={loading}
              hint={
                upcomingCount > 0
                  ? `${t('dashboard.analytics.including', 'dont')} ${upcomingCount} ${t('dashboard.analytics.arrivalsThisWeek', 'arrivées cette semaine')}`
                  : kpis
                    ? <TrendHint growth={kpis.bookings.growth} unit="%" t={t} />
                    : undefined
              }
            />
            <StatTile
              icon={<StarIcon />}
              label={t('dashboard.analytics.guestRating', 'Note moyenne')}
              value={
                kpis && kpis.guestRating.count > 0
                  ? kpis.guestRating.average.toFixed(1).replace('.', ',')
                  : '—'
              }
              unit="/5"
              iconClassName="text-warning"
              loading={loading}
              hint={
                kpis
                  ? `${kpis.guestRating.count} ${t('dashboard.analytics.reviewsOnPeriod', 'avis sur la période')}`
                  : undefined
              }
            />
          </StatTileRow>
        </DashboardErrorBoundary>
      ),
    });

    widgets.push({
      id: 'revenue-split',
      label: t('dashboard.widgets.revenueSplit', 'Revenus mensuels'),
      minSizePct: 45,
      node: (
        <DashboardErrorBoundary widgetName="MonthlyRevenueSplit">
          <MonthlyRevenueSplitCard months={6} />
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'revenue-by-channel',
      label: t('dashboard.widgets.revenueByChannel', 'Revenus par canal'),
      minSizePct: 25,
      node: (
        <DashboardErrorBoundary widgetName="RevenueByChannel">
          <RevenueByChannelBlock />
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'today-operations',
      label: t('dashboard.widgets.todayOperations', 'Opérations du jour'),
      node: (
        <DashboardErrorBoundary widgetName="TodayOperations">
          <TodayOperationsSection />
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'action-items',
      label: t('dashboard.widgets.actionItems', 'À traiter'),
      minSizePct: 35,
      node: (
        <DashboardErrorBoundary widgetName="ActionItems">
          <ActionItemsCard />
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'occupancy-by-property',
      label: t('dashboard.widgets.occupancyByProperty', 'Occupation par logement'),
      minSizePct: 25,
      node: (
        <DashboardErrorBoundary widgetName="OccupancyByProperty">
          <OccupancyByPropertyCard period={period} />
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'upcoming-arrivals',
      label: t('dashboard.widgets.upcomingArrivals', 'Prochaines arrivées'),
      // Sept colonnes : sous la moitié de la ligne, le tableau se casse.
      minSizePct: 50,
      node: (
        <DashboardErrorBoundary widgetName="UpcomingArrivals">
          <UpcomingArrivalsCard days={7} />
        </DashboardErrorBoundary>
      ),
    });
  } else {
    // Vue terrain. La projection de galerie ne la decrit pas — elle ne parle
    // que du gestionnaire. Un intervenant a d'autres questions : ou vais-je,
    // qu'est-ce qu'on me propose, qu'est-ce qui me bloque, combien j'ai gagne.
    widgets.push({
      id: 'field-compliance',
      label: t('dashboard.widgets.compliance', 'Dossier'),
      node: (
        <DashboardErrorBoundary widgetName="ProviderCompliance">
          <ProviderComplianceAlert />
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'field-next-mission',
      label: t('dashboard.widgets.nextMission', 'Ma prochaine mission'),
      node: (
        <DashboardErrorBoundary widgetName="NextMission">
          <MyNextMissionCard />
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'field-proposals',
      label: t('dashboard.widgets.proposals', 'Missions a confirmer'),
      node: (
        <DashboardErrorBoundary widgetName="MissionProposals">
          <MissionProposalsCard />
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'operational-kpis',
      label: t('dashboard.widgets.kpis', 'Indicateurs'),
      node: (
        <DashboardErrorBoundary widgetName="OperationalKPIs">
          <StatTileRow columns={4}>
            <StatTile
              icon={<CalendarCheckIcon />}
              label={t('dashboard.stats.todayInterventions', 'Aujourd’hui')}
              value={stats ? stats.interventions.today : '—'}
              loading={loading}
              hint={stats
                ? `${stats.interventions.upcoming} ${t('dashboard.stats.next7daysShort', 'sur 7 jours')}`
                : undefined}
            />
            {/*
              Seule la charge du jour est commune. Les trois autres tuiles
              dependent de la FAMILLE de metier : score et versements sont
              calcules sur les seuls types de menage — `HousekeeperScoreService`
              ne compte que CLEANING / EXPRESS_CLEANING / DEEP_CLEANING, et
              `HousekeeperPayoutService` sort immediatement sur un type
              maintenance. Les montrer a un technicien affichait « 0/100 ·
              0 missions » et « 0 € » a vie — une promesse que le produit ne
              peut pas tenir.
            */}
            {isTradeWorker ? (
              <>
                <StatTile
                  icon={<ClipboardCheckIcon />}
                  label={t('dashboard.stats.completedInterventions', 'Terminées')}
                  value={stats ? stats.interventions.completed : '—'}
                  iconClassName="text-success"
                  loading={loading}
                />
                <StatTile
                  icon={<FileTextIcon />}
                  label={t('dashboard.stats.pendingQuotes', 'Devis en attente')}
                  value={quotes.pendingCount}
                  loading={loading}
                  hint={quotes.pendingCount > 0
                    ? t('dashboard.stats.pendingQuotesHint', 'en attente de réponse')
                    : t('dashboard.stats.noPendingQuotes', 'aucun devis ouvert')}
                />
                <StatTile
                  icon={<BanknoteIcon />}
                  label={t('dashboard.stats.approvedQuotes', 'Devis acceptés')}
                  value={<Money value={quotes.approvedAmount} decimals={0} />}
                  iconClassName="text-success"
                  loading={loading}
                  hint={t('dashboard.stats.approvedQuotesHint', '{{count}} devis retenus', {
                    count: quotes.approvedCount,
                  })}
                />
              </>
            ) : (
              <>
                {/* Le score influence l'auto-assignation : il a sa place la ou on
                    regarde chaque matin, pas seulement dans l'ecran des tarifs. */}
                <StatTile
                  icon={<StarIcon />}
                  label={t('dashboard.stats.qualityScore', 'Score qualité')}
                  value={qualityScore ? qualityScore.score : '—'}
                  unit="/100"
                  iconClassName="text-success"
                  loading={loading}
                  hint={qualityScore
                    ? t('dashboard.stats.qualityHint', '{{count}} missions · {{proof}} % avec preuve photo', {
                      count: qualityScore.completedCount,
                      proof: Math.round(qualityScore.proofRate * 100),
                    })
                    : undefined}
                />
                <StatTile
                  icon={<BanknoteIcon />}
                  label={t('dashboard.stats.paidThisMonth', 'Versé ce mois')}
                  value={<Money value={earnings.paidThisMonth} decimals={0} />}
                  iconClassName="text-success"
                  loading={loading}
                />
                <StatTile
                  icon={<WalletIcon />}
                  label={t('dashboard.stats.nextPayout', 'Prochain versement')}
                  value={<Money value={earnings.pending} decimals={0} />}
                  loading={loading}
                  hint={earnings.accountReady
                    ? `${earnings.pendingCount} ${t('dashboard.stats.pending', 'en attente')}`
                    : t('dashboard.stats.payoutAccountMissing', 'compte de versement à configurer')}
                />
              </>
            )}
          </StatTileRow>
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'field-week',
      label: t('dashboard.widgets.myWeek', 'Ma semaine'),
      node: (
        <DashboardErrorBoundary widgetName="MyWeek">
          <MyWeekCard />
        </DashboardErrorBoundary>
      ),
    });
    if (isTradeWorker) {
      widgets.push({
        id: 'field-quotes',
        label: t('dashboard.widgets.myQuotes', 'Mes devis'),
        node: (
          <DashboardErrorBoundary widgetName="MyQuotes">
            <MyQuotesCard />
          </DashboardErrorBoundary>
        ),
      });
    }
    widgets.push({
      id: 'field-follow-ups',
      label: t('dashboard.widgets.followUps', 'Mes suites'),
      node: (
        <DashboardErrorBoundary widgetName="FollowUps">
          <MyFollowUpsSection />
        </DashboardErrorBoundary>
      ),
    });
  }

  // ─── Disposition personnalisable ────────────────────────────────────────
  const widgetIdsKey = widgets.map((widget) => widget.id).join('|');
  const availableWidgetIds = useMemo(() => widgetIdsKey.split('|'), [widgetIdsKey]);

  /** Appariements de la projection : revenus + canal, à traiter + occupation. */
  const defaultRows = useMemo(() => {
    const pairs: Record<string, string> = {
      'revenue-split': 'revenue-by-channel',
      'action-items': 'occupancy-by-property',
    };
    const partners = new Set(Object.values(pairs));
    return availableWidgetIds
      .filter((id) => !partners.has(id))
      .map((id) => (pairs[id] && availableWidgetIds.includes(pairs[id]) ? [id, pairs[id]] : [id]));
  }, [availableWidgetIds]);

  const layout = useDashboardLayout(availableWidgetIds, defaultRows);

  // Composer sa disposition suppose de la place et un pointeur.
  const canCustomize = !useIsMobile(1024);
  const [editingLayout, setEditingLayout] = useState(false);
  const isEditingLayout = canCustomize && editingLayout;

  const layoutActions = usePageHeaderActions(
    canCustomize ? (
      <>
        {isEditingLayout && layout.isCustomized && (
          <Button size="sm" variant="ghost" onClick={layout.reset}>
            {t('dashboard.layout.reset', 'Réinitialiser')}
          </Button>
        )}
        {/* En cours d'edition, ce bouton devient l'action qui SORT du mode : il
            passe en encre pleine ; au repos il reste une action d'en-tete. */}
        <Button
          size="sm"
          variant={isEditingLayout ? 'default' : 'outline'}
          onClick={() => setEditingLayout((value) => !value)}
        >
          <GridView size={14} />
          {isEditingLayout
            ? t('dashboard.layout.done', 'Terminer')
            : t('dashboard.layout.customize', 'Personnaliser')}
        </Button>
      </>
    ) : null,
  );

  return (
    <>
      {layoutActions}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto pt-2 pb-4">
        {!isReady && <OverviewSkeleton />}

        {/* Monté en permanence pour que les widgets chargent, masqué tant que
            l'essentiel n'est pas prêt. */}
        <div className={cn('flex flex-col gap-4', !isReady && 'sr-only')}>
          <MissingContractsDashboardAlert />

          <div className="relative flex flex-col gap-4">

            {/* `[&>*]:shrink-0` — les tuiles ne doivent JAMAIS etre comprimees :
                cette colonne vit dans une zone qui defile deja, sa hauteur doit
                donc suivre son contenu.
                Sans cette regle, le deficit de hauteur de la colonne etait absorbe
                en entier par la SEULE tuile capable de se reduire. Une tuile porte
                `overflow: hidden` (.cn-card), or `min-height: auto` ne vaut la
                hauteur du contenu que si `overflow` est `visible` : son plancher
                tombait a zero quand celui des autres tenait bon. « Revenus par
                canal » se retrouvait ainsi ecrasee a 61 px pour 372 px de contenu,
                reduite a son seul en-tete. */}
            <div
              className={cn(
                'flex flex-col gap-4 [&>*]:shrink-0',
              )}
            >
              <DashboardWidgetGrid
                widgets={widgets}
                rows={layout.rows}
                editing={isEditingLayout}
                stacked={!canCustomize}
                onMoveNextTo={layout.moveNextTo}
                onMoveToOwnRow={layout.moveToOwnRow}
                onShiftWithinRow={layout.shiftWithinRow}
                onRowSizes={layout.setRowSizes}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

DashboardOverview.displayName = 'DashboardOverview';

export default DashboardOverview;
