package com.clenzy.dto;

import java.math.BigDecimal;

public record SplitResult(
    BigDecimal ownerAmount,
    BigDecimal platformAmount,
    BigDecimal conciergeAmount,
    BigDecimal totalAmount,
    Long ownerWalletId,
    Long conciergeWalletId
) {}
