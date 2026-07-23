import { MonitorDownIcon, XIcon } from 'lucide-react';
import { Button } from '../ui';
import { usePWA } from '../../hooks/usePWA';
import { useUserPreference } from '../../hooks/useUserPreference';

/**
 * Baitly — remaster de components/PWAInstallBanner.tsx (MUI).
 * Invite d'installation PWA — dismiss persisté backend (useUserPreference),
 * `forceVisible` pour la démo galerie.
 */
export interface PWAInstallBannerProps {
  forceVisible?: boolean;
}

export default function PWAInstallBanner({ forceVisible = false }: PWAInstallBannerProps) {
  const { canInstall, install } = usePWA();
  const [dismissed, setDismissed, { isLoaded }] = useUserPreference<boolean>(
    'pwa.install_banner_dismissed',
    false
  );

  const eligible = canInstall && isLoaded && !dismissed;
  if (!eligible && !forceVisible) return null;

  return (
    <div
      role="status"
      className={
        forceVisible
          ? 'flex max-w-md items-center gap-3 rounded-xl border border-border bg-popover p-3 shadow-lg'
          : 'fixed bottom-4 inset-x-4 z-[1400] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-popover p-3 shadow-lg'
      }
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
        <MonitorDownIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold text-foreground">Installer Baitly</div>
        <div className="text-xs text-muted-foreground">
          Accès en un clic depuis votre bureau, même hors connexion.
        </div>
      </div>
      <Button size="sm" onClick={() => install()}>
        Installer
      </Button>
      <Button size="icon-xs" variant="ghost" aria-label="Ignorer" onClick={() => setDismissed(true)}>
        <XIcon />
      </Button>
    </div>
  );
}
