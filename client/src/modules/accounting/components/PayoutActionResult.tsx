import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, Button } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';

/** Un HTTP 200 ne prouve ni un transfert réussi, ni un crédit bancaire. */
export default function PayoutActionResult({ status, reason, onClose }: {
  status: string;
  reason?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const failed = status === 'FAILED' || status === 'BLOCKED' || status === 'CANCELLED';
  const transferred = status === 'PAID' || status === 'SENT';
  const Icon = failed ? TriangleAlert : transferred ? CircleCheck : Info;
  return <Alert variant={failed ? 'destructive' : transferred ? 'success' : 'info'} className="mb-2 text-sm">
    <Icon />
    <AlertDescription>{failed
      ? reason || t('accounting.psp.failed', 'Versement non effectué. Consultez le motif avant de réessayer.')
      : transferred
        ? t('accounting.psp.transferred', 'Transfert confirmé par le PSP. Le versement bancaire se suit séparément.')
        : t('accounting.psp.processing', 'Demande transmise au PSP. La confirmation est en cours.')}</AlertDescription>
    <AlertAction><Button variant="ghost" size="icon-xs" aria-label={t('common.close', 'Fermer')} onClick={onClose}><X /></Button></AlertAction>
  </Alert>;
}
