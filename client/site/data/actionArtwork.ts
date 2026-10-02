import messageSent from '../assets/illustrations/actions/message-sent.webp';
import pricingOptimization from '../assets/illustrations/actions/pricing-optimization.webp';
import cleaning from '../assets/illustrations/actions/cleaning.webp';
import travelerForm from '../assets/illustrations/actions/traveler-form.webp';
import channelSync from '../assets/illustrations/actions/channel-sync.webp';
import paymentConfirmed from '../assets/illustrations/actions/payment-confirmed.webp';
import lateCheckout from '../assets/illustrations/actions/late-checkout.webp';
import reviews from '../assets/illustrations/actions/reviews.webp';
import ownerReport from '../assets/illustrations/actions/owner-report.webp';
import reservation from '../assets/illustrations/actions/reservation.webp';
import accessCode from '../assets/illustrations/actions/access-code.webp';

/** Site-owned copies of Baitly artwork, independent of the PMS asset server. */
export const SITE_ACTION_ARTWORK = {
  messageSent,
  pricingOptimization,
  cleaning,
  travelerForm,
  channelSync,
  paymentConfirmed,
  lateCheckout,
  reviews,
  ownerReport,
  reservation,
  accessCode,
} as const;
