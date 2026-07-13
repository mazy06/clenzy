package com.clenzy.booking.service;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.repository.PaymentTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Réconciliation provider-agnostique du paiement du SOLDE d'un acompte booking
 * engine (ADR paiement multi-provider, Vague 2).
 *
 * <p>Déclenché par l'event outbox {@code PAYMENT_COMPLETED} consommé par
 * {@code PaymentEventConsumer}, quel que soit le provider. La réservation est
 * identifiée par le {@code sourceId} de la {@link PaymentTransaction} ; la
 * finalisation (PARTIALLY_PAID → PAID + ledger + facture) est déléguée à
 * {@link PublicBookingService#confirmBookingEngineBalanceById} (idempotent).</p>
 */
@Service
public class BookingBalanceReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(BookingBalanceReconciliationService.class);

    private final PaymentTransactionRepository transactionRepository;
    private final PublicBookingService publicBookingService;

    public BookingBalanceReconciliationService(PaymentTransactionRepository transactionRepository,
                                               PublicBookingService publicBookingService) {
        this.transactionRepository = transactionRepository;
        this.publicBookingService = publicBookingService;
    }

    /**
     * Réconcilie le solde de la réservation rattachée à une {@link PaymentTransaction}
     * complétée. Idempotent.
     *
     * @param transactionRef référence du ledger (portée par l'event PAYMENT_COMPLETED)
     */
    @Transactional
    public void reconcile(String transactionRef) {
        PaymentTransaction tx = transactionRepository.findByTransactionRef(transactionRef).orElse(null);
        if (tx == null) {
            log.error("Reconciliation solde : PaymentTransaction introuvable pour tx={} — ignoree", transactionRef);
            return;
        }
        Long reservationId = tx.getSourceId();
        String providerSessionId = tx.getProviderTxId();
        if (reservationId == null || providerSessionId == null || providerSessionId.isBlank()) {
            log.error("Reconciliation solde : sourceId/providerTxId absent sur la tx {} — "
                    + "reconciliation impossible, verification manuelle requise", transactionRef);
            return;
        }
        publicBookingService.confirmBookingEngineBalanceById(reservationId, providerSessionId);
        log.info("Reconciliation solde OK : tx={} reservation={} providerSession={}",
                transactionRef, reservationId, providerSessionId);
    }
}
