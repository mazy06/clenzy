import { Button, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import IllustratedHeading from '../../components/IllustratedHeading';
import { RESERVATION_ART } from '../../components/reservations/reservationArtwork';
import { Money } from '../../components/Money';
import { Receipt, RefreshCw, CreditCard, Clock, RotateCcw, CircleX, CircleQuestionMark } from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';
import { usePaidServiceOrders } from '../welcome-guide/usePaidServiceOrders';
import BaitlyPaidServiceOrderTracking from '../welcome-guide/BaitlyPaidServiceOrderTracking';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { upsellApi, type UpsellOrder, type UpsellOffer } from '../../services/api/upsellApi';
import { useCommerceScope } from '../../hooks/useCommerceScope';

const serviceArtwork: Record<string, string> = {
  'cleaning-mid-stay': 'cleaning', 'culinary-breakfast': 'breakfast',
  'driver-airport': 'transfer', 'driver-station': 'transfer',
};

/** Une offre ambiguë ne fournit jamais la photo d'une autre prestation. */
function serviceImage(order: UpsellOrder, offers: UpsellOffer[]) {
  const matches = offers.filter(offer => offer.title === order.title);
  const offer = matches.length === 1 ? matches[0] : undefined;
  return offer?.imageUrl || `/images/catalog/${serviceArtwork[order.fulfillmentServiceCode ?? ''] ?? 'other-service'}.webp`;
}

const paymentIcons = { PAID: CreditCard, PENDING: Clock, REFUNDED: RotateCcw, CANCELLED: CircleX };

function PaymentState({ status }: { status: string }) {
  const { t } = useTranslation();
  const known = Object.prototype.hasOwnProperty.call(paymentIcons, status);
  const Icon = known ? paymentIcons[status as keyof typeof paymentIcons] : CircleQuestionMark;
  const label = known ? t(`paidServiceExecution.states.${status}`) : t('reservationPaidServices.unknownPayment');
  return <Tooltip><TooltipTrigger asChild>
    <span tabIndex={0} role="img" aria-label={label} className="rsv-service__payment" data-status={status}><Icon aria-hidden /></span>
  </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

export default function BaitlyReservationPaidServices({ reservationId }: { reservationId: number }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const query = usePaidServiceOrders();
  const scope = useCommerceScope();
  const offers = useQuery({ queryKey: ['upsell-offers', scope], queryFn: () => upsellApi.listOffers(), enabled: query.available, staleTime: 60_000 });
  if (!query.available) return null;
  const orders = query.isError ? [] : (query.data ?? []).filter(order => order.reservationId === reservationId);
  return <section className="rsv-section baitly-reservation-paid-services min-w-0" aria-label={t('reservationPaidServices.title')} aria-busy={query.isFetching}>
    <IllustratedHeading art={RESERVATION_ART.summary} icon={<Receipt className="size-4 shrink-0" aria-hidden />}
      title={t('reservationPaidServices.title')}
      action={<Button type="button" variant="ghost" size="sm" className="min-h-[44px] max-w-full whitespace-normal" disabled={query.isFetching} onClick={() => {
        void query.refetch();
        for (const order of orders) void client.invalidateQueries({ queryKey: ['paid-service-execution', order.id] });
      }}>
        <RefreshCw className="size-4" /><span className="sr-only sm:not-sr-only">{t('reservationPaidServices.refresh')}</span>
      </Button>} />
    {query.isPending ? <Skeleton className="h-24 w-full" /> : query.isError ?
      <p role="alert" className="text-sm text-destructive-ink">{t('reservationPaidServices.error')}</p> : orders.length === 0 ?
      <p className="text-sm text-muted-foreground">{t('reservationPaidServices.empty')}</p> :
      <ul className="rsv-services-list">
        {orders.map(order => <li key={order.id} className="rsv-service">
          <img className="rsv-service__image" src={serviceImage(order, offers.isError ? [] : offers.data ?? [])} alt="" loading="lazy" onError={event => {
            const fallback = `/images/catalog/${serviceArtwork[order.fulfillmentServiceCode ?? ''] ?? 'other-service'}.webp`;
            if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback;
          }} />
          <div className="rsv-service__content">
          <div className="rsv-service__heading">
            <div className="min-w-0 flex-1 basis-44 [overflow-wrap:anywhere]">
              <h4 className="rsv-service__title" dir="auto">{order.title}</h4>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 tabular-nums">
              <span className="rsv-service__price"><Money value={order.amount} from={order.currency} /></span>
              <PaymentState status={order.status} />
            </div>
          </div>
          <BaitlyPaidServiceOrderTracking order={order} compact />
          </div>
        </li>)}
      </ul>}
  </section>;
}
