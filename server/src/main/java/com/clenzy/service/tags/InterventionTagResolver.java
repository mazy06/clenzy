package com.clenzy.service.tags;

import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.pricing.CleaningPricingEngine;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningInputs;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningQuote;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import static com.clenzy.service.tags.TagFormatting.DATE_FORMAT;
import static com.clenzy.service.tags.TagFormatting.formatDateTime;
import static com.clenzy.service.tags.TagFormatting.formatMoney;
import static com.clenzy.service.tags.TagFormatting.safeStr;

/**
 * Tags d'une intervention : intervention.*, property.*, client.*, technicien.*,
 * paiement.*, ligne.*, nf.*.
 */
@Component
public class InterventionTagResolver implements ReferenceTagResolver {

    private static final Logger log = LoggerFactory.getLogger(InterventionTagResolver.class);

    private final InterventionRepository interventionRepository;
    private final EntityTagBuilders builders;
    private final CleaningPricingEngine cleaningPricingEngine;

    public InterventionTagResolver(InterventionRepository interventionRepository,
                                   EntityTagBuilders builders,
                                   CleaningPricingEngine cleaningPricingEngine) {
        this.interventionRepository = interventionRepository;
        this.builders = builders;
        this.cleaningPricingEngine = cleaningPricingEngine;
    }

    @Override
    public String referenceType() {
        return "intervention";
    }

    @Override
    public void resolve(Long interventionId, Map<String, Object> context) {
        if (interventionId == null) return;

        interventionRepository.findById(interventionId).ifPresent(intervention -> {
            Map<String, Object> interventionTags = builders.interventionTags(intervention);
            interventionTags.putAll(cleaningEngineTags(intervention));
            context.put("intervention", interventionTags);

            // Resoudre aussi property, client (requestor), assigned
            if (intervention.getProperty() != null) {
                context.put("property", builders.propertyTags(intervention.getProperty()));

                if (intervention.getProperty().getOwner() != null) {
                    context.put("client", builders.clientTags(intervention.getProperty().getOwner()));
                }
            }

            if (intervention.getRequestor() != null) {
                context.putIfAbsent("client", builders.clientTags(intervention.getRequestor()));
            }

            if (intervention.getAssignedUser() != null) {
                context.put("technicien", builders.clientTags(intervention.getAssignedUser()));
            } else {
                context.put("technicien", builders.emptyClientTags());
            }

            // Tags paiement
            context.put("paiement", paymentTags(intervention));

            // Tags ligne de facturation (top-level pour les templates FACTURE)
            context.put("ligne", ligneTags(intervention));

            // Numero de facture (tag nf.*)
            context.put("nf", nfTags(intervention));
        });
    }

    private Map<String, Object> paymentTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("statut", intervention.getPaymentStatus() != null ? intervention.getPaymentStatus().name() : "PENDING");
        tags.put("montant", formatMoney(intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost()));
        tags.put("date_paiement", formatDateTime(intervention.getPaidAt()));
        tags.put("reference_stripe", safeStr(intervention.getStripePaymentIntentId()));
        return tags;
    }

    /**
     * Tags ligne de facturation pour une intervention (top-level ${ligne.*}).
     * Utilise le cout reel ou estime comme montant.
     */
    private Map<String, Object> ligneTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("description", safeStr(intervention.getDescription()));
        tags.put("quantite", "1");
        BigDecimal cost = intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost();
        tags.put("prix_unitaire", formatMoney(cost));
        tags.put("total", formatMoney(cost));
        return tags;
    }

    /**
     * Tags numero de facture pour une intervention (top-level ${nf.*}).
     * Le vrai numero est attribue par DocumentNumberingService, ici on fournit des fallbacks.
     */
    private Map<String, Object> nfTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("numero", "");
        tags.put("date", LocalDateTime.now().format(DATE_FORMAT));
        return tags;
    }

    /**
     * Tags moteur menage (PLAN-MOTEUR-MENAGE.md, P1) :
     * ${intervention.prix_conseil}, ${intervention.fourchette},
     * ${intervention.duree_normee}, ${intervention.decomposition}.
     *
     * <p>prix_conseil = snapshot {@code recommendedCost} si present, sinon calcul
     * live du moteur. Les trois autres tags viennent de la quote live du logement.</p>
     *
     * <p>Un tag ne doit JAMAIS casser la generation de document : donnee absente
     * (pas de propriete, pas de quote) ou erreur moteur → chaine vide.</p>
     */
    private Map<String, Object> cleaningEngineTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("prix_conseil", "");
        tags.put("fourchette", "");
        tags.put("duree_normee", "");
        tags.put("decomposition", "");

        if (intervention.getRecommendedCost() != null) {
            tags.put("prix_conseil", formatMoney(intervention.getRecommendedCost()));
        }

        Property property = intervention.getProperty();
        if (property == null) return tags;

        try {
            String cleaningType = intervention.getType() != null && !intervention.getType().isBlank()
                    ? intervention.getType() : CleaningPricingEngine.STANDARD_CLEANING;
            CleaningQuote quote = cleaningPricingEngine.quote(property, cleaningType);
            if (quote == null) return tags;

            if (intervention.getRecommendedCost() == null) {
                tags.put("prix_conseil", formatMoney(quote.recommended()));
            }
            tags.put("fourchette", formatMoney(quote.min()) + " – " + formatMoney(quote.max()));
            tags.put("duree_normee", formatEngineDuration(quote.durationMinutes()));
            tags.put("decomposition", formatBreakdown(
                    cleaningPricingEngine.minutesBreakdown(CleaningInputs.fromProperty(property)),
                    property.getBedroomCount()));
        } catch (Exception e) {
            // Best-effort : le tag reste vide, la generation du document continue.
            log.warn("Tags moteur menage indisponibles pour l'intervention {} : {}",
                    intervention.getId(), e.getMessage());
        }
        return tags;
    }

    /** Formate la duree normee moteur : 135 → "2 h 15", 120 → "2 h", 45 → "45 min". */
    static String formatEngineDuration(int minutes) {
        int hours = minutes / 60;
        int remainder = minutes % 60;
        if (hours == 0) return remainder + " min";
        if (remainder == 0) return hours + " h";
        return hours + " h " + (remainder < 10 ? "0" + remainder : String.valueOf(remainder));
    }

    /**
     * Decomposition lisible des minutes par composant (uniquement les composants > 0),
     * ex. « Base (2 ch) : 120 min · Salle de bain supp. : 15 min ».
     */
    static String formatBreakdown(Map<String, Integer> breakdown, Integer bedrooms) {
        if (breakdown == null || breakdown.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        breakdown.forEach((key, minutes) -> {
            if (minutes == null || minutes <= 0) return;
            if (sb.length() > 0) sb.append(" · ");
            sb.append(breakdownLabel(key, bedrooms)).append(" : ").append(minutes).append(" min");
        });
        return sb.toString();
    }

    /** Libelles FR des cles stables du moteur (CleaningPricingEngine.minutesBreakdown). */
    private static String breakdownLabel(String key, Integer bedrooms) {
        return switch (key) {
            case "base" -> bedrooms != null ? "Base (" + bedrooms + " ch)" : "Base";
            case "bathrooms" -> "Salle de bain supp.";
            case "surface" -> "Surface supp.";
            case "floors" -> "Niveau supp.";
            case "exterior" -> "Extérieur";
            case "laundry" -> "Linge";
            case "guests" -> "Voyageurs supp.";
            default -> key;
        };
    }
}
