package com.clenzy.scheduler;

import com.clenzy.service.SecurityDepositPaymentService;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.tenant.TenantScopedExecutor;
import com.clenzy.booking.service.BookingEngineDepositService;
import com.clenzy.service.NotificationService;
import com.clenzy.model.NotificationKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Libération Baitly après le ménage de départ validé, sans anomalie. La capture reste manuelle.
 * La pose, le
 * renouvellement et l'échéance du hold relèvent de {@link SecurityDepositHoldScheduler}.
 */
@Component
public class BookingCautionScheduler {

    private static final Logger log = LoggerFactory.getLogger(BookingCautionScheduler.class);

    private final SecurityDepositPaymentService depositService;
    private final SecurityDepositRepository deposits;
    private final ReservationRepository reservationRepository;
    private final SupervisionActivityService supervisionActivityService;
    private final TenantScopedExecutor tenants;
    private final BookingEngineDepositService setup;
    private final NotificationService notifications;

    public BookingCautionScheduler(SecurityDepositPaymentService depositService,
                                   SecurityDepositRepository deposits,
                                   ReservationRepository reservationRepository,
                                   SupervisionActivityService supervisionActivityService,
                                   TenantScopedExecutor tenants,
                                   BookingEngineDepositService setup,
                                   NotificationService notifications) {
        this.depositService = depositService;
        this.deposits = deposits;
        this.reservationRepository = reservationRepository;
        this.supervisionActivityService = supervisionActivityService;
        this.tenants = tenants;
        this.setup = setup;
        this.notifications = notifications;
    }

    /** Le service recontrôle le ménage, les anomalies et le hold avant tout appel Stripe. */
    @Scheduled(cron = "0 */15 * * * *")
    @SchedulerLock(name = "booking-caution-release", lockAtMostFor = "PT15M")
    public void releaseExpiredHolds() {
        LocalDate cutoff = LocalDate.now(java.time.ZoneOffset.UTC).plusDays(1);
        for (Reservation reservation : reservationRepository.findMissingBookingCautions(cutoff.minusDays(2))) {
            try {
                tenants.runAsOrganization(reservation.getOrganizationId(), () ->
                        setup.recoverMissingCaution(reservation.getId(), reservation.getOrganizationId()));
            } catch (RuntimeException failure) {
                reconciliationRequired(reservation.getOrganizationId(), reservation.getId(), failure);
            }
        }
        List<SecurityDeposit> holds = deposits.findCleaningReleaseCandidates(cutoff);
        if (holds.isEmpty()) {
            return;
        }
        log.debug("Vérification du ménage avant libération de {} caution(s)", holds.size());
        for (SecurityDeposit deposit : holds) {
            try {
                tenants.runAsOrganization(deposit.getOrganizationId(), () -> {
                    if (depositService.releaseAfterCleaning(deposit.getOrganizationId(), deposit.getId()))
                        recordConstellationActivity(deposit);
                });
            } catch (RuntimeException failure) {
                log.error("Caution {} : libération non confirmée, reprise contrôlée au prochain passage", deposit.getId(), failure);
                reconciliationRequired(deposit.getOrganizationId(), deposit.getReservationId(), failure);
            }
        }
    }

    private void reconciliationRequired(Long orgId, Long reservationId, RuntimeException failure) {
        log.error("Caution réservation {} : rapprochement requis", reservationId, failure);
        notifications.notifyAdminsAndManagersByOrgId(orgId, NotificationKey.SECURITY_DEPOSIT_HOLD_FAILED,
                "Caution à vérifier", "L'opération bancaire de caution n'est pas confirmée. Vérifiez cette réservation avant toute action manuelle.",
                "/reservations?highlight=" + reservationId);
    }

    /**
     * Fait remonter la libération de caution dans le feed « En direct » de la CONSTELLATION du logement
     * (agent Finance « fin ») : la propriété est résolue via la réservation de la caution, org-scopée.
     * Best-effort — un échec ne doit JAMAIS casser le scheduler (le record est lui-même best-effort côté service).
     */
    private void recordConstellationActivity(SecurityDeposit deposit) {
        try {
            Reservation reservation = reservationRepository.findById(deposit.getReservationId()).orElse(null);
            if (reservation == null
                    || !deposit.getOrganizationId().equals(reservation.getOrganizationId())
                    || reservation.getProperty() == null) {
                return; // caution sans logement rattachable → rien à afficher dans une constellation
            }
            Long propertyId = reservation.getProperty().getId();
            if (propertyId == null) {
                return;
            }
            String amount = deposit.getAmount() != null ? deposit.getAmount().toPlainString() : "-";
            String currency = deposit.getCurrency() != null ? deposit.getCurrency() : "EUR";
            String summary = "Caution libérée (" + amount + " " + currency + ") : ménage validé sans anomalie";
            supervisionActivityService.recordModuleAct(
                    deposit.getOrganizationId(), propertyId, "fin", "booking_caution", summary);
        } catch (Exception e) {
            log.debug("Caution {} : activité constellation non enregistrée : {}", deposit.getId(), e.getMessage());
        }
    }
}
