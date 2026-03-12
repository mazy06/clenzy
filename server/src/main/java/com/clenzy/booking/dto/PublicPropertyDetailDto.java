package com.clenzy.booking.dto;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;

import java.math.BigDecimal;
import java.util.List;

/**
 * DTO complet pour le detail d'une propriete dans le Booking Engine public.
 * Inclut description, toutes les photos, et informations detaillees.
 */
public record PublicPropertyDetailDto(
    Long id,
    String name,
    String description,
    String type,
    String city,
    String country,
    BigDecimal latitude,
    BigDecimal longitude,
    Integer bedroomCount,
    Integer bathroomCount,
    Integer maxGuests,
    Integer squareMeters,
    BigDecimal nightlyPrice,
    Integer minimumNights,
    String currency,
    List<PhotoDto> photos,
    List<String> amenities,
    String checkInTime,
    String checkOutTime
) {
    public record PhotoDto(Long id, String url, String caption) {}

    public static PublicPropertyDetailDto from(Property p) {
        List<PhotoDto> photoList = p.getPhotos() != null
            ? p.getPhotos().stream()
                .map(ph -> new PhotoDto(ph.getId(), ph.getUrl(), ph.getCaption()))
                .toList()
            : List.of();

        List<String> amenityList = null;
        if (p.getAmenities() != null && !p.getAmenities().isBlank()) {
            String raw = p.getAmenities().trim();
            if (raw.startsWith("[")) {
                raw = raw.substring(1, raw.length() - 1);
                amenityList = List.of(raw.replace("\"", "").split(","))
                    .stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
            } else {
                amenityList = List.of(raw.split(","))
                    .stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
            }
        }

        return new PublicPropertyDetailDto(
            p.getId(),
            p.getName(),
            p.getDescription(),
            p.getType() != null ? p.getType().name() : null,
            p.getCity(),
            p.getCountry(),
            p.getLatitude(),
            p.getLongitude(),
            p.getBedroomCount(),
            p.getBathroomCount(),
            p.getMaxGuests(),
            p.getSquareMeters(),
            p.getNightlyPrice(),
            p.getMinimumNights(),
            p.getDefaultCurrency(),
            photoList,
            amenityList,
            p.getDefaultCheckInTime(),
            p.getDefaultCheckOutTime()
        );
    }
}
