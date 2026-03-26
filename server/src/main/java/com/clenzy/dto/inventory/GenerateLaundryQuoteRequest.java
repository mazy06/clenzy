package com.clenzy.dto.inventory;

public record GenerateLaundryQuoteRequest(
        Long reservationId,
        String notes
) {}
