package com.clenzy.dto.manager;

/**
 * Result of a team/user assignment operation.
 */
public record TeamUserAssignmentResultDto(
        String message,
        int teamsAssigned,
        int usersAssigned
) {}
