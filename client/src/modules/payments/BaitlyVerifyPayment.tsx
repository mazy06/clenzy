import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from '../../icons/glyphs';
import { Button, Spinner, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { paymentsApi } from '../../services/api/paymentsApi';

/** Relit la preuve PSP ; ne crée jamais de paiement ni de session Checkout. */
export default function BaitlyVerifyPayment({ session, onVerified }: { session: string; onVerified: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; pending.current = false; setBusy(false); setNotice(''); return () => { generation.current++; }; }, [session]);
  const verify = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setNotice(''); setFailed(false);
    const current = generation.current;
    try {
      const result = await paymentsApi.getSessionStatus(session);
      if (generation.current !== current) return;
      setNotice(t(result.paymentStatus === 'PAID' ? 'payments.verification.confirmed' : 'payments.verification.pending'));
      onVerified();
    } catch {
      if (generation.current !== current) return;
      setFailed(true); setNotice(t('payments.verification.unavailable'));
    } finally {
      if (generation.current === current) { pending.current = false; setBusy(false); }
    }
  };
  return <>
    <Tooltip><TooltipTrigger asChild>
      <Button variant="outline" size="icon" aria-label={t('payments.verification.action')} disabled={busy} onClick={verify}>
        {busy ? <Spinner className="size-4" /> : <RefreshCw size={16} />}
      </Button>
    </TooltipTrigger><TooltipContent>{t('payments.verification.action')}</TooltipContent></Tooltip>
    {notice && <span className="max-w-64 text-xs text-[var(--bui-muted-foreground)]" role={failed ? 'alert' : 'status'}>{notice}</span>}
  </>;
}
