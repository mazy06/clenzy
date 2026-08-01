import { useState } from 'react';
import { Spinner } from '../../../components/ui';
import { useParams } from 'react-router-dom';
import { ButtonBase, InputBase } from '@mui/material';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { API_CONFIG } from '../../../config/api';

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
}

type Step = 'form' | 'preview' | 'done';

const fmt = (amount: number, currency: string | null) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(amount);

export default function CancelBookingPage() {
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

  return (
    <div className="min-h-[100vh] bg-[var(--bg)] text-[var(--ink)] flex items-start justify-center px-3 py-6 min-[900px]:py-12">
      <div className="w-full max-w-[460px] bg-[var(--card)] border border-solid border-[var(--line)] rounded-[var(--radius-lg)] p-[15px] min-[900px]:p-[21px]" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] font-[family-name:var(--fw-bold)] mb-0.5">
          Annuler ma réservation
        </div>
        <div className="text-[var(--text-md)] text-[var(--muted)] mb-4">
          Renseignez votre code de confirmation et votre email.
        </div>

        {error && (
          <div className="flex items-center gap-1.5 mb-3 p-2 rounded-[var(--radius-md)] bg-[var(--err-soft)] text-[var(--err)] text-[var(--text-sm)]">
            <AlertTriangle size={16} strokeWidth={2} /> {error}
          </div>
        )}

        {step === 'form' && (
          <>
            <Field label="Code de confirmation" value={code} onChange={setCode} placeholder="ABC123" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="vous@exemple.com" type="email" />
            <PrimaryButton onClick={loadPreview} loading={loading} label="Voir le remboursement" />
          </>
        )}

        {step === 'preview' && preview && (
          <>
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--accent-soft)] mb-3">
              <div className="text-[var(--text-sm)] text-[var(--muted)]">Remboursement applicable</div>
              <div className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] font-[family-name:var(--fw-bold)] text-[var(--accent)]">
                {fmt(preview.refundAmount, preview.currency)} <span className="text-[var(--text-md)] text-[var(--muted)] font-[family-name:var(--fw-medium)]">({preview.refundPercentage}%)</span>
              </div>
              <div className="text-[var(--text-sm)] text-[var(--body)] mt-0.5">{preview.explanation}</div>
            </div>
            <PrimaryButton onClick={confirmCancel} loading={loading} label="Confirmer l'annulation" danger />
            <ButtonBase onClick={() => setStep('form')} sx={{ mt: 1, fontSize: 'var(--text-sm)', color: 'var(--muted)', cursor: 'pointer' }}>Retour</ButtonBase>
          </>
        )}

        {step === 'done' && result && (
          <div className="text-center py-3">
            <div className="text-[var(--ok)] flex justify-center mb-2"><CheckCircle2 size={40} strokeWidth={1.75} /></div>
            <div className="text-[var(--text-lg)] font-[family-name:var(--fw-semibold)] mb-0.5">
              {result.status === 'already_cancelled' ? 'Réservation déjà annulée' : 'Réservation annulée'}
            </div>
            {result.refundAmount > 0 && (
              <div className="text-[var(--text-md)] text-[var(--muted)]">
                Remboursement de {fmt(result.refundAmount, result.currency)} en cours de traitement.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="mb-3">
      <label className="block text-[var(--text-sm)] font-[family-name:var(--fw-medium)] text-[var(--body)] mb-1">{label}</label>
      <InputBase
        value={value} type={type} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        sx={{ width: '100%', px: 1.5, py: 1, fontSize: 'var(--text-md)', color: 'var(--ink)', bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', '&.Mui-focused': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' } }}
      />
    </div>
  );
}

function PrimaryButton({ onClick, loading, label, danger = false }: {
  onClick: () => void; loading: boolean; label: string; danger?: boolean;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={loading}
      sx={{
        width: '100%', height: 46, borderRadius: 'var(--radius-md)', cursor: 'pointer',
        bgcolor: danger ? 'var(--err)' : 'var(--accent)', color: '#fff',
        fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)',
        transition: 'opacity var(--duration-fast) var(--ease-out)',
        '&:hover': { opacity: 0.92 }, '&.Mui-disabled': { opacity: 0.5 },
        '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
      }}
    >
      {loading ? <Spinner className="size-5 text-[#fff]" /> : label}
    </ButtonBase>
  );
}
