import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { CheckCircle, ErrorOutline } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  whatsAppConfigApi,
  type MetaAppConfig,
  type MetaSignupResult,
} from '../../../services/api/whatsAppConfigApi';

// ─── Types globaux SDK Facebook ────────────────────────────────────────
// Le SDK FB JS injecte window.FB et window.fbAsyncInit. On les declare ici
// pour TS sans avoir besoin d'installer un @types/* dedie.
declare global {
  interface Window {
    FB?: {
      init: (opts: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: FBLoginResponse) => void,
        opts: {
          config_id: string;
          response_type: 'code';
          override_default_response_type?: boolean;
          extras?: Record<string, unknown>;
        }
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

interface FBLoginResponse {
  authResponse?: {
    code?: string;
    accessToken?: string;
    userID?: string;
  };
  status?: 'connected' | 'not_authorized' | 'unknown';
}

/**
 * Bouton "Connecter avec Facebook" qui lance le flow Meta Embedded Signup.
 *
 * <h2>Flow</h2>
 * <ol>
 *   <li>Au mount : charge le SDK FB JS depuis connect.facebook.net (si pas deja)</li>
 *   <li>Recupere la config Meta depuis le backend (appId + configId)</li>
 *   <li>FB.init avec les params</li>
 *   <li>User clique : FB.login(callback, {config_id, response_type: 'code'})</li>
 *   <li>Popup Meta s'ouvre (login + signup + permissions)</li>
 *   <li>Callback recoit { authResponse: { code } }</li>
 *   <li>POST /api/whatsapp/meta/oauth-callback { code }</li>
 *   <li>Success : appel onSuccess(result) pour reload la config parent</li>
 * </ol>
 *
 * <h2>Fallback gracieux</h2>
 * Si la Meta App n'est pas encore approuvee (META_APP_ID vide cote serveur),
 * l'appel /app-config retourne 503. On cache alors le bouton et on laisse
 * le parent afficher le form manuel.
 */
export interface MetaEmbeddedSignupButtonProps {
  /** Callback appele quand le signup reussit. Le parent doit reload la config. */
  onSuccess: (result: MetaSignupResult) => void;
}

const FB_SDK_SCRIPT_ID = 'facebook-jssdk';

export default function MetaEmbeddedSignupButton({ onSuccess }: MetaEmbeddedSignupButtonProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  // Config Meta app lue uniquement dans le handler de lancement : ref.
  const appConfigRef = useRef<MetaAppConfig | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<MetaSignupResult | null>(null);

  // Ref pour eviter de re-init le SDK si le composant remount
  const fbInitialisedRef = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  /**
   * Charge le script SDK FB une fois (puis cache pour les remounts).
   * Le SDK injecte window.FB une fois pret + appelle window.fbAsyncInit si defini.
   */
  const loadFbSdk = useCallback((appId: string, version: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Deja charge ?
      if (window.FB && fbInitialisedRef.current) {
        resolve();
        return;
      }
      // Script tag deja en cours de chargement (par un autre mount) ?
      if (document.getElementById(FB_SDK_SCRIPT_ID)) {
        // Attendre que fbAsyncInit ait tourne
        const interval = window.setInterval(() => {
          if (window.FB) {
            window.clearInterval(interval);
            resolve();
          }
        }, 100);
        // Safety timeout 10s
        window.setTimeout(() => {
          window.clearInterval(interval);
          if (!window.FB) reject(new Error('SDK FB timeout'));
        }, 10_000);
        return;
      }

      // window.fbAsyncInit DOIT etre defini AVANT que le script charge —
      // c'est le hook standard du SDK FB pour faire FB.init.
      window.fbAsyncInit = () => {
        try {
          window.FB!.init({
            appId,
            cookie: true,
            xfbml: false, // Pas besoin de parser des widgets XFBML cote Baitly
            version,
          });
          fbInitialisedRef.current = true;
          resolve();
        } catch (e) {
          reject(e);
        }
      };

      const script = document.createElement('script');
      script.id = FB_SDK_SCRIPT_ID;
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () => reject(new Error('Impossible de charger le SDK Facebook'));
      document.body.appendChild(script);
    });
  }, []);

  // Mount : recupere la config, charge le SDK
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const cfg = await whatsAppConfigApi.getMetaAppConfig();
        if (cancelled) return;
        appConfigRef.current = cfg;
        await loadFbSdk(cfg.appId, cfg.graphApiVersion);
        if (cancelled) return;
        setSdkReady(true);
      } catch (e) {
        if (!cancelled) {
          const status = (e as { status?: number })?.status;
          if (status === 503) {
            // Meta App pas configuree cote serveur — on cache le bouton.
            // Le parent affichera le form manuel.
            setError('UNAVAILABLE');
          } else {
            setError(e instanceof Error ? e.message : 'Erreur de chargement');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFbSdk]);

  const handleSignup = useCallback(() => {
    const appConfig = appConfigRef.current;
    if (!appConfig || !window.FB) return;
    setSigningIn(true);
    setError(null);

    window.FB.login(
      async (response: FBLoginResponse) => {
        const code = response?.authResponse?.code;
        if (!code) {
          setSigningIn(false);
          // status=unknown ou not_authorized = user a ferme la popup ou refuse
          if (response?.status === 'not_authorized') {
            setError(t('settings.whatsapp.meta.signup.denied',
              "Vous avez refusé les permissions. Baitly ne peut pas configurer WhatsApp sans elles."));
          }
          // status=unknown ferme silencieusement — pas d'error message
          return;
        }

        try {
          const result = await whatsAppConfigApi.completeMetaOAuth(code);
          setSuccess(result);
          onSuccessRef.current(result);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Erreur lors de la finalisation');
        } finally {
          setSigningIn(false);
        }
      },
      {
        config_id: appConfig.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { feature: 'whatsapp_embedded_signup' },
      }
    );
  }, [t]);

  // ─── Rendus ─────────────────────────────────────────────────────

  // Meta App pas configuree cote serveur : on rend rien (parent affichera fallback manuel)
  if (error === 'UNAVAILABLE') return null;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">
          {t('settings.whatsapp.meta.signup.loading', 'Initialisation du SDK Facebook…')}
        </Typography>
      </Box>
    );
  }

  if (success) {
    return (
      <Alert severity="success" icon={<CheckCircle size={20} />}>
        <strong>{t('settings.whatsapp.meta.signup.success', 'WhatsApp connecté avec succès')}</strong>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {t('settings.whatsapp.meta.signup.successDetails',
            "Numéro {{phoneNumber}} — WABA {{wabaId}}. Vous pouvez maintenant activer l'envoi WhatsApp.",
            { phoneNumber: success.phoneNumber, wabaId: success.wabaId })}
        </Typography>
        {success.templatesSubmitted > 0 && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {t('settings.whatsapp.meta.signup.templatesSubmitted',
              "✓ {{count}} templates Baitly standards soumis à Meta (validation ~24h).",
              { count: success.templatesSubmitted })}
          </Typography>
        )}
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          disableElevation
          onClick={handleSignup}
          disabled={!sdkReady || signingIn}
          startIcon={
            signingIn ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              // Icone Facebook simple en SVG inline (pas besoin d'ajouter au barrel icons)
              <Box
                component="svg"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                sx={{ width: 16, height: 16, fill: 'currentColor' }}
              >
                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
              </Box>
            )
          }
          sx={{
            bgcolor: '#1877F2', // Facebook brand blue (exception au theme — c'est leur identite)
            '&:hover': { bgcolor: '#166FE5' },
            textTransform: 'none',
            fontWeight: 600,
          }}
          size="small"
        >
          {signingIn
            ? t('settings.whatsapp.meta.signup.inProgress', 'Connexion en cours…')
            : t('settings.whatsapp.meta.signup.cta', 'Connecter avec Facebook')}
        </Button>
        <Typography variant="caption" color="text.secondary">
          {t('settings.whatsapp.meta.signup.hint',
            "~5 min · Configuration auto du WhatsApp Business + templates")}
        </Typography>
      </Box>

      {error && error !== 'UNAVAILABLE' && (
        <Alert severity="error" icon={<ErrorOutline size={20} />} onClose={() => setError(null)} sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      <Box sx={{
        mt: 0.5,
        p: 1.25,
        borderRadius: 1.5,
        bgcolor: alpha(theme.palette.info.main, 0.06),
        border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
      }}>
        <Typography variant="caption" color="text.secondary">
          <strong>{t('settings.whatsapp.meta.signup.recommendedTitle', 'Méthode recommandée')}</strong>
          {' — '}
          {t('settings.whatsapp.meta.signup.recommendedBody',
            "Pas de Meta Business Manager nécessaire en amont. Baitly provisionne tout pour vous : compte WhatsApp Business, vérification du numéro, templates de messages.")}
        </Typography>
      </Box>
    </Box>
  );
}
