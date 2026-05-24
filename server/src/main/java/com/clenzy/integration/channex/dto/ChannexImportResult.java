package com.clenzy.integration.channex.dto;

import java.util.List;

/**
 * Resultat de {@code POST /api/integrations/channex/import}.
 *
 * <p>Recapitule pour chaque ID Channex demande : succes / echec, et l'ID de
 * la Property Clenzy cree (si succes).</p>
 */
public record ChannexImportResult(
    int totalRequested,
    int created,
    int skipped,
    int errors,
    List<Item> details
) {
    public record Item(
        String channexPropertyId,
        String status,    // CREATED / SKIPPED_ALREADY_MAPPED / ERROR
        Long clenzyPropertyId,  // null si pas cree
        String message    // ex: "OK" ou message d'erreur
    ) {}
}
