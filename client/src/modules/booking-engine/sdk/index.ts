import type { BaitlyBookingConfig } from './types';
import { BaitlyWidget } from './BaitlyWidget';

export type { BaitlyBookingConfig, BaitlyTheme } from './types';

/** Global SDK namespace */
const BaitlyBooking = {
  /** Initialize and mount the booking widget */
  init(config: BaitlyBookingConfig): BaitlyWidget {
    const widget = new BaitlyWidget(config);
    widget.mount();
    return widget;
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
