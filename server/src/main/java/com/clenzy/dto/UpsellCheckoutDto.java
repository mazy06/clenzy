package com.clenzy.dto;

/** Réponse de création de paiement upsell : clientSecret Stripe (embedded) + id de commande. */
public record UpsellCheckoutDto(String clientSecret, Long orderId) {}
