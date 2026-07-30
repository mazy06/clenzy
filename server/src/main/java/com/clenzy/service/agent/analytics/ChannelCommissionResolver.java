package com.clenzy.service.agent.analytics;

import com.clenzy.model.Reservation;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

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

    /**
     * Taux de commission par défaut (repli si {@code otaFeeAmount} absent).
     *
     * <p><b>Airbnb : 15,5 %, et non plus 3 %.</b> Les 3 % étaient la part hôte du
     * <i>split fee</i>, le reste étant payé par le voyageur. Airbnb a basculé d'office
     * les hôtes connectés à un PMS — ce que sont, par construction, tous les hôtes
     * Baitly — vers le <i>host-only fee</i> à 15,5 % du sous-total (nuitées + ménage +
     * frais animaux et voyageur supplémentaire, hors taxes), entre le 27/10/2025 et le
     * 13/04/2026 ; le split fee disparaît le 15/09/2026 hors EEE et le 13/10/2026 dans
     * l'EEE et en Suisse. Rester à 3 % sous-estimait la commission de 12,5 points de
     * brut sur chaque séjour Airbnb, donc surestimait d'autant la marge affichée.</p>
     */
    private static final Map<String, Double> DEFAULT_RATES = Map.of(
            "airbnb", 0.155,
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

    /**
     * Canaux pour lesquels un taux de référence existe.
     *
     * <p>Exposé pour que l'écran de paramétrage énumère les mêmes canaux que
     * ceux réellement utilisés par le calcul, plutôt qu'une liste recopiée qui
     * dériverait au premier taux ajouté ici.</p>
     */
    public Set<String> knownChannels() {
        return DEFAULT_RATES.keySet();
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
