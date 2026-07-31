import React, { useEffect, useState, useRef } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, CircularProgress, LinearProgress } from '@mui/material';
import { CheckCircle, ArrowBack, HourglassTop, ErrorOutline } from "../../icons";
import { paymentsApi } from '../../services/api/paymentsApi';
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
      <div className="max-w-[500px] mx-auto mt-9">
        <Card>
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mb: 2, animation: 'spin 2s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
              <HourglassTop size={56} strokeWidth={1.75} />
            </Box>
            <h5 className="cn-text-h5 font-semibold mb-1.5">
              Verification du paiement...
            </h5>
            <p className="cn-text-body2 text-muted-foreground mb-4">
              Confirmation en cours aupres de Stripe ({attempt}/{MAX_ATTEMPTS})
            </p>
            <LinearProgress
              variant="determinate"
              value={(attempt / MAX_ATTEMPTS) * 100}
              sx={{ borderRadius: 1, height: 6 }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[500px] mx-auto mt-9">
      <Card>
        <CardContent sx={{ textAlign: 'center', p: 4 }}>
          {error ? (
            <>
              <span className="inline-flex text-[var(--err)] mb-3"><ErrorOutline size={64} strokeWidth={1.5} /></span>
              <Alert variant="destructive" className="mb-4">
                <TriangleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
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
              <span className="inline-flex text-[var(--ok)] mb-3"><CheckCircle size={80} strokeWidth={1.5} /></span>
              <h4 className="cn-text-h4 mb-[0.35em] font-bold">
                Paiement reussi !
              </h4>
              <p className="cn-text-body1 text-muted-foreground mb-4">
                Votre paiement a ete traite avec succes. Le statut sera mis a jour automatiquement.
              </p>
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
              <span className="inline-flex text-[var(--warn)] mb-3"><CheckCircle size={80} strokeWidth={1.5} /></span>
              <h5 className="cn-text-h5 mb-[0.35em] font-bold">
                Paiement en cours de traitement
              </h5>
              <p className="cn-text-body1 text-muted-foreground mb-1.5">
                Votre paiement a bien ete envoye a Stripe. La confirmation peut prendre quelques instants.
              </p>
              <p className="cn-text-body2 text-muted-foreground mb-4">
                Le statut sera mis a jour automatiquement.
              </p>
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
    </div>
  );
};

export default PaymentSuccess;
