package com.clenzy.scheduler;

import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.SecurityDepositHoldPolicy;
import com.clenzy.service.SecurityDepositHoldService;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.function.Consumer;

/**
 * Tient la pré-autorisation des cautions dans sa fenêtre de validité Stripe (4 j 18 h à 7 j) :
 * pose le hold le jour de l'arrivée, le renouvelle avant son échéance tant que la fenêtre de
 * réclamation n'est pas close, et constate l'échéance d'un hold que Stripe a annulé.
 *
 * <p>Horaire : le jour de l'arrivée commence à une heure différente selon le fuseau du logement,
 * et un renouvellement se déclenche {@link SecurityDepositHoldPolicy#RENEWAL_MARGIN} avant une
 * échéance à la seconde près. La libération J+2 reste portée par {@link BookingCautionScheduler}.</p>
 */
@Component
public class SecurityDepositHoldScheduler {

    private static final Logger log = LoggerFactory.getLogger(SecurityDepositHoldScheduler.class);

    private final SecurityDepositRepository depositRepository;
    private final ReservationRepository reservationRepository;
    private final SecurityDepositHoldService holdService;
    private final Clock clock;

    public SecurityDepositHoldScheduler(SecurityDepositRepository depositRepository,
                                        ReservationRepository reservationRepository,
                                        SecurityDepositHoldService holdService,
                                        Clock clock) {
        this.depositRepository = depositRepository;
        this.reservationRepository = reservationRepository;
        this.holdService = holdService;
        this.clock = clock;
    }

    @Scheduled(cron = "0 10 * * * *")
    @SchedulerLock(name = "security-deposit-hold-window", lockAtMostFor = "PT30M")
    public void maintainHolds() {
        final Instant now = clock.instant();
        placeDueHolds(now);
        renewOrCloseExpiringHolds(now);
    }

    /** Cautions PENDING dont le jour d'arrivée est venu dans le fuseau du logement. */
    void placeDueHolds(Instant now) {
        // Un jour de marge autour de la date UTC couvre tous les fuseaux ; placeHoldIfDue tranche
        // dans celui du logement.
        final LocalDate utcToday = LocalDate.ofInstant(now, ZoneOffset.UTC);
        for (SecurityDeposit deposit : depositRepository.findPendingWithSavedCard(utcToday.plusDays(1), utcToday.minusDays(1))) {
            withReservation(deposit, reservation -> holdService.placeHoldIfDue(deposit, reservation));
        }
    }

    /** Holds qui échoient dans la marge de renouvellement : renouveler, ou constater l'échéance. */
    void renewOrCloseExpiringHolds(Instant now) {
        for (SecurityDeposit deposit : depositRepository.findHeldExpiringBefore(now.plus(SecurityDepositHoldPolicy.RENEWAL_MARGIN))) {
            withReservation(deposit, reservation -> {
                if (!deposit.getHoldExpiresAt().isAfter(now)) {
                    holdService.reconcileLapsedHold(deposit, reservation);
                } else if (deposit.getHoldError() == null
                        && SecurityDepositHoldPolicy.needsRenewal(reservation, deposit.getHoldExpiresAt())) {
                    holdService.renewHold(deposit, reservation);
                }
            });
        }
    }

    /**
     * Charge la réservation (logement compris, pour son fuseau) dans l'org de la caution, puis
     * traite la caution isolément : une ligne en erreur est journalisée et reprise au passage
     * suivant sans bloquer les autres.
     */
    private void withReservation(SecurityDeposit deposit, Consumer<Reservation> action) {
        try {
            final Reservation reservation = reservationRepository.findByIdWithGuestAndProperty(deposit.getReservationId())
                .filter(r -> deposit.getOrganizationId().equals(r.getOrganizationId()))
                .orElse(null);
            if (reservation == null) {
                log.error("Caution {} : réservation {} introuvable dans l'org {} — hold non géré",
                    deposit.getId(), deposit.getReservationId(), deposit.getOrganizationId());
                return;
            }
            action.accept(reservation);
        } catch (RuntimeException e) {
            log.error("Caution {} : maintenance du hold en échec, reprise au prochain passage", deposit.getId(), e);
        }
    }
}
