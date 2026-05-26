package com.clenzy.service.agent.portfolio;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Pattern : villes dont le rating moyen des proprietes tombe sous le seuil
 * configurable {@link PortfolioConfig#getLowRatingThreshold()}.
 *
 * <p>Aggregation par city, on ne compte que les proprietes pour lesquelles on
 * a au moins une review (avgRating != null).</p>
 */
@Component
public class CitySatisfactionLowDetector implements PortfolioPatternDetector {

    private static final String ID = "city_satisfaction_low";

    @Override
    public String patternId() {
        return ID;
    }

    @Override
    public Optional<Map<String, Object>> evaluate(PortfolioInput input,
                                                     PortfolioPatternTemplate template) {
        double threshold = input.config().getLowRatingThreshold();

        Map<String, List<Double>> ratingsByCity = new HashMap<>();
        for (PropertyMetric m : input.properties()) {
            if (m.city() == null || m.avgRating() == null) continue;
            ratingsByCity.computeIfAbsent(m.city(), k -> new ArrayList<>()).add(m.avgRating());
        }

        List<String> lowRatingCities = new ArrayList<>();
        for (Map.Entry<String, List<Double>> entry : ratingsByCity.entrySet()) {
            if (entry.getValue().isEmpty()) continue;
            double avg = entry.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0);
            if (avg < threshold) {
                lowRatingCities.add(String.format(Locale.ROOT, "%s (%s/5)",
                        entry.getKey(),
                        BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP).toPlainString()));
            }
        }
        if (lowRatingCities.isEmpty()) return Optional.empty();

        Map<String, Number> severityVars = Map.of("count", lowRatingCities.size());
        String resolvedSeverity = template.resolveSeverity(severityVars);

        Map<String, Object> descVars = new LinkedHashMap<>();
        descVars.put("count", lowRatingCities.size());
        descVars.put("thresholdRating",
                BigDecimal.valueOf(threshold).setScale(1, RoundingMode.HALF_UP).toPlainString());
        String renderedDesc = template.renderDescription(descVars);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", template.type);
        result.put("severity", resolvedSeverity);
        result.put("title", template.title);
        result.put("description", renderedDesc);
        result.put("items", lowRatingCities);
        return Optional.of(result);
    }
}
