package com.clenzy.booking.service;

import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.booking.repository.BookingPendingReservationRepository;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.StripeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Scheduler qui annule les reservations PENDING non payees apres expiration du hold.
 * Execute toutes les 5 minutes. La duree du hold est configurable PAR ORGANISATION
 * (BookingEngineConfig.pendingHoldMinutes) ; defaut {@value #DEFAULT_HOLD_MINUTES} min si non defini.
 *
 * <p>Z4A-BUGS-02 : avant de liberer les dates, la session Stripe Checkout encore
 * ouverte est expiree. Si elle est deja payee (paiement tardif / race), la
 * reservation est reconciliee (confirmee) au lieu d'etre annulee — on ne libere
 * jamais des dates dont le paiement a ete encaisse.</p>
 *
 * <p>Reliquats revue A3 :</p>
 * <ul>
 *   <li>chaque reservation est traitee dans une <b>transaction independante</b>
 *       ({@link TransactionTemplate}) — l'ancien {@code @Transactional} global
 *       annulait tout le batch (y compris les annulations deja faites) au
 *       premier echec, et gardait une transaction DB ouverte pendant les appels
 *       HTTP Stripe ;</li>
 *   <li>le cleanup ramasse aussi les holds dont le paiement a echoue
 *       ({@code paymentStatus=FAILED}) pour liberer le calendrier.</li>
 * </ul>
 */
@Component
public class PendingReservationCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(PendingReservationCleanupScheduler.class);

    /** Delai d'expiration par defaut (minutes) si l'org n'a pas configure de duree de hold. */
    private static final int DEFAULT_HOLD_MINUTES = 30;

    private final BookingPendingReservationRepository pendingReservationRepository;
    private final BookingEngineConfigRepository configRepository;
    private final CalendarEngine calendarEngine;
    private final StripeService stripeService;
    private final com.clenzy.service.AbandonedBookingService abandonedBookingService;
    private final TransactionTemplate transactionTemplate;

    public PendingReservationCleanupScheduler(BookingPendingReservationRepository pendingReservationRepository,
                                               BookingEngineConfigRepository configRepository,
                                               CalendarEngine calendarEngine,
                                               StripeService stripeService,
                                               com.clenzy.service.AbandonedBookingService abandonedBookingService,
                                               PlatformTransactionManager transactionManager) {
        this.pendingReservationRepository = pendingReservationRepository;
        this.configRepository = configRepository;
        this.calendarEngine = calendarEngine;
        this.stripeService = stripeService;
        this.abandonedBookingService = abandonedBookingService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Scheduled(fixedRate = 300_000) // 5 minutes
    @SchedulerLock(name = "pending-reservation-cleanup", lockAtMostFor = "PT10M", lockAtLeastFor = "PT30S")
    public void cleanupExpiredPendingReservations() {
        List<Reservation> holds = pendingReservationRepository.findUnpaidHolds();
        if (holds.isEmpty()) {
            return;
        }

        // Expiration calculee PAR ORG (duree de hold configurable) : un hold est expire si son
        // createdAt est anterieur a (maintenant - holdMinutes de son org). Cache par org sur le run.
        final LocalDateTime now = LocalDateTime.now();
        final Map<Long, Integer> holdMinutesByOrg = new HashMap<>();
        final List<Reservation> expired = holds.stream()
            .filter(r -> r.getCreatedAt() != null)
            .filter(r -> r.getCreatedAt().isBefore(
                now.minusMinutes(holdMinutesByOrg.computeIfAbsent(r.getOrganizationId(), this::resolveHoldMinutes))))
            .toList();

        if (expired.isEmpty()) {
            return;
        }

        log.info("Nettoyage des reservations PENDING expirees : {} trouvees", expired.size());

        for (Reservation reservation : expired) {
            try {
                // Appel Stripe HORS transaction DB (HTTP externe)
                if (!ensureStripeSessionExpired(reservation)) {
                    continue;
                }
                // Annulation + liberation calendrier dans une transaction dediee :
                // l'echec d'une reservation n'annule pas les autres.
                transactionTemplate.executeWithoutResult(status -> cancelAndReleaseCalendar(reservation));
            } catch (Exception e) {
                log.error("Erreur lors de l'annulation de la reservation {} : {}",
                    reservation.getId(), e.getMessage(), e);
            }
        }
    }

    /**
     * Expire la session Stripe AVANT toute liberation du calendrier (Z4A-BUGS-02).
     *
     * @return {@code true} si la session est expiree et que l'annulation peut continuer ;
     *         {@code false} si la reservation doit etre conservee (payee → reconciliee,
     *         ou statut Stripe incertain → re-essai au prochain run).
     */
    private boolean ensureStripeSessionExpired(Reservation reservation) {
        String sessionId = reservation.getStripeSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            return true;
        }

        StripeService.CheckoutSessionExpiryResult result = stripeService.expireCheckoutSession(sessionId);
        if (result == StripeService.CheckoutSessionExpiryResult.EXPIRED) {
            return true;
        }
        if (result == StripeService.CheckoutSessionExpiryResult.PAID) {
            // Paiement tardif gagne la course : on confirme la reservation au lieu
            // de liberer des dates deja encaissees (reconciliation).
            log.warn("Reservation {} : session Stripe {} deja payee — reconciliation au lieu d'annulation",
                reservation.getConfirmationCode(), sessionId);
            stripeService.confirmReservationPayment(sessionId);
            return false;
        }
        // COMPLETED_UNPAID (paiement asynchrone en cours) ou FAILED (Stripe injoignable) :
        // statut incertain, on ne libere pas et on retente au prochain run.
        log.warn("Reservation {} : expiration session Stripe {} non confirmee ({}) — annulation differee",
            reservation.getId(), sessionId, result);
        return false;
    }

    private void cancelAndReleaseCalendar(Reservation reservation) {
        reservation.markCancelled();
        reservation.setPaymentStatus(PaymentStatus.CANCELLED);
        pendingReservationRepository.save(reservation);

        // Capture du panier abandonne (relance ulterieure, CLZ Domaine 2) — insert DB dans la
        // meme transaction, idempotent, no-op si pas d'email voyageur.
        abandonedBookingService.recordIfAbsent(reservation);

        calendarEngine.cancel(
            reservation.getId(),
            reservation.getOrganizationId(),
            "booking-engine-cleanup"
        );

        log.info("Reservation PENDING expiree annulee : {} (property {}, org {})",
            reservation.getConfirmationCode(),
            reservation.getProperty() != null ? reservation.getProperty().getId() : "?",
            reservation.getOrganizationId());
    }

    /** Duree du hold (minutes) configuree par l'org, ou {@value #DEFAULT_HOLD_MINUTES} par defaut. */
    private int resolveHoldMinutes(Long organizationId) {
        if (organizationId == null) {
            return DEFAULT_HOLD_MINUTES;
        }
        return configRepository.findFirstByOrganizationId(organizationId)
            .map(BookingEngineConfig::getPendingHoldMinutes)
            .filter(m -> m != null && m > 0)
            .orElse(DEFAULT_HOLD_MINUTES);
    }
}
