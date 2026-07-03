package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Executeur {@code NOTIFY_RATE_PARITY} (S2) : notifie les admins/managers de
 * l'organisation qu'une propriete affiche un prix canal (Channex) divergent du
 * prix attendu (PriceEngine local).
 *
 * <p><b>Idempotence</b> : declencheur RECURRENT ({@code dedupePerSubject=false},
 * le capteur quotidien re-presente le sujet tant que la disparite persiste) —
 * la cle metier est bien+jour calendaire : dedup memoire (regle x propriete x
 * jour), au pire une notification en double apres un redemarrage (benin).</p>
 *
 * <p>Les metriques du moteur sont incrementees par le moteur, pas ici.</p>
 */
@Service
public class NotifyRateParityExecutor implements AutomationActionExecutor {

    // ── Cles de donnees du sujet (posees par RateParityScheduler) ────────────
    public static final String DATA_PROPERTY_NAME = "propertyName";
    public static final String DATA_DISPARITY_DAYS = "disparityDays";
    public static final String DATA_MAX_DEVIATION_PERCENT = "maxDeviationPercent";
    /** Slugs OTA en disparite, CSV (ex : {@code airbnb,booking_com}). */
    public static final String DATA_CHANNELS = "channels";

    private static final Logger log = LoggerFactory.getLogger(NotifyRateParityExecutor.class);

    private final NotificationService notificationService;

    /** Dedup memoire cle bien+jour : regle x sujet x jour calendaire. */
    private final Map<String, Instant> notifiedToday = new ConcurrentHashMap<>();

    public NotifyRateParityExecutor(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.NOTIFY_RATE_PARITY;
    }

    @Override
    public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        if (!claimForToday(rule, ctx)) {
            return ExecutionResult.skipped("Propriete " + ctx.subjectId()
                    + " deja notifiee aujourd'hui (cle bien+jour)");
        }

        notificationService.notifyAdminsAndManagersByOrgId(
                ctx.orgId(),
                NotificationKey.CHANNEX_PRICE_DRIFT_DETECTED,
                "Disparite de prix entre canaux",
                buildMessage(ctx),
                "/channels");
        log.info("NOTIFY_RATE_PARITY executee : regle={}, sujet={}/{}, org={}",
                rule.getId(), ctx.subjectType(), ctx.subjectId(), ctx.orgId());
        return ExecutionResult.executed();
    }

    /**
     * Message depuis les donnees volatiles du sujet ; {@code ctx.data()} peut
     * etre vide (chemin planifie/draine) — repli generique depuis le sujet seul.
     */
    private String buildMessage(AutomationActionContext ctx) {
        String propertyName = ctx.dataAsString(DATA_PROPERTY_NAME);
        String subject = propertyName != null && !propertyName.isBlank()
                ? "« " + propertyName + " »"
                : "La propriete #" + ctx.subjectId();

        Long disparityDays = ctx.dataAsLong(DATA_DISPARITY_DAYS);
        String maxDeviation = ctx.dataAsString(DATA_MAX_DEVIATION_PERCENT);
        String channels = ctx.dataAsString(DATA_CHANNELS);

        StringBuilder message = new StringBuilder(subject)
                .append(" : le prix publie sur les canaux diverge du prix attendu");
        if (channels != null && !channels.isBlank()) {
            message.append(" (").append(channels.replace(",", ", ")).append(')');
        }
        if (disparityDays != null && disparityDays > 0) {
            message.append(" sur ").append(disparityDays).append(" jour")
                    .append(disparityDays > 1 ? "s" : "");
        }
        if (maxDeviation != null && !maxDeviation.isBlank()) {
            message.append(", ecart max ").append(maxDeviation).append(" %");
        }
        return message.append(". Verifier la tarification et la synchronisation Channex.")
                .toString();
    }

    /** Cle bien+jour : au plus une notification par (regle x sujet) et par jour. */
    private boolean claimForToday(AutomationRule rule, AutomationActionContext ctx) {
        Instant now = Instant.now();
        Instant expiry = now.minus(48, ChronoUnit.HOURS);
        notifiedToday.values().removeIf(sentAt -> sentAt.isBefore(expiry));
        String key = rule.getId() + ":" + ctx.subjectType() + ":" + ctx.subjectId()
                + ":" + LocalDate.now();
        return notifiedToday.putIfAbsent(key, now) == null;
    }
}
