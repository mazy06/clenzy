package com.clenzy.service.email;

import com.clenzy.model.Intervention;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.User;
import com.clenzy.service.EmailService;
import com.clenzy.service.NotificationPreferenceService;
import com.clenzy.service.messaging.EmailWrapperService;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

/**
 * Email « mission assignée » au housekeeper/technicien (Moteur Ménage 2B — P5).
 *
 * <p>Déclenché à l'assignation d'une intervention à un USER (même point que la
 * notification {@link NotificationKey#INTERVENTION_ASSIGNED_TO_USER}), envoyé
 * POST-COMMIT par l'appelant. Pas d'email pour l'assignation à une équipe (v1).</p>
 *
 * <p>Respecte la préférence de notification : si le pro a désactivé
 * INTERVENTION_ASSIGNED_TO_USER, l'email n'est pas envoyé non plus — un canal
 * coupé par l'utilisateur coupe TOUTE la clé (in-app, push, email), choix assumé
 * tant qu'il n'existe pas de préférence par canal (P7 différé).</p>
 *
 * <p>Sécurité : PAS de codes d'accès dans l'email (adresse du logement uniquement) ;
 * tout input user passe par {@link StringUtils#escapeHtml}.</p>
 */
@Component
public class MissionAssignmentEmailComposer {

    private static final Logger log = LoggerFactory.getLogger(MissionAssignmentEmailComposer.class);

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH'h'mm");

    private final EmailService emailService;
    private final EmailWrapperService emailWrapperService;
    private final NotificationPreferenceService preferenceService;

    @Value("${clenzy.app.url:https://app.clenzy.fr}")
    private String appBaseUrl;

    public MissionAssignmentEmailComposer(EmailService emailService,
                                          EmailWrapperService emailWrapperService,
                                          NotificationPreferenceService preferenceService) {
        this.emailService = emailService;
        this.emailWrapperService = emailWrapperService;
        this.preferenceService = preferenceService;
    }

    /**
     * Compose et envoie l'email « mission assignée » au pro. Best-effort : toute
     * erreur est loggée, jamais propagée (appelé post-commit, hors chemin métier).
     */
    public void sendMissionAssignedEmail(Intervention intervention, User assignee) {
        try {
            if (assignee == null || assignee.getEmail() == null || assignee.getEmail().isBlank()) {
                log.debug("Pas d'email pour l'assigné de l'intervention {}", intervention.getId());
                return;
            }
            // Préférence utilisateur : la clé coupée coupe aussi l'email (cf. Javadoc classe).
            if (assignee.getKeycloakId() != null
                    && !preferenceService.isEnabled(assignee.getKeycloakId(), NotificationKey.INTERVENTION_ASSIGNED_TO_USER)) {
                log.debug("Email mission assignée désactivé par préférence pour {}", assignee.getKeycloakId());
                return;
            }

            String subject = "Nouvelle mission assignée — " + safe(intervention.getTitle());
            String html = emailWrapperService.wrap("INTERNAL_FORM", buildBody(intervention));
            emailService.sendSimpleHtmlEmail(assignee.getEmail(), subject, html);
            log.info("Email mission assignée envoyé à {} pour l'intervention {}",
                    assignee.getEmail(), intervention.getId());
        } catch (Exception e) {
            log.warn("Email mission assignée non envoyé pour l'intervention {} : {}",
                    intervention.getId(), e.getMessage());
        }
    }

    private String buildBody(Intervention intervention) {
        StringBuilder sb = new StringBuilder();
        sb.append("<h2 style='color: #334155; font-size: 16px;'>Vous avez une nouvelle mission</h2>");
        sb.append("<table style='width: 100%; border-collapse: collapse;'>");

        EmailSectionHtml.addRow(sb, "Mission", intervention.getTitle());
        EmailSectionHtml.addRow(sb, "Type", intervention.getType());
        if (intervention.getScheduledDate() != null) {
            EmailSectionHtml.addRow(sb, "Planifiée le", intervention.getScheduledDate().format(DATE_TIME));
        }
        if (intervention.getEstimatedDurationHours() != null) {
            EmailSectionHtml.addRow(sb, "Durée normée", intervention.getEstimatedDurationHours() + " h");
        }
        if (intervention.getProperty() != null) {
            EmailSectionHtml.addRow(sb, "Logement", intervention.getProperty().getName());
            // Adresse OK ; PAS de codes d'accès dans un email (sécurité).
            String address = intervention.getProperty().getAddress();
            String city = intervention.getProperty().getCity();
            if (address != null || city != null) {
                EmailSectionHtml.addRow(sb, "Adresse",
                        (address != null ? address : "") + (city != null ? ", " + city : ""));
            }
        }
        if (intervention.getEstimatedCost() != null) {
            EmailSectionHtml.addRow(sb, "Votre rémunération",
                    intervention.getEstimatedCost().stripTrailingZeros().toPlainString() + " €"
                            + scaleMention(intervention));
        }
        sb.append("</table>");

        String link = appBaseUrl + "/interventions/" + intervention.getId();
        sb.append("<p style='margin-top: 20px;'>")
          .append("<a href='").append(link).append("' ")
          .append("style='background: #6B8A9A; color: #F7F9FA; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-weight: bold;'>")
          .append("Voir la mission")
          .append("</a></p>");
        return sb.toString();
    }

    /**
     * Mention discrète du barème conseil si écart (réutilise la logique du badge web :
     * conforme si |écart| ≤ 5 €, sinon ±Y %). Vide si pas de snapshot conseil.
     */
    private String scaleMention(Intervention intervention) {
        BigDecimal recommended = intervention.getRecommendedCost();
        BigDecimal estimated = intervention.getEstimatedCost();
        if (recommended == null || estimated == null || recommended.compareTo(BigDecimal.ZERO) <= 0) {
            return "";
        }
        BigDecimal delta = estimated.subtract(recommended);
        if (delta.abs().compareTo(BigDecimal.valueOf(5)) <= 0) {
            return " (conforme au barème conseillé)";
        }
        long pct = Math.round(delta.doubleValue() / recommended.doubleValue() * 100);
        return " (" + (pct > 0 ? "+" : "") + pct + " % vs barème conseillé de "
                + recommended.stripTrailingZeros().toPlainString() + " €)";
    }

    private static String safe(String value) {
        return value != null ? value : "";
    }
}
