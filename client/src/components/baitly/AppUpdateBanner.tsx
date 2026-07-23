import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCwIcon, XIcon } from 'lucide-react';
import { Button } from '../ui';

/**
 * Baitly — remaster de components/AppUpdateBanner.tsx (MUI).
 * Bandeau « nouvelle version disponible » (service worker en waiting).
 * En dev le SW est désactivé → jamais visible ; `forceVisible` pour la démo.
 */
export interface AppUpdateBannerProps {
  forceVisible?: boolean;
}

export default function AppUpdateBanner({ forceVisible = false }: AppUpdateBannerProps) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !forceVisible) return null;

  return (
    <div
      role="status"
      className={
        forceVisible
          ? 'flex max-w-md items-center gap-3 rounded-xl border border-border bg-popover p-3 shadow-lg'
          : 'fixed bottom-4 left-1/2 z-[1400] flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-popover p-3 shadow-lg'
      }
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
        <RefreshCwIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold text-foreground">Nouvelle version disponible</div>
        <div className="text-xs text-muted-foreground">
          Recharge pour profiter des dernières améliorations.
        </div>
      </div>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>
        Recharger
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Plus tard"
        onClick={() => setNeedRefresh(false)}
      >
        <XIcon />
      </Button>
    </div>
  );
}
