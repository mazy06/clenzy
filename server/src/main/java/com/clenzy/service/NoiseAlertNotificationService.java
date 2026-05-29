package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.messaging.EmailWrapperService;
import com.clenzy.service.messaging.SystemEmailTemplateService;
import com.clenzy.service.messaging.TemplateInterpolationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

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

    private final NotificationService notificationService;
    private final EmailService emailService;
    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final SystemEmailTemplateService systemEmailTemplateService;
    private final TemplateInterpolationService templateInterpolationService;
    private final EmailWrapperService emailWrapperService;

    public NoiseAlertNotificationService(NotificationService notificationService,
                                          EmailService emailService,
                                          PropertyRepository propertyRepository,
                                          ReservationRepository reservationRepository,
                                          SystemEmailTemplateService systemEmailTemplateService,
                                          TemplateInterpolationService templateInterpolationService,
                                          EmailWrapperService emailWrapperService) {
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.systemEmailTemplateService = systemEmailTemplateService;
        this.templateInterpolationService = templateInterpolationService;
        this.emailWrapperService = emailWrapperService;
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

        // 3. Message au voyageur (si reservation active)
        if (config.isNotifyGuestMessage()) {
            dispatchGuestMessage(alert, config, property, propertyName);
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
                notificationService.send(
                    property.getOwner().getKeycloakId(), key, title, message, null);
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

    // ─── Guest message ─────────────────────────────────────────────────────────

    private void dispatchGuestMessage(NoiseAlert alert, NoiseAlertConfig config,
                                       Property property, String propertyName) {
        try {
            Reservation reservation = reservationRepository
                .findActiveByPropertyIdAndDate(
                    alert.getPropertyId(), LocalDate.now(), alert.getOrganizationId())
                .orElse(null);

            if (reservation == null) {
                log.debug("Pas de reservation active pour property {} — pas de message voyageur",
                    alert.getPropertyId());
                return;
            }

            Guest guest = reservation.getGuest();
            if (guest == null || guest.getEmail() == null || guest.getEmail().isBlank()) {
                log.debug("Pas d'email voyageur pour reservation {} — message impossible",
                    reservation.getId());
                return;
            }

            // Resolution du template noise_alert_guest depuis system_email_template
            // (override per-org > systeme).
            var template = systemEmailTemplateService.resolve(
                alert.getOrganizationId(), "noise_alert_guest", "fr").orElse(null);
            if (template == null) {
                log.warn("Template systeme noise_alert_guest introuvable — alerte {} non envoyee", alert.getId());
                return;
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
            alert.setNotifiedGuest(true);

            log.info("Message voyageur envoye a {} pour alerte {} (reservation {})",
                guest.getEmail(), alert.getId(), reservation.getId());
        } catch (Exception e) {
            log.error("Erreur message voyageur pour alerte {}: {}", alert.getId(), e.getMessage());
        }
    }

}
