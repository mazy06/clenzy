package com.clenzy.scheduler;

import com.clenzy.model.AbandonedBooking;
import com.clenzy.repository.AbandonedBookingRepository;
import com.clenzy.repository.OrganizationRepository;
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
import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * Relance des paniers abandonnés (CLZ Domaine 2 + multi-étapes 2.12) : relance échelonnée à 1h /
 * 24h / 72h après création. Chaque run envoie l'étape DUE (selon {@code reminderCount} + l'âge) puis
 * incrémente le compteur ; la dernière étape passe le panier en RECOVERY_SENT. L'envoi email est
 * réalisé hors transaction (#2) ; un échec laisse le panier en l'état pour réessai au prochain run.
 */
@Component
public class AbandonedBookingRecoveryScheduler {

    private static final Logger log = LoggerFactory.getLogger(AbandonedBookingRecoveryScheduler.class);
    /** Échéances de relance mesurées depuis la création du panier. */
    private static final Duration[] STEP_DELAYS = { Duration.ofHours(1), Duration.ofHours(24), Duration.ofHours(72) };
    private static final int BATCH = 100;

    private final AbandonedBookingRepository repository;
    private final AbandonedBookingService abandonedBookingService;
    private final EmailService emailService;
    private final OrganizationRepository organizationRepository;
    private final Clock clock;

    public AbandonedBookingRecoveryScheduler(AbandonedBookingRepository repository,
                                             AbandonedBookingService abandonedBookingService,
                                             EmailService emailService,
                                             OrganizationRepository organizationRepository,
                                             Clock clock) {
        this.repository = repository;
        this.abandonedBookingService = abandonedBookingService;
        this.emailService = emailService;
        this.organizationRepository = organizationRepository;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${clenzy.booking.abandoned-cart.recovery-interval-ms:900000}")
    public void sendRecoveryEmails() {
        // Candidats : paniers PENDING au-delà de la 1re échéance ; l'étape réellement due est
        // recalculée par panier (selon reminderCount + âge), pour échelonner les relances.
        List<AbandonedBooking> due = repository.findDueForRecovery(
            clock.instant().minus(STEP_DELAYS[0]), PageRequest.of(0, BATCH));
        if (due.isEmpty()) {
            return;
        }
        // Réglage org-level : ne pas relancer pour les organisations qui ont désactivé la relance.
        Set<Long> recoveryDisabledOrgs = organizationRepository.findIdsWithAbandonedCartRecoveryDisabled();
        Instant now = clock.instant();
        for (AbandonedBooking ab : due) {
            if (recoveryDisabledOrgs.contains(ab.getOrganizationId())) {
                continue;
            }
            int step = ab.getReminderCount();
            if (step < 0 || step >= STEP_DELAYS.length) {
                continue; // garde-fou : compteur hors plage
            }
            if (Duration.between(ab.getCreatedAt(), now).compareTo(STEP_DELAYS[step]) < 0) {
                continue; // l'échéance de l'étape courante n'est pas encore atteinte
            }
            boolean finalStep = step == STEP_DELAYS.length - 1;
            try {
                emailService.sendSimpleHtmlEmail(ab.getGuestEmail(), subject(ab, step), body(ab, step));
                abandonedBookingService.recordReminderSent(ab, finalStep);
            } catch (Exception e) {
                // Best-effort : on laisse en l'état -> reessai au prochain run.
                log.warn("Relance panier abandonne {} (etape {}) echouee: {}", ab.getId(), step, e.getMessage());
            }
        }
    }

    private String subject(AbandonedBooking ab, int step) {
        String property = ab.getPropertyName() != null ? ab.getPropertyName() : "votre sejour";
        return switch (step) {
            case 0 -> "Votre reservation pour " + property + " vous attend";
            case 1 -> "Les dates pour " + property + " sont tres demandees";
            default -> "Dernier rappel : finalisez votre reservation pour " + property;
        };
    }

    private String body(AbandonedBooking ab, int step) {
        String name = ab.getGuestName() != null ? StringUtils.escapeHtml(ab.getGuestName()) : "";
        String property = ab.getPropertyName() != null ? StringUtils.escapeHtml(ab.getPropertyName()) : "le logement";
        String dates = ab.getCheckIn() != null && ab.getCheckOut() != null
            ? StringUtils.escapeHtml(ab.getCheckIn() + " → " + ab.getCheckOut()) : "";
        String nudge = switch (step) {
            case 0 -> "Vos dates sont encore susceptibles d'etre disponibles : finalisez votre sejour des maintenant.";
            case 1 -> "Ces dates partent vite. Securisez votre sejour avant qu'il ne soit trop tard.";
            default -> "C'est notre dernier rappel : si vous etes toujours interesse, finalisez votre reservation maintenant.";
        };
        return "<p>Bonjour " + name + ",</p>"
            + "<p>Il reste une etape pour finaliser votre reservation de <b>" + property + "</b>"
            + (dates.isEmpty() ? "" : " (" + dates + ")") + ".</p>"
            + "<p>" + nudge + "</p>";
    }
}
