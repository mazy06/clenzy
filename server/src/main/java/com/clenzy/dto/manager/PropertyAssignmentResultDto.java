package com.clenzy.dto.manager;

/**
 * Result of a single property assignment/unassignment/reassignment operation.
 */
public record PropertyAssignmentResultDto(
        String message,
        Long propertyId
) {}
