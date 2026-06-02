package com.clenzy.dto;

/**
 * Payload d'inscription à la waitlist depuis la landing (endpoint public).
 * Seuls email est requis ; les autres champs sont optionnels.
 */
public record WaitlistSignupDto(
        String email,
        String fullName,
        String phone,
        String propertyCount,
        String city,
        String source
) {}
