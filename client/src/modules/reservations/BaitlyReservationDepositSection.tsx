import { useQuery } from '@tanstack/react-query';
import { baitlySecurityDepositsApi } from '../../services/api/baitlySecurityDepositsApi';
import type { StatusTone } from '../../components/StatusChip';
import ReservationFinancialState from './ReservationFinancialState';
import IllustratedHeading from '../../components/IllustratedHeading';
import { Skeleton } from '../../components/ui';
import { RESERVATION_ART } from '../../components/reservations/reservationArtwork';
import { useTranslation } from '../../hooks/useTranslation';
import { ShieldCheck } from '../../icons/glyphs';

const tones: Record<string, StatusTone> = { PENDING: 'neutral', HELD: 'info', RELEASING: 'warn', RELEASED: 'ok', CAPTURING: 'warn', CAPTURED: 'neutral', FAILED: 'err', EXPIRED: 'warn' };

/** État bancaire en lecture seule. La libération reste soumise au contrôle du ménage. */
export default function BaitlyReservationDepositSection({ reservationId, showMissing = false }: { reservationId: number; showMissing?: boolean }) {
  const { t, currentLanguage } = useTranslation();
  const query = useQuery({
    queryKey: ['baitly-security-deposit', reservationId],
    queryFn: ({ signal }) => baitlySecurityDepositsApi.byReservation(reservationId, signal),
    retry: 1,
    refetchInterval: (query) => ['RELEASED', 'CAPTURED', 'EXPIRED'].includes(query.state.data?.status ?? '') ? false : 15000,
  });
  if (query.isPending) return <section className="rsv-section rsv-deposit-section" aria-label={t('reservationsDeposit.title', 'Caution')} aria-busy="true"><Skeleton className="h-16 w-full" /></section>;
  if (query.isError) return <section className="rsv-section rsv-deposit-section"><IllustratedHeading art={RESERVATION_ART.payment} icon={<ShieldCheck className="size-4 shrink-0" aria-hidden />} title={t('reservationsDeposit.title', 'Caution')} />
    <p role="status" className="text-sm text-muted-foreground">{t('reservationsDeposit.unavailable', 'État de la caution indisponible')}</p></section>;
  const deposit = query.data;
  if (!deposit) return showMissing ? <section className="rsv-section rsv-deposit-section" aria-live="polite">
    <IllustratedHeading art={RESERVATION_ART.payment} title={t('reservationsDeposit.title', 'Caution')}
      icon={<ShieldCheck className="size-4 shrink-0" aria-hidden />}
      />
    <ReservationFinancialState tone="neutral" label={t('reservationsDeposit.none', 'Non enregistrée')} />
    <p className="rsv-financial-hint">{t('reservationsDeposit.noneHint', 'Aucune préautorisation bancaire enregistrée pour ce séjour.')}</p>
  </section> : null;
  const hint = deposit.status === 'RELEASED'
    ? t('reservationsDeposit.releasedHint', 'Libération bancaire confirmée. Aucun encaissement sur cette caution.')
    : t('reservationsDeposit.hint', 'Préautorisation séparée du séjour. Libération automatique après le ménage validé sans anomalie.');
  return <section className="rsv-section rsv-deposit-section" aria-live="polite">
    <IllustratedHeading art={RESERVATION_ART.payment} title={t('reservationsDeposit.title', 'Caution')}
      icon={<ShieldCheck className="size-4 shrink-0" aria-hidden />}
      />
    <ReservationFinancialState tone={tones[deposit.status] ?? 'neutral'} label={deposit.status in tones ? t(`reservationsDeposit.statuses.${deposit.status}`) : t('reservationsDeposit.unavailable', 'État de la caution indisponible')} />
    <dl className="rsv-facts"><div><dt>{t('reservationsDeposit.amount', 'Montant de la caution')}</dt>
      <dd className="[font-variant-numeric:tabular-nums]">{new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: deposit.currency }).format(deposit.amount)}</dd></div>
      {deposit.holdExpiresAt && deposit.status === 'HELD' && <div><dt>{t('reservationsDeposit.expires', 'Échéance de la préautorisation')}</dt><dd>{new Intl.DateTimeFormat(currentLanguage, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(deposit.holdExpiresAt))}</dd></div>}
    </dl>
    <p className="rsv-financial-hint">{hint}</p>
  </section>;
}
