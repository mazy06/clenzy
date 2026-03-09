package com.clenzy.scheduler;

import com.clenzy.model.EscrowHold;
import com.clenzy.model.EscrowStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.EscrowHoldRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.EscrowService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Scheduler that automatically releases escrow funds after guest check-in.
 * Runs every hour to find HELD escrows where the reservation check-in date has passed.
 *
 * Each escrow release is wrapped in its own transaction to ensure atomicity
 * and prevent partial failures from rolling back all releases.
 */
@Component
public class EscrowReleaseScheduler {

    private static final Logger log = LoggerFactory.getLogger(EscrowReleaseScheduler.class);

    private final EscrowHoldRepository escrowHoldRepository;
    private final ReservationRepository reservationRepository;
    private final EscrowService escrowService;

    public EscrowReleaseScheduler(EscrowHoldRepository escrowHoldRepository,
                                    ReservationRepository reservationRepository,
                                    EscrowService escrowService) {
        this.escrowHoldRepository = escrowHoldRepository;
        this.reservationRepository = reservationRepository;
        this.escrowService = escrowService;
    }

    /**
     * No @Transactional on this method — each escrowService.releaseFunds() call
     * runs in its own transaction (via EscrowService's class-level @Transactional).
     * This prevents one failed release from rolling back the entire batch.
     */
    @Scheduled(cron = "0 0 * * * *")  // Every hour
    public void releaseEscrowOnCheckIn() {
        log.debug("Checking for releasable escrow holds...");
        LocalDate today = LocalDate.now();

        List<EscrowHold> heldEscrows = escrowHoldRepository.findByStatus(EscrowStatus.HELD);

        int released = 0;
        int errors = 0;
        for (EscrowHold hold : heldEscrows) {
            if (hold.getReservationId() == null) continue;

            try {
                Reservation reservation = reservationRepository.findById(hold.getReservationId())
                    .orElse(null);

                if (reservation == null) {
                    log.warn("Reservation {} not found for escrow {}", hold.getReservationId(), hold.getId());
                    continue;
                }

                // Release if check-in date has passed
                if (reservation.getCheckIn() != null && !reservation.getCheckIn().isAfter(today)) {
                    escrowService.releaseFunds(hold.getId(), "CHECK_IN");
                    released++;
                }
            } catch (Exception e) {
                errors++;
                log.error("Failed to release escrow {} for reservation {}: {}",
                    hold.getId(), hold.getReservationId(), e.getMessage());
            }
        }

        if (released > 0 || errors > 0) {
            log.info("Escrow release scheduler: released={}, errors={}, total_checked={}",
                released, errors, heldEscrows.size());
        }
    }
}
