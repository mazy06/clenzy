package com.clenzy.dto.rate;

import java.math.BigDecimal;

/**
 * DTO pour les ajustements tarifaires par channel (CRUD).
 */
public record ChannelRateModifierDto(
    Long id,
    Long propertyId,
    String channelName,
    String modifierType,
    BigDecimal modifierValue,
    String description,
    Boolean isActive,
    Integer priority,
    String startDate,
    String endDate
) {}
