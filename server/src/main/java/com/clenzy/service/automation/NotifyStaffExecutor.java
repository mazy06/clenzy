package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Executeur {@code NOTIFY_STAFF} du moteur AutomationRule : notification
 * interne aux admins/managers de l'organisation (flux F5c paiement echoue,
 * F9b relance payout, F7a batterie serrure, ou tout autre declencheur).
 *
 * <p>Le titre, le message et la cle de notification sont derives du
 * declencheur de la regle et des donnees du sujet.</p>
 *
 * <p><b>Idempotence</b> : pour les declencheurs one-shot
 * ({@code dedupePerSubject=true}, ex. PAYMENT_FAILED), le moteur garantit au
 * plus une execution par (regle x sujet). Pour les declencheurs RECURRENTS,
 * cet executeur porte sa cle metier :</p>
 * <ul>
 *   <li>PAYOUT_PENDING_REMINDER : UPDATE conditionnel (CAS) sur
 *       {@code owner_payouts.approval_reminder_sent_at} — UNE SEULE relance
 *       par payout, garantie en base ;</li>
 *   <li>autres recurrents (ex. LOCK_BATTERY_CRITICAL, re-signale par le bridge
 *       a chaque evenement de la serrure) : dedup memoire TTL 24 h — meme
 *       precedent que AiModelDeprecationListener ; au pire une notification en
 *       double apres un redemarrage (benin pour une notification).</li>
 * </ul>
 */
@Service
public class NotifyStaffExecutor implements AutomationActionExecutor {

    // ── Types de sujet connus de cet executeur (poses par les capteurs) ──────
    public static final String SUBJECT_PAYOUT = "PAYOUT";
    public static final String SUBJECT_INTERVENTION = "INTERVENTION";
    public static final String SUBJECT_DIRECT_BOOKING = "DIRECT_BOOKING";

    // ── Cles de donnees standard des sujets ──────────────────────────────────
    public static final String DATA_PAYMENT_INTENT_ID = "paymentIntentId";
    public static final String DATA_NET_AMOUNT = "netAmount";
    public static final String DATA_CURRENCY = "currency";
    public static final String DATA_GRACE_DAYS = "graceDays";
    public static final String DATA_DEVICE_NAME = "deviceName";
    /** F7b : horodatage (ISO) de la detection hors-ligne du capteur. */
    public static final String DATA_OFFLINE_SINCE = "offlineSince";

    private static final Logger log = LoggerFactory.getLogger(NotifyStaffExecutor.class);

    private static final Duration MEMORY_DEDUP_TTL = Duration.ofHours(24);

    private final NotificationService notificationService;
    private final OwnerPayoutRepository ownerPayoutRepository;

    /** Dedup memoire (regle x sujet, TTL 24 h) pour les recurrents sans cle en base. */
    private final Map<String, Instant> recentNotifications = new ConcurrentHashMap<>();

    public NotifyStaffExecutor(NotificationService notificationService,
                               OwnerPayoutRepository ownerPayoutRepository) {
        this.notificationService = notificationService;
        this.ownerPayoutRepository = ownerPayoutRepository;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.NOTIFY_STAFF;
    }

    @Override
    public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        AutomationTrigger trigger = rule.getTriggerType();
        if (trigger == AutomationTrigger.PAYOUT_PENDING_REMINDER) {
            if (!claimPayoutReminder(ctx)) {
                return ExecutionResult.skipped(
                        "Payout " + ctx.subjectId() + " deja relance (idempotence CAS)");
            }
        } else if (trigger != null && !trigger.isDedupePerSubject()
                && alreadyNotifiedRecently(rule, ctx)) {
            return ExecutionResult.skipped("Sujet " + ctx.subjectType() + "/" + ctx.subjectId()
                    + " deja notifie dans les dernieres 24 h (dedup memoire)");
        }

