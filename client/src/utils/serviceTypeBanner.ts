/**
 * Utilitaire de mapping des types de demande de service vers les images bannières.
 * Les images sont dans client/src/assets/images/.
 * Vite résout les imports statiques en URLs build-time.
 *
 * Catégories :
 *   - Ménage (cleaning) → menage.png
 *   - Maintenance / Réparation → maintenance.png
 *   - Autres (gardening, pest_control, other) → maintenance.png (fallback)
 */

import menageImg from '../assets/images/menage.png';
import maintenanceImg from '../assets/images/maintenance.png';

const CLEANING_TYPES = [
  'cleaning',
  'express_cleaning',
  'deep_cleaning',
  'window_cleaning',
  'floor_cleaning',
  'kitchen_cleaning',
  'bathroom_cleaning',
  'exterior_cleaning',
  'disinfection',
];

/**
 * Retourne l'URL de l'image bannière correspondant au type de demande de service.
 * - Types ménage → menage.png
 * - Tous les autres (maintenance, réparation, jardinage…) → maintenance.png
 */
export function getServiceTypeBannerUrl(serviceType: string): string {
  const normalizedType = serviceType.toLowerCase();

  if (CLEANING_TYPES.includes(normalizedType)) {
    return menageImg;
  }

  return maintenanceImg;
}
