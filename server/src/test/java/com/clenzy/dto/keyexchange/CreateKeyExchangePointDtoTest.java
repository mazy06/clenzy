package com.clenzy.dto.keyexchange;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class CreateKeyExchangePointDtoTest {

    private static Validator validator;

    @BeforeAll
    static void setupValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    // --- Getters / Setters ---

    @Test
    void allGettersAndSetters_roundTrip() {
        CreateKeyExchangePointDto dto = new CreateKeyExchangePointDto();
        dto.setPropertyId(42L);
        dto.setProvider("KEYNEST");
        dto.setProviderStoreId("kn-store-123");
        dto.setGuardianType("MERCHANT");
        dto.setStoreName("Boulangerie du Coin");
        dto.setStoreAddress("12 rue Pasteur, Paris");
        dto.setStorePhone("+33123456789");
        dto.setStoreLat(48.8566);
        dto.setStoreLng(2.3522);
        dto.setStoreOpeningHours("Lun-Ven 7h-20h");

        assertEquals(42L, dto.getPropertyId());
        assertEquals("KEYNEST", dto.getProvider());
        assertEquals("kn-store-123", dto.getProviderStoreId());
        assertEquals("MERCHANT", dto.getGuardianType());
        assertEquals("Boulangerie du Coin", dto.getStoreName());
        assertEquals("12 rue Pasteur, Paris", dto.getStoreAddress());
        assertEquals("+33123456789", dto.getStorePhone());
        assertEquals(48.8566, dto.getStoreLat());
        assertEquals(2.3522, dto.getStoreLng());
        assertEquals("Lun-Ven 7h-20h", dto.getStoreOpeningHours());
    }

    @Test
    void defaultConstructor_allFieldsNull() {
        CreateKeyExchangePointDto dto = new CreateKeyExchangePointDto();
        assertNull(dto.getPropertyId());
        assertNull(dto.getProvider());
        assertNull(dto.getProviderStoreId());
        assertNull(dto.getGuardianType());
        assertNull(dto.getStoreName());
        assertNull(dto.getStoreAddress());
        assertNull(dto.getStorePhone());
        assertNull(dto.getStoreLat());
        assertNull(dto.getStoreLng());
        assertNull(dto.getStoreOpeningHours());
    }

    // --- Validation: positive case ---

    @Test
    void validation_validDto_noViolations() {
        CreateKeyExchangePointDto dto = createValidDto();
        Set<ConstraintViolation<CreateKeyExchangePointDto>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty(), () -> "Unexpected violations: " + violations);
    }

    // --- Validation: @NotNull propertyId ---

    @Test
    void validation_nullPropertyId_hasViolation() {
        CreateKeyExchangePointDto dto = createValidDto();
        dto.setPropertyId(null);
        Set<ConstraintViolation<CreateKeyExchangePointDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("propertyId")));
    }

    // --- Validation: @NotBlank provider ---

    @Test
    void validation_blankProvider_hasViolation() {
        CreateKeyExchangePointDto dto = createValidDto();
        dto.setProvider("");
        Set<ConstraintViolation<CreateKeyExchangePointDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("provider")));
    }

    @Test
    void validation_nullProvider_hasViolation() {
        CreateKeyExchangePointDto dto = createValidDto();
        dto.setProvider(null);
        Set<ConstraintViolation<CreateKeyExchangePointDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("provider")));
    }

    // --- Validation: @NotBlank + @Size(max=255) storeName ---

    @Test
    void validation_blankStoreName_hasViolation() {
        CreateKeyExchangePointDto dto = createValidDto();
        dto.setStoreName("");
        Set<ConstraintViolation<CreateKeyExchangePointDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("storeName")));
    }

    @Test
    void validation_storeNameAt255_noViolation() {
        CreateKeyExchangePointDto dto = createValidDto();
        dto.setStoreName("a".repeat(255));
        Set<ConstraintViolation<CreateKeyExchangePointDto>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    @Test
    void validation_storeNameOver255_hasViolation() {
        CreateKeyExchangePointDto dto = createValidDto();
        dto.setStoreName("a".repeat(256));
        Set<ConstraintViolation<CreateKeyExchangePointDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("storeName")));
    }

    // --- Validation: @Size(max=500) storeAddress ---

    @Test
    void validation_storeAddressOver500_hasViolation() {
        CreateKeyExchangePointDto dto = createValidDto();
        dto.setStoreAddress("a".repeat(501));
        Set<ConstraintViolation<CreateKeyExchangePointDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("storeAddress")));
    }

    @Test
    void validation_nullStoreAddress_noViolation() {
        // storeAddress is optional (no @NotBlank)
        CreateKeyExchangePointDto dto = createValidDto();
        dto.setStoreAddress(null);
        Set<ConstraintViolation<CreateKeyExchangePointDto>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    // --- Validation: @Size(max=50) storePhone ---

    @Test
    void validation_storePhoneOver50_hasViolation() {
        CreateKeyExchangePointDto dto = createValidDto();
        dto.setStorePhone("9".repeat(51));
        Set<ConstraintViolation<CreateKeyExchangePointDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("storePhone")));
    }

    // --- Helpers ---

    private CreateKeyExchangePointDto createValidDto() {
        CreateKeyExchangePointDto dto = new CreateKeyExchangePointDto();
        dto.setPropertyId(1L);
        dto.setProvider("CLENZY_KEYVAULT");
        dto.setStoreName("Magasin");
        return dto;
    }
}
