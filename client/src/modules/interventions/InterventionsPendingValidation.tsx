import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
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
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import { useTranslation } from '../../hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';

interface Intervention {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyName: string;
  propertyAddress: string;
  requestorName: string;
  scheduledDate: string;
  estimatedDurationHours: number;
  createdAt: string;
}

const InterventionsPendingValidation: React.FC = () => {
  const { user, isManager, isAdmin } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<string>('');
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isManager() && !isAdmin()) {
      setError('Vous n\'avez pas accès à cette page');
      setLoading(false);
      return;
    }
    loadInterventions();
  }, [isManager, isAdmin]);

  const loadInterventions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions?status=AWAITING_VALIDATION`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInterventions(data.content || data);
      } else {
        setError('Erreur lors du chargement des interventions');
      }
    } catch (err) {
      console.error('Erreur chargement interventions:', err);
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
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

  const handleValidate = async () => {
    if (!selectedIntervention) return;
    
    const cost = parseFloat(estimatedCost);
    if (isNaN(cost) || cost <= 0) {
      setValidationError('Veuillez entrer un montant valide');
      return;
    }

    try {
      setValidating(true);
      setValidationError(null);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${selectedIntervention.id}/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          estimatedCost: cost
        })
      });

      if (response.ok) {
        handleCloseValidationDialog();
        loadInterventions(); // Recharger la liste
      } else {
        const errorData = await response.json();
        setValidationError(errorData.message || 'Erreur lors de la validation');
      }
    } catch (err) {
      console.error('Erreur validation:', err);
      setValidationError('Erreur de connexion');
    } finally {
      setValidating(false);
    }
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
            startIcon={<RefreshIcon />}
            onClick={loadInterventions}
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
          <Button onClick={handleCloseValidationDialog} disabled={validating}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleValidate}
            variant="contained"
            disabled={validating || !estimatedCost}
            startIcon={validating ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            {validating ? t('common.loading') : t('interventions.pendingValidation.validate')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InterventionsPendingValidation;
