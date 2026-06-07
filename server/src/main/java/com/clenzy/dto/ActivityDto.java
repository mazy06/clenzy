package com.clenzy.dto;

/**
 * Activite/experience normalisee, agnostique du provider, telle qu'affichee sur
 * le livret guest. {@code bookingUrl} est le deep-link d'affiliation (revenu).
 */
public record ActivityDto(
    String provider,
    String title,
    String imageUrl,
    String price,
    String currency,
    Double rating,
    Integer reviewCount,
    String durationLabel,
    String bookingUrl
) {}
