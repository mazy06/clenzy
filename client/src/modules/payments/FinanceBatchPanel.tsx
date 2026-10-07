import { useRef, useState } from 'react';
import { Check, CheckCheck, ListChecks, Play, X, Search } from 'lucide-react';
import { Button, Checkbox, Spinner, Tooltip, TooltipContent, TooltipTrigger, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Input } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { activeIntlLocale } from '../../utils/activeLocale';
import { financeEventArtwork } from '../billing/components/financeEventArtwork';
import './financeBatch.css';
import PagePagination from '../../components/PagePagination';
import FinanceIdentity, { type FinanceIdentitySource } from '../billing/components/FinanceIdentity';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import HeaderAction from '../../components/HeaderAction';

export interface FinanceBatchItem {
  key: string;
  label: string;
  amount: number;
  currency: string;
  identity?: FinanceIdentitySource;
}
export interface FinanceBatchResult {
  key: string;
  state: 'ready' | 'sent' | 'approved' | 'blocked' | 'error';
  message?: string;
  url?: string;
}

/** Sélection explicite et récapitulatif avant toute action financière, sans conversion de devise. */
export function FinanceBatchPanel({ items, title, actionLabel, loadAll, onExecute, disabled = false, placement = 'inline' }: {
  items: FinanceBatchItem[];
  title: string;
  actionLabel: string;
  loadAll?: () => Promise<FinanceBatchItem[]>;
  onExecute: (items: FinanceBatchItem[]) => Promise<FinanceBatchResult[]>;
  disabled?: boolean;
  placement?: 'inline' | 'header';
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<FinanceBatchItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FinanceBatchResult[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const shown = choices.filter(item => [item.label, item.identity?.propertyName, item.identity?.actorName]
    .some(value => value?.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  const chosen = choices.filter(item => selected.has(item.key));
  const totals = chosen.reduce<Record<string, number>>((sum, item) => {
    sum[item.currency] = (sum[item.currency] ?? 0) + item.amount;
    return sum;
  }, {});
  const money = (amount: number, currency: string) => new Intl.NumberFormat(activeIntlLocale(), { style: 'currency', currency }).format(amount);

  const select = async (all: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const data = all && loadAll ? await loadAll() : items;
      const unique = [...new Map(data.map(item => [item.key, item])).values()];
      setChoices(unique); setSelected(new Set(all ? unique.map(item => item.key) : []));
      setResults([]); setSearch(''); setPage(0); setOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('financeBatch.failed'));
    } finally { lock.current = false; setBusy(false); }
  };

  const execute = async () => {
    if (lock.current || !chosen.length) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const next = await onExecute(chosen);
      setResults(next);
      // Les liens prêts ne sont pas des paiements : leur règlement reste à faire chez le PSP.
      setSelected(new Set());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('financeBatch.failed'));
    } finally { lock.current = false; setBusy(false); }
  };
  const iconAction = (label: string, icon: React.ReactNode, onClick: () => void) => placement === 'header'
    ? <HeaderAction label={label} icon={icon} disabled={busy || disabled} onClick={event => { trigger.current = event.currentTarget; onClick(); }} />
    : <Tooltip>
    <TooltipTrigger asChild><Button variant="outline" size="icon-sm" aria-label={label} disabled={busy || disabled} onClick={event => { trigger.current = event.currentTarget; onClick(); }}>{icon}</Button></TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>;

  const controls = <div className={placement === 'header' ? 'finance-batch-header' : 'finance-batch-launcher__controls'} role="group" aria-label={title}>
      {placement === 'inline' && <span className="text-xs font-medium text-muted-foreground">{title}</span>}
      {iconAction(t('financeBatch.choose'), <ListChecks size={16} />, () => { void select(false); })}
      {iconAction(t('financeBatch.selectAll'), <CheckCheck size={16} />, () => { void select(true); })}
      {busy && <Spinner className="size-4" />}
    </div>;
  const headerActions = usePageHeaderActions(placement === 'header' ? controls : null);
  return <>
    {placement === 'header' ? headerActions : <section className="finance-batch-launcher" aria-label={title}>{controls}</section>}
    {error && !open && <p role="alert" className="mt-2 text-sm text-destructive-ink">{error}</p>}
    <Dialog open={open} onOpenChange={next => { if (!lock.current) setOpen(next); }}>
      <DialogContent className="finance-batch-modal" showCloseButton={false} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}
        onEscapeKeyDown={event => { if (lock.current) event.preventDefault(); }} onInteractOutside={event => { if (lock.current) event.preventDefault(); }}>
        <DialogHeader className="finance-batch-modal__header">
          <img src="/images/finance-kpis/transfer.png" alt="" width={56} height={56} />
          <div><DialogTitle>{title}</DialogTitle><DialogDescription>{t('financeBatch.reviewHint')}</DialogDescription></div>
          <Button className="finance-batch-modal__close" variant="ghost" size="icon-sm" aria-label={t('common.close', 'Fermer')} disabled={busy} onClick={() => setOpen(false)}><X size={18} /></Button>
        </DialogHeader>
        <div className="finance-batch-modal__toolbar">
          <label className="finance-batch-modal__search"><Search size={16} aria-hidden="true" /><Input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder={t('financeBatch.search')} aria-label={t('financeBatch.search')} /></label>
          <Button className="finance-batch-modal__select-all" variant="outline" size="sm" aria-pressed={shown.length > 0 && shown.every(item => selected.has(item.key))} disabled={busy || !!results.length || !shown.length} onClick={() => setSelected(new Set(shown.every(item => selected.has(item.key)) ? [] : shown.map(item => item.key)))}><CheckCheck size={16} />{t('financeBatch.toggleAll')}</Button>
        </div>
        {error && <p role="alert" className="finance-batch-modal__error">{error}</p>}
        {choices.length === 0 && <p className="finance-batch-modal__empty">{t('financeBatch.empty')}</p>}
        {choices.length > 0 && shown.length === 0 && <p className="finance-batch-modal__empty">{t('financeBatch.noMatch')}</p>}
        <ul className="finance-batch-modal__list">
        {shown.slice(page * 12, (page + 1) * 12).map(item => {
          const result = results.find(value => value.key === item.key);
          return <li key={item.key} data-selected={selected.has(item.key)}>
            <Checkbox className="finance-batch-modal__checkbox" aria-label={t('financeBatch.selectItem', { name: item.identity ? `${item.label} · ${item.identity.propertyName || ''} · ${money(item.amount, item.currency)}` : item.label })} checked={selected.has(item.key)} disabled={busy || !!result} onCheckedChange={checked => setSelected(previous => {
              const next = new Set(previous); if (checked) next.add(item.key); else next.delete(item.key); return next;
            })} />
            <img src={financeEventArtwork(item.label)} alt="" width={36} height={36} />
            <span className="min-w-0 flex-1"><span className="finance-batch-modal__item-label">{item.label}</span>
              {item.identity && <FinanceIdentity source={item.identity} />}
              {result && <span role="status" className={`block text-xs ${result.state === 'error' || result.state === 'blocked' ? 'text-warning-ink' : 'text-muted-foreground'}`}>
                {t(`financeBatch.results.${result.state}`)}{result.message ? ` : ${result.message}` : ''}
                {result.url && /^https?:\/\//.test(result.url) && <a className="ms-2 font-medium text-primary underline" href={result.url} target="_blank" rel="noopener noreferrer">{t('financeBatch.openCheckout')}</a>}
              </span>}
            </span>
            <span className="shrink-0 tabular-nums text-xs font-medium">{money(item.amount, item.currency)}</span>
          </li>;
        })}
      </ul>
      {shown.length > 12 && <PagePagination count={shown.length} page={page} onPageChange={setPage} rowsPerPage={12} />}
      <footer className="finance-batch-modal__footer">
        <div className="finance-batch-modal__totals"><span>{t('financeBatch.selected', { count: chosen.length })}</span><div>{Object.entries(totals).map(([currency, total]) => <strong key={currency}>{money(total, currency)}</strong>)}</div></div>
        <Tooltip><TooltipTrigger asChild><Button className="finance-batch-modal__submit" variant="default" size="icon" aria-label={actionLabel} disabled={busy || disabled || !chosen.length} onClick={() => { void execute(); }}>{busy ? <Spinner className="size-4" /> : results.length ? <Check size={18} /> : <Play size={18} />}</Button></TooltipTrigger><TooltipContent>{actionLabel}</TooltipContent></Tooltip>
      </footer>
      </DialogContent>
    </Dialog>
  </>;
}
