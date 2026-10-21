import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import type { UpsellOrder } from '../../services/api/upsellApi';
import BaitlyCommerceOperationsPanel from '../payments/BaitlyCommerceOperationsPanel';
import BaitlyPaidServiceExecution, { hasPaidServiceExecution } from './BaitlyPaidServiceExecution';

/** Un seul accès au suivi, partagé par les ventes et la fiche du séjour. */
export default function BaitlyPaidServiceOrderTracking({ order, compact = false }: { order: UpsellOrder; compact?: boolean }) {
  const { hasAnyRole } = useAuth();
  const { t } = useTranslation();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualLoaded, setManualLoaded] = useState(false);
  const manual = !hasPaidServiceExecution(order) && ['PAID', 'REFUNDED'].includes(order.status)
    && hasAnyRole(['HOST', 'SUPER_ADMIN', 'SUPER_MANAGER']);
  return <>
    <BaitlyPaidServiceExecution order={order} compact={compact} />
    {manual && <details className="w-full border-t border-border pt-2" open={manualOpen} onToggle={event => {
      const expanded = event.currentTarget.open;
      setManualOpen(expanded);
      if (expanded) setManualLoaded(true);
    }}>
      <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t('paidServiceExecution.manualTracking')}</summary>
      {manualLoaded && <BaitlyCommerceOperationsPanel source="UPSELL" sourceId={order.id} canEdit={hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER'])} />}
    </details>}
  </>;
}
