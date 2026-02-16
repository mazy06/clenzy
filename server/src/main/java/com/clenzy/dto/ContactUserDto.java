package com.clenzy.dto;

/**
 * DTO representant un utilisateur dans le contexte Contact.
 */
public record ContactUserDto(
        String id,
        String firstName,
        String lastName,
        String email,
        String role
) {
    /**
     * Constructeur sans role (backward compatibility).
     */
    public ContactUserDto(String id, String firstName, String lastName, String email) {
        this(id, firstName, lastName, email, null);
    }
}
