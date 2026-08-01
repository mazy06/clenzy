import React, { useState, useMemo } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card, CardContent, Button, IconButton, Tooltip } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import {
  Payment as PaymentIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Euro as EuroIcon,
  HourglassEmpty as HourglassIcon
} from '../../icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi } from '../../services/api/interventionsApi';
import { extractApiList } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import PaymentCheckoutModal from '../../components/PaymentCheckoutModal';
import StatTile from '../../components/StatTile';
import { interventionsKeys } from './useInterventionsList';
import { Money } from '../../components/Money';
import { getTypeTokens } from './interventionUtils';

// Couleurs sémantiques Signature (hex requis par StatTile/alpha — valeurs tokens.css)
const WARN_HEX = '#C28A52';
const ERR_HEX = '#C97A7A';

interface Intervention {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyType?: string;
  propertyName: string;
  propertyAddress: string;
  requestorId?: number;
  requestorName: string;
  scheduledDate: string;
  estimatedDurationHours: number;
  estimatedCost: number;
  createdAt: string;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '--';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    CLEANING: 'Menage',
    DEEP_CLEANING: 'Menage complet',
    MAINTENANCE: 'Maintenance',
    REPAIR: 'Reparation',
    INSPECTION: 'Inspection',
  };
  return labels[type] || type;
};

