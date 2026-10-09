import { Link } from 'react-router-dom';
import { ArrowForward, Inventory2 } from '../../icons';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/StatusChip';
import { Button } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import type { ConsumableRow, ConsumablesView } from '../../services/api/consumablesApi';
import { StockThumbnail } from './StockThumbnail';
import './consumables.css';

export const propertyStockPath = (id: number) => `/properties/${id}?tab=inventory&subtab=stock`;

export function ConsumablesList({ rows, view, filtered, onReset, canOpenPlanning = false, compact = false }: {
  rows: ConsumableRow[];
  view: ConsumablesView;
  filtered: boolean;
  onReset: () => void;
  canOpenPlanning?: boolean;
  compact?: boolean;
}) {
  const { t, currentLanguage } = useTranslation();
  const formatDate = (date: string | null) => {
    if (!date || Number.isNaN(Date.parse(date))) return t('consumables.notRecorded');
    return new Intl.DateTimeFormat(currentLanguage, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
  };
  const quantityLabel = t(`consumables.quantity.${view}`);
  const dateLabel = t(`consumables.date.${view}`);

  if (!rows.length) return <EmptyState icon={<Inventory2 />} variant="transparent" minHeight={compact ? 180 : 280}
    title={t(filtered ? 'consumables.empty.filteredTitle' : `consumables.empty.${view}Title`)}
    description={t(filtered ? 'consumables.empty.filteredDescription' : `consumables.empty.${view}Description`)}
    action={filtered ? <Button variant="outline" onClick={onReset}>{t('consumables.reset')}</Button>
      : <Button asChild variant="outline"><Link to="/properties">{t('consumables.openProperties')}</Link></Button>} />;

  return <div className={`baitly-consumables-list${compact ? ' baitly-consumables-queue' : ''}`}>
    <div className="baitly-consumables-columns" aria-hidden="true">
      <span>{t('consumables.itemProperty')}</span><span>{quantityLabel}</span>
      <span>{t('properties.stock.supplier')}</span><span>{dateLabel}</span><span />
    </div>
    <ul aria-label={t(`tabHeaders.consumables.${view}`)}>
      {rows.map(row => {
        const low = view === 'stock' && row.threshold != null && row.threshold > 0 && row.quantity != null && row.quantity <= row.threshold;
        return <li key={row.id} className="baitly-consumables-row">
          <div className="baitly-consumables-product">
            <StockThumbnail {...row} size={58} />
            <div><h3>{row.name}</h3><Link to={propertyStockPath(row.propertyId)}>{row.propertyName}</Link></div>
          </div>
          <div className="baitly-consumables-cell">
            <span className="baitly-consumables-mobile-label">{quantityLabel}</span>
            {row.quantity == null ? <span className="baitly-consumables-muted">{t(view === 'ordered' ? 'consumables.notArchived' : 'consumables.notProvided')}</span>
              : <strong className="baitly-consumables-quantity">{row.quantity.toLocaleString(currentLanguage)} <small>{row.unit}</small></strong>}
            {low && <StatusChip tone="warn" size="sm" label={t('properties.stock.low')} />}
            {view === 'pending' && <StatusChip tone={row.actionable ? 'info' : 'warn'} size="sm"
              label={t(row.actionable ? 'consumables.toApprove' : 'consumables.toConfigure')} />}
            {view === 'ordered' && <StatusChip tone="info" size="sm" label={t('consumables.orderSent')} />}
            {view === 'stock' && row.threshold != null && row.threshold > 0 &&
              <small className="baitly-consumables-muted">{t('consumables.threshold', { count: row.threshold })}</small>}
          </div>
          <div className="baitly-consumables-cell">
            <span className="baitly-consumables-mobile-label">{t('properties.stock.supplier')}</span>
            <span className={row.supplierName ? undefined : 'baitly-consumables-muted'}>
              {row.supplierName || t(view === 'ordered' ? 'consumables.notArchived' : 'consumables.notProvided')}
            </span>
          </div>
          <div className="baitly-consumables-cell baitly-consumables-date">
            <span className="baitly-consumables-mobile-label">{dateLabel}</span>
            <span>{formatDate(view === 'ordered' ? row.orderedAt : row.createdAt)}</span>
            {view === 'stock' && row.lastRestockedAt && <small className="baitly-consumables-muted">
              {t('consumables.restocked', { date: formatDate(row.lastRestockedAt) })}
            </small>}
          </div>
          <div className="baitly-consumables-link">
            <Button asChild variant="outline" size="sm"><Link
              to={view === 'pending' && row.actionable && canOpenPlanning
                ? `/planning?property=${row.propertyId}&agent=ops` : propertyStockPath(row.propertyId)}>
              {t(view === 'pending' && row.actionable && canOpenPlanning ? 'consumables.openProposal' : 'consumables.openStock')}
              <ArrowForward size={14} className="rtl:rotate-180" />
            </Link></Button>
          </div>
          {row.description && <details className="baitly-consumables-details">
            <summary>{t(view === 'ordered' ? 'consumables.orderContext' : 'consumables.proposalContext')}</summary>
            <p>{row.description}</p>
          </details>}
        </li>;
      })}
    </ul>
  </div>;
}
