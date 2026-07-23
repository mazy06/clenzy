import React, { useState } from 'react';
import { Box, Chip, Button, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { VerifiedUser, Replay, HourglassEmpty, Check } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  complianceConnectionApi,
  type DeclarationSummary,
  type DeclarationStatus,
} from '../../../services/api/complianceConnectionApi';
import { toneTokensSx, STATUS_TONES } from '../../../components/StatusChip';

// ─── Encart « Fiche de police / conformité » (Baitly) ─────────────────────────
//
// Compact, dans l'onglet Infos du panneau réservation. N'affiche RIEN tant
// qu'aucune déclaration n'existe. Pour chaque voyageur : libellé générique
// (jamais de PII) + chip statut (tokens) + bouton « Resoumettre » si non transmise.
// Un provider gouvernemental en attente (501) affiche un message clair plutôt
// qu'une erreur brute.

const OVERLINE_SX = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--faint)',
};

const PROVIDER_LABELS: Record<string, string> = {
  CHEKIN: 'Chekin',
  POLICE_MA: 'DGSN',
  ABSHER_KSA: 'Absher',
  SHOMOOS: 'Shomoos',
};

/** Date courte tabular-nums, repli sur la chaîne brute. */
function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

interface RowState {
  loading: boolean;
  message: string | null;
  tone: 'ok' | 'warn' | 'err' | null;
}

interface PanelReservationComplianceProps {
  reservationId: number;
}

const statusTokens = (status: DeclarationStatus) =>
  status === 'SUBMITTED' ? STATUS_TONES.ok : STATUS_TONES.warn;

const PanelReservationCompliance: React.FC<PanelReservationComplianceProps> = ({ reservationId }) => {
  const { t } = useTranslation();
  const [rowState, setRowState] = useState<Record<number, RowState>>({});

  const declarationsQuery = useQuery({
    queryKey: ['compliance-declarations', reservationId],
    queryFn: () => complianceConnectionApi.listReservationDeclarations(reservationId),
    staleTime: 30_000,
  });

  const declarations = declarationsQuery.data ?? [];

  // N'affiche rien tant qu'il n'y a aucune déclaration (gère aussi le loading silencieux).
  if (declarations.length === 0) return null;

  const statusLabel = (status: DeclarationStatus) =>
    status === 'SUBMITTED'
      ? t('reservations.compliance.transmitted', 'Transmise')
      : t('reservations.compliance.toTransmit', 'À transmettre');

  const travelerLabel = (d: DeclarationSummary, index: number) =>
    d.primary
      ? t('reservations.compliance.primaryTraveler', 'Voyageur principal')
      : t('reservations.compliance.companion', { defaultValue: 'Accompagnant {{n}}', n: index });

  const handleRetry = async (id: number) => {
    setRowState((s) => ({ ...s, [id]: { loading: true, message: null, tone: null } }));
    try {
      const result = await complianceConnectionApi.retryDeclarationSubmission(id);
      if (result.accepted) {
        setRowState((s) => ({
          ...s,
          [id]: { loading: false, message: t('reservations.compliance.success', 'Transmise au téléservice'), tone: 'ok' },
        }));
        declarationsQuery.refetch();
      } else if (result.pending) {
        setRowState((s) => ({
          ...s,
          [id]: { loading: false, message: t('reservations.compliance.providerPending', 'Intégration provider en attente'), tone: 'warn' },
        }));
      } else {
        setRowState((s) => ({
          ...s,
          [id]: { loading: false, message: result.message || t('reservations.compliance.notSubmitted', 'Non transmise'), tone: 'warn' },
        }));
      }
    } catch {
      setRowState((s) => ({
        ...s,
        [id]: { loading: false, message: t('reservations.compliance.error', 'Échec de la transmission'), tone: 'err' },
      }));
    }
  };

  return (
    <Box>
      {/* Header overline + icône bouclier */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)' }}>
          <VerifiedUser size={13} strokeWidth={1.75} />
        </Box>
        <Box component="span" sx={{ ...OVERLINE_SX, flex: 1 }}>
          {t('reservations.compliance.title', 'Fiche de police')}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {declarations.map((d, idx) => {
          // Numérotation des accompagnants (1, 2, …), indépendante de l'index brut.
          const companionIndex = declarations.slice(0, idx + 1).filter((x) => !x.primary).length;
          const tokens = statusTokens(d.status);
          const submitted = d.status === 'SUBMITTED';
          const row = rowState[d.id];
          const providerLabel = d.providerType ? PROVIDER_LABELS[d.providerType] ?? d.providerType : null;

          return (
            <Box
              key={d.id}
              sx={{
                backgroundColor: 'var(--field)',
                borderRadius: '10px',
                px: 1.5,
                py: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  component="span"
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {travelerLabel(d, companionIndex)}
                </Box>
                <Chip
                  icon={submitted ? <Check size={11} strokeWidth={2} /> : undefined}
                  label={statusLabel(d.status)}
                  size="small"
                  sx={{ ...toneTokensSx(tokens, 'sm'), borderRadius: 'var(--radius-pill)', flexShrink: 0 }}
                />
              </Box>

              {/* Ligne détail : provider + date (transmise) OU bouton resoumettre */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.625 }}>
                {submitted ? (
                  <Box component="span" sx={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>
                    {providerLabel && (
                      <Box component="span" sx={{ fontWeight: 600 }}>{providerLabel}</Box>
                    )}
                    {providerLabel && d.submittedAt && ' · '}
                    {d.submittedAt && (
                      <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(d.submittedAt)}</Box>
                    )}
                  </Box>
                ) : (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => handleRetry(d.id)}
                    disabled={row?.loading}
                    startIcon={
                      row?.loading ? <CircularProgress size={12} /> : <Replay size={13} strokeWidth={1.75} />
                    }
                    sx={{
                      fontSize: '0.6875rem',
                      textTransform: 'none',
                      color: 'var(--accent)',
                      py: 0.25,
                      px: 0.75,
                      minWidth: 0,
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'var(--accent-soft)' },
                      '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
                      transition: 'background-color var(--duration-fast) var(--ease-out)',
                      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    }}
                  >
                    {t('reservations.compliance.resubmit', 'Resoumettre')}
                  </Button>
                )}
              </Box>

              {/* Retour après action (succès / pending / erreur) */}
              {row?.message && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mt: 0.625,
                    fontSize: '0.6875rem',
                    color:
                      row.tone === 'ok' ? 'var(--ok)' : row.tone === 'err' ? 'var(--err)' : 'var(--warn)',
                  }}
                >
                  {row.tone === 'warn' && (
                    <Box component="span" sx={{ display: 'inline-flex' }}>
                      <HourglassEmpty size={12} strokeWidth={1.75} />
                    </Box>
                  )}
                  <Box component="span">{row.message}</Box>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default PanelReservationCompliance;
