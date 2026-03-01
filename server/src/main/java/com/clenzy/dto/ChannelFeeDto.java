package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelFee;
import com.clenzy.model.ChargeType;
import com.clenzy.model.FeeType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

public record ChannelFeeDto(
    Long id,
    Long propertyId,
    ChannelName channelName,
    FeeType feeType,
    String name,
    BigDecimal amount,
    String currency,
    ChargeType chargeType,
    Boolean isMandatory,
    Boolean isTaxable,
    Boolean enabled,
    Map<String, Object> config,
    String syncStatus,
    Instant syncedAt,
    Instant createdAt
) {
    public static ChannelFeeDto from(ChannelFee f) {
        return new ChannelFeeDto(
            f.getId(), f.getPropertyId(), f.getChannelName(), f.getFeeType(),
            f.getName(), f.getAmount(), f.getCurrency(), f.getChargeType(),
            f.getIsMandatory(), f.getIsTaxable(), f.getEnabled(),
            f.getConfig(), f.getSyncStatus(), f.getSyncedAt(), f.getCreatedAt()
        );
    }
}
