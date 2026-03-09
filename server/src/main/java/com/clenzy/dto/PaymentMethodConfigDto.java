package com.clenzy.dto;

import java.util.List;
import java.util.Map;

public record PaymentMethodConfigDto(
    Long id,
    String providerType,
    boolean enabled,
    List<String> countryCodes,
    boolean sandboxMode,
    Map<String, Object> config
) {}
