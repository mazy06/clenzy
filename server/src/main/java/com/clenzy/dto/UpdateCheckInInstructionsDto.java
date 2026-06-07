package com.clenzy.dto;

public record UpdateCheckInInstructionsDto(
    String accessCode,
    String wifiName,
    String wifiPassword,
    String parkingInfo,
    String arrivalInstructions,
    String departureInstructions,
    String houseRules,
    String emergencyContact,
    String additionalNotes,
    /** JSON [{key, caption}] — photos d'indication d'accès. Null = inchangé. */
    String arrivalPhotos
) {}
