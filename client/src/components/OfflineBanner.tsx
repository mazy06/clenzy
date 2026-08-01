import React from 'react';
import { WifiOff as WifiOffIcon } from '../icons';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTranslation } from 'react-i18next';

/**
 * Bannière fixe affichée en haut de l'écran lorsque l'utilisateur est hors ligne.
 * Glisse depuis le haut a l'apparition.
 * Se masque automatiquement lorsque la connexion est rétablie.
 */
export default function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  const { t } = useTranslation();

  if (isOnline) return null;

  // Alerte -soft hairline : fond opaque (card) + couche warn-soft plate.
  // Indices de type (color:/image:) obligatoires : sans eux Tailwind ne sait
  // pas si `bg-[var(--card)]` vise background-color ou background-image.
  // Le Slide MUI portait aussi une sortie animee ; le demontage conditionnel ne
  // peut pas la rejouer, seule l'entree reste animee.
  return (
    <div
        className={
          'fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-1.5 py-1.5 px-3 '
          + 'text-[var(--ink)] bg-[color:var(--card)] bg-[image:linear-gradient(var(--warn-soft),var(--warn-soft))] '
          + '[border-bottom:1px_solid_color-mix(in_srgb,var(--warn)_30%,transparent)] '
          + 'animate-in slide-in-from-top-full duration-200 motion-reduce:animate-none'
        }
      >
        <span className="inline-flex text-[var(--warn)]">
          <WifiOffIcon size={17} strokeWidth={1.75} />
        </span>
        <p className="cn-text-body2 font-semibold text-[12.5px]">
          {t('offline.banner', 'Vous \u00eates hors ligne. Certaines fonctionnalit\u00e9s peuvent ne pas \u00eatre disponibles.')}
        </p>
      </div>
  );
}
