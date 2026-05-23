package com.clenzy.dto;

import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.util.IbanMasker;

import java.time.Instant;

/**
 * DTO côté API de {@code OwnerPayoutConfig}.
 *
 * <p>Les champs sensibles (IBAN clair, recipient secret) sont volontairement
 * absents ou masqués. On expose juste les indicateurs d'état nécessaires au
 * frontend pour décider quelle UI afficher (badge "configuré", bouton "init
 * SCA", etc.).</p>
 */
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
        // ─── Wise ───
        /** True si recipient Wise déjà créé (= owner peut recevoir des virements). */
        boolean wiseConfigured,
        // ─── Open Banking ───
        String openBankingProvider,
        boolean openBankingConsentActive,
        Instant openBankingConsentExpiresAt,
        Instant createdAt,
        Instant updatedAt
) {
    public static OwnerPayoutConfigDto from(OwnerPayoutConfig config) {
        boolean openBankingActive = config.getOpenBankingConsentId() != null
            && !config.getOpenBankingConsentId().isBlank()
            && (config.getOpenBankingConsentExpiresAt() == null
                || config.getOpenBankingConsentExpiresAt().isAfter(Instant.now()));

        return new OwnerPayoutConfigDto(
                config.getId(),
                config.getOwnerId(),
                config.getPayoutMethod(),
                config.getStripeConnectedAccountId(),
                config.isStripeOnboardingComplete(),
                IbanMasker.mask(config.getIban()),
                config.getBic(),
                config.getBankAccountHolder(),
                config.isVerified(),
                config.getWiseRecipientId() != null && !config.getWiseRecipientId().isBlank(),
                config.getOpenBankingProvider(),
                openBankingActive,
                config.getOpenBankingConsentExpiresAt(),
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
                null, null, null, false, false, null, false, null, null, null
        );
    }

}
