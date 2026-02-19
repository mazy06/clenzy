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
  useTheme,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Euro as EuroIcon,
  HourglassEmpty as HourglassIcon
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { extractApiList } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { interventionsKeys } from './useInterventionsList';

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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // ─── Couleurs Clenzy (theme-aware) ──────────────────────────────────────────
  const C = {
    primary: theme.palette.primary.main,
    primaryLight: isDark ? theme.palette.primary.light : '#8BA3B3',
    primaryDark: isDark ? theme.palette.primary.dark : '#5A7684',
    secondary: theme.palette.secondary.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    warningLight: isDark ? theme.palette.warning.light : '#E8C19A',
    error: theme.palette.error.main,
    info: theme.palette.info.main,
    textPrimary: theme.palette.text.primary,
    textSecondary: theme.palette.text.secondary,
    gray50: isDark ? theme.palette.grey[100] : '#F8FAFC',
    gray100: isDark ? theme.palette.grey[200] : '#F1F5F9',
    gray200: isDark ? theme.palette.grey[300] : '#E2E8F0',
    white: isDark ? theme.palette.background.paper : '#ffffff',
  };

  const [processingPayment, setProcessingPayment] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasAccess = isHost();

  // ─── React Query: list pending payment ─────────────────────────────────────

  const interventionsQuery = useQuery({
    queryKey: interventionsKeys.pendingPayment(),
    queryFn: async () => {
      const data = await interventionsApi.getAll({ status: 'AWAITING_PAYMENT' });
      const allInterventions = extractApiList<Intervention>(data);
      // Filter to current user's interventions
      const userFullName = user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
      return allInterventions.filter((intervention: Intervention) => {
        return intervention.requestorName === userFullName ||
               intervention.requestorName === user?.username ||
               intervention.requestorName === user?.email;
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

  const handlePay = async (intervention: Intervention) => {
    if (!intervention.estimatedCost || intervention.estimatedCost <= 0) {
      setError("Le cout estime n'est pas defini pour cette intervention");
      return;
    }

    try {
      setProcessingPayment(intervention.id);
      setError(null);

      const paymentData = await apiClient.post<{ url: string }>('/payments/create-session', {
        interventionId: intervention.id,
        amount: intervention.estimatedCost
      });

      window.location.href = paymentData.url;
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
      setProcessingPayment(null);
    }
  };

  const formatCost = (cost: number | null | undefined) => {
    if (cost === null || cost === undefined) return '--';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cost);
  };

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
        <CircularProgress sx={{ color: C.primary }} />
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
            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            onClick={loadInterventions}
            title={t('common.refresh')}
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              borderColor: C.gray200,
              color: C.textSecondary,
              '&:hover': { borderColor: C.primary, color: C.primary },
            }}
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
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Card sx={{ flex: '1 1 200px', borderLeft: `4px solid ${C.warning}` }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: `${C.warning}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HourglassIcon sx={{ fontSize: 20, color: C.warning }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.125rem', color: C.textPrimary, lineHeight: 1.2 }}>
                {interventions.length}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: C.textSecondary }}>
                Interventions en attente
              </Typography>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 200px', borderLeft: `4px solid ${C.error}` }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: `${C.error}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EuroIcon sx={{ fontSize: 20, color: C.error }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.125rem', color: C.textPrimary, lineHeight: 1.2 }}>
                {formatCost(totalDue)}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: C.textSecondary }}>
                Total a regler
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* ─── Tableau ───────────────────────────────────────────────────── */}
      {interventions.length === 0 ? (
        <Card sx={{ borderRadius: '12px' }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: `${C.success}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <PaymentIcon sx={{ fontSize: 28, color: C.success }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '0.9375rem', color: C.textPrimary, mb: 0.5 }}>
              Aucun paiement en attente
            </Typography>
            <Typography variant="body2" sx={{ color: C.textSecondary, fontSize: '0.8125rem' }}>
              Toutes vos interventions sont a jour.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(107,138,154,0.10)',
            '& .MuiTableHead-root': {
              bgcolor: C.gray50,
            },
            '& .MuiTableCell-head': {
              fontWeight: 600,
              fontSize: '0.75rem',
              color: C.textSecondary,
              borderBottom: `2px solid ${C.gray200}`,
              py: 1.25,
              whiteSpace: 'nowrap',
            },
            '& .MuiTableCell-body': {
              fontSize: '0.8125rem',
              color: C.textPrimary,
              py: 1.25,
              borderBottom: `1px solid ${C.gray100}`,
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
                    borderLeft: `3px solid ${C.warning}`,
                    transition: 'background-color 0.15s ease',
                    '&:hover': {
                      bgcolor: 'rgba(107,138,154,0.04)',
                    },
                  }}
                >
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', color: C.textPrimary }}>
                      {intervention.title}
                    </Typography>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: C.textPrimary }}>
                      {intervention.requestorName}
                    </Typography>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem' }}>
                      {intervention.propertyName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: C.textSecondary, fontSize: '0.6875rem' }}>
                      {intervention.propertyAddress}
                    </Typography>
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <Chip
                      label={getTypeLabel(intervention.type)}
                      size="small"
                      variant="outlined"
                      color="primary"
                      sx={{
                        fontSize: '0.6875rem',
                        height: 22,
                        fontWeight: 500,
                        borderWidth: 1.5,
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  </TableCell>
                  <TableCell onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                      {formatDate(intervention.scheduledDate)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" onClick={() => navigate(`/interventions/${intervention.id}`)}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.875rem', color: C.warning }}>
                      {formatCost(intervention.estimatedCost)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <Tooltip title="Voir les details">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); navigate(`/interventions/${intervention.id}`); }}
                          sx={{ color: C.textSecondary, '&:hover': { color: C.primary } }}
                        >
                          <VisibilityIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={processingPayment === intervention.id ? <CircularProgress size={14} color="inherit" /> : <PaymentIcon sx={{ fontSize: 16 }} />}
                        onClick={(e) => { e.stopPropagation(); handlePay(intervention); }}
                        disabled={processingPayment === intervention.id || !intervention.estimatedCost}
                        sx={{
                          bgcolor: C.primary,
                          color: C.white,
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          px: 1.5,
                          py: 0.5,
                          boxShadow: '0 1px 3px rgba(107,138,154,0.3)',
                          '&:hover': { bgcolor: C.primaryDark },
                          '&:disabled': { bgcolor: C.primaryLight, color: C.white, opacity: 0.6 },
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
    </Box>
  );
};

export default InterventionsPendingPayment;
