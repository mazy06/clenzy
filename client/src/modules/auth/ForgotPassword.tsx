import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import apiClient, { ApiError } from '../../services/apiClient';
import AuthLayout from './AuthLayout';

/**
 * Page « Mot de passe oublié ».
 *
 * <p>Déclenche côté backend l'envoi de l'email Keycloak de réinitialisation
 * (action token UPDATE_PASSWORD via le SMTP du realm). La réponse est toujours
 * générique — elle ne révèle pas si un compte existe pour cet email.</p>
 */
export default function ForgotPassword() {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setError(t('auth.forgotPassword.errors.missingEmail', 'Veuillez saisir votre adresse email.'));
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() }, { skipAuth: true });
      setSent(true);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status) {
        setError(t('auth.common.errors.serverDown', 'Le serveur est temporairement indisponible. Réessayez dans un instant.'));
      } else {
        setError(t('auth.common.errors.networkError', 'Impossible de contacter le serveur. Vérifiez votre connexion internet.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {/* ── Header form ── */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            mb: 1,
            fontSize: { xs: '1.75rem', md: '2rem' },
            textWrap: 'balance',
          }}
        >
          {t('auth.forgotPassword.title', 'Mot de passe oublié ?')}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            fontSize: '0.95rem',
            lineHeight: 1.5,
          }}
        >
          {t(
            'auth.forgotPassword.subtitle',
            'Indique ton adresse email : nous t\'enverrons un lien pour choisir un nouveau mot de passe.',
          )}
        </Typography>
      </Box>

      {sent ? (
        <Stack spacing={2.5}>
          <Alert severity="success" sx={{ borderRadius: 1.5 }}>
            <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
              {t(
                'auth.forgotPassword.successMessage',
                'Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé. Pensez à vérifier vos spams.',
              )}
            </Typography>
          </Alert>
          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            size="large"
            sx={{
              py: 1.5,
              fontSize: '0.9375rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 1.5,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            {t('auth.forgotPassword.backToLogin', 'Retour à la connexion')}
          </Button>
        </Stack>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5}>
            <Box>
              <Typography
                component="label"
                htmlFor="forgot-password-email"
                variant="body2"
                sx={{ fontWeight: 600, mb: 0.75, display: 'block', fontSize: '0.8125rem' }}
              >
                {t('auth.forgotPassword.emailLabel', 'Adresse email')}
              </Typography>
              <TextField
                id="forgot-password-email"
                fullWidth
                size="medium"
                placeholder={t('auth.forgotPassword.emailPlaceholder', 'vous@exemple.com')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                autoFocus
              />
            </Box>

            {error && (
              <Alert severity="error" sx={{ borderRadius: 1.5 }}>
                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{error}</Typography>
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                fontSize: '0.9375rem',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 1.5,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
                '&:disabled': {
                  bgcolor: 'action.disabledBackground',
                  color: 'action.disabled',
                },
                transition: 'background-color 150ms ease, border-color 150ms ease',
              }}
            >
              {loading
                ? <CircularProgress size={22} color="inherit" />
                : t('auth.forgotPassword.submit', 'Envoyer le lien de réinitialisation')}
            </Button>
          </Stack>
        </form>
      )}

      {/* ── Footer : retour login + support ── */}
      <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontSize: '0.875rem',
            textAlign: 'center',
            mb: 1.5,
          }}
        >
          {t('auth.forgotPassword.rememberedPassword', 'Tu te souviens de ton mot de passe ?')}{' '}
          <Link
            component={RouterLink}
            to="/login"
            sx={{
              color: 'primary.main',
              fontWeight: 600,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {t('auth.forgotPassword.loginLink', 'Se connecter')}
          </Link>
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            display: 'block',
            textAlign: 'center',
            fontSize: '0.75rem',
          }}
        >
          {t('auth.login.needHelp', "Besoin d'aide ?")}{' '}
          <Link
            component={RouterLink}
            to="/support"
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
              textDecoration: 'underline',
              '&:hover': { color: 'primary.main' },
            }}
          >
            {t('auth.login.contactSupport', 'Contactez le support')}
          </Link>
        </Typography>
      </Box>
    </AuthLayout>
  );
}
