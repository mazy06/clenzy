package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.UserRepository;
import com.stripe.model.Transfer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class PayoutExecutionService {

    private static final Logger log = LoggerFactory.getLogger(PayoutExecutionService.class);
    private static final int MAX_RETRY_COUNT = 3;

    private final OwnerPayoutRepository payoutRepository;
    private final OwnerPayoutConfigRepository configRepository;
    private final StripeConnectService stripeConnectService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public PayoutExecutionService(OwnerPayoutRepository payoutRepository,
                                   OwnerPayoutConfigRepository configRepository,
                                   StripeConnectService stripeConnectService,
                                   NotificationService notificationService,
                                   UserRepository userRepository) {
        this.payoutRepository = payoutRepository;
        this.configRepository = configRepository;
        this.stripeConnectService = stripeConnectService;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    /**
     * Executes a payout based on the owner's configured payment method.
     * Only APPROVED payouts with a verified config can be executed.
     */
    @Transactional
    public OwnerPayout executePayout(Long payoutId, Long orgId) {
        OwnerPayout payout = payoutRepository.findByIdAndOrgId(payoutId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Payout not found: " + payoutId));

        if (payout.getStatus() != PayoutStatus.APPROVED) {
            throw new IllegalStateException("Payout must be APPROVED before execution. Current: " + payout.getStatus());
        }

        OwnerPayoutConfig config = configRepository.findByOwnerIdAndOrgId(payout.getOwnerId(), orgId)
                .orElseThrow(() -> new IllegalStateException(
                        "No payout config found for owner " + payout.getOwnerId()));

        if (!config.isVerified()) {
            throw new IllegalStateException("Owner payout config is not verified yet");
        }

        return switch (config.getPayoutMethod()) {
            case STRIPE_CONNECT -> executeStripeTransfer(payout, config);
            case SEPA_TRANSFER -> markSepaProcessing(payout);
            case MANUAL -> throw new IllegalStateException("Manual payouts cannot be auto-executed");
        };
    }

    /**
     * Retries a FAILED payout. Increments retryCount and re-executes.
     */
    @Transactional
    public OwnerPayout retryPayout(Long payoutId, Long orgId) {
        OwnerPayout payout = payoutRepository.findByIdAndOrgId(payoutId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Payout not found: " + payoutId));

        if (payout.getStatus() != PayoutStatus.FAILED) {
            throw new IllegalStateException("Only FAILED payouts can be retried. Current: " + payout.getStatus());
        }

        if (payout.getRetryCount() >= MAX_RETRY_COUNT) {
            throw new IllegalStateException("Max retry count (" + MAX_RETRY_COUNT + ") reached for payout " + payoutId);
        }

        // Reset to APPROVED to allow re-execution
        payout.setStatus(PayoutStatus.APPROVED);
        payout.setFailureReason(null);
        payoutRepository.save(payout);

        return executePayout(payoutId, orgId);
    }

    private OwnerPayout executeStripeTransfer(OwnerPayout payout, OwnerPayoutConfig config) {
        payout.setStatus(PayoutStatus.PROCESSING);
        payout.setPayoutMethod(PayoutMethod.STRIPE_CONNECT);
        payoutRepository.save(payout);

        try {
            String description = "Payout #" + payout.getId() + " - "
                    + payout.getPeriodStart() + " to " + payout.getPeriodEnd();

            Transfer transfer = stripeConnectService.createTransfer(
                    payout.getNetAmount(),
                    payout.getCurrency(),
                    config.getStripeConnectedAccountId(),
                    description
            );

            payout.setStripeTransferId(transfer.getId());
            payout.setPaymentReference(transfer.getId());
            payout.setStatus(PayoutStatus.PAID);
            payout.setPaidAt(Instant.now());
            OwnerPayout saved = payoutRepository.save(payout);

            notifySuccess(saved);
            log.info("Stripe transfer {} completed for payout {}", transfer.getId(), payout.getId());
            return saved;

        } catch (Exception e) {
            return handleFailure(payout, e);
        }
    }

    private OwnerPayout markSepaProcessing(OwnerPayout payout) {
        // For SEPA, we mark as PROCESSING — admin will confirm after bank transfer
        payout.setStatus(PayoutStatus.PROCESSING);
        payout.setPayoutMethod(PayoutMethod.SEPA_TRANSFER);
        OwnerPayout saved = payoutRepository.save(payout);

        notificationService.notifyAdminsAndManagersByOrgId(
                payout.getOrganizationId(),
                NotificationKey.PAYOUT_PENDING_APPROVAL,
                "Virement SEPA a effectuer",
                "Le reversement #" + payout.getId() + " (" + payout.getNetAmount() + " " + payout.getCurrency()
                        + ") est pret pour virement SEPA.",
                "/billing?tab=3"
        );

        log.info("SEPA payout {} marked as PROCESSING, awaiting manual bank transfer", payout.getId());
        return saved;
    }

    private OwnerPayout handleFailure(OwnerPayout payout, Exception e) {
        payout.setStatus(PayoutStatus.FAILED);
        payout.setFailureReason(e.getMessage());
        payout.setRetryCount(payout.getRetryCount() + 1);
        OwnerPayout saved = payoutRepository.save(payout);

        notificationService.notifyAdminsAndManagersByOrgId(
                payout.getOrganizationId(),
                NotificationKey.PAYOUT_FAILED,
                "Echec du reversement",
                "Le reversement #" + payout.getId() + " a echoue: " + e.getMessage(),
                "/billing?tab=3"
        );

        notifyOwner(saved, NotificationKey.PAYOUT_FAILED,
                "Echec du reversement",
                "Votre reversement de " + payout.getNetAmount() + " " + payout.getCurrency()
                        + " n'a pas pu etre execute. Notre equipe a ete notifiee.");

        log.error("Payout {} execution failed (attempt {}): {}", payout.getId(), payout.getRetryCount(), e.getMessage());
        return saved;
    }

    private void notifySuccess(OwnerPayout payout) {
        String amount = payout.getNetAmount() + " " + payout.getCurrency();

        notificationService.notifyAdminsAndManagersByOrgId(
                payout.getOrganizationId(),
                NotificationKey.PAYOUT_EXECUTED,
                "Reversement execute",
                "Le reversement #" + payout.getId() + " (" + amount + ") a ete execute avec succes.",
                "/billing?tab=3"
        );

        notifyOwner(payout, NotificationKey.PAYOUT_EXECUTED,
                "Reversement effectue",
                "Votre reversement de " + amount + " a ete effectue. Reference: " + payout.getPaymentReference());
    }

    private void notifyOwner(OwnerPayout payout, NotificationKey key, String title, String message) {
        userRepository.findById(payout.getOwnerId()).ifPresent(owner -> {
            if (owner.getKeycloakId() != null) {
                notificationService.sendByOrgId(
                        owner.getKeycloakId(), key, title, message,
                        "/billing?tab=3", payout.getOrganizationId()
                );
            }
        });
    }
}
