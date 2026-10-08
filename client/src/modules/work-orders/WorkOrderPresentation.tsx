import type { ReactNode } from 'react';
import { ACTION_ILLUSTRATIONS } from '../supervision/core/actionIllustration';

/** Même bibliothèque d'objets que les cartes d'action Baitly. */
export const WORK_ORDER_ART = {
  ...ACTION_ILLUSTRATIONS,
  access: '/images/notifications/access-code.webp',
  people: '/images/notifications/team-directory.webp',
  duration: '/images/portfolio-metrics/time-saved.webp',
  property: '/images/notifications/property.webp',
  bedrooms: '/images/property-metrics/bedrooms.webp',
  bathrooms: '/images/property-metrics/bathrooms.webp',
  surface: '/images/property-metrics/surface.webp',
  capacity: '/images/property-metrics/capacity.webp',
};

export function workOrderArt(type: string) {
  const normalized = type.toUpperCase();
  if (normalized.includes('CLEANING') || normalized === 'DISINFECTION') return WORK_ORDER_ART.cleaning;
  if (normalized.includes('CHECK_IN') || normalized.includes('CHECKIN')) return WORK_ORDER_ART['guest-experience'];
  if (normalized.includes('CHECK_OUT') || normalized.includes('CHECKOUT')) return WORK_ORDER_ART['late-checkout'];
  if (normalized.includes('LAUNDRY') || normalized.includes('LINEN')) return WORK_ORDER_ART['stock-order'];
  return WORK_ORDER_ART.maintenance;
}

export function WorkOrderHeading({ art, title, actions }: { art: string; title: string; actions?: ReactNode }) {
  return <header className="wo-heading">
    <img src={art} alt="" width={40} height={40} decoding="async" />
    <h2>{title}</h2>
    {actions && <div className="wo-heading__actions">{actions}</div>}
  </header>;
}
