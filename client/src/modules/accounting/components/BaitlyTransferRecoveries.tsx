import { Badge } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import type { TransferRecovery } from '../../../services/api/payoutTransfersApi';

/** Les preuves de récupération restent distinctes du transfert initial et de l'arrivée bancaire. */
export default function BaitlyTransferRecoveries({ recoveries = [] }: { recoveries?: TransferRecovery[] }) {
  const { t, currentLanguage } = useTranslation();
  if (!recoveries.length) return null;
  return <section className="payout-tracking__section" aria-label={t('payoutTracking.recovery.title')}>
    <h4>{t('payoutTracking.recovery.title')}</h4>
    <p>{t('payoutTracking.recovery.hint')}</p>
    <ul className="space-y-4 mt-4">
      {recoveries.map((row, index) => <li key={row.reversalReference ?? index} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">{t('payoutTracking.recovery.providerShare')}{' '}
            <strong className="tabular-nums">{new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: row.currency }).format(row.amount)}</strong>
          </span>
          <Badge variant={row.state === 'REVIEW_REQUIRED' ? 'warning' : 'secondary'}>{t(`payoutTracking.recovery.states.${row.state}`)}</Badge>
        </div>
        {row.commissionRefundAmount != null && row.commissionRefundAmount > 0 && <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-x-2">
            <dt>{t('payoutTracking.recovery.commissionShare')}</dt>
            <dd className="tabular-nums text-foreground">{new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: row.currency }).format(row.commissionRefundAmount)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt>{t('payoutTracking.recovery.refundTotal')}</dt>
            <dd className="tabular-nums text-foreground">{new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: row.currency }).format((Math.round(row.amount * 100) + Math.round(row.commissionRefundAmount * 100)) / 100)}</dd>
          </div>
        </dl>}
        <p>{t(`payoutTracking.recovery.advice.${row.state}`)}</p>
        {row.reversalReference && <p className="text-xs text-muted-foreground break-all"><bdi>{row.reversalReference}</bdi></p>}
      </li>)}
    </ul>
  </section>;
}
