import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '../../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Card } from '../../../components/ui';
import { useParams } from 'react-router-dom';
import { Paper, Button, TextField, Checkbox, FormControlLabel, CircularProgress } from '@mui/material';
import { cn } from '../../../utils/cn';
import { Handshake, CheckCircle, Download, Warning } from '../../../icons';
import { API_CONFIG } from '../../../config/api';
import { SIGN_LABELS, detectSignLang, type SignLabels } from './signLabels';

// Même résolution que le reste de l'app (VITE_API_BASE_URL) : dev = localhost:8084,
// prod = https://app.clenzy.fr. PAS VITE_API_URL, qui n'est défini nulle part.
const API_BASE = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}`;

/** Payload public renvoyé par GET /api/public/contract-signature/{token}. */
interface SignView {
  status: 'PENDING' | 'SIGNED' | 'EXPIRED' | 'CANCELLED';
  contractNumber: string;
  contractType: string | null;
  propertyName: string;
  ownerName: string;
  commissionRate: number | null;
  startDate: string | null;
  endDate: string | null;
  paymentModel: string | null;
  documentAvailable: boolean;
  signedAt: string | null;
  signedByName: string | null;
  expiresAt: string | null;
  consentText: string;
}

type PageState = 'loading' | 'ready' | 'notfound' | 'error';

// Page publique : on consomme les tokens Signature (tokens.css importé global).
// Défaut visiteur = thème clair, accent émeraude.
const BRAND = 'var(--accent)';

async function fetchView(token: string): Promise<SignView | null> {
  const response = await fetch(`${API_BASE}/public/contract-signature/${token}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('fetch_failed');
  return response.json();
}

/**
 * Page publique de consultation + signature électronique du mandat de gestion
 * (/sign/:token). Sans auth : fetch natif sur /api/public/** (pattern PublicGuide).
 */
const ContractSignPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const lang = useMemo(detectSignLang, []);
  const L: SignLabels = SIGN_LABELS[lang];

  const [state, setState] = useState<PageState>('loading');
  const [view, setView] = useState<SignView | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState(false);

  // Formulaire de signature
  const [signerName, setSignerName] = useState('');
  const [consent, setConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const loadDocument = useCallback(async (tk: string) => {
    try {
      const response = await fetch(`${API_BASE}/public/contract-signature/${tk}/document`);
      if (!response.ok) return;
      const blob = await response.blob();
      setPdfUrl((prev) => {
        if (prev) window.URL.revokeObjectURL(prev);
        return window.URL.createObjectURL(blob);
      });
    } catch {
      // Document indisponible : la page reste utilisable (état documentAvailable).
    }
  }, []);

  useEffect(() => {
    if (!token) { setState('notfound'); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchView(token);
        if (cancelled) return;
        if (!data) { setState('notfound'); return; }
        setView(data);
        setState('ready');
        if (data.documentAvailable) void loadDocument(token);
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [token, loadDocument]);

  // Libère l'object URL du PDF au démontage.
  useEffect(() => () => { if (pdfUrl) window.URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const handleSign = async () => {
    if (!token || signing) return;
    setSigning(true);
    setSignError(null);
    try {
      const response = await fetch(`${API_BASE}/public/contract-signature/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signerName: signerName.trim(), consent }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setSignError(body?.error || L.signError);
        // 409/410 : l'état a changé entre-temps → recharge la vue.
        if (response.status === 409 || response.status === 410) {
          const refreshed = await fetchView(token).catch(() => null);
          if (refreshed) setView(refreshed);
        }
        return;
      }
      const updated: SignView = await response.json();
      setView(updated);
      setJustSigned(true);
      // Recharge le PDF : il contient désormais la page certificat.
      void loadDocument(token);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSignError(L.signError);
    } finally {
      setSigning(false);
    }
  };

  const formValid = signerName.trim().length >= 3 && consent;

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    // md MUI = 900px ; py 3/6 = 18px/36px et px 2 = 12px (theme.spacing vaut 6).
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen flex justify-center bg-[var(--bg)] px-3 py-[18px] min-[900px]:py-9"
    >
      <div className="w-full max-w-[760px] flex flex-col gap-4">
        {/* ── En-tête marque ── */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-[10px] text-[var(--on-accent)] shrink-0" style={{ backgroundColor: BRAND }}>
            <Handshake size={20} strokeWidth={1.75} />
          </span>
          <div>
            <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[1rem] font-semibold leading-[1.2] text-[var(--ink)]">
              Clenzy
            </p>
            <p className="cn-text-body1 text-[0.75rem] text-[var(--muted)]">
              {L.brandTagline}
            </p>
          </div>
        </div>

        {state === 'loading' && (
          <Card className="gap-0 py-0 border-[var(--line)] p-9 text-center">
            <CircularProgress size={28} sx={{ color: BRAND }} />
            <p className="cn-text-body1 mt-3 text-[0.875rem] text-[var(--muted)]">
              {L.loadingText}
            </p>
          </Card>
        )}

        {(state === 'notfound' || state === 'error') && (
          <StatusCard
            icon={<Warning size={28} strokeWidth={1.75} />}
            iconColor="var(--warn)"
            iconSoft="var(--warn-soft)"
            title={state === 'notfound' ? L.notFoundTitle : L.errorTitle}
            text={state === 'notfound' ? L.notFoundText : L.errorText}
          />
        )}

        {state === 'ready' && view && (
          <>
            {/* ── Bandeau d'état (expiré / annulé / signé / succès) ── */}
            {view.status === 'EXPIRED' && (
              <StatusCard icon={<Warning size={28} strokeWidth={1.75} />} iconColor="var(--warn)" iconSoft="var(--warn-soft)"
                title={L.expiredTitle} text={L.expiredText} />
            )}
            {view.status === 'CANCELLED' && (
              <StatusCard icon={<Warning size={28} strokeWidth={1.75} />} iconColor="var(--err)" iconSoft="var(--err-soft)"
                title={L.cancelledTitle} text={L.cancelledText} />
            )}
            {view.status === 'SIGNED' && (
              <StatusCard
                icon={<CheckCircle size={28} strokeWidth={1.75} />}
                iconColor="var(--ok)"
                iconSoft="var(--ok-soft)"
                title={justSigned ? L.successTitle : L.signedTitle}
                text={justSigned
                  ? L.successText
                  : L.signedText
                      .replace('{date}', view.signedAt ?? '—')
                      .replace('{name}', view.signedByName ?? '—')}
              />
            )}

            {/* ── Titre + récapitulatif (toujours visibles si contrat lisible) ── */}
            <div>
              <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[1.375rem] font-semibold text-[var(--ink)] text-balance">
                {L.title} <span className="text-[1.05rem]" style={{ fontFamily: 'monospace', color: BRAND }}>{view.contractNumber}</span>
              </p>
              {view.status === 'PENDING' && (
                <p className="cn-text-body1 mt-0.5 text-[0.875rem] text-[var(--muted)]">
                  {L.subtitle}
                </p>
              )}
            </div>

            <Paper variant="outlined" sx={{ borderRadius: 'var(--radius-lg)', borderColor: 'var(--line)', p: { xs: 2, md: 3 } }}>
              <SectionLabel>{L.summaryTitle}</SectionLabel>
              <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-x-[18px]">
                <SummaryRow label={L.property} value={view.propertyName || '—'} />
                <SummaryRow label={L.owner} value={view.ownerName || '—'} />
                <SummaryRow
                  label={L.contractType}
                  value={(view.contractType && L.contractTypes[view.contractType]) || view.contractType || '—'}
                />
                <SummaryRow
                  label={L.commission}
                  value={view.commissionRate != null ? `${Math.round(view.commissionRate * 100)} %` : '—'}
                  tabular
                />
                <SummaryRow
                  label={L.period}
                  value={`${view.startDate ?? '—'} → ${view.endDate ?? L.periodOpenEnded}`}
                  tabular
                />
                <SummaryRow
                  label={L.collection}
                  value={(view.paymentModel && L.paymentModels[view.paymentModel]) || view.paymentModel || '—'}
                />
              </div>
            </Paper>

            {/* ── Document ── */}
            {(view.status === 'PENDING' || view.status === 'SIGNED') && (
              <Paper variant="outlined" sx={{ borderRadius: 'var(--radius-lg)', borderColor: 'var(--line)', p: { xs: 2, md: 3 } }}>
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel className="mb-0">{L.documentTitle}</SectionLabel>
                  {pdfUrl && (
                    <Button
                      size="small"
                      startIcon={<Download size={15} strokeWidth={1.75} />}
                      component="a"
                      href={pdfUrl}
                      download={`Mandat_${view.contractNumber}.pdf`}
                      sx={{ textTransform: 'none', color: BRAND, fontWeight: 600 }}
                    >
                      {L.download}
                    </Button>
                  )}
                </div>
                {pdfUrl ? (
                  <iframe className="w-full h-[380px] min-[900px]:h-[520px] border border-solid border-[var(--line-2)] rounded-[12px] bg-[var(--card)]" src={pdfUrl} title={`${L.title} ${view.contractNumber}`} />
                ) : view.documentAvailable ? (
                  <div className="py-6 text-center">
                    <CircularProgress size={22} sx={{ color: BRAND }} />
                  </div>
                ) : (
                  <Alert variant="info" className="text-[0.8125rem]">
                    <Info />
                    <AlertDescription>{L.documentUnavailable}</AlertDescription>
                  </Alert>
                )}
                {view.status === 'PENDING' && (
                  <p className="cn-text-body1 mt-1.5 text-[0.75rem] text-[var(--faint)]">
                    {L.documentHint}
                  </p>
                )}
              </Paper>
            )}

            {/* ── Bloc signature ── */}
            {view.status === 'PENDING' && (
              <Paper variant="outlined" sx={{ borderRadius: 'var(--radius-lg)', p: { xs: 2, md: 3 }, borderColor: BRAND }}>
                <SectionLabel>{L.signTitle}</SectionLabel>
                <div className="flex flex-col gap-3">
                  <TextField
                    label={L.signerNameLabel}
                    placeholder={L.signerNamePlaceholder}
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    fullWidth
                    size="small"
                    autoComplete="name"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        sx={{ alignSelf: 'flex-start', mt: -0.75, color: BRAND, '&.Mui-checked': { color: BRAND } }}
                      />
                    }
                    label={
                      <p className="cn-text-body1 text-[0.78rem] text-[var(--muted)] leading-[1.55]">
                        {view.consentText}
                      </p>
                    }
                    sx={{ alignItems: 'flex-start', mx: 0 }}
                  />
                  {signError && (
                    <Alert variant="destructive" className="text-[0.8125rem]">
                      <TriangleAlert />
                      <AlertDescription>{signError}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleSign}
                    disabled={!formValid || signing}
                    startIcon={signing
                      ? <Spinner className="size-4" />
                      : <CheckCircle size={18} strokeWidth={1.75} />}
                    sx={{
                      // Exception page publique : CTA de signature en aplat accent
                      // (langage propre aux pages publiques, cf. send messagerie).
                      py: 1.1,
                      bgcolor: BRAND,
                      color: 'var(--on-accent)',
                      borderColor: BRAND,
                      '&:hover': { bgcolor: 'var(--accent-deep)', borderColor: 'var(--accent-deep)', color: 'var(--on-accent)' },
                      alignSelf: { sm: 'flex-start' },
                      px: 4,
                    }}
                  >
                    {signing ? L.signing : L.signButton}
                  </Button>
                </div>
              </Paper>
            )}
          </>
        )}

        {/* ── Pied de page légal ── */}
        <p className="cn-text-body1 text-[0.6875rem] text-[var(--faint)] text-center pb-3">
          {L.footer}
        </p>
      </div>
    </div>
  );
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

// L'ancien surcharge par `sx` devient une surcharge par `className` : le seul
// appelant passait `mb: 0`, que tailwind-merge resout contre le mb-[9px] de base.
const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cn('cn-text-body1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--faint)] mb-[9px]', className)}>
    {children}
  </p>
);

const SummaryRow: React.FC<{ label: string; value: string; tabular?: boolean }> = ({ label, value, tabular }) => (
  <div className="flex justify-between gap-3 py-1.5 border-b border-[var(--line)]">
    <p className="cn-text-body1 text-[0.8125rem] text-[var(--muted)] shrink-0">{label}</p>
    <p className={cn('cn-text-body1 text-[0.8125rem] font-semibold text-[var(--ink)] text-end', tabular && 'tabular-nums')}>
      {value}
    </p>
  </div>
);

const StatusCard: React.FC<{ icon: React.ReactNode; iconColor: string; iconSoft: string; title: string; text: string }> = ({
  icon, iconColor, iconSoft, title, text,
}) => (
  <Paper variant="outlined" sx={{ borderRadius: 'var(--radius-lg)', borderColor: 'var(--line)', p: { xs: 2.5, md: 3 }, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
    <span className="inline-flex items-center justify-center w-[44px] h-[44px] rounded-[12px] shrink-0" style={{ backgroundColor: iconSoft, color: iconColor }}>
      {icon}
    </span>
    <div>
      <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[1rem] font-semibold text-[var(--ink)] text-balance">{title}</p>
      <p className="cn-text-body1 mt-0.5 text-[0.85rem] text-[var(--muted)] leading-[1.55]">{text}</p>
    </div>
  </Paper>
);

export default ContractSignPage;
