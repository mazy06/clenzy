package com.clenzy.dto;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Choix humain porte par la modale d'une carte de constellation.
 *
 * <p>Tous les champs sont facultatifs, et leur absence n'est pas un defaut : le
 * chemin automatique (AutomationRule, auto-application) applique la meme carte
 * sans personne pour choisir. Absent = valeurs portees par la carte, ou defauts
 * de l'executeur.</p>
 *
 * @param scheduledAt date et heure retenues (modale de planification)
 * @param assigneeId  intervenant a qui proposer la mission ({@code null} = personne)
 * @param params      parametres d'action revus par l'operateur, qui PRIMENT sur
 *                    ceux de la carte. L'agent les avait devines au moment du
 *                    scan ; la modale les a montres, et l'operateur a tranche.
 */
public record ApplySuggestionRequest(LocalDateTime scheduledAt,
                                     Long assigneeId,
                                     Map<String, Object> params) {

    /** Vrai si l'appelant n'a rien choisi — la carte garde alors ses valeurs. */
    public boolean isEmpty() {
        return scheduledAt == null && assigneeId == null && (params == null || params.isEmpty());
    }

    /** Parametres revus, jamais nuls — evite un test de nullite a chaque usage. */
    public Map<String, Object> safeParams() {
        return params == null ? Map.of() : params;
    }
}
