import React, { useState, useEffect } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner, Button } from '../../components/ui';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Field, FieldLabel, FieldDescription, FieldError, Input } from '../../components/ui';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline,
  LockOutlined as LockIcon,
  Login as LoginIcon,
} from '../../icons';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import apiClient, { ApiError } from '../../services/apiClient';
import keycloak, { decodeJwt } from '../../keycloak';
import { setSessionCookie } from '../../services/storageService';

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

const getForfaitShortLabel = (t: TFunction, key: string): string => {
  const fallbacks: Record<string, string> = {
    essentiel: 'Essentiel',
    confort: 'Confort',
    premium: 'Premium',
  };
  return t(`auth.inscriptionConfirm.forfaits.${key}`, fallbacks[key] || key);
};

const FORFAIT_COLORS: Record<string, string> = {
  essentiel: '#6B8A9A',
  confort: '#A6C0CE',
  premium: '#5A7684',
};

export default function InscriptionConfirm() {
  const { t } = useTranslation();
  // Geo-detected language (pas les prefs user) : pays arabes -> ar / Maghreb-France -> fr / autres -> en.
  // Le hook change la langue i18n ; le ThemeProvider + CssBaseline + DirectionProvider
  // montes dans main.tsx suivent cette langue (direction RTL + Tajawal), le doublon
  // local n'apportait donc rien de plus que la dependance MUI.
  useGeoAuthLanguage();
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
      setError(t('auth.inscriptionConfirm.invalidTokenError', 'Lien de confirmation invalide. Aucun token fourni.'));
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
            setError(t('auth.inscriptionConfirm.invalidOrExpiredError', 'Le lien de confirmation est invalide ou a expire.'));
          }
        } else {
          setStatus('error');
          setError(t('auth.inscriptionConfirm.invalidOrExpiredError', 'Le lien de confirmation est invalide ou a expire.'));
        }
      });
  }, [token, t]);

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
      keycloak.tokenParsed = decodeJwt(data.access_token);

      // Session vierge : cookie de session partage avec la landing. Les tokens
      // vivent dans le cookie HttpOnly + keycloak.token.
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
        setError(apiErr.message || t('auth.inscriptionConfirm.submitErrorGeneric', 'Une erreur est survenue. Veuillez reessayer.'));
      }
    }
  };

  return (
      <div className="min-h-[100vh] flex items-center justify-center p-3" style={{ background: 'linear-gradient(135deg, #A6C0CE 0%, #8BA3B3 50%, #6B8A9A 100%)' }}>
        {/* Report de `elevation={8}` : l'ombre exacte de theme.shadows[8]. */}
        <div
          className="w-full max-w-[480px] rounded-[24px] border border-solid border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.95)] p-[18px] text-center backdrop-blur-[10px] min-[600px]:p-6 shadow-[0_5px_5px_-3px_rgba(0,0,0,0.2),0_8px_10px_1px_rgba(0,0,0,0.14),0_3px_14px_2px_rgba(0,0,0,0.12)]"
        >
          {/* Logo */}
          <div className="mb-3">
            <BaitlyMarkLogo scale={1.1} />
          </div>

          {/* Loading */}
          {status === 'loading' && (
            <div className="py-6">
              <Spinner className="size-10 text-[var(--mui-primary)] mb-3" />
              <p className="cn-text-body1 font-medium text-muted-foreground">
                {t('auth.inscriptionConfirm.loadingLink', 'Verification du lien...')}
              </p>
            </div>
          )}

          {/* Formulaire de creation de mot de passe */}
          {(status === 'ready' || status === 'submitting') && info && (
            <div className="py-3 text-start">
              <h5 className="cn-text-h5 font-bold mb-1.5 text-center text-foreground">
                {t('auth.inscriptionConfirm.createPasswordTitle', 'Creez votre mot de passe')}
              </h5>
              <p className="cn-text-body2 text-muted-foreground mb-4 text-center">
                {t('auth.inscriptionConfirm.createPasswordSubtitle', 'Derniere etape pour finaliser votre inscription.')}
              </p>

              {/* Banner avec infos utilisateur */}
              <div className="p-3 rounded-[16px] bg-[rgba(166,192,206,0.1)] border border-[rgba(166,192,206,0.3)] mb-4">
                <p className="cn-text-body2 font-semibold">
                  {info.fullName}
                </p>
                <p className="cn-text-body2 text-muted-foreground">
                  {info.email}
                </p>
                {info.forfait && (
                  <StatusChip tokens={{ color: '#fff', bg: FORFAIT_COLORS[info.forfait] || '#6B8A9A' }} label={t('auth.inscriptionConfirm.forfaitChip', `Forfait ${getForfaitShortLabel(t, info.forfait)}`, {
                      forfait: getForfaitShortLabel(t, info.forfait),
                    })} className="mt-1.5 text-[0.75rem]" />
                )}
              </div>

              {error && (
                <Alert variant="destructive" className="mb-3">
                  <TriangleAlert />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-3">
                <Field>
                  <FieldLabel htmlFor="inscription-password">
                    {t('auth.inscriptionConfirm.passwordLabel', 'Mot de passe *')}
                  </FieldLabel>
                  <Input
                    id="inscription-password"
                    className="w-full"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                  <FieldDescription>
                    {t('auth.inscriptionConfirm.passwordHelper', 'Minimum 8 caracteres')}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="inscription-confirm-password">
                    {t('auth.inscriptionConfirm.confirmPasswordLabel', 'Confirmer le mot de passe *')}
                  </FieldLabel>
                  <Input
                    id="inscription-confirm-password"
                    className="w-full"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={confirmPassword.length > 0 && password !== confirmPassword}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isPasswordValid) {
                        handleSubmit();
                      }
                    }}
                  />
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <FieldError>
                      {t('auth.inscriptionConfirm.passwordMismatch', 'Les mots de passe ne correspondent pas')}
                    </FieldError>
                  )}
                </Field>

                <Button
                  size="lg"
                  className="w-full shrink"
                  onClick={handleSubmit}
                  disabled={!isPasswordValid || status === 'submitting'}
                >
                  {status === 'submitting' ? <Spinner className="size-[18px]" /> : <LockIcon />}
                  {status === 'submitting'
                    ? t('auth.inscriptionConfirm.submitting', 'Creation en cours...')
                    : t('auth.inscriptionConfirm.submit', 'Creer mon mot de passe')}
                </Button>
              </div>
            </div>
          )}

          {/* Succes */}
          {status === 'success' && (
            <div className="py-4">
              {/* L'entree n'etait qu'un scale + fade : les utilitaires
                  d'animation du kit la rendent sans @keyframes ad hoc. */}
              <span className="inline-flex mb-3 text-[var(--ok)] animate-in zoom-in-50 fade-in-0 duration-500 ease-out motion-reduce:animate-none">
                <CheckCircleIcon size={72} strokeWidth={1.75} />
              </span>
              <h5 className="cn-text-h5 font-bold mb-1.5 text-foreground">
                {t('auth.inscriptionConfirm.successTitle', 'Inscription finalisee !')}
              </h5>
              <p className="cn-text-body2 text-muted-foreground mb-3">
                {t('auth.inscriptionConfirm.successBody', 'Votre compte a ete cree avec succes. Redirection vers votre tableau de bord...')}
              </p>
              <Spinner className="size-6 text-[var(--mui-primary)]" />
            </div>
          )}

          {/* Deja finalise */}
          {status === 'already_completed' && (
            <div className="py-4">
              <span className="inline-flex mb-3 text-primary"><CheckCircleIcon size={64} strokeWidth={1.75} color='currentColor' /></span>
              <h6 className="cn-text-h6 font-semibold mb-1.5">
                {t('auth.inscriptionConfirm.alreadyCompletedTitle', 'Inscription deja finalisee')}
              </h6>
              <p className="cn-text-body2 text-muted-foreground mb-4">
                {t('auth.inscriptionConfirm.alreadyCompletedBody', 'Votre compte a deja ete cree. Vous pouvez vous connecter avec vos identifiants.')}
              </p>
              <Button className="px-6" onClick={() => navigate('/login')}>
                <LoginIcon />
                {t('auth.inscriptionConfirm.loginButton', 'Se connecter')}
              </Button>
            </div>
          )}

          {/* Token expire */}
          {status === 'expired' && (
            <div className="py-4">
              <span className="inline-flex text-[var(--bui-warning-ink)] mb-3"><ErrorOutline size={64} strokeWidth={1.75} /></span>
              <h6 className="cn-text-h6 font-semibold mb-1.5">
                {t('auth.inscriptionConfirm.expiredTitle', 'Lien expire')}
              </h6>
              <p className="cn-text-body2 text-muted-foreground mb-4">
                {t('auth.inscriptionConfirm.expiredBody', 'Le lien de confirmation a expire. Veuillez contacter le support pour obtenir un nouveau lien.')}
              </p>
              <Button variant="outline" onClick={() => navigate('/login')}>
                {t('auth.common.backToLogin', 'Retour a la connexion')}
              </Button>
            </div>
          )}

          {/* Erreur generique */}
          {status === 'error' && (
            <div className="py-4">
              <span className="inline-flex text-destructive mb-3"><ErrorOutline size={64} strokeWidth={1.75} /></span>
              <h6 className="cn-text-h6 font-semibold mb-1.5">
                {t('auth.inscriptionConfirm.errorTitle', 'Lien invalide')}
              </h6>
              <p className="cn-text-body2 text-muted-foreground mb-4">
                {error || t('auth.inscriptionConfirm.errorBody', 'Le lien de confirmation est invalide. Veuillez contacter le support.')}
              </p>
              <Button variant="outline" onClick={() => navigate('/login')}>
                {t('auth.common.backToLogin', 'Retour a la connexion')}
              </Button>
            </div>
          )}
        </div>
      </div>
  );
}
