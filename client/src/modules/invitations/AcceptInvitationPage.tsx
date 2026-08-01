import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Paper, Button, Alert, ThemeProvider, CssBaseline, TextField, Stack, InputAdornment, IconButton } from '@mui/material';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
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
import keycloak, { decodeJwt } from '../../keycloak';
import { invitationsApi, InvitationDto } from '../../services/api/invitationsApi';
import apiClient, { ApiError } from '../../services/apiClient';
import { createBaitlyTheme } from '../../theme/createBaitlyTheme';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import { setSessionCookie } from '../../services/storageService';

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
      Baitly<span style={{ color: BRAND_PRIMARY }}>.</span>
    </Box>
  );
}

/** Petit chip "INVITATION" uppercase letter-spacing — meme style que le sous-titre email. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="cn-text-body1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
      {children}
    </p>
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

const getRoleTone = (role: string): StatusTone => {
  switch (role) {
    case 'OWNER': return 'err';
    case 'SUPER_ADMIN': return 'err';
    case 'ADMIN': return 'warn';
    case 'SUPER_MANAGER': return 'neutral';
    case 'MANAGER': return 'info';
    case 'SUPERVISOR': return 'info';
    case 'TECHNICIAN': return 'accent';
    case 'HOUSEKEEPER': return 'neutral';
    case 'LAUNDRY': return 'neutral';
    case 'EXTERIOR_TECH': return 'accent';
    case 'HOST': return 'ok';
    case 'MEMBER': return 'neutral';
    default: return 'neutral';
  }
};

export default function AcceptInvitationPage() {
  // Geo-detected language (pas les prefs user) : pays arabes -> ar / Maghreb-France -> fr / autres -> en
  const { isRtl } = useGeoAuthLanguage();
  const theme = useMemo(() => createBaitlyTheme({ isRtl }), [isRtl]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [state, setState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Kill-switch Service Worker pour cette page publique.
  //
  // ⚠️ Un ancien SW workbox (avec `navigateFallback: '/index.html'` + html
  // exclu du precache) plante avec `non-precached-url :: [{url:/index.html}]`
  // et bloque toutes les navigations -> logout freeze, requetes annulees.
  // Le bug est fixe dans vite.config.ts mais les users avec un ancien SW en
  // cache ne le verront qu'apres skipWaiting (jamais sur cette page car
  // AppUpdateBanner est dans les routes authentifiees).
  //
  // Solution : sur la page d'invitation (publique, pas besoin d'offline cache),
  // on desinscrit tout SW au mount. Au prochain navigation vers une route
  // authentifiee, vite-plugin-pwa reenregistrera un SW frais avec la bonne config.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length > 0) {
            await Promise.all(regs.map((reg) => reg.unregister()));
            if ('caches' in window) {
              const cacheKeys = await caches.keys();
              await Promise.all(cacheKeys.map((key) => caches.delete(key)));
            }
          }
        } catch {
          // Silent : si le kill-switch echoue, la page peut encore fonctionner
        }
      })();
    }
  }, []);

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

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleAccept = useCallback(async () => {
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
    // One-shot par design : removeItem vide sessionStorage avant tout re-run.
  }, [isAuthenticated, state, invitation, handleAccept]);

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
      keycloak.tokenParsed = decodeJwt(tokens.access_token);

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


  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="min-h-[100vh] flex items-center justify-center p-3" style={{ background: '#f8fafc' }}>
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
          <div className="flex justify-center mb-5">
            <BaitlyWordmark size="lg" />
          </div>

          {/* Loading */}
          {state === 'loading' && (
            <div className="py-6">
              <Spinner className="size-12" />
              <p className="cn-text-body1 text-muted-foreground mt-3">
                Chargement de l'invitation...
              </p>
            </div>
          )}

          {/* Invitation Info */}
          {state === 'info' && invitation && (
            <>
              {/* Hero : "INVITATION" label + nom de l'organisation. Pas de gradient
                  satureee — typographie pure, comme l'email. */}
              <div className="mb-5 text-center">
                <SectionLabel>Invitation</SectionLabel>
                <p className="cn-text-body1 mt-1.5 text-[14px] text-[#64748b] leading-[1.5]">
                  Tu es invite a rejoindre l'organisation
                </p>
                <p className="cn-text-body1 mt-1 text-[22px] font-bold tracking-[-0.01em] text-[#0f172a] leading-[1.2]">
                  {invitation.organizationName}
                </p>
              </div>

              {/* Bloc info : Role + email + expiration, layout aere */}
              <div className="mb-4 border-t border-[#f1f5f9] border-b border-[#f1f5f9] py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1.5">
                  <p className="cn-text-body1 text-[13px] text-[#64748b]">Role</p>
                  <StatusChip
                    tone={getRoleTone(invitation.roleInvited)}
                    label={getRoleLabel(invitation.roleInvited)}
                  />
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <p className="cn-text-body1 text-[13px] text-[#64748b]">Email</p>
                  <p className="cn-text-body1 text-[13px] font-semibold text-[#0f172a] max-w-[60%] overflow-hidden text-ellipsis whitespace-nowrap" title={invitation.invitedEmail}>
                    {invitation.invitedEmail}
                  </p>
                </div>
                {invitation.expiresAt && (
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="cn-text-body1 text-[13px] text-[#64748b]">Expire</p>
                    <p className="cn-text-body1 text-[13px] text-[#475569]">
                      {new Date(invitation.expiresAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {isAuthenticated ? (
                (() => {
                  const currentEmail = keycloak.tokenParsed?.email;
                  const emailMismatch = currentEmail && invitation.invitedEmail
                    && currentEmail.toLowerCase() !== invitation.invitedEmail.toLowerCase();

                  return emailMismatch ? (
                    <div className="flex flex-col gap-2">
                      <Alert severity="warning" sx={{ textAlign: 'left' }}>
                        Vous etes connecte avec <strong>{currentEmail}</strong> mais cette
                        invitation est destinee a <strong>{invitation.invitedEmail}</strong>.
                        Deconnectez-vous pour creer un compte avec le bon email.
                      </Alert>
                      <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        onClick={async () => {
                          sessionStorage.setItem('pending_invitation_token', token!);
                          // ⚠️ Le logout Keycloak seul ne suffit PAS : keycloak.ts
                          // restaure la session au boot via le cookie HttpOnly
                          // `clenzy_auth` (bootstrap via GET /api/auth/session).
                          // On doit donc invalider ce cookie cote backend AVANT le
                          // logout Keycloak.
                          try {
                            await apiClient.delete('/auth/session');
                          } catch {
                            // Silent : meme si le DELETE echoue (cookie deja invalide),
                            // on continue le logout Keycloak.
                          }
                          // Navigation directe vers l'URL Keycloak logout (evite
                          // le freeze potentiel de keycloak.logout() sur cette page
                          // publique : silent-check-sso iframe + service worker
                          // peuvent provoquer un deadlock).
                          const redirectUri = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token!)}`;
                          window.location.href = keycloak.createLogoutUrl({ redirectUri });
                        }}
                        sx={{ py: 1.25, fontWeight: 600, borderRadius: 1.5, textTransform: 'none', fontSize: 14 }}
                      >
                        Se deconnecter et creer un compte
                      </Button>
                    </div>
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
                <div className="flex flex-col gap-2">
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
                </div>
              )}
            </>
          )}

          {/* Register form (inline, plus de redirection Keycloak) */}
          {state === 'register_form' && invitation && (
            <div className="py-1.5 text-start">
              <div className="text-center mb-4">
                <SectionLabel>Creation de compte</SectionLabel>
                <p className="cn-text-body1 mt-2 text-[14px] text-[#475569] leading-[1.5]">
                  Rejoins <strong style={{ color: '#0f172a' }}>{invitation.organizationName}</strong>{' '}
                  en tant que {getRoleLabel(invitation.roleInvited).toLowerCase()}.
                </p>
              </div>

              {error && (
                <BuiAlert variant="destructive" className="mb-3">
                  <TriangleAlert />
                  <AlertDescription>{error}</AlertDescription>
                  <AlertAction>
                    <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
                      <X />
                    </BuiButton>
                  </AlertAction>
                </BuiAlert>
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
                  startIcon={registering ? <Spinner className="size-4" /> : <PersonAdd />}
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
            </div>
          )}

          {/* Accepting */}
          {state === 'accepting' && (
            <div className="py-6">
              <Spinner className="size-12" />
              <p className="cn-text-body1 text-muted-foreground mt-3">
                Acceptation en cours...
              </p>
            </div>
          )}

          {/* Complete Profile */}
          {state === 'complete_profile' && (
            <div className="py-3 text-start">
              <div className="text-center mb-4">
                <span className="inline-flex text-[var(--bui-success-ink)] mb-1.5"><CheckCircle size={48} strokeWidth={1.75} /></span>
                <h6 className="cn-text-h6 font-bold">
                  Completez votre profil
                </h6>
                <p className="cn-text-body2 text-muted-foreground">
                  Vous avez rejoint <strong>{invitation?.organizationName}</strong>.
                  Verifiez vos informations avant de continuer.
                </p>
              </div>

              <div className="flex flex-col gap-3">
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
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleCompleteProfile}
                  disabled={savingProfile}
                  sx={{ py: 1.2, fontWeight: 600, borderRadius: 2 }}
                >
                  {savingProfile ? <Spinner className="size-5" /> : 'Continuer'}
                </Button>
              </div>
            </div>
          )}

          {/* Accepted */}
          {state === 'accepted' && (
            <div className="py-4">
              <span className="inline-flex text-[var(--bui-success-ink)] mb-3"><CheckCircle size={64} strokeWidth={1.75} /></span>
              <h5 className="cn-text-h5 font-bold mb-[0.35em]">
                Bienvenue !
              </h5>
              <p className="cn-text-body1 text-muted-foreground">
                Vous avez rejoint <strong>{invitation?.organizationName}</strong> avec succes.
              </p>
              <p className="cn-text-body2 text-muted-foreground mt-1.5">
                Redirection vers le tableau de bord...
              </p>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="py-4">
              <span className="inline-flex text-destructive mb-3"><ErrorOutline size={64} strokeWidth={1.75} /></span>
              <h6 className="cn-text-h6 font-semibold mb-[0.35em]">
                Invitation non valide
              </h6>
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
            </div>
          )}
        </Paper>
      </div>
    </ThemeProvider>
  );
}
