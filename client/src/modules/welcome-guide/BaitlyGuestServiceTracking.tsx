import { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, CircleAlert, CircleCheck, Clock3, CreditCard, RefreshCw, RotateCcw } from '../../icons/glyphs';
import type { Lang } from './WelcomeBookView';
import { guestServiceSlot } from './baitlyGuestServiceSlot';
import './baitlyGuestServiceTracking.css';

const labels = {
  fr: { title: 'Mes services', refresh: 'Actualiser le suivi', error: 'Le suivi est momentanément indisponible.', paid: 'Payé',
    PENDING: 'Paiement en attente', PAID: 'Payé', REFUNDED: 'Remboursé', CANCELLED: 'Annulé',
    TO_SCHEDULE: 'À planifier', REQUESTED: 'Confirmation en attente', CONFIRMED: 'Service confirmé',
    TO_ORGANIZE: 'À organiser', IN_PROGRESS: 'Prestation en cours', TO_VALIDATE: 'Réalisation à valider', COMPLETED: 'Service réalisé',
    scheduled: 'Créneau prévu', unknown: 'Suivi à confirmer', unknownPayment: 'Paiement à vérifier',
    updating: 'Actualisation du suivi…',
    subtitle: 'Retrouvez vos achats et les informations utiles pour en profiter.', active: 'À suivre', history: 'Services passés',
    historyHint: 'Terminés, annulés ou remboursés', noActive: 'Aucun service en attente pour votre séjour.',
    payment: 'Paiement', requestedSlot: 'Créneau demandé', previousSlot: 'Créneau initial',
    pendingHelp: 'Le paiement n’est pas confirmé. Ce service n’est pas encore réservé.',
    scheduleHelp: 'Le créneau reste à convenir avec votre hôte.', organizeHelp: 'Les modalités de ce service restent à confirmer avec votre hôte.',
    requestedHelp: 'Votre créneau a été demandé. La confirmation du prestataire est encore attendue.',
    confirmedHelp: 'Le prestataire a confirmé ce service.', progressHelp: 'Votre prestation est en cours de réalisation.',
    reviewHelp: 'La prestation est terminée. Sa réalisation doit encore être validée par votre hôte.',
    unknownHelp: 'Le statut doit être vérifié auprès de votre hôte.',
    note: 'Un paiement validé ne confirme pas à lui seul le créneau du prestataire.' },
  en: { title: 'My services', refresh: 'Refresh tracking', error: 'Tracking is temporarily unavailable.', paid: 'Paid',
    PENDING: 'Payment pending', PAID: 'Paid', REFUNDED: 'Refunded', CANCELLED: 'Cancelled',
    TO_SCHEDULE: 'Time to be arranged', REQUESTED: 'Time requested, provider to be confirmed', CONFIRMED: 'Service confirmed',
    TO_ORGANIZE: 'Service to be arranged', IN_PROGRESS: 'Service in progress', TO_VALIDATE: 'Service finished, awaiting review', COMPLETED: 'Service completed',
    scheduled: 'Scheduled time', unknown: 'Status to be confirmed', unknownPayment: 'Payment to be checked',
    updating: 'Updating service tracking…',
    subtitle: 'Your purchases and everything you need to enjoy them.', active: 'Upcoming & pending', history: 'Past services',
    historyHint: 'Completed, cancelled or refunded', noActive: 'No services are pending for your stay.',
    payment: 'Payment', requestedSlot: 'Requested time', previousSlot: 'Original time',
    pendingHelp: 'Payment has not been confirmed. This service is not booked yet.',
    scheduleHelp: 'Arrange the service time with your host.', organizeHelp: 'Service arrangements still need to be confirmed with your host.',
    requestedHelp: 'Your time has been requested. Provider confirmation is still pending.',
    confirmedHelp: 'The provider has confirmed this service.', progressHelp: 'Your service is in progress.',
    reviewHelp: 'The service has finished. Your host still needs to validate its completion.',
    unknownHelp: 'Please check the status with your host.',
    note: 'A successful payment does not by itself confirm the provider’s time.' },
  ar: { title: 'خدماتي', refresh: 'تحديث المتابعة', error: 'المتابعة غير متاحة مؤقتاً.', paid: 'مدفوع',
    PENDING: 'بانتظار الدفع', PAID: 'مدفوع', REFUNDED: 'تم رد المبلغ', CANCELLED: 'ملغى',
    TO_SCHEDULE: 'الموعد قيد التنظيم', REQUESTED: 'تم طلب الموعد، بانتظار تأكيد مقدم الخدمة', CONFIRMED: 'تم تأكيد الخدمة',
    TO_ORGANIZE: 'الخدمة قيد التنظيم', IN_PROGRESS: 'الخدمة جارية', TO_VALIDATE: 'انتهت الخدمة، بانتظار المراجعة', COMPLETED: 'تم اعتماد الخدمة',
    scheduled: 'الموعد المقرر', unknown: 'المتابعة بانتظار التأكيد', unknownPayment: 'يلزم التحقق من الدفع',
    updating: 'جارٍ تحديث متابعة الخدمة…',
    subtitle: 'مشترياتك والمعلومات اللازمة للاستفادة منها.', active: 'خدمات للمتابعة', history: 'الخدمات السابقة',
    historyHint: 'مكتملة أو ملغاة أو مستردة', noActive: 'لا توجد خدمات بانتظار المتابعة لإقامتك.',
    payment: 'الدفع', requestedSlot: 'الموعد المطلوب', previousSlot: 'الموعد الأصلي',
    pendingHelp: 'لم يتم تأكيد الدفع. لم تُحجز هذه الخدمة بعد.',
    scheduleHelp: 'يجب الاتفاق على موعد الخدمة مع مضيفك.', organizeHelp: 'يجب تأكيد تفاصيل هذه الخدمة مع مضيفك.',
    requestedHelp: 'تم طلب موعدك، ولا يزال تأكيد مقدم الخدمة قيد الانتظار.',
    confirmedHelp: 'أكد مقدم الخدمة هذه الخدمة.', progressHelp: 'جارٍ تنفيذ خدمتك.',
    reviewHelp: 'انتهت الخدمة، ولا يزال مضيفك بحاجة إلى اعتماد تنفيذها.',
    unknownHelp: 'يرجى التحقق من الحالة مع مضيفك.',
    note: 'تأكيد الدفع وحده لا يؤكد موعد مقدم الخدمة.' },
};
interface GuestService {
  orderId: number; title: string; paymentStatus: string; state: string;
  start: string | null; durationHours: number | null; timezone: string;
}

