package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Édition du montant d'une intervention.
 * mode : {@code SET} (nouveau montant), {@code DISCOUNT_AMOUNT} (remise en €),
 * {@code DISCOUNT_PERCENT} (remise en %). Le montant final est recalculé côté
 * serveur (jamais de confiance au montant client).
 */
public record InterventionAmountRequest(String mode, BigDecimal value) {
}
