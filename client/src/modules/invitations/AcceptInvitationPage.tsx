import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert as BuiAlert,
  AlertDescription,
  AlertAction,
  Button as BuiButton,
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
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
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import { setSessionCookie } from '../../services/storageService';

// Brand color Baitly — aligne avec EmailWrapperService.BRAND_PRIMARY.
const BRAND_PRIMARY = '#6B8A9A';

/**
 * Wordmark Baitly minimaliste : meme typo + point colore que l'email.
 * Reutilise dans l'en-tete de la page pour coherence brand cross-channel.
 */
function BaitlyWordmark({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  // La taille n'a que deux valeurs : les deux classes sont ecrites en dur,
  // aucune ne derive d'une variable.
  return (
    <div
      className={cn(
        'font-bold leading-none tracking-[-0.02em] text-foreground select-none',
        size === 'lg' ? 'text-[26px]' : 'text-[18px]',
      )}
    >
      Baitly<span style={{ color: BRAND_PRIMARY }}>.</span>
    </div>
  );
}

/** Petit chip "INVITATION" uppercase letter-spacing — meme style que le sous-titre email. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
  // Geo-detected language (pas les prefs user) : pays arabes -> ar / Maghreb-France -> fr / autres -> en.
  // Le hook est appele pour son EFFET (changeLanguage) : la direction RTL est
  // ensuite portee par le DirectionProvider racine, plus par un theme local.
  useGeoAuthLanguage();
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

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

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
    <div className="min-h-[100vh] flex items-center justify-center p-3 bg-background">
        {/* borderRadius: 2 = 22 px (shape.borderRadius vaut 11 dans ce theme) ;
            p 3 / 4.5 = 18 / 27 px (spacing 6), rupture sm MUI = 600 px. */}
        <div className="w-full max-w-[480px] rounded-3xl border border-solid border-border bg-card p-[18px] min-[600px]:p-[27px] text-start shadow-sm">
          {/* Wordmark Baitly minimaliste (coherent avec l'email d'invitation) */}
          <div className="flex justify-center mb-5">
            <BaitlyWordmark size="lg" />
          </div>

          {/* Loading */}
          {state === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Spinner className="size-12" />
              <p className="text-sm text-muted-foreground">
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
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  Tu es invite a rejoindre l'organisation
                </p>
                <p className="mt-1 text-[22px] font-bold tracking-tight text-foreground leading-[1.2] text-balance">
                  {invitation.organizationName}
                </p>
              </div>

              {/* Bloc info : Role + email + expiration, layout aere */}
              <div className="mb-4 border-y border-border py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1.5">
                  <p className="text-sm text-muted-foreground">Role</p>
                  <StatusChip
                    tone={getRoleTone(invitation.roleInvited)}
                    label={getRoleLabel(invitation.roleInvited)}
                  />
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-sm font-semibold text-foreground max-w-[60%] overflow-hidden text-ellipsis whitespace-nowrap" title={invitation.invitedEmail}>
                    {invitation.invitedEmail}
                  </p>
                </div>
                {invitation.expiresAt && (
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="text-sm text-muted-foreground">Expire</p>
                    <p className="text-sm text-foreground tabular-nums">
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
                      <BuiAlert variant="warning" className="text-start">
                        <TriangleAlert />
                        <AlertDescription>
                          Vous etes connecte avec <strong>{currentEmail}</strong> mais cette
                          invitation est destinee a <strong>{invitation.invitedEmail}</strong>.
                          Deconnectez-vous pour creer un compte avec le bon email.
                        </AlertDescription>
                      </BuiAlert>
                      <BuiButton
                        size="lg"
                        className="w-full"
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
                      >
                        Se deconnecter et creer un compte
                      </BuiButton>
                    </div>
                  ) : (
                    <BuiButton
                      size="lg"
                      className="w-full"
                      onClick={handleAccept}
                    >
                      <PersonAdd />
                      Accepter l'invitation
                    </BuiButton>
                  );
                })()
              ) : (
                <div className="flex flex-col gap-2">
                  {/* MUI donnait "outlined" aux deux actions du meme poids ; dans cette zone
                      creer le compte EST l'action principale, "J'ai deja un compte" n'est
                      qu'un renvoi — d'ou default + ghost plutot que outline + ghost. */}
                  <BuiButton
                    size="lg"
                    className="w-full"
                    onClick={handleRegisterAndAccept}
                  >
                    <PersonAdd />
                    Creer un compte et accepter
                  </BuiButton>
                  <BuiButton
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={handleLoginAndAccept}
                  >
                    <LoginIcon />
                    J'ai deja un compte
                  </BuiButton>
                </div>
              )}
            </>
          )}

          {/* Register form (inline, plus de redirection Keycloak) */}
          {state === 'register_form' && invitation && (
            <div className="py-1.5 text-start">
              <div className="text-center mb-4">
                <SectionLabel>Creation de compte</SectionLabel>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed text-balance">
                  Rejoins <strong className="text-foreground">{invitation.organizationName}</strong>{' '}
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

              <div className="flex flex-col gap-3">
                <div className="flex flex-col min-[600px]:flex-row gap-3">
                  <Field>
                    <FieldLabel htmlFor="invite-first-name">Prenom</FieldLabel>
                    <Input
                      id="invite-first-name"
                      className="w-full"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      autoComplete="given-name"
                      autoFocus
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="invite-last-name">Nom</FieldLabel>
                    <Input
                      id="invite-last-name"
                      className="w-full"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      autoComplete="family-name"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                  <Input
                    id="invite-email"
                    className="w-full"
                    value={invitation.invitedEmail}
                    disabled
                  />
                  <FieldDescription>L'email est defini par l'invitation</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="invite-phone">Telephone</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <Phone size={16} strokeWidth={1.75} />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="invite-phone"
                      placeholder="Ex: +33 6 12 34 56 78"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      autoComplete="tel"
                    />
                  </InputGroup>
                  <FieldDescription>Optionnel — utile pour les notifications SMS</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="invite-password">Mot de passe</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <LockIcon size={16} strokeWidth={1.75} />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="invite-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <VisibilityOff size={16} /> : <Visibility size={16} />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>8 caracteres minimum</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="invite-password-confirm">Confirme le mot de passe</FieldLabel>
                  <Input
                    id="invite-password-confirm"
                    className="w-full"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    aria-invalid={passwordMismatch}
                  />
                  {passwordMismatch && (
                    <FieldError>Les mots de passe ne correspondent pas</FieldError>
                  )}
                </Field>

                <BuiButton
                  size="lg"
                  className="w-full"
                  onClick={handleSubmitRegister}
                  disabled={registering}
                >
                  {registering ? <Spinner className="size-4" /> : <PersonAdd />}
                  {registering ? 'Creation en cours...' : 'Creer mon compte et accepter'}
                </BuiButton>

                <BuiButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setState('info')}
                  disabled={registering}
                >
                  Retour
                </BuiButton>
              </div>
            </div>
          )}

          {/* Accepting */}
          {state === 'accepting' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Spinner className="size-12" />
              <p className="text-sm text-muted-foreground">
                Acceptation en cours...
              </p>
            </div>
          )}

          {/* Complete Profile */}
          {state === 'complete_profile' && (
            <div className="py-3 text-start">
              <div className="text-center mb-4">
                <span className="inline-flex text-success mb-1.5"><CheckCircle size={48} strokeWidth={1.75} /></span>
                <h6 className="text-base font-semibold tracking-tight text-balance">
                  Completez votre profil
                </h6>
                <p className="text-sm text-muted-foreground">
                  Vous avez rejoint <strong>{invitation?.organizationName}</strong>.
                  Verifiez vos informations avant de continuer.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Field>
                  <FieldLabel htmlFor="profile-first-name">Prenom</FieldLabel>
                  <Input
                    id="profile-first-name"
                    className="w-full"
                    value={keycloak.tokenParsed?.given_name || ''}
                    disabled
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="profile-last-name">Nom</FieldLabel>
                  <Input
                    id="profile-last-name"
                    className="w-full"
                    value={keycloak.tokenParsed?.family_name || ''}
                    disabled
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                  <Input
                    id="profile-email"
                    className="w-full"
                    value={keycloak.tokenParsed?.email || invitation?.invitedEmail || ''}
                    disabled
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="profile-phone">Telephone</FieldLabel>
                  <Input
                    id="profile-phone"
                    className="w-full"
                    placeholder="Ex: +33 6 12 34 56 78"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  <FieldDescription>Optionnel — utile pour les notifications SMS</FieldDescription>
                </Field>
              </div>

              <div className="flex gap-2 mt-4">
                <BuiButton
                  className="w-full"
                  onClick={handleCompleteProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? <Spinner className="size-5" /> : 'Continuer'}
                </BuiButton>
              </div>
            </div>
          )}

          {/* Accepted */}
          {state === 'accepted' && (
            <div className="py-4 text-center">
              <span className="inline-flex text-success mb-3"><CheckCircle size={64} strokeWidth={1.75} /></span>
              <h5 className="mb-1 text-base font-semibold tracking-tight text-balance">
                Bienvenue !
              </h5>
              <p className="text-sm text-muted-foreground">
                Vous avez rejoint <strong className="text-foreground">{invitation?.organizationName}</strong> avec succes.
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Redirection vers le tableau de bord...
              </p>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="py-4 text-center">
              <span className="inline-flex text-destructive mb-3"><ErrorOutline size={64} strokeWidth={1.75} /></span>
              <h6 className="mb-1 text-base font-semibold tracking-tight text-balance">
                Invitation non valide
              </h6>
              <BuiAlert variant="destructive" className="mt-3 text-start">
                <TriangleAlert />
                <AlertDescription>{error}</AlertDescription>
              </BuiAlert>
              <BuiButton
                variant="outline"
                className="mt-[18px]"
                onClick={() => navigate('/login', { replace: true })}
              >
                Retour a la connexion
              </BuiButton>
            </div>
          )}
        </div>
    </div>
  );
}
