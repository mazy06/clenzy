import type { ClenzyBookingConfig } from './types';
import { ClenzyWidget } from './ClenzyWidget';

export type { ClenzyBookingConfig, BaitlyTheme } from './types';

/** Global SDK namespace */
const BaitlyBooking = {
  /** Initialize and mount the booking widget */
  init(config: ClenzyBookingConfig): ClenzyWidget {
    const widget = new ClenzyWidget(config);
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
export { ClenzyWidget };
