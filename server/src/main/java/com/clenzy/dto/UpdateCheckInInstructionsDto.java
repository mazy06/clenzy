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
    String arrivalPhotos,
    /** Régénération auto du code d'accès après chaque départ (opt-in par logement). */
    boolean accessCodeAutoRotate,
    /** Format JSON ({pattern, letters, symbols}) du générateur. Null = inchangé. */
    String accessCodeFormat,
    /** Codes additionnels (JSON [{label, code}]). Null = inchangé. */
    String extraAccessCodes,
    /** Autorise l'ouverture de la porte depuis le livret guest (serrure pilotable à distance). */
    boolean guestUnlockEnabled
) {}
