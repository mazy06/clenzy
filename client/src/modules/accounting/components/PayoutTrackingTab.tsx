import FinanceStatusIcon from '../../billing/components/FinanceStatusIcon';
import FinanceHeaderFilters from '../../billing/components/FinanceHeaderFilters';
import { useFinanceLayout } from '../../billing/components/useFinanceLayout';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button, Input, Skeleton } from '../../../components/ui';
import PagePagination from '../../../components/PagePagination';
import { usePageHeaderActions } from '../../../components/PageHeaderActionsContext';
import { useScreenSearch } from '../../../components/ScreenChrome';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { intlLocale } from '../../../utils/localeDate';
import { payoutTransfersApi, type PayoutTransfer, type TransferFilters, type TransferState, type TransferSource } from '../../../services/api/payoutTransfersApi';
import '../../supervision/supervision-surfaces.css';
import './payout-tracking.css';
import PayoutMonitoringPanel from './PayoutMonitoringPanel';
import BaitlyTransferRecoveries from './BaitlyTransferRecoveries';
import { FinanceAmountKpis } from '../../billing/components/FinanceKpis';

export default function PayoutTrackingTab() {
  const { user } = useAuth();
  if (!user) return null;
  const scope = `${user.id}:${user.organizationId}`;
  return <PayoutTracking key={scope} scope={scope} organizationName={user.organizationName} />;
}

function TransferBadge({ state }: { state: TransferState }) {
  const { t } = useTranslation();
  return <FinanceStatusIcon value={state} label={t(`payoutTracking.states.${state}`)} />;
}

