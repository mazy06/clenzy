import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Chip,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline,
  LockOutlined as LockIcon,
  Login as LoginIcon,
} from '@mui/icons-material';
import lightTheme from '../../theme/theme';
import ClenzyAnimatedLogo from '../../components/ClenzyAnimatedLogo';
import apiClient, { ApiError } from '../../services/apiClient';
import keycloak from '../../keycloak';
import { saveTokens, setSessionCookie } from '../../services/storageService';

interface InscriptionInfo {
  email: string;
  fullName: string;
  forfait: string;
  organizationType?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

type PageStatus = 'loading' | 'ready' | 'submitting' | 'success' | 'error' | 'expired' | 'already_completed';

export default function InscriptionConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<PageStatus>('loading');
  const [info, setInfo] = useState<InscriptionInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Charger les informations de l'inscription via le token
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Lien de confirmation invalide. Aucun token fourni.');
      return;
    }

    apiClient
      .get<InscriptionInfo>(`/public/inscription/confirm-info?token=${encodeURIComponent(token)}`, {
        skipAuth: true,
      })
      .then((data) => {
        setInfo(data);
        setStatus('ready');
      })
      .catch((err) => {
        const apiErr = err as ApiError;
        if (apiErr.status === 410) {
          // ALREADY_COMPLETED
          setStatus('already_completed');
        } else if (apiErr.status === 404) {
          const message = apiErr.message || '';
          if (message.includes('expire')) {
            setStatus('expired');
          } else {
            setStatus('error');
            setError('Le lien de confirmation est invalide ou a expire.');
          }
        } else {
          setStatus('error');
          setError('Le lien de confirmation est invalide ou a expire.');
        }
      });
  }, [token]);

  const isPasswordValid = password.length >= 8 && password === confirmPassword;

  const handleSubmit = async () => {
    if (!isPasswordValid) return;

    setError(null);
    setStatus('submitting');

    try {
      const data = await apiClient.post<TokenResponse>(
        '/public/inscription/set-password',
        { token, password },
        { skipAuth: true },
      );

      // Auto-login : stocker les tokens (meme pattern que Login.tsx)
      keycloak.token = data.access_token;
      keycloak.refreshToken = data.refresh_token;
      keycloak.idToken = data.id_token;
      keycloak.authenticated = true;
      keycloak.tokenParsed = JSON.parse(atob(data.access_token.split('.')[1]));

      saveTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresIn: data.expires_in,
      });

      setSessionCookie(data.access_token);

      // Forcer la mise a jour de l'etat global
      window.dispatchEvent(new CustomEvent('keycloak-auth-success'));

      setStatus('success');

      // Redirect vers le planning apres un court delai
      setTimeout(() => {
        window.location.href = '/planning';
      }, 1500);
    } catch (err) {
      const apiErr = err as ApiError;
      setStatus('ready');
      if (apiErr.status === 410) {
        setStatus('already_completed');
      } else if (apiErr.status === 404) {
        setStatus('expired');
      } else {
        setError(apiErr.message || 'Une erreur est survenue. Veuillez reessayer.');
      }
    }
  };

  const FORFAIT_LABELS: Record<string, string> = {
    essentiel: 'Essentiel',
    confort: 'Confort',
    premium: 'Premium',
  };

  const FORFAIT_COLORS: Record<string, string> = {
    essentiel: '#6B8A9A',
    confort: '#A6C0CE',
    premium: '#5A7684',
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #A6C0CE 0%, #8BA3B3 50%, #6B8A9A 100%)',
          p: 2,
        }}
      >
        <Paper
          elevation={8}
          sx={{
            p: { xs: 3, sm: 4 },
            width: '100%',
            maxWidth: 480,
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            textAlign: 'center',
          }}
        >
          {/* Logo */}
          <Box sx={{ mb: 2 }}>
            <ClenzyAnimatedLogo scale={1.1} />
          </Box>

          {/* Loading */}
          {status === 'loading' && (
            <Box sx={{ py: 4 }}>
              <CircularProgress sx={{ color: '#6B8A9A', mb: 2 }} />
              <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                Verification du lien...
              </Typography>
            </Box>
          )}

          {/* Formulaire de creation de mot de passe */}
          {(status === 'ready' || status === 'submitting') && info && (
            <Box sx={{ py: 2, textAlign: 'left' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, textAlign: 'center', color: 'text.primary' }}>
                Creez votre mot de passe
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, textAlign: 'center' }}>
                Derniere etape pour finaliser votre inscription.
              </Typography>

              {/* Banner avec infos utilisateur */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: 'rgba(166,192,206,0.1)',
                  border: '1px solid rgba(166,192,206,0.3)',
                  mb: 3,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {info.fullName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {info.email}
                </Typography>
                {info.forfait && (
                  <Chip
                    label={`Forfait ${FORFAIT_LABELS[info.forfait] || info.forfait}`}
                    size="small"
                    sx={{
                      mt: 1,
                      backgroundColor: FORFAIT_COLORS[info.forfait] || '#6B8A9A',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  />
                )}
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Stack spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Mot de passe *"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  helperText="Minimum 8 caracteres"
                  autoFocus
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Confirmer le mot de passe *"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={confirmPassword.length > 0 && password !== confirmPassword}
                  helperText={
                    confirmPassword.length > 0 && password !== confirmPassword
                      ? 'Les mots de passe ne correspondent pas'
                      : ''
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isPasswordValid) {
                      handleSubmit();
                    }
                  }}
                />

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={
                    status === 'submitting' ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <LockIcon />
                    )
                  }
                  onClick={handleSubmit}
                  disabled={!isPasswordValid || status === 'submitting'}
                  sx={{
                    py: 1.25,
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    backgroundColor: '#6B8A9A',
                    '&:hover': { backgroundColor: '#5A7684' },
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(107,138,154,0.3)',
                  }}
                >
                  {status === 'submitting' ? 'Creation en cours...' : 'Creer mon mot de passe'}
                </Button>
              </Stack>
            </Box>
          )}

          {/* Succes */}
          {status === 'success' && (
            <Box sx={{ py: 3 }}>
              <CheckCircleIcon
                sx={{
                  fontSize: 72,
                  color: 'success.main',
                  mb: 2,
                  animation: 'scaleIn 0.4s ease-out',
                  '@keyframes scaleIn': {
                    '0%': { transform: 'scale(0)', opacity: 0 },
                    '60%': { transform: 'scale(1.15)' },
                    '100%': { transform: 'scale(1)', opacity: 1 },
                  },
                }}
              />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
                Inscription finalisee !
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Votre compte a ete cree avec succes. Redirection vers votre tableau de bord...
              </Typography>
              <CircularProgress size={24} sx={{ color: '#6B8A9A' }} />
            </Box>
          )}

          {/* Deja finalise */}
          {status === 'already_completed' && (
            <Box sx={{ py: 3 }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: '#6B8A9A', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Inscription deja finalisee
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Votre compte a deja ete cree. Vous pouvez vous connecter avec vos identifiants.
              </Typography>
              <Button
                variant="contained"
                startIcon={<LoginIcon />}
                onClick={() => navigate('/login')}
                sx={{
                  px: 4,
                  fontWeight: 600,
                  backgroundColor: '#6B8A9A',
                  '&:hover': { backgroundColor: '#5A7684' },
                  borderRadius: 2,
                }}
              >
                Se connecter
              </Button>
            </Box>
          )}

          {/* Token expire */}
          {status === 'expired' && (
            <Box sx={{ py: 3 }}>
              <ErrorOutline sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Lien expire
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Le lien de confirmation a expire. Veuillez contacter le support pour obtenir un nouveau lien.
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

          {/* Erreur generique */}
          {status === 'error' && (
            <Box sx={{ py: 3 }}>
              <ErrorOutline sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Lien invalide
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                {error || 'Le lien de confirmation est invalide. Veuillez contacter le support.'}
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
