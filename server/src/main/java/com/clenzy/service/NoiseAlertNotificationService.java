package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.service.messaging.EmailWrapperService;
import com.clenzy.service.messaging.SystemEmailTemplateService;
import com.clenzy.service.messaging.TemplateInterpolationService;
import com.clenzy.service.messaging.whatsapp.WhatsAppProvider;
import com.clenzy.service.messaging.whatsapp.WhatsAppProviderResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Fan-out de notifications pour les alertes bruit.
 * Best-effort : chaque canal est independant, une erreur n'empeche pas les autres.
 */
@Service
public class NoiseAlertNotificationService {

    private static final Logger log = LoggerFactory.getLogger(NoiseAlertNotificationService.class);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    /** Nom Meta du template alerte bruit (cf. whatsapp-templates/noise_alert.yaml). */
    private static final String NOISE_ALERT_TEMPLATE = "clenzy_noise_alert_v1";
    /** Prefixe Redis de l'idempotence « 1 avertissement voyageur max / sejour / 24 h » (F6a). */
    static final String GUEST_WARNING_KEY_PREFIX = "noise:guest-warning:";
    private static final Duration GUEST_WARNING_TTL = Duration.ofHours(24);

    private final NotificationService notificationService;
    private final EmailService emailService;
    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final SystemEmailTemplateService systemEmailTemplateService;
    private final TemplateInterpolationService templateInterpolationService;
    private final EmailWrapperService emailWrapperService;
    // WhatsApp via l'abstraction provider (Meta Cloud API / OpenWA selon la config
    // de l'org). Beans non-conditionnels => demarrage toujours OK ; si l'org n'a pas
    // de config WhatsApp active, l'envoi est simplement ignore (best-effort).
    private final WhatsAppProviderResolver whatsAppProviderResolver;
    private final WhatsAppConfigRepository whatsAppConfigRepository;
    private final NoiseAlertRepository noiseAlertRepository;
    private final StringRedisTemplate redisTemplate;

    public NoiseAlertNotificationService(NotificationService notificationService,
                                          EmailService emailService,
                                          PropertyRepository propertyRepository,
                                          ReservationRepository reservationRepository,
                                          SystemEmailTemplateService systemEmailTemplateService,
                                          TemplateInterpolationService templateInterpolationService,
                                          EmailWrapperService emailWrapperService,
                                          WhatsAppProviderResolver whatsAppProviderResolver,
                                          WhatsAppConfigRepository whatsAppConfigRepository,
                                          NoiseAlertRepository noiseAlertRepository,
                                          StringRedisTemplate redisTemplate) {
        this.whatsAppProviderResolver = whatsAppProviderResolver;
        this.whatsAppConfigRepository = whatsAppConfigRepository;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.systemEmailTemplateService = systemEmailTemplateService;
        this.templateInterpolationService = templateInterpolationService;
        this.emailWrapperService = emailWrapperService;
        this.noiseAlertRepository = noiseAlertRepository;
        this.redisTemplate = redisTemplate;
    }

    /**
     * Dispatche toutes les notifications configurees pour cette alerte.
     */
    public void dispatch(NoiseAlert alert, NoiseAlertConfig config) {
        Property property = propertyRepository.findById(alert.getPropertyId()).orElse(null);
        String propertyName = property != null ? property.getName() : "Logement #" + alert.getPropertyId();

        // 1. Notification in-app
        if (config.isNotifyInApp()) {
            dispatchInApp(alert, config, property, propertyName);
        }

        // 2. Email au proprietaire
        if (config.isNotifyEmail()) {
            dispatchEmail(alert, config, property, propertyName);
        }

        // 3. Message au voyageur (si reservation active) — WhatsApp d'abord,
        //    repli email, 1 avertissement max par sejour par 24 h (F6a).
        if (config.isNotifyGuestMessage()) {
            GuestWarningOutcome outcome = sendGuestWarning(alert);
            if (!outcome.sent()) {
                log.debug("Message voyageur non envoye pour alerte {} : {}",
                    alert.getId(), outcome.skipReason());
            }
        }
    }

    // ─── In-App ────────────────────────────────────────────────────────────────

