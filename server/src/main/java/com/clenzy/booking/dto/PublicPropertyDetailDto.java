package com.clenzy.booking.dto;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.model.User;

import java.math.BigDecimal;
import java.util.List;

/**
 * DTO complet pour le detail d'une propriete dans le Booking Engine public.
 * Inclut description, toutes les photos, et informations detaillees.
 *
 * <h2>Host info</h2>
 * Le widget booking engine affiche un bandeau "Hôte : ..." avec photo. Seuls les champs
 * publics sûrs sont exposés ici (prénom + initiale du nom + URL photo). Email, téléphone,
 * adresse restent privés.
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
    String checkOutTime,
    HostPublicDto host
) {
    public record PhotoDto(Long id, String url, String caption) {}

    /**
     * Public-safe representation of a host shown next to the property.
     *
     * @param firstName prénom complet
     * @param lastInitial initiale du nom (Mohamed M.) — règle d'anonymisation OTA
     * @param profilePictureUrl URL servie par le PMS, null si pas de photo
     */
    public record HostPublicDto(
            String firstName,
            String lastInitial,
            String profilePictureUrl
    ) {
        public static HostPublicDto from(User u) {
            if (u == null) return null;
            String last = u.getLastName();
            String initial = (last == null || last.isBlank())
                    ? null
                    : last.trim().substring(0, 1).toUpperCase() + ".";
            // Public-safe URL: served by the anonymous /api/public/host-avatar endpoint
            // (privacy gate: only HOSTs are exposed). External SSO URLs are returned as-is.
            String avatar = u.getProfilePictureUrl();
            String publicUrl;
            if (avatar == null || avatar.isBlank()) {
                publicUrl = null;
            } else if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
                publicUrl = avatar;
            } else {
                publicUrl = "/api/public/host-avatar/" + u.getId();
            }
            return new HostPublicDto(u.getFirstName(), initial, publicUrl);
        }
    }

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
            p.getDefaultCheckOutTime(),
            HostPublicDto.from(p.getOwner())
        );
    }

    /** Copie avec prix converti dans une devise d'affichage (CLZ Domaine 2 — multi-devise). */
    public PublicPropertyDetailDto withDisplayCurrency(BigDecimal newNightlyPrice, String newCurrency) {
        return new PublicPropertyDetailDto(id, name, description, type, city, country, latitude, longitude,
            bedroomCount, bathroomCount, maxGuests, squareMeters, newNightlyPrice, minimumNights, newCurrency,
            photos, amenities, checkInTime, checkOutTime, host);
    }
}
