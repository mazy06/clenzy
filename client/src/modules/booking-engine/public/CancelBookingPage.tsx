import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, ButtonBase, CircularProgress, InputBase } from '@mui/material';
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
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg)', color: 'var(--ink)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', px: 2, py: { xs: 4, md: 8 } }}>
      <Box sx={{ width: '100%', maxWidth: 460, bgcolor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', p: { xs: 2.5, md: 3.5 } }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', mb: 0.5 }}>
          Annuler ma réservation
        </Box>
        <Box sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)', mb: 3 }}>
          Renseignez votre code de confirmation et votre email.
        </Box>

        {error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 'var(--text-sm)' }}>
            <AlertTriangle size={16} strokeWidth={2} /> {error}
          </Box>
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
            <Box sx={{ p: 2, borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent-soft)', mb: 2 }}>
              <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>Remboursement applicable</Box>
              <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--accent)' }}>
                {fmt(preview.refundAmount, preview.currency)} <Box component="span" sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)', fontWeight: 'var(--fw-medium)' }}>({preview.refundPercentage}%)</Box>
              </Box>
              <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--body)', mt: 0.5 }}>{preview.explanation}</Box>
            </Box>
            <PrimaryButton onClick={confirmCancel} loading={loading} label="Confirmer l'annulation" danger />
            <ButtonBase onClick={() => setStep('form')} sx={{ mt: 1, fontSize: 'var(--text-sm)', color: 'var(--muted)', cursor: 'pointer' }}>Retour</ButtonBase>
          </>
        )}

        {step === 'done' && result && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Box sx={{ color: 'var(--ok)', display: 'flex', justifyContent: 'center', mb: 1.5 }}><CheckCircle2 size={40} strokeWidth={1.75} /></Box>
            <Box sx={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)', mb: 0.5 }}>
              {result.status === 'already_cancelled' ? 'Réservation déjà annulée' : 'Réservation annulée'}
            </Box>
            {result.refundAmount > 0 && (
              <Box sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)' }}>
                Remboursement de {fmt(result.refundAmount, result.currency)} en cours de traitement.
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box component="label" sx={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--body)', mb: 0.75 }}>{label}</Box>
      <InputBase
        value={value} type={type} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        sx={{ width: '100%', px: 1.5, py: 1, fontSize: 'var(--text-md)', color: 'var(--ink)', bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', '&.Mui-focused': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' } }}
      />
    </Box>
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
      {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : label}
    </ButtonBase>
  );
}
