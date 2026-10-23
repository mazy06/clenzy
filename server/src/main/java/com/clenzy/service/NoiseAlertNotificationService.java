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
        //    email si aucun canal WhatsApp n’est prepare ; pas de repli apres tentative.
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
                notificationService.notify(
                    property.getOwner().getKeycloakId(), key, title, message, actionUrl,
                    // Mesure et seuil voyagent avec l'alerte : la fiche les
                    // dessine en jauge, la ou le message les enfermait dans une
                    // phrase. Rien de plus a lire en base — ils sont deja la.
                    NotificationMetadata.of()
                        .property(propertyName)
                        .propertyId(alert.getPropertyId())
                        .noise(alert.getMeasuredDb(), alert.getThresholdDb())
                        .build());
                alert.setNotifiedInApp(true);
            }
        } catch (Exception e) {
            log.error("Baitly bruit : notification interne non confirmee pour alerte {}", alert.getId());
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
            log.error("Baitly bruit : notification email non confirmee pour alerte {}", alert.getId());
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
     * Prepare le canal avant le claim. Une fois un envoi tente, une erreur est
     * incertaine : aucun second canal et aucune liberation du claim.
     * Redis indisponible ou reponse nulle : refus, jamais lecture DB non exclusive.
     * La fenetre Redis de 24 h reste une limite ; elle ne constitue pas un journal durable.
     */
    public GuestWarningOutcome sendGuestWarning(NoiseAlert alert) {
        Property property = propertyRepository.findById(alert.getPropertyId()).orElse(null);
        String propertyName = property != null ? property.getName() : "Logement #" + alert.getPropertyId();
        Reservation reservation = reservationRepository
            .findActiveByPropertyIdAndDate(
                alert.getPropertyId(), LocalDate.now(), alert.getOrganizationId())
            .orElse(null);
        if (reservation == null || reservation.getGuest() == null) {
            return GuestWarningOutcome.skipped("aucun voyageur sur un sejour actif");
        }

        final GuestDelivery delivery;
        try {
            delivery = prepareGuestDelivery(alert, reservation.getGuest(), propertyName);
        } catch (Exception preparationFailure) {
            log.warn("Baitly bruit : preparation du canal indisponible pour alerte {}", alert.getId());
            return GuestWarningOutcome.skipped("preparation du canal indisponible");
        }
        if (delivery == null) {
            return GuestWarningOutcome.skipped("aucun canal disponible");
        }
        if (!claimGuestWarningWindow(alert, reservation)) {
            return GuestWarningOutcome.skipped("avertissement bloque : exclusivite non acquise");
        }

        try {
            delivery.send().run();
            if ("whatsapp".equals(delivery.channel())) {
                alert.setNotifiedWhatsapp(true);
            } else {
                alert.setNotifiedGuest(true);
            }
            noiseAlertRepository.save(alert);
            log.info("Baitly bruit : avertissement delegue pour alerte {}", alert.getId());
            return GuestWarningOutcome.sentVia(delivery.channel());
        } catch (Exception uncertain) {
            // Le provider a pu accepter le message, ou l'ecriture locale a echoue.
            // Conserver la fenetre meme si l'exception semble etre un refus.
            log.error("Baitly bruit : avertissement non confirme pour alerte {}", alert.getId());
            return GuestWarningOutcome.skipped("resultat incertain : rapprochement necessaire");
        }
    }

    private record GuestDelivery(String channel, Runnable send) {}

    private GuestDelivery prepareGuestDelivery(NoiseAlert alert, Guest guest, String propertyName) {
        WhatsAppConfig waConfig = whatsAppConfigRepository
            .findByOrganizationId(alert.getOrganizationId()).orElse(null);
        if (waConfig != null && waConfig.isEnabled()
                && guest.getPhone() != null && !guest.getPhone().isBlank()) {
            WhatsAppProvider provider = whatsAppProviderResolver.resolve(waConfig);
            WhatsAppProviderType type = provider.getProviderType();
            if (type == null) throw new IllegalStateException("Canal non qualifie");
            String guestName = guest.getFullName() != null ? guest.getFullName() : "Cher voyageur";
            if (type == WhatsAppProviderType.OPENWA) {
                String body = String.format(
                    "Bonjour %s, un niveau sonore eleve (%.0f dB, seuil %d dB) a ete detecte au logement "
                    + "\"%s\". Merci de veiller a preserver le calme afin de ne pas gener le voisinage.",
                    guestName, alert.getMeasuredDb(), alert.getThresholdDb(), propertyName);
                return new GuestDelivery("whatsapp", () ->
                    requireMessageId(provider.sendTextMessage(waConfig, guest.getPhone(), body)));
            }
            List<String> parameters = List.of(guestName, String.format("%.0f", alert.getMeasuredDb()),
                String.valueOf(alert.getThresholdDb()), propertyName);
            String language = toMetaLocale(guest.getLanguage());
            return new GuestDelivery("whatsapp", () ->
                requireMessageId(provider.sendTemplateMessage(waConfig, guest.getPhone(),
                    NOISE_ALERT_TEMPLATE, language, parameters)));
        }
        if (guest.getEmail() == null || guest.getEmail().isBlank()) return null;
        var template = systemEmailTemplateService.resolve(
            alert.getOrganizationId(), "noise_alert_guest", "fr").orElse(null);
        if (template == null) return null;
        String guestName = guest.getFullName() != null ? guest.getFullName() : "Cher voyageur";
        Map<String, String> vars = Map.of("guestName", guestName, "propertyName", propertyName);
        String subject = templateInterpolationService.interpolate(template.getSubject(), vars, false);
        String body = templateInterpolationService.interpolate(template.getBody(), vars, true);
        String htmlBody = emailWrapperService.wrap(template.getWrapperStyle(), body);
        return new GuestDelivery("email", () ->
            emailService.sendContactMessage(
                guest.getEmail(), guestName, null, null, subject, htmlBody, List.of()));
    }

    private static void requireMessageId(String id) {
        if (id == null || id.isBlank()) throw new IllegalStateException("Envoi non confirme");
    }

    private boolean claimGuestWarningWindow(NoiseAlert alert, Reservation reservation) {
        if (alert.getId() == null || reservation.getId() == null) return false;
        try {
            return Boolean.TRUE.equals(redisTemplate.opsForValue().setIfAbsent(
                GUEST_WARNING_KEY_PREFIX + reservation.getId(), String.valueOf(alert.getId()), GUEST_WARNING_TTL));
        } catch (Exception unavailable) {
            log.warn("Baitly bruit : controle exclusif indisponible");
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
