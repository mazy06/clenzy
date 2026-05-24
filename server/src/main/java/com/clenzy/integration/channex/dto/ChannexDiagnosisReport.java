package com.clenzy.integration.channex.dto;

import com.clenzy.integration.channex.model.ChannexSyncStatus;

import java.time.Instant;
import java.util.List;

/**
 * Rapport de diagnostic Channex pour une property — Quick Win #5.
 *
 * <p>Repond a la question "mon listing est bloque sur Airbnb, qu'est-ce qui se
 * passe et comment je le repare ?" en analysant l'etat du mapping + les OTAs
 * actifs cote hub, et en recommandant 1-2 actions a executer en 1 clic.</p>
 *
 * <p>Le report contient :</p>
 * <ul>
 *   <li>Un {@link SyncSnapshot} : etat brut (status, derniere sync, erreur, OTAs actifs)</li>
 *   <li>Une liste de {@link RecommendedAction} : actions classees par priorite
 *       avec leur code stable pour mapping UI ↔ handler (FORCE_RESYNC,
 *       FULL_DISCONNECT, OPEN_HUB)</li>
 *   <li>Un {@code summary} en francais pour affichage immediat</li>
 * </ul>
 */
public record ChannexDiagnosisReport(
    Long clenzyPropertyId,
    String propertyName,
    SyncSnapshot sync,
    List<RecommendedAction> recommendedActions,
    String summary
) {

    /** Snapshot brut de l'etat de sync pour affichage. */
    public record SyncSnapshot(
        ChannexSyncStatus status,
        Instant lastSyncAt,
        String lastSyncError,
        int activeOtaCount,
        boolean hasActiveOta
    ) {}

    /**
     * Action recommandee. Code stable pour que le frontend mappe vers le bon
     * handler (call FORCE_RESYNC → resync, FULL_DISCONNECT → ouvre dialog
     * Smart Disconnect, OPEN_HUB → ouvre les settings Channex).
     *
     * <p>Codes :</p>
     * <ul>
     *   <li>{@code FORCE_RESYNC}    : pousse l'etat Clenzy actuel vers Channex
     *       (= unblock si l'erreur etait transitoire ou si Channex avait poussé
     *       de l'ancien data)</li>
     *   <li>{@code FULL_DISCONNECT} : ouvre le Smart Disconnect (= libere l'OTA
     *       cote host si la sync est cassee)</li>
     *   <li>{@code OPEN_HUB}        : ouvre la vue Channex dans les settings
     *       (l'user finalise OAuth ou inspecte cote hub)</li>
     * </ul>
     */
    public record RecommendedAction(
        String code,
        String label,
        String detail,
        Priority priority
    ) {}

    public enum Priority { PRIMARY, SECONDARY }
}
