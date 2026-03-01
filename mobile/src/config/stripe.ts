/**
 * Stripe Configuration for mobile native payments
 */

export const STRIPE_CONFIG = {
  // Publishable key - safe to expose in client-side code
  // In production, this should be loaded from environment variables or fetched from the backend
  publishableKey: __DEV__
    ? 'pk_test_51QRsKVAcz2KVTG4uiwjYrKEXZhwKPDvopnPJag9ESkO3a8FehPbt3Y5pxDpX00sR0ATwj2suK8lI4rBE7aXZlqD700PBD31nrL'
    : 'pk_live_REPLACE_WITH_YOUR_LIVE_KEY',

  // Apple Pay merchant identifier (must match app.json and Apple Developer portal)
  merchantIdentifier: 'merchant.com.clenzy.mobile',

  // Merchant country code for Apple Pay / Google Pay
  merchantCountryCode: 'FR',

  // Merchant display name shown in the Payment Sheet
  merchantDisplayName: 'Clenzy',
} as const;