    private void dispatchInApp(NoiseAlert alert, NoiseAlertConfig config,
                                Property property, String propertyName) {
        try {
            NotificationKey key = alert.getSeverity() == NoiseAlert.AlertSeverity.CRITICAL
                ? NotificationKey.NOISE_ALERT_CRITICAL
                : NotificationKey.NOISE_ALERT_WARNING;

            String title = alert.getSeverity() == NoiseAlert.AlertSeverity.CRITICAL
                ? "Alerte bruit critique — " + propertyName
                : "Alerte bruit — " + propertyName;

            String message = String.format("Niveau sonore de %.0f dB detecte (seuil: %d dB, creneau: %s)",
                alert.getMeasuredDb(), alert.getThresholdDb(),
                alert.getTimeWindowLabel() != null ? alert.getTimeWindowLabel() : "—");

            if (property != null && property.getOwner() != null
                    && property.getOwner().getKeycloakId() != null) {
                String actionUrl = "/connected-objects/property/" + alert.getPropertyId()
                        + "?highlight=" + alert.getId();
                notificationService.send(
                    property.getOwner().getKeycloakId(), key, title, message, actionUrl);
                alert.setNotifiedInApp(true);
            }
        } catch (Exception e) {
            log.error("Erreur notification in-app pour alerte {}: {}", alert.getId(), e.getMessage());
        }
    }

    // ─── Email ─────────────────────────────────────────────────────────────────

    private void dispatchEmail(NoiseAlert alert, NoiseAlertConfig config,
                                Property property, String propertyName) {
        try {
            List<String> recipients = resolveEmailRecipients(config, property);
            if (recipients.isEmpty()) {
                log.debug("Pas de destinataire email pour alerte {}", alert.getId());
                return;
            }

            // Resolution du template depuis system_email_template avec fallback
            // systeme si l'org n'a pas d'override (cf. SystemEmailTemplateService).
            var template = systemEmailTemplateService.resolve(
                alert.getOrganizationId(), "noise_alert_owner", "fr").orElse(null);
            if (template == null) {
                log.warn("Template systeme noise_alert_owner introuvable — alerte {} non envoyee", alert.getId());
                return;
            }

            Map<String, String> vars = buildNoiseAlertVariables(alert, propertyName);
            String subject = templateInterpolationService.interpolate(template.getSubject(), vars, false);
            String interpolatedBody = templateInterpolationService.interpolate(template.getBody(), vars, true);
            String htmlBody = emailWrapperService.wrap(template.getWrapperStyle(), interpolatedBody);

            for (String recipient : recipients) {
                emailService.sendContactMessage(
                    recipient, null, null, null, subject, htmlBody, List.of());
            }
            alert.setNotifiedEmail(true);
        } catch (Exception e) {
            log.error("Erreur notification email pour alerte {}: {}", alert.getId(), e.getMessage());
        }
    }

    /**
     * Construit la map des variables d'interpolation pour le template
     * {@code noise_alert_owner}. Les valeurs HTML-safe (severityColor,
     * severityLabel) sont listees dans
     * {@link TemplateInterpolationService#HTML_SAFE_VARIABLES} pour ne pas etre
     * re-echappees au rendu.
     */
    private Map<String, String> buildNoiseAlertVariables(NoiseAlert alert, String propertyName) {
        boolean critical = alert.getSeverity() == NoiseAlert.AlertSeverity.CRITICAL;
        Map<String, String> vars = new HashMap<>();
        vars.put("propertyName", propertyName);
        vars.put("severityLabel", critical ? "CRITIQUE" : "AVERTISSEMENT");
        vars.put("severityColor", critical ? "#D32F2F" : "#ED6C02");
        vars.put("measuredDb", String.format("%.0f", alert.getMeasuredDb()));
        vars.put("thresholdDb", String.valueOf(alert.getThresholdDb()));
        vars.put("timeWindow", alert.getTimeWindowLabel() != null ? alert.getTimeWindowLabel() : "—");
        vars.put("alertTime", alert.getCreatedAt() != null ? alert.getCreatedAt().format(TIME_FMT) : "—");
        return vars;
    }

    private List<String> resolveEmailRecipients(NoiseAlertConfig config, Property property) {
        // Priorite : destinataires configures > email du proprietaire
        if (config.getEmailRecipients() != null && !config.getEmailRecipients().isBlank()) {
            return List.of(config.getEmailRecipients().split("[,;\\s]+"));
        }
        if (property != null && property.getOwner() != null
                && property.getOwner().getEmail() != null) {
            return List.of(property.getOwner().getEmail());
        }
        return List.of();
    }

    // ─── Guest warning (F6a — pont alerte → voyageur) ───────────────────────────

    /**
     * Resultat explicite de l'avertissement voyageur : envoye (avec canal), ou
     * saute avec raison lisible — consommee par l'executeur SEND_NOISE_WARNING.
     */
    public record GuestWarningOutcome(boolean sent, String channel, String skipReason) {
        static GuestWarningOutcome sentVia(String channel) {
            return new GuestWarningOutcome(true, channel, null);
        }

