import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  LinearProgress,
} from '@mui/material';
import { CheckCircle, ArrowBack, HourglassTop, ErrorOutline } from "../../icons";
import { paymentsApi } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';

const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 2000;

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sessionId = searchParams.get('session_id');
  const pollingRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setError('Session ID manquant');
      setLoading(false);
      return;
    }

    // Eviter les doubles appels (StrictMode)
    if (pollingRef.current) return;
    pollingRef.current = true;

    const checkPaymentStatus = async () => {
      let currentAttempt = 0;

      while (currentAttempt < MAX_ATTEMPTS) {
        currentAttempt++;
        setAttempt(currentAttempt);

        // Attendre entre chaque tentative
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

        try {
          const result = await paymentsApi.getSessionStatus(sessionId);

          if (result.paymentStatus === 'PAID') {
            setPaymentConfirmed(true);
            setLoading(false);
            return;
          }

          if (result.paymentStatus === 'FAILED') {
            setError('Le paiement a echoue. Veuillez reessayer.');
            setLoading(false);
            return;
          }

          // Encore en PROCESSING → continuer le polling
        } catch {
          // Erreur réseau → continuer le polling
        }
      }

      // Toutes les tentatives épuisées — le backend a dû appeler Stripe en fallback
      // Si on arrive ici, le paiement est probablement confirmé côté Stripe mais la réponse
      // n'a pas renvoyé PAID. On affiche un message de succès conditionnel.
      setPaymentConfirmed(false);
      setLoading(false);
    };

    checkPaymentStatus();
  }, [sessionId]);

  if (loading) {
    return (
      <Box sx={{ maxWidth: 500, mx: 'auto', mt: 6 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main', mb: 2, animation: 'spin 2s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }}>
              <HourglassTop size={56} strokeWidth={1.75} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              Verification du paiement...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Confirmation en cours aupres de Stripe ({attempt}/{MAX_ATTEMPTS})
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(attempt / MAX_ATTEMPTS) * 100}
              sx={{ borderRadius: 1, height: 6 }}
            />
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto', mt: 6 }}>
      <Card>
        <CardContent sx={{ textAlign: 'center', p: 4 }}>
          {error ? (
            <>
              <Box component="span" sx={{ display: "inline-flex", color: "error.main", mb: 2 }}><ErrorOutline size={64} strokeWidth={1.5} /></Box>
              <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
              <Button
                variant="contained"
                startIcon={<ArrowBack size={18} strokeWidth={1.75} />}
                onClick={() => navigate('/billing')}
              >
                Retour a la facturation
              </Button>
            </>
          ) : paymentConfirmed ? (
            <>
              <Box component="span" sx={{ display: "inline-flex", color: "success.main", mb: 2 }}><CheckCircle size={80} strokeWidth={1.5} /></Box>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                Paiement reussi !
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Votre paiement a ete traite avec succes. Le statut sera mis a jour automatiquement.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/billing')}
              >
                Voir la facturation
              </Button>
            </>
          ) : (
            <>
              <Box component="span" sx={{ display: "inline-flex", color: "warning.main", mb: 2 }}><CheckCircle size={80} strokeWidth={1.5} /></Box>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
                Paiement en cours de traitement
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                Votre paiement a bien ete envoye a Stripe. La confirmation peut prendre quelques instants.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Le statut sera mis a jour automatiquement.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/billing')}
              >
                Voir la facturation
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaymentSuccess;
