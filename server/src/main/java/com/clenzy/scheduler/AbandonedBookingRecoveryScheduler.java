package com.clenzy.scheduler;

import com.clenzy.model.AbandonedBooking;
import com.clenzy.repository.AbandonedBookingRepository;
import com.clenzy.service.AbandonedBookingService;
import com.clenzy.service.EmailService;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

/**
 * Relance des paniers abandonnés (CLZ Domaine 2) : envoie un email de récupération unique pour
 * chaque panier PENDING suffisamment ancien, puis le marque RECOVERY_SENT. L'envoi email est
 * réalisé hors transaction (#2) ; un échec laisse le panier PENDING pour réessai au prochain run.
 */
@Component
public class AbandonedBookingRecoveryScheduler {

    private static final Logger log = LoggerFactory.getLogger(AbandonedBookingRecoveryScheduler.class);
    private static final Duration RECOVERY_DELAY = Duration.ofHours(1);
    private static final int BATCH = 100;

    private final AbandonedBookingRepository repository;
    private final AbandonedBookingService abandonedBookingService;
    private final EmailService emailService;
    private final Clock clock;

    public AbandonedBookingRecoveryScheduler(AbandonedBookingRepository repository,
                                             AbandonedBookingService abandonedBookingService,
                                             EmailService emailService,
                                             Clock clock) {
        this.repository = repository;
        this.abandonedBookingService = abandonedBookingService;
        this.emailService = emailService;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${clenzy.booking.abandoned-cart.recovery-interval-ms:900000}")
    public void sendRecoveryEmails() {
        List<AbandonedBooking> due = repository.findDueForRecovery(
            clock.instant().minus(RECOVERY_DELAY), PageRequest.of(0, BATCH));
        if (due.isEmpty()) {
            return;
        }
        log.info("Relance de {} panier(s) abandonne(s)", due.size());
        for (AbandonedBooking ab : due) {
            try {
                emailService.sendSimpleHtmlEmail(ab.getGuestEmail(), subject(ab), body(ab));
                abandonedBookingService.markRecoverySent(ab);
            } catch (Exception e) {
                // Best-effort : on laisse PENDING -> reessai au prochain run.
                log.warn("Relance panier abandonne {} echouee: {}", ab.getId(), e.getMessage());
            }
        }
    }

    private String subject(AbandonedBooking ab) {
        String property = ab.getPropertyName() != null ? ab.getPropertyName() : "votre sejour";
        return "Votre reservation pour " + property + " vous attend";
    }

    private String body(AbandonedBooking ab) {
        String name = ab.getGuestName() != null ? StringUtils.escapeHtml(ab.getGuestName()) : "";
        String property = ab.getPropertyName() != null ? StringUtils.escapeHtml(ab.getPropertyName()) : "le logement";
        String dates = ab.getCheckIn() != null && ab.getCheckOut() != null
            ? StringUtils.escapeHtml(ab.getCheckIn() + " → " + ab.getCheckOut()) : "";
        return "<p>Bonjour " + name + ",</p>"
            + "<p>Il reste une etape pour finaliser votre reservation de <b>" + property + "</b>"
            + (dates.isEmpty() ? "" : " (" + dates + ")") + ".</p>"
            + "<p>Vos dates sont encore susceptibles d'etre disponibles : finalisez votre sejour des maintenant.</p>";
    }
}
