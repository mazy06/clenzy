import { useState, type ReactNode } from 'react';
import StatTileRow from '../../../components/baitly/StatTileRow';
import DashboardKpiDetail from '../../dashboard/DashboardKpiDetail';
import { useTranslation } from '../../../hooks/useTranslation';
import { activeIntlLocale } from '../../../utils/activeLocale';
import { financeAmountGroups, type FinanceAmountKind, type FinanceAmountRecord } from './financeAmounts';
import type { PaymentAmountGroup } from '../../../services/api/paymentsApi';
import '../../dashboard/dashboardKpis.css';
import './financeWorkspace.css';

export const FINANCE_KPI_ARTWORK = {
  received: '/images/finance-kpis/received.png',
  pending: '/images/finance-kpis/pending.png',
  transfer: '/images/finance-kpis/transfer.png',
  documents: '/images/finance-kpis/documents.png',
} as const;

export interface FinanceKpi {
  key: string;
  label: string;
  value: ReactNode;
  artwork: keyof typeof FINANCE_KPI_ARTWORK;
  description: string;
  advice: string;
}

/** Reuses the dashboard drawer, including its concave seam, expanded tile and touch behaviour. */
export default function FinanceKpis({ items, loading, scope }: { items: FinanceKpi[]; loading?: boolean; scope?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  return <section className="db-kpis finance-kpis" data-count={items.length} aria-label={t('financeWorkspace.indicators')} aria-busy={loading}>
    <StatTileRow presentation="overview">{items.map(item => <DashboardKpiDetail key={item.key}
      artwork={item.key === 'ota' ? '/images/hitl/channel-sync.webp' : FINANCE_KPI_ARTWORK[item.artwork]} label={item.label} value={item.value}
      open={open === item.key} onOpenChange={next => setOpen(current => next ? item.key : current === item.key ? null : current)} loading={loading}>
      <p className="db-kpis__period">{scope || t('financeWorkspace.filteredScope')}</p>
      <p className="db-kpis__hint">{item.description}</p>
      <div className="db-kpis__confidence"><span>{t('dashboardKpis.confidence.label')}</span><strong>{t('financeWorkspace.recorded')}</strong></div>
      <div className="db-kpis__advice"><h4>{t('dashboardKpis.recommendation')}</h4><p>{item.advice}</p></div>
    </DashboardKpiDetail>)}</StatTileRow>
  </section>;
}

export function FinanceAmountKpis({ records = [], amountGroups, loading, scope, kind }: { records?: FinanceAmountRecord[]; amountGroups?: PaymentAmountGroup[]; kind: FinanceAmountKind; loading?: boolean; scope?: string }) {
  const { t } = useTranslation();
  const groups = amountGroups ?? financeAmountGroups(records, kind);
  return <FinanceKpis loading={loading} scope={scope} items={groups.map(group => ({ ...group,
    label: t(`financeWorkspace.amounts.${kind}.${group.key}`),
    value: <span className="finance-kpis__amounts">{group.totals.length ? group.totals.map(([currency, amount]) =>
      <span key={currency}>{new Intl.NumberFormat(activeIntlLocale(), { style: 'currency', currency }).format(amount)}</span>) : group.unavailable ? '—' : '0'}</span>,
    description: [t('financeWorkspace.amounts.recordCount', { count: group.count }), t(`financeWorkspace.amounts.description.${group.key}`),
      group.unavailable ? t('financeWorkspace.amounts.unavailable', { count: group.unavailable }) : '',
    ].filter(Boolean).join(' '),
    advice: t(`financeWorkspace.kpis.${group.key}.advice`),
  }))} />;
}
