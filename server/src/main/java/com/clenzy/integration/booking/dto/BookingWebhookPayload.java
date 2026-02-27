package com.clenzy.integration.booking.dto;

import java.util.Map;

/**
 * DTO pour les payloads de webhook entrants de Booking.com.
 */
public record BookingWebhookPayload(
        String eventType,
        String hotelId,
        String reservationId,
        Map<String, Object> data,
        String timestamp
) {}
