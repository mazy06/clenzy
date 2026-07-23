import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Fusion de classes Tailwind pour la bibliothèque Baitly UI (components/ui).
 * clsx compose les classes conditionnelles, tailwind-merge résout les
 * conflits d'utilities (la dernière gagne : cn('p-2', 'p-4') → 'p-4').
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