        static GuestWarningOutcome skipped(String reason) {
            return new GuestWarningOutcome(false, null, reason);
        }
    }

    /**
     * Avertit le voyageur du sejour EN COURS sur la propriete de l'alerte :
     * WhatsApp (template Meta {@value #NOISE_ALERT_TEMPLATE}) si disponible,
     * repli email sinon.
     *
     * <p><b>Idempotence F6a</b> : UN avertissement maximum par sejour par 24 h,
     * claim Redis atomique ({@code SETNX} + TTL 24 h) partage entre le chemin
     * historique (config bruit {@code notifyGuestMessage}) et l'executeur
     * SEND_NOISE_WARNING du moteur — les deux actives ne produisent qu'un
     * message. Si Redis est indisponible, repli sur la trace en base
     * ({@code notified_guest}/{@code notified_whatsapp} des alertes des
     * dernieres 24 h). Le claim est relache si aucun canal n'a pu envoyer.</p>
     */
    public GuestWarningOutcome sendGuestWarning(NoiseAlert alert) {
        Property property = propertyRepository.findById(alert.getPropertyId()).orElse(null);
        String propertyName = property != null ? property.getName() : "Logement #" + alert.getPropertyId();

        Reservation reservation = reservationRepository
            .findActiveByPropertyIdAndDate(
                alert.getPropertyId(), LocalDate.now(), alert.getOrganizationId())
            .orElse(null);
        if (reservation == null) {
            return GuestWarningOutcome.skipped("aucune reservation en cours sur la propriete "
                + alert.getPropertyId());
        }
        Guest guest = reservation.getGuest();
        if (guest == null) {
            return GuestWarningOutcome.skipped("reservation " + reservation.getId() + " sans voyageur");
        }

        if (!claimGuestWarningWindow(alert, reservation)) {
            return GuestWarningOutcome.skipped("voyageur deja averti il y a moins de 24 h (sejour "
                + reservation.getId() + ")");
        }

        boolean sentWhatsApp = trySendWhatsApp(alert, guest, propertyName, reservation.getId());
        if (sentWhatsApp) {
            alert.setNotifiedWhatsapp(true);
            noiseAlertRepository.save(alert);
            return GuestWarningOutcome.sentVia("whatsapp");
        }

        boolean sentEmail = trySendEmail(alert, guest, propertyName, reservation.getId());
        if (sentEmail) {
            alert.setNotifiedGuest(true);
            noiseAlertRepository.save(alert);
            return GuestWarningOutcome.sentVia("email");
        }

        // Aucun canal n'a pu envoyer : relacher la fenetre pour ne pas bloquer
        // une prochaine alerte du meme sejour.
        releaseGuestWarningWindow(reservation.getId());
        return GuestWarningOutcome.skipped("aucun canal disponible (ni WhatsApp ni email) pour la reservation "
            + reservation.getId());
    }

    /**
     * Claim atomique de la fenetre « 1 avertissement / sejour / 24 h ».
     * Redis SETNX + TTL ; repli lecture base si Redis est indisponible.
     */
    private boolean claimGuestWarningWindow(NoiseAlert alert, Reservation reservation) {
        String key = GUEST_WARNING_KEY_PREFIX + reservation.getId();
        try {
            Boolean claimed = redisTemplate.opsForValue()
                .setIfAbsent(key, String.valueOf(alert.getId()), GUEST_WARNING_TTL);
            return Boolean.TRUE.equals(claimed);
        } catch (Exception redisDown) {
            log.warn("Redis indisponible pour l'idempotence avertissement voyageur ({}) — repli base",
                redisDown.getMessage());
            return !noiseAlertRepository.existsGuestNotifiedSince(
                alert.getPropertyId(), LocalDateTime.now().minusHours(24));
        }
    }

    private void releaseGuestWarningWindow(Long reservationId) {
        try {
            redisTemplate.delete(GUEST_WARNING_KEY_PREFIX + reservationId);
        } catch (Exception e) {
            log.debug("Liberation claim avertissement voyageur impossible ({}) — expirera par TTL",
                e.getMessage());
        }
    }

