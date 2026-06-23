import type { BaitlyBookingConfig } from './types';
import { BaitlyWidget } from './BaitlyWidget';
import { hydrateBookingMarkers, type HydrateOptions } from './bootstrap';

export type { BaitlyBookingConfig, BaitlyTheme } from './types';
export type { HydrateOptions } from './bootstrap';

/** Global SDK namespace */
const BaitlyBooking = {
  /** Initialize and mount the booking widget (embed mono-conteneur, monolithe — inchangé). */
  init(config: BaitlyBookingConfig): BaitlyWidget {
    const widget = new BaitlyWidget(config);
    widget.mount();
    return widget;
  },

  /**
   * Hydrate les marqueurs `data-clenzy-widget` présents sur la page (parcours template-driven, B2).
   * Toutes les primitives partagent un cœur d'état persistant ; renvoie le nombre de marqueurs hydratés.
   */
  hydrate(opts: HydrateOptions): number {
    return hydrateBookingMarkers(opts);
  },

  /** SDK version */
  version: '1.0.0',
};

// Expose on window for script-tag usage
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).BaitlyBooking = BaitlyBooking;
}

export default BaitlyBooking;
export { BaitlyWidget };
