package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

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

    public NoiseAlertNotificationService(NotificationService notificationService,
                                          EmailService emailService,
                                          PropertyRepository propertyRepository,
                                          ReservationRepository reservationRepository) {
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
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

            String severityLabel = alert.getSeverity() == NoiseAlert.AlertSeverity.CRITICAL
                ? "CRITIQUE" : "AVERTISSEMENT";
            String subject = String.format("[Clenzy] Alerte bruit %s — %s", severityLabel, propertyName);
            String htmlBody = buildAlertEmailHtml(alert, propertyName, severityLabel);

            for (String recipient : recipients) {
                emailService.sendContactMessage(
                    recipient, null, null, null, subject, htmlBody, List.of());
            }
            alert.setNotifiedEmail(true);
        } catch (Exception e) {
            log.error("Erreur notification email pour alerte {}: {}", alert.getId(), e.getMessage());
        }
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

    private String buildAlertEmailHtml(NoiseAlert alert, String propertyName, String severityLabel) {
        String color = alert.getSeverity() == NoiseAlert.AlertSeverity.CRITICAL ? "#D32F2F" : "#ED6C02";
        return String.format("""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <div style="background:%s;color:white;padding:16px;border-radius:8px 8px 0 0">
                <h2 style="margin:0">Alerte bruit %s</h2>
              </div>
              <div style="padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
                <p><strong>Logement :</strong> %s</p>
                <p><strong>Niveau mesure :</strong> %.0f dB</p>
                <p><strong>Seuil depasse :</strong> %d dB</p>
                <p><strong>Creneau :</strong> %s</p>
                <p><strong>Heure :</strong> %s</p>
                <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
                <p style="color:#666;font-size:12px">
                  Cette alerte a ete generee automatiquement par Clenzy.
                  Vous pouvez configurer vos alertes depuis le tableau de bord.
                </p>
              </div>
            </div>
            """,
            StringUtils.escapeHtml(color),
            StringUtils.escapeHtml(severityLabel),
            StringUtils.escapeHtml(propertyName),
            alert.getMeasuredDb(),
            alert.getThresholdDb(),
            StringUtils.escapeHtml(alert.getTimeWindowLabel() != null ? alert.getTimeWindowLabel() : "—"),
            alert.getCreatedAt() != null ? alert.getCreatedAt().format(TIME_FMT) : "—"
        );
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

            String subject = "Information importante concernant le bruit — " + propertyName;
            String guestName = guest.getFullName() != null ? guest.getFullName() : "Cher voyageur";
            String htmlBody = buildGuestMessageHtml(alert, propertyName, guestName);

            emailService.sendContactMessage(
                guest.getEmail(), guestName, null, null, subject, htmlBody, List.of());
            alert.setNotifiedGuest(true);

            log.info("Message voyageur envoye a {} pour alerte {} (reservation {})",
                guest.getEmail(), alert.getId(), reservation.getId());
        } catch (Exception e) {
            log.error("Erreur message voyageur pour alerte {}: {}", alert.getId(), e.getMessage());
        }
    }

    private String buildGuestMessageHtml(NoiseAlert alert, String propertyName, String guestName) {
        return String.format("""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#6B8A9A;color:white;padding:16px;border-radius:8px 8px 0 0">
                <h2 style="margin:0">Information importante</h2>
              </div>
              <div style="padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
                <p>Bonjour %s,</p>
                <p>Nous avons detecte un niveau sonore eleve dans votre logement <strong>%s</strong>.</p>
                <p>Nous vous rappelons que le reglement interieur du logement prevoit le respect
                   du voisinage, en particulier pendant les heures de repos.</p>
                <p>Merci de bien vouloir veiller a reduire le niveau sonore.</p>
                <p>Cordialement,<br>L'equipe de gestion</p>
              </div>
            </div>
            """,
            StringUtils.escapeHtml(guestName),
            StringUtils.escapeHtml(propertyName)
        );
    }
}
