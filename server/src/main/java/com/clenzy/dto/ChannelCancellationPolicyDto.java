package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.CancellationPolicyType;
import com.clenzy.model.ChannelCancellationPolicy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record ChannelCancellationPolicyDto(
    Long id,
    Long propertyId,
    ChannelName channelName,
    CancellationPolicyType policyType,
    String name,
    String description,
    List<Map<String, Object>> cancellationRules,
    BigDecimal nonRefundableDiscount,
    Boolean enabled,
    Map<String, Object> config,
    String syncStatus,
    Instant syncedAt,
    Instant createdAt
) {
    public static ChannelCancellationPolicyDto from(ChannelCancellationPolicy p) {
        return new ChannelCancellationPolicyDto(
            p.getId(), p.getPropertyId(), p.getChannelName(), p.getPolicyType(),
            p.getName(), p.getDescription(), p.getCancellationRules(),
            p.getNonRefundableDiscount(), p.getEnabled(),
            p.getConfig(), p.getSyncStatus(), p.getSyncedAt(), p.getCreatedAt()
        );
    }
}
