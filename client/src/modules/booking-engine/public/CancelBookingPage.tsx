import { useId, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  Spinner,
} from '../../../components/ui';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from '../../../icons/glyphs';
import { API_CONFIG } from '../../../config/api';
import { activeIntlLocale } from '../../../utils/activeLocale';
import { createBookingI18n } from '../sdk/i18n';

/**
 * Langue du visiteur : cette page n'a pas de config de site (elle n'est atteinte
 * qu'avec un code de réservation), donc le navigateur fait foi.
 */
function browserLang(): string {
  const raw = typeof navigator === 'undefined' ? 'fr' : (navigator.language || 'fr');
  const base = raw.slice(0, 2).toLowerCase();
  return ['fr', 'en', 'ar'].includes(base) ? base : 'fr';
}

const API_BASE = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}`;

/**
 * Annulation self-service par le voyageur (P0.4). Route publique /booking/:apiKey/cancel (hors auth).
 * Flux : saisie (code de confirmation + email) → aperçu du remboursement (politique) → confirmation.
 * Org résolue par la clé API (X-Booking-Key). Rendu client.
 */

interface RefundPreview {
  policyType: string;
  refundPercentage: number;
  refundAmount: number;
  currency: string;
  daysBeforeCheckIn: number;
  explanation: string;
}
interface CancelResult {
  status: string;
  refundAmount: number;
  currency: string | null;
  refundStatus?: 'NONE' | 'PENDING' | 'CONFIRMED' | 'FAILED' | 'RECONCILIATION_REQUIRED' | 'UNKNOWN';
  refundedAmount?: number;
}

type Step = 'form' | 'preview' | 'done';

const fmt = (amount: number, currency: string | null) =>
  new Intl.NumberFormat(activeIntlLocale(), { style: 'currency', currency: currency || 'EUR' }).format(amount);

export default function CancelBookingPage() {
  const { t } = useMemo(() => createBookingI18n(browserLang()), []);
  const { apiKey } = useParams<{ apiKey: string }>();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [result, setResult] = useState<CancelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `${API_BASE}/public/booking/widget/booking`;
  const headers = { 'Content-Type': 'application/json', 'X-Booking-Key': apiKey ?? '' };

  const loadPreview = () => {
    if (!code.trim() || !email.trim()) { setError('Code et email requis.'); return; }
    setLoading(true); setError(null);
    fetch(`${base}/${encodeURIComponent(code.trim())}/cancellation-preview`, {
      method: 'POST', headers, body: JSON.stringify({ email: email.trim() }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: RefundPreview) => { setPreview(data); setStep('preview'); })
      .catch(() => setError('Réservation introuvable (vérifiez le code et l’email).'))
      .finally(() => setLoading(false));
  };

  const confirmCancel = () => {
    setLoading(true); setError(null);
    fetch(`${base}/${encodeURIComponent(code.trim())}/cancel`, {
      method: 'POST', headers, body: JSON.stringify({ email: email.trim(), reason: 'guest_self_service' }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: CancelResult) => { setResult(data); setStep('done'); })
      .catch(() => setError('Annulation impossible. Réessayez ou contactez l’hôte.'))
      .finally(() => setLoading(false));
  };

  const refreshRefund = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`${base}/${encodeURIComponent(code.trim())}/cancellation-status`, {
        method: 'POST', headers, body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setResult(await response.json());
    } catch {
      setError(t('page.refundStatusError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100vh] bg-background text-foreground flex items-start justify-center px-3 py-6 min-[900px]:py-12">
      <Card className="w-full max-w-[460px]">
        <CardHeader>
          <CardTitle className="[font-family:var(--font-display)] text-xl font-bold text-balance">
            {t('page.cancelTitle')}
          </CardTitle>
          <CardDescription>{t('page.cancelIntro')}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertTriangle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'form' && (
            <>
              <FormField label={t('page.confirmationCode')} value={code} onChange={setCode} placeholder="ABC123" />
              <FormField label={t('page.email')} value={email} onChange={setEmail} placeholder={t('page.emailPlaceholder')} type="email" />
              <Button size="lg" className="w-full" onClick={loadPreview} disabled={loading}>
                {loading ? <Spinner className="size-5" /> : t('page.seeRefund')}
              </Button>
            </>
          )}

          {step === 'preview' && preview && (
            <>
              <div className="p-3 rounded-lg bg-primary-soft mb-3">
                <div className="text-xs text-muted-foreground">Remboursement applicable</div>
                <div className="[font-family:var(--font-display)] text-2xl font-bold text-primary tabular-nums">
                  {fmt(preview.refundAmount, preview.currency)} <span className="text-sm text-muted-foreground font-medium">({preview.refundPercentage}%)</span>
                </div>
                <div className="text-xs text-foreground mt-0.5">{preview.explanation}</div>
              </div>
              <Button variant="destructive" size="lg" className="w-full" onClick={confirmCancel} disabled={loading}>
                {loading ? <Spinner className="size-5" /> : t('page.confirmCancel')}
              </Button>
              {/* Retour en arriere : action tertiaire, pas un second bouton plein. */}
              <Button variant="ghost" size="sm" className="mt-1.5 w-full text-muted-foreground" onClick={() => setStep('form')}>
                {t('page.back')}
              </Button>
            </>
          )}

          {step === 'done' && result && (
            <div className="text-center py-3">
              <div className="text-success flex justify-center mb-2"><CheckCircle2 size={40} strokeWidth={1.75} /></div>
              <div className="text-base font-semibold text-balance mb-0.5">
                {result.status === 'already_cancelled' ? t('page.alreadyCancelled') : t('page.cancelled')}
              </div>
              <div role="status" aria-live="polite" className="text-sm text-muted-foreground tabular-nums mt-2">
                {result.refundStatus === 'CONFIRMED'
                  ? t('page.refundConfirmed').replace('{amount}', fmt(result.refundedAmount ?? 0, result.currency))
                  : result.refundStatus === 'PENDING'
                    ? t('page.refundPending').replace('{amount}', fmt(result.refundAmount, result.currency))
                    : result.refundStatus === 'NONE'
                      ? t('page.refundNone')
                      : t('page.refundReview')}
              </div>
              {result.refundStatus !== 'NONE' && result.refundStatus !== 'CONFIRMED' && (
                <Button variant="outline" className="mt-4 w-full" onClick={refreshRefund} disabled={loading}>
                  {loading ? <Spinner className="size-4" /> : t('page.checkRefund')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  // Le libelle est du texte libre (accents, espaces) : il ne peut pas servir
  // d'identifiant, et le composant est monte deux fois dans la page.
  const inputId = useId();
  return (
    <Field className="mb-3">
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      {/* Le gabarit du champ (fond, lisere, rayon, anneau de focus) vient du
          primitif : l'ancien sx ne faisait que le redire. */}
      <Input
        id={inputId}
        value={value} type={type} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
