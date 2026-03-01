package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelPromotion;
import com.clenzy.model.PromotionStatus;
import com.clenzy.model.PromotionType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

public record ChannelPromotionDto(
    Long id,
    Long propertyId,
    ChannelName channelName,
    PromotionType promotionType,
    Boolean enabled,
    Map<String, Object> config,
    BigDecimal discountPercentage,
    LocalDate startDate,
    LocalDate endDate,
    PromotionStatus status,
    String externalPromotionId,
    Instant syncedAt,
    Instant createdAt
) {
    public static ChannelPromotionDto from(ChannelPromotion p) {
        return new ChannelPromotionDto(
            p.getId(), p.getPropertyId(), p.getChannelName(), p.getPromotionType(),
            p.getEnabled(), p.getConfig(), p.getDiscountPercentage(),
            p.getStartDate(), p.getEndDate(), p.getStatus(),
            p.getExternalPromotionId(), p.getSyncedAt(), p.getCreatedAt()
        );
    }
}
