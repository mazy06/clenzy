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
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Payment as PaymentIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Euro as EuroIcon
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
  estimatedCost: number;
  createdAt: string;
}

const InterventionsPendingPayment: React.FC = () => {
  const { user, isHost } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState<number | null>(null);

  useEffect(() => {
    if (!isHost()) {
      setError('Vous n\'avez pas accès à cette page');
      setLoading(false);
      return;
    }
    loadInterventions();
  }, [isHost]);

  const loadInterventions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions?status=AWAITING_PAYMENT`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Le backend devrait déjà filtrer, mais on s'assure que ce sont bien les interventions du propriétaire
        const allInterventions = data.content || data;
        // Filtrer pour ne garder que les interventions du propriétaire connecté
        const userInterventions = allInterventions.filter((intervention: Intervention) => {
          const userFullName = user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
          return intervention.requestorName === userFullName ||
                 intervention.requestorName === user?.username ||
                 intervention.requestorName === user?.email;
        });
        setInterventions(userInterventions);
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

  const handlePay = async (intervention: Intervention) => {
    if (!intervention.estimatedCost || intervention.estimatedCost <= 0) {
      setError('Le coût estimé n\'est pas défini pour cette intervention');
      return;
    }

    try {
      setProcessingPayment(intervention.id);
      setError(null);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/payments/create-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          interventionId: intervention.id,
          amount: intervention.estimatedCost
        })
      });

      if (response.ok) {
        const paymentData = await response.json();
        // Rediriger vers Stripe Checkout
        window.location.href = paymentData.url;
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de la création de la session de paiement');
        setProcessingPayment(null);
      }
    } catch (err) {
      console.error('Erreur paiement:', err);
      setError('Erreur de connexion');
      setProcessingPayment(null);
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
        title={t('interventions.pendingPayment.title')}
        subtitle={t('interventions.pendingPayment.subtitle')}
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
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {interventions.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary">
              {t('interventions.pendingPayment.noInterventions')}
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
                <TableCell>{t('interventions.fields.type')}</TableCell>
                <TableCell>{t('interventions.fields.scheduledDate')}</TableCell>
                <TableCell>{t('interventions.fields.estimatedCost')}</TableCell>
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
                  <TableCell>
                    <Chip label={intervention.type} size="small" />
                  </TableCell>
                  <TableCell>
                    {intervention.scheduledDate 
                      ? new Date(intervention.scheduledDate).toLocaleDateString('fr-FR')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EuroIcon fontSize="small" color="primary" />
                      <Typography variant="body2" fontWeight={600}>
                        {intervention.estimatedCost?.toFixed(2) || '-'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={t('interventions.pendingPayment.viewDetails')}>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/interventions/${intervention.id}`)}
                        sx={{ mr: 1 }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={processingPayment === intervention.id ? <CircularProgress size={16} /> : <PaymentIcon />}
                      onClick={() => handlePay(intervention)}
                      disabled={processingPayment === intervention.id || !intervention.estimatedCost}
                    >
                      {processingPayment === intervention.id 
                        ? t('common.loading') 
                        : t('interventions.pendingPayment.pay')}
                    </Button>
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