function PayoutTracking({ scope, organizationName }: { scope: string; organizationName?: string }) {
  const { t, currentLanguage } = useTranslation();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TransferFilters>({ page: 0, state: '', source: '', search: '' });
  const [selected, setSelected] = useState<number | null>(() => {
    const requested = new URLSearchParams(window.location.search).get('transfer');
    return requested && /^[1-9]\d{0,14}$/.test(requested) ? Number(requested) : null;
  });
  const { workspaceRef, height, listRef, pageSize } = useFinanceLayout<HTMLDivElement>();
  const queries = useQueryClient();
  const key = ['payout-transfers', scope];
  const list = useQuery({ queryKey: [...key, filters, pageSize], queryFn: () => payoutTransfersApi.list({ ...filters, size: pageSize }), placeholderData: keepPreviousData });
  const amounts = useQuery({ queryKey: [...key, 'amounts', filters.state, filters.source, filters.search],
    queryFn: () => payoutTransfersApi.listAll({ state: filters.state, source: filters.source, search: filters.search }), staleTime: 30_000 });
  const detail = useQuery({ queryKey: [...key, 'detail', selected], queryFn: () => payoutTransfersApi.detail(selected!), enabled: selected !== null });
  const selectionButton = useRef<HTMLButtonElement | null>(null);
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const onSearch = useCallback((value: string) => setSearch(value.slice(0, 120)), []);
  useScreenSearch(search, onSearch, t('payoutTracking.search'));
  useEffect(() => {
    if (search === filters.search) return;
    const timer = window.setTimeout(() => { setFilters((value) => ({ ...value, search, page: 0 })); setSelected(null); }, 300);
    return () => window.clearTimeout(timer);
  }, [search, filters.search]);
  useEffect(() => { if (selected !== null && !detail.isPending) detailHeading.current?.focus(); }, [selected, detail.isPending]);
  useEffect(() => {
    const totalPages = list.data?.totalPages;
    if (totalPages !== undefined && filters.page > 0 && filters.page >= totalPages) {
      if (!list.isPlaceholderData) setFilters((value) => ({ ...value, page: Math.max(0, totalPages - 1) }));
    }
  }, [list.data, list.isPlaceholderData, filters.page]);
  const refresh = () => { void queries.invalidateQueries({ queryKey: key }); };
  const header = usePageHeaderActions(<Button variant="outline" size="sm" disabled={list.isFetching || detail.isFetching} onClick={refresh}>
    <RefreshCw size={15} aria-hidden="true" />{t('common.refresh', 'Actualiser')}
  </Button>);
  const money = (value: PayoutTransfer) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: value.currency }).format(value.amount);
  const date = (value: string) => new Intl.DateTimeFormat(intlLocale(currentLanguage), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const changeFilter = (part: Partial<TransferFilters>) => { setFilters((value) => ({ ...value, ...part, page: 0 })); setSelected(null); };
  const close = () => { setSelected(null); window.requestAnimationFrame(() => selectionButton.current?.focus()); };
  const transfer = detail.data?.transfer;

  return <section className="payout-tracking baitly-supervision-surface" aria-label={t('payoutTracking.title')}>
    {header}
    {!amounts.isError && <FinanceAmountKpis kind="tracking" records={(amounts.data ?? []).map(row => ({ status: row.state, amount: row.amount, currency: row.currency }))} loading={amounts.isPending} />}
    {amounts.isError && <p role="alert">{t('payoutTracking.loadError')} <Button variant="ghost" onClick={() => { void amounts.refetch(); }}>{t('common.retry')}</Button></p>}
    <FinanceHeaderFilters>
      <label>{t('payoutTracking.filterState')}<select value={filters.state} onChange={(event) => changeFilter({ state: event.target.value as TransferState | '' })}>
        <option value="">{t('payoutTracking.allStates')}</option>
        {(['RECONCILIATION_REQUIRED', 'SUBMITTING', 'TRANSFERRED'] as const).map((state) => <option key={state} value={state}>{t(`payoutTracking.states.${state}`)}</option>)}
      </select></label>
      <label>{t('payoutTracking.filterSource')}<select value={filters.source} onChange={(event) => changeFilter({ source: event.target.value as TransferSource | '' })}>
        <option value="">{t('payoutTracking.allSources')}</option>
        <option value="OWNER_PAYOUT">{t('payoutTracking.sources.OWNER_PAYOUT')}</option><option value="INTERVENTION">{t('payoutTracking.sources.INTERVENTION')}</option><option value="PROVIDER_EXPENSE">{t('payoutTracking.sources.PROVIDER_EXPENSE')}</option><option value="COMMERCE">{t('payoutTracking.sources.COMMERCE')}</option>
      </select></label>
    </FinanceHeaderFilters>
    <div ref={workspaceRef} style={{ height }} className="payout-tracking__workspace payout-tracking__workspace--fit" data-selected={selected !== null}>
      <div ref={listRef} className="payout-tracking__list">
        {list.isPending ? <div className="payout-tracking__placeholder" aria-label={t('common.loading', 'Chargement…')}>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full mb-3" />)}</div>
          : list.isError ? <div role="alert" className="payout-tracking__placeholder"><p>{t('payoutTracking.loadError')}</p><Button variant="outline" onClick={() => { void list.refetch(); }}>{t('common.retry', 'Réessayer')}</Button></div>
          : !list.data?.content.length ? <div className="payout-tracking__placeholder"><h3>{t('payoutTracking.empty')}</h3><p>{t('payoutTracking.emptyHint')}</p></div>
          : <ul aria-label={t('payoutTracking.transfers')}>{list.data.content.map((row) => <li key={row.id}>
            <button className="payout-tracking__row" aria-label={`${row.description}. ${money(row)}. ${t(`payoutTracking.states.${row.state}`)}.`} aria-pressed={selected === row.id} onClick={(event) => { selectionButton.current = event.currentTarget; setSelected(row.id); }}>
              <span className="payout-tracking__row-title">{row.description}</span>
              <strong>{money(row)}</strong>
            </button>
            <span className="payout-tracking__row-status"><TransferBadge state={row.state} /></span>
          </li>)}</ul>}
        {list.data && !list.isError && <PagePagination page={filters.page} onPageChange={(page) => { setFilters((value) => ({ ...value, page })); setSelected(null); }} count={list.data.totalElements} rowsPerPage={pageSize} hideOnSinglePage={false} compact className="payout-tracking__pagination" />}
      </div>
      <div className="payout-tracking__detail">
    <div className="payout-tracking__intro">
      <div><h2>{t('payoutTracking.title')}</h2><p>{t('payoutTracking.scope', { name: organizationName || t('payoutTracking.currentOrganization') })}</p></div>
      <p className="payout-tracking__explanation">{t('payoutTracking.intro')}</p>
    </div>
    <PayoutMonitoringPanel scope={scope} onSelect={(id, button) => {
      selectionButton.current = button; setSelected(id);
      void queries.invalidateQueries({ queryKey: [...key, 'detail', id] });
    }} />

        {selected === null ? <div className="payout-tracking__placeholder payout-tracking__choose"><ShieldCheck size={28} aria-hidden="true" /><h3>{t('payoutTracking.select')}</h3><p>{t('payoutTracking.selectHint')}</p></div>
          : <>
            <Button variant="ghost" size="sm" className="payout-tracking__back" onClick={close}><ArrowLeft size={16} aria-hidden="true" />{t('payoutTracking.back')}</Button>
            {detail.isPending ? <Skeleton className="h-72 w-full" aria-label={t('common.loading', 'Chargement…')} />
              : detail.isError ? <div role="alert"><h3 ref={detailHeading} tabIndex={-1}>{t('payoutTracking.loadError')}</h3><Button variant="outline" onClick={() => { void detail.refetch(); }}>{t('common.retry', 'Réessayer')}</Button></div>
              : transfer && detail.data ? <>
                <header className="payout-tracking__detail-header">
                  <p>{t(`payoutTracking.sources.${transfer.source}`)} · <bdi>#{transfer.sourceId}</bdi></p>
                  <h3 tabIndex={-1} ref={detailHeading}>{transfer.description}</h3>
                  <div><strong className="payout-tracking__amount">{money(transfer)}</strong><TransferBadge state={transfer.state} /></div>
                </header>
                <dl className="payout-tracking__facts">
                  <div><dt>{t('payoutTracking.beneficiary')}</dt><dd>{detail.data.beneficiaryName || t(transfer.beneficiaryOrganizationId ? 'payoutTracking.company' : 'payoutTracking.person', { id: transfer.beneficiaryOrganizationId ?? transfer.beneficiaryUserId })}</dd></div>
                  <div><dt>{t('payoutTracking.reference')}</dt><dd><bdi>{transfer.externalReference || t('payoutTracking.noReference')}</bdi></dd></div>
                  <div><dt>{t('payoutTracking.created')}</dt><dd>{date(transfer.createdAt)}</dd></div>
                </dl>
                <BaitlyTransferRecoveries recoveries={detail.data.recoveries} />
                <section className="payout-tracking__section"><h4>{t('payoutTracking.bankTitle')}</h4><p>{t('payoutTracking.bankHint')}</p>
                  {!detail.data.bankPayouts.length ? <p className="payout-tracking__notice">{t('payoutTracking.bankUnknown')}</p>
                    : detail.data.bankPayouts.map((bank) => <div key={bank.payoutId} className="payout-tracking__bank"><strong>{t(`payoutTracking.bankStates.${bank.status}`, bank.status)}</strong><bdi>{bank.payoutId}</bdi>
                      {bank.estimatedArrival && <span>{t('payoutTracking.estimatedArrival', { date: date(bank.estimatedArrival) })}</span>}
                      {bank.failureCode && <span>{t('payoutTracking.failureCode', { code: bank.failureCode })}</span>}
                    </div>)}
                </section>
                {transfer.state === 'RECONCILIATION_REQUIRED' && <ReconciliationForm key={`${scope}:${transfer.id}`} transfer={transfer} onUpdated={refresh} />}
                {transfer.state === 'SUBMITTING' && <p className="payout-tracking__notice">{t('payoutTracking.submittingHint')}</p>}
                <section className="payout-tracking__section"><h4>{t('payoutTracking.history')}</h4><ol className="payout-tracking__history">{detail.data.events.map((event, index) => <li key={`${event.createdAt}:${index}`}>
                  <span className="payout-tracking__timeline-dot" /><div><strong>{event.origin === 'RECONCILIATION' ? t('payoutTracking.reconciled') : t(`payoutTracking.states.${event.state}`)}</strong><time dateTime={event.createdAt}>{date(event.createdAt)}</time>
                    {event.actorSubject && <small>{t('payoutTracking.operator', { id: event.actorSubject })}</small>}</div>
                </li>)}</ol></section>
              </> : null}
          </>}
      </div>
    </div>
  </section>;
}

