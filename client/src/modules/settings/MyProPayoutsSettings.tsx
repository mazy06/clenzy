import React, { useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Chip,
  CircularProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { AccountBalance, CheckCircle, Refresh } from '../../icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import type { StripeConnectInstance } from '@stripe/connect-js';
import { useTranslation } from '../../hooks/useTranslation';
import { housekeeperPayoutsApi } from '../../services/api/housekeeperPayoutsApi';
import type { HousekeeperPayoutRecord } from '../../services/api/housekeeperPayoutsApi';

// ─── « Mes versements » (Moteur Ménage 3B — P9) — HOUSEKEEPER / TECHNICIAN ───
// Onboarding Stripe Connect Express EMBARQUÉ (@stripe/connect-js — le pro ne
// quitte pas Baitly) + historique des versements (payout à la validation de la
// mission, gaté par la preuve photo).

const payoutsKeys = { my: ['housekeeper-payouts', 'me'] as const };

const STATUS_COLOR: Record<HousekeeperPayoutRecord['status'], string> = {
  SENT: 'var(--ok, #4A9B8E)',
  PENDING: 'var(--warn, #D4A574)',
  FAILED: 'var(--err, #C97A7A)',
  BLOCKED: 'var(--muted)',
};

export default function MyProPayoutsSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const payoutsQuery = useQuery({
    queryKey: payoutsKeys.my,
    queryFn: () => housekeeperPayoutsApi.getMy(),
    staleTime: 30_000,
  });

  // ── Onboarding embarqué (Account Session → composant connect-js) ──
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const connectInstanceRef = useRef<StripeConnectInstance | null>(null);

  const refreshMutation = useMutation({
    mutationFn: () => housekeeperPayoutsApi.refreshStatus(),
    onSuccess: (updated) => queryClient.setQueryData(payoutsKeys.my, updated),
  });

  const startOnboarding = async () => {
    setOnboardingError(null);
    setInitializing(true);
    try {
      const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
      if (!publishableKey) {
        setOnboardingError(t('settings.myProPayouts.noPublishableKey'));
        return;
      }
      const instance = loadConnectAndInitialize({
        publishableKey,
        // connect-js rappelle ce fetch à chaque expiration de session.
        fetchClientSecret: async () => (await housekeeperPayoutsApi.createAccountSession()).clientSecret,
        appearance: {
          variables: {
            colorPrimary: '#6B8A9A',
            borderRadius: '11px',
          },
        },
      });
      connectInstanceRef.current = instance;
      setOnboardingOpen(true);
      // Monte le composant d'onboarding embarqué dans le conteneur.
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        containerRef.current.replaceChildren();
        const component = instance.create('account-onboarding');
        component.setOnExit(() => {
          // Retour du flux → rafraîchit le statut côté backend (webhook + refresh).
          setOnboardingOpen(false);
          refreshMutation.mutate();
        });
        containerRef.current.appendChild(component);
      });
    } catch (err: unknown) {
      setOnboardingError(err instanceof Error ? err.message : t('settings.myProPayouts.onboardingError'));
    } finally {
      setInitializing(false);
    }
  };

  const data = payoutsQuery.data;
  const records = useMemo(() => data?.records ?? [], [data]);

  if (payoutsQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Skeleton variant="rounded" height={140} sx={{ borderRadius: '13px' }} />
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: '13px' }} />
      </Box>
    );
  }
  if (payoutsQuery.isError) {
    return <Alert severity="error">{t('settings.myProPayouts.loadError')}</Alert>;
  }

  const statusChip = data?.onboardingCompleted ? (
    <Chip
      size="small"
      icon={<CheckCircle size={13} strokeWidth={2} />}
      label={t('settings.myProPayouts.statusComplete')}
      sx={{ bgcolor: 'color-mix(in srgb, var(--ok, #4A9B8E) 12%, transparent)', color: 'var(--ok, #4A9B8E)', fontWeight: 700 }}
    />
  ) : data?.accountCreated ? (
    <Chip size="small" label={t('settings.myProPayouts.statusInProgress')}
      sx={{ bgcolor: 'var(--field)', color: 'var(--muted)', fontWeight: 700 }} />
  ) : (
    <Chip size="small" label={t('settings.myProPayouts.statusNotStarted')}
      sx={{ bgcolor: 'var(--field)', color: 'var(--muted)', fontWeight: 700 }} />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ── Compte de versement (onboarding embarqué) ─────────────────────── */}
      <Paper id="pro-onboarding" sx={{ border: '1px solid var(--line)', boxShadow: 'none', borderRadius: '13px', p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, flexWrap: 'wrap' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}>
            <AccountBalance size={18} strokeWidth={1.75} />
          </Box>
          <Typography sx={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>
            {t('settings.myProPayouts.accountSection')}
          </Typography>
          {statusChip}
          <Box sx={{ marginInlineStart: 'auto', display: 'flex', gap: 1 }}>
            {data?.accountCreated && !data?.onboardingCompleted && (
              <Button
                size="small"
                variant="text"
                startIcon={refreshMutation.isPending ? <CircularProgress size={14} /> : <Refresh size={14} strokeWidth={1.75} />}
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
              >
                {t('settings.myProPayouts.refreshStatus')}
              </Button>
            )}
            {!data?.onboardingCompleted && (
              <Button
                size="small"
                variant="contained"
                onClick={startOnboarding}
                disabled={initializing || onboardingOpen}
                startIcon={initializing ? <CircularProgress size={14} color="inherit" /> : undefined}
              >
                {data?.accountCreated
                  ? t('settings.myProPayouts.resumeOnboarding')
                  : t('settings.myProPayouts.startOnboarding')}
              </Button>
            )}
          </Box>
        </Box>
        <Typography sx={{ fontSize: '12px', color: 'var(--muted)' }}>
          {t('settings.myProPayouts.accountHint')}
        </Typography>

        {onboardingError && (
          <Alert severity="error" sx={{ mt: 1.5, fontSize: '12.5px' }}>{onboardingError}</Alert>
        )}

        {/* Conteneur du composant Stripe embarqué — le pro reste dans Baitly. */}
        <Box
          ref={containerRef}
          sx={{ mt: onboardingOpen ? 2 : 0, minHeight: onboardingOpen ? 420 : 0, transition: 'min-height .2s' }}
        />
      </Paper>

      {/* ── Historique des versements ─────────────────────────────────────── */}
      <Paper sx={{ border: '1px solid var(--line)', boxShadow: 'none', borderRadius: '13px', overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
          <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)' }}>
            {t('settings.myProPayouts.historySection')}
          </Typography>
        </Box>
        {records.length === 0 ? (
          <Typography sx={{ px: 2.5, pb: 2.5, fontSize: '12.5px', color: 'var(--muted)', fontStyle: 'italic' }}>
            {t('settings.myProPayouts.noPayouts')}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('settings.myProPayouts.colDate')}</TableCell>
                  <TableCell>{t('settings.myProPayouts.colMission')}</TableCell>
                  <TableCell align="right">{t('settings.myProPayouts.colAmount')}</TableCell>
                  <TableCell align="right">{t('settings.myProPayouts.colCommission')}</TableCell>
                  <TableCell>{t('settings.myProPayouts.colStatus')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums', fontSize: '12.5px' }}>
                      {new Date(record.createdAt).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell sx={{ fontSize: '12.5px' }}>
                      <a href={`/interventions/${record.interventionId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        #{record.interventionId}
                      </a>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '12.5px' }}>
                      {record.amount} €
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: '12.5px', color: 'var(--muted)' }}>
                      {record.commissionAmount > 0 ? `−${record.commissionAmount} €` : '—'}
                    </TableCell>
                    <TableCell>
                      <Box component="span" sx={{
                        fontSize: '10.5px', fontWeight: 700, borderRadius: '7px', padding: '2px 7px',
                        color: STATUS_COLOR[record.status],
                        backgroundColor: `color-mix(in srgb, ${STATUS_COLOR[record.status]} 12%, transparent)`,
                        whiteSpace: 'nowrap',
                      }}>
                        {t(`settings.myProPayouts.status.${record.status}`)}
                        {record.status === 'BLOCKED' && record.failureReason
                          ? ` · ${t(`settings.myProPayouts.reason.${record.failureReason}`, record.failureReason)}`
                          : ''}
                      </Box>
                      {record.status === 'BLOCKED' && record.failureReason === 'PROOF_MISSING' && (
                        <Box sx={{ mt: 0.5 }}>
                          <a
                            href={`/interventions/${record.interventionId}`}
                            style={{ fontSize: '11.5px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                          >
                            {t('settings.myProPayouts.completeMission')}
                          </a>
                        </Box>
                      )}
                      {record.status === 'BLOCKED' && record.failureReason === 'ONBOARDING_INCOMPLETE' && (
                        <Box sx={{ mt: 0.5 }}>
                          <Box
                            component="button"
                            type="button"
                            onClick={() => document.getElementById('pro-onboarding')?.scrollIntoView({ behavior: 'smooth' })}
                            sx={{
                              background: 'none', border: 'none', p: 0, cursor: 'pointer',
                              fontSize: '11.5px', color: 'var(--accent)', fontWeight: 600, fontFamily: 'inherit',
                            }}
                          >
                            {t('settings.myProPayouts.finishOnboarding')}
                          </Box>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
