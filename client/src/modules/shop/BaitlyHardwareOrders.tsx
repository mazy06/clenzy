import BaitlySaleDocuments from '../payments/BaitlySaleDocuments';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import { Button, Skeleton } from '../../components/ui';
import BaitlyCommerceOperationsPanel from '../payments/BaitlyCommerceOperationsPanel';
import BaitlyCommerceRefundPanel from '../payments/BaitlyCommerceRefundPanel';

interface Order { id: number; status: string; totalAmount: number; currency: string; shippingName: string; shippingAddress: string; shippingCity: string; shippingCountry: string; createdAt: string }
export default function BaitlyHardwareOrders() {
  const scope = useCommerceScope();
  const { t, currentLanguage } = useTranslation();const { hasAnyRole } = useAuth();const [selected, setSelected] = useState<number | null>(null);
  const canEdit = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);
  const query = useQuery({ enabled: !!scope, queryKey: ['hardware-orders', scope], queryFn: () => apiClient.get<Order[]>('/shop/orders'), retry: false });
  return <section className="space-y-3 p-4">
    <h2 className="text-lg font-semibold">{t('hardwareOrders.title')}</h2>
    {query.isPending && <Skeleton className="h-24 w-full" />}
    {query.error && <p role="alert" className="text-sm text-destructive-ink">{query.error.message}</p>}
    {query.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('hardwareOrders.empty')}</p>}
    {query.data?.map(order => <div key={order.id} className="space-y-3 border-b border-border pb-3">
      <Button variant="ghost" className="w-full justify-between gap-3" onClick={() => setSelected(selected === order.id ? null : order.id)} aria-expanded={selected === order.id}>
        <span className="truncate">{t('hardwareOrders.order', { id: order.id })} · {t(`hardwareOrders.states.${order.status}`, order.status)}</span>
        <span className="shrink-0 tabular-nums">{new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: order.currency }).format(order.totalAmount / 100)}</span>
      </Button>
      {selected === order.id && <div className="space-y-4 px-2">
        <p className="text-sm text-muted-foreground">{[order.shippingName, order.shippingAddress, order.shippingCity, order.shippingCountry].filter(Boolean).join(' · ')}</p>
        <BaitlySaleDocuments source="HARDWARE_ORDER" sourceId={order.id} />
        {['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status) && <>
          <BaitlyCommerceOperationsPanel key={`ops-${order.id}`} source="HARDWARE_ORDER" sourceId={order.id} canEdit={canEdit} canRestock={hasAnyRole(['SUPER_ADMIN'])} />
          {canEdit && <BaitlyCommerceRefundPanel key={`refunds-${order.id}`} source="HARDWARE_ORDER" sourceId={order.id} />}
        </>}
      </div>}
    </div>)}
  </section>;
}
