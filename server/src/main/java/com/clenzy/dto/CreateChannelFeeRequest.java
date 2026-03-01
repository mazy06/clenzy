package com.clenzy.dto;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChargeType;
import com.clenzy.model.FeeType;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.Map;

public record CreateChannelFeeRequest(
    @NotNull Long propertyId,
    @NotNull ChannelName channelName,
    @NotNull FeeType feeType,
    @NotNull String name,
    @NotNull BigDecimal amount,
    String currency,
    ChargeType chargeType,
    Boolean isMandatory,
    Boolean isTaxable,
    Map<String, Object> config
) {}
