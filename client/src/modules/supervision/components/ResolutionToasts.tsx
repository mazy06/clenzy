/* ============================================================
   <ResolutionToasts> — bandeaux concurrence / expiration

   Pile de chips (« déjà traitée par X » / « expirée »). Présentation pure ;
   le parent positionne le conteneur. Alimenté par useResolutionToasts.
   ============================================================ */


import { useTranslation } from '../../../hooks/useTranslation';
import type { ResolutionToast } from '../core/useResolutionToasts';

export function ResolutionToasts({ toasts }: { toasts: ResolutionToast[] }) {
  const { t } = useTranslation();
  if (toasts.length === 0) return null;

  return (
    <>
      {toasts.map((toast) => (
        <div className="px-[9px] py-[4.5px] rounded-[7992px] bg-[rgba(20,24,58,.85)] text-[#E7E9FB] border border-solid border-[rgba(255,255,255,.12)] text-[12.5px] font-bold" style={{ backdropFilter: 'blur(8px)', boxShadow: '0 10px 28px -14px rgba(0,0,0,.6)' }} key={toast.key} role="status">
          {toast.kind === 'expired'
            ? t('supervision.hitl.expired')
            : toast.by
              ? t('supervision.hitl.alreadyHandledBy', { name: toast.by })
              : t('supervision.hitl.alreadyHandled')}
        </div>
      ))}
    </>
  );
}
