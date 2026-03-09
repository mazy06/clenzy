package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.*;
import com.clenzy.repository.EscrowHoldRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class EscrowService {

    private static final Logger log = LoggerFactory.getLogger(EscrowService.class);

    private final EscrowHoldRepository escrowHoldRepository;
    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final OutboxPublisher outboxPublisher;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper;

    public EscrowService(EscrowHoldRepository escrowHoldRepository,
                          WalletService walletService,
                          LedgerService ledgerService,
                          OutboxPublisher outboxPublisher,
                          TenantContext tenantContext,
                          ObjectMapper objectMapper) {
        this.escrowHoldRepository = escrowHoldRepository;
        this.walletService = walletService;
        this.ledgerService = ledgerService;
        this.outboxPublisher = outboxPublisher;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
    }

    /**
     * Hold funds in escrow after a reservation payment succeeds.
     * Moves funds from platform wallet to escrow wallet.
     */
    public EscrowHold holdFunds(Long reservationId, Long transactionId,
                                 BigDecimal amount, String currency) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.info("Holding {} {} in escrow for reservation {} (org {})",
            amount, currency, reservationId, orgId);

        Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, currency);
        Wallet escrowWallet = walletService.getOrCreateEscrowWallet(orgId, currency);

        // Transfer from platform to escrow
        ledgerService.recordTransfer(platformWallet, escrowWallet, amount,
            LedgerReferenceType.ESCROW_HOLD, "ESC-" + reservationId,
            "Escrow hold for reservation #" + reservationId);

        // Create escrow record
        EscrowHold hold = new EscrowHold();
        hold.setOrganizationId(orgId);
        hold.setReservationId(reservationId);
        hold.setTransactionId(transactionId);
        hold.setAmount(amount);
        hold.setCurrency(currency);
        hold.setStatus(EscrowStatus.HELD);

        hold = escrowHoldRepository.save(hold);
        log.info("Escrow hold created: id={} for reservation {}", hold.getId(), reservationId);

        return hold;
    }

    /**
     * Release escrowed funds after check-in.
     * Moves funds from escrow wallet back to platform wallet for splitting.
     */
    public EscrowHold releaseFunds(Long escrowId, String trigger) {
        EscrowHold hold = escrowHoldRepository.findById(escrowId)
            .orElseThrow(() -> new RuntimeException("Escrow hold not found: " + escrowId));

        if (hold.getStatus() != EscrowStatus.HELD) {
            throw new IllegalStateException(
                "Cannot release escrow in status: " + hold.getStatus());
        }

        Long orgId = hold.getOrganizationId();
        Wallet escrowWallet = walletService.getOrCreateEscrowWallet(orgId, hold.getCurrency());
        Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, hold.getCurrency());

        // Transfer from escrow back to platform
        ledgerService.recordTransfer(escrowWallet, platformWallet, hold.getAmount(),
            LedgerReferenceType.ESCROW_RELEASE, "ESC-" + hold.getReservationId(),
            "Escrow release for reservation #" + hold.getReservationId());

        hold.setStatus(EscrowStatus.RELEASED);
        hold.setReleasedAt(LocalDateTime.now());
        hold.setReleaseTrigger(trigger != null ? trigger : "MANUAL");
        hold = escrowHoldRepository.save(hold);

        // Publish event for split processing
        publishEscrowEvent(hold, "ESCROW_RELEASED");

        log.info("Escrow released: id={} reservation={} trigger={}",
            hold.getId(), hold.getReservationId(), trigger);

        return hold;
    }

    /**
     * Release escrow by reservation ID.
     */
    public EscrowHold releaseFundsByReservation(Long reservationId, String trigger) {
        EscrowHold hold = escrowHoldRepository.findByReservationIdAndStatus(
                reservationId, EscrowStatus.HELD)
            .orElseThrow(() -> new RuntimeException(
                "No HELD escrow for reservation: " + reservationId));
        return releaseFunds(hold.getId(), trigger);
    }

    /**
     * Refund escrowed funds (cancellation before check-in).
     */
    public EscrowHold refundEscrow(Long escrowId) {
        EscrowHold hold = escrowHoldRepository.findById(escrowId)
            .orElseThrow(() -> new RuntimeException("Escrow hold not found: " + escrowId));

        if (hold.getStatus() != EscrowStatus.HELD) {
            throw new IllegalStateException(
                "Cannot refund escrow in status: " + hold.getStatus());
        }

        Long orgId = hold.getOrganizationId();
        Wallet escrowWallet = walletService.getOrCreateEscrowWallet(orgId, hold.getCurrency());
        Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, hold.getCurrency());

        // Reverse: move from escrow back to platform
        ledgerService.recordTransfer(escrowWallet, platformWallet, hold.getAmount(),
            LedgerReferenceType.REFUND, "ESC-REFUND-" + hold.getReservationId(),
            "Escrow refund for reservation #" + hold.getReservationId());

        hold.setStatus(EscrowStatus.REFUNDED);
        hold.setReleasedAt(LocalDateTime.now());
        hold.setReleaseTrigger("REFUND");
        hold = escrowHoldRepository.save(hold);

        publishEscrowEvent(hold, "ESCROW_REFUNDED");

        log.info("Escrow refunded: id={} reservation={}", hold.getId(), hold.getReservationId());

        return hold;
    }

    /**
     * Get all escrow holds for an organization.
     */
    @Transactional(readOnly = true)
    public List<EscrowHold> getEscrowsByOrganization(Long orgId) {
        return escrowHoldRepository.findByOrganizationId(orgId);
    }

    /**
     * Get releasable escrows (for scheduler).
     */
    @Transactional(readOnly = true)
    public List<EscrowHold> findReleasableEscrows() {
        return escrowHoldRepository.findReleasable(
            EscrowStatus.HELD, LocalDateTime.now());
    }

    private void publishEscrowEvent(EscrowHold hold, String eventType) {
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                "escrowId", hold.getId(),
                "reservationId", hold.getReservationId() != null ? hold.getReservationId() : 0,
                "amount", hold.getAmount().toPlainString(),
                "currency", hold.getCurrency(),
                "status", hold.getStatus().name()
            ));
            outboxPublisher.publish("ESCROW", String.valueOf(hold.getId()),
                eventType, KafkaConfig.TOPIC_PAYMENT_EVENTS,
                String.valueOf(hold.getReservationId()), payload, hold.getOrganizationId());
        } catch (JsonProcessingException e) {
            log.error("Failed to publish escrow event: {}", e.getMessage());
        }
    }
}
