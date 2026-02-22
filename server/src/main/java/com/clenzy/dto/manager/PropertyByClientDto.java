package com.clenzy.dto.manager;

/**
 * Property info with owner details, used by the properties-by-clients endpoint.
 * Matches the JSON shape: {id, name, address, city, type, status, ownerId, ownerName, isActive}
 */
public record PropertyByClientDto(
        Long id,
        String name,
        String address,
        String city,
        String type,
        String status,
        Long ownerId,
        String ownerName,
        boolean isActive
) {}
