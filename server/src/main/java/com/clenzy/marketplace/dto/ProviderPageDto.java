package com.clenzy.marketplace.dto;

import java.util.List;

/**
 * Page de resultats.
 *
 * <p>Enveloppe maison plutot que {@code Page<T>} de Spring : la serialisation
 * par defaut de {@code PageImpl} n'est pas stable d'une version a l'autre, et
 * l'interface consomme un contrat fige.</p>
 */
public record ProviderPageDto(
    List<ProviderSummaryDto> items,
    int page,
    int size,
    long total,
    int totalPages
) {}
