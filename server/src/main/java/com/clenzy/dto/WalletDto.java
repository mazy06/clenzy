package com.clenzy.dto;

import java.math.BigDecimal;

public record WalletDto(
    Long id,
    String walletType,
    Long ownerId,
    String currency,
    BigDecimal balance
) {}
