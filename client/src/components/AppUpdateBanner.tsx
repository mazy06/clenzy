import React, { useEffect } from 'react';
import { Snackbar, Alert, Button, Box, Typography, useTheme, alpha } from '@mui/material';
// Module virtuel injecte par vite-plugin-pwa au build. Types resolus via
// /// <reference types="vite-plugin-pwa/react" /> dans vite-env.d.ts.
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from '../hooks/useTranslation';

/**
 * Banniere "Nouvelle version disponible — Recharger maintenant".
 *
 * <h2>Pourquoi ce composant</h2>
 * <p>Quand on push un nouveau build (deploy prod), le Service Worker PWA detecte
 * la mise a jour mais ne prend PAS le controle automatiquement (mode
 * {@code registerType: 'prompt'} dans vite.config.ts). Sans ce composant, l'user
 * resterait coince sur l'ancien bundle jusqu'a un hard refresh manuel
 * (Cmd+Shift+R) — friction inacceptable en prod.</p>
 *
 * <h2>Flow</h2>
 * <ol>
 *   <li>Au mount : enregistre le SW + poll toutes les 60 min pour detecter une nouvelle version</li>
 *   <li>Quand {@code needRefresh = true} (nouveau SW en "waiting") : affiche le Snackbar</li>
 *   <li>User clique <b>Plus tard</b> : on cache le Snackbar mais on garde le SW en waiting</li>
 *   <li>User clique <b>Recharger maintenant</b> : on appelle {@code updateServiceWorker(true)}
 *       qui envoie SKIP_WAITING au SW + reload la page automatiquement</li>
 * </ol>
 *
 * <h2>Comportement en dev</h2>
 * <p>Vite n'installe pas de SW en mode dev par defaut (pas de {@code devOptions.enabled}
 * dans vite.config.ts). Donc {@code useRegisterSW} ne declenchera jamais
 * {@code needRefresh} en dev — le composant rend null silencieusement.</p>
 *
 * <h2>Placement</h2>
 * <p>A monter au niveau RACINE de l'app (au-dessus du Router) pour que la
 * banniere soit visible quelque soit la route active. Recommande : dans
 * {@code main.tsx} a cote du {@code <RouterProvider />}.</p>
 */
export default function AppUpdateBanner() {
  const { t } = useTranslation();
  const theme = useTheme();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    /**
     * Callback execute au mount, une fois le SW enregistre. On set un interval
     * qui force le SW a verifier le serveur toutes les 60 min pour detecter
     * une nouvelle version meme sur les sessions longues (ex: PMS ouvert toute
     * la journee dans un onglet).
     *
     * Sans ce poll, l'user ne verrait la nouvelle version qu'au prochain
     * refresh complet du tab — peut prendre des jours pour les power users.
     */
    onRegisteredSW(swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      if (!registration) return;
      const POLL_INTERVAL_MS = 60 * 60 * 1000; // 60 min
      setInterval(async () => {
        try {
          // registration.update() force le browser a re-fetch le SW script.
          // Si une nouvelle version existe, l'event onNeedRefresh sera trigger.
          await registration.update();
        } catch {
          // Silent — un poll qui echoue n'est pas critique
        }
      }, POLL_INTERVAL_MS);
    },
    onRegisterError(error: unknown) {
      // Console only — pas critique pour l'UX
      console.error('Erreur registration Service Worker PWA:', error);
    },
  });

  // Si le SW est desactive (dev, ou erreur d'install) : never affiche le Snackbar
  useEffect(() => {
    // Aucun setup particulier — useRegisterSW gere tout en interne
  }, []);

  const handleReload = () => {
    // updateServiceWorker(true) :
    //   - true = reload la page apres skip waiting
    //   - false = juste skip waiting (page reste sur l'ancien JS, fragile)
    void updateServiceWorker(true);
  };

  const handleLater = () => {
    setNeedRefresh(false);
    // Le SW reste en waiting. Au prochain mount du composant (ex: navigation
    // SPA qui recree l'arbre), si needRefresh redevient true (cas rare), on
    // re-affichera la banniere. Plus probable : prochain reload manuel de
    // l'user activera le nouveau SW naturellement.
  };

  if (!needRefresh) return null;

  return (
    <Snackbar
      open={needRefresh}
      // Stay open until user clicks — pas d'autoHide
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{
        // Z-index au-dessus des Dialogs MUI (qui sont a 1300 par defaut) pour
        // garantir que la banniere reste visible meme si une modale est ouverte
        zIndex: 1500,
      }}
    >
      <Alert
        severity="info"
        variant="filled"
        sx={{
          // Style brand Baitly : pas le bleu MUI defaut, le primary du theme
          bgcolor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          '& .MuiAlert-icon': { color: theme.palette.primary.contrastText },
          minWidth: 320,
          boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.18)}`,
          borderRadius: 2,
          alignItems: 'center',
        }}
        action={
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Button
              size="small"
              onClick={handleLater}
              sx={{
                color: alpha(theme.palette.primary.contrastText, 0.85),
                '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.08) },
                textTransform: 'none',
                fontWeight: 500,
              }}
            >
              {t('appUpdate.later', 'Plus tard')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={handleReload}
              sx={{
                color: theme.palette.primary.contrastText,
                borderColor: alpha(theme.palette.primary.contrastText, 0.6),
                '&:hover': {
                  borderColor: theme.palette.primary.contrastText,
                  bgcolor: alpha(theme.palette.common.white, 0.12),
                },
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {t('appUpdate.reload', 'Recharger maintenant')}
            </Button>
          </Box>
        }
      >
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {t('appUpdate.message', 'Une nouvelle version est disponible.')}
        </Typography>
      </Alert>
    </Snackbar>
  );
}
