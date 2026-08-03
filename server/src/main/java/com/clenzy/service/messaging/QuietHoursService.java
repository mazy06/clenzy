package com.clenzy.service.messaging;

import com.clenzy.model.MessagingAutomationConfig;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SupervisionActivity;
import com.clenzy.service.access.StayTimes;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * M10 — heures calmes de la messagerie automatique. Décide, en heure LOCALE du
 * logement, si un envoi automatique non urgent doit être reporté à la fin de la
 * fenêtre calme de l'org (défaut 22:00 → 08:00, désactivable en vidant les champs).
 *
 * <p>Le report lui-même est porté par le moteur d'automatisation existant
 * ({@code ExecutionResult.rescheduled} → l'exécution repart en PENDING à la
 * nouvelle échéance) : aucun stock de messages parallèle. Chaque report écrit
 * une entrée de feed taguée {@link SupervisionActivity#TAG_DEFERRED} — la
 * plomberie front (« différé ») attendait ce writer.</p>
 */
@Service
public class QuietHoursService {

    private final GuestMessagingQueryService queryService;
    private final SupervisionActivityService activityService;
    private final Clock clock;

    public QuietHoursService(GuestMessagingQueryService queryService,
                             SupervisionActivityService activityService,
                             Clock clock) {
        this.queryService = queryService;
        this.activityService = activityService;
        this.clock = clock;
    }

    /**
     * Échéance de reprise (heure murale SERVEUR, convention du drain
     * {@code automation_executions.scheduled_at}) si l'instant courant tombe dans
     * les heures calmes du logement — {@code null} sinon (fenêtre désactivée,
     * config illisible, ou heure pleine).
     */
    public LocalDateTime deferUntilIfQuiet(Long orgId, Reservation reservation) {
        final Property property = reservation != null ? reservation.getProperty() : null;
        if (orgId == null || property == null) {
            return null;
        }
        final MessagingAutomationConfig config = queryService.getConfigOrDefault(orgId);
        final LocalTime start = StayTimes.parseTime(config.getQuietHoursStart(), null);
        final LocalTime end = StayTimes.parseTime(config.getQuietHoursEnd(), null);
        if (start == null || end == null || start.equals(end)) {
            return null; // fenêtre désactivée (champ vidé) ou dégénérée
        }
        final ZoneId zone = StayTimes.zoneOf(property);
        final ZonedDateTime nowLocal = ZonedDateTime.now(clock).withZoneSameInstant(zone);
        if (!isWithinWindow(nowLocal.toLocalTime(), start, end)) {
            return null;
        }
        // Fin de fenêtre : aujourd'hui si encore à venir en heure locale, sinon demain
        // (fenêtre 22:00 → 08:00 : à 23 h la reprise est demain 08:00, à 6 h aujourd'hui).
        ZonedDateTime resumeLocal = nowLocal.with(end);
        if (!resumeLocal.isAfter(nowLocal)) {
            resumeLocal = resumeLocal.plusDays(1);
        }
        return resumeLocal.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
    }

    /** [start, end) avec gestion du passage de minuit (22:00 → 08:00). */
    static boolean isWithinWindow(LocalTime now, LocalTime start, LocalTime end) {
        if (start.isBefore(end)) {
            return !now.isBefore(start) && now.isBefore(end);
        }
        return !now.isBefore(start) || now.isBefore(end);
    }

    /**
     * Trace le report dans le feed de la constellation (tag DEFERRED, gris —
     * une info de rythme, pas une action). Best-effort côté service d'activité.
     */
    public void recordDeferred(Long orgId, Reservation reservation, String moduleKey,
                               String ruleName, LocalDateTime resumeAt) {
        final Property property = reservation.getProperty();
        if (property == null) {
            return;
        }
        activityService.recordModuleActTagged(orgId, property.getId(), moduleKey,
                "message_deferred_quiet_hours",
                "Message « " + ruleName + " » mis en file — envoi à "
                        + resumeAt.format(DateTimeFormatter.ofPattern("HH:mm"))
                        + " (heures calmes du logement)",
                null, null, SupervisionActivity.TAG_DEFERRED);
    }
}
