package com.clenzy.dto;

import com.clenzy.model.CheckInInstructions;

public record CheckInInstructionsDto(
    Long id,
    Long propertyId,
    String accessCode,
    String wifiName,
    String wifiPassword,
    String parkingInfo,
    String arrivalInstructions,
    String departureInstructions,
    String houseRules,
    String emergencyContact,
    String additionalNotes,
    String arrivalPhotos,
    String updatedAt
) {
    public static CheckInInstructionsDto fromEntity(CheckInInstructions e) {
        return new CheckInInstructionsDto(
            e.getId(),
            e.getPropertyId(),
            e.getAccessCode(),
            e.getWifiName(),
            e.getWifiPassword(),
            e.getParkingInfo(),
            e.getArrivalInstructions(),
            e.getDepartureInstructions(),
            e.getHouseRules(),
            e.getEmergencyContact(),
            e.getAdditionalNotes(),
            e.getArrivalPhotos(),
            e.getUpdatedAt() != null ? e.getUpdatedAt().toString() : null
        );
    }
}
