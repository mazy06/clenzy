package com.clenzy.dto.manager;

/**
 * Lightweight user summary for manager listing endpoints (hosts, operational users, managers/admins).
 * Matches the JSON shape: {id, firstName, lastName, email, role, isActive}
 */
public record ManagerUserSummaryDto(
        Long id,
        String firstName,
        String lastName,
        String email,
        String role,
        boolean isActive
) {}
