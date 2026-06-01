import React, { useEffect, useMemo, useState } from 'react';
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
  TextField,
  Stack,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  PersonAdd,
  CheckCircle,
  ErrorOutline,
  Login as LoginIcon,
  Phone,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
} from '../../icons';
import keycloak from '../../keycloak';
import { invitationsApi, InvitationDto } from '../../services/api/invitationsApi';
import apiClient, { ApiError } from '../../services/apiClient';
import { createClenzyTheme } from '../../theme/createClenzyTheme';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import { clearMockFlags, setSessionCookie } from '../../services/storageService';

// Brand color Baitly — aligne avec EmailWrapperService.BRAND_PRIMARY.
const BRAND_PRIMARY = '#6B8A9A';

/**
 * Wordmark Baitly minimaliste : meme typo + point colore que l'email.
 * Reutilise dans l'en-tete de la page pour coherence brand cross-channel.
 */
function BaitlyWordmark({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const fontSize = size === 'lg' ? 26 : 18;
  return (
    <Box
      sx={{
        fontSize,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: '#0f172a',
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      Baitly<Box component="span" sx={{ color: BRAND_PRIMARY }}>.</Box>
    </Box>
  );
}

/** Petit chip "INVITATION" uppercase letter-spacing — meme style que le sous-titre email. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: '#94a3b8',
      }}
    >
      {children}
    </Typography>
  );
}

type PageState =
  | 'loading'
  | 'info'
  | 'register_form'
  | 'accepting'
  | 'complete_profile'
  | 'accepted'
  | 'error';

export default function AcceptInvitationPage() {
  // Geo-detected language (pas les prefs user) : pays arabes -> ar / Maghreb-France -> fr / autres -> en
  const { isRtl } = useGeoAuthLanguage();
  const theme = useMemo(() => createClenzyTheme({ isRtl }), [isRtl]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [state, setState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Champs du formulaire d'inscription inline (etat 'register_form')
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registering, setRegistering] = useState(false);

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
      // Ne pas auto-accepter si l'email ne correspond pas
      const currentEmail = keycloak.tokenParsed?.email;
      const invitedEmail = invitation?.invitedEmail;
      if (currentEmail && invitedEmail && currentEmail.toLowerCase() !== invitedEmail.toLowerCase()) {
        return; // L'utilisateur verra le warning d'email mismatch
      }
      handleAccept();
    }
  }, [isAuthenticated, state]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleAccept = async () => {
    if (!token) return;
    setState('accepting');

    try {
      await invitationsApi.accept(token);
      setState('complete_profile');
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

  /**
   * Le realm Keycloak prod a `User Registration: OFF` (auth.clenzy.fr renvoie
   * "Registration not allowed"). On affiche donc un formulaire inline qui ira
   * poster POST /api/invitations/register — le backend cree le compte via
   * Keycloak Admin API et nous renvoie les tokens pour auto-login.
   */
  const handleRegisterAndAccept = () => {
    setError(null);
    setState('register_form');
  };

  const handleSubmitRegister = async () => {
    if (!token) return;
    setError(null);

    // Validation client
    if (!firstName.trim() || !lastName.trim()) {
      setError('Renseigne ton prenom et ton nom.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setRegistering(true);
    try {
      const tokens = await invitationsApi.register({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        password,
      });

      // Auto-login : meme pattern que InscriptionConfirm.tsx
      keycloak.token = tokens.access_token;
      keycloak.refreshToken = tokens.refresh_token;
      keycloak.idToken = tokens.id_token;
      keycloak.authenticated = true;
      keycloak.tokenParsed = JSON.parse(atob(tokens.access_token.split('.')[1]));

      clearMockFlags();
      setSessionCookie(tokens.access_token);

      window.dispatchEvent(new CustomEvent('keycloak-auth-success'));

      setState('accepted');
      setTimeout(() => {
        window.location.href = '/planning';
      }, 1500);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Erreur lors de la creation du compte. Reessaye ou contacte le support.');
      setRegistering(false);
    }
  };

  const handleCompleteProfile = async () => {
    setSavingProfile(true);
    try {
      // Mettre a jour le telephone via l'API /me
      await apiClient.patch('/users/me/profile', { phoneNumber: phoneNumber.trim() || undefined });
      setState('accepted');
      setTimeout(() => {
        navigate('/planning', { replace: true });
      }, 2000);
    } catch {
      // Meme si la mise a jour echoue, on redirige
      setState('accepted');
      setTimeout(() => {
        navigate('/planning', { replace: true });
      }, 2000);
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── Role label ───────────────────────────────────────────────────────────

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER': return 'Proprietaire';
      case 'SUPER_ADMIN': return 'Super Administrateur';
      case 'ADMIN': return 'Administrateur';
      case 'SUPER_MANAGER': return 'Super Manager';
      case 'MANAGER': return 'Manager';
      case 'SUPERVISOR': return 'Superviseur';
      case 'TECHNICIAN': return 'Technicien';
      case 'HOUSEKEEPER': return 'Agent de ménage';
      case 'LAUNDRY': return 'Blanchisserie';
      case 'EXTERIOR_TECH': return 'Tech. Extérieur';
      case 'HOST': return 'Propriétaire';
      case 'MEMBER': return 'Membre';
      default: return role;
    }
  };

  const getRoleColor = (role: string): 'primary' | 'secondary' | 'default' | 'error' | 'info' | 'success' | 'warning' => {
    switch (role) {
      case 'OWNER': return 'error';
      case 'SUPER_ADMIN': return 'error';
      case 'ADMIN': return 'warning';
      case 'SUPER_MANAGER': return 'secondary';
      case 'MANAGER': return 'info';
      case 'SUPERVISOR': return 'info';
      case 'TECHNICIAN': return 'primary';
      case 'HOUSEKEEPER': return 'default';
      case 'LAUNDRY': return 'default';
      case 'EXTERIOR_TECH': return 'primary';
      case 'HOST': return 'success';
      case 'MEMBER': return 'default';
      default: return 'default';
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          p: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            maxWidth: 480,
            width: '100%',
            p: { xs: 3, sm: 4.5 },
            borderRadius: 2,
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            textAlign: 'left',
          }}
        >
          {/* Wordmark Baitly minimaliste (coherent avec l'email d'invitation) */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3.5 }}>
            <BaitlyWordmark size="lg" />
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
              {/* Hero : "INVITATION" label + nom de l'organisation. Pas de gradient
                  satureee — typographie pure, comme l'email. */}
              <Box sx={{ mb: 3.5, textAlign: 'center' }}>
                <SectionLabel>Invitation</SectionLabel>
                <Typography
                  sx={{
                    mt: 1,
                    fontSize: 14,
                    color: '#64748b',
                    lineHeight: 1.5,
                  }}
                >
                  Tu es invite a rejoindre l'organisation
                </Typography>
                <Typography
                  sx={{
                    mt: 0.75,
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: '#0f172a',
                    lineHeight: 1.2,
                  }}
                >
                  {invitation.organizationName}
                </Typography>
              </Box>

              {/* Bloc info : Role + email + expiration, layout aere */}
              <Box
                sx={{
                  mb: 3,
                  borderTop: '1px solid #f1f5f9',
                  borderBottom: '1px solid #f1f5f9',
                  py: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography sx={{ fontSize: 13, color: '#64748b' }}>Role</Typography>
                  <Chip
                    label={getRoleLabel(invitation.roleInvited)}
                    color={getRoleColor(invitation.roleInvited)}
                    size="small"
                    sx={{ height: 22, fontSize: 11, fontWeight: 600, borderRadius: 1 }}
                  />
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography sx={{ fontSize: 13, color: '#64748b' }}>Email</Typography>
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#0f172a',
                      maxWidth: '60%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={invitation.invitedEmail}
                  >
                    {invitation.invitedEmail}
                  </Typography>
                </Box>
                {invitation.expiresAt && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Expire</Typography>
                    <Typography sx={{ fontSize: 13, color: '#475569' }}>
                      {new Date(invitation.expiresAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Typography>
                  </Box>
                )}
              </Box>

              {isAuthenticated ? (
                (() => {
                  const currentEmail = keycloak.tokenParsed?.email;
                  const emailMismatch = currentEmail && invitation.invitedEmail
                    && currentEmail.toLowerCase() !== invitation.invitedEmail.toLowerCase();

                  return emailMismatch ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Alert severity="warning" sx={{ textAlign: 'left' }}>
                        Vous etes connecte avec <strong>{currentEmail}</strong> mais cette
                        invitation est destinee a <strong>{invitation.invitedEmail}</strong>.
                        Deconnectez-vous pour creer un compte avec le bon email.
                      </Alert>
                      <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        onClick={() => {
                          sessionStorage.setItem('pending_invitation_token', token!);
                          keycloak.logout({
                            redirectUri: `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token!)}`,
                          });
                        }}
                        sx={{ py: 1.25, fontWeight: 600, borderRadius: 1.5, textTransform: 'none', fontSize: 14 }}
                      >
                        Se deconnecter et creer un compte
                      </Button>
                    </Box>
                  ) : (
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      startIcon={<PersonAdd />}
                      onClick={handleAccept}
                      sx={{ py: 1.25, fontWeight: 600, borderRadius: 1.5, textTransform: 'none', fontSize: 14 }}
                    >
                      Accepter l'invitation
                    </Button>
                  );
                })()
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Button
                    variant="outlined"
                    size="large"
                    fullWidth
                    startIcon={<PersonAdd />}
                    onClick={handleRegisterAndAccept}
                    sx={{ py: 1.25, fontWeight: 600, borderRadius: 1.5, textTransform: 'none', fontSize: 14 }}
                  >
                    Creer un compte et accepter
                  </Button>
                  <Button
                    variant="text"
                    size="small"
                    fullWidth
                    startIcon={<LoginIcon />}
                    onClick={handleLoginAndAccept}
                    sx={{ fontWeight: 500 }}
                  >
                    J'ai deja un compte
                  </Button>
                </Box>
              )}
            </>
          )}

          {/* Register form (inline, plus de redirection Keycloak) */}
          {state === 'register_form' && invitation && (
            <Box sx={{ py: 1, textAlign: 'left' }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <SectionLabel>Creation de compte</SectionLabel>
                <Typography
                  sx={{
                    mt: 1.25,
                    fontSize: 14,
                    color: '#475569',
                    lineHeight: 1.5,
                  }}
                >
                  Rejoins <strong style={{ color: '#0f172a' }}>{invitation.organizationName}</strong>{' '}
                  en tant que {getRoleLabel(invitation.roleInvited).toLowerCase()}.
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Prenom"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    fullWidth
                    size="small"
                    required
                    autoComplete="given-name"
                    autoFocus
                  />
                  <TextField
                    label="Nom"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    fullWidth
                    size="small"
                    required
                    autoComplete="family-name"
                  />
                </Stack>

                <TextField
                  label="Email"
                  value={invitation.invitedEmail}
                  disabled
                  fullWidth
                  size="small"
                  helperText="L'email est defini par l'invitation"
                />

                <TextField
                  label="Telephone"
                  placeholder="Ex: +33 6 12 34 56 78"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  fullWidth
                  size="small"
                  autoComplete="tel"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Phone size={16} strokeWidth={1.75} />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Optionnel — utile pour les notifications SMS"
                />

                <TextField
                  label="Mot de passe"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  size="small"
                  required
                  autoComplete="new-password"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon size={16} strokeWidth={1.75} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                          {showPassword ? <VisibilityOff size={16} /> : <Visibility size={16} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  helperText="8 caracteres minimum"
                />

                <TextField
                  label="Confirme le mot de passe"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  fullWidth
                  size="small"
                  required
                  autoComplete="new-password"
                  error={confirmPassword.length > 0 && password !== confirmPassword}
                  helperText={
                    confirmPassword.length > 0 && password !== confirmPassword
                      ? 'Les mots de passe ne correspondent pas'
                      : ' '
                  }
                />

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleSubmitRegister}
                  disabled={registering}
                  startIcon={registering ? <CircularProgress size={16} color="inherit" /> : <PersonAdd />}
                  sx={{ py: 1.3, fontWeight: 600, borderRadius: 2 }}
                >
                  {registering ? 'Creation en cours...' : 'Creer mon compte et accepter'}
                </Button>

                <Button
                  variant="text"
                  size="small"
                  onClick={() => setState('info')}
                  disabled={registering}
                  sx={{ fontWeight: 500 }}
                >
                  Retour
                </Button>
              </Stack>
            </Box>
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

          {/* Complete Profile */}
          {state === 'complete_profile' && (
            <Box sx={{ py: 2, textAlign: 'left' }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'success.main', mb: 1 }}><CheckCircle size={48} strokeWidth={1.75} /></Box>
                <Typography variant="h6" fontWeight={700}>
                  Completez votre profil
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Vous avez rejoint <strong>{invitation?.organizationName}</strong>.
                  Verifiez vos informations avant de continuer.
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Prenom"
                  value={keycloak.tokenParsed?.given_name || ''}
                  disabled
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Nom"
                  value={keycloak.tokenParsed?.family_name || ''}
                  disabled
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Email"
                  value={keycloak.tokenParsed?.email || invitation?.invitedEmail || ''}
                  disabled
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Telephone"
                  placeholder="Ex: +33 6 12 34 56 78"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  fullWidth
                  size="small"
                  helperText="Optionnel — utile pour les notifications SMS"
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleCompleteProfile}
                  disabled={savingProfile}
                  sx={{ py: 1.2, fontWeight: 600, borderRadius: 2 }}
                >
                  {savingProfile ? <CircularProgress size={20} /> : 'Continuer'}
                </Button>
              </Box>
            </Box>
          )}

          {/* Accepted */}
          {state === 'accepted' && (
            <Box sx={{ py: 3 }}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'success.main', mb: 2 }}><CheckCircle size={64} strokeWidth={1.75} /></Box>
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
              <Box component="span" sx={{ display: 'inline-flex', color: 'error.main', mb: 2 }}><ErrorOutline size={64} strokeWidth={1.75} /></Box>
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
