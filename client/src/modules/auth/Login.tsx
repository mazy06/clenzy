import React, { useState, useCallback } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
} from '@mui/material';
import { Visibility, VisibilityOff } from '../../icons';
import keycloak, { decodeJwt } from '../../keycloak';
import apiClient, { ApiError } from '../../services/apiClient';
import { clearMockFlags, setSessionCookie } from '../../services/storageService';
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

      clearMockFlags();
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
          {t('auth.login.title', 'Bon retour parmi nous')}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            fontSize: '0.95rem',
            lineHeight: 1.5,
          }}
        >
          {t('auth.login.subtitle', 'Connecte-toi pour accéder à ton tableau de bord.')}
        </Typography>
      </Box>

      {/* Message succes inscription */}
      {inscriptionSuccess && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 1.5 }}>
          <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
            {t('auth.login.inscriptionSuccess', 'Votre compte a été créé avec succès. Connectez-vous pour accéder à votre espace.')}
          </Typography>
        </Alert>
      )}

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.5}>
          <Box>
            <Typography
              component="label"
              htmlFor="login-email"
              variant="body2"
              sx={{ fontWeight: 600, mb: 0.75, display: 'block', fontSize: '0.8125rem' }}
            >
              {t('auth.login.emailLabel', "Email ou nom d'utilisateur")}
            </Typography>
            <TextField
              id="login-email"
              fullWidth
              size="medium"
              placeholder={t('auth.login.emailPlaceholder', 'vous@exemple.com')}
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
              autoFocus
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
              <Typography
                component="label"
                htmlFor="login-password"
                variant="body2"
                sx={{ fontWeight: 600, fontSize: '0.8125rem' }}
              >
                {t('auth.login.passwordLabel', 'Mot de passe')}
              </Typography>
              <Link
                component={RouterLink}
                to="/forgot-password"
                sx={{
                  fontSize: '0.75rem',
                  color: 'primary.main',
                  textDecoration: 'none',
                  fontWeight: 500,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {t('auth.login.forgotPassword', 'Mot de passe oublié ?')}
              </Link>
            </Box>
            <TextField
              id="login-password"
              fullWidth
              size="medium"
              placeholder={t('auth.login.passwordPlaceholder', 'Votre mot de passe')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        showPassword
                          ? t('auth.login.hidePassword', 'Masquer le mot de passe')
                          : t('auth.login.showPassword', 'Afficher le mot de passe')
                      }
                      onClick={() => setShowPassword(!showPassword)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                      size="small"
                      sx={{ color: 'text.secondary' }}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {error && (
            <Alert
              severity={isLocked ? 'warning' : captchaRequired ? 'info' : 'error'}
              sx={{ borderRadius: 1.5 }}
            >
              <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{error}</Typography>
            </Alert>
          )}

          {captchaRequired && (
            <Box>
              <TurnstileCaptcha
                onVerified={handleCaptchaVerified}
                onError={(msg) => setError(msg)}
              />
            </Box>
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading || isLocked || (captchaRequired && !captchaToken)}
            sx={{
              py: 1.5,
              fontSize: '0.9375rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 1.5,
              boxShadow: 'none',
              // Hover identique aux champs : remplissage soft-indigo (var(--accent-soft)
              // herite du theme containedPrimary), pas de fond indigo fonce qui
              // rendait le texte indigo illisible.
              '&:hover': {
                boxShadow: 'none',
              },
              '&:disabled': {
                bgcolor: 'action.disabledBackground',
                color: 'action.disabled',
              },
              transition: 'background-color 150ms ease, border-color 150ms ease',
            }}
          >
            {loading ? <CircularProgress size={22} color="inherit" /> : t('auth.login.submit', 'Se connecter')}
          </Button>
        </Stack>
      </form>

      {/* ── Footer : signup + support ── */}
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
          {t('auth.login.noAccount', 'Pas encore de compte ?')}{' '}
          <Link
            component={RouterLink}
            to="/inscription"
            sx={{
              color: 'primary.main',
              fontWeight: 600,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {t('auth.login.createAccount', 'Crée le tien')}
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
