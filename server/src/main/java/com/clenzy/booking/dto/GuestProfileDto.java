package com.clenzy.booking.dto;

public record GuestProfileDto(
    Long id,
    String email,
    String firstName,
    String lastName,
    String phone,
    Long organizationId,
    boolean emailVerified
) {}
