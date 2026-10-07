package com.clenzy.dto;

import com.clenzy.model.HousekeeperPayoutRecord;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs des versements Baitly aux prestataires de tous les métiers.
 * Records immuables, mapping explicite — jamais d'entité exposée.
 */
public final class HousekeeperPayoutDtos {

    private HousekeeperPayoutDtos() {
    }

    /** Statut d'onboarding + historique des versements du pro. */
    public record MyPayoutsDto(
            boolean accountCreated,
            boolean onboardingCompleted,
            List<PayoutRecordDto> records) {
    }

    public record PayoutRecordDto(
            Long id,
            Long userId,
            Long beneficiaryOrganizationId,
            Long interventionId,
            BigDecimal amount,
            BigDecimal commissionAmount,
            String status,
            String failureReason,
            String stripeTransferId,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {

        public static PayoutRecordDto from(HousekeeperPayoutRecord record) {
            return new PayoutRecordDto(
                    record.getId(),
                    record.getUserId(),
                    record.getBeneficiaryOrganizationId(),
                    record.getInterventionId(),
                    record.getAmount(),
                    record.getCommissionAmount(),
                    record.getStatus().name(),
                    record.getFailureReason(),
                    record.getStripeTransferId(),
                    record.getCreatedAt(),
                    record.getUpdatedAt());
        }
    }

    /** client_secret de l'Account Session (composant d'onboarding embarqué). */
    public record OnboardingLinkDto(String url) {
    }

    public record AccountSessionDto(String clientSecret) {
    }

    /** Montants recalculés en lecture seule avant une décision de versement. */
    public record RetryQuote(BigDecimal amount, BigDecimal commissionAmount) { }

    public record RetryRequest(
            @jakarta.validation.constraints.NotNull
            @jakarta.validation.constraints.DecimalMin("0.01")
            @jakarta.validation.constraints.Digits(integer = 12, fraction = 2) BigDecimal amount,
            @jakarta.validation.constraints.NotNull
            @jakarta.validation.constraints.DecimalMin("0.00")
            @jakarta.validation.constraints.Digits(integer = 12, fraction = 2) BigDecimal commissionAmount) { }
}
