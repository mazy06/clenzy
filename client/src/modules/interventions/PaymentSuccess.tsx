import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Card, CardContent, CircularProgress, Alert } from '@mui/material';
import { CheckCircle, ArrowBack } from '@mui/icons-material';
import { paymentsApi } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setError('Session ID manquant');
      setLoading(false);
      return;
    }

    // Vérifier le statut de la session après un court délai pour laisser le webhook se traiter
    const checkPaymentStatus = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2 secondes

        await paymentsApi.getSessionStatus(sessionId);
        setLoading(false);
      } catch (err) {
        setError('Erreur lors de la vérification du paiement');
        setLoading(false);
      }
    };

    checkPaymentStatus();
  }, [sessionId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Card>
        <CardContent sx={{ textAlign: 'center', p: 4 }}>
          {error ? (
            <>
              <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
              <Button
                variant="contained"
                startIcon={<ArrowBack />}
                onClick={() => navigate('/interventions')}
              >
                Retour aux interventions
              </Button>
            </>
          ) : (
            <>
              <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
              <Typography variant="h4" gutterBottom>
                Paiement réussi !
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Votre paiement a été traité avec succès. L'intervention peut maintenant avoir lieu.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/interventions')}
              >
                Voir mes interventions
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaymentSuccess;
