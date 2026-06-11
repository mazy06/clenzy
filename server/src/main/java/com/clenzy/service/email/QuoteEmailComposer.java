package com.clenzy.service.email;

import com.clenzy.dto.QuoteRequestDto;
import com.clenzy.util.StringUtils;
import org.springframework.stereotype.Component;

import java.util.Map;

import static com.clenzy.service.email.EmailSectionHtml.addRow;
import static com.clenzy.service.email.EmailSectionHtml.sectionStart;

/**
 * Contenu metier des emails de demande de devis (landing page) : libelles
 * commerciaux des formulaires et rendu HTML des sections dynamiques.
 *
 * <p>Extrait de {@code EmailService} (T-SOLID-9) — rendu strictement
 * identique. La couche transport (MIME, From, deliverability) reste dans
 * {@code EmailService} ; le contenu metier devis vit ici.</p>
 */
@Component
public class QuoteEmailComposer {

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

    /** Libelle commercial d'un forfait ({@code premium} → "Forfait Premium"). */
    public String formatPackageName(String packageId) {
        return switch (packageId) {
            case "premium" -> "Forfait Premium";
            case "confort" -> "Forfait Confort";
            case "essentiel" -> "Forfait Essentiel";
            default -> packageId;
        };
    }

    /**
     * Pre-rend les sections dynamiques du template devis (coordonnees, bien,
     * services). Le rendu est injecte dans {@code {detailsHtml}} du template
     * editable. L'user voit cette variable comme "section non-editable
     * pre-generee" dans la sidebar de l'UI.
     */
    public String renderQuoteDetailsHtml(QuoteRequestDto dto) {
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

    private String getLabel(Map<String, String> labels, String key) {
        if (key == null) return "Non renseigné";
        // Toujours echapper : si la cle ne matche pas, elle contient du user input brut
        return StringUtils.escapeHtml(labels.getOrDefault(key, key));
    }
}