export function ReconciliationForm({ transfer, onUpdated }: { transfer: PayoutTransfer; onUpdated: () => void }) {
  const { t, currentLanguage } = useTranslation();
  const id = useId();
  const [reference, setReference] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [generation, setGeneration] = useState(0);
  const confirming = useRef(false);
  const verify = useMutation({ mutationFn: ({ value, version }: { value: string; version: number }) => payoutTransfersApi.verify(transfer.id, value).then((proof) => ({ proof, version })) });
  const confirm = useMutation({
    mutationFn: (value: string) => payoutTransfersApi.confirm(transfer.id, value),
    onSuccess: () => { verify.reset(); setAgreed(false); onUpdated(); },
    onError: () => { verify.reset(); setAgreed(false); onUpdated(); },
    onSettled: () => { confirming.current = false; },
  });
  const proof = verify.data?.version === generation && verify.data.proof.reference === reference.trim() ? verify.data.proof : null;
  const busy = verify.isPending || confirm.isPending;
  return <section className="payout-tracking__reconcile" aria-labelledby={`${id}-title`}>
    <h4 id={`${id}-title`}>{t('payoutTracking.reconcileTitle')}</h4><p>{t('payoutTracking.reconcileHint')}</p>
    <form onSubmit={(event) => { event.preventDefault(); setAgreed(false); confirm.reset(); verify.mutate({ value: reference.trim(), version: generation }); }}>
      <label htmlFor={id}>{t('payoutTracking.stripeReference')}</label>
      <div className="payout-tracking__verify-controls"><Input id={id} dir="ltr" autoComplete="off" placeholder="tr_…" maxLength={64} value={reference} disabled={busy}
        onChange={(event) => { setReference(event.target.value); setGeneration((value) => value + 1); setAgreed(false); verify.reset(); confirm.reset(); }} />
        <Button type="submit" variant="outline" disabled={busy || !/^tr_[A-Za-z0-9]{1,61}$/.test(reference.trim())}>{verify.isPending ? t('payoutTracking.verifying') : t('payoutTracking.verify')}</Button></div>
    </form>
    {verify.isError && <p role="alert" className="payout-tracking__error">{t('payoutTracking.verifyError')}</p>}
    {proof && <div className="payout-tracking__proof"><p role="status"><Check size={16} aria-hidden="true" />{t('payoutTracking.verified')}</p>
      <p>{t('payoutTracking.evidence', { date: new Intl.DateTimeFormat(intlLocale(currentLanguage), { dateStyle: 'medium' }).format(new Date(proof.createdAt)) })}</p>
      <p><bdi>{proof.destination}</bdi> · {t(proof.livemode ? 'payoutTracking.liveMode' : 'payoutTracking.testMode')}</p>
      <label className="payout-tracking__agreement"><input type="checkbox" checked={agreed} disabled={busy} onChange={(event) => setAgreed(event.target.checked)} />{t('payoutTracking.agree')}</label>
      <Button className="baitly-hitl-primary" disabled={!agreed || busy} onClick={() => {
        if (!agreed || confirming.current) return;
        confirming.current = true; confirm.mutate(proof.reference);
      }}>{confirm.isPending ? t('payoutTracking.confirming') : t('payoutTracking.confirm')}</Button>
    </div>}
    {confirm.isSuccess && <p role="status">{t('payoutTracking.saved')}</p>}
    {confirm.isError && <p role="alert" className="payout-tracking__error">{t('payoutTracking.confirmError')}</p>}
    <small>{t('payoutTracking.noTransfer')}</small>
  </section>;
}
