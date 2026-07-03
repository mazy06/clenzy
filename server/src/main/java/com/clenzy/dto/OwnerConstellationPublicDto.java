package com.clenzy.dto;

import java.time.Instant;
import java.util.List;

/**
 * Vue publique de la Constellation Proprietaire (campagne X9 v1) : ce que les
 * agents Baitly ont fait pour LES biens du proprietaire, adosse a son tableau
 * de bord (revenus, commissions, net). White-label : seule la conciergerie
 * ({@code conciergerieName}) apparait, jamais la plateforme.
 */
public record OwnerConstellationPublicDto(
        String conciergerieName,
        String ownerDisplayName,
        String brandingLogoUrl,
        String brandingPrimaryColor,
        OwnerDashboardDto dashboard,
        List<PropertyAgentActivityDto> agentActivity
) {

    /** Activite agents d'un bien du proprietaire (compteurs 30 j + dernieres lignes). */
    public record PropertyAgentActivityDto(
            Long propertyId,
            String propertyName,
            long actionsLast30Days,
            long suggestionsLast30Days,
            List<ActivityLineDto> recent
    ) {}

    /** Ligne du feed agent, lisible proprietaire (resume court, sans PII). */
    public record ActivityLineDto(
            Instant createdAt,
            String moduleKey,
            String kind,
            String summary
    ) {}
}
