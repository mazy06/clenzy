package com.clenzy.service;

import com.clenzy.dto.MaintenanceRequestDto;
import com.clenzy.dto.QuoteRequestDto;
import com.clenzy.service.messaging.EmailWrapperService;
import com.clenzy.service.messaging.SystemEmailTemplateService;
import com.clenzy.service.messaging.TemplateInterpolationService;
import com.clenzy.util.AttachmentValidator;
import com.clenzy.util.StringUtils;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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

    /**
     * Display name affiche dans le From ({@code Clenzy <info@clenzy.fr>}).
     * Reduit le score spam : un nom humain inspire confiance, et l'alignement
     * DKIM + From-domain reste vrai puisque l'adresse ne change pas.
     */
    @Value("${clenzy.mail.from-name:Clenzy}")
    private String fromName;

    /** Mailto fallback pour List-Unsubscribe (legacy clients non one-click). */
    @Value("${clenzy.mail.unsubscribe-mailto:unsubscribe@clenzy.fr}")
    private String unsubscribeMailto;

    /** URL one-click pour List-Unsubscribe (RFC 8058 + Gmail/Outlook 2024). */
    @Value("${clenzy.mail.unsubscribe-url:https://app.clenzy.fr/unsubscribe}")
    private String unsubscribeUrl;

    @Value("${clenzy.mail.notification-to:info@clenzy.fr}")
    private String notificationTo;

    @Value("${clenzy.mail.contact.max-attachments:10}")
    private int maxAttachments;

    @Value("${clenzy.mail.contact.max-attachment-size-bytes:10485760}")
    private long maxAttachmentSizeBytes;

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

    private final SystemEmailTemplateService systemEmailTemplateService;
    private final TemplateInterpolationService templateInterpolationService;
    private final EmailWrapperService emailWrapperService;

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider,
                        SystemEmailTemplateService systemEmailTemplateService,
                        TemplateInterpolationService templateInterpolationService,
                        EmailWrapperService emailWrapperService) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.systemEmailTemplateService = systemEmailTemplateService;
        this.templateInterpolationService = templateInterpolationService;
        this.emailWrapperService = emailWrapperService;
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
     *
     * <p>Le subject et le wrapper HTML sont resolus depuis
     * {@code system_email_template} (cle {@code quote_request_internal}) avec
     * fallback systeme. Les sections dynamiques (coordonnees, services
     * selectionnes) sont pre-rendues en {@code {detailsHtml}} cote Java avant
     * l'interpolation finale, car elles contiennent des boucles non-templating.</p>
     */
    public void sendQuoteRequestNotification(QuoteRequestDto dto, String recommendedPackage, int recommendedRate) {
        sendQuoteRequestNotification(dto, recommendedPackage, recommendedRate, null);
    }

    /**
     * Variante avec piece jointe PDF du devis.
     *
     * @param pdfAttachment bytes du PDF devis (nullable). Si non-null et non-vide,
     *                      le PDF est joint a l'email interne envoye a info@clenzy.fr.
     */
    public void sendQuoteRequestNotification(QuoteRequestDto dto, String recommendedPackage,
                                              int recommendedRate, byte[] pdfAttachment) {
        try {
            JavaMailSender ms = requireMailSender();

            // Resolution du template depuis la BDD (systeme par defaut, pas de
            // tenant car notification interne equipe Baitly).
            var template = systemEmailTemplateService.resolve(null, "quote_request_internal", "fr")
                .orElseThrow(() -> new IllegalStateException(
                    "Template systeme quote_request_internal introuvable en BDD"));

            Map<String, String> vars = new HashMap<>();
            vars.put("fullName", nullToEmpty(dto.getFullName()));
            vars.put("city", nullToEmpty(dto.getCity()));
            vars.put("recommendedPackage", formatPackageName(recommendedPackage));
            vars.put("recommendedRate", String.valueOf(recommendedRate));
            // Variable speciale : sections dynamiques pre-rendues (boucles services etc).
            // HTML safe (listee dans HTML_SAFE_VARIABLES) → pas re-echappee a l'interpolation.
            vars.put("detailsHtml", renderQuoteDetailsHtml(dto));

            String subject = templateInterpolationService.interpolate(template.getSubject(), vars, false);
            // Interpolation du body plain text + wrapping HTML uniforme. Le
            // wrapper applique header/footer Baitly et convertit le markdown
            // leger (*gras*, _italique_, paragraphes) en HTML inline-styled.
            String interpolatedBody = templateInterpolationService.interpolate(template.getBody(), vars, true);
            String htmlBody = emailWrapperService.wrap(template.getWrapperStyle(), interpolatedBody);

            MimeMessage message = ms.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            applyDeliverabilityHeaders(message, helper);
            helper.setTo(notificationTo);
            helper.setReplyTo(dto.getEmail());
            helper.setSubject(sanitizeHeaderValue(subject));
            helper.setText(htmlToPlainText(htmlBody), htmlBody);

            // Joindre le PDF si disponible (genere depuis le template DEVIS).
            if (pdfAttachment != null && pdfAttachment.length > 0) {
                String safeName = StringUtils.sanitizeFileName(dto.getFullName());
                if (safeName == null || safeName.isBlank()) {
                    safeName = "prospect";
                }
                helper.addAttachment("Devis_Baitly_" + safeName + ".pdf",
                        new ByteArrayResource(pdfAttachment), "application/pdf");
            }

            ms.send(message);
            log.info("Email de notification devis envoyé pour : {} ({}) [PDF={}]",
                    dto.getFullName(), dto.getEmail(),
                    pdfAttachment != null && pdfAttachment.length > 0 ? "oui" : "non");

        } catch (MessagingException e) {
            log.error("Erreur d'envoi email devis pour {} : {}", dto.getFullName(), e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email de notification", e);
        } catch (Exception e) {
            log.error("Erreur d'envoi email devis pour {} : {}", dto.getFullName(), e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email de notification", e);
        }
    }

    /**
     * Pre-rend les sections dynamiques du template devis (coordonnees, bien,
     * services). Le rendu est injecte dans {@code {detailsHtml}} du template
     * editable. L'user voit cette variable comme "section non-editable
     * pre-generee" dans la sidebar de l'UI.
     */
    private String renderQuoteDetailsHtml(QuoteRequestDto dto) {
        StringBuilder sb = new StringBuilder();

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

        return sb.toString();
    }

    private static String nullToEmpty(String s) {
        return s != null ? s : "";
    }

    private String sectionStart(String bgColor, String title) {
        return "<div style='background: " + bgColor + "; padding: 20px; border: 1px solid #e2e8f0;'>" +
                "<h2 style='color: #334155; margin-top: 0; font-size: 16px; border-bottom: 2px solid #667eea; padding-bottom: 8px;'>" + title + "</h2>";
    }

    private void addRow(StringBuilder sb, String label, String value) {
        sb.append("<tr>");
        sb.append("<td style='padding: 8px 12px; font-weight: bold; color: #475569; width: 40%; vertical-align: top;'>").append(StringUtils.escapeHtml(label)).append("</td>");
        sb.append("<td style='padding: 8px 12px; color: #1e293b;'>").append(value != null ? StringUtils.escapeHtml(value) : "Non renseigné").append("</td>");
        sb.append("</tr>");
    }

    private String getLabel(Map<String, String> labels, String key) {
        if (key == null) return "Non renseigné";
        // Toujours echapper : si la cle ne matche pas, elle contient du user input brut
        return StringUtils.escapeHtml(labels.getOrDefault(key, key));
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
     *
     * <p>Subject + wrapper resolus depuis {@code system_email_template} (cle
     * {@code maintenance_request_internal}). Variables speciales pre-rendues :
     * {@code {urgencyBanner}} (couleur selon urgency level) et {@code {detailsHtml}}
     * (sections dynamiques travaux + description).</p>
     */
    public void sendMaintenanceNotification(MaintenanceRequestDto dto) {
        try {
            JavaMailSender ms = requireMailSender();

            var template = systemEmailTemplateService.resolve(null, "maintenance_request_internal", "fr")
                .orElseThrow(() -> new IllegalStateException(
                    "Template systeme maintenance_request_internal introuvable en BDD"));

            Map<String, String> vars = new HashMap<>();
            vars.put("fullName", nullToEmpty(dto.getFullName()));
            vars.put("city", dto.getCity() != null && !dto.getCity().isBlank() ? dto.getCity() : "");
            vars.put("urgencyTag", "urgent".equals(dto.getUrgency()) ? "🔴 URGENT — " : "");
            // Variables HTML-safe pre-rendues
            vars.put("urgencyBanner", renderUrgencyBanner(dto));
            vars.put("detailsHtml", renderMaintenanceDetailsHtml(dto));

            String subject = templateInterpolationService.interpolate(template.getSubject(), vars, false);
            String interpolatedBody = templateInterpolationService.interpolate(template.getBody(), vars, true);
            String htmlBody = emailWrapperService.wrap(template.getWrapperStyle(), interpolatedBody);

            MimeMessage message = ms.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            applyDeliverabilityHeaders(message, helper);
            helper.setTo(notificationTo);
            helper.setReplyTo(dto.getEmail());
            helper.setSubject(sanitizeHeaderValue(subject));
            helper.setText(htmlToPlainText(htmlBody), htmlBody);
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

    /**
     * Banner d'urgence pre-rendu HTML pour le template
     * {@code maintenance_request_internal}. Couleur rouge/orange/bleu selon
     * urgency level. Injecte dans la variable speciale {@code {urgencyBanner}}.
     */
    private String renderUrgencyBanner(MaintenanceRequestDto dto) {
        String urgencyLabel = URGENCY_LABELS.getOrDefault(dto.getUrgency(), "Normal");
        String urgencyBg = "urgent".equals(dto.getUrgency()) ? "#fef2f2"
            : "normal".equals(dto.getUrgency()) ? "#fff7ed" : "#eff6ff";
        String urgencyBorder = "urgent".equals(dto.getUrgency()) ? "#ef4444"
            : "normal".equals(dto.getUrgency()) ? "#f97316" : "#3b82f6";
        return "<div style='background: " + urgencyBg + "; border-left: 4px solid " + urgencyBorder
            + "; padding: 15px 20px;'>"
            + "<strong>Niveau d'urgence :</strong> " + StringUtils.escapeHtml(urgencyLabel)
            + "</div>";
    }

    /**
     * Sections dynamiques maintenance (coordonnees, travaux, besoin specifique,
     * description). Pre-rendu HTML injecte dans {@code {detailsHtml}}.
     */
    private String renderMaintenanceDetailsHtml(MaintenanceRequestDto dto) {
        StringBuilder sb = new StringBuilder();

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
                sb.append("<li style='padding: 4px 0;'>").append(StringUtils.escapeHtml(WORK_LABELS.getOrDefault(work, work))).append("</li>");
            }
            sb.append("</ul>");
        } else {
            sb.append("<p style='color: #94a3b8; margin: 0;'>Aucun travail prédéfini sélectionné</p>");
        }

        // Besoin personnalisé
        if (dto.getCustomNeed() != null && !dto.getCustomNeed().isBlank()) {
            sb.append("<div style='margin-top: 15px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px;'>");
            sb.append("<strong style='color: #92400e;'>Besoin spécifique :</strong><br>");
            sb.append("<span style='color: #78350f;'>").append(StringUtils.escapeHtml(dto.getCustomNeed())).append("</span>");
            sb.append("</div>");
        }
        sb.append("</div>");

        // Section: Description complémentaire
        if (dto.getDescription() != null && !dto.getDescription().isBlank()) {
            sb.append(sectionStart("#f8fafc", "📝 Description complémentaire"));
            sb.append("<p style='margin: 0; color: #1e293b; white-space: pre-wrap;'>").append(StringUtils.escapeHtml(dto.getDescription())).append("</p>");
            sb.append("</div>");
        }

        return sb.toString();
    }

    /**
     * Envoie un email depuis le module Contact (messages inbox/sent/reply).
     * Retourne l'identifiant de message fourni par le provider SMTP si disponible.
     */
    public String sendContactMessage(
            String toEmail,
            String toName,
            String replyToEmail,
            String replyToName,
            String subject,
            String messageText,
            List<MultipartFile> attachments
    ) {
        try {
            JavaMailSender ms = requireMailSender();
            MimeMessage mimeMessage = ms.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            String normalizedSubject = subject == null ? "" : subject.replaceAll("[\\r\\n]+", " ").trim();
            if (normalizedSubject.isBlank()) normalizedSubject = "(Sans objet)";
            if (normalizedSubject.length() > 255) normalizedSubject = normalizedSubject.substring(0, 255);

            String normalizedText = messageText == null ? "" : messageText.trim();
            if (normalizedText.isBlank()) {
                throw new IllegalArgumentException("Le message est vide");
            }

            applyDeliverabilityHeaders(mimeMessage, helper);
            helper.setTo(toEmail);
            if (replyToEmail != null && !replyToEmail.isBlank()) {
                helper.setReplyTo(replyToEmail);
            }
            helper.setSubject(normalizedSubject);
            helper.setText(normalizedText, buildContactHtmlBody(toName, replyToName, normalizedText));

            List<MultipartFile> safeAttachments = AttachmentValidator.sanitizeAndFilter(attachments);
            AttachmentValidator.validate(safeAttachments, maxAttachments, maxAttachmentSizeBytes);

            for (MultipartFile file : safeAttachments) {
                String fileName = StringUtils.sanitizeFileName(file.getOriginalFilename());
                String contentType = file.getContentType() != null && !file.getContentType().isBlank()
                        ? file.getContentType()
                        : "application/octet-stream";
                helper.addAttachment(fileName, new ByteArrayResource(file.getBytes()), contentType);
            }

            ms.send(mimeMessage);
            String providerMessageId = mimeMessage.getMessageID();
            if (providerMessageId == null || providerMessageId.isBlank()) {
                providerMessageId = "local-" + UUID.randomUUID();
            }

            log.info("Email contact envoye vers {} (subject={})", toEmail, normalizedSubject);
            return providerMessageId;
        } catch (Exception e) {
            log.error("Erreur envoi email contact vers {} : {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi email contact", e);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Email de document genere (PDF en piece jointe)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Envoie un email avec un document PDF en piece jointe.
     *
     * @param toEmail     Adresse email du destinataire
     * @param subject     Objet de l'email
     * @param htmlBody    Corps HTML de l'email
     * @param pdfFilename Nom du fichier PDF
     * @param pdfBytes    Contenu du PDF
     */
    public void sendDocumentEmail(String toEmail, String subject, String htmlBody,
                                   String pdfFilename, byte[] pdfBytes) {
        try {
            JavaMailSender ms = requireMailSender();
            MimeMessage message = ms.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            applyDeliverabilityHeaders(message, helper);
            helper.setTo(toEmail);
            helper.setSubject(sanitizeHeaderValue(subject));
            helper.setText(htmlToPlainText(htmlBody), htmlBody);

            // Ajouter le PDF en piece jointe
            helper.addAttachment(pdfFilename, new ByteArrayResource(pdfBytes), "application/pdf");

            ms.send(message);
            log.info("Document email sent to {} (attachment: {})", toEmail, pdfFilename);
        } catch (MessagingException e) {
            log.error("Failed to send document email to {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email avec document", e);
        } catch (Exception e) {
            log.error("Failed to send document email to {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email avec document", e);
        }
    }

    /**
     * Envoie le devis PDF au prospect avec un template email dedie et soigne
     * (system_email_template {@code quote_to_prospect}) enveloppe dans le wrapper
     * Baitly, plutot que le mail generique "Votre document".
     *
     * <p>Si le template n'est pas en BDD (cas d'un environnement ou la migration
     * 0165 n'a pas tourne), on retombe sur un corps par defaut propre wrappe en
     * NOTIFICATION_GUEST — jamais d'echec lie au template manquant.</p>
     *
     * @param toEmail     adresse du prospect
     * @param pdfBytes    bytes du PDF devis
     * @param pdfFilename nom du fichier joint
     */
    public void sendQuoteToProspect(String toEmail, byte[] pdfBytes, String pdfFilename) {
        try {
            JavaMailSender ms = requireMailSender();

            String subject;
            String htmlBody;
            var tpl = systemEmailTemplateService.resolve(null, "quote_to_prospect", "fr");
            if (tpl.isPresent()) {
                var t = tpl.get();
                Map<String, String> vars = new HashMap<>();
                subject = templateInterpolationService.interpolate(t.getSubject(), vars, false);
                String interpolatedBody = templateInterpolationService.interpolate(t.getBody(), vars, true);
                htmlBody = emailWrapperService.wrap(t.getWrapperStyle(), interpolatedBody);
            } else {
                subject = "Votre devis Baitly";
                htmlBody = emailWrapperService.wrap("NOTIFICATION_GUEST",
                        "Bonjour,\n\nNous avons le plaisir de vous transmettre votre devis "
                        + "personnalisé, que vous trouverez en pièce jointe au format PDF.\n\n"
                        + "Ce devis est sans engagement. Notre équipe reste à votre disposition "
                        + "pour toute question ou pour planifier une intervention.\n\n"
                        + "Au plaisir de collaborer avec vous,\nL'équipe Baitly");
            }

            MimeMessage message = ms.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            applyDeliverabilityHeaders(message, helper);
            helper.setTo(toEmail);
            helper.setSubject(sanitizeHeaderValue(subject));
            helper.setText(htmlToPlainText(htmlBody), htmlBody);
            helper.addAttachment(pdfFilename, new ByteArrayResource(pdfBytes), "application/pdf");

            ms.send(message);
            log.info("Email devis (prospect) envoyé à {} (PJ: {})", toEmail, pdfFilename);
        } catch (MessagingException e) {
            log.error("Échec envoi email devis prospect à {} : {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi du devis au prospect", e);
        } catch (Exception e) {
            log.error("Échec envoi email devis prospect à {} : {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi du devis au prospect", e);
        }
    }

    /**
     * Envoie un email HTML simple (sans piece jointe).
     * Utilise pour les liens de paiement, confirmations, etc.
     */
    public void sendSimpleHtmlEmail(String toEmail, String subject, String htmlBody) {
        try {
            JavaMailSender ms = requireMailSender();
            MimeMessage message = ms.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            applyDeliverabilityHeaders(message, helper);
            helper.setTo(toEmail);
            helper.setSubject(sanitizeHeaderValue(subject));
            helper.setText(htmlToPlainText(htmlBody), htmlBody);

            ms.send(message);
            log.info("Simple HTML email sent to {} (subject: {})", toEmail, subject);
        } catch (MessagingException e) {
            log.error("Failed to send simple HTML email to {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email", e);
        } catch (Exception e) {
            log.error("Failed to send simple HTML email to {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email", e);
        }
    }

    /**
     * Sanitise une valeur destinee a un header email pour prevenir l'injection de headers.
     * Supprime les caracteres CR/LF qui permettraient d'injecter des headers supplementaires.
     */
    private String sanitizeHeaderValue(String value) {
        if (value == null) return "";
        return value.replaceAll("[\\r\\n]+", " ").trim();
    }

    /**
     * Convertit un HTML email en plain text minimal pour le multipart/alternative.
     *
     * <p>Bookmarklets / clients basiques : le plain text version est crucial. SpamAssassin
     * penalise les emails {@code MIME_HTML_ONLY} (-0.1) car le pattern "HTML pur sans
     * fallback" est typique des emails de masse mal construits.</p>
     *
     * <p>Implementation deliberement simple : on extrait le texte des balises block,
     * on remplace les separateurs HTML par des newlines, on decode les entites les
     * plus courantes. Pas de parser HTML complet — pour les emails Clenzy,
     * c'est suffisant car les templates sont controles (pas d'input user brut).</p>
     */
    String htmlToPlainText(String html) {
        if (html == null || html.isBlank()) return "";
        String text = html;
        // Newline avant chaque balise block (paragraphes, divs, etc.)
        text = text.replaceAll("(?i)<\\s*(br|p|div|tr|li|h[1-6])\\s*[^>]*>", "\n");
        // Newline apres les balises fermantes de block
        text = text.replaceAll("(?i)</(p|div|tr|li|h[1-6])\\s*>", "\n");
        // Liens : on garde le texte + l'URL entre parentheses
        text = text.replaceAll("(?i)<a\\s+[^>]*href\\s*=\\s*\"([^\"]+)\"[^>]*>([^<]+)</a>", "$2 ($1)");
        // Supprime toutes les autres balises
        text = text.replaceAll("<[^>]+>", "");
        // Decode les entites HTML les plus courantes
        text = text.replace("&nbsp;", " ")
                   .replace("&amp;", "&")
                   .replace("&lt;", "<")
                   .replace("&gt;", ">")
                   .replace("&quot;", "\"")
                   .replace("&#39;", "'")
                   .replace("&apos;", "'")
                   .replace("&eacute;", "e")
                   .replace("&egrave;", "e")
                   .replace("&agrave;", "a")
                   .replace("&ecirc;", "e")
                   .replace("&ccedil;", "c");
        // Nettoyer : ecraser les newlines multiples, trim chaque ligne
        text = text.replaceAll("[ \\t]+", " ")
                   .replaceAll("\\n[ \\t]+", "\n")
                   .replaceAll("\\n{3,}", "\n\n")
                   .trim();
        return text;
    }

    /**
     * Applique les headers + From recommandes pour maximiser le scoring deliverability
     * (Gmail/Outlook 2024) :
     *
     * <ul>
     *   <li><b>From "Clenzy &lt;info@clenzy.fr&gt;"</b> : display name + adresse alignee
     *       avec le domaine DKIM. Un nom humain reduit le score spam.</li>
     *   <li><b>List-Unsubscribe</b> (RFC 8058) : URL one-click + mailto fallback. Gmail
     *       et Outlook penalisent les emails qui n'en ont pas — meme transactionnels —
     *       depuis fevrier 2024.</li>
     *   <li><b>List-Unsubscribe-Post: List-Unsubscribe=One-Click</b> : permet au client
     *       de desabonner sans confirmation manuelle.</li>
     *   <li><b>Auto-Submitted: auto-generated</b> (RFC 3834) : indique que c'est un
     *       email automatique pour distinguer des envois personnels et eviter les
     *       boucles d'auto-reply.</li>
     *   <li><b>X-Auto-Response-Suppress: All</b> : demande aux MTA Microsoft de ne pas
     *       generer d'auto-reply (out-of-office) — inutile cote nous.</li>
     * </ul>
     *
     * <p>A appeler dans chaque methode d'envoi a la place de
     * {@code helper.setFrom(fromAddress)}.</p>
     */
    private void applyDeliverabilityHeaders(MimeMessage message, MimeMessageHelper helper) {
        try {
            // From avec display name : "Clenzy <info@clenzy.fr>"
            helper.setFrom(fromAddress, fromName);
        } catch (java.io.UnsupportedEncodingException e) {
            // Fallback : juste l'adresse, sans display name
            try {
                helper.setFrom(fromAddress);
            } catch (MessagingException me) {
                log.warn("Impossible de setter From {}: {}", fromAddress, me.getMessage());
            }
        } catch (MessagingException e) {
            log.warn("Impossible de setter From {}: {}", fromAddress, e.getMessage());
        }
        try {
            String listUnsubscribe = "<mailto:" + unsubscribeMailto + ">, <" + unsubscribeUrl + ">";
            message.setHeader("List-Unsubscribe", listUnsubscribe);
            message.setHeader("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
            message.setHeader("Auto-Submitted", "auto-generated");
            message.setHeader("X-Auto-Response-Suppress", "All");
            // Brevo SMTP-specifique : desactive le pixel de tracking + click tracking
            // injecte automatiquement (image 1x1 sans alt, penalise par SpamAssassin
            // a -0.5). Le header reconnu par le relais Brevo est `X-Mailin-Track`
            // avec une valeur 0-3 : 0=off, 1=opens, 2=clicks, 3=opens+clicks.
            // (Les noms `X-Mailin-Track-Opens` / `X-Mailin-Track-Clicks` ne sont pas
            // documentes, donc inutiles — testes precedemment sans effet.)
            message.setHeader("X-Mailin-Track", "0");
        } catch (MessagingException e) {
            log.warn("Impossible d'ajouter les headers deliverability: {}", e.getMessage());
        }
    }

    /**
     * Envoie un email d'invitation a rejoindre une organisation.
     */
    /**
     * Envoie un email d'invitation a rejoindre une organisation.
     *
     * <p>Subject + body resolus depuis {@code system_email_template} (cle
     * {@code invitation_organization}). Variables : {@code {orgName}},
     * {@code {inviterName}}, {@code {roleName}}, {@code {invitationLink}},
     * {@code {expiresAt}}.</p>
     */
    public void sendInvitationEmail(String toEmail, String orgName, String inviterName,
                                      String roleName, String invitationLink, LocalDateTime expiresAt) {
        try {
            JavaMailSender ms = requireMailSender();

            var template = systemEmailTemplateService.resolve(null, "invitation_organization", "fr")
                .orElseThrow(() -> new IllegalStateException(
                    "Template systeme invitation_organization introuvable en BDD"));

            String expiresStr = expiresAt != null
                    ? expiresAt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy a HH:mm"))
                    : "7 jours";

            Map<String, String> vars = Map.of(
                "orgName", nullToEmpty(orgName),
                "inviterName", nullToEmpty(inviterName),
                "roleName", formatRoleName(roleName),
                "invitationLink", nullToEmpty(invitationLink),
                "expiresAt", expiresStr
            );

            String subject = templateInterpolationService.interpolate(template.getSubject(), vars, false);
            String interpolatedBody = templateInterpolationService.interpolate(template.getBody(), vars, true);
            String htmlBody = emailWrapperService.wrap(template.getWrapperStyle(), interpolatedBody);

            MimeMessage message = ms.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            applyDeliverabilityHeaders(message, helper);
            helper.setTo(toEmail);
            helper.setSubject(sanitizeHeaderValue(subject));
            helper.setText(htmlToPlainText(htmlBody), htmlBody);
            ms.send(message);
            log.info("Email d'invitation envoye a {} pour l'organisation {}", toEmail, orgName);
        } catch (MessagingException e) {
            log.error("Erreur d'envoi email d'invitation a {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email d'invitation", e);
        } catch (Exception e) {
            log.error("Erreur d'envoi email d'invitation a {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email d'invitation", e);
        }
    }

    private String formatRoleName(String role) {
        if (role == null) return "Membre";
        return switch (role.toUpperCase()) {
            case "OWNER" -> "Proprietaire";
            case "SUPER_ADMIN" -> "Super Administrateur";
            case "SUPER_MANAGER" -> "Super Manager";
            case "SUPERVISOR" -> "Superviseur";
            case "TECHNICIAN" -> "Technicien";
            case "HOUSEKEEPER" -> "Agent de menage";
            case "LAUNDRY" -> "Blanchisserie";
            case "EXTERIOR_TECH" -> "Tech. Exterieur";
            case "HOST" -> "Proprietaire";
            case "MEMBER" -> "Membre";
            default -> role;
        };
    }

    /**
     * Envoie un email de bienvenue au nouvel utilisateur avec ses identifiants de connexion.
     */
    public void sendWelcomeEmail(String toEmail, String firstName, String lastName,
                                  String roleName, String loginUrl) {
        try {
            JavaMailSender ms = requireMailSender();
            MimeMessage message = ms.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            applyDeliverabilityHeaders(message, helper);
            helper.setTo(toEmail);
            helper.setSubject(sanitizeHeaderValue("Bienvenue sur Clenzy — Votre compte a ete cree"));
            String welcomeHtml = buildWelcomeHtml(firstName, lastName, toEmail, roleName, loginUrl);
            helper.setText(htmlToPlainText(welcomeHtml), welcomeHtml);
            ms.send(message);
            log.info("Email de bienvenue envoye a {}", toEmail);
        } catch (Exception e) {
            log.error("Erreur d'envoi email de bienvenue a {}: {}", toEmail, e.getMessage(), e);
            // Ne pas propager — la creation de l'utilisateur ne doit pas echouer si l'email echoue
        }
    }

    private String buildWelcomeHtml(String firstName, String lastName, String email,
                                     String roleName, String loginUrl) {
        String safeName = StringUtils.escapeHtml(firstName);
        String safeFullName = StringUtils.escapeHtml(firstName + " " + lastName);
        String safeEmail = StringUtils.escapeHtml(email);
        String safeRole = StringUtils.escapeHtml(roleName != null ? formatRoleName(roleName) : "Utilisateur");
        String safeUrl = StringUtils.escapeHtml(loginUrl);

        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>"
                + "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>"
                // Header
                + "<div style='background:linear-gradient(135deg,#A6C0CE 0%,#6B8A9A 100%);padding:30px;border-radius:10px 10px 0 0;text-align:center;'>"
                + "<h1 style='color:white;margin:0;font-size:24px;'>Bienvenue sur Clenzy !</h1>"
                + "<p style='color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;'>Votre compte a ete cree avec succes</p>"
                + "</div>"
                // Body
                + "<div style='background:#ffffff;padding:30px;border:1px solid #e2e8f0;'>"
                + "<p style='font-size:16px;color:#334155;'>Bonjour " + safeName + ",</p>"
                + "<p style='font-size:15px;color:#475569;'>Votre compte Clenzy a ete cree. "
                + "Voici vos informations de connexion :</p>"
                // Info box
                + "<div style='background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;margin:20px 0;'>"
                + "<table style='width:100%;border-collapse:collapse;'>"
                + "<tr><td style='padding:6px 0;font-weight:bold;color:#475569;width:35%;'>Nom</td>"
                + "<td style='padding:6px 0;color:#1e293b;'>" + safeFullName + "</td></tr>"
                + "<tr><td style='padding:6px 0;font-weight:bold;color:#475569;'>Email</td>"
                + "<td style='padding:6px 0;color:#1e293b;'>" + safeEmail + "</td></tr>"
                + "<tr><td style='padding:6px 0;font-weight:bold;color:#475569;'>Role</td>"
                + "<td style='padding:6px 0;color:#1e293b;'>" + safeRole + "</td></tr>"
                + "</table>"
                + "</div>"
                + "<p style='font-size:14px;color:#64748b;'>Votre mot de passe vous a ete communique par votre administrateur. "
                + "Vous pouvez le modifier a tout moment depuis votre profil.</p>"
                // CTA Button
                + "<div style='text-align:center;margin:30px 0;'>"
                + "<a href='" + safeUrl + "' style='display:inline-block;padding:14px 32px;"
                + "background:linear-gradient(135deg,#A6C0CE 0%,#6B8A9A 100%);color:white;"
                + "text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;'>"
                + "Se connecter a Clenzy</a>"
                + "</div>"
                + "</div>"
                // Footer
                + "<div style='background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;text-align:center;'>"
                + "<p style='margin:0;color:#94a3b8;font-size:12px;'>Cet email a ete envoye automatiquement. Si vous n'etes pas a l'origine de cette demande, contactez votre administrateur.</p>"
                + "</div>"
                + "</div></body></html>";
    }

    /**
     * Envoie un email de confirmation d'inscription avec un lien pour creer le mot de passe.
     */
    public void sendInscriptionConfirmationEmail(String toEmail, String fullName, String confirmationLink, LocalDateTime expiresAt) {
        try {
            JavaMailSender ms = requireMailSender();
            MimeMessage message = ms.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            applyDeliverabilityHeaders(message, helper);
            helper.setTo(toEmail);
            helper.setSubject(sanitizeHeaderValue("Confirmez votre inscription Clenzy"));
            String confirmationHtml = buildInscriptionConfirmationHtml(fullName, confirmationLink, expiresAt);
            helper.setText(htmlToPlainText(confirmationHtml), confirmationHtml);
            ms.send(message);
            log.info("Email de confirmation d'inscription envoye a {}", toEmail);
        } catch (MessagingException e) {
            log.error("Erreur d'envoi email de confirmation a {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email de confirmation", e);
        } catch (Exception e) {
            log.error("Erreur d'envoi email de confirmation a {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur d'envoi de l'email de confirmation", e);
        }
    }

    private String buildInscriptionConfirmationHtml(String fullName, String confirmationLink, LocalDateTime expiresAt) {
        String safeName = StringUtils.escapeHtml(fullName);
        String safeLink = StringUtils.escapeHtml(confirmationLink);
        String expiresStr = expiresAt != null
                ? expiresAt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy a HH:mm"))
                : "72 heures";

        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>"
                + "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>"
                // Header — couleurs Clenzy
                + "<div style='background:linear-gradient(135deg,#A6C0CE 0%,#6B8A9A 100%);padding:30px;border-radius:10px 10px 0 0;text-align:center;'>"
                + "<h1 style='color:white;margin:0;font-size:24px;'>Bienvenue sur Clenzy !</h1>"
                + "</div>"
                // Body
                + "<div style='background:#ffffff;padding:30px;border:1px solid #e2e8f0;'>"
                + "<p style='font-size:16px;color:#334155;'>Bonjour " + safeName + ",</p>"
                + "<p style='font-size:15px;color:#475569;'>Votre paiement a ete confirme avec succes. "
                + "Pour finaliser votre inscription, cliquez sur le bouton ci-dessous afin de confirmer votre adresse email "
                + "et creer votre mot de passe.</p>"
                // CTA Button — gradient Clenzy
                + "<div style='text-align:center;margin:30px 0;'>"
                + "<a href='" + safeLink + "' style='display:inline-block;padding:14px 32px;"
                + "background:linear-gradient(135deg,#A6C0CE 0%,#6B8A9A 100%);color:white;"
                + "text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;'>"
                + "Creer mon mot de passe</a>"
                + "</div>"
                + "<p style='font-size:13px;color:#94a3b8;'>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>"
                + "<p style='font-size:12px;color:#6B8A9A;word-break:break-all;'>" + safeLink + "</p>"
                + "</div>"
                // Footer
                + "<div style='background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;text-align:center;'>"
                + "<p style='margin:0;color:#94a3b8;font-size:12px;'>Ce lien expire le " + StringUtils.escapeHtml(expiresStr) + ".</p>"
                + "<p style='margin:5px 0 0;color:#94a3b8;font-size:12px;'>Si vous n'avez pas demande cette inscription, vous pouvez ignorer ce message.</p>"
                + "</div>"
                + "</div></body></html>";
    }

    private String buildContactHtmlBody(String toName, String replyToName, String messageText) {
        String safeToName = StringUtils.firstNonBlank(toName, "destinataire");
        String safeReplyToName = StringUtils.firstNonBlank(replyToName, "expediteur");
        String escapedMessage = StringUtils.escapeHtml(messageText).replace("\n", "<br>");

        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>"
                + "<div style='font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#1e293b;'>"
                + "<h2 style='margin:0 0 16px 0;color:#0f172a;'>Nouveau message Clenzy</h2>"
                + "<p style='margin:0 0 12px 0;'>Bonjour " + StringUtils.escapeHtml(safeToName) + ",</p>"
                + "<div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;'>"
                + escapedMessage
                + "</div>"
                + "<p style='margin:0;color:#64748b;font-size:13px;'>Ce message vous a ete envoye par "
                + StringUtils.escapeHtml(safeReplyToName)
                + " via le module Contact Clenzy.</p>"
                + "</div></body></html>";
    }

}
