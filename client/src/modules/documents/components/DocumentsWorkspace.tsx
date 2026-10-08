import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, FileText } from '../../../icons/glyphs';
import { Button, Skeleton } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import DocumentStatusIcon from './DocumentStatusIcon';
import PagePagination from '../../../components/PagePagination';
import { useViewportFill } from '../../../hooks/useViewportFill';
import { useDynamicPageSize } from '../../../hooks/useDynamicPageSize';
import '../documentsWorkspace.css';

export const DOCUMENT_ART = {
  document: '/images/finance-kpis/documents.png', message: '/images/dashboard-actions/messages.webp',
  contract: '/images/hitl/management-contract.webp', compliance: '/images/hitl/approval.webp',
  variables: '/images/hitl/translation.webp', history: '/images/notifications/document.webp',
};
export function documentArtwork(type: string) {
  if (type.includes('MANDAT')) return DOCUMENT_ART.contract;
  if (type.includes('DEVIS') || type.includes('COMMANDE')) return '/images/hitl/quotes.webp';
  if (type.includes('INTERVENTION') || type.includes('TRAVAUX')) return '/images/hitl/maintenance.webp';
  if (type.includes('VALIDATION')) return '/images/hitl/work-review.webp';
  if (type.includes('REMBOURSEMENT')) return '/images/hitl/refund.webp';
  if (type.includes('FACTURE') || type.includes('PAIEMENT')) return '/images/finance-kpis/received.png';
  return DOCUMENT_ART.document;
}
const displayName = (value: string) => value.replace(/\bclenzy\b/gi, 'Baitly');
export interface DocumentRecord {
  id: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  image?: string;
  status?: { value: string; label: string };
  actions?: ReactNode;
  listActions?: ReactNode;
  detail: ReactNode;
  highlightId?: string;
}

export function DocumentFacts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="documents-facts">{items.map((item, index) => <div key={index}>
    <dt>{item.label}</dt><dd>{item.value || '—'}</dd>
  </div>)}</dl>;
}
export function DocumentsLoading() {
  const { t } = useTranslation();
  return <div className="documents-loading" role="status" aria-label={t('common.loading')}>
    {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full motion-reduce:animate-none" />)}
  </div>;
}
export default function DocumentsWorkspace({ records, pagination, label, selectedId, onSelect, empty, renderDetail, autoPaginate = false,
}: { records: DocumentRecord[]; pagination?: ReactNode; label: string; empty?: ReactNode;
  autoPaginate?: boolean;
  renderDetail?: (record: DocumentRecord) => ReactNode;
  selectedId?: string | null; onSelect?: (id: string | null) => void }) {
  const { t } = useTranslation();
  const [workspaceRef, height] = useViewportFill<HTMLElement>({ enabled: autoPaginate, minWidth: 0, minHeight: 160 });
  const { containerRef: listRef, pageSize } = useDynamicPageSize({
    enabled: autoPaginate,
    rowSelector: ':scope > ul > li', headerSelector: '.documents-workspace__list-title',
    rowHeight: 59, headerHeight: 47, bottomChrome: 54, min: 1, fallback: 12,
  });
  const [pageStart, setPageStart] = useState(0);
  const [localId, setLocalId] = useState<string | null>(null);
  const activeId = selectedId === undefined ? localId : selectedId;
  const active = records.find(row => row.id === activeId);
  const activeIndex = records.findIndex(row => row.id === activeId);
  const page = Math.min(Math.floor(pageStart / pageSize), Math.max(0, Math.ceil(records.length / pageSize) - 1));
  const visibleRecords = autoPaginate ? records.slice(page * pageSize, (page + 1) * pageSize) : records;
  useLayoutEffect(() => {
    if (autoPaginate && activeIndex >= 0) setPageStart(activeIndex);
  }, [autoPaginate, activeId, activeIndex, pageSize]);
  const detailId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const focusDetail = useRef(false);
  const select = (id: string | null) => { setLocalId(id); onSelect?.(id); };
  useLayoutEffect(() => {
    if (focusDetail.current && active) { heading.current?.focus(); focusDetail.current = false; }
  }, [active?.id]);
  return <section ref={workspaceRef} className="documents-workspace" data-fit={autoPaginate} style={autoPaginate ? { height } : undefined}
    data-selected={!!active} data-preview={!!renderDetail} aria-label={label}>
    <div ref={autoPaginate ? listRef : undefined} className="documents-workspace__list">
      <div className="documents-workspace__list-title"><span>{label}</span><FileText size={15} aria-hidden="true" /></div>
      {visibleRecords.length ? <ul>{visibleRecords.map(row => <li key={row.id} data-active={row.id === active?.id} data-highlight-id={row.highlightId}>
        <button type="button" className="documents-record" aria-pressed={row.id === active?.id} aria-controls={detailId}
          ref={node => { if (node) triggers.current.set(row.id, node); else triggers.current.delete(row.id); }}
          onClick={() => { focusDetail.current = window.matchMedia?.('(max-width: 767px)')?.matches ?? false; select(row.id); }}>
          <img src={row.image || DOCUMENT_ART.document} width={38} height={38} alt="" loading="lazy" />
          <span className="documents-record__title" title={displayName(row.title)}>{displayName(row.title)}</span>
          {row.meta && <span className="documents-record__meta">{row.meta}</span>}
          <ChevronRight size={15} className="documents-record__chevron" aria-hidden="true" />
        </button>
        {row.status && <DocumentStatusIcon {...row.status} />}
        {row.listActions}
      </li>)}</ul> : <div className="documents-workspace__empty-list">{empty || t('common.noResults', 'Aucun résultat')}</div>}
      {autoPaginate ? <div className="documents-workspace__pagination"><PagePagination compact hideOnSinglePage={false}
        page={page} rowsPerPage={pageSize} count={records.length} onPageChange={next => setPageStart(next * pageSize)} /></div> : pagination}
    </div>
    <div className="documents-workspace__detail" id={detailId}>
      {active ? <>
        <Button variant="ghost" size="sm" className="documents-workspace__back" onClick={() => {
          const trigger = triggers.current.get(active.id); select(null); requestAnimationFrame(() => trigger?.focus());
        }}><ArrowLeft size={15} />{t('documentsWorkspace.back')}</Button>
        {renderDetail ? <>
          <h2 ref={heading} tabIndex={-1} className="sr-only">{displayName(active.title)}</h2>
          {renderDetail(active)}
        </> : <><header className="documents-detail__header">
          <img src={active.image || DOCUMENT_ART.document} alt="" width={60} height={60} />
          <div><h2 ref={heading} tabIndex={-1}>{displayName(active.title)}</h2>{active.subtitle && <p dir="auto">{displayName(active.subtitle)}</p>}</div>
          {active.status && <DocumentStatusIcon {...active.status} />}
        </header>
        {active.actions && <div className="documents-detail__actions">{active.actions}</div>}
        <div className="documents-detail__body">{active.detail}</div>
        </>}
      </> : <div className="documents-workspace__intro">
        <img src={DOCUMENT_ART.document} alt="" width={88} height={88} />
        <h2>{t('documentsWorkspace.selectTitle')}</h2><p>{t('documentsWorkspace.selectHint')}</p>
      </div>}
    </div>
  </section>;
}
