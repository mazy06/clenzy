import React, { Suspense, lazy, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BanknoteIcon,
  CalendarCheckIcon,
  FileTextIcon,
  ClipboardCheckIcon,
  GaugeIcon,
  StarIcon,
  TrendingUpIcon,
  WalletIcon,
  WrenchIcon,
} from 'lucide-react';
import { Add, GridView } from '../../icons';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useDashboardOverview } from '../../hooks/useDashboardOverview';
import { housekeeperRatesApi } from '../../services/api/housekeeperRatesApi';
import { useDashboardUpcomingArrivals } from '../../hooks/useDashboardOperations';
import { useDashboardLayout } from '../../hooks/useDashboardLayout';
import {
  ImportedTileWidget,
  findTileSource,
  isImportedWidgetId,
  parseImportedWidgetId,
} from './importedWidgets';
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
import { DeferredDashboardWidget, DashboardWidgetState } from './DashboardWidgetState';
import { DEFAULT_LAYOUT_ROWS } from './dashboardDefaults';

const DashboardWidgetPicker = lazy(() => import('./DashboardWidgetPicker'));

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
export function OverviewSkeleton() {
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

const DashboardOverview: React.FC<DashboardOverviewProps> = React.memo(({ period }) => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { stats, financialKpis: kpis, financialContext, loading, error, refreshAll } = useDashboardOverview({ period, t });
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

  // Les hooks restent stables ; seules les requêtes utiles au métier sont activées.
  const earnings = useMyEarnings(isOperational && !isTradeWorker);
  const quotes = useMyQuoteTotals(isOperational && isTradeWorker);
  const { data: myRates } = useQuery({
    queryKey: ['field', 'rates'],
    enabled: isOperational && !isTradeWorker,
    queryFn: () => housekeeperRatesApi.getMy(),
    staleTime: 300_000,
  });
  const qualityScore = myRates?.score ?? null;

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
          <StatTileRow compact>
            <StatTile
              // L'icone dit le SUJET (un taux de remplissage), pas l'unite :
              // un « % » en pastille a cote d'un « 44,7 % » ne redit que lui-meme.
              icon={<GaugeIcon />}
              label={t('dashboard.analytics.occupancyShort', 'Occupation')}
              value={
                kpis
                  ? kpis.occupancyRate.value.toLocaleString(undefined, { maximumFractionDigits: 1 })
                  : '—'
              }
              unit="%"
              loading={loading}
              delta={kpis ? kpis.occupancyRate.growth : null}
            />
            <StatTile
              icon={<WalletIcon />}
              label={t('dashboard.analytics.revenueShort', 'Revenus')}
              value={kpis ? <Money from={financialContext?.currency ?? 'EUR'} value={kpis.totalRevenue.value} decimals={0} /> : '—'}
              iconClassName="text-success"
              loading={loading}
              delta={kpis ? kpis.totalRevenue.growth : null}
            />
            <StatTile
              icon={<TrendingUpIcon />}
              label="ADR"
              value={kpis ? <Money from={financialContext?.currency ?? 'EUR'} value={kpis.adr.value} decimals={0} /> : '—'}
              loading={loading}
              hint={t('dashboard.analytics.adrHint', 'prix moyen par nuit vendue')}
            />
            <StatTile
              icon={<BanknoteIcon />}
              // Revenu par nuit-logement disponible, conformément au contrat serveur.
              label="RevPAN"
              value={kpis ? <Money from={financialContext?.currency ?? 'EUR'} value={kpis.revPAN.value} decimals={0} /> : '—'}
              loading={loading}
              hint={t('dashboard.analytics.revenuePerNight', 'revenu par nuit disponible')}
            />
            <StatTile
              icon={<CalendarCheckIcon />}
              label={t('dashboard.analytics.bookings', 'Réservations')}
              value={kpis ? kpis.bookings.value : '—'}
              loading={loading}
              delta={upcomingCount > 0 || !kpis ? null : kpis.bookings.growth}
              hint={
                upcomingCount > 0
                  ? `${t('dashboard.analytics.including', 'dont')} ${upcomingCount} ${t('dashboard.analytics.arrivalsThisWeek', 'arrivées cette semaine')}`
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
      node: (
        <DashboardErrorBoundary widgetName="MonthlyRevenueSplit">
          <MonthlyRevenueSplitCard months={6} />
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'revenue-by-channel',
      label: t('dashboard.widgets.revenueByChannel', 'Revenus par canal'),
      node: (
        <DashboardErrorBoundary widgetName="RevenueByChannel">
          <RevenueByChannelBlock period={period} />
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
      node: (
        <DashboardErrorBoundary widgetName="ActionItems">
          <ActionItemsCard />
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'occupancy-by-property',
      label: t('dashboard.widgets.occupancyByProperty', 'Occupation par logement'),
      node: (
        <DashboardErrorBoundary widgetName="OccupancyByProperty">
          <OccupancyByPropertyCard period={period} />
        </DashboardErrorBoundary>
      ),
    });
    widgets.push({
      id: 'upcoming-arrivals',
      label: t('dashboard.widgets.upcomingArrivals', 'Prochaines arrivées'),
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
          <StatTileRow compact>
            {/* Le moment engagé du tableau de bord. On l'ouvre le matin pour
                  savoir quoi faire, pas pour contempler un indicateur de
                  revenu : le seul chiffre qui appelle une action dans l'heure
                  le porte. */}
              <StatTile
              feature
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

  const defaultRows = useMemo(() => {
    const available = new Set(availableWidgetIds);
    const placed = new Set<string>();
    const rows = DEFAULT_LAYOUT_ROWS
      .map((ids) => ids.filter((id) => {
        // Une tuile IMPORTEE n'est jamais « disponible » : elle n'existe que
        // parce qu'elle est posee. Seules les natives se verifient.
        if (!isImportedWidgetId(id) && !available.has(id)) return false;
        placed.add(id);
        return true;
      }))
      .filter((ids) => ids.length > 0);

    // Tuiles natives qu'un role expose sans que la disposition livree les
    // nomme : ajoutees en fin, une par ligne, plutot que perdues.
    for (const id of availableWidgetIds) {
      if (!placed.has(id)) rows.push([id]);
    }
    return rows;
  }, [availableWidgetIds]);

  const layoutOptions = useMemo(() => ({ isImported: isImportedWidgetId }), []);
  const layout = useDashboardLayout(availableWidgetIds, defaultRows, layoutOptions);

  // ─── Tuiles importées d'un autre écran ──────────────────────────────────
  // Elles n'existent que parce qu'elles ont été posées : on les dérive de la
  // disposition, pas d'un registre. Une source retirée du produit disparaît
  // donc d'elle-même (`parse` refuse un identifiant inconnu).
  const placedIds = useMemo(() => layout.rows.flatMap((row) => row.ids), [layout.rows]);
  const importedWidgets: DashboardWidgetEntry[] = useMemo(
    () =>
      placedIds.flatMap((id) => {
        const reference = parseImportedWidgetId(id);
        if (!reference) return [];
        const source = findTileSource(reference.sourceId);
        return [{
          id,
          label: source ? t(source.labelKey, source.fallback) : id,
          node: (
            <DashboardErrorBoundary widgetName={id}>
              <DeferredDashboardWidget title={source ? t(source.labelKey, source.fallback) : id}>
                <ImportedTileWidget reference={reference} period={period} />
              </DeferredDashboardWidget>
            </DashboardErrorBoundary>
          ),
        }];
      }),
    [placedIds, period, t],
  );

  const allWidgets = useMemo(() => [...widgets, ...importedWidgets], [widgets, importedWidgets]);

  /** Tuiles natives écartées — le sélecteur doit pouvoir les remettre. */
  const removedNative = useMemo(
    () => widgets
      .filter((widget) => layout.hidden.includes(widget.id))
      .map((widget) => ({ id: widget.id, label: widget.label })),
    [widgets, layout.hidden],
  );

  const [pickerOpen, setPickerOpen] = useState(false);

  // Composer sa disposition suppose de la place et un pointeur.
  const canCustomize = !useIsMobile(1024);
  const [editingLayout, setEditingLayout] = useState(false);
  const isEditingLayout = canCustomize && editingLayout;

  const layoutActions = usePageHeaderActions(
    canCustomize ? (
      <>
        {isEditingLayout && (
          <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
            <Add size={14} />
            {t('dashboard.layout.add', 'Ajouter un composant')}
          </Button>
        )}
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
          disabled={!layout.isLoaded}
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
      <div className="flex min-w-0 flex-col pt-2 pb-4">
        {error && <DashboardWidgetState title={t('dashboard.widgets.kpis', 'Indicateurs')} error onRetry={refreshAll} />}

        {/* Chaque widget porte son chargement et son erreur. */}
        <div className="flex flex-col gap-4">
          <MissingContractsDashboardAlert />

          <div className="relative flex flex-col gap-4">

            <div
              className={cn(
                'flex flex-col gap-4 [&>*]:shrink-0',
              )}
            >
              {layout.isLoading ? <OverviewSkeleton /> : <DashboardWidgetGrid
                widgets={allWidgets}
                rows={layout.rows}
                editing={isEditingLayout}
                stacked={!canCustomize}
                onMoveNextTo={layout.moveNextTo}
                onMoveToOwnRow={layout.moveToOwnRow}
                onShiftWithinRow={layout.shiftWithinRow}
                onRowSizes={layout.setRowSizes}
                onRemove={layout.removeWidget}
              />}
            </div>
          </div>
        </div>
      </div>

      {pickerOpen && <Suspense fallback={null}><DashboardWidgetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        period={period}
        removedNative={removedNative}
        placedIds={placedIds}
        onAdd={(id) => layout.addWidget(id)}
      /></Suspense>}
    </>
  );
});

DashboardOverview.displayName = 'DashboardOverview';

export default DashboardOverview;
