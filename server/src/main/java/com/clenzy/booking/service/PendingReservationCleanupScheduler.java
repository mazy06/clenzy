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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.ObjectProvider;
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
    private final com.clenzy.tenant.TenantScopedExecutor tenantScopedExecutor;
    private final com.clenzy.repository.PaymentTransactionRepository payments;
    private final com.clenzy.service.voucher.BaitlyVoucherClaims vouchers;
    private final jakarta.persistence.EntityManager em;

    /**
     * Auto-injection : appeler une methode {@code @Transactional} de CETTE classe
     * directement ne passerait pas par le proxy Spring — ni la transaction ni l'aspect
     * qui pose les GUC de contexte tenant ne se declencheraient (regle CLAUDE.md n°6).
     * {@link ObjectProvider} evite la dependance circulaire au demarrage.
     */
    private final ObjectProvider<PendingReservationCleanupScheduler> self;

    public PendingReservationCleanupScheduler(BookingPendingReservationRepository pendingReservationRepository,
                                               BookingEngineConfigRepository configRepository,
                                               CalendarEngine calendarEngine,
                                               StripeService stripeService,
                                               com.clenzy.service.AbandonedBookingService abandonedBookingService,
                                               PlatformTransactionManager transactionManager,
                                              com.clenzy.tenant.TenantScopedExecutor tenantScopedExecutor,
                                              ObjectProvider<PendingReservationCleanupScheduler> self,
                                              com.clenzy.repository.PaymentTransactionRepository payments,
                                              com.clenzy.service.voucher.BaitlyVoucherClaims vouchers,
                                              jakarta.persistence.EntityManager em) {
        this.pendingReservationRepository = pendingReservationRepository;
        this.configRepository = configRepository;
        this.calendarEngine = calendarEngine;
        this.stripeService = stripeService;
        this.abandonedBookingService = abandonedBookingService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.self = self;
        this.payments = payments;
        this.vouchers = vouchers;
        this.em = em;
    }

    /**
     * Charge les holds impayes de TOUTES les organisations.
     *
     * <p>{@code @Transactional} est ici indispensable — non pour la transaction, mais pour
     * que {@code RlsTenantGucAspect} se declenche et pose les GUC. Sans elles, cette lecture
     * renverrait zero ligne des que la RLS sera active : le nettoyage cesserait en silence,
     * et les calendriers resteraient bloques sur des reservations expirees.
     * Audit securite 2026-07-26, plan REM-T-01.
     */
    @Transactional(readOnly = true)
    public List<Reservation> chargerHoldsImpayes() {
        return pendingReservationRepository.findUnpaidHolds();
    }

    @Scheduled(fixedRate = 300_000) // 5 minutes
    @SchedulerLock(name = "pending-reservation-cleanup", lockAtMostFor = "PT10M", lockAtLeastFor = "PT30S")
    public void cleanupExpiredPendingReservations() {
        // Via le proxy : la methode est @Transactional, l'aspect pose donc les GUC de
        // contexte tenant. Sans contexte d'organisation, RlsGuc accorde le bypass — ce
        // balayage est cross-organisation par nature.
        List<Reservation> holds = self.getObject().chargerHoldsImpayes();
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
                //
                // Le contexte tenant de SON organisation est pose pour la duree du
                // traitement : l'aspect y lit l'organisation courante et pose les GUC en
                // consequence, au lieu du bypass large de la lecture ci-dessus.
                tenantScopedExecutor.runAsOrganization(
                        reservation.getOrganizationId(),
                        () -> self.getObject().cancelAndReleaseCalendar(reservation));
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

    @Transactional
    public void cancelAndReleaseCalendar(Reservation observed) {
        String expiredSession = observed.getStripeSessionId();
        Reservation reservation = pendingReservationRepository.lockHold(observed.getId(), observed.getOrganizationId()).orElse(null);
        if (reservation == null) return;
        em.refresh(reservation, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        boolean alreadyCancelled = "cancelled".equalsIgnoreCase(reservation.getStatus());
        if ((!"pending".equalsIgnoreCase(reservation.getStatus()) && !alreadyCancelled)
                || reservation.getPaymentStatus() == null || !java.util.Set.of(PaymentStatus.PENDING, PaymentStatus.PROCESSING,
                    PaymentStatus.FAILED, PaymentStatus.CANCELLED).contains(reservation.getPaymentStatus())
                || reservation.getPaidAt() != null || reservation.getAmountPaid() != null && reservation.getAmountPaid().signum() > 0
                || !java.util.Objects.equals(reservation.getStripeSessionId(), expiredSession)) return;
        // Une intention peut être enregistrée avant que Stripe retourne l'ID de session.
        // En cas de délai réseau, conserver les dates jusqu'à sa réconciliation.
        for (String source : List.of("RESERVATION", "BOOKING_CHECKOUT", "BOOKING_BALANCE")) {
            for (var payment : payments.findByOrganizationIdAndSourceTypeAndSourceId(reservation.getOrganizationId(), source, reservation.getId())) {
                if (payment.getPaymentType() != com.clenzy.model.TransactionType.CHECKOUT) continue;
                if (payment.getStatus() == com.clenzy.model.TransactionStatus.COMPLETED
                        || payment.getStatus() == com.clenzy.model.TransactionStatus.REFUNDED || payment.hasDisputeRisk()) return;
                if (payment.getStatus() != com.clenzy.model.TransactionStatus.CANCELLED
                        && (expiredSession == null || !java.util.Objects.equals(payment.getProviderTxId(), expiredSession))) return;
            }
        }
        if (alreadyCancelled) {
            vouchers.releaseExpired(reservation);
            return;
        }
        reservation.markCancelled();
        reservation.setPaymentStatus(PaymentStatus.CANCELLED);
        vouchers.releaseExpired(reservation);
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
