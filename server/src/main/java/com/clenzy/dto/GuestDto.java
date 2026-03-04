package com.clenzy.dto;

/**
 * DTO pour les voyageurs (guests / fiches clients).
 * Utilise en entree (create) et en sortie (search / lecture).
 */
public record GuestDto(
    Long id,
    String firstName,
    String lastName,
    String email,
    String phone,
    String fullName
) {}
