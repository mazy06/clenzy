package com.clenzy.service;

import com.clenzy.dto.MaintenanceRequestDto;
import com.clenzy.dto.QuoteRequestDto;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Service d'envoi d'emails transactionnels.
 * Utilisé pour notifier l'équipe Clenzy des demandes de devis depuis la landing page.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${clenzy.mail.from:info@clenzy.fr}")
    private String fromAddress;

    private static final String NOTIFICATION_TO = "info@clenzy.fr";

    // Labels français pour les valeurs du formulaire
    private static final Map<String, String> PROPERTY_TYPE_LABELS = Map.of(
            "studio", "Studio",
            "appartement", "Appartement",
            "maison", "Maison",
            "duplex", "Duplex",
            "villa", "Villa",
            "autre", "Autre"
    );

    private static final Map<String, String> PROPERTY_COUNT_LABELS = Map.of(
            "1", "1 logement",
            "2", "2 logements",
            "3-5", "3 à 5 logements",
            "6+", "6 logements et plus"
    );

    private static final Map<String, String> FREQUENCY_LABELS = Map.of(
            "tres-frequent", "Très fréquent (plusieurs fois/semaine)",
            "regulier", "Régulier (hebdomadaire)",
            "occasionnel", "Occasionnel",
            "nouvelle-annonce", "Nouvelle annonce"
    );

    private static final Map<String, String> SCHEDULE_LABELS = Map.of(
            "apres-depart", "Après chaque départ",
            "hebdomadaire", "Hebdomadaire",
            "ponctuel", "Ponctuel",
            "indecis", "Indécis"
    );

    private static final Map<String, String> SERVICE_LABELS = Map.ofEntries(
            Map.entry("menage-complet", "Ménage complet"),
            Map.entry("linge", "Gestion du linge"),
            Map.entry("desinfection", "Désinfection"),
            Map.entry("reassort", "Réassort consommables"),
            Map.entry("poubelles", "Gestion des poubelles")
    );

    private static final Map<String, String> SERVICE_DEVIS_LABELS = Map.ofEntries(
            Map.entry("repassage", "Repassage du linge"),
            Map.entry("vitres", "Nettoyage des vitres"),
            Map.entry("blanchisserie", "Service de blanchisserie"),
            Map.entry("pressing", "Service de pressing"),
            Map.entry("plomberie", "Plomberie"),
            Map.entry("electricite", "Électricité"),
            Map.entry("serrurerie", "Serrurerie / clés"),
            Map.entry("bricolage", "Petit bricolage"),
            Map.entry("autre-maintenance", "Autre intervention technique")
    );

    private static final Map<String, String> CALENDAR_LABELS = Map.of(
            "sync", "Gestion automatique",
            "manuel", "Gestion en ligne",
            "non", "Me faire recontacter"
    );

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        if (this.mailSender == null) {
            log.warn("JavaMailSender non configure: l'envoi d'emails est desactive. Configurez spring.mail.host (ou spring.mail.jndi-name) pour l'activer.");
        }
    }

    private JavaMailSender requireMailSender() {
        if (mailSender == null) {
            throw new IllegalStateException("Envoi d'email non configure (JavaMailSender absent). Definissez spring.mail.host (ou spring.mail.jndi-name). ");
        }
        return mailSender;
    }

    /**
     * Envoie un email de notification pour une nouvelle demande de devis.
     */
    public void sendQuoteRequestNotification(QuoteRequestDto dto, String recommendedPackage, int recommendedRate) {
        try {
            JavaMailSender ms = requireMailSender();

            MimeMessage message = ms.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromAddress);
            helper.setTo(NOTIFICATION_TO);
            helper.setReplyTo(dto.getEmail());
            helper.setSubject("📋 Nouvelle demande de devis — " + dto.getFullName() + " — " + dto.getCity());
            helper.setText(buildHtmlBody(dto, recommendedPackage, recommendedRate), true);
            ms.send(message);
            log.info("Email de notification devis envoyé pour : {} ({})", dto.getFullName(), dto.getEmail());

        } catch (MessagingException e) {
            log.error("Erreur d'envoi email devis pour {} : {}", dto.getFullName(), e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email de notification", e);
        } catch (Exception e) {
            log.error("Erreur d'envoi email devis pour {} : {}", dto.getFullName(), e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email de notification", e);
        }
    }

    private String buildHtmlBody(QuoteRequestDto dto, String recommendedPackage, int recommendedRate) {
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>");
        sb.append("<div style='font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;'>");

        // Header
        sb.append("<div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;'>");
        sb.append("<h1 style='color: white; margin: 0; font-size: 22px;'>📋 Nouvelle demande de devis</h1>");
        sb.append("<p style='color: rgba(255,255,255,0.9); margin: 5px 0 0;'>Clenzy — Formulaire Landing Page</p>");
        sb.append("</div>");

        // Recommended package banner
        sb.append("<div style='background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px 20px;'>");
        sb.append("<strong style='color: #15803d;'>🎯 Forfait recommandé :</strong> ");
        sb.append("<span style='font-size: 18px; font-weight: bold; color: #15803d;'>").append(formatPackageName(recommendedPackage)).append("</span>");
        sb.append(" <span style='color: #666;'>(à partir de ").append(recommendedRate).append("€ par intervention)</span>");
        sb.append("</div>");

        // Section: Coordonnées
        sb.append(sectionStart("#f8fafc", "👤 Coordonnées"));
        sb.append("<table style='width: 100%; border-collapse: collapse;'>");
        addRow(sb, "Nom complet", dto.getFullName());
        addRow(sb, "Email", dto.getEmail());
        addRow(sb, "Téléphone", dto.getPhone() != null ? dto.getPhone() : "Non renseigné");
        addRow(sb, "Ville", dto.getCity());
        addRow(sb, "Code postal", dto.getPostalCode());
        sb.append("</table></div>");

        // Section: Bien immobilier
        sb.append(sectionStart("white", "🏠 Bien immobilier"));
        sb.append("<table style='width: 100%; border-collapse: collapse;'>");
        addRow(sb, "Type de bien", getLabel(PROPERTY_TYPE_LABELS, dto.getPropertyType()));
        addRow(sb, "Nombre de logements", getLabel(PROPERTY_COUNT_LABELS, dto.getPropertyCount()));
        addRow(sb, "Capacité voyageurs", dto.getGuestCapacity() != null ? dto.getGuestCapacity() + " personnes" : "Non renseigné");
        addRow(sb, "Surface", dto.getSurface() + " m²");
        sb.append("</table></div>");

        // Section: Réservation & Ménage
        sb.append(sectionStart("#f8fafc", "📅 Réservation & Ménage"));
        sb.append("<table style='width: 100%; border-collapse: collapse;'>");
        addRow(sb, "Fréquence de réservation", getLabel(FREQUENCY_LABELS, dto.getBookingFrequency()));
        addRow(sb, "Planning de ménage", getLabel(SCHEDULE_LABELS, dto.getCleaningSchedule()));
        addRow(sb, "Synchronisation calendrier", getLabel(CALENDAR_LABELS, dto.getCalendarSync()));
        sb.append("</table></div>");

        // Section: Services forfait
        sb.append(sectionStart("white", "🧹 Services forfait"));
        if (dto.getServices() != null && !dto.getServices().isEmpty()) {
            sb.append("<ul style='margin: 0; padding-left: 20px;'>");
            for (String service : dto.getServices()) {
                sb.append("<li style='padding: 4px 0;'>").append(getLabel(SERVICE_LABELS, service)).append("</li>");
            }
            sb.append("</ul>");
        } else {
            sb.append("<p style='color: #94a3b8; margin: 0;'>Aucun service sélectionné</p>");
        }
        sb.append("</div>");

        // Section: Services sur devis
        sb.append(sectionStart("#f8fafc", "📋 Services sur devis"));
        if (dto.getServicesDevis() != null && !dto.getServicesDevis().isEmpty()) {
            sb.append("<ul style='margin: 0; padding-left: 20px;'>");
            for (String service : dto.getServicesDevis()) {
                sb.append("<li style='padding: 4px 0;'>").append(getLabel(SERVICE_DEVIS_LABELS, service)).append("</li>");
            }
            sb.append("</ul>");
        } else {
            sb.append("<p style='color: #94a3b8; margin: 0;'>Aucun service complémentaire demandé</p>");
        }
        sb.append("</div>");

        // Footer
        sb.append("<div style='text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0;'>");
        sb.append("<p>Cet email a été généré automatiquement par le formulaire de devis Clenzy.</p>");
        sb.append("</div>");

        sb.append("</div></body></html>");
        return sb.toString();
    }

    private String sectionStart(String bgColor, String title) {
        return "<div style='background: " + bgColor + "; padding: 20px; border: 1px solid #e2e8f0;'>" +
                "<h2 style='color: #334155; margin-top: 0; font-size: 16px; border-bottom: 2px solid #667eea; padding-bottom: 8px;'>" + title + "</h2>";
    }

    private void addRow(StringBuilder sb, String label, String value) {
        sb.append("<tr>");
        sb.append("<td style='padding: 8px 12px; font-weight: bold; color: #475569; width: 40%; vertical-align: top;'>").append(label).append("</td>");
        sb.append("<td style='padding: 8px 12px; color: #1e293b;'>").append(value != null ? value : "Non renseigné").append("</td>");
        sb.append("</tr>");
    }

    private String getLabel(Map<String, String> labels, String key) {
        if (key == null) return "Non renseigné";
        return labels.getOrDefault(key, key);
    }

    private String formatPackageName(String packageId) {
        return switch (packageId) {
            case "premium" -> "Forfait Premium";
            case "confort" -> "Forfait Confort";
            case "essentiel" -> "Forfait Essentiel";
            default -> packageId;
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // Email de notification maintenance / travaux
    // ═══════════════════════════════════════════════════════════════

    private static final Map<String, String> WORK_LABELS = Map.ofEntries(
            // Plomberie
            Map.entry("fuite-eau", "Réparation fuite d'eau"),
            Map.entry("debouchage", "Débouchage canalisation"),
            Map.entry("robinetterie", "Remplacement robinetterie"),
            Map.entry("chasse-eau", "Réparation chasse d'eau / WC"),
            Map.entry("chauffe-eau", "Installation / réparation chauffe-eau"),
            Map.entry("raccordement", "Raccordement machine à laver / lave-vaisselle"),
            // Électricité
            Map.entry("prise-elec", "Installation / remplacement prise"),
            Map.entry("interrupteur", "Remplacement interrupteur"),
            Map.entry("eclairage", "Installation luminaire / plafonnier"),
            Map.entry("tableau-elec", "Vérification tableau électrique"),
            Map.entry("panne-elec", "Diagnostic panne électrique"),
            Map.entry("domotique", "Installation domotique / objets connectés"),
            // Serrurerie
            Map.entry("changement-serrure", "Changement de serrure"),
            Map.entry("double-cle", "Reproduction de clés"),
            Map.entry("boite-cles", "Installation boîte à clés sécurisée"),
            Map.entry("serrure-connectee", "Installation serrure connectée"),
            Map.entry("digicode", "Installation digicode / interphone"),
            // Bricolage
            Map.entry("montage-meuble", "Montage de meubles"),
            Map.entry("fixation-murale", "Fixations murales (étagères, TV, rideaux)"),
            Map.entry("porte-ajustement", "Ajustement / réparation porte"),
            Map.entry("joint-silicone", "Refaire des joints (silicone, carrelage)"),
            Map.entry("store-volet", "Réparation store / volet roulant"),
            // Travaux & rénovation
            Map.entry("peinture", "Peinture murs / plafonds"),
            Map.entry("carrelage", "Pose / réparation carrelage"),
            Map.entry("parquet", "Pose / réparation parquet"),
            Map.entry("salle-bain", "Rénovation salle de bain"),
            Map.entry("cuisine", "Aménagement cuisine"),
            Map.entry("cloison", "Création / suppression cloison"),
            // Extérieur & divers
            Map.entry("climatisation", "Installation / entretien climatisation"),
            Map.entry("desinsectisation", "Désinsectisation / dératisation"),
            Map.entry("balcon-terrasse", "Aménagement balcon / terrasse"),
            Map.entry("demenagement", "Aide au déménagement / livraison")
    );

    private static final Map<String, String> URGENCY_LABELS = Map.of(
            "urgent", "🔴 Urgent (sous 24-48h)",
            "normal", "🟠 Normal (sous 1 semaine)",
            "planifie", "🔵 Planifié (à programmer)"
    );

    /**
     * Envoie un email de notification pour une demande de devis maintenance.
     */
    public void sendMaintenanceNotification(MaintenanceRequestDto dto) {
        try {
            JavaMailSender ms = requireMailSender();

            MimeMessage message = ms.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromAddress);
            helper.setTo(NOTIFICATION_TO);
            helper.setReplyTo(dto.getEmail());

            String urgencyTag = "urgent".equals(dto.getUrgency()) ? "🔴 URGENT — " : "";
            helper.setSubject(urgencyTag + "🔧 Demande de devis maintenance — " + dto.getFullName()
                    + (dto.getCity() != null && !dto.getCity().isBlank() ? " — " + dto.getCity() : ""));

            helper.setText(buildMaintenanceHtmlBody(dto), true);
            ms.send(message);
            log.info("Email de notification maintenance envoyé pour : {} ({})", dto.getFullName(), dto.getEmail());

        } catch (MessagingException e) {
            log.error("Erreur d'envoi email maintenance pour {} : {}", dto.getFullName(), e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email de notification maintenance", e);
        } catch (Exception e) {
            log.error("Erreur d'envoi email maintenance pour {} : {}", dto.getFullName(), e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email de notification maintenance", e);
        }
    }

    private String buildMaintenanceHtmlBody(MaintenanceRequestDto dto) {
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>");
        sb.append("<div style='font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;'>");

        // Header
        sb.append("<div style='background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 10px 10px 0 0;'>");
        sb.append("<h1 style='color: white; margin: 0; font-size: 22px;'>🔧 Demande de devis maintenance</h1>");
        sb.append("<p style='color: rgba(255,255,255,0.9); margin: 5px 0 0;'>Clenzy — Formulaire Landing Page</p>");
        sb.append("</div>");

        // Urgency banner
        String urgencyLabel = URGENCY_LABELS.getOrDefault(dto.getUrgency(), "Normal");
        String urgencyBg = "urgent".equals(dto.getUrgency()) ? "#fef2f2" : "normal".equals(dto.getUrgency()) ? "#fff7ed" : "#eff6ff";
        String urgencyBorder = "urgent".equals(dto.getUrgency()) ? "#ef4444" : "normal".equals(dto.getUrgency()) ? "#f97316" : "#3b82f6";
        sb.append("<div style='background: ").append(urgencyBg).append("; border-left: 4px solid ").append(urgencyBorder).append("; padding: 15px 20px;'>");
        sb.append("<strong>Niveau d'urgence :</strong> ").append(urgencyLabel);
        sb.append("</div>");

        // Section: Coordonnées
        sb.append(sectionStart("#f8fafc", "👤 Coordonnées"));
        sb.append("<table style='width: 100%; border-collapse: collapse;'>");
        addRow(sb, "Nom complet", dto.getFullName());
        addRow(sb, "Email", dto.getEmail());
        addRow(sb, "Téléphone", dto.getPhone() != null && !dto.getPhone().isBlank() ? dto.getPhone() : "Non renseigné");
        addRow(sb, "Ville", dto.getCity() != null && !dto.getCity().isBlank() ? dto.getCity() : "Non renseigné");
        if (dto.getPostalCode() != null && !dto.getPostalCode().isBlank()) {
            addRow(sb, "Code postal", dto.getPostalCode());
        }
        sb.append("</table></div>");

        // Section: Travaux sélectionnés
        sb.append(sectionStart("white", "🔧 Travaux demandés"));
        if (dto.getSelectedWorks() != null && !dto.getSelectedWorks().isEmpty()) {
            sb.append("<ul style='margin: 0; padding-left: 20px;'>");
            for (String work : dto.getSelectedWorks()) {
                sb.append("<li style='padding: 4px 0;'>").append(WORK_LABELS.getOrDefault(work, work)).append("</li>");
            }
            sb.append("</ul>");
        } else {
            sb.append("<p style='color: #94a3b8; margin: 0;'>Aucun travail prédéfini sélectionné</p>");
        }

        // Besoin personnalisé
        if (dto.getCustomNeed() != null && !dto.getCustomNeed().isBlank()) {
            sb.append("<div style='margin-top: 15px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px;'>");
            sb.append("<strong style='color: #92400e;'>Besoin spécifique :</strong><br>");
            sb.append("<span style='color: #78350f;'>").append(dto.getCustomNeed()).append("</span>");
            sb.append("</div>");
        }
        sb.append("</div>");

        // Section: Description complémentaire
        if (dto.getDescription() != null && !dto.getDescription().isBlank()) {
            sb.append(sectionStart("#f8fafc", "📝 Description complémentaire"));
            sb.append("<p style='margin: 0; color: #1e293b; white-space: pre-wrap;'>").append(dto.getDescription()).append("</p>");
            sb.append("</div>");
        }

        // Footer
        sb.append("<div style='text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0;'>");
        sb.append("<p>Cet email a été généré automatiquement par le formulaire de devis maintenance Clenzy.</p>");
        sb.append("</div>");

        sb.append("</div></body></html>");
        return sb.toString();
    }
}
