import React, { useState, useCallback } from 'react';
import {
  Alert as UiAlert,
  AlertDescription,
  Button,
  Field,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../../components/ui';
import { CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Visibility, VisibilityOff } from '../../icons';
import keycloak, { decodeJwt } from '../../keycloak';
import apiClient, { ApiError } from '../../services/apiClient';
import { setSessionCookie } from '../../services/storageService';
import TurnstileCaptcha from '../../components/TurnstileCaptcha';
import AuthLayout from './AuthLayout';

/**
 * Page Login.
 *
 * <p>Design 2026 : split-screen avec panneau brand a gauche et form epure
 * a droite (cf. {@link AuthLayout}). Form sans card flottante, juste un
 * titre/sub + 2 inputs + bouton primaire, hierarchie typographique claire.</p>
 *
 * <p>La logique reste identique a l'ancienne version (CAPTCHA, lockout,
 * Keycloak token wiring) — seul le rendu visuel a change.</p>
 */
export default function Login() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // Detecter si l'utilisateur vient de finaliser son inscription (retour Stripe)
  const inscriptionSuccess = searchParams.get('inscription') === 'success';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // ─── Login logic ────────────────────────────────────────────

  const doLogin = useCallback(async (overrideCaptchaToken?: string) => {
    setError(null);
    setIsLocked(false);
    setLoading(true);

    const tokenToSend = overrideCaptchaToken || captchaToken;

    try {
      const body: Record<string, string> = {
        username: email,
        password: password,
      };

      if (tokenToSend) {
        body.captchaToken = tokenToSend;
      }

      const data = await apiClient.post<any>('/auth/login', body, { skipAuth: true });

      keycloak.token = data.access_token;
      keycloak.refreshToken = data.refresh_token;
      keycloak.idToken = data.id_token;
      keycloak.authenticated = true;
      keycloak.tokenParsed = decodeJwt(data.access_token);

      setSessionCookie(data.access_token);
      window.dispatchEvent(new CustomEvent('keycloak-auth-success'));
    } catch (err) {
      const apiErr = err as ApiError;
      const details = apiErr.details as Record<string, unknown> | undefined;

      if (apiErr.status) {
        if (details?.captchaRequired === true || details?.error === 'captcha_required') {
          setCaptchaRequired(true);
          setCaptchaToken(null);
          setError(t('auth.login.errors.captchaRequired', 'Vérification requise pour continuer.'));
          setLoading(false);
          return;
        }

        if (details?.error === 'account_locked' || apiErr.status === 429) {
          const retryAfter = details?.retryAfter as number;
          const minutes = retryAfter ? Math.ceil(retryAfter / 60) : 15;
          setError(
            t(
              'auth.login.errors.accountLocked',
              `Compte temporairement bloqué suite à trop de tentatives échouées. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}. Si le problème persiste, contactez votre administrateur.`,
              { minutes, plural: minutes > 1 ? 's' : '' },
            ),
          );
          setIsLocked(true);
          setCaptchaRequired(false);
          setLoading(false);
          return;
        }

        switch (apiErr.status) {
          case 401:
            if (details?.captchaRequired === true) {
              setCaptchaRequired(true);
              setCaptchaToken(null);
              setError(t('auth.login.errors.invalidPasswordCaptcha', 'Mot de passe incorrect. Vérification requise pour réessayer.'));
            } else {
              setError(t('auth.login.errors.invalidCredentials', 'Email ou mot de passe incorrect.'));
            }
            break;
          case 400:
            setError(t('auth.login.errors.missingFields', 'Veuillez remplir tous les champs.'));
            break;
          case 403:
            if (details?.error === 'captcha_invalid') {
              setCaptchaRequired(true);
              setCaptchaToken(null);
              setError(t('auth.login.errors.captchaInvalid', 'Vérification échouée. Réessayez.'));
            } else {
              setError(t('auth.login.errors.accountDisabled', 'Votre compte est désactivé. Contactez le support.'));
            }
            break;
          case 500:
          case 502:
          case 503:
            setError(t('auth.common.errors.serverDown', 'Le serveur est temporairement indisponible. Réessayez dans un instant.'));
            break;
          default:
            setError(t('auth.common.errors.generic', 'Une erreur est survenue. Veuillez réessayer.'));
        }
      } else {
        setError(t('auth.common.errors.networkError', 'Impossible de contacter le serveur. Vérifiez votre connexion internet.'));
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, captchaToken, t]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    doLogin();
  };

  const handleCaptchaVerified = useCallback((token: string) => {
    setCaptchaToken(token);
    setTimeout(() => {
      doLogin(token);
    }, 500);
  }, [doLogin]);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <AuthLayout>
      {/* ── Header form ── */}
      <div className="mb-6">
        {/* md = 900 px cote MUI (breakpoints non configures), pas les 768 px de
            Tailwind : d'ou la variante exacte `min-[900px]:`. */}
        <h4 className="font-semibold tracking-tight text-balance text-foreground mb-1.5 text-[1.75rem] min-[900px]:text-[2rem]">
          {t('auth.login.title', 'Connexion')}
        </h4>
        <p className="text-muted-foreground text-[0.95rem] leading-[1.5]">
          {t('auth.login.subtitle', 'Connecte-toi pour accéder à ton tableau de bord.')}
        </p>
      </div>

      {/* Message succes inscription */}
      {inscriptionSuccess && (
        <UiAlert variant="success" className="mb-4">
          <CircleCheck />
          <AlertDescription><p className="text-sm font-medium">
            {t('auth.login.inscriptionSuccess', 'Votre compte a été créé avec succès. Connectez-vous pour accéder à votre espace.')}
          </p></AlertDescription>
        </UiAlert>
      )}

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} noValidate>
        {/* spacing={2.5} avec un theme.spacing de 6 px = 15 px, pas les 20 px du
            defaut MUI. */}
        <div className="flex flex-col gap-[15px]">
          <Field>
            <FieldLabel className="font-semibold mb-1 block text-[0.8125rem]" htmlFor="login-email">
              {t('auth.login.emailLabel', "Email ou nom d'utilisateur")}
            </FieldLabel>
            <Input
              id="login-email"
              className="w-full"
              placeholder={t('auth.login.emailPlaceholder', 'vous@exemple.com')}
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
              autoFocus
            />
          </Field>

          <Field>
            <div className="flex justify-between items-baseline mb-1">
              <FieldLabel className="font-semibold text-[0.8125rem]" htmlFor="login-password">
                {t('auth.login.passwordLabel', 'Mot de passe')}
              </FieldLabel>
              <RouterLink
                to="/forgot-password"
                className="text-xs font-medium no-underline text-primary hover:underline"
              >
                {t('auth.login.forgotPassword', 'Mot de passe oublié ?')}
              </RouterLink>
            </div>
            <InputGroup>
              <InputGroupInput
                id="login-password"
                placeholder={t('auth.login.passwordPlaceholder', 'Votre mot de passe')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={
                    showPassword
                      ? t('auth.login.hidePassword', 'Masquer le mot de passe')
                      : t('auth.login.showPassword', 'Afficher le mot de passe')
                  }
                  onClick={() => setShowPassword(!showPassword)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="text-muted-foreground"
                >
                  {showPassword
                    ? <VisibilityOff size={16} strokeWidth={1.75} />
                    : <Visibility size={16} strokeWidth={1.75} />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>

          {error && (
            <UiAlert variant={isLocked ? 'warning' : captchaRequired ? 'info' : 'destructive'}>
              <AlertDescription>
                <p className="text-sm">{error}</p>
              </AlertDescription>
            </UiAlert>
          )}

          {captchaRequired && (
            <div>
              <TurnstileCaptcha
                onVerified={handleCaptchaVerified}
                onError={(msg) => setError(msg)}
              />
            </div>
          )}

          {/* Action principale de l'ecran : `default`. Le gabarit (rayon, graisse,
              casse, ombre, etat disabled, transition) est porte par le kit — l'ancien
              `sx` ne faisait que le redire, il est supprime. */}
          <Button
            type="submit"
            size="lg"
            className="w-full shrink"
            disabled={loading || isLocked || (captchaRequired && !captchaToken)}
          >
            {loading ? <Spinner className="size-[22px]" /> : t('auth.login.submit', 'Se connecter')}
          </Button>
        </div>
      </form>

      {/* ── Footer : signup + support ── */}
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-sm text-muted-foreground text-center mb-2">
          {t('auth.login.noAccount', 'Pas encore de compte ?')}{' '}
          <RouterLink
            to="/inscription"
            className="font-semibold no-underline text-primary hover:underline"
          >
            {t('auth.login.createAccount', 'Crée le tien')}
          </RouterLink>
        </p>
        <span className="text-xs text-muted-foreground block text-center">
          {t('auth.login.needHelp', "Besoin d'aide ?")}{' '}
          <RouterLink
            to="/support"
            className="font-medium underline text-muted-foreground hover:text-primary"
          >
            {t('auth.login.contactSupport', 'Contactez le support')}
          </RouterLink>
        </span>
      </div>
    </AuthLayout>
  );
}
