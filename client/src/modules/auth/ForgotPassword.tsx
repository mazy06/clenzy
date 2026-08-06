import React, { useState } from 'react';
import { Alert, AlertDescription, Button, Field, FieldLabel, Input } from '../../components/ui';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
        <h4 className="font-semibold tracking-tight text-balance text-foreground mb-1.5 text-[1.75rem] min-[900px]:text-[2rem]">
          {t('auth.forgotPassword.title', 'Mot de passe oublié ?')}
        </h4>
        <p className="text-muted-foreground text-[0.95rem] leading-[1.5]">
          {t(
            'auth.forgotPassword.subtitle',
            'Indique ton adresse email : nous t\'enverrons un lien pour choisir un nouveau mot de passe.',
          )}
        </p>
      </div>

      {sent ? (
        <div className="flex flex-col gap-[15px]">
          <Alert variant="success">
            <CircleCheck />
            <AlertDescription><p className="text-sm font-medium">
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
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-[15px]">
            <Field>
              <FieldLabel
                className="font-semibold mb-1 block text-[0.8125rem]"
                htmlFor="forgot-password-email"
              >
                {t('auth.forgotPassword.emailLabel', 'Adresse email')}
              </FieldLabel>
              <Input
                id="forgot-password-email"
                className="w-full"
                placeholder={t('auth.forgotPassword.emailPlaceholder', 'vous@exemple.com')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                autoFocus
              />
            </Field>

            {error && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertDescription><p className="text-sm">{error}</p></AlertDescription>
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
          </div>
        </form>
      )}

      {/* ── Footer : retour login + support ── */}
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-sm text-muted-foreground text-center mb-2">
          {t('auth.forgotPassword.rememberedPassword', 'Tu te souviens de ton mot de passe ?')}{' '}
          <RouterLink
            to="/login"
            className="font-semibold text-primary no-underline hover:underline"
          >
            {t('auth.forgotPassword.loginLink', 'Se connecter')}
          </RouterLink>
        </p>
        <span className="text-xs text-muted-foreground block text-center">
          {t('auth.login.needHelp', "Besoin d'aide ?")}{' '}
          <RouterLink
            to="/support"
            className="font-medium text-muted-foreground underline hover:text-primary"
          >
            {t('auth.login.contactSupport', 'Contactez le support')}
          </RouterLink>
        </span>
      </div>
    </AuthLayout>
  );
}
