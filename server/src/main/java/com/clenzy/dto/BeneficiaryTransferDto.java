package com.clenzy.dto;

import com.clenzy.model.PayoutTransfer;
import com.clenzy.model.PayoutTransferEvent;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Projection destinataire : ni identifiant d'opérateur, ni compte PSP, ni données des autres bénéficiaires. */
public record BeneficiaryTransferDto(Long id, PayoutTransfer.Source source, String description,
        BigDecimal amount, String currency, PayoutTransfer.State state, Instant createdAt, Instant updatedAt) {
    public static BeneficiaryTransferDto from(PayoutTransfer transfer) {
        return new BeneficiaryTransferDto(transfer.getId(),transfer.getSource(),transfer.getDescription(),
                transfer.getAmount(),transfer.getCurrency(),transfer.getState(),transfer.getCreatedAt(),transfer.getUpdatedAt());
    }
    public record Event(PayoutTransfer.State state, Instant createdAt) {
        public static Event from(PayoutTransferEvent event) { return new Event(event.getState(),event.getCreatedAt()); }
    }
    public record Recovery(com.clenzy.model.BaitlyTransferRecovery.State state, BigDecimal amount, String currency, Instant updatedAt) {
        public static Recovery from(com.clenzy.model.BaitlyTransferRecovery row) {
            return new Recovery(row.getState(),row.getAmount(),row.getCurrency(),row.getUpdatedAt());
        }
    }
    public record Detail(BeneficiaryTransferDto transfer, List<Event> events, List<PayoutTransferDto.BankPayout> bankPayouts,
            List<Recovery> recoveries) {}
}
