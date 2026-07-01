package com.clenzy.service.agent.analytics;

import com.clenzy.model.Reservation;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Source unique de vérité pour la commission canal et la normalisation de source
 * (P2-12 / audit : élimine la duplication entre {@code ChannelAttributionService}
 * et {@code PropertyPnlService}, dont les {@code normalize()} divergeaient).
 *
 * <p>Commission = {@code otaFeeAmount} réel si présent (BigDecimal.compareTo non requis,
 * lecture seule), sinon brut × taux par défaut du canal.</p>
 */
@Component
public class ChannelCommissionResolver {

    /** Taux de commission par défaut (repli si {@code otaFeeAmount} absent). */
    private static final Map<String, Double> DEFAULT_RATES = Map.of(
            "airbnb", 0.03,
            "booking", 0.15,
            "vrbo", 0.08,
            "expedia", 0.15);

    /** Canal normalisé (airbnb/booking/vrbo/expedia/direct/other ou la source brute en minuscules). */
    public String normalize(String source) {
        if (source == null || source.isBlank()) {
            return "other";
        }
        String s = source.trim().toLowerCase();
        if (s.contains("airbnb")) return "airbnb";
        if (s.contains("booking")) return "booking";
        if (s.contains("vrbo") || s.contains("homeaway")) return "vrbo";
        if (s.contains("expedia")) return "expedia";
        if (s.contains("direct")) return "direct";
        return s;
    }

    /** Taux par défaut pour un canal déjà normalisé (0 si inconnu). */
    public double rateFor(String channel) {
        return DEFAULT_RATES.getOrDefault(channel, 0.0);
    }

    /** Commission : {@code otaFeeAmount} réel si présent, sinon {@code gross} × taux par défaut. */
    public BigDecimal commissionOf(Reservation r, BigDecimal gross) {
        if (r.getOtaFeeAmount() != null) {
            return r.getOtaFeeAmount();
        }
        double rate = rateFor(normalize(r.getSource()));
        return gross.multiply(BigDecimal.valueOf(rate));
    }

    /** true si la commission est ESTIMÉE (pas d'{@code otaFeeAmount} réel + taux par défaut connu). */
    public boolean isEstimated(Reservation r) {
        return r.getOtaFeeAmount() == null && rateFor(normalize(r.getSource())) > 0.0;
    }
}
