import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronDown, PackageCheck, TriangleAlert } from '../../icons/glyphs';
import { Inventory2 } from '../../icons';
import { Alert, AlertDescription, Button, Input } from '../../components/ui';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/StatusChip';
import { useTranslation } from '../../hooks/useTranslation';
import type { ConsumableRow } from '../../services/api/consumablesApi';
import { propertyStockApi } from '../../services/api/propertyStockApi';
import { propertyStockPath } from './ConsumablesList';
import { StockThumbnail } from './StockThumbnail';

export function BaitlyConsumableInventory({ rows, filtered, onReset, canEdit }: {
  rows: ConsumableRow[]; filtered: boolean; onReset: () => void; canEdit: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!rows.length) return <EmptyState icon={<Inventory2 />} variant="transparent" minHeight={300}
    title={t(filtered ? 'consumables.empty.filteredTitle' : 'consumables.empty.stockTitle')}
    description={t(filtered ? 'consumables.empty.filteredDescription' : 'consumables.empty.stockDescription')}
    action={filtered ? <Button variant="outline" onClick={onReset}>{t('consumables.reset')}</Button>
      : <Button asChild variant="outline"><Link to="/properties">{t('consumables.openProperties')}</Link></Button>} />;
  return <ul className="baitly-supply-inventory" aria-label={t('consumables.workspace.stock')}>
    {rows.map(row => <InventoryItem key={row.id} row={row} canEdit={canEdit} expanded={expanded === row.id}
      onToggle={() => setExpanded(expanded === row.id ? null : row.id)} />)}
  </ul>;
}

function InventoryItem({ row, expanded, onToggle, canEdit }: {
  row: ConsumableRow; expanded: boolean; onToggle: () => void; canEdit: boolean;
}) {
  const { t, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const id = useId();
  const [received, setReceived] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const threshold = row.threshold != null && row.threshold > 0 ? row.threshold : null;
  const low = threshold != null && row.quantity != null && row.quantity <= threshold;
  const out = row.quantity === 0;
  const quantity = Number(received);
  const maximumReceipt = 2147483647 - Math.max(0, row.quantity ?? 0);
  const valid = received.trim() !== '' && Number.isInteger(quantity) && quantity > 0 && quantity <= maximumReceipt;
  const formatDate = (date: string) => Number.isNaN(Date.parse(date)) ? t('consumables.notRecorded')
    : new Intl.DateTimeFormat(currentLanguage, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

  const receive = async () => {
    if (!valid || !canEdit || row.stockItemId == null || saving) return;
    setSaving(true); setError(false); setConfirmed(null);
    try {
      await propertyStockApi.restock(row.propertyId, row.stockItemId, quantity);
      setConfirmed(quantity); setReceived('');
      await queryClient.invalidateQueries({ queryKey: ['consumables'] });
    } catch { setError(true); }
    finally { setSaving(false); }
  };

  return <li className="baitly-supply-item" data-low={low || undefined}>
    <div className="baitly-supply-item-main">
      <StockThumbnail {...row} size={76} />
      <div className="baitly-supply-item-copy">
        <button type="button" className="baitly-supply-item-title" onClick={onToggle} aria-expanded={expanded} aria-controls={`${id}-details`}>
          {row.name}
        </button>
        <Link to={propertyStockPath(row.propertyId)}>{row.propertyName}</Link>
        <span className="baitly-supply-supplier">{row.supplierName || t('consumables.notProvided')}</span>
      </div>
      <div className="baitly-supply-level">
        <div className="baitly-supply-level-heading">
          <strong>{row.quantity?.toLocaleString(currentLanguage) ?? t('consumables.notProvided')} <small>{row.unit}</small></strong>
          <StatusChip tone={out ? 'err' : low ? 'warn' : 'neutral'} size="sm"
            label={t(row.quantity == null ? 'consumables.notProvided' : out ? 'consumables.workspace.out' : low ? 'properties.stock.low' : threshold ? 'consumables.workspace.available' : 'consumables.workspace.noThreshold')} />
        </div>
        {threshold != null && row.quantity != null ? <>
          <div className="baitly-supply-meter" role="meter" aria-label={t('consumables.workspace.level', { name: row.name })}
            aria-valuemin={0} aria-valuemax={threshold} aria-valuenow={Math.min(Math.max(0, row.quantity), threshold)}
            aria-valuetext={t('consumables.workspace.levelText', { quantity: row.quantity, threshold, unit: row.unit ?? '' })}>
            <span style={{ transform: `scaleX(${Math.min(Math.max(0, row.quantity) / threshold, 1)})` }} />
          </div>
          <span className="baitly-supply-threshold">{low && <TriangleAlert size={12} aria-hidden="true" />}{t('consumables.threshold', { count: threshold })}</span>
        </> : <span className="baitly-supply-threshold">{t('consumables.workspace.noThresholdHint')}</span>}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label={t('consumables.workspace.details', { name: row.name })}
        aria-expanded={expanded} aria-controls={`${id}-details`} onClick={onToggle}>
        <ChevronDown size={18} className={expanded ? 'rotate-180' : undefined} />
      </Button>
    </div>
    <div id={`${id}-details`} hidden={!expanded} className="baitly-supply-item-details">
      <div className="baitly-supply-item-history">
        <p>{row.lastRestockedAt ? t('consumables.restocked', { date: formatDate(row.lastRestockedAt) }) : t('consumables.workspace.noReceipt')}</p>
        <Button asChild variant="outline" size="sm"><Link to={propertyStockPath(row.propertyId)}>{t('consumables.workspace.configure')}</Link></Button>
      </div>
      {canEdit && row.stockItemId != null && <form className="baitly-supply-receive" onSubmit={event => { event.preventDefault(); void receive(); }}>
        <div><h4><PackageCheck size={17} aria-hidden="true" />{t('consumables.workspace.receive')}</h4><p>{t('consumables.workspace.receiveHint')}</p></div>
        <label htmlFor={`${id}-quantity`}>{t('consumables.workspace.receivedQuantity')}</label>
        <div className="baitly-supply-receive-controls">
          <Input id={`${id}-quantity`} type="number" min={1} max={maximumReceipt} step={1} required value={received}
            onChange={event => { setReceived(event.target.value); setConfirmed(null); }} disabled={saving} className="tabular-nums" />
          {row.unit && <span>{row.unit}</span>}
          <Button type="submit" size="sm" disabled={!valid || saving}>{t(saving ? 'common.saving' : 'consumables.workspace.confirmReceipt')}</Button>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{t('consumables.workspace.receiveError')}</AlertDescription></Alert>}
        {confirmed != null && <p className="baitly-supply-confirmed" role="status">{t('consumables.workspace.received', { count: confirmed })}</p>}
      </form>}
    </div>
  </li>;
}
