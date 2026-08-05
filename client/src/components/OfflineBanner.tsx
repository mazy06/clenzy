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

  // Alerte -soft hairline : fond opaque (card) + couche warning-soft plate.
  // La couche pastel passe par un degrade a une seule teinte : `bg-card` occupe
  // deja la background-color, seul le calque background-IMAGE reste libre pour
  // l'empiler — d'ou l'indice de type `image:` sur la valeur arbitraire.
  // Le Slide MUI portait aussi une sortie animee ; le demontage conditionnel ne
  // peut pas la rejouer, seule l'entree reste animee.
  return (
    <div
        className={
          'fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-1.5 py-1.5 px-3 '
          + 'text-foreground bg-card bg-[image:linear-gradient(var(--bui-warning-soft),var(--bui-warning-soft))] '
          + 'border-b border-solid border-warning/30 '
          + 'animate-in slide-in-from-top-full duration-200 motion-reduce:animate-none'
        }
      >
        <span className="inline-flex text-warning">
          <WifiOffIcon size={17} strokeWidth={1.75} />
        </span>
        <p className="text-xs font-semibold">
          {t('offline.banner', 'Vous \u00eates hors ligne. Certaines fonctionnalit\u00e9s peuvent ne pas \u00eatre disponibles.')}
        </p>
      </div>
  );
}