    /**
     * Tente l'envoi WhatsApp (template Meta approuve, obligatoire hors fenetre de
     * session 24 h ; repli texte libre pour les providers sans templates type OpenWA).
     *
     * @return true si un message est parti — false si non configure/numero absent/erreur
     *         provider (le repli email prend alors la main)
     */
    private boolean trySendWhatsApp(NoiseAlert alert, Guest guest, String propertyName, Long reservationId) {
        try {
            // WhatsApp via Meta Cloud API (ou OpenWA) selon la config de l'org.
            // Resolution par orgId explicite : hors HTTP, pas de TenantContext.
            WhatsAppConfig waConfig = whatsAppConfigRepository
                .findByOrganizationId(alert.getOrganizationId()).orElse(null);
            if (waConfig == null || !waConfig.isEnabled()) {
                log.debug("WhatsApp non configure/desactive pour org {} — repli email (alerte {})",
                    alert.getOrganizationId(), alert.getId());
                return false;
            }
            if (guest.getPhone() == null || guest.getPhone().isBlank()) {
                log.debug("Pas de telephone voyageur pour reservation {} — repli email", reservationId);
                return false;
            }

            String guestName = guest.getFullName() != null ? guest.getFullName() : "Cher voyageur";
            WhatsAppProvider provider = whatsAppProviderResolver.resolve(waConfig);
            List<String> templateParams = List.of(
                guestName,
                String.format("%.0f", alert.getMeasuredDb()),
                String.valueOf(alert.getThresholdDb()),
                propertyName);

            try {
                // Template approuve Meta (obligatoire hors fenetre 24h), variables {{1}}..{{4}}.
                provider.sendTemplateMessage(waConfig, guest.getPhone(),
                    NOISE_ALERT_TEMPLATE, toMetaLocale(guest.getLanguage()), templateParams);
            } catch (UnsupportedOperationException templateNotSupported) {
                // Provider sans templates Meta (OpenWA) : repli sur texte libre.
                String body = String.format(
                    "Bonjour %s, un niveau sonore eleve (%.0f dB, seuil %d dB) a ete detecte au logement "
                    + "\"%s\". Merci de veiller a preserver le calme afin de ne pas gener le voisinage.",
                    guestName, alert.getMeasuredDb(), alert.getThresholdDb(), propertyName);
                provider.sendTextMessage(waConfig, guest.getPhone(), body);
            }
            log.info("WhatsApp voyageur envoye pour alerte {} (reservation {})",
                alert.getId(), reservationId);
            return true;
        } catch (Exception e) {
            log.error("Erreur WhatsApp voyageur pour alerte {} — repli email: {}",
                alert.getId(), e.getMessage());
            return false;
        }
    }

    /**
     * Envoi email au voyageur via le template systeme {@code noise_alert_guest}
     * (override per-org &gt; systeme).
     *
     * @return true si l'email est parti
     */
    private boolean trySendEmail(NoiseAlert alert, Guest guest, String propertyName, Long reservationId) {
        try {
            if (guest.getEmail() == null || guest.getEmail().isBlank()) {
                log.debug("Pas d'email voyageur pour reservation {} — message impossible", reservationId);
                return false;
            }

            var template = systemEmailTemplateService.resolve(
                alert.getOrganizationId(), "noise_alert_guest", "fr").orElse(null);
            if (template == null) {
                log.warn("Template systeme noise_alert_guest introuvable — alerte {} non envoyee", alert.getId());
                return false;
            }

            String guestName = guest.getFullName() != null ? guest.getFullName() : "Cher voyageur";
            Map<String, String> vars = Map.of(
                "guestName", guestName,
                "propertyName", propertyName
            );
            String subject = templateInterpolationService.interpolate(template.getSubject(), vars, false);
            String interpolatedBody = templateInterpolationService.interpolate(template.getBody(), vars, true);
            String htmlBody = emailWrapperService.wrap(template.getWrapperStyle(), interpolatedBody);

            emailService.sendContactMessage(
                guest.getEmail(), guestName, null, null, subject, htmlBody, List.of());

            log.info("Message voyageur envoye a {} pour alerte {} (reservation {})",
                guest.getEmail(), alert.getId(), reservationId);
            return true;
        } catch (Exception e) {
            log.error("Erreur message voyageur pour alerte {}: {}", alert.getId(), e.getMessage());
            return false;
        }
    }

    /**
     * Mappe la langue guest (fr/en/ar) vers la locale Meta (fr_FR/en_US/ar_AR).
     * Defaut fr_FR.
     */
    private static String toMetaLocale(String language) {
        if (language == null) return "fr_FR";
        return switch (language.toLowerCase()) {
            case "en" -> "en_US";
            case "ar" -> "ar_AR";
            default -> "fr_FR";
        };
    }

}
