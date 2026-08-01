import type { CSSProperties } from 'react';

/** Initiales d'un voyageur (max 2 lettres) pour le repli de l'avatar. */
export function getGuestInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface GuestAvatarProps {
  /** Nom du voyageur (sert aux initiales de repli). */
  name: string;
  /** Photo de profil. Absente ou en échec de chargement → repli sur les initiales. */
  photoUrl?: string | null;
  /** Diamètre du cercle en px. */
  size?: number;
  /** Style du cercle : fond, bordure, couleur/typo des initiales. Le nom `sx` est
   *  conserve car des appelants hors migration le passent encore ; la valeur est
   *  desormais un style CSS applique tel quel, plus un objet MUI. */
  sx?: CSSProperties;
}

/**
 * Avatar voyageur unifié (brique planning, popover récap, panneau de détail) :
 * affiche la photo de profil si disponible, sinon les initiales. La photo
 * recouvre le cercle (`object-fit: cover`) ; en cas d'erreur de chargement,
 * elle se masque (`onError`) et les initiales redeviennent visibles.
 */
export default function GuestAvatar({ name, photoUrl, size = 26, sx }: GuestAvatarProps) {
  return (
    <div
      className="relative overflow-hidden rounded-full shrink-0 flex items-center justify-center font-bold"
      style={{ width: size, height: size, ...sx }}
    >
      {getGuestInitials(name)}
      {photoUrl && (
        <img className="absolute inset-[0px] w-full h-full object-cover rounded-[50%]" src={photoUrl} alt="" loading="lazy" onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }} />
      )}
    </div>
  );
}
