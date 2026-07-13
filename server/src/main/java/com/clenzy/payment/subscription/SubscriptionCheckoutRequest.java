package com.clenzy.payment.subscription;

import java.util.Map;

/**
 * Requête de création d'un checkout d'abonnement récurrent, indépendante du provider
 * (ADR paiement multi-provider, Vague 3 — décision D1 : port abonnement dédié).
 *
 * <p>Couvre les deux flux SaaS existants : inscription (embarqué, coupon) et upgrade
 * de forfait (hébergé, customer existant). Les metadata sont posées à la fois sur la
 * session de checkout ET sur l'abonnement (pour les événements futurs : {@code invoice.paid},
 * {@code customer.subscription.deleted}…).</p>
 *
 * @param unitAmountMinor       prix récurrent en plus petite unité (centimes) — exact, pas de conversion
 * @param currency             devise ISO
 * @param interval             intervalle de facturation
 * @param intervalCount        nombre d'intervalles par période (ex. 2 → tous les 2 mois)
 * @param productName          libellé produit affiché
 * @param productDescription   description produit
 * @param customerEmail        email client (si pas de {@code customerId})
 * @param customerId           identifiant client provider existant (nullable)
 * @param embedded             checkout embarqué (clientSecret + {@code returnUrl}) vs hébergé (redirection)
 * @param successOrReturnUrl   URL de retour (embarqué) ou de succès (hébergé)
 * @param cancelUrl            URL d'annulation (hébergé uniquement ; null en embarqué)
 * @param couponId             coupon/réduction provider à appliquer (nullable)
 * @param metadata             metadata posées sur la session ET l'abonnement
 */
public record SubscriptionCheckoutRequest(
    long unitAmountMinor,
    String currency,
    SubscriptionInterval interval,
    long intervalCount,
    String productName,
    String productDescription,
    String customerEmail,
    String customerId,
    boolean embedded,
    String successOrReturnUrl,
    String cancelUrl,
    String couponId,
    Map<String, String> metadata
) {}
