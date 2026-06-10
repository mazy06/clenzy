import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, TextField, Checkbox, FormControlLabel,
  CircularProgress, Alert,
} from '@mui/material';
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

const BRAND = '#6B8A9A';

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
    <Box
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      sx={{
        minHeight: '100vh',
        bgcolor: '#f6f8f9',
        py: { xs: 3, md: 6 },
        px: 2,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* ── En-tête marque ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            component="span"
            sx={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: '10px',
              bgcolor: BRAND, color: '#fff', flexShrink: 0,
            }}
          >
            <Handshake size={20} strokeWidth={1.75} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2, color: '#2c3e46' }}>
              Clenzy
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {L.brandTagline}
            </Typography>
          </Box>
        </Box>

        {state === 'loading' && (
          <Paper variant="outlined" sx={{ borderRadius: 3, p: 6, textAlign: 'center' }}>
            <CircularProgress size={28} sx={{ color: BRAND }} />
            <Typography sx={{ mt: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
              {L.loadingText}
            </Typography>
          </Paper>
        )}

        {(state === 'notfound' || state === 'error') && (
          <StatusCard
            icon={<Warning size={28} strokeWidth={1.75} />}
            iconColor="#D4A574"
            title={state === 'notfound' ? L.notFoundTitle : L.errorTitle}
            text={state === 'notfound' ? L.notFoundText : L.errorText}
          />
        )}

        {state === 'ready' && view && (
          <>
            {/* ── Bandeau d'état (expiré / annulé / signé / succès) ── */}
            {view.status === 'EXPIRED' && (
              <StatusCard icon={<Warning size={28} strokeWidth={1.75} />} iconColor="#D4A574"
                title={L.expiredTitle} text={L.expiredText} />
            )}
            {view.status === 'CANCELLED' && (
              <StatusCard icon={<Warning size={28} strokeWidth={1.75} />} iconColor="#C97A7A"
                title={L.cancelledTitle} text={L.cancelledText} />
            )}
            {view.status === 'SIGNED' && (
              <StatusCard
                icon={<CheckCircle size={28} strokeWidth={1.75} />}
                iconColor="#4A9B8E"
                title={justSigned ? L.successTitle : L.signedTitle}
                text={justSigned
                  ? L.successText
                  : L.signedText
                      .replace('{date}', view.signedAt ?? '—')
                      .replace('{name}', view.signedByName ?? '—')}
              />
            )}

            {/* ── Titre + récapitulatif (toujours visibles si contrat lisible) ── */}
            <Box>
              <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, color: '#2c3e46', textWrap: 'balance' }}>
                {L.title} <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '1.05rem', color: BRAND }}>{view.contractNumber}</Box>
              </Typography>
              {view.status === 'PENDING' && (
                <Typography sx={{ mt: 0.5, fontSize: '0.875rem', color: 'text.secondary' }}>
                  {L.subtitle}
                </Typography>
              )}
            </Box>

            <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
              <SectionLabel>{L.summaryTitle}</SectionLabel>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 3 }}>
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
              </Box>
            </Paper>

            {/* ── Document ── */}
            {(view.status === 'PENDING' || view.status === 'SIGNED') && (
              <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <SectionLabel sx={{ mb: 0 }}>{L.documentTitle}</SectionLabel>
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
                </Box>
                {pdfUrl ? (
                  <Box
                    component="iframe"
                    src={pdfUrl}
                    title={`${L.title} ${view.contractNumber}`}
                    sx={{
                      width: '100%',
                      height: { xs: 380, md: 520 },
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: '#fff',
                    }}
                  />
                ) : view.documentAvailable ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <CircularProgress size={22} sx={{ color: BRAND }} />
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ borderRadius: 2, fontSize: '0.8125rem' }}>
                    {L.documentUnavailable}
                  </Alert>
                )}
                {view.status === 'PENDING' && (
                  <Typography sx={{ mt: 1, fontSize: '0.75rem', color: 'text.disabled' }}>
                    {L.documentHint}
                  </Typography>
                )}
              </Paper>
            )}

            {/* ── Bloc signature ── */}
            {view.status === 'PENDING' && (
              <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 3 }, borderColor: BRAND }}>
                <SectionLabel>{L.signTitle}</SectionLabel>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.55 }}>
                        {view.consentText}
                      </Typography>
                    }
                    sx={{ alignItems: 'flex-start', mx: 0 }}
                  />
                  {signError && (
                    <Alert severity="error" sx={{ borderRadius: 2, fontSize: '0.8125rem' }}>
                      {signError}
                    </Alert>
                  )}
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleSign}
                    disabled={!formValid || signing}
                    startIcon={signing
                      ? <CircularProgress size={16} color="inherit" />
                      : <CheckCircle size={18} strokeWidth={1.75} />}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1.1,
                      bgcolor: BRAND,
                      '&:hover': { bgcolor: '#5a7888' },
                      alignSelf: { sm: 'flex-start' },
                      px: 4,
                    }}
                  >
                    {signing ? L.signing : L.signButton}
                  </Button>
                </Box>
              </Paper>
            )}
          </>
        )}

        {/* ── Pied de page légal ── */}
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', textAlign: 'center', pb: 2 }}>
          {L.footer}
        </Typography>
      </Box>
    </Box>
  );
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Typography
    sx={{
      fontSize: '0.6875rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'text.secondary',
      mb: 1.5,
      ...sx,
    }}
  >
    {children}
  </Typography>
);

const SummaryRow: React.FC<{ label: string; value: string; tabular?: boolean }> = ({ label, value, tabular }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.875, borderBottom: '1px solid', borderColor: 'rgba(107,138,154,0.12)' }}>
    <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', flexShrink: 0 }}>{label}</Typography>
    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#2c3e46', textAlign: 'end', ...(tabular ? { fontVariantNumeric: 'tabular-nums' } : {}) }}>
      {value}
    </Typography>
  </Box>
);

const StatusCard: React.FC<{ icon: React.ReactNode; iconColor: string; title: string; text: string }> = ({
  icon, iconColor, title, text,
}) => (
  <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2.5, md: 3 }, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
        bgcolor: `${iconColor}1A`, color: iconColor,
      }}
    >
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#2c3e46', textWrap: 'balance' }}>{title}</Typography>
      <Typography sx={{ mt: 0.5, fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.55 }}>{text}</Typography>
    </Box>
  </Paper>
);

export default ContractSignPage;
