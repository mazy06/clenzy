import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import { MarkEmailRead, ErrorOutline, Send as SendIcon } from '@mui/icons-material';
import lightTheme from '../../theme/theme';
import ClenzyAnimatedLogo from '../../components/ClenzyAnimatedLogo';
import apiClient from '../../services/apiClient';

export default function InscriptionSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Recuperer l'email depuis le sessionStorage (stocke a l'inscription)
  const inscriptionEmail = sessionStorage.getItem('inscription_email') || '';

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    // Le webhook Stripe s'occupe de confirmer le paiement et d'envoyer l'email.
    // On attend un court instant puis on affiche la page "verifiez vos emails".
    const timer = setTimeout(() => {
      setStatus('success');
    }, 2000);

    return () => clearTimeout(timer);
  }, [sessionId]);

  const handleResend = async () => {
    if (!inscriptionEmail) {
      setResendMessage('Impossible de renvoyer sans adresse email.');
      return;
    }
    setResending(true);
    setResendMessage(null);
    try {
      await apiClient.post('/public/inscription/resend-confirmation', {
        email: inscriptionEmail,
      }, { skipAuth: true });
      setResendMessage('Un nouveau lien de confirmation a ete envoye.');
    } catch {
      setResendMessage('Un nouveau lien de confirmation a ete envoye.');
    } finally {
      setResending(false);
    }
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #A6C0CE 0%, #8BA3B3 50%, #6B8A9A 100%)',
        p: 2,
      }}>
        <Paper elevation={8} sx={{
          p: { xs: 3, sm: 4 },
          width: '100%',
          maxWidth: 480,
          borderRadius: 3,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          textAlign: 'center',
        }}>
          {/* Logo */}
          <Box sx={{ mb: 2 }}>
            <ClenzyAnimatedLogo scale={1.1} />
          </Box>

          {status === 'loading' && (
            <Box sx={{ py: 4 }}>
              <CircularProgress sx={{ color: '#6B8A9A', mb: 2 }} />
              <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                Finalisation de votre paiement...
              </Typography>
            </Box>
          )}

          {status === 'success' && (
            <Box sx={{ py: 3 }}>
              <MarkEmailRead sx={{
                fontSize: 72,
                color: '#6B8A9A',
                mb: 2,
                animation: 'scaleIn 0.4s ease-out',
                '@keyframes scaleIn': {
                  '0%': { transform: 'scale(0)', opacity: 0 },
                  '60%': { transform: 'scale(1.15)' },
                  '100%': { transform: 'scale(1)', opacity: 1 },
                },
              }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
                Verifiez votre boite email
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                Votre paiement a ete confirme avec succes.
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Un email de confirmation a ete envoye{inscriptionEmail ? ` a ${inscriptionEmail}` : ''}.
                Cliquez sur le lien dans l'email pour creer votre mot de passe et finaliser votre inscription.
              </Typography>

              {resendMessage && (
                <Alert severity="success" sx={{ mb: 2, textAlign: 'left' }}>
                  {resendMessage}
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                startIcon={resending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                onClick={handleResend}
                disabled={resending}
                sx={{
                  px: 4,
                  py: 1.25,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  backgroundColor: '#6B8A9A',
                  '&:hover': { backgroundColor: '#5A7684' },
                  borderRadius: 2,
                  boxShadow: '0 4px 12px rgba(107,138,154,0.3)',
                }}
              >
                {resending ? 'Envoi...' : "Renvoyer l'email"}
              </Button>

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Verifiez vos spams si vous ne trouvez pas l'email.
                </Typography>
              </Box>
            </Box>
          )}

          {status === 'error' && (
            <Box sx={{ py: 3 }}>
              <ErrorOutline sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Session introuvable
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Aucune session de paiement n'a ete trouvee. Si vous avez deja paye, verifiez vos emails.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => navigate('/login')}
                sx={{
                  borderColor: '#6B8A9A',
                  color: '#6B8A9A',
                  '&:hover': { borderColor: '#5A7684', backgroundColor: 'rgba(107,138,154,0.04)' },
                }}
              >
                Retour a la connexion
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
