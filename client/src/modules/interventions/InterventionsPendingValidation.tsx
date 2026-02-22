import React, { useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  createdAt: string;
}

const InterventionsPendingValidation: React.FC = () => {
  const { isManager, isAdmin } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // UI state
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const hasAccess = isManager() || isAdmin();

  // ─── React Query: list pending validation ──────────────────────────────────

  const interventionsQuery = useQuery({
    queryKey: interventionsKeys.pendingValidation(),
    queryFn: async () => {
      const data = await interventionsApi.getAll({ status: 'AWAITING_VALIDATION' });
      return extractApiList<Intervention>(data);
    },
    enabled: hasAccess,
    staleTime: 30_000,
  });

  const interventions = interventionsQuery.data ?? [];
  const loading = interventionsQuery.isLoading;
  const error = interventionsQuery.isError
    ? 'Erreur de connexion'
    : (!hasAccess ? 'Vous n\'avez pas accès à cette page' : null);

  // ─── Mutation: validate intervention ───────────────────────────────────────

  const validateMutation = useMutation({
    mutationFn: ({ interventionId, cost }: { interventionId: number; cost: number }) =>
      apiClient.post(`/interventions/${interventionId}/validate`, { estimatedCost: cost }),
    onSuccess: () => {
      handleCloseValidationDialog();
      queryClient.invalidateQueries({ queryKey: interventionsKeys.all });
    },
    onError: (err: Error) => {
      setValidationError(err.message || 'Erreur de connexion');
    },
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const loadInterventions = () => {
    queryClient.invalidateQueries({ queryKey: interventionsKeys.pendingValidation() });
  };

  const handleOpenValidationDialog = (intervention: Intervention) => {
    setSelectedIntervention(intervention);
    setEstimatedCost('');
    setValidationError(null);
    setValidationDialogOpen(true);
  };

  const handleCloseValidationDialog = () => {
    setValidationDialogOpen(false);
    setSelectedIntervention(null);
    setEstimatedCost('');
    setValidationError(null);
  };

  const handleValidate = () => {
    if (!selectedIntervention) return;

    const cost = parseFloat(estimatedCost);
    if (isNaN(cost) || cost <= 0) {
      setValidationError('Veuillez entrer un montant valide');
      return;
    }

    setValidationError(null);
    validateMutation.mutate({ interventionId: selectedIntervention.id, cost });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={t('interventions.pendingValidation.title')}
        subtitle={t('interventions.pendingValidation.subtitle')}
        backPath="/interventions"
        showBackButton={true}
        actions={
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={loadInterventions}
            title={t('common.refresh')}
          >
            {t('common.refresh')}
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {interventions.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary">
              {t('interventions.pendingValidation.noInterventions')}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('interventions.fields.title')}</TableCell>
                <TableCell>{t('interventions.fields.property')}</TableCell>
                <TableCell>{t('interventions.fields.requestor')}</TableCell>
                <TableCell>{t('interventions.fields.type')}</TableCell>
                <TableCell>{t('interventions.fields.scheduledDate')}</TableCell>
                <TableCell>{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {interventions.map((intervention) => (
                <TableRow key={intervention.id}>
                  <TableCell>{intervention.title}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {intervention.propertyName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {intervention.propertyAddress}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{intervention.requestorName}</TableCell>
                  <TableCell>
                    <Chip label={intervention.type} size="small" />
                  </TableCell>
                  <TableCell>
                    {intervention.scheduledDate
                      ? new Date(intervention.scheduledDate).toLocaleDateString('fr-FR')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={t('interventions.pendingValidation.viewDetails')}>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/interventions/${intervention.id}`)}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('interventions.pendingValidation.validate')}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenValidationDialog(intervention)}
                      >
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog de validation */}
      <Dialog open={validationDialogOpen} onClose={handleCloseValidationDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t('interventions.pendingValidation.validateDialog.title')}
        </DialogTitle>
        <DialogContent>
          {selectedIntervention && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('interventions.pendingValidation.validateDialog.intervention')}: {selectedIntervention.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('interventions.fields.property')}: {selectedIntervention.propertyName}
              </Typography>
            </Box>
          )}

          <TextField
            fullWidth
            label={t('interventions.fields.estimatedCost')}
            type="number"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            error={!!validationError}
            helperText={validationError}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseValidationDialog} disabled={validateMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleValidate}
            variant="contained"
            disabled={validateMutation.isPending || !estimatedCost}
            startIcon={validateMutation.isPending ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            {validateMutation.isPending ? t('common.loading') : t('interventions.pendingValidation.validate')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InterventionsPendingValidation;