        StaffNotification notification = buildFor(rule, ctx);
        notificationService.notifyAdminsAndManagersByOrgId(
                ctx.orgId(),
                notification.key(),
                notification.title(),
                notification.message(),
                notification.actionUrl());
        log.info("NOTIFY_STAFF executee : regle={}, trigger={}, sujet={}/{}, org={}",
                rule.getId(), rule.getTriggerType(), ctx.subjectType(), ctx.subjectId(), ctx.orgId());
        return ExecutionResult.executed();
    }

    /**
     * Cle metier F9b : pose {@code approval_reminder_sent_at} par UPDATE
     * conditionnel — 0 ligne modifiee = payout deja relance.
     */
    private boolean claimPayoutReminder(AutomationActionContext ctx) {
        if (!SUBJECT_PAYOUT.equals(ctx.subjectType()) || ctx.subjectId() == null) {
            throw new IllegalStateException("PAYOUT_PENDING_REMINDER attend un sujet "
                    + SUBJECT_PAYOUT + ", recu : " + ctx.subjectType());
        }
        return ownerPayoutRepository.markApprovalReminderSent(ctx.subjectId(), Instant.now()) > 0;
    }

    private boolean alreadyNotifiedRecently(AutomationRule rule, AutomationActionContext ctx) {
        Instant now = Instant.now();
        Instant expiry = now.minus(MEMORY_DEDUP_TTL);
        recentNotifications.values().removeIf(sentAt -> sentAt.isBefore(expiry));
        String key = rule.getId() + ":" + ctx.subjectType() + ":" + ctx.subjectId();
        return recentNotifications.putIfAbsent(key, now) != null;
    }

    private record StaffNotification(NotificationKey key, String title, String message, String actionUrl) {}

    private StaffNotification buildFor(AutomationRule rule, AutomationActionContext ctx) {
        return switch (rule.getTriggerType()) {
            case PAYOUT_PENDING_REMINDER -> payoutReminder(ctx);
            case PAYMENT_FAILED -> paymentFailed(ctx);
            case LOCK_BATTERY_CRITICAL -> lockBatteryCritical(ctx);
            case IOT_DEVICE_OFFLINE -> deviceOffline(ctx);
            default -> generic(rule, ctx);
        };
    }

    /**
     * F7b : capteur hors ligne. L'idempotence par episode est portee en amont par
     * le capteur (CAS NoiseDevice.online, un fire par transition online→offline) —
     * le dedup memoire 24 h des recurrents reste un filet contre les re-livraisons.
     */
    private StaffNotification deviceOffline(AutomationActionContext ctx) {
        String deviceName = ctx.dataAsString(DATA_DEVICE_NAME);
        String offlineSince = ctx.dataAsString(DATA_OFFLINE_SINCE);
        Long propertyId = ctx.dataAsLong(AutomationSubject.DATA_PROPERTY_ID);
        String message = "Le capteur "
                + (deviceName != null && !deviceName.isBlank() ? deviceName : "#" + ctx.subjectId())
                + " est hors ligne"
                + (offlineSince != null ? " (detecte le " + offlineSince + ")" : "")
                + ". Verifier son alimentation et sa connexion : plus de surveillance bruit "
                + "tant qu'il est deconnecte.";
        return new StaffNotification(NotificationKey.AUTOMATION_STAFF_ALERT,
                "Capteur hors ligne",
                message,
                propertyId != null ? "/properties/" + propertyId : null);
    }

    private StaffNotification payoutReminder(AutomationActionContext ctx) {
        String amount = ctx.dataAsString(DATA_NET_AMOUNT);
        String currency = ctx.dataAsString(DATA_CURRENCY);
        Long graceDays = ctx.dataAsLong(DATA_GRACE_DAYS);
        String message = "Le reversement #" + ctx.subjectId()
                + (amount != null ? " (" + amount + (currency != null ? " " + currency : "") + ")" : "")
                + " attend une approbation"
                + (graceDays != null ? " depuis plus de " + graceDays + " jour(s)" : "")
                + ".";
        return new StaffNotification(NotificationKey.PAYOUT_PENDING_APPROVAL,
                "Reversement en attente d'approbation", message, "/billing?tab=payouts");
    }

    private StaffNotification paymentFailed(AutomationActionContext ctx) {
        String paymentIntentId = ctx.dataAsString(DATA_PAYMENT_INTENT_ID);
        String subject = switch (ctx.subjectType() != null ? ctx.subjectType() : "") {
            case SUBJECT_INTERVENTION -> "l'intervention #" + ctx.subjectId();
            case SUBJECT_DIRECT_BOOKING -> "la reservation directe #" + ctx.subjectId();
            default -> "un paiement";
        };
        String message = "Le paiement Stripe"
                + (paymentIntentId != null ? " " + paymentIntentId : "")
                + " a echoue pour " + subject + ". Une action de suivi est peut-etre necessaire.";
        String actionUrl = SUBJECT_INTERVENTION.equals(ctx.subjectType())
                ? "/interventions/" + ctx.subjectId()
                : "/billing";
        return new StaffNotification(NotificationKey.PAYMENT_FAILED,
                "Paiement echoue", message, actionUrl);
    }

    private StaffNotification lockBatteryCritical(AutomationActionContext ctx) {
        String deviceName = ctx.dataAsString(DATA_DEVICE_NAME);
        String message = "La serrure connectee "
                + (deviceName != null && !deviceName.isBlank() ? deviceName : "#" + ctx.subjectId())
                + " signale une batterie critique. Remplacer les piles avant la panne.";
        return new StaffNotification(NotificationKey.AUTOMATION_STAFF_ALERT,
                "Batterie serrure critique", message, "/interventions");
    }

    private StaffNotification generic(AutomationRule rule, AutomationActionContext ctx) {
        String message = "La regle d'automatisation « " + rule.getName() + " » ("
                + rule.getTriggerType() + ") s'est declenchee pour le sujet "
                + ctx.subjectType() + " #" + ctx.subjectId() + ".";
        return new StaffNotification(NotificationKey.AUTOMATION_STAFF_ALERT,
                "Automatisation declenchee", message, null);
    }
}
