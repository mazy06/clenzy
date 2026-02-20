import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import {
  Business,
  PersonAdd,
  CheckCircle,
  ErrorOutline,
  Login as LoginIcon,
} from '@mui/icons-material';
import keycloak from '../../keycloak';
import { invitationsApi, InvitationDto } from '../../services/api/invitationsApi';
import lightTheme from '../../theme/theme';
import clenzyLogo from '../../assets/Clenzy_logo.png';

type PageState = 'loading' | 'info' | 'accepting' | 'accepted' | 'error';

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [state, setState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = keycloak.authenticated && keycloak.token;

  // 1. Charger les infos de l'invitation au mount
  useEffect(() => {
    if (!token) {
      setError('Lien d\'invitation invalide : aucun token fourni.');
      setState('error');
      return;
    }

    const loadInfo = async () => {
      try {
        const info = await invitationsApi.getInfo(token);
        setInvitation(info);
        setState('info');
      } catch (err: unknown) {
        const apiErr = err as { message?: string };
        setError(apiErr.message || 'Cette invitation est invalide ou a expire.');
        setState('error');
      }
    };

    loadInfo();
  }, [token]);

  // 2. Si on revient authentifie avec un token en sessionStorage, accepter automatiquement
  useEffect(() => {
    const storedToken = sessionStorage.getItem('pending_invitation_token');
    if (storedToken && isAuthenticated && state === 'info') {
      sessionStorage.removeItem('pending_invitation_token');
      handleAccept();
    }
  }, [isAuthenticated, state]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleAccept = async () => {
    if (!token) return;
    setState('accepting');

    try {
      await invitationsApi.accept(token);
      setState('accepted');
      // Rediriger vers le dashboard apres 2s
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Erreur lors de l\'acceptation de l\'invitation.');
      setState('error');
    }
  };

  const handleLoginAndAccept = () => {
    if (!token) return;
    // Stocker le token pour l'acceptation apres retour de Keycloak
    sessionStorage.setItem('pending_invitation_token', token);
    // Rediriger vers Keycloak login avec retour sur cette page
    keycloak.login({
      redirectUri: `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token)}`,
    });
  };

  const handleRegisterAndAccept = () => {
    if (!token) return;
    sessionStorage.setItem('pending_invitation_token', token);
    keycloak.register({
      redirectUri: `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token)}`,
    });
  };

  // ─── Role label ───────────────────────────────────────────────────────────

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER': return 'Proprietaire';
      case 'ADMIN': return 'Administrateur';
      case 'MANAGER': return 'Manager';
      case 'MEMBER': return 'Membre';
      default: return role;
    }
  };

  const getRoleColor = (role: string): 'primary' | 'secondary' | 'default' | 'error' | 'info' | 'success' | 'warning' => {
    switch (role) {
      case 'OWNER': return 'error';
      case 'ADMIN': return 'warning';
      case 'MANAGER': return 'info';
      case 'MEMBER': return 'default';
      default: return 'default';
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          p: 2,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            maxWidth: 480,
            width: '100%',
            p: 4,
            borderRadius: 3,
            textAlign: 'center',
          }}
        >
          {/* Logo */}
          <Box sx={{ mb: 3 }}>
            <img src={clenzyLogo} alt="Clenzy" style={{ height: 48 }} />
          </Box>

          {/* Loading */}
          {state === 'loading' && (
            <Box sx={{ py: 4 }}>
              <CircularProgress size={48} />
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                Chargement de l'invitation...
              </Typography>
            </Box>
          )}

          {/* Invitation Info */}
          {state === 'info' && invitation && (
            <>
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'primary.50',
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
                }}
              >
                <Business sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  Invitation
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Vous avez ete invite a rejoindre
                </Typography>
                <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
                  {invitation.organizationName}
                </Typography>
              </Box>

              <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Role propose :
                  </Typography>
                  <Chip
                    label={getRoleLabel(invitation.roleInvited)}
                    color={getRoleColor(invitation.roleInvited)}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Envoye a : <strong>{invitation.invitedEmail}</strong>
                </Typography>
                {invitation.expiresAt && (
                  <Typography variant="caption" color="text.secondary">
                    Expire le {new Date(invitation.expiresAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Typography>
                )}
              </Box>

              {isAuthenticated ? (
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={<PersonAdd />}
                  onClick={handleAccept}
                  sx={{ py: 1.5, fontWeight: 600, borderRadius: 2 }}
                >
                  Accepter l'invitation
                </Button>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<LoginIcon />}
                    onClick={handleLoginAndAccept}
                    sx={{ py: 1.5, fontWeight: 600, borderRadius: 2 }}
                  >
                    Se connecter et accepter
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    fullWidth
                    startIcon={<PersonAdd />}
                    onClick={handleRegisterAndAccept}
                    sx={{ py: 1.5, fontWeight: 600, borderRadius: 2 }}
                  >
                    Creer un compte et accepter
                  </Button>
                </Box>
              )}
            </>
          )}

          {/* Accepting */}
          {state === 'accepting' && (
            <Box sx={{ py: 4 }}>
              <CircularProgress size={48} />
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                Acceptation en cours...
              </Typography>
            </Box>
          )}

          {/* Accepted */}
          {state === 'accepted' && (
            <Box sx={{ py: 3 }}>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Bienvenue !
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Vous avez rejoint <strong>{invitation?.organizationName}</strong> avec succes.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Redirection vers le tableau de bord...
              </Typography>
            </Box>
          )}

          {/* Error */}
          {state === 'error' && (
            <Box sx={{ py: 3 }}>
              <ErrorOutline sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Invitation non valide
              </Typography>
              <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
                {error}
              </Alert>
              <Button
                variant="outlined"
                sx={{ mt: 3 }}
                onClick={() => navigate('/login', { replace: true })}
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
