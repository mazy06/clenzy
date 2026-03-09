package com.clenzy.payment;

import java.math.BigDecimal;
import java.util.Map;

public record PayoutRequest(
    BigDecimal amount,
    String currency,
    String destinationAccount,
    String description,
    Map<String, String> metadata
) {}
