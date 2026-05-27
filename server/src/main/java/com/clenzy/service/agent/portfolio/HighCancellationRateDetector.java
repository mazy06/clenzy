package com.clenzy.service.agent.portfolio;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Pattern : proprietes avec un taux d'annulation au-dessus du seuil.
 * Le seuil est lu depuis {@link PortfolioConfig#getHighCancellationRate()}.
 * Le label / severity / format du message viennent du template YAML.
 */
@Component
public class HighCancellationRateDetector implements PortfolioPatternDetector {

    private static final String ID = "high_cancellation_rate";

    @Override
    public String patternId() {
        return ID;
    }

    @Override
    public Optional<Map<String, Object>> evaluate(PortfolioInput input,
                                                     PortfolioPatternTemplate template) {
        double threshold = input.config().getHighCancellationRate();
        int minSample = input.config().getMinReservationsForVolatility();

        List<String> volatileItems = new ArrayList<>();
        for (PropertyMetric m : input.properties()) {
            if (m.totalReservations() < minSample) continue;
            double cancelRate = m.cancellationRate();
            if (cancelRate > threshold) {
                volatileItems.add(String.format(Locale.ROOT, "%s (%d%%)",
                        m.name(), Math.round(cancelRate * 100)));
            }
        }
        if (volatileItems.isEmpty()) return Optional.empty();

        Map<String, Number> severityVars = Map.of("count", volatileItems.size());
        String resolvedSeverity = template.resolveSeverity(severityVars);

        Map<String, Object> descVars = new LinkedHashMap<>();
        descVars.put("count", volatileItems.size());
        descVars.put("thresholdPct", Math.round(threshold * 100));
        String renderedDesc = template.renderDescription(descVars);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", template.type);
        result.put("severity", resolvedSeverity);
        result.put("title", template.title);
        result.put("description", renderedDesc);
        result.put("items", volatileItems);
        return Optional.of(result);
    }
}
