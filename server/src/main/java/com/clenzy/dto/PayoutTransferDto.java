package com.clenzy.dto;

import com.clenzy.model.PayoutTransfer;
import com.clenzy.model.PayoutTransferEvent;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record PayoutTransferDto(Long id, PayoutTransfer.Source source, Long sourceId, Long beneficiaryUserId, Long beneficiaryOrganizationId,
        BigDecimal amount, String currency, String provider, PayoutTransfer.State state, String externalReference,
        Instant createdAt, Instant updatedAt, String description) {
    public static PayoutTransferDto from(PayoutTransfer transfer) {
        return new PayoutTransferDto(transfer.getId(), transfer.getSource(), transfer.getSourceId(),
                transfer.getBeneficiaryUserId(), transfer.getBeneficiaryOrganizationId(), transfer.getAmount(), transfer.getCurrency(), transfer.getProvider(),
                transfer.getState(), transfer.getExternalReference(), transfer.getCreatedAt(), transfer.getUpdatedAt(), transfer.getDescription());
    }
    public record Event(PayoutTransfer.State state, String externalReference, Instant createdAt, String origin, String actorSubject) {
        public static Event from(PayoutTransferEvent event) {
            return new Event(event.getState(), event.getExternalReference(), event.getCreatedAt(), event.getOrigin(), event.getActorSubject());
        }
    }
    /** PAID = annoncé par Stripe, pas une preuve issue du relevé bancaire. Arrivée estimée. */
    public record BankPayout(String payoutId, String status, Instant estimatedArrival, String failureCode, Instant eventCreated) {
        public static BankPayout from(com.clenzy.repository.BankPayoutObservationRepository.BankPayoutView row) {
            return new BankPayout(row.getPayoutId(), row.getStatus(), row.getArrivalDate(), row.getFailureCode(), row.getEventCreated());
        }
    }
    /** Répartition figée du remboursement ; le statut porte la confirmation, pas les montants seuls. */
    public record Recovery(com.clenzy.model.BaitlyTransferRecovery.State state, BigDecimal amount, BigDecimal commissionRefundAmount, String currency,
            String reversalReference, Instant createdAt, Instant updatedAt) {
        public static Recovery from(com.clenzy.model.BaitlyTransferRecovery row) {
            return new Recovery(row.getState(),row.getAmount(),row.getCommissionRefundAmount(),row.getCurrency(),row.getReversalReference(),row.getCreatedAt(),row.getUpdatedAt());
        }
    }
    public record Detail(PayoutTransferDto transfer, List<Event> events, List<BankPayout> bankPayouts, String beneficiaryName,
            List<Recovery> recoveries) {}
}
