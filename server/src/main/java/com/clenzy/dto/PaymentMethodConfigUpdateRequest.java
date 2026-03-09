package com.clenzy.dto;

public record PaymentMethodConfigUpdateRequest(
    Boolean enabled,
    String countryCodes,
    Boolean sandboxMode,
    String apiKey,
    String apiSecret
) {}
