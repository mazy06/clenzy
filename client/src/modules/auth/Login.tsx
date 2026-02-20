import React, { useState, useCallback } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  ThemeProvider,
  CssBaseline
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import keycloak from '../../keycloak';
import clenzyLogo from '../../assets/Clenzy_logo.png';
import apiClient, { ApiError } from '../../services/apiClient';
import { saveTokens, setSessionCookie } from '../../services/storageService';
import lightTheme from '../../theme/theme';
import PuzzleCaptcha from '../../components/PuzzleCaptcha';

export default function Login() {
  const [searchParams] = useSearchParams();

  // Detecter si l'utilisateur vient de finaliser son inscription (retour Stripe)
  const inscriptionSuccess = searchParams.get('inscription') === 'success';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // ─── Login logic ────────────────────────────────────────────

  const doLogin = useCallback(async (overrideCaptchaToken?: string) => {
    setError(null);
    setLoading(true);

    const tokenToSend = overrideCaptchaToken || captchaToken;

    try {
      const body: Record<string, string> = {
        username: email,
        password: password,
      };

      // Ajouter le token CAPTCHA si disponible
      if (tokenToSend) {
        body.captchaToken = tokenToSend;
      }

      const data = await apiClient.post<any>('/auth/login', body, { skipAuth: true });

      // Mettre a jour l'etat de Keycloak
      keycloak.token = data.access_token;
      keycloak.refreshToken = data.refresh_token;
      keycloak.idToken = data.id_token;
      keycloak.authenticated = true;
      keycloak.tokenParsed = JSON.parse(atob(data.access_token.split('.')[1]));

      // Sauvegarder les tokens dans localStorage
      saveTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresIn: data.expires_in,
      });

      // Sauvegarder le token dans un cookie partage (accessible par la landing page)
      setSessionCookie(data.access_token);

      // Forcer la mise a jour de l'etat global via l'evenement personnalise
      window.dispatchEvent(new CustomEvent('keycloak-auth-success'));

      // L'evenement sera traite par App.tsx qui affichera automatiquement le dashboard

    } catch (err) {
      const apiErr = err as ApiError;
      const details = apiErr.details as Record<string, unknown> | undefined;

      if (apiErr.status) {
        // Verifier si le backend demande un CAPTCHA
        if (details?.captchaRequired === true || details?.error === 'captcha_required') {
          setCaptchaRequired(true);
          setCaptchaToken(null);
          setError('Vérification requise. Complétez le puzzle ci-dessous.');
          setLoading(false);
          return;
        }

        // Verifier si le compte est verrouille
        if (details?.error === 'account_locked' || apiErr.status === 429) {
          const retryAfter = details?.retryAfter as number;
          const minutes = retryAfter ? Math.ceil(retryAfter / 60) : 15;
          setError(`Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`);
          setCaptchaRequired(false);
          setLoading(false);
          return;
        }

        // Messages user-friendly selon le code HTTP
        switch (apiErr.status) {
          case 401:
            if (details?.captchaRequired === true) {
              setCaptchaRequired(true);
              setCaptchaToken(null);
              setError('Mot de passe incorrect. Complétez le puzzle pour réessayer.');
            } else {
              setError('Email ou mot de passe incorrect.');
            }
            break;
          case 400:
            setError('Veuillez remplir tous les champs.');
            break;
          case 403:
            if (details?.error === 'captcha_invalid') {
              setCaptchaRequired(true);
              setCaptchaToken(null);
              setError('Vérification du puzzle échouée. Réessayez.');
            } else {
              setError('Votre compte est désactivé. Contactez le support.');
            }
            break;
          case 500:
          case 502:
          case 503:
            setError('Le serveur est temporairement indisponible. Réessayez dans un instant.');
            break;
          default:
            setError('Une erreur est survenue. Veuillez réessayer.');
        }
      } else {
        setError('Impossible de contacter le serveur. Vérifiez votre connexion internet.');
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, captchaToken]);

  // ─── Form submit ────────────────────────────────────────────

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    doLogin();
  };

  // ─── CAPTCHA verified callback ──────────────────────────────

  const handleCaptchaVerified = useCallback((token: string) => {
    setCaptchaToken(token);
    // Auto-submit le login avec le token CAPTCHA
    setTimeout(() => {
      doLogin(token);
    }, 500);
  }, [doLogin]);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <ThemeProvider theme={lightTheme}>
    <CssBaseline />
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #A6C0CE 0%, #8BA3B3 50%, #6B8A9A 100%)',
      p: 2
    }}>
      <Paper elevation={8} sx={{
        p: 2.5,
        width: '100%',
        maxWidth: captchaRequired ? 420 : 400,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        transition: 'max-width 0.3s ease',
      }}>
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
            <img
              src={clenzyLogo}
              alt="Clenzy Logo"
              style={{
                height: '48px',
                width: 'auto',
                maxWidth: '200px'
              }}
            />
          </Box>
          <Typography variant="body2" sx={{
            fontWeight: 500,
            color: 'secondary.main',
            fontSize: '0.85rem'
          }}>
            Connectez-vous à votre compte
          </Typography>
        </Box>

        {/* Message de succes apres inscription */}
        {inscriptionSuccess && (
          <Alert severity="success" sx={{ mb: 2, py: 0.75 }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
              Votre compte a ete cree avec succes ! Connectez-vous pour acceder a votre espace.
            </Typography>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              size="small"
              label="Email ou nom d'utilisateur"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'secondary.main',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'secondary.main',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: 'secondary.main',
                },
              }}
            />
            <TextField
              fullWidth
              size="small"
              label="Mot de passe"
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
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      onClick={() => setShowPassword(!showPassword)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                      size="small"
                      sx={{ color: 'secondary.main' }}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'secondary.main',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'secondary.main',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: 'secondary.main',
                },
              }}
            />

            {error && (
              <Alert
                severity={captchaRequired ? 'info' : 'error'}
                sx={{ mt: 1, py: 0.75 }}
              >
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{error}</Typography>
              </Alert>
            )}

            {/* CAPTCHA puzzle slider */}
            {captchaRequired && (
              <Box sx={{ mt: 1 }}>
                <PuzzleCaptcha
                  onVerified={handleCaptchaVerified}
                  onError={(msg) => setError(msg)}
                />
              </Box>
            )}

            <Button
              type="submit"
              variant="contained"
              size="medium"
              disabled={loading || (captchaRequired && !captchaToken)}
              sx={{
                py: 1,
                fontSize: '0.9rem',
                fontWeight: 600,
                backgroundColor: 'secondary.main',
                '&:hover': {
                  backgroundColor: 'secondary.dark',
                },
                '&:active': {
                  backgroundColor: 'primary.main',
                },
                '&:disabled': {
                  backgroundColor: 'secondary.light',
                },
                borderRadius: 1.5,
                boxShadow: '0 4px 12px rgba(166, 192, 206, 0.3)',
                transition: 'all 0.3s ease',
              }}
            >
              {loading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                'Se connecter'
              )}
            </Button>
          </Stack>
        </form>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" sx={{
            color: 'secondary.main',
            fontWeight: 500,
            fontSize: '0.75rem'
          }}>
            Besoin d'aide ?{' '}
            <Link
              component={RouterLink}
              to="/support"
              sx={{
                color: 'secondary.dark',
                fontWeight: 600,
                textDecoration: 'underline',
                '&:hover': {
                  color: 'primary.main',
                },
              }}
            >
              Contactez le support
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
    </ThemeProvider>
  );
}
