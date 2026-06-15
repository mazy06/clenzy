package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.dto.RestrictionDivergence;
import com.clenzy.model.BookingRestriction;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Détecte les divergences de restrictions de séjour entre Clenzy (la {@link BookingRestriction}
 * locale résolue pour une date) et l'OTA (les attributs Channex pour cette date) — CLZ Domaine 1.
 *
 * <p><b>Fonction pure</b>, entièrement testable sans base ni réseau. Champs comparés :
 * {@code min_stay_through}, {@code min_stay_arrival}, {@code closed_to_arrival},
 * {@code closed_to_departure}. Absence locale ou distante = « aucune contrainte » ; seuls les
 * écarts réels sont signalés (pas de bruit sur false==false / null==null).</p>
 */
@Component
public class RestrictionDivergenceDetector {

    /**
     * @param local       restriction locale applicable la plus prioritaire pour la date (peut être null)
     * @param remoteAttrs nœud {@code attributes} de l'entrée rate Channex pour la date (peut être null)
     * @return liste (éventuellement vide) des champs en divergence
     */
    public List<RestrictionDivergence> detect(BookingRestriction local, JsonNode remoteAttrs) {
        List<RestrictionDivergence> out = new ArrayList<>();

        Integer localMinStay = local != null ? local.getMinStay() : null;
        Integer localMinStayArrival = local != null ? local.getMinStayArrival() : null;
        boolean localCta = local != null && Boolean.TRUE.equals(local.getClosedToArrival());
        boolean localCtd = local != null && Boolean.TRUE.equals(local.getClosedToDeparture());

        Integer otaMinStay = intOrNull(remoteAttrs, "min_stay_through");
        Integer otaMinStayArrival = intOrNull(remoteAttrs, "min_stay_arrival");
        boolean otaCta = boolOrFalse(remoteAttrs, "closed_to_arrival");
        boolean otaCtd = boolOrFalse(remoteAttrs, "closed_to_departure");

        if (!Objects.equals(localMinStay, otaMinStay)) {
            out.add(new RestrictionDivergence("min_stay_through", str(localMinStay), str(otaMinStay)));
        }
        if (!Objects.equals(localMinStayArrival, otaMinStayArrival)) {
            out.add(new RestrictionDivergence("min_stay_arrival", str(localMinStayArrival), str(otaMinStayArrival)));
        }
        if (localCta != otaCta) {
            out.add(new RestrictionDivergence("closed_to_arrival", String.valueOf(localCta), String.valueOf(otaCta)));
        }
        if (localCtd != otaCtd) {
            out.add(new RestrictionDivergence("closed_to_departure", String.valueOf(localCtd), String.valueOf(otaCtd)));
        }
        return out;
    }

    private static Integer intOrNull(JsonNode attrs, String field) {
        if (attrs == null) return null;
        JsonNode n = attrs.get(field);
        return (n == null || n.isNull() || !n.canConvertToInt()) ? null : n.asInt();
    }

    private static boolean boolOrFalse(JsonNode attrs, String field) {
        if (attrs == null) return false;
        JsonNode n = attrs.get(field);
        return n != null && !n.isNull() && n.asBoolean(false);
    }

    private static String str(Integer v) {
        return v == null ? "-" : v.toString();
    }
}
