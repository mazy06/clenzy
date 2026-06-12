import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Euro as EuroIcon,
  HourglassEmpty as HourglassIcon
} from '../../icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi } from '../../services/api';
import { extractApiList } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import PaymentCheckoutModal from '../../components/PaymentCheckoutModal';
import StatTile from '../../components/StatTile';
import { interventionsKeys } from './useInterventionsList';
import { formatCurrency } from '../../utils/currencyUtils';
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

  const interventions = interventionsQuery.data ?? [];
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

  const formatCost = (cost: number | null | undefined) => formatCurrency(cost);

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

  // Total a payer
  const totalDue = useMemo(
    () => interventions.reduce((sum, i) => sum + (i.estimatedCost || 0), 0),
    [interventions],
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress sx={{ color: 'var(--accent)' }} />
      </Box>
    );
  }

  if (!hasAccess) {
    return (
      <Box>
        <Alert severity="error">Vous n'avez pas acces a cette page</Alert>
      </Box>
    );
  }

  return (
    <Box>
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
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: '8px', fontSize: '0.8125rem' }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* ─── Resume en haut ────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(200px, 280px))' }, gap: 1.5, mb: 2 }}>
        <StatTile
          icon={<HourglassIcon size={16} strokeWidth={1.75} />}
          label="Interventions en attente"
          value={interventions.length}
          color={WARN_HEX}
        />
        <StatTile
          icon={<EuroIcon size={16} strokeWidth={1.75} />}
          label="Total a regler"
          value={formatCost(totalDue)}
          color={ERR_HEX}
        />
      </Box>

      {/* ─── Tableau ───────────────────────────────────────────────────── */}
      {interventions.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'var(--ok-soft)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <PaymentIcon size={28} strokeWidth={1.5} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--ink)', mb: 0.5 }}>
              Aucun paiement en attente
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
              Toutes vos interventions sont a jour.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            borderRadius: '14px',
            boxShadow: 'none',
            border: '1px solid var(--line)',
            '& .MuiTableHead-root': {
              bgcolor: 'var(--surface-2)',
            },
            '& .MuiTableCell-head': {
              fontWeight: 700,
              fontSize: '0.65625rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--faint)',
              borderBottom: '1px solid var(--line)',
              py: 1.25,
              whiteSpace: 'nowrap',
            },
            '& .MuiTableCell-body': {
              fontSize: '0.8125rem',
              color: 'var(--ink)',
              py: 1.25,
              borderBottom: '1px solid var(--line)',
            },
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Intervention</TableCell>
                <TableCell>Demandeur</TableCell>
                <TableCell>Logement</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Date prevue</TableCell>
                <TableCell align="right">Montant</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {interventions.map((intervention) => (
                <TableRow
                  key={intervention.id}
                  sx={{
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    '&:hover': {
                      bgcolor: 'var(--hover)',
                    },
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  }}
                >
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--ink)' }}>
                      {intervention.title}
                    </Typography>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'var(--body)' }}>
                      {intervention.requestorName}
                    </Typography>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem' }}>
                      {intervention.propertyName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--muted)', fontSize: '0.6875rem' }}>
                      {intervention.propertyAddress}
                    </Typography>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    {(() => { const tk = getTypeTokens(intervention.type); return (
                      <Chip
                        label={getTypeLabel(intervention.type)}
                        size="small"
                        sx={{
                          fontSize: '0.6875rem',
                          height: 22,
                          fontWeight: 600,
                          backgroundColor: tk.bg,
                          color: tk.color,
                          borderRadius: '6px',
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    ); })()}
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                      {formatDate(intervention.scheduledDate)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--warn)', fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCost(intervention.estimatedCost)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
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
                        startIcon={processingPayment === intervention.id ? <CircularProgress size={14} color="inherit" /> : <PaymentIcon size={16} strokeWidth={1.75} />}
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
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
    </Box>
  );
};

export default InterventionsPendingPayment;
