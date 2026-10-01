import { useEffect, useState } from 'react';
import type { AcademyFormat, AcademyQuality } from '../../data/baitlyAcademyVideos';

/**
 * Format vertical (9:16) : téléphone, ou tablette tenue à la verticale. Sinon 16:9.
 * Même règle sur tout le site ; le lecteur réagit à la rotation de l'écran.
 */
export const ACADEMY_TALL_QUERY = '(max-width: 767px), (orientation: portrait) and (max-width: 1100px)';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/** 720p quand le visiteur économise ses données ou que le réseau est lent ; 1080p sinon. */
export function academyQuality(): AcademyQuality {
  if (typeof navigator === 'undefined') return '1080';
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (connection?.saveData) return '720';
  return ['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '') ? '720' : '1080';
}

export function useAcademyFormat(): AcademyFormat {
  const [tall, setTall] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(ACADEMY_TALL_QUERY);
    const update = () => setTall(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return tall ? '9x16' : '16x9';
}
