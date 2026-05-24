package com.clenzy.integration.channex.dto;

import com.clenzy.integration.channex.model.ChannexSyncStatus;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Resume agrege de la sante Channex pour une organisation — Phase 2.
 *
 * <p>Backend pour un tableau de bord administrateur "vue d'ensemble Channex" :
 * combien de mappings, combien en erreur, lesquels demandent une attention
 * immediate. Genere par le watchdog scheduler ({@code ChannexWatchdogScheduler})
 * + expose par endpoint REST pour l'UI.</p>
 *
 * <p>Le champ {@link #attentionItems} contient les mappings qui meritent une
 * action humaine, classes par severite (ERROR avant PENDING-stuck avant STALE).</p>
 */
public record ChannexHealthSummary(
    int totalMappings,
    Map<ChannexSyncStatus, Integer> countsByStatus,
    List<AttentionItem> attentionItems,
    Instant computedAt
) {

    /** Un mapping qui demande une attention humaine + raison. */
    public record AttentionItem(
        Long clenzyPropertyId,
        Long organizationId,
        String propertyName,
        ChannexSyncStatus syncStatus,
        Severity severity,
        String reason,
        Instant lastSyncAt,
        String lastSyncError
    ) {}

    /** Severite de l'alerte : ERROR > WARNING > INFO. Trie cote backend. */
    public enum Severity { ERROR, WARNING, INFO }
}
