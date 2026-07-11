package com.clenzy.service.tags;

import com.clenzy.model.Property;
import com.clenzy.service.pricing.CleaningPricingEngine;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningInputs;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningQuote;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tags {@code ${menage.*}} du devis ménage interne (Moteur Ménage 3A — P8) :
 * prix conseillé/fourchette/durée par type (express/standard/deep), décomposition
 * des minutes, taux horaire de référence. Source unique = CleaningPricingEngine.
 *
 * <p>TOUTES les clés sont TOUJOURS posées (chaîne vide en repli) : un tag absent
 * ferait échouer l'interpolation FreeMarker — une génération ne casse jamais.</p>
 */
@Component
public class CleaningQuoteTagBuilder {

    private static final Logger log = LoggerFactory.getLogger(CleaningQuoteTagBuilder.class);

    /** Libellés FR des composants de la décomposition minutes (clés moteur stables). */
    private static final Map<String, String> BREAKDOWN_LABELS = Map.of(
            "base", "Base (chambres)",
            "bathrooms", "Salles de bain supplémentaires",
            "surface", "Surface au-delà du seuil",
            "floors", "Étages supplémentaires",
            "exterior", "Extérieur",
            "laundry", "Buanderie / linge",
            "guests", "Voyageurs au-delà de 4");
    private static final String[] BREAKDOWN_ORDER =
            {"base", "bathrooms", "surface", "floors", "exterior", "laundry", "guests"};

    private final CleaningPricingEngine cleaningPricingEngine;

    public CleaningQuoteTagBuilder(CleaningPricingEngine cleaningPricingEngine) {
        this.cleaningPricingEngine = cleaningPricingEngine;
    }

    public Map<String, Object> menageTags(Property property) {
        Map<String, Object> tags = emptyTags();
        try {
            fillType(tags, "express", cleaningPricingEngine.quote(property, "EXPRESS_CLEANING"));
            fillType(tags, "standard", cleaningPricingEngine.quote(property, CleaningPricingEngine.STANDARD_CLEANING));
            fillType(tags, "deep", cleaningPricingEngine.quote(property, "DEEP_CLEANING"));

            Map<String, Integer> breakdown =
                    cleaningPricingEngine.minutesBreakdown(CleaningInputs.fromProperty(property));
            StringBuilder sb = new StringBuilder();
            for (String key : BREAKDOWN_ORDER) {
                int minutes = breakdown.getOrDefault(key, 0);
                if (minutes <= 0 && !"base".equals(key)) continue;
                if (sb.length() > 0) sb.append(" · ");
                sb.append(BREAKDOWN_LABELS.get(key)).append(" : ").append(minutes).append(" min");
            }
            tags.put("decomposition", sb.toString());
            tags.put("taux_horaire", formatMoney(cleaningPricingEngine.referenceHourlyRate()) + "/h");
        } catch (Exception e) {
            // Repli : clés vides déjà posées — la génération du document survit.
            log.warn("Tags menage non calculables pour la propriété {} : {}",
                    property != null ? property.getId() : null, e.getMessage());
        }
        return tags;
    }

    private void fillType(Map<String, Object> tags, String prefix, CleaningQuote quote) {
        tags.put(prefix + "_prix", formatMoney(quote.recommended().doubleValue()));
        tags.put(prefix + "_fourchette",
                formatMoney(quote.min().doubleValue()) + " – " + formatMoney(quote.max().doubleValue()));
        tags.put(prefix + "_duree", formatDuration(quote.durationMinutes()));
    }

    /** Toutes les clés menage.* posées vides — contrat « jamais de tag manquant ». */
    private static Map<String, Object> emptyTags() {
        Map<String, Object> tags = new LinkedHashMap<>();
        for (String prefix : new String[]{"express", "standard", "deep"}) {
            tags.put(prefix + "_prix", "");
            tags.put(prefix + "_fourchette", "");
            tags.put(prefix + "_duree", "");
        }
        tags.put("decomposition", "");
        tags.put("taux_horaire", "");
        return tags;
    }

    private static String formatMoney(double value) {
        if (value == Math.floor(value)) {
            return String.valueOf((long) value) + " €";
        }
        return String.format(java.util.Locale.FRANCE, "%.2f €", value);
    }

    private static String formatDuration(int minutes) {
        int hours = minutes / 60;
        int remainder = minutes % 60;
        if (hours == 0) return minutes + " min";
        if (remainder == 0) return hours + " h";
        return hours + " h " + String.format("%02d", remainder);
    }
}
