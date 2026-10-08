import messageSent from '../../public/images/hitl/conversation.webp';
import pricingOptimization from '../../public/images/hitl/pricing-optimization.webp';
import cleaning from '../../public/images/hitl/cleaning.webp';
import travelerForm from '../../public/images/hitl/traveler-form.webp';
import channelSync from '../../public/images/hitl/channel-sync.webp';
import paymentConfirmed from '../../public/images/hitl/payment.webp';
import lateCheckout from '../../public/images/hitl/late-checkout.webp';
import reviews from '../../public/images/hitl/reviews.webp';
import ownerReport from '../../public/images/hitl/owner-report.webp';
import reservation from '../../public/images/hitl/calendar.webp';
import accessCode from '../../public/images/hitl/security.webp';

/** Canonical Baitly action artwork, bundled independently of the PMS asset server. */
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