function trackingState(service: GuestService) {
  return service.paymentStatus === 'PAID' ? service.state : service.paymentStatus;
}
function isPastService(service: GuestService) {
  return ['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(trackingState(service));
}

export default function BaitlyGuestServiceTracking({ token, apiBase, lang, refreshKey }: {
  token: string; apiBase: string; lang: Lang; refreshKey?: boolean;
}) {
  const L = labels[lang];
  const source = `${apiBase}\u0000${token}`;
  const [snapshot, setSnapshot] = useState<{ source: string; services: GuestService[]; error: boolean; loading: boolean }>({ source, services: [], error: false, loading: true });
  // Un changement de séjour masque immédiatement les données de l'ancien lien, avant même l'effet réseau.
  const current = snapshot.source === source;
  const services = current ? snapshot.services : [];
  const error = current && snapshot.error;
  const loading = !current || snapshot.loading;
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setSnapshot(previous => ({ source, services: previous.source === source ? previous.services : [], loading: true, error: false }));
    fetch(`${apiBase}/api/public/guide/${encodeURIComponent(token)}/services`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<GuestService[]>; })
      .then(result => { if (!controller.signal.aborted) setSnapshot({ source, services: result, loading: false, error: false }); })
      .catch(() => { if (!controller.signal.aborted) setSnapshot({ source, services: [], loading: false, error: true }); });
    return () => controller.abort();
  }, [token, apiBase, source, revision, refreshKey]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') setRevision(value => value + 1); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const hasActiveService = services.some(service => !isPastService(service));
  useEffect(() => {
    if (!hasActiveService || loading || error) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setRevision(value => value + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [hasActiveService, loading, error]);
  if (!services.length && !error) return null;
  const active = services.filter(service => !isPastService(service));
  const past = services.filter(isPastService);
  const renderService = (service: GuestService) => {
    const state = trackingState(service);
    const stateLabels = ['PENDING', 'PAID', 'REFUNDED', 'CANCELLED', 'TO_SCHEDULE', 'TO_ORGANIZE', 'REQUESTED', 'CONFIRMED', 'IN_PROGRESS', 'TO_VALIDATE', 'COMPLETED'];
    const slot = guestServiceSlot(service.start, service.durationHours, lang);
    const terminal = isPastService(service);
    const cancelled = ['CANCELLED', 'REFUNDED'].includes(state);
    const Icon = state === 'COMPLETED' || state === 'CONFIRMED' ? CircleCheck
      : cancelled ? RotateCcw : state === 'PENDING' ? CreditCard
        : stateLabels.includes(state) ? Clock3 : CircleAlert;
    const help = state === 'PENDING' ? L.pendingHelp : state === 'TO_SCHEDULE' ? L.scheduleHelp
      : state === 'TO_ORGANIZE' ? L.organizeHelp : state === 'REQUESTED' ? L.requestedHelp
        : state === 'CONFIRMED' ? L.confirmedHelp : state === 'IN_PROGRESS' ? L.progressHelp
          : state === 'TO_VALIDATE' ? L.reviewHelp : !terminal ? L.unknownHelp : null;
    return <li key={service.orderId} className="wb-service-tracking__item" data-state={state}>
      <div className="wb-service-tracking__symbol" aria-hidden="true"><Icon size={22} /></div>
      <div className="wb-service-tracking__body">
        <div className="wb-service-tracking__identity">
          <h3>{service.title}</h3>
          <span className="wb-service-tracking__state" role="status">{stateLabels.includes(state) ? L[state as keyof typeof L] : service.paymentStatus === 'PAID' ? L.unknown : L.unknownPayment}</span>
        </div>
        {help && <p className="wb-service-tracking__help">{help}</p>}
        <div className="wb-service-tracking__facts">
          {slot && (service.paymentStatus === 'PAID' || cancelled) && <div className="wb-service-tracking__date"><CalendarDays size={16} aria-hidden="true" />
            <div><span className="wb-service-tracking__caption">{cancelled ? L.previousSlot : state === 'REQUESTED' ? L.requestedSlot : L.scheduled}</span>
              <time dateTime={service.start!}>{slot.date} · {slot.time}{slot.end && ` – ${slot.end}`}</time>
              <span className="wb-service-tracking__caption">{[slot.duration, service.timezone].filter(Boolean).join(' · ')}</span>
            </div>
          </div>}
          {service.paymentStatus === 'PAID' && state !== 'PAID' && <div className="wb-service-tracking__payment">
            <CreditCard size={16} aria-hidden="true" /><span>{L.payment} : <strong>{L.paid}</strong></span>
          </div>}
        </div>
      </div>
    </li>;
  };
  return <section className="wb-service-tracking" aria-label={L.title} aria-busy={loading} dir={lang === 'ar' ? 'rtl' : undefined}>
    <header><div><h2 className="wb-h2">{L.title}</h2><p className="wb-service-tracking__intro">{L.subtitle}</p></div>
      <button type="button" onClick={() => setRevision(value => value + 1)} disabled={loading} aria-label={L.refresh} title={L.refresh}>
        <RefreshCw size={17} aria-hidden="true" />
      </button>
    </header>
    {loading && <p className="wb-service-tracking__note" role="status">{L.updating}</p>}
    {error ? <p role="alert">{L.error}</p> : <>
      {active.length > 0 ? <div className="wb-service-tracking__active">
        <div className="wb-service-tracking__group-heading"><h3>{L.active}</h3><span>{active.length}</span></div>
        <ul>{active.map(renderService)}</ul>
      </div> : <p className="wb-service-tracking__empty"><CircleCheck size={18} aria-hidden="true" />{L.noActive}</p>}
      {past.length > 0 && <details className="wb-service-tracking__history">
        <summary><div><strong>{L.history} <span>({past.length})</span></strong><span>{L.historyHint}</span></div><ChevronDown size={18} aria-hidden="true" /></summary>
        <ul>{past.map(renderService)}</ul>
      </details>}
      {active.some(service => ['REQUESTED', 'TO_SCHEDULE', 'TO_ORGANIZE'].includes(trackingState(service))) && <p className="wb-service-tracking__note">{L.note}</p>}
    </>}
  </section>;
}
