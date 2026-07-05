package com.clenzy.dto.yield;

import java.math.BigDecimal;

/**
 * Bornes yield d'un bien (plancher/plafond). Les DEUX sont requises pour que
 * le moteur agisse sur le bien (sinon skip NO_BOUNDS journalisé).
 */
public record YieldPropertyBoundsDto(
    Long propertyId,
    String propertyName,
    BigDecimal floor,
    BigDecimal ceiling
) {}
