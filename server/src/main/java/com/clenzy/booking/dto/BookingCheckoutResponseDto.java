package com.clenzy.booking.dto;

/**
 * Reponse contenant l'URL Stripe Checkout pour redirection.
 */
public record BookingCheckoutResponseDto(
    String checkoutUrl,
    String sessionId
) {}
