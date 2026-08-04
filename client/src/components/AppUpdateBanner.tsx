import React, { useEffect } from 'react';
import { Info } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, Button } from './ui';
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
 *   <li>Quand {@code needRefresh = true} (nouveau SW en "waiting") : affiche la banniere</li>
 *   <li>User clique <b>Plus tard</b> : on cache la banniere mais on garde le SW en waiting</li>
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

  // Si le SW est desactive (dev, ou erreur d'install) : never affiche la banniere
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

  // Ce n'est PAS un toast : la banniere reste jusqu'au choix de l'utilisateur et
  // porte deux actions, elle garde donc son propre ancrage flottant plutot que de
  // passer par useNotification. z-index 1500 = au-dessus des modales (1300), pour
  // rester visible meme quand une modale est ouverte.
  return (
    <div className="fixed bottom-3 left-1/2 z-[1500] -translate-x-1/2 px-3">
      {/* Fond OPAQUE sous l'alerte : la teinte `info` du primitif est translucide
          et la banniere flotte au-dessus du contenu de la page. Le liseré et
          l'ombre pop vivent sur cette coque pour ne pas se battre avec le
          `border-transparent` de la variante. */}
      <div className="min-w-[320px] overflow-hidden rounded-[12px] border border-solid border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[var(--card)] shadow-[var(--shadow-pop)]">
        <Alert variant="info" className="items-center">
          <Info />
          <AlertDescription>
            <p className="cn-text-body2 text-[12.5px] font-semibold text-[var(--ink)]">
              {t('appUpdate.message', 'Une nouvelle version est disponible.')}
            </p>
          </AlertDescription>
          <AlertAction>
            <div className="flex gap-0.5 items-center">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLater}
              >
                {t('appUpdate.later', 'Plus tard')}
              </Button>
              <Button
                size="sm"
                onClick={handleReload}
              >
                {t('appUpdate.reload', 'Recharger maintenant')}
              </Button>
            </div>
          </AlertAction>
        </Alert>
      </div>
    </div>
  );
}
