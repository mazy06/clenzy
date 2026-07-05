package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Ligne d'un devis de maintenance : {@code total ligne = quantity × unitPrice}.
 * Le total du devis est recalculé côté serveur (jamais de confiance au montant
 * client) et persisté dans {@code estimated_cost}.
 *
 * <p>{@code interventionType} (optionnel) relie la ligne à une prestation du
 * catalogue : sert au matching technicien et à l'application de ses tarifs.</p>
 */
public record QuoteLineDto(String label, BigDecimal quantity, BigDecimal unitPrice, String interventionType) {
}
