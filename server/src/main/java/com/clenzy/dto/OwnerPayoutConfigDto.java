package com.clenzy.dto;

import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;

import java.time.Instant;

public record OwnerPayoutConfigDto(
        Long id,
        Long ownerId,
        PayoutMethod payoutMethod,
        String stripeConnectedAccountId,
        boolean stripeOnboardingComplete,
        String maskedIban,
        String bic,
        String bankAccountHolder,
        boolean verified,
        Instant createdAt,
        Instant updatedAt
) {
    public static OwnerPayoutConfigDto from(OwnerPayoutConfig config) {
        return new OwnerPayoutConfigDto(
                config.getId(),
                config.getOwnerId(),
                config.getPayoutMethod(),
                config.getStripeConnectedAccountId(),
                config.isStripeOnboardingComplete(),
                maskIban(config.getIban()),
                config.getBic(),
                config.getBankAccountHolder(),
                config.isVerified(),
                config.getCreatedAt(),
                config.getUpdatedAt()
        );
    }

    /**
     * Returns a default empty config DTO for an owner that has no config yet.
     */
    public static OwnerPayoutConfigDto empty(Long ownerId) {
        return new OwnerPayoutConfigDto(
                null, ownerId, PayoutMethod.MANUAL, null, false,
                null, null, null, false, null, null
        );
    }

    private static String maskIban(String iban) {
        if (iban == null || iban.length() < 4) return null;
        return "****" + iban.substring(iban.length() - 4);
    }
}
