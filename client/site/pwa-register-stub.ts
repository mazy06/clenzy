/**
 * Stub de `virtual:pwa-register/react` pour le site marketing.
 * Le site n'a pas de service worker (pas de VitePWA dans vite.site.config) ;
 * ce stub satisfait les projections embarquées qui importent AppUpdateBanner.
 */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (v: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (v: boolean) => void],
    updateServiceWorker: (_reloadPage?: boolean) => Promise.resolve(),
  };
}
