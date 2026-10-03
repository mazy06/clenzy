/**
 * Baitly beneficiary onboarding, distinct from payment collection and payout execution.
 *
 * <p>France uses the platform's existing {@code stripe.secret-key}. Creating an Express
 * account uses hosted onboarding; linking an existing Standard account uses OAuth and
 * additionally requires {@code stripe.connect.client-id} (environment: STRIPE_CONNECT_CLIENT_ID).
 * Register both exact OAuth return URLs, replacing the origin with {@code clenzy.base-url}:</p>
 * <ul>
 *   <li>{@code /payment-connect/return?scope=PERSONAL&flow=oauth}</li>
 *   <li>{@code /payment-connect/return?scope=ORGANIZATION&flow=oauth}</li>
 * </ul>
 * <p>The existing signed webhook at {@code /api/webhooks/stripe} must receive connected-account
 * {@code account.updated} and {@code account.application.deauthorized} events. Redis stores
 * only random, single-use authorization states for ten minutes. OAuth tokens and KYC documents
 * are never stored here. Before live activation, exercise creation, existing-account linking,
 * expired links and revocation with Stripe test credentials and registered redirect URLs.</p>
 *
 * <p>Personal connections feed the existing owner/provider payout configurations. Organization
 * connections belong to the concierge organization, never its administrator's personal account.
 * This package does not execute payments or distribute concierge commissions; that separate
 * financial workflow still needs to use the organization beneficiary and reconcile its ledger.</p>
 *
 * <p>Morocco and Saudi Arabia are informational, unavailable states until Baitly has contracted
 * and implemented a local provider. No account creation or payout API is advertised as active.
 * Candidate source pages: https://www.tap.company/en-sa/products/marketplaces,
 * https://aslan.ma/fr/marketplace and https://www.baas.ma/en/partners.
 * The legal beneficiary country is explicit; language and currency never determine eligibility.</p>
 */
package com.clenzy.service.paymentconnect;
