package com.clenzy.booking.dto;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.model.PropertyType;
import com.clenzy.model.User;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class PublicPropertyDetailDtoTest {

    // --- record accessors ---

    @Test
    void recordAccessors_returnAllConstructorValues() {
        PublicPropertyDetailDto.PhotoDto p1 = new PublicPropertyDetailDto.PhotoDto(1L, "url1", "cap1");
        PublicPropertyDetailDto.HostPublicDto host = new PublicPropertyDetailDto.HostPublicDto("Jean", "D.", "https://avatar");

        PublicPropertyDetailDto dto = new PublicPropertyDetailDto(
                7L, "Cozy Loft", "Beautiful place", "LOFT", "Paris", "France",
                new BigDecimal("48.85"), new BigDecimal("2.35"),
                2, 1, 4, 60, new BigDecimal("100.00"), 2, "EUR",
                java.util.List.of(p1), java.util.List.of("wifi", "tv"),
                "15:00", "11:00", host
        );

        assertEquals(7L, dto.id());
        assertEquals("Cozy Loft", dto.name());
        assertEquals("Beautiful place", dto.description());
        assertEquals("LOFT", dto.type());
        assertEquals("Paris", dto.city());
        assertEquals("France", dto.country());
        assertEquals(new BigDecimal("48.85"), dto.latitude());
        assertEquals(new BigDecimal("2.35"), dto.longitude());
        assertEquals(2, dto.bedroomCount());
        assertEquals(1, dto.bathroomCount());
        assertEquals(4, dto.maxGuests());
        assertEquals(60, dto.squareMeters());
        assertEquals(new BigDecimal("100.00"), dto.nightlyPrice());
        assertEquals(2, dto.minimumNights());
        assertEquals("EUR", dto.currency());
        assertEquals(1, dto.photos().size());
        assertEquals(p1, dto.photos().get(0));
        assertEquals(java.util.List.of("wifi", "tv"), dto.amenities());
        assertEquals("15:00", dto.checkInTime());
        assertEquals("11:00", dto.checkOutTime());
        assertEquals(host, dto.host());
    }

    // --- PhotoDto record ---

    @Test
    void photoDto_accessors() {
        PublicPropertyDetailDto.PhotoDto photo = new PublicPropertyDetailDto.PhotoDto(11L, "https://x", "caption");
        assertEquals(11L, photo.id());
        assertEquals("https://x", photo.url());
        assertEquals("caption", photo.caption());
    }

    // --- HostPublicDto.from ---

    @Test
    void hostPublicDto_from_nullUser_returnsNull() {
        assertNull(PublicPropertyDetailDto.HostPublicDto.from(null));
    }

    @Test
    void hostPublicDto_from_completeUser_setsFirstNameAndInitial() {
        User user = new User();
        user.setId(5L);
        user.setFirstName("Mohamed");
        user.setLastName("Mansouri");
        user.setProfilePictureUrl("https://external.com/avatar.jpg");

        PublicPropertyDetailDto.HostPublicDto host = PublicPropertyDetailDto.HostPublicDto.from(user);

        assertNotNull(host);
        assertEquals("Mohamed", host.firstName());
        assertEquals("M.", host.lastInitial());
        // External URL with http/https is returned as-is
        assertEquals("https://external.com/avatar.jpg", host.profilePictureUrl());
    }

    @Test
    void hostPublicDto_from_localStorageKey_buildsPublicEndpointPath() {
        User user = new User();
        user.setId(42L);
        user.setFirstName("Jean");
        user.setLastName("Dupont");
        user.setProfilePictureUrl("s3://bucket/key.jpg");

        PublicPropertyDetailDto.HostPublicDto host = PublicPropertyDetailDto.HostPublicDto.from(user);

        assertEquals("/api/public/host-avatar/42", host.profilePictureUrl());
    }

    @Test
    void hostPublicDto_from_nullLastName_initialIsNull() {
        User user = new User();
        user.setId(1L);
        user.setFirstName("Sami");
        user.setLastName(null);
        user.setProfilePictureUrl("https://avatar.png");

        PublicPropertyDetailDto.HostPublicDto host = PublicPropertyDetailDto.HostPublicDto.from(user);

        assertNotNull(host);
        assertEquals("Sami", host.firstName());
        assertNull(host.lastInitial());
    }

    @Test
    void hostPublicDto_from_blankLastName_initialIsNull() {
        User user = new User();
        user.setId(1L);
        user.setFirstName("Sami");
        user.setLastName("   ");
        user.setProfilePictureUrl(null);

        PublicPropertyDetailDto.HostPublicDto host = PublicPropertyDetailDto.HostPublicDto.from(user);

        assertNull(host.lastInitial());
        assertNull(host.profilePictureUrl());
    }

    @Test
    void hostPublicDto_from_blankAvatar_urlIsNull() {
        User user = new User();
        user.setId(1L);
        user.setFirstName("X");
        user.setLastName("Y");
        user.setProfilePictureUrl("");

        PublicPropertyDetailDto.HostPublicDto host = PublicPropertyDetailDto.HostPublicDto.from(user);

        assertNull(host.profilePictureUrl());
    }

    @Test
    void hostPublicDto_from_httpAvatarUrl_returnedAsIs() {
        User user = new User();
        user.setId(1L);
        user.setFirstName("X");
        user.setLastName("Y");
        user.setProfilePictureUrl("http://example.com/me.png");

        PublicPropertyDetailDto.HostPublicDto host = PublicPropertyDetailDto.HostPublicDto.from(user);

        assertEquals("http://example.com/me.png", host.profilePictureUrl());
    }

    // --- PublicPropertyDetailDto.from ---

    @Test
    void from_fullProperty_mapsAllFields() {
        Property p = baseProperty();
        p.setPhotos(new LinkedHashSet<>(java.util.List.of(makePhoto(1L, "https://x/1"), makePhoto(2L, "https://x/2"))));
        p.setAmenities("wifi, parking, pool");

        PublicPropertyDetailDto dto = PublicPropertyDetailDto.from(p);

        assertEquals(100L, dto.id());
        assertEquals("Test Property", dto.name());
        assertEquals("Lovely", dto.description());
        assertEquals("APARTMENT", dto.type());
        assertEquals("Lyon", dto.city());
        assertEquals("France", dto.country());
        assertEquals(new BigDecimal("45.0"), dto.latitude());
        assertEquals(new BigDecimal("4.8"), dto.longitude());
        assertEquals(3, dto.bedroomCount());
        assertEquals(2, dto.bathroomCount());
        assertEquals(6, dto.maxGuests());
        assertEquals(80, dto.squareMeters());
        assertEquals(new BigDecimal("120.00"), dto.nightlyPrice());
        assertEquals(2, dto.minimumNights());
        assertEquals("EUR", dto.currency());
        assertEquals(2, dto.photos().size());
        assertEquals(java.util.List.of("wifi", "parking", "pool"), dto.amenities());
        assertEquals("16:00", dto.checkInTime());
        assertEquals("11:00", dto.checkOutTime());
        assertNotNull(dto.host());
    }

    @Test
    void from_nullPhotos_returnsEmptyList() {
        Property p = baseProperty();
        p.setPhotos(null);
        p.setAmenities(null);

        PublicPropertyDetailDto dto = PublicPropertyDetailDto.from(p);

        assertNotNull(dto.photos());
        assertTrue(dto.photos().isEmpty());
        assertNull(dto.amenities());
    }

    @Test
    void from_blankAmenities_amenitiesIsNull() {
        Property p = baseProperty();
        p.setPhotos(null);
        p.setAmenities("   ");

        PublicPropertyDetailDto dto = PublicPropertyDetailDto.from(p);
        assertNull(dto.amenities());
    }

    @Test
    void from_jsonArrayAmenities_parsesQuotedStrings() {
        Property p = baseProperty();
        p.setPhotos(null);
        p.setAmenities("[\"wifi\",\"tv\",\"kitchen\"]");

        PublicPropertyDetailDto dto = PublicPropertyDetailDto.from(p);

        assertEquals(java.util.List.of("wifi", "tv", "kitchen"), dto.amenities());
    }

    @Test
    void from_csvAmenitiesWithSpaces_trimsAndIgnoresEmpty() {
        Property p = baseProperty();
        p.setPhotos(null);
        p.setAmenities(" wifi , , parking ");

        PublicPropertyDetailDto dto = PublicPropertyDetailDto.from(p);

        assertEquals(java.util.List.of("wifi", "parking"), dto.amenities());
    }

    @Test
    void from_nullPropertyType_typeStringIsNull() {
        Property p = baseProperty();
        p.setType(null);
        p.setPhotos(null);

        PublicPropertyDetailDto dto = PublicPropertyDetailDto.from(p);

        assertNull(dto.type());
    }

    // --- Helpers ---

    private Property baseProperty() {
        Property p = new Property();
        p.setId(100L);
        p.setName("Test Property");
        p.setDescription("Lovely");
        p.setType(PropertyType.APARTMENT);
        p.setCity("Lyon");
        p.setCountry("France");
        p.setLatitude(new BigDecimal("45.0"));
        p.setLongitude(new BigDecimal("4.8"));
        p.setBedroomCount(3);
        p.setBathroomCount(2);
        p.setMaxGuests(6);
        p.setSquareMeters(80);
        p.setNightlyPrice(new BigDecimal("120.00"));
        p.setMinimumNights(2);
        p.setDefaultCurrency("EUR");
        p.setDefaultCheckInTime("16:00");
        p.setDefaultCheckOutTime("11:00");
        User owner = new User();
        owner.setId(99L);
        owner.setFirstName("Alice");
        owner.setLastName("Bob");
        owner.setProfilePictureUrl("https://example.com/alice.png");
        p.setOwner(owner);
        return p;
    }

    private PropertyPhoto makePhoto(Long id, String externalUrl) {
        PropertyPhoto photo = new PropertyPhoto();
        photo.setId(id);
        photo.setExternalUrl(externalUrl);
        photo.setCaption("cap-" + id);
        return photo;
    }
}
