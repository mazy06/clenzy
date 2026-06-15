package com.clenzy.booking.dto;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.model.PropertyType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PublicPropertyDtoTest {

    @Test
    void recordAccessors_returnAllConstructorValues() {
        PublicPropertyDto dto = new PublicPropertyDto(
                1L, "Loft", "LOFT", "Paris", "France",
                2, 1, 4, 50,
                new BigDecimal("100.00"), new BigDecimal("30.00"),
                2, "EUR", "https://main",
                List.of("https://p1", "https://p2"),
                List.of("wifi"), "15:00", "11:00",
                7, 12
        );

        assertEquals(1L, dto.id());
        assertEquals("Loft", dto.name());
        assertEquals("LOFT", dto.type());
        assertEquals("Paris", dto.city());
        assertEquals("France", dto.country());
        assertEquals(2, dto.bedroomCount());
        assertEquals(1, dto.bathroomCount());
        assertEquals(4, dto.maxGuests());
        assertEquals(50, dto.squareMeters());
        assertEquals(new BigDecimal("100.00"), dto.priceFrom());
        assertEquals(new BigDecimal("30.00"), dto.cleaningFee());
        assertEquals(2, dto.minimumNights());
        assertEquals("EUR", dto.currency());
        assertEquals("https://main", dto.mainPhotoUrl());
        assertEquals(List.of("https://p1", "https://p2"), dto.photoUrls());
        assertEquals(List.of("wifi"), dto.amenities());
        assertEquals("15:00", dto.checkInTime());
        assertEquals("11:00", dto.checkOutTime());
        assertEquals(7, dto.totalBookings());
        assertEquals(12, dto.availableDays30());
    }

    @Test
    void from_fullProperty_mapsAllFields() {
        Property p = baseProperty();
        p.setPhotos(new LinkedHashSet<>(List.of(makePhoto(1L, "https://x/1"), makePhoto(2L, "https://x/2"))));
        p.setAmenities("wifi, parking");

        PublicPropertyDto dto = PublicPropertyDto.from(p);

        assertEquals(11L, dto.id());
        assertEquals("My Cottage", dto.name());
        assertEquals("COTTAGE", dto.type());
        assertEquals("Marseille", dto.city());
        assertEquals("France", dto.country());
        assertEquals(2, dto.bedroomCount());
        assertEquals(1, dto.bathroomCount());
        assertEquals(4, dto.maxGuests());
        assertEquals(50, dto.squareMeters());
        assertEquals(new BigDecimal("90.50"), dto.priceFrom());
        assertEquals(new BigDecimal("25.00"), dto.cleaningFee());
        assertEquals(3, dto.minimumNights());
        assertEquals("EUR", dto.currency());
        assertNotNull(dto.mainPhotoUrl());
        assertEquals(2, dto.photoUrls().size());
        assertEquals(List.of("wifi", "parking"), dto.amenities());
        assertEquals("16:00", dto.checkInTime());
        assertEquals("11:00", dto.checkOutTime());
    }

    @Test
    void from_nullPhotos_mainPhotoIsNullAndUrlsIsEmpty() {
        Property p = baseProperty();
        p.setPhotos(null);
        p.setAmenities(null);

        PublicPropertyDto dto = PublicPropertyDto.from(p);

        assertNull(dto.mainPhotoUrl());
        assertNotNull(dto.photoUrls());
        assertTrue(dto.photoUrls().isEmpty());
        assertNull(dto.amenities());
    }

    @Test
    void from_blankAmenities_amenitiesIsNull() {
        Property p = baseProperty();
        p.setPhotos(null);
        p.setAmenities("");

        PublicPropertyDto dto = PublicPropertyDto.from(p);
        assertNull(dto.amenities());
    }

    @Test
    void from_jsonArrayAmenities_parsesQuotedStrings() {
        Property p = baseProperty();
        p.setPhotos(null);
        p.setAmenities("[\"wifi\",\"tv\"]");

        PublicPropertyDto dto = PublicPropertyDto.from(p);

        assertEquals(List.of("wifi", "tv"), dto.amenities());
    }

    @Test
    void from_csvAmenitiesWithSpaces_trimsAndIgnoresEmpty() {
        Property p = baseProperty();
        p.setPhotos(null);
        p.setAmenities(" wifi ,, tv ");

        PublicPropertyDto dto = PublicPropertyDto.from(p);

        assertEquals(List.of("wifi", "tv"), dto.amenities());
    }

    @Test
    void from_nullPropertyType_typeStringIsNull() {
        Property p = baseProperty();
        p.setType(null);
        p.setPhotos(null);

        PublicPropertyDto dto = PublicPropertyDto.from(p);

        assertNull(dto.type());
    }

    // --- Helpers ---

    private Property baseProperty() {
        Property p = new Property();
        p.setId(11L);
        p.setName("My Cottage");
        p.setType(PropertyType.COTTAGE);
        p.setCity("Marseille");
        p.setCountry("France");
        p.setBedroomCount(2);
        p.setBathroomCount(1);
        p.setMaxGuests(4);
        p.setSquareMeters(50);
        p.setNightlyPrice(new BigDecimal("90.50"));
        p.setCleaningBasePrice(new BigDecimal("25.00"));
        p.setMinimumNights(3);
        p.setDefaultCurrency("EUR");
        p.setDefaultCheckInTime("16:00");
        p.setDefaultCheckOutTime("11:00");
        return p;
    }

    private PropertyPhoto makePhoto(Long id, String externalUrl) {
        PropertyPhoto photo = new PropertyPhoto();
        photo.setId(id);
        photo.setExternalUrl(externalUrl);
        return photo;
    }
}
