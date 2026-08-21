import React, { useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Button } from '../../components/ui';
import { Skeleton } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
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

/**
 * Statut du versement → variante de `Badge`. Les couleurs ne sont plus
 * calculees a l'execution : chaque variante porte deja le couple fond doux /
 * encre `-ink` conforme AA du kit Baitly UI.
 */
const STATUS_BADGE: Record<HousekeeperPayoutRecord['status'], React.ComponentProps<typeof Badge>['variant']> = {
  SENT: 'success',
  PENDING: 'warning',
  FAILED: 'destructive',
  BLOCKED: 'secondary',
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
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[140px] w-full rounded-[13px]" />
        <Skeleton className="h-[220px] w-full rounded-[13px]" />
      </div>
    );
  }
  if (payoutsQuery.isError) {
    return <Alert variant="destructive">
      <TriangleAlert />
      <AlertDescription>{t('settings.myProPayouts.loadError')}</AlertDescription>
    </Alert>;
  }

  const statusChip = data?.onboardingCompleted ? (
    <StatusChip tone="ok" label={t('settings.myProPayouts.statusComplete')} icon={<CheckCircle size={13} strokeWidth={2} />} />
  ) : data?.accountCreated ? (
    <Badge variant="secondary" className="font-semibold">{t('settings.myProPayouts.statusInProgress')}</Badge>
  ) : (
    <Badge variant="secondary" className="font-semibold">{t('settings.myProPayouts.statusNotStarted')}</Badge>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* ── Compte de versement (onboarding embarqué) ─────────────────────── */}
      <Card className="gap-0 py-0 p-3.5" id="pro-onboarding">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="inline-flex text-primary">
            <AccountBalance size={18} strokeWidth={1.75} />
          </span>
          <p className="text-sm font-semibold text-foreground">
            {t('settings.myProPayouts.accountSection')}
          </p>
          {statusChip}
          <div className="ms-auto flex gap-1.5">
            {data?.accountCreated && !data?.onboardingCompleted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
              >
                {refreshMutation.isPending ? <Spinner className="size-3.5" /> : <Refresh size={14} strokeWidth={1.75} />}
                {t('settings.myProPayouts.refreshStatus')}
              </Button>
            )}
            {!data?.onboardingCompleted && (
              <Button
                variant="secondary"
                size="sm"
                onClick={startOnboarding}
                disabled={initializing || onboardingOpen}
              >
                {initializing ? <Spinner className="size-3.5" /> : null}
                {data?.accountCreated
                  ? t('settings.myProPayouts.resumeOnboarding')
                  : t('settings.myProPayouts.startOnboarding')}
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('settings.myProPayouts.accountHint')}
        </p>

        {onboardingError && (
          <Alert variant="destructive" className="mt-2 text-[12.5px]">
            <TriangleAlert />
            <AlertDescription>{onboardingError}</AlertDescription>
          </Alert>
        )}

        {/* Conteneur du composant Stripe embarqué — le pro reste dans Baitly. */}
        <div className={cn(onboardingOpen ? 'mt-3' : 'mt-0', onboardingOpen ? 'min-h-[420px]' : 'min-h-0')} style={{ transition: 'min-height .2s' }} ref={containerRef} />
      </Card>

      {/* ── Historique des versements ─────────────────────────────────────── */}
      <Card className="gap-0 py-0 overflow-hidden">
        <div className="px-3.5 pt-3 pb-1.5">
          <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-faint">
            {t('settings.myProPayouts.historySection')}
          </p>
        </div>
        {records.length === 0 ? (
          <p className="px-3.5 pb-3.5 text-xs italic text-muted-foreground">
            {t('settings.myProPayouts.noPayouts')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('settings.myProPayouts.colDate')}</TableHead>
                  <TableHead>{t('settings.myProPayouts.colMission')}</TableHead>
                  <TableHead className="text-end">{t('settings.myProPayouts.colAmount')}</TableHead>
                  <TableHead className="text-end">{t('settings.myProPayouts.colCommission')}</TableHead>
                  <TableHead>{t('settings.myProPayouts.colStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Le filet de la derniere ligne est deja retire par le primitif. */}
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="tabular-nums">
                      {new Date(record.createdAt).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <a
                        href={`/interventions/${record.interventionId}`}
                        className="font-medium text-primary no-underline hover:underline"
                      >
                        #{record.interventionId}
                      </a>
                    </TableCell>
                    <TableCell className="text-end tabular-nums font-semibold">
                      {record.amount} €
                    </TableCell>
                    <TableCell className="text-end tabular-nums text-muted-foreground">
                      {record.commissionAmount > 0 ? `−${record.commissionAmount} €` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[record.status]} className="font-semibold">
                        {t(`settings.myProPayouts.status.${record.status}`)}
                        {record.status === 'BLOCKED' && record.failureReason
                          ? ` · ${t(`settings.myProPayouts.reason.${record.failureReason}`, record.failureReason)}`
                          : ''}
                      </Badge>
                      {record.status === 'BLOCKED' && record.failureReason === 'PROOF_MISSING' && (
                        <div className="mt-0.5">
                          <a
                            href={`/interventions/${record.interventionId}`}
                            className="text-xs font-semibold text-primary no-underline hover:underline"
                          >
                            {t('settings.myProPayouts.completeMission')}
                          </a>
                        </div>
                      )}
                      {record.status === 'BLOCKED' && record.failureReason === 'ONBOARDING_INCOMPLETE' && (
                        <div className="mt-0.5">
                          <Button
                            variant="link"
                            size="xs"
                            type="button"
                            className="h-auto p-0 text-xs font-semibold"
                            onClick={() => document.getElementById('pro-onboarding')?.scrollIntoView({ behavior: 'smooth' })}
                          >
                            {t('settings.myProPayouts.finishOnboarding')}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
