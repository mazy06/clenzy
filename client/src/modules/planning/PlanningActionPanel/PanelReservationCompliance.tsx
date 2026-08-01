import React, { useState } from 'react';
import { cn } from '../../../utils/cn';
import { Spinner } from '../../../components/ui';
import { Button } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { VerifiedUser, Replay, HourglassEmpty, Check } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  complianceConnectionApi,
  type DeclarationSummary,
  type DeclarationStatus,
} from '../../../services/api/complianceConnectionApi';
import StatusChip, { STATUS_TONES } from '../../../components/StatusChip';

// ─── Encart « Fiche de police / conformité » (Baitly) ─────────────────────────
//
// Compact, dans l'onglet Infos du panneau réservation. N'affiche RIEN tant
// qu'aucune déclaration n'existe. Pour chaque voyageur : libellé générique
// (jamais de PII) + chip statut (tokens) + bouton « Resoumettre » si non transmise.
// Un provider gouvernemental en attente (501) affiche un message clair plutôt
// qu'une erreur brute.

const OVERLINE_CLASS = 'text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--faint)]';

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
    <div>
      {/* Header overline + icône bouclier */}
      <div className="flex items-center gap-1 mb-1.5">
        <span className="inline-flex text-[var(--faint)]">
          <VerifiedUser size={13} strokeWidth={1.75} />
        </span>
        <span className={cn(OVERLINE_CLASS, 'flex-1')}>
          {t('reservations.compliance.title', 'Fiche de police')}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {declarations.map((d, idx) => {
          // Numérotation des accompagnants (1, 2, …), indépendante de l'index brut.
          const companionIndex = declarations.slice(0, idx + 1).filter((x) => !x.primary).length;
          const tokens = statusTokens(d.status);
          const submitted = d.status === 'SUBMITTED';
          const row = rowState[d.id];
          const providerLabel = d.providerType ? PROVIDER_LABELS[d.providerType] ?? d.providerType : null;

          return (
            <div className="bg-[var(--field)] rounded-[10px] px-2 py-1.5" key={d.id}>
              <div className="flex items-center gap-1.5">
                <span className="flex-1 min-w-0 text-[0.8125rem] font-semibold text-[var(--ink)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {travelerLabel(d, companionIndex)}
                </span>
                <StatusChip
                  pill
                  size="sm"
                  tokens={tokens}
                  icon={submitted ? <Check size={11} strokeWidth={2} /> : undefined}
                  label={statusLabel(d.status)}
                  className="shrink-0"
                />
              </div>

              {/* Ligne détail : provider + date (transmise) OU bouton resoumettre */}
              <div className="flex items-center gap-1.5 mt-1">
                {submitted ? (
                  <span className="text-[0.6875rem] text-[var(--muted)]">
                    {providerLabel && (
                      <span className="font-semibold">{providerLabel}</span>
                    )}
                    {providerLabel && d.submittedAt && ' · '}
                    {d.submittedAt && (
                      <span className="tabular-nums">{fmtDate(d.submittedAt)}</span>
                    )}
                  </span>
                ) : (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => handleRetry(d.id)}
                    disabled={row?.loading}
                    startIcon={
                      row?.loading ? <Spinner className="size-3" /> : <Replay size={13} strokeWidth={1.75} />
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
              </div>

              {/* Retour après action (succès / pending / erreur) */}
              {row?.message && (
                <div className={cn('flex items-center gap-[3px] mt-[3.75px] text-[0.6875rem]', row.tone === 'ok' ? 'text-[var(--ok)]' : row.tone === 'err' ? 'text-[var(--err)]' : 'text-[var(--warn)]')}>
                  {row.tone === 'warn' && (
                    <span className="inline-flex">
                      <HourglassEmpty size={12} strokeWidth={1.75} />
                    </span>
                  )}
                  <span>{row.message}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PanelReservationCompliance;
