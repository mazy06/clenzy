package com.clenzy.booking.dto;

public record GuestAuthResponse(
    String accessToken,
    String refreshToken,
    long expiresIn,
    GuestProfileDto profile
) {}
