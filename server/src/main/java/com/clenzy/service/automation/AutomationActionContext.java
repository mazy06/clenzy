package com.clenzy.service.automation;

import com.clenzy.model.Reservation;

import java.util.Map;

/**
 * Contexte passe par le moteur AutomationRule a un {@link AutomationActionExecutor}
 * lors de l'execution d'une regle (fiche 08).
 *
 * <p>Porte l'organisation, le sujet generique ({@code subjectType} / {@code subjectId},
 * memes constantes que {@link AutomationSubject}), les donnees utiles du declenchement
 * et, pour un sujet TYPE_RESERVATION, la reservation resolue par le moteur.</p>
 *
 * @param reservation resolue par le moteur quand le sujet est TYPE_RESERVATION,
 *                    null sinon — construite ici, jamais par les capteurs
 * @param data        donnees volatiles du declenchement : NON persistees, map vide
 *                    sur le chemin planifie (PENDING draine plus tard)
 */
public record AutomationActionContext(Long orgId,
                                      String subjectType,
                                      Long subjectId,
                                      Map<String, Object> data,
                                      Reservation reservation) {

    public AutomationActionContext {
        data = data != null ? Map.copyOf(data) : Map.of();
    }

    /** Convenance pour les sujets non-reservation (pas de reservation a resoudre). */
    public AutomationActionContext(Long orgId, String subjectType, Long subjectId,
                                   Map<String, Object> data) {
        this(orgId, subjectType, subjectId, data, null);
    }

    public static AutomationActionContext forReservation(Long orgId, Reservation reservation) {
        return new AutomationActionContext(orgId, AutomationSubject.TYPE_RESERVATION,
            reservation.getId(), Map.of(), reservation);
    }

    /** Valeur de donnee typee Long (Number ou String numerique), sinon null. */
    public Long dataAsLong(String key) {
        Object value = data != null ? data.get(key) : null;
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String s && !s.isBlank()) {
            try {
                return Long.parseLong(s.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    /** Valeur de donnee typee String, sinon null. */
    public String dataAsString(String key) {
        Object value = data != null ? data.get(key) : null;
        return value != null ? value.toString() : null;
    }
}
