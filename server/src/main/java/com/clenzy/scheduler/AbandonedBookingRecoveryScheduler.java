package com.clenzy.scheduler;

import com.clenzy.model.AbandonedBooking;
import com.clenzy.repository.AbandonedBookingRepository;
import com.clenzy.repository.MarketingContactRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.AbandonedBookingService;
import com.clenzy.service.EmailService;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Relance des paniers abandonnés (CLZ Domaine 2 + multi-étapes 2.12) : relance échelonnée à 1h /
 * 24h / 72h après création. Chaque run envoie l'étape DUE (selon {@code reminderCount} + l'âge) puis
 * incrémente le compteur ; la dernière étape passe le panier en RECOVERY_SENT. L'envoi email est
 * réalisé hors transaction (#2) ; un échec laisse le panier en l'état pour réessai au prochain run.
 *
 * <p>Garde-fous :</p>
 * <ul>
 *   <li><b>Flag global</b> {@code clenzy.booking.cart-recovery.enabled} (défaut {@code false}) :
 *       la feature est inerte tant qu'elle n'est pas explicitement activée ;</li>
 *   <li><b>Flag org</b> {@code Organization.abandonedCartRecoveryEnabled} : skip des orgs ayant
 *       désactivé la relance ;</li>
 *   <li><b>Consentement RGPD</b> : un email n'est relancé que s'il existe un contact marketing
 *       <i>consenti et toujours abonné</i> (SUBSCRIBED) pour l'org — l'opt-out (UNSUBSCRIBED) est
 *       donc respecté de fait ;</li>
 *   <li><b>Borne</b> : au plus {@code STEP_DELAYS.length} relances par panier.</li>
 * </ul>
 *
 * <p>L'idempotence est garantie par étape : {@code reminderCount} n'avance qu'après envoi réussi, et
 * le candidat est ré-évalué par run — un email déjà envoyé pour l'étape courante n'est pas renvoyé.</p>
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
    private final MarketingContactRepository marketingContactRepository;
    private final SupervisionActivityService supervisionActivityService;
    private final Clock clock;
    private final boolean enabled;
    private final String baseUrl;

    public AbandonedBookingRecoveryScheduler(AbandonedBookingRepository repository,
                                             AbandonedBookingService abandonedBookingService,
                                             EmailService emailService,
                                             OrganizationRepository organizationRepository,
                                             MarketingContactRepository marketingContactRepository,
                                             SupervisionActivityService supervisionActivityService,
                                             Clock clock,
                                             @Value("${clenzy.booking.cart-recovery.enabled:false}") boolean enabled,
                                             @Value("${clenzy.base-url:https://app.clenzy.fr}") String baseUrl) {
        this.repository = repository;
        this.abandonedBookingService = abandonedBookingService;
        this.emailService = emailService;
        this.organizationRepository = organizationRepository;
        this.marketingContactRepository = marketingContactRepository;
        this.supervisionActivityService = supervisionActivityService;
        this.clock = clock;
        this.enabled = enabled;
        this.baseUrl = baseUrl;
    }

    @Scheduled(fixedDelayString = "${clenzy.booking.abandoned-cart.recovery-interval-ms:900000}")
    @SchedulerLock(name = "abandoned-booking-recovery-emails", lockAtMostFor = "PT10M", lockAtLeastFor = "PT30S")
    public void sendRecoveryEmails() {
        if (!enabled) {
            return; // feature inerte par défaut (flag global de décision)
        }
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
                continue; // garde-fou : compteur hors plage (borne max de relances)
            }
            if (Duration.between(ab.getCreatedAt(), now).compareTo(STEP_DELAYS[step]) < 0) {
                continue; // l'échéance de l'étape courante n'est pas encore atteinte
            }
            // Gate RGPD : ne relancer que si l'email est consenti ET toujours abonné (opt-out respecté).
            if (!hasConsent(ab)) {
                continue;
            }
            boolean finalStep = step == STEP_DELAYS.length - 1;
            try {
                emailService.sendSimpleHtmlEmail(ab.getGuestEmail(), subject(ab, step), body(ab, step));
                abandonedBookingService.recordReminderSent(ab, finalStep);
                recordConstellationActivity(ab, step);
            } catch (Exception e) {
                // Best-effort : on laisse en l'état -> reessai au prochain run.
                log.warn("Relance panier abandonne {} (etape {}) echouee: {}", ab.getId(), step, e.getMessage());
            }
        }
    }

    /**
     * Fait remonter la relance de panier abandonné dans le feed « En direct » de la CONSTELLATION du
     * logement (agent Communication « com »), en plus de l'email envoyé : la propriété est celle du
     * snapshot du panier ({@code propertyId}), org-scopée par occurrence. Best-effort (le record est
     * lui-même best-effort côté service) — un échec ne casse jamais le scheduler.
     */
    private void recordConstellationActivity(AbandonedBooking ab, int step) {
        try {
            Long propertyId = ab.getPropertyId();
            if (propertyId == null) {
                return; // panier sans logement rattaché → rien à afficher dans une constellation
            }
            int reminderNumber = step + 1;
            String property = ab.getPropertyName() != null && !ab.getPropertyName().isBlank()
                ? ab.getPropertyName() : "ce logement";
            String summary = "Relance panier abandonné " + reminderNumber + "/" + STEP_DELAYS.length
                + " envoyée pour " + property;
            supervisionActivityService.recordModuleAct(
                ab.getOrganizationId(), propertyId, "com", "cart_reminder_sent", summary);
        } catch (Exception e) {
            log.debug("Relance panier: activite constellation non enregistree (panier {}): {}",
                ab.getId(), e.getMessage());
        }
    }

    /**
     * {@code true} si l'email du panier correspond à un contact marketing consenti et toujours abonné
     * pour l'org. Sans consentement (ou après opt-out), on ne relance pas (RGPD).
     */
    private boolean hasConsent(AbandonedBooking ab) {
        String email = ab.getGuestEmail();
        if (email == null || email.isBlank()) {
            return false;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        Set<String> consented = new HashSet<>(
            marketingContactRepository.findConsentedSubscribedEmails(ab.getOrganizationId(), Set.of(normalized)));
        return consented.contains(normalized);
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
        String resumeLink = resumeLink(ab);
        return "<p>Bonjour " + name + ",</p>"
            + "<p>Il reste une etape pour finaliser votre reservation de <b>" + property + "</b>"
            + (dates.isEmpty() ? "" : " (" + dates + ")") + ".</p>"
            + "<p>" + nudge + "</p>"
            + "<p><a href=\"" + resumeLink + "\">Reprendre ma reservation</a></p>";
    }

    /**
     * Deep-link de reprise vers le widget de réservation, pré-rempli depuis le snapshot du panier
     * (propriété + dates + voyageurs). Construit sur {@code clenzy.base-url} ; les paramètres
     * reprennent le contrat du SDK booking (propertyId / checkIn / checkOut / guests). L'URL est
     * échappée HTML (injectée dans un email) — les valeurs sont url-encodées.
     */
    private String resumeLink(AbandonedBooking ab) {
        StringBuilder url = new StringBuilder(baseUrl.endsWith("/")
            ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl);
        url.append("/book?");
        if (ab.getPropertyId() != null) {
            url.append("propertyId=").append(ab.getPropertyId()).append('&');
        }
        if (ab.getCheckIn() != null) {
            url.append("checkIn=").append(enc(ab.getCheckIn().toString())).append('&');
        }
        if (ab.getCheckOut() != null) {
            url.append("checkOut=").append(enc(ab.getCheckOut().toString())).append('&');
        }
        if (ab.getGuests() != null) {
            url.append("guests=").append(ab.getGuests()).append('&');
        }
        url.append("source=cart-recovery");
        return StringUtils.escapeHtml(url.toString());
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
