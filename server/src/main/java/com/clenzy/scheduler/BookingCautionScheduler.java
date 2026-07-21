package com.clenzy.scheduler;

import com.clenzy.booking.service.BookingEngineDepositService;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Libération automatique des cautions (booking engine, P0.3) : un hold non capturé est relâché
 * {@link BookingEngineDepositService#RELEASE_DAYS_AFTER_CHECKOUT} jours après le check-out
 * (séjour terminé sans dégâts signalés). La capture pour dégâts reste manuelle côté PMS et,
 * une fois CAPTURED, le dépôt n'est plus candidat à la libération (CAS sur HELD).
 */
@Component
public class BookingCautionScheduler {

    private static final Logger log = LoggerFactory.getLogger(BookingCautionScheduler.class);

    private final BookingEngineDepositService depositService;
    private final ReservationRepository reservationRepository;
    private final SupervisionActivityService supervisionActivityService;

    public BookingCautionScheduler(BookingEngineDepositService depositService,
                                   ReservationRepository reservationRepository,
                                   SupervisionActivityService supervisionActivityService) {
        this.depositService = depositService;
        this.reservationRepository = reservationRepository;
        this.supervisionActivityService = supervisionActivityService;
    }

    /** Tous les jours à 04:30 : libère les cautions des séjours terminés depuis le délai configuré. */
    @Scheduled(cron = "0 30 4 * * *")
    @SchedulerLock(name = "booking-caution-release", lockAtMostFor = "PT15M")
    public void releaseExpiredHolds() {
        LocalDate cutoff = LocalDate.now().minusDays(BookingEngineDepositService.RELEASE_DAYS_AFTER_CHECKOUT);
        List<SecurityDeposit> holds = depositService.findHoldsToRelease(cutoff);
        if (holds.isEmpty()) {
            return;
        }
        log.info("Libération automatique de {} caution(s) (séjour terminé avant {})", holds.size(), cutoff);
        for (SecurityDeposit deposit : holds) {
            if (depositService.releaseHold(deposit)) {
                recordConstellationActivity(deposit);
            }
        }
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
            String summary = "Caution libérée (" + amount + " " + currency + ") — séjour terminé sans dégâts signalés";
            supervisionActivityService.recordModuleAct(
                    deposit.getOrganizationId(), propertyId, "fin", "booking_caution", summary);
        } catch (Exception e) {
            log.debug("Caution {} : activité constellation non enregistrée : {}", deposit.getId(), e.getMessage());
        }
    }
}
