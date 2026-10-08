import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import PagePagination from '../../../components/PagePagination';
import { useFinanceLayout } from './useFinanceLayout';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import './financeWorkspace.css';
import FinanceIdentity, { type FinanceIdentitySource } from './FinanceIdentity';

export interface FinanceRecord {
  id: string | number;
  title: ReactNode;
  subtitle?: ReactNode;
  amount?: ReactNode;
  status?: ReactNode;
  meta?: ReactNode;
  fields: { label: ReactNode; value: ReactNode }[];
  actions?: ReactNode;
  headerActions?: ReactNode;
  detail?: ReactNode;
  /** Contenu métier à la place du résumé générique, après le titre accessible. */
  detailBody?: ReactNode;
  identity?: FinanceIdentitySource;
  eventImage?: string;
}

/** A single record model drives both the list and detail. Actions exist only in the detail. */
export default function FinanceWorkspace({ items, pagination, artwork = 'documents', selectedId, selectedRecord, onSelect, onPageSizeChange, highlightId }: {
  items: FinanceRecord[];
  pagination?: ReactNode;
  artwork?: 'documents' | 'received' | 'pending' | 'transfer';
  selectedId?: string | number | null;
  /** Dossier recalculé depuis les données filtrées, même hors de la page visible. */
  selectedRecord?: FinanceRecord;
  onSelect?: (id: string | number | null) => void;
  /** Les listes paginées par le serveur utilisent la même capacité mesurée. */
  onPageSizeChange?: (size: number) => void;
  /** Une notification doit atteindre sa ligne, même au-delà de la première page. */
  highlightId?: string | null;
}) {
  const { t } = useTranslation();
  const { workspaceRef, height, listRef, pageSize } = useFinanceLayout();
  const autoPaginate = pagination === undefined;
  const [pageStart, setPageStart] = useState(0);
  const [localId, setLocalId] = useState<string | number | null>(null);
  const activeId = selectedId === undefined ? localId : selectedId;
  // Resolve every render: mutations and filters must never leave a stale financial snapshot.
  const active = selectedRecord && String(selectedRecord.id) === String(activeId)
    ? selectedRecord : items.find(item => String(item.id) === String(activeId));
  const activeIndex = items.findIndex(item => String(item.id) === String(activeId));
  const highlightedIndex = items.findIndex(item => String(item.id) === highlightId);
  const page = Math.min(Math.floor(pageStart / pageSize), Math.max(0, Math.ceil(items.length / pageSize) - 1));
  const visibleItems = autoPaginate ? items.slice(page * pageSize, (page + 1) * pageSize) : items;
  useEffect(() => { onPageSizeChange?.(pageSize); }, [pageSize, onPageSizeChange]);
  useLayoutEffect(() => {
    if (autoPaginate && highlightedIndex >= 0) setPageStart(highlightedIndex);
  }, [autoPaginate, highlightId, highlightedIndex]);
  useLayoutEffect(() => {
    if (autoPaginate && activeIndex >= 0) setPageStart(activeIndex);
  }, [autoPaginate, activeId, activeIndex, pageSize]);
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const select = (value: string | number | null) => { setLocalId(value); onSelect?.(value); };
  return <section ref={workspaceRef} className="finance-workspace" style={{ height }} data-selected={!!active}>
    <div ref={listRef} className="finance-workspace__list">
      <ul aria-label={t('financeWorkspace.records')} data-identity={items.some(item => !!item.identity)}>
        {visibleItems.map(item => <li key={item.id} data-highlight-id={String(item.id)}>
          <button type="button" className="finance-workspace__row" data-identity={!!item.identity} aria-pressed={active?.id === item.id}
            aria-controls={`${id}-detail`} onClick={event => {
              trigger.current = event.currentTarget; select(item.id);
              requestAnimationFrame(() => {
                if (!trigger.current?.getClientRects().length) heading.current?.focus();
              });
            }}>
            <div className="finance-workspace__event"><img src={item.eventImage || `/images/finance-kpis/${artwork}.png`} alt="" width={32} height={32} /><div className="finance-workspace__title">{item.title}</div></div>
            {item.identity && <FinanceIdentity source={item.identity} />}
            <div className="finance-workspace__amount">{item.amount}</div>
          </button>
          <div className="finance-workspace__row-status">{item.status}</div>
        </li>)}
      </ul>
      <div className="finance-workspace__pagination">{autoPaginate
        ? <PagePagination compact hideOnSinglePage={false} page={page} rowsPerPage={pageSize} count={items.length}
            onPageChange={next => setPageStart(next * pageSize)} />
        : pagination}</div>
    </div>
    <div className="finance-workspace__detail" id={`${id}-detail`} role="region" aria-label={t('common.details', 'Détails')}>
      {active ? <>
        <Button variant="ghost" size="sm" className="finance-workspace__back" onClick={() => {
          select(null); requestAnimationFrame(() => trigger.current?.focus());
        }}><ArrowLeft size={16} />{t('financeWorkspace.back')}</Button>
        <header className="finance-workspace__header">
          <img src={active.eventImage || `/images/finance-kpis/${artwork}.png`} alt="" width={56} height={56} />
          <div><h2 ref={heading} tabIndex={-1}>{active.title}</h2><div className="finance-workspace__subtitle">{active.subtitle}</div></div>
          {active.headerActions}
        </header>
        {active.detailBody ?? <>
        {active.identity && <div className="finance-workspace__identity-detail"><FinanceIdentity source={active.identity} /></div>}
        <div className="finance-workspace__balance"><strong>{active.amount}</strong><div>{active.status}</div></div>
        {active.actions && <div className="finance-workspace__actions" aria-label={t('common.actions', 'Actions')}>{active.actions}</div>}
        <dl className="finance-workspace__facts">{active.fields.map((field, index) => <div key={index}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
        {active.detail}
        </>}
      </> : <div className="finance-workspace__empty">
        <img src={`/images/finance-kpis/${artwork}.png`} alt="" width={88} height={88} />
        <h2>{t('financeWorkspace.choose')}</h2><p>{t('financeWorkspace.chooseHint')}</p>
      </div>}
    </div>
  </section>;
}
