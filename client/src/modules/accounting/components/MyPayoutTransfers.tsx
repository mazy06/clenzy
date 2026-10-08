import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw } from '../../../icons/glyphs';
import { Badge, Button, Skeleton } from '../../../components/ui';
import PagePagination from '../../../components/PagePagination';
import { usePageHeaderActions } from '../../../components/PageHeaderActionsContext';
import SetupPayout from '../../../components/onboarding/SetupPayout';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { paymentConnectApi, type PaymentScope } from '../../../services/api/paymentConnectApi';
import { paymentConnectionKey } from '../../../services/api/paymentConnectionKeys';
import { myPayoutTransfersApi, type MyTransfer } from '../../../services/api/myPayoutTransfersApi';
import { intlLocale } from '../../../utils/localeDate';
import '../../supervision/supervision-surfaces.css';
import '../../../components/onboarding/setup-surfaces.css';
import './payout-tracking.css';
import './my-payout-transfers.css';
import BaitlyTransferRecoveries from './BaitlyTransferRecoveries';

export default function MyPayoutTransfers() {
  const { user } = useAuth();
  if (!user) return null;
  const identity = `${user.id}:${user.organizationId}`;
  return <BeneficiaryTransfers key={identity} identity={identity} />;
}

function BeneficiaryTransfers({ identity }: { identity: string }) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<PaymentScope>(() => new URLSearchParams(window.location.search).get('paymentScope') === 'ORGANIZATION' ? 'ORGANIZATION' : 'PERSONAL');
  const access = useQuery({ queryKey: paymentConnectionKey(identity, 'PERSONAL'), queryFn: () => paymentConnectApi.status('PERSONAL') });
  const authorized = scope === 'PERSONAL' || (!access.isError && access.data?.canManageOrganization === true);
  return <section className="payout-tracking my-transfers baitly-supervision-surface" aria-label={t('myTransfers.title')}>
    <div className="payout-tracking__intro"><div><h2>{t('myTransfers.title')}</h2><p>{t('myTransfers.intro')}</p></div></div>
    {access.isPending ? <Skeleton className="h-14 w-full mb-4" /> : access.isError ? <div role="alert"><p>{t('myTransfers.accessError')}</p><Button variant="outline" onClick={() => void access.refetch()}>{t('common.retry', 'Réessayer')}</Button></div>
      : access.data?.canManageOrganization && <fieldset className="my-transfers__scope"><legend>{t('onboarding.payment.beneficiary')}</legend>
        {(['PERSONAL', 'ORGANIZATION'] as const).map((value) => <label key={value} data-selected={scope === value}>
          <input type="radio" name={`payout-scope-${identity}`} checked={scope === value} onChange={() => setScope(value)} />{t(`onboarding.payment.${value}`)}
        </label>)}
      </fieldset>}
    {!authorized && access.isPending ? null : !authorized ? <div role="alert" className="payout-tracking__notice"><p>{t('myTransfers.organizationDenied')}</p><Button variant="outline" onClick={() => setScope('PERSONAL')}>{t('myTransfers.personalOnly')}</Button></div>
      : <BeneficiaryHistory key={`${identity}:${scope}`} identity={identity} scope={scope} />}
  </section>;
}

