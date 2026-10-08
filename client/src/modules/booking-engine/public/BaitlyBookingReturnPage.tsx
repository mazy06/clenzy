import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, RefreshCw } from '../../../icons/glyphs';
import { Alert, AlertDescription, Button, Card, CardContent, Skeleton } from '../../../components/ui';
import { API_CONFIG } from '../../../config/api';
import { createBookingI18n } from '../sdk/i18n';
import type { ApiConfirmation } from '../sdk/api';

/** Le retour PSP n'est jamais une preuve de paiement : seul le statut relu dans Baitly fait foi. */
export default function BaitlyBookingReturnPage({ generic = false }: { generic?: boolean }) {
  const { apiKey } = useParams<{ apiKey: string }>();
  const [params] = useSearchParams();
  const code = params.get('reservation')?.trim() ?? '';
  const interrupted = params.get('flow') === 'cancel';
  const language = navigator.language.slice(0, 2).toLowerCase();
  const { t, isRTL } = useMemo(() => createBookingI18n(language), [language]);
  const booking = useQuery({
    queryKey: ['public-booking-return', apiKey, code],
    queryFn: async ({ signal }): Promise<ApiConfirmation> => {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/public/booking/widget/booking/${encodeURIComponent(code)}`, {
        headers: { 'X-Booking-Key': apiKey! }, signal,
      });
      if (!response.ok) throw new Error('Booking unavailable');
      return response.json();
    },
    enabled: !generic && !!apiKey && !!code,
    retry: false,
    refetchOnWindowFocus: false,
    // Attendre brièvement les notifications PSP, puis laisser une vérification manuelle.
    refetchInterval: (query) => ['pending', 'confirmed'].includes(query.state.data?.status.toLowerCase() ?? '')
      && ['PENDING', 'PROCESSING'].includes(query.state.data?.paymentStatus ?? '')
      && !query.state.error && query.state.dataUpdateCount < 12 ? 5000 : false,
  });
  const data = booking.data;
  const cancelled = data?.status.toLowerCase() === 'cancelled';
  const paid = data?.paymentStatus === 'PAID';
  const deposit = data?.paymentStatus === 'PARTIALLY_PAID';
  const complete = !cancelled && data?.status.toLowerCase() === 'confirmed' && paid;
  const title = cancelled ? t('return.cancelled') : complete ? t('return.confirmed')
    : deposit ? t('return.deposit') : interrupted && !paid ? t('return.interrupted') : t('return.pending');
  const description = cancelled ? t('return.cancelledInfo') : complete ? t('return.confirmedInfo')
    : deposit ? t('return.depositInfo') : interrupted && !paid ? t('return.interruptedInfo') : t('return.pendingInfo');
  const locale = ['fr', 'en', 'ar'].includes(language) ? language : 'fr';
  const date = (value: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-dvh bg-background px-4 py-8 text-foreground sm:py-14">
      <Card className="mx-auto w-full max-w-xl overflow-hidden">
        <CardContent className="p-5 sm:p-8">
          <p className="mb-6 text-sm font-semibold">Baitly</p>
          {generic ? (
            <div role="status">
              <h1 className="mb-3 text-balance text-2xl font-semibold tracking-tight">{t('return.received')}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">{t('return.receivedInfo')}</p>
            </div>
          ) : !apiKey || !code || (!data && booking.isError) ? (
            <Alert><AlertDescription>{t('return.unavailable')}</AlertDescription></Alert>
          ) : !data ? (
            <div role="status" aria-label={t('return.loading')} className="space-y-5">
              <Skeleton className="h-7 w-3/4 motion-reduce:animate-none" />
              <Skeleton className="h-12 w-full motion-reduce:animate-none" />
              <Skeleton className="h-40 w-full motion-reduce:animate-none" />
            </div>
          ) : (
            <>
              <div role="status" aria-live="polite">
                <div className="mb-3 flex items-start gap-3">
                  {complete ? <CheckCircle2 aria-hidden className="mt-1 size-6 shrink-0 text-[var(--bui-success-ink)]" />
                    : <Clock3 aria-hidden className="mt-1 size-6 shrink-0 text-muted-foreground" />}
                  <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
              <dl className="my-7 divide-y divide-border border-y border-border text-sm">
                <Detail label={t('confirmation.reference')} value={data.reservationCode} />
                <Detail label={t('confirmation.accommodation')} value={[data.propertyName, data.propertyCity].filter(Boolean).join(' · ')} />
                <Detail label={t('detail.checkIn')} value={date(data.checkIn)} />
                <Detail label={t('detail.checkOut')} value={date(data.checkOut)} />
                <Detail label={t('confirmation.travelers')} value={String(data.guests)} />
                <Detail label={t('return.total')} value={new Intl.NumberFormat(locale, { style: 'currency', currency: data.currency }).format(data.total)} />
              </dl>
              {booking.isError && <Alert className="mb-4"><AlertDescription>{t('return.refreshError')}</AlertDescription></Alert>}
              {!complete && !cancelled && (
                <Button variant="outline" size="lg" className="mb-3 w-full cursor-pointer" disabled={booking.isFetching} onClick={() => void booking.refetch()}>
                  <RefreshCw aria-hidden className="size-4" />{t('return.refresh')}
                </Button>
              )}
            </>
          )}
          {apiKey && <Button asChild variant="ghost" className="mt-2 w-full cursor-pointer"><Link to={`/booking/${encodeURIComponent(apiKey)}`}>{t('confirmation.backHome')}</Link></Button>}
          {apiKey && data && <Button asChild variant="link" className="mt-1 w-full cursor-pointer"><Link to={`/booking/${encodeURIComponent(apiKey)}/cancel`}>{cancelled ? t('page.checkRefund') : t('page.cancelTitle')}</Link></Button>}
        </CardContent>
      </Card>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-wrap justify-between gap-x-5 gap-y-1 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words font-medium tabular-nums">{value}</dd></div>;
}
