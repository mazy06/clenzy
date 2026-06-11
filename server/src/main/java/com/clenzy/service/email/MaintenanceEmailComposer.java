package com.clenzy.service.email;

import com.clenzy.dto.MaintenanceRequestDto;
import com.clenzy.util.StringUtils;
import org.springframework.stereotype.Component;

import java.util.Map;

import static com.clenzy.service.email.EmailSectionHtml.addRow;
import static com.clenzy.service.email.EmailSectionHtml.sectionStart;

/**
 * Contenu metier des emails de demande de maintenance/travaux (landing page) :
 * catalogue des travaux, niveaux d'urgence et rendu HTML des sections dynamiques.
 *
 * <p>Extrait de {@code EmailService} (T-SOLID-9) — rendu strictement identique.</p>
 */
@Component
public class MaintenanceEmailComposer {

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
     * Banner d'urgence pre-rendu HTML pour le template
     * {@code maintenance_request_internal}. Couleur rouge/orange/bleu selon
     * urgency level. Injecte dans la variable speciale {@code {urgencyBanner}}.
     */
    public String renderUrgencyBanner(MaintenanceRequestDto dto) {
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
    public String renderMaintenanceDetailsHtml(MaintenanceRequestDto dto) {
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
}
