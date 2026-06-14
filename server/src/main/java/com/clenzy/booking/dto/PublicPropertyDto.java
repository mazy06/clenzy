package com.clenzy.booking.dto;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;

import java.math.BigDecimal;
import java.util.List;

/**
 * DTO leger pour la liste des proprietes dans le Booking Engine public.
 * Pas d'info sensible (owner, adresse exacte, notes internes).
 */
public record PublicPropertyDto(
    Long id,
    String name,
    String type,
    String city,
    String country,
    Integer bedroomCount,
    Integer bathroomCount,
    Integer maxGuests,
    Integer squareMeters,
    BigDecimal priceFrom,
    BigDecimal cleaningFee,
    Integer minimumNights,
    String currency,
    String mainPhotoUrl,
    List<String> photoUrls,
    List<String> amenities,
    String checkInTime,
    String checkOutTime
) {
    /**
     * URL photo PUBLIQUE (img-friendly) : externalUrl (Channex/Airbnb, déjà absolue + publique)
     * sinon endpoint public keyless /api/public/property-photos/{propertyId}/{photoId}.
     * Relative ici ; le widget/page la rend absolue via sa baseUrl (cf. PropertyList).
     */
    private static String publicPhotoUrl(PropertyPhoto photo, Long propertyId) {
        if (photo.getExternalUrl() != null && !photo.getExternalUrl().isBlank()) {
            return photo.getExternalUrl();
        }
        if (photo.getStorageKey() != null || photo.getData() != null) {
            return "/api/public/property-photos/" + propertyId + "/" + photo.getId();
        }
        return null;
    }

    public static PublicPropertyDto from(Property p) {
        // Main photo = premiere par date de creation
        String mainPhoto = p.getPhotos() != null
            ? p.getPhotos().stream()
                .map(ph -> publicPhotoUrl(ph, p.getId()))
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null)
            : null;

        // Amenities stockees en JSON array ou CSV
        List<String> amenityList = null;
        if (p.getAmenities() != null && !p.getAmenities().isBlank()) {
            String raw = p.getAmenities().trim();
            if (raw.startsWith("[")) {
                // JSON array — parse simple
                raw = raw.substring(1, raw.length() - 1);
                amenityList = List.of(raw.replace("\"", "").split(","))
                    .stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
            } else {
                amenityList = List.of(raw.split(","))
                    .stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
            }
        }

        // All photo URLs (publiques, img-friendly)
        List<String> allPhotoUrls = p.getPhotos() != null
            ? p.getPhotos().stream().map(ph -> publicPhotoUrl(ph, p.getId()))
                .filter(java.util.Objects::nonNull).toList()
            : List.of();

        return new PublicPropertyDto(
            p.getId(),
            p.getName(),
            p.getType() != null ? p.getType().name() : null,
            p.getCity(),
            p.getCountry(),
            p.getBedroomCount(),
            p.getBathroomCount(),
            p.getMaxGuests(),
            p.getSquareMeters(),
            p.getNightlyPrice(),
            p.getCleaningBasePrice(),
            p.getMinimumNights(),
            p.getDefaultCurrency(),
            mainPhoto,
            allPhotoUrls,
            amenityList,
            p.getDefaultCheckInTime(),
            p.getDefaultCheckOutTime()
        );
    }

    /** Copie avec montants convertis dans une devise d'affichage (CLZ Domaine 2 — multi-devise). */
    public PublicPropertyDto withDisplayCurrency(BigDecimal newPriceFrom, BigDecimal newCleaningFee, String newCurrency) {
        return new PublicPropertyDto(id, name, type, city, country, bedroomCount, bathroomCount, maxGuests,
            squareMeters, newPriceFrom, newCleaningFee, minimumNights, newCurrency, mainPhotoUrl, photoUrls,
            amenities, checkInTime, checkOutTime);
    }
}
