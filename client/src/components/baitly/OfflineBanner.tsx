import { WifiOffIcon } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

/**
 * Baitly — remaster de components/OfflineBanner.tsx (MUI).
 * Bandeau fixe quand la connexion est perdue (useOnlineStatus).
 */
export interface OfflineBannerProps {
  /** Force l'affichage (démo galerie) — en réel, piloté par useOnlineStatus. */
  forceVisible?: boolean;
}

export default function OfflineBanner({ forceVisible = false }: OfflineBannerProps) {
  const { isOnline } = useOnlineStatus();
  if (isOnline && !forceVisible) return null;

  return (
    <div
      role="status"
      className={
        forceVisible
          ? 'flex items-center justify-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium text-warning'
          : 'fixed inset-x-0 top-0 z-[1400] flex items-center justify-center gap-2 bg-warning-soft px-3 py-2 text-sm font-medium text-warning backdrop-blur'
      }
    >
      <WifiOffIcon className="size-4" />
      Connexion perdue — certaines actions sont indisponibles.
    </div>
  );
}