function BeneficiaryHistory({ identity, scope }: { identity: string; scope: PaymentScope }) {
  const { t, currentLanguage } = useTranslation();
  const cache = useQueryClient();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [configure, setConfigure] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const rowButton = useRef<HTMLButtonElement | null>(null);
  const key = ['my-payout-transfers', identity, scope];
  const status = useQuery({ queryKey: paymentConnectionKey(identity, scope), queryFn: () => paymentConnectApi.status(scope) });
  const list = useQuery({ queryKey: [...key, page], queryFn: () => myPayoutTransfersApi.list(scope, page) });
  const detail = useQuery({ queryKey: [...key, 'detail', selected], queryFn: () => myPayoutTransfersApi.detail(scope, selected!), enabled: selected !== null });
  const refresh = async () => { await Promise.all([cache.invalidateQueries({ queryKey: key }), cache.invalidateQueries({ queryKey: paymentConnectionKey(identity, scope) })]); };
  const header = usePageHeaderActions(<Button variant="outline" size="sm" disabled={list.isFetching || detail.isFetching || status.isFetching} onClick={() => void refresh()}><RefreshCw size={15} aria-hidden="true" />{t('common.refresh', 'Actualiser')}</Button>);
  useEffect(() => { if (selected !== null && !detail.isPending) heading.current?.focus(); }, [selected, detail.isPending]);
  useEffect(() => { if (list.data && page > 0 && page >= list.data.totalPages) setPage(Math.max(0, list.data.totalPages - 1)); }, [list.data, page]);
  const money = (transfer: MyTransfer) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: transfer.currency }).format(transfer.amount);
  const date = (value: string) => new Intl.DateTimeFormat(intlLocale(currentLanguage), { dateStyle: 'medium' }).format(new Date(value));
  const close = () => { setSelected(null); window.requestAnimationFrame(() => rowButton.current?.focus()); };
  const connection = status.data;
  const connectionKey = status.isError ? 'unavailable' : !connection ? 'unknown' : connection.reconnectRequired ? 'revoked' : connection.ready ? 'ready' : connection.accountCreated ? 'pending' : 'missing';
  const transfer = detail.data?.transfer;
  return <>
    {header}
    <section className="my-transfers__connection baitly-setup">
      <div className="my-transfers__connection-heading"><div><h3>{t('myTransfers.connection')}</h3><p>{t(`myTransfers.accountStates.${connectionKey}`)}</p></div>
        <Button variant="outline" size="sm" aria-expanded={configure} onClick={() => setConfigure(!configure)}>{t(configure ? 'myTransfers.closeSetup' : 'myTransfers.configure')}<ChevronDown size={16} aria-hidden="true" /></Button>
      </div>
      {status.isError && <p role="alert">{t('myTransfers.statusError')}</p>}
      {configure && <div className="my-transfers__setup"><SetupPayout stepKey="setup_payout_account" beneficiaryScope={scope} onCheck={refresh} onSaved={refresh} /></div>}
    </section>
    <p className="my-transfers__history-hint">{t(scope === 'PERSONAL' ? 'myTransfers.personalHistory' : 'myTransfers.organizationHistory')}</p>
    <div className="payout-tracking__workspace" data-selected={selected !== null}>
      <div className="payout-tracking__list">
        {list.isPending ? <div className="payout-tracking__placeholder"><Skeleton className="h-48 w-full" /></div>
          : list.isError ? <div role="alert" className="payout-tracking__placeholder"><p>{t('myTransfers.loadError')}</p><Button variant="outline" onClick={() => void list.refetch()}>{t('common.retry', 'Réessayer')}</Button></div>
            : !list.data?.content.length ? <div className="payout-tracking__placeholder"><h3>{t('myTransfers.empty')}</h3><p>{t('myTransfers.emptyHint')}</p></div>
              : <ul aria-label={t('myTransfers.history')}>{list.data.content.map((row) => <li key={row.id}>
                <button className="payout-tracking__row" aria-pressed={selected === row.id} onClick={(event) => { rowButton.current = event.currentTarget; setSelected(row.id); }}>
                  <span className="payout-tracking__row-top"><span>{t(`payoutTracking.sources.${row.source}`)}</span><strong>{money(row)}</strong></span>
                  <span className="payout-tracking__row-title">{row.description}</span>
                  <span className="payout-tracking__row-bottom"><Badge variant={row.state === 'TRANSFERRED' ? 'secondary' : 'warning'}>{t(`myTransfers.states.${row.state}`)}</Badge><ChevronRight size={16} aria-hidden="true" /></span>
                  <time dateTime={row.createdAt}>{date(row.createdAt)}</time>
                </button>
              </li>)}</ul>}
        {list.data && !list.isError && <PagePagination page={page} onPageChange={(value) => { setPage(value); setSelected(null); }} count={list.data.totalElements} rowsPerPage={12} className="payout-tracking__pagination" />}
      </div>
      <div className="payout-tracking__detail">
        {selected === null ? <div className="payout-tracking__placeholder payout-tracking__choose"><h3>{t('myTransfers.select')}</h3><p>{t('myTransfers.selectHint')}</p></div> : <>
          <Button variant="ghost" size="sm" className="payout-tracking__back" onClick={close}><ArrowLeft size={16} aria-hidden="true" />{t('payoutTracking.back')}</Button>
          {detail.isPending ? <Skeleton className="h-72 w-full" /> : detail.isError ? <div role="alert"><h3 ref={heading} tabIndex={-1}>{t('myTransfers.loadError')}</h3><Button variant="outline" onClick={() => void detail.refetch()}>{t('common.retry', 'Réessayer')}</Button></div>
            : transfer && detail.data ? <>
              <header className="payout-tracking__detail-header"><p>{t(`payoutTracking.sources.${transfer.source}`)} · <bdi>#{transfer.id}</bdi></p><h3 ref={heading} tabIndex={-1}>{transfer.description}</h3><strong className="payout-tracking__amount">{money(transfer)}</strong></header>
              <section className="payout-tracking__section"><h4>{t('myTransfers.transferStage')}</h4><p>{t(`myTransfers.states.${transfer.state}`)}</p><p>{t(`myTransfers.advice.${transfer.state}`)}</p></section>
              <BaitlyTransferRecoveries recoveries={detail.data.recoveries} />
              <section className="payout-tracking__section"><h4>{t('payoutTracking.bankTitle')}</h4><p>{t('payoutTracking.bankHint')}</p>
                {!detail.data.bankPayouts.length ? <p className="payout-tracking__notice">{t('payoutTracking.bankUnknown')}</p> : detail.data.bankPayouts.map((bank) => <div className="payout-tracking__bank" key={bank.payoutId}>
                  <strong>{t(`payoutTracking.bankStates.${bank.status}`, bank.status)}</strong>
                  {bank.estimatedArrival && <span>{t('payoutTracking.estimatedArrival', { date: date(bank.estimatedArrival) })}</span>}
                  {['FAILED', 'CANCELED'].includes(bank.status) && <p>{t('myTransfers.bankFailed')}</p>}
                </div>)}
              </section>
              <section className="payout-tracking__section"><h4>{t('myTransfers.history')}</h4><ol className="payout-tracking__history">{detail.data.events.map((event, index) => <li key={`${event.createdAt}:${index}`}><span className="payout-tracking__timeline-dot" /><div><strong>{t(`myTransfers.states.${event.state}`)}</strong><time dateTime={event.createdAt}>{date(event.createdAt)}</time></div></li>)}</ol></section>
            </> : null}
        </>}
      </div>
    </div>
  </>;
}
