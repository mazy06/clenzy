package com.clenzy.dto.manager;

/**
 * Result of a client/property assignment operation.
 */
public record AssignmentResultDto(
        String message,
        int clientsAssigned,
        int propertiesAssigned,
        Long portfolioId
) {}