const InterventionsPendingPayment: React.FC = () => {
  const { user, isHost } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [processingPayment, setProcessingPayment] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<Intervention | null>(null);

  const hasAccess = isHost();

  // ─── React Query: list pending payment ─────────────────────────────────────

  const interventionsQuery = useQuery({
    queryKey: interventionsKeys.pendingPayment(),
    queryFn: async () => {
      const data = await interventionsApi.getAll({ status: 'AWAITING_PAYMENT' });
      const allInterventions = extractApiList<Intervention>(data);
      // Filter to current user's interventions
      return allInterventions.filter((intervention: Intervention) => {
        // Primary: match by database ID (reliable)
        if (user?.databaseId && intervention.requestorId) {
          return intervention.requestorId === user.databaseId;
        }
        // Fallback: match by name (legacy, for interventions without requestorId)
        const userFullName = user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
        return intervention.requestorName === userFullName;
      });
    },
    enabled: hasAccess,
    staleTime: 30_000,
  });

  const interventions = useMemo(() => interventionsQuery.data ?? [], [interventionsQuery.data]);
  const loading = interventionsQuery.isLoading;

  const loadInterventions = () => {
    queryClient.invalidateQueries({ queryKey: interventionsKeys.pendingPayment() });
  };

  const handlePay = (intervention: Intervention) => {
    if (!intervention.estimatedCost || intervention.estimatedCost <= 0) {
      setError("Le cout estime n'est pas defini pour cette intervention");
      return;
    }
    setError(null);
    setPaymentTarget(intervention);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentModalOpen(false);
    setPaymentTarget(null);
    setProcessingPayment(null);
    loadInterventions(); // Recharger la liste apres paiement
  };

  // Total a payer
  const totalDue = useMemo(
    () => interventions.reduce((sum, i) => sum + (i.estimatedCost || 0), 0),
    [interventions],
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner className="size-10 text-[var(--accent)]" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div>
        <BuiAlert variant="destructive">
          <TriangleAlert />
          <AlertDescription>Vous n'avez pas acces a cette page</AlertDescription>
        </BuiAlert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('interventions.pendingPayment.title')}
        subtitle={t('interventions.pendingPayment.subtitle')}
        backPath="/dashboard"
        showBackButton={true}
        actions={
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon size={16} strokeWidth={1.75} />}
            onClick={loadInterventions}
            title={t('common.refresh')}
            sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
          >
            {t('common.refresh')}
          </Button>
        }
      />

      {error && (
        <BuiAlert variant="destructive" className="mb-3 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {/* ─── Resume en haut ────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(2,_minmax(200px,_280px))] gap-[9px] mb-3">
        <StatTile
          icon={<HourglassIcon size={16} strokeWidth={1.75} />}
          label="Interventions en attente"
          value={interventions.length}
          color={WARN_HEX}
        />
        <StatTile
          icon={<EuroIcon size={16} strokeWidth={1.75} />}
          label="Total a regler"
          value={<Money value={totalDue} from="EUR" />}
          color={ERR_HEX}
        />
      </div>

      {/* ─── Tableau ───────────────────────────────────────────────────── */}
      {interventions.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <div className="w-[56px] h-[56px] rounded-[50%] bg-[var(--ok-soft)] text-[var(--ok)] flex items-center justify-center mx-auto mb-3">
              <PaymentIcon size={28} strokeWidth={1.5} />
            </div>
            <h6 className="cn-text-h6 font-semibold text-[0.9375rem] text-[var(--ink)] mb-0.5">
              Aucun paiement en attente
            </h6>
            <p className="cn-text-body2 text-[var(--muted)] text-[0.8125rem]">
              Toutes vos interventions sont a jour.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-solid border-[var(--line)] bg-[var(--card)]">
          <Table>
            {/* Fond --surface-2 : seul ecart de l'ancien sx vis-a-vis du primitif. */}
            <TableHeader className="bg-[var(--surface-2)]">
              <TableRow>
                <TableHead>Intervention</TableHead>
                <TableHead>Demandeur</TableHead>
                <TableHead>Logement</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date prevue</TableHead>
                <TableHead className="text-end">Montant</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interventions.map((intervention) => (
                <TableRow key={intervention.id} className="cursor-pointer">
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <p className="cn-text-body2 font-semibold text-[0.8125rem] text-[var(--ink)]">
                      {intervention.title}
                    </p>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <p className="cn-text-body2 text-[0.8125rem] text-[var(--body)]">
                      {intervention.requestorName}
                    </p>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <p className="cn-text-body2 font-medium text-[0.8125rem]">
                      {intervention.propertyName}
                    </p>
                    <span className="cn-text-caption text-[var(--muted)] text-[0.6875rem]">
                      {intervention.propertyAddress}
                    </span>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    {(() => { const tk = getTypeTokens(intervention.type); return (
                      <StatusChip tokens={{ color: tk.color, bg: tk.bg }} label={getTypeLabel(intervention.type)} />
                    ); })()}
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <p className="cn-text-body2 text-[0.8125rem]">
                      {formatDate(intervention.scheduledDate)}
                    </p>
                  </TableCell>
                  <TableCell className="text-end" onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <p className="cn-text-body2 font-semibold text-[0.875rem] text-[var(--warn)] font-[family-name:var(--font-display)] tabular-nums">
                      <Money value={intervention.estimatedCost} from="EUR" />
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <Tooltip title="Voir les details">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); navigate(`/interventions/${intervention.id}`); }}
                          sx={{ color: 'var(--muted)', '&:hover': { color: 'var(--ink)', backgroundColor: 'var(--hover)' } }}
                        >
                          <VisibilityIcon size={18} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={processingPayment === intervention.id ? <Spinner className="size-3.5" /> : <PaymentIcon size={16} strokeWidth={1.75} />}
                        onClick={(e) => { e.stopPropagation(); handlePay(intervention); }}
                        disabled={processingPayment === intervention.id || !intervention.estimatedCost}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          px: 1.5,
                          py: 0.5,
                        }}
                      >
                        {processingPayment === intervention.id ? 'Chargement...' : 'Payer'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal de paiement Stripe Embedded */}
      {paymentTarget && (
        <PaymentCheckoutModal
          open={paymentModalOpen}
          onClose={() => { setPaymentModalOpen(false); setPaymentTarget(null); setProcessingPayment(null); }}
          onSuccess={handlePaymentSuccess}
          interventionId={paymentTarget.id}
          amount={paymentTarget.estimatedCost}
          interventionTitle={paymentTarget.title}
        />
      )}
    </div>
  );
};

export default InterventionsPendingPayment;
