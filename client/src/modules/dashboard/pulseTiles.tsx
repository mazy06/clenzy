import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DonutChart,
  HighlightList,
  HistogramChart,
  TrendLineChart,
  tiles,
  type Highlight,
  type StatBucket,
  type StatFigure,
  type TileOrNothing,
} from '../../components/stats';
import { useTranslation } from '../../hooks/useTranslation';
import { useReportFormats, SignalList, type ReportContent, type SignalItem } from '../reports/reportShell';
import { useCanSuperviseAgents, useSupervisionConfig, useSupervisionPendingCounts } from '../supervision';
import UnansweredReviewList from './UnansweredReviewList';
import { useConnectedObjects } from '../connected-objects/useConnectedObjects';
import { usePropertiesList } from '../../hooks/usePropertiesList';
import { funnelApi } from '../../services/api/funnelApi';
import { documentsApi } from '../../services/api/documentsApi';
import { reviewsApi } from '../../services/api/reviewsApi';
import { managementContractsApi } from '../../services/api/managementContractsApi';
import { walletApi } from '../../services/api/walletApi';
import { accountingApi } from '../../services/api/accountingApi';
import { taxFilingsApi } from '../../services/api/taxFilingsApi';
import { conversationApi } from '../../services/api/conversationApi';
import { dashboardOperationsApi } from '../../services/api/dashboardOperationsApi';
import { portfolioPulseApi } from '../../services/api/portfolioPulseApi';

/**
 * Tuiles de PARC, propres au tableau de bord.
 *
 * <p>Les Rapports couvrent l'argent et l'occupation ; le reste du métier —
 * distribution directe, stock, réputation, conformité, trésorerie, objets
 * connectés — n'avait aucune surface sur l'écran d'accueil. Ces tuiles s'y
 * branchent par le MEME contrat que les onglets de Rapports
 * ({@link ReportContent}), donc par le même sélecteur.</p>
 *
 * <p>Aucune n'est native : elles ne paraissent que si on les pose. Quinze
 * tuiles de plus imposées à tout le monde auraient fait l'inverse du service
 * rendu.</p>
 */

const STALE = 5 * 60 * 1000;

// ─── Croissance & distribution ───────────────────────────────────────────────

