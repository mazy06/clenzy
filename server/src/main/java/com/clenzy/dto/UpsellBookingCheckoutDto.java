package com.clenzy.dto;

/**
 * Résultat d'un achat d'upsell depuis le booking engine : URL de session Stripe HÉBERGÉE (redirection,
 * comme le checkout réservation) + id de la commande. ≠ {@link UpsellCheckoutDto} (livret = embedded).
 */
public record UpsellBookingCheckoutDto(String checkoutUrl, Long orderId) {}
