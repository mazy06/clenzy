package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.PromotionType;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public record CreateChannelPromotionRequest(
    @NotNull Long propertyId,
    @NotNull ChannelName channelName,
    @NotNull PromotionType promotionType,
    BigDecimal discountPercentage,
    LocalDate startDate,
    LocalDate endDate,
    Map<String, Object> config
) {}
