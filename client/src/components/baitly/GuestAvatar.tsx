import { Avatar, AvatarFallback, AvatarImage } from '../ui';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/GuestAvatar.tsx (MUI), construit sur
 * Avatar. Photo avec repli initiales (mêmes règles d'extraction).
 */
export function getGuestInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export interface GuestAvatarProps {
  name: string;
  photoUrl?: string | null;
  /** Diamètre en px. Défaut : 32. */
  size?: number;
  className?: string;
}

export default function GuestAvatar({ name, photoUrl, size = 32, className }: GuestAvatarProps) {
  return (
    <Avatar className={cn('shrink-0', className)} style={{ width: size, height: size }}>
      {photoUrl && <AvatarImage src={photoUrl} alt={name} />}
      <AvatarFallback style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}>
        {getGuestInitials(name) || '?'}
      </AvatarFallback>
    </Avatar>
  );
}