export function usePulseGrowth(): ReportContent {
  const { t } = useTranslation();
  const format = useReportFormats();

  const funnel = useQuery({
    queryKey: ['pulse', 'funnel'],
    queryFn: () => funnelApi.get(),
    staleTime: STALE,
  });
  const positioning = useQuery({
    queryKey: ['pulse', 'positioning'],
    queryFn: () => portfolioPulseApi.positioning(),
    staleTime: STALE,
  });

  const f = funnel.data;
  const steps: StatBucket[] = f
    ? [
      { label: t('pulse.funnel.searches', 'Recherches'), count: f.searches },
      { label: t('pulse.funnel.views', 'Vues de bien'), count: f.propertyViews },
      { label: t('pulse.funnel.checkouts', 'Paniers ouverts'), count: f.checkoutStarts },
      { label: t('pulse.funnel.confirmed', 'Confirmées'), count: f.confirmed },
    ]
    : [];

  const denied: Highlight[] = (f?.topDenied ?? []).slice(0, 8).map((stay, index) => ({
    id: `denied-${index}`,
    label: [stay.checkIn, stay.checkOut].filter(Boolean).join(' → ') || t('pulse.funnel.anyDate', 'Dates libres'),
    value: `${stay.count}`,
    hint: stay.guests ? t('pulse.funnel.guests', '{{n}} voyageurs', { n: stay.guests }) : undefined,
  }));

  const verdicts = (positioning.data ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = row.positioning?.positioning ?? 'NO_MARKET_DATA';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const positioningBuckets: StatBucket[] = [
    { label: t('pulse.positioning.under', 'Sous le marché'), count: verdicts.UNDERPRICED ?? 0 },
    { label: t('pulse.positioning.aligned', 'Aligné'), count: verdicts.ALIGNED ?? 0 },
    { label: t('pulse.positioning.over', 'Au-dessus'), count: verdicts.OVERPRICED ?? 0 },
    { label: t('pulse.positioning.unknown', 'Sans repère marché'), count: verdicts.NO_MARKET_DATA ?? 0 },
  ];

  const items = tiles([
    steps.length > 0 && {
      key: 'funnel',
      href: '/booking-engine',
      title: t('pulse.funnel.title', 'Entonnoir de réservation directe'),
      hint: f && f.conversionPct != null && f.confirmed <= f.searches
        ? t('pulse.funnel.conversion', '{{pct}} % de conversion', { pct: f.conversionPct.toFixed(1) })
        : undefined,
      render: () => <HistogramChart buckets={steps} label={t('pulse.funnel.label', 'Séjours')} tone="info" />,
    },
    (f?.daily?.length ?? 0) > 1 && {
      key: 'funnel-trend',
      href: '/booking-engine',
      title: t('pulse.funnel.trendTitle', 'Parcours direct, jour par jour'),
      hint: t('pulse.funnel.trendHint', 'De la recherche à la confirmation'),
      render: () => (
        <TrendLineChart
          data={(f?.daily ?? []).map((d) => ({
            label: d.date,
            searches: d.counts.SEARCH ?? 0,
            confirmed: d.counts.CONFIRMED ?? 0,
          }))}
          series={[
            { key: 'searches', label: t('pulse.funnel.searches', 'Recherches') },
            { key: 'confirmed', label: t('pulse.funnel.confirmed', 'Confirmées') },
          ]}
          formatValue={format.count}
        />
      ),
    },
    denied.length > 0 && {
      key: 'denied',
      href: '/booking-engine',
      fluid: true,
      title: t('pulse.denied.title', 'Recherches sans disponibilité'),
      hint: t('pulse.denied.hint', 'De la demande réelle qui repart ailleurs'),
      render: () => <HighlightList items={denied} />,
    },
    (positioning.data?.length ?? 0) > 0 && {
      key: 'positioning',
      href: '/tarification',
      title: t('pulse.positioning.title', 'Positionnement tarifaire du parc'),
      hint: t('pulse.positioning.hint', 'Prix publié face au marché de la zone'),
      render: () => (
        <DonutChart
          buckets={positioningBuckets.filter((b) => b.count > 0)}
          totalLabel={t('pulse.positioning.total', 'Logements')}
          formatValue={format.count}
        />
      ),
    },
  ] as TileOrNothing[]);

  const figures: StatFigure[] = [
    // Le taux vaut « confirmees / recherches » : quand des reservations
    // arrivent par une OTA ou une reprise, il depasse 100 % et ne dit plus
    // rien. On tait le chiffre plutot que d'afficher « 450 % de conversion ».
    f && f.conversionPct != null && f.confirmed <= f.searches && {
      key: 'conversion',
      value: `${f.conversionPct.toFixed(1)} %`,
      label: t('pulse.funnel.conversionLabel', 'Conversion directe'),
    },
    f && { key: 'searches', value: format.count(f.searches), label: t('pulse.funnel.searches', 'Recherches') },
    f && { key: 'confirmed', value: format.count(f.confirmed), label: t('pulse.funnel.confirmed', 'Confirmées') },
    (verdicts.UNDERPRICED ?? 0) > 0 && {
      key: 'underpriced',
      value: format.count(verdicts.UNDERPRICED),
      label: t('pulse.positioning.under', 'Sous le marché'),
    },
  ].filter(Boolean) as StatFigure[];

  return { figures, items, loading: funnel.isLoading || positioning.isLoading, fill: false };
}

// ─── Opérations ──────────────────────────────────────────────────────────────

export function usePulseOperations(): ReportContent {
  const { t } = useTranslation();
  const format = useReportFormats();
  const { kpis, loading: devicesLoading } = useConnectedObjects();
  // Meme porte que le planning : la constellation ne s'interroge que pour un
  // role habilite ET une org qui l'a activee. Sans cela, poser la tuile
  // declencherait un sondage de 30 s voue au refus.
  const { canView: canViewSupervision } = useCanSuperviseAgents();
  const { data: supervisionConfig } = useSupervisionConfig({ enabled: canViewSupervision });
  const canSupervise = canViewSupervision && (supervisionConfig?.enabled ?? false);
  const { total: pendingTotal, byProperty } = useSupervisionPendingCounts(canSupervise);
  // Le compteur de supervision ne renvoie que des identifiants ; la liste des
  // logements est deja en cache pour le reste de l'application.
  const { properties } = usePropertiesList();
  const propertyNames = React.useMemo(
    () => new Map(properties.map((property) => [String(property.id), property.name])),
    [properties],
  );

  const reorder = useQuery({
    queryKey: ['pulse', 'stock-reorder'],
    queryFn: () => portfolioPulseApi.stockToReorder(),
    staleTime: STALE,
  });
  const departures = useQuery({
    queryKey: ['pulse', 'departures'],
    queryFn: () => dashboardOperationsApi.getUpcomingDepartures(7),
    staleTime: STALE,
  });

  const devices: StatBucket[] = [
    { label: t('pulse.devices.online', 'En ligne'), count: kpis.online },
    { label: t('pulse.devices.offline', 'Hors ligne'), count: kpis.offline },
    { label: t('pulse.devices.alerts', 'En alerte'), count: kpis.alerts },
    { label: t('pulse.devices.battery', 'Batterie faible'), count: kpis.lowBattery },
  ];

  const agentQueue: Highlight[] = Object.entries(byProperty ?? {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([propertyId, count]) => ({
      id: propertyId,
      label: propertyNames.get(propertyId) ?? t('pulse.agents.property', 'Logement #{{id}}', { id: propertyId }),
      value: `${count}`,
      alert: true,
    }));

  const stock: Highlight[] = (reorder.data ?? []).slice(0, 10).map((item) => ({
    id: String(item.id),
    label: item.name,
    value: `${item.quantity}/${item.reorderThreshold}`,
    hint: [item.propertyName, item.orderable ? item.supplierName : t('pulse.stock.noSupplier', 'sans fournisseur')]
      .filter(Boolean)
      .join(' · '),
  }));

  const unplanned = (departures.data ?? []).filter((d) => !d.cleaningPlanned);

  const items = tiles([
    kpis.total > 0 && {
      key: 'devices',
      href: '/connected-objects',
      title: t('pulse.devices.title', 'Parc connecté'),
      hint: t('pulse.devices.hint', '{{n}} objets suivis', { n: kpis.total }),
      render: () => <DonutChart
        buckets={devices.filter((b) => b.count > 0)}
        totalLabel={t('pulse.devices.total', 'Objets')}
        formatValue={format.count}
      />,
    },
    stock.length > 0 && {
      key: 'stock',
      href: '/properties',
      fluid: true,
      title: t('pulse.stock.title', 'Réassort à prévoir'),
      hint: t('pulse.stock.hint', 'Quantité restante sur seuil de commande'),
      render: () => <HighlightList items={stock} />,
    },
    agentQueue.length > 0 && {
      key: 'agent-queue',
      href: '/planning',
      fluid: true,
      title: t('pulse.agents.title', 'Cartes à valider'),
      hint: t('pulse.agents.hint', 'En attente dans la constellation'),
      render: () => <HighlightList items={agentQueue} />,
    },
    (departures.data?.length ?? 0) > 0 && {
      key: 'departures',
      href: '/reservations',
      fluid: true,
      title: t('pulse.departures.title', 'Départs des 7 jours'),
      hint: unplanned.length > 0
        ? t('pulse.departures.unplanned', '{{n}} sans ménage planifié', { n: unplanned.length })
        : t('pulse.departures.allPlanned', 'Tous les ménages sont posés'),
      render: () => (
        <SignalList
          items={(departures.data ?? []).slice(0, 12).map<SignalItem>((d) => ({
            id: String(d.reservationId),
            tone: d.cleaningPlanned ? 'success' : 'warning',
            title: `${d.checkOut} · ${d.propertyName ?? '—'}`,
            description: d.guestName ?? '',
            meta: d.cleaningPlanned ? undefined : t('pulse.departures.toPlan', 'ménage à planifier'),
          }))}
          emptyLabel={t('pulse.departures.empty', 'Aucun départ sur la fenêtre.')}
        />
      ),
    },
  ] as TileOrNothing[]);

  const figures: StatFigure[] = [
    kpis.total > 0 && {
      key: 'alerts',
      value: format.count(kpis.alerts),
      label: t('pulse.devices.alerts', 'En alerte'),
    },
    canSupervise && {
      key: 'queue',
      value: format.count(pendingTotal),
      label: t('pulse.agents.title', 'Cartes à valider'),
    },
    {
      key: 'reorder',
      value: format.count(reorder.data?.length ?? 0),
      label: t('pulse.stock.figure', 'Lignes sous seuil'),
    },
    {
      key: 'unplanned',
      value: format.count(unplanned.length),
      label: t('pulse.departures.figure', 'Départs sans ménage'),
    },
  ].filter(Boolean) as StatFigure[];

  return {
    figures,
    items,
    loading: devicesLoading || reorder.isLoading || departures.isLoading,
    fill: false,
  };
}

// ─── Conformité ──────────────────────────────────────────────────────────────

export function usePulseCompliance(): ReportContent {
  const { t } = useTranslation();
  const format = useReportFormats();

  const compliance = useQuery({
    queryKey: ['pulse', 'doc-compliance'],
    queryFn: () => documentsApi.getComplianceStats(),
    staleTime: STALE,
  });
  const contracts = useQuery({
    queryKey: ['pulse', 'contracts'],
    queryFn: () => managementContractsApi.getAll(),
    staleTime: STALE,
  });
  const filings = useQuery({
    queryKey: ['pulse', 'tax-filings'],
    queryFn: () => taxFilingsApi.list(),
    staleTime: STALE,
  });
  // Les statistiques ne renvoient que le nom de l'enum ; le serveur publie
  // deja le libelle lisible de chaque type, autant s'en servir plutot que de
  // tenir une seconde table ici.
  const documentTypes = useQuery({
    queryKey: ['pulse', 'document-types'],
    queryFn: () => documentsApi.getDocumentTypes(),
    staleTime: 60 * 60 * 1000,
  });
  const typeLabels = React.useMemo(
    () => new Map((documentTypes.data ?? []).map((option) => [option.value, option.label])),
    [documentTypes.data],
  );

  const byType: StatBucket[] = Object.entries(compliance.data?.documentsByType ?? {})
    .map(([type, count]) => ({ label: typeLabels.get(type) ?? type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const contractBuckets = (contracts.data ?? []).reduce<Record<string, number>>((acc: Record<string, number>, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
  const contractStatusLabel = (status: string) =>
    t(`pulse.contracts.status.${status}`, status);

  const due = (filings.data ?? []).filter((f) => f.status === 'DUE');

  const items = tiles([
    byType.length > 0 && {
      key: 'doc-types',
      href: '/documents',
      title: t('pulse.docs.title', 'Documents produits'),
      hint: compliance.data
        ? t('pulse.docs.hint', '{{locked}} verrouillés · {{score}} % de conformité', {
          locked: compliance.data.totalLocked,
          score: compliance.data.averageComplianceScore,
        })
        : undefined,
      render: () => <HistogramChart buckets={byType} label={t('pulse.docs.label', 'Documents')} tone="info" />,
    },
    (contracts.data?.length ?? 0) > 0 && {
      key: 'contracts',
      href: '/contracts',
      title: t('pulse.contracts.title', 'Mandats de gestion'),
      hint: t('pulse.contracts.hint', 'Par état du contrat'),
      render: () => (
        <DonutChart
          buckets={Object.entries(contractBuckets).map(([status, count]) => ({
            label: contractStatusLabel(status),
            count,
          }))}
          totalLabel={t('pulse.contracts.total', 'Mandats')}
          formatValue={format.count}
        />
      ),
    },
    (filings.data?.length ?? 0) > 0 && {
      key: 'tax-filings',
      href: '/settings',
      fluid: true,
      title: t('pulse.filings.title', 'Déclarations fiscales'),
      hint: due.length > 0
        ? t('pulse.filings.due', '{{n}} à déposer', { n: due.length })
        : t('pulse.filings.clear', 'Rien à déposer'),
      render: () => (
        <SignalList
          items={(filings.data ?? []).slice(0, 12).map<SignalItem>((f) => ({
            id: String(f.id),
            tone: f.status === 'DUE' ? 'warning' : f.status === 'PAID' ? 'success' : 'info',
            title: `${f.periodStart} → ${f.periodEnd}`,
            description: `${f.amount} ${f.currency}`,
            meta: t(`pulse.filings.status.${f.status}`, f.status),
          }))}
          emptyLabel={t('pulse.filings.empty', 'Aucune déclaration.')}
        />
      ),
    },
  ] as TileOrNothing[]);

  const figures: StatFigure[] = [
    compliance.data && {
      key: 'score',
      value: `${compliance.data.averageComplianceScore} %`,
      label: t('pulse.docs.score', 'Conformité documentaire'),
    },
    compliance.data && {
      key: 'locked',
      value: format.count(compliance.data.totalLocked),
      label: t('pulse.docs.locked', 'Documents verrouillés'),
    },
    {
      key: 'active-contracts',
      value: format.count(contractBuckets.ACTIVE ?? 0),
      label: t('pulse.contracts.active', 'Mandats actifs'),
    },
    { key: 'due', value: format.count(due.length), label: t('pulse.filings.figure', 'Déclarations à déposer') },
  ].filter(Boolean) as StatFigure[];

  return {
    figures,
    items,
    loading: compliance.isLoading || contracts.isLoading || filings.isLoading || documentTypes.isLoading,
    fill: false,
  };
}

// ─── Trésorerie ──────────────────────────────────────────────────────────────

export function usePulseFinance(): ReportContent {
  const { t } = useTranslation();
  const format = useReportFormats();

  const wallets = useQuery({
    queryKey: ['pulse', 'wallets'],
    queryFn: () => walletApi.getWallets(),
    staleTime: STALE,
  });
  const payouts = useQuery({
    queryKey: ['pulse', 'payouts-pending'],
    queryFn: () => accountingApi.getPayouts(undefined, 'PENDING'),
    staleTime: STALE,
  });

  const balances: StatBucket[] = (wallets.data ?? []).map((w) => ({
    label: w.walletType,
    count: Math.round(w.balance),
  }));

  const items = tiles([
    balances.length > 0 && {
      key: 'wallets',
      href: '/wallets',
      title: t('pulse.wallets.title', 'Soldes des portefeuilles'),
      hint: t('pulse.wallets.hint', 'Plateforme, séquestre, propriétaire, conciergerie'),
      render: () => (
        <HistogramChart
          buckets={balances}
          label={t('pulse.wallets.label', 'Solde')}
          formatValue={format.moneyCompact}
          tone="info"
        />
      ),
    },
    (payouts.data?.length ?? 0) > 0 && {
      key: 'payouts-pending',
      href: '/accounting',
      fluid: true,
      title: t('pulse.payouts.title', 'Reversements à approuver'),
      hint: t('pulse.payouts.hint', 'En attente de votre validation'),
      render: () => (
        <SignalList
          items={(payouts.data ?? []).slice(0, 12).map<SignalItem>((p) => ({
            id: String(p.id),
            tone: 'warning',
            title: p.ownerName ?? t('pulse.payouts.owner', 'Propriétaire #{{id}}', { id: p.ownerId }),
            description: `${p.periodStart} → ${p.periodEnd}`,
            meta: format.money(p.netAmount),
          }))}
          emptyLabel={t('pulse.payouts.empty', 'Rien à approuver.')}
        />
      ),
    },
  ] as TileOrNothing[]);

  const figures: StatFigure[] = [
    {
      key: 'total-balance',
      value: format.money((wallets.data ?? []).reduce((sum, w) => sum + w.balance, 0)),
      label: t('pulse.wallets.figure', 'Solde consolidé'),
    },
    {
      key: 'pending-payouts',
      value: format.money((payouts.data ?? []).reduce((sum, p) => sum + p.netAmount, 0)),
      label: t('pulse.payouts.figure', 'À approuver'),
    },
  ];

  return { figures, items, loading: wallets.isLoading || payouts.isLoading, fill: false };
}

// ─── Voyageurs ───────────────────────────────────────────────────────────────

export function usePulseGuest(): ReportContent {
  const { t } = useTranslation();
  const format = useReportFormats();

  const reviews = useQuery({
    queryKey: ['pulse', 'reviews'],
    queryFn: () => reviewsApi.list({ size: 200 }),
    staleTime: STALE,
  });
  const inbox = useQuery({
    queryKey: ['pulse', 'inbox'],
    queryFn: () => conversationApi.getInbox({ size: 100 }),
    staleTime: STALE,
  });

  const all = reviews.data?.content ?? [];
  const rated = all.filter((r) => typeof r.rating === 'number');
  const average = rated.length > 0
    ? rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
    : null;
  const distribution: StatBucket[] = [5, 4, 3, 2, 1].map((star) => ({
    label: `${star}★`,
    count: rated.filter((r) => Math.round(r.rating ?? 0) === star).length,
  }));
  const unanswered = all.filter((r) => !r.hostResponse);

  const conversations = (inbox.data?.content ?? []).filter((c) => c.unread);

  const items = tiles([
    rated.length > 0 && {
      key: 'reviews',
      href: '/channels/reviews',
      title: t('pulse.reviews.title', 'Réputation'),
      hint: average != null
        ? t('pulse.reviews.hint', '{{avg}}/5 sur {{n}} avis', {
          avg: average.toFixed(1).replace('.', ','),
          n: rated.length,
        })
        : undefined,
      render: () => (
        <DonutChart
          buckets={distribution.filter((b) => b.count > 0)}
          totalLabel={t('pulse.reviews.total', 'Avis')}
          formatValue={format.count}
        />
      ),
    },
    unanswered.length > 0 && {
      key: 'reviews-unanswered',
      href: '/channels/reviews',
      fluid: true,
      title: t('pulse.reviews.unansweredTitle', 'Avis sans réponse'),
      hint: t('pulse.reviews.unansweredHint', 'Une réponse pèse sur le classement'),
      render: () => (
        <UnansweredReviewList
          reviews={unanswered.slice(0, 12)}
          emptyLabel={t('pulse.reviews.allAnswered', 'Tous les avis ont une réponse.')}
        />
      ),
    },
    conversations.length > 0 && {
      key: 'conversations',
      href: '/contact',
      fluid: true,
      title: t('pulse.conversations.title', 'Conversations sans réponse'),
      hint: t('pulse.conversations.hint', 'Messages voyageurs non lus'),
      render: () => (
        <SignalList
          items={conversations.slice(0, 12).map<SignalItem>((c) => ({
            id: String(c.id),
            tone: 'warning',
            title: c.guestName ?? c.subject ?? t('pulse.conversations.thread', 'Conversation'),
            description: c.lastMessagePreview ?? '',
            meta: c.propertyName ?? undefined,
          }))}
          emptyLabel={t('pulse.conversations.empty', 'Aucun message en attente.')}
        />
      ),
    },
  ] as TileOrNothing[]);

  const figures: StatFigure[] = [
    average != null && {
      key: 'average',
      value: `${average.toFixed(1).replace('.', ',')}/5`,
      label: t('pulse.reviews.title', 'Réputation'),
    },
    {
      key: 'unanswered',
      value: format.count(unanswered.length),
      label: t('pulse.reviews.unansweredTitle', 'Avis sans réponse'),
    },
    {
      key: 'unread',
      value: format.count(conversations.length),
      label: t('pulse.conversations.figure', 'Messages non lus'),
    },
  ].filter(Boolean) as StatFigure[];

  return { figures, items, loading: reviews.isLoading || inbox.isLoading, fill: false };
}
