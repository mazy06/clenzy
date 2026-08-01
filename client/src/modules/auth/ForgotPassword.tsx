import React, { useState } from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TextField, Stack, Link } from '@mui/material';
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
      <div className="mb-6">
        <h4 className="cn-text-h4 font-semibold text-[var(--ink)] mb-1.5 text-[1.75rem] min-[900px]:text-[2rem] text-balance">
          {t('auth.forgotPassword.title', 'Mot de passe oublié ?')}
        </h4>
        <p className="cn-text-body1 text-muted-foreground text-[0.95rem] leading-[1.5]">
          {t(
            'auth.forgotPassword.subtitle',
            'Indique ton adresse email : nous t\'enverrons un lien pour choisir un nouveau mot de passe.',
          )}
        </p>
      </div>

      {sent ? (
        <Stack spacing={2.5}>
          <Alert variant="success">
            <CircleCheck />
            <AlertDescription><p className="cn-text-body2 text-[0.875rem] font-medium">
              {t(
                'auth.forgotPassword.successMessage',
                'Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé. Pensez à vérifier vos spams.',
              )}
            </p></AlertDescription>
          </Alert>
          <Button size="lg" className="w-full shrink" asChild>
            <RouterLink to="/login">
              {t('auth.forgotPassword.backToLogin', 'Retour à la connexion')}
            </RouterLink>
          </Button>
        </Stack>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5}>
            <div>
              <label className="cn-text-body2 font-semibold mb-1 block text-[0.8125rem]" htmlFor="forgot-password-email">
                {t('auth.forgotPassword.emailLabel', 'Adresse email')}
              </label>
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
            </div>

            {error && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertDescription><p className="cn-text-body2 text-[0.875rem]">{error}</p></AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full shrink"
            >
              {loading
                ? <Spinner className="size-[22px]" />
                : t('auth.forgotPassword.submit', 'Envoyer le lien de réinitialisation')}
            </Button>
          </Stack>
        </form>
      )}

      {/* ── Footer : retour login + support ── */}
      <div className="mt-6 pt-4 border-t border-[var(--line)]">
        <p className="cn-text-body2 text-muted-foreground text-[0.875rem] text-center mb-2">
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
        </p>
        <span className="cn-text-caption text-muted-foreground block text-center text-[0.75rem]">
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
        </span>
      </div>
    </AuthLayout>
  );
}
