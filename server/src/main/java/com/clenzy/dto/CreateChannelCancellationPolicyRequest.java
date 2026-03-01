package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.CancellationPolicyType;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record CreateChannelCancellationPolicyRequest(
    @NotNull Long propertyId,
    @NotNull ChannelName channelName,
    @NotNull CancellationPolicyType policyType,
    String name,
    String description,
    List<Map<String, Object>> cancellationRules,
    BigDecimal nonRefundableDiscount,
    Map<String, Object> config
) {}
