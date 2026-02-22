package com.clenzy.dto.manager;

/**
 * Lightweight team summary for manager listing endpoints.
 * Matches the JSON shape: {id, name, description, interventionType, memberCount, isActive}
 */
public record ManagerTeamSummaryDto(
        Long id,
        String name,
        String description,
        String interventionType,
        int memberCount,
        boolean isActive
) {}
