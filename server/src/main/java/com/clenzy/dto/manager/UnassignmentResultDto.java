package com.clenzy.dto.manager;

/**
 * Result of an unassignment (client, team, user, or property) operation.
 */
public record UnassignmentResultDto(
        String message,
        int removedCount
) {}
