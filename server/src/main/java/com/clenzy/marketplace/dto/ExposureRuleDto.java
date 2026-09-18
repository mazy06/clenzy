package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.model.ExposureEffect;
import com.clenzy.marketplace.model.MarketplaceExposureRule;

import java.time.LocalDateTime;

/**
 * Une exception a la visibilite par defaut.
 *
 * <p>{@code organizationName} accompagne l'identifiant : une regle qui
 * n'afficherait qu'un numero d'organisation serait illisible, donc jamais
 * relue.</p>
 */
public record ExposureRuleDto(
    Long id,
    Long organizationId,
    String organizationName,
    ExposureEffect effect,
    String reason,
    LocalDateTime createdAt
) {
    public static ExposureRuleDto from(MarketplaceExposureRule rule, String organizationName) {
        return new ExposureRuleDto(
            rule.getId(),
            rule.getOrganizationId(),
            rule.getOrganizationId() == null ? "Toutes les organisations" : organizationName,
            rule.getEffect(),
            rule.getReason(),
            rule.getCreatedAt());
    }
}
