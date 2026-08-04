import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../utils/cn';
import { Button } from './ui';
import { Close as CloseIcon, GetApp as GetAppIcon } from '../icons';
import { usePWA } from '../hooks/usePWA';
import { useUserPreference } from '../hooks/useUserPreference';

const LEGACY_DISMISS_KEY = 'pwa-banner-dismissed-at';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function PWAInstallBanner() {
  const { canInstall, install } = usePWA();
  // Persiste backend (user_ui_preferences) — la decision "ne pas reproposer
  // l'installation PWA pendant 7j" suit l'utilisateur cross-devices. Note :
  // `canInstall` reste device-specific (depend du browser + manifest), donc
  // si le banner est dismissed sur device A et que l'user ouvre l'app sur
  // device B PWA-capable, on respecte le delai de 7j la aussi.
  const [dismissedAt, setDismissedAt, { isLoaded }] = useUserPreference<number | null>(
    'pwa.installBannerDismissedAt',
    null,
  );
  const [visible, setVisible] = useState(false);

  // Migration legacy (BUG-4) : recupere le timestamp dismissed depuis
  // l'ancienne cle localStorage et le pousse vers backend une seule fois.
  // Gate sur `isLoaded` pour eviter d'ecraser une valeur backend existante
  // (dismissed=null explicite signifiant "re-proposer maintenant").
  const migrationDoneRef = useRef(false);
  useEffect(() => {
    if (migrationDoneRef.current || !isLoaded) return;
    if (dismissedAt !== null) {
      migrationDoneRef.current = true;
      try { localStorage.removeItem(LEGACY_DISMISS_KEY); } catch { /* noop */ }
      return;
    }
    try {
      const legacy = localStorage.getItem(LEGACY_DISMISS_KEY);
      if (legacy) {
        const ts = Number(legacy);
        if (Number.isFinite(ts)) {
          migrationDoneRef.current = true;
          setDismissedAt(ts);
          localStorage.removeItem(LEGACY_DISMISS_KEY);
          return;
        }
      }
      migrationDoneRef.current = true;
    } catch {
      migrationDoneRef.current = true;
    }
  }, [isLoaded, dismissedAt, setDismissedAt]);

  useEffect(() => {
    if (!canInstall) {
      setVisible(false);
      return;
    }

    // Check if user dismissed the banner recently
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DURATION_MS) {
      return;
    }

    setVisible(true);
  }, [canInstall, dismissedAt]);

  const handleInstall = async () => {
    await install();
    setVisible(false);
  };

  const handleDismiss = () => {
    setDismissedAt(Date.now());
    setVisible(false);
  };

  return (
    // Le Slide MUI (montage/demontage anime) devient une translation CSS :
    // `invisible` sort le panneau du flux de tabulation quand il est masque.
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 z-[1300] mx-auto max-w-[600px] p-3 flex items-center gap-3',
        // Panneau flottant : hairline + ombre pop (jamais d'aplat accent)
        'rounded-[14px] border border-solid border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow-pop)]',
        'transition-[transform,opacity,visibility] duration-300 ease-out motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100 visible' : 'translate-y-[150%] opacity-0 invisible pointer-events-none',
      )}
    >
      <span className="inline-flex shrink-0 text-[var(--accent)]">
        <GetAppIcon size={26} strokeWidth={1.75} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="cn-text-body1 truncate font-[family-name:var(--font-display)] text-[13.5px] font-semibold text-[var(--ink)]">
          Installer Baitly PMS
        </p>
        <p className="cn-text-body1 text-[12px] text-[var(--muted)]">
          Installez l'application sur votre appareil pour un acc&egrave;s rapide.
        </p>
      </div>
      <Button
        size="sm"
        onClick={handleInstall}
        className="shrink-0"
      >
        Installer
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleDismiss}
        className="shrink-0"
        aria-label="Fermer"
      >
        <CloseIcon size={16} strokeWidth={1.75} />
      </Button>
    </div>
  );
}
