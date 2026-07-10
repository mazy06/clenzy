package com.clenzy.integration.channex.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * Resultat d'un push ARI (availability ou restrictions) vers Channex.
 *
 * <p>Channex repond {@code 200 OK} avec
 * {@code {"data":[{"id":"...","type":"task"}], "meta":{"warnings":[...]}}} :</p>
 * <ul>
 *   <li><b>task IDs</b> — le traitement est asynchrone cote Channex ; ces IDs
 *       tracent chaque batch (ils sont exiges lors de la certification PMS) ;</li>
 *   <li><b>warnings</b> — les entrees rejetees par la validation sont IGNOREES
 *       (le reste du batch est traite normalement) et signalees uniquement ici.
 *       Sans parsing, une entree fautive disparait silencieusement.</li>
 * </ul>
 */
public record ChannexAriPushResult(List<String> taskIds, List<String> warnings) {

    public ChannexAriPushResult {
        taskIds = taskIds != null ? List.copyOf(taskIds) : List.of();
        warnings = warnings != null ? List.copyOf(warnings) : List.of();
    }

    public static ChannexAriPushResult empty() {
        return new ChannexAriPushResult(List.of(), List.of());
    }

    public boolean hasWarnings() {
        return !warnings.isEmpty();
    }

    /** Fusionne deux resultats (accumulation multi-chunks). */
    public ChannexAriPushResult merge(ChannexAriPushResult other) {
        if (other == null) return this;
        List<String> ids = new ArrayList<>(taskIds);
        ids.addAll(other.taskIds());
        List<String> warns = new ArrayList<>(warnings);
        warns.addAll(other.warnings());
        return new ChannexAriPushResult(ids, warns);
    }
}
