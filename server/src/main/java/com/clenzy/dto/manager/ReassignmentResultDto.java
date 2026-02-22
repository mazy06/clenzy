package com.clenzy.dto.manager;

/**
 * Result of a reassignment operation (client or property).
 */
public record ReassignmentResultDto(
        String message,
        Long clientId,
        Long propertyId,
        Long newManagerId
) {}
