import React, { useEffect, useMemo, useState } from 'react';
import { Spinner } from '../../components/ui';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Paper, Button, Alert, ThemeProvider, CssBaseline } from '@mui/material';
import { MarkEmailRead, ErrorOutline, Send as SendIcon } from '../../icons';
import { createBaitlyTheme } from '../../theme/createBaitlyTheme';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import apiClient from '../../services/apiClient';

export default function InscriptionSuccess() {
  const { t } = useTranslation();
  // Geo-detected language (pas les prefs user) : pays arabes -> ar / Maghreb-France -> fr / autres -> en
  const { isRtl } = useGeoAuthLanguage();
  const theme = useMemo(() => createBaitlyTheme({ isRtl }), [isRtl]);
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
      setResendMessage(t('auth.inscriptionSuccess.resendMissingEmail', 'Impossible de renvoyer sans adresse email.'));
      return;
    }
    setResending(true);
    setResendMessage(null);
    try {
      await apiClient.post('/public/inscription/resend-confirmation', {
        email: inscriptionEmail,
      }, { skipAuth: true });
      setResendMessage(t('auth.inscriptionSuccess.resendSuccess', 'Un nouveau lien de confirmation a ete envoye.'));
    } catch {
      setResendMessage(t('auth.inscriptionSuccess.resendSuccess', 'Un nouveau lien de confirmation a ete envoye.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
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
          <div className="mb-3">
            <BaitlyMarkLogo scale={1.1} />
          </div>

          {status === 'loading' && (
            <div className="py-6">
              <Spinner className="size-10 text-[primary.main] mb-3" />
              <p className="cn-text-body1 font-medium text-muted-foreground">
                {t('auth.inscriptionSuccess.loading', 'Finalisation de votre paiement...')}
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-4">
              <Box component="span" sx={{
                display: 'inline-flex',
                color: 'primary.main',
                mb: 2,
                animation: 'scaleIn 0.4s ease-out',
                '@keyframes scaleIn': {
                  '0%': { transform: 'scale(0)', opacity: 0 },
                  '60%': { transform: 'scale(1.15)' },
                  '100%': { transform: 'scale(1)', opacity: 1 },
                },
              }}>
                <MarkEmailRead size={72} strokeWidth={1.75} />
              </Box>
              <h5 className="cn-text-h5 font-bold mb-1.5 text-foreground">
                {t('auth.inscriptionSuccess.successTitle', 'Verifiez votre boite email')}
              </h5>
              <p className="cn-text-body2 text-muted-foreground mb-1.5">
                {t('auth.inscriptionSuccess.paymentConfirmed', 'Votre paiement a ete confirme avec succes.')}
              </p>
              <p className="cn-text-body2 text-muted-foreground mb-4">
                {t(
                  'auth.inscriptionSuccess.checkEmail',
                  `Un email de confirmation a ete envoye${inscriptionEmail ? ` a ${inscriptionEmail}` : ''}. Cliquez sur le lien dans l'email pour creer votre mot de passe et finaliser votre inscription.`,
                  {
                    toEmail: inscriptionEmail
                      ? t('auth.inscriptionSuccess.toEmail', ` a ${inscriptionEmail}`, { email: inscriptionEmail })
                      : '',
                  },
                )}
              </p>

              {resendMessage && (
                <Alert severity="success" sx={{ mb: 2, textAlign: 'left' }}>
                  {resendMessage}
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                startIcon={resending ? <Spinner className="size-[18px]" /> : <SendIcon />}
                onClick={handleResend}
                disabled={resending}
                sx={{
                  px: 4,
                  py: 1.25,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  backgroundColor: 'primary.main',
                  '&:hover': { backgroundColor: 'primary.dark' },
                  borderRadius: 2,
                  boxShadow: '0 4px 12px rgba(107,138,154,0.3)',
                }}
              >
                {resending
                  ? t('auth.inscriptionSuccess.resending', 'Envoi...')
                  : t('auth.inscriptionSuccess.resend', "Renvoyer l'email")}
              </Button>

              <div className="mt-3">
                <span className="cn-text-caption text-muted-foreground">
                  {t('auth.inscriptionSuccess.checkSpam', "Verifiez vos spams si vous ne trouvez pas l'email.")}
                </span>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="py-4">
              <span className="inline-flex text-destructive mb-3"><ErrorOutline size={64} strokeWidth={1.75} /></span>
              <h6 className="cn-text-h6 font-semibold mb-1.5">
                {t('auth.inscriptionSuccess.errorTitle', 'Session introuvable')}
              </h6>
              <p className="cn-text-body2 text-muted-foreground mb-4">
                {t('auth.inscriptionSuccess.errorBody', "Aucune session de paiement n'a ete trouvee. Si vous avez deja paye, verifiez vos emails.")}
              </p>
              <Button
                variant="outlined"
                onClick={() => navigate('/login')}
                sx={{
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': { borderColor: 'primary.dark', backgroundColor: 'rgba(107,138,154,0.04)' },
                }}
              >
                {t('auth.common.backToLogin', 'Retour a la connexion')}
              </Button>
            </div>
          )}
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
