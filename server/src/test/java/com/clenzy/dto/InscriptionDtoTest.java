package com.clenzy.dto;

import com.clenzy.model.BillingPeriod;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class InscriptionDtoTest {

    private static Validator validator;

    @BeforeAll
    static void setupValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    // --- getFirstName ---

    @Test
    void getFirstName_withTwoWords_returnsFirstWord() {
        InscriptionDto dto = new InscriptionDto();
        dto.setFullName("Jean Dupont");
        assertEquals("Jean", dto.getFirstName());
    }

    @Test
    void getFirstName_withSingleWord_returnsThatWord() {
        InscriptionDto dto = new InscriptionDto();
        dto.setFullName("Jean");
        assertEquals("Jean", dto.getFirstName());
    }

    @Test
    void getFirstName_withNull_returnsEmpty() {
        InscriptionDto dto = new InscriptionDto();
        dto.setFullName(null);
        assertEquals("", dto.getFirstName());
    }

    @Test
    void getFirstName_withBlank_returnsEmpty() {
        InscriptionDto dto = new InscriptionDto();
        dto.setFullName("  ");
        assertEquals("", dto.getFirstName());
    }

    // --- getLastName ---

    @Test
    void getLastName_withThreeWords_returnsAllAfterFirst() {
        InscriptionDto dto = new InscriptionDto();
        dto.setFullName("Jean Dupont Martin");
        assertEquals("Dupont Martin", dto.getLastName());
    }

    @Test
    void getLastName_withTwoWords_returnsSecondWord() {
        InscriptionDto dto = new InscriptionDto();
        dto.setFullName("Jean Dupont");
        assertEquals("Dupont", dto.getLastName());
    }

    @Test
    void getLastName_withSingleWord_returnsThatWord() {
        InscriptionDto dto = new InscriptionDto();
        dto.setFullName("Jean");
        assertEquals("Jean", dto.getLastName());
    }

    @Test
    void getLastName_withNull_returnsEmpty() {
        InscriptionDto dto = new InscriptionDto();
        dto.setFullName(null);
        assertEquals("", dto.getLastName());
    }

    // --- getForfaitDisplayName ---

    @Test
    void getForfaitDisplayName_essentiel() {
        InscriptionDto dto = new InscriptionDto();
        dto.setForfait("essentiel");
        assertEquals("Essentiel", dto.getForfaitDisplayName());
    }

    @Test
    void getForfaitDisplayName_confort() {
        InscriptionDto dto = new InscriptionDto();
        dto.setForfait("confort");
        assertEquals("Confort", dto.getForfaitDisplayName());
    }

    @Test
    void getForfaitDisplayName_premium() {
        InscriptionDto dto = new InscriptionDto();
        dto.setForfait("premium");
        assertEquals("Premium", dto.getForfaitDisplayName());
    }

    @Test
    void getForfaitDisplayName_null_returnsInconnu() {
        InscriptionDto dto = new InscriptionDto();
        dto.setForfait(null);
        assertEquals("Inconnu", dto.getForfaitDisplayName());
    }

    @Test
    void getForfaitDisplayName_unknown_returnsAsIs() {
        InscriptionDto dto = new InscriptionDto();
        dto.setForfait("custom");
        assertEquals("custom", dto.getForfaitDisplayName());
    }

    // --- getInscriptionPriceInCents ---

    @Test
    void getInscriptionPriceInCents_monthly() {
        InscriptionDto dto = new InscriptionDto();
        dto.setBillingPeriod("MONTHLY");
        assertEquals(500, dto.getInscriptionPriceInCents());
    }

    @Test
    void getInscriptionPriceInCents_annual() {
        InscriptionDto dto = new InscriptionDto();
        dto.setBillingPeriod("ANNUAL");
        assertEquals(4800, dto.getInscriptionPriceInCents());
    }

    @Test
    void getInscriptionPriceInCents_biennial() {
        InscriptionDto dto = new InscriptionDto();
        dto.setBillingPeriod("BIENNIAL");
        assertEquals(7800, dto.getInscriptionPriceInCents());
    }

    // --- getBillingPeriodEnum ---

    @Test
    void getBillingPeriodEnum_defaultIsMonthly() {
        InscriptionDto dto = new InscriptionDto();
        assertEquals(BillingPeriod.MONTHLY, dto.getBillingPeriodEnum());
    }

    // --- Validation ---

    @Test
    void validation_validDto_noViolations() {
        InscriptionDto dto = createValidDto();
        Set<ConstraintViolation<InscriptionDto>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    @Test
    void validation_blankFullName_hasViolation() {
        InscriptionDto dto = createValidDto();
        dto.setFullName("");
        Set<ConstraintViolation<InscriptionDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("fullName")));
    }

    @Test
    void validation_invalidEmail_hasViolation() {
        InscriptionDto dto = createValidDto();
        dto.setEmail("not-an-email");
        Set<ConstraintViolation<InscriptionDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("email")));
    }

    @Test
    void validation_shortPassword_hasViolation() {
        InscriptionDto dto = createValidDto();
        dto.setPassword("1234567");
        Set<ConstraintViolation<InscriptionDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("password")));
    }

    // --- PMS_SUBSCRIPTION_PRICE_CENTS ---

    @Test
    void pmsSubscriptionPriceCents_isFiveHundred() {
        assertEquals(500, InscriptionDto.PMS_SUBSCRIPTION_PRICE_CENTS);
    }

    // --- Helpers ---

    private InscriptionDto createValidDto() {
        InscriptionDto dto = new InscriptionDto();
        dto.setFullName("Jean Dupont");
        dto.setEmail("jean@example.com");
        dto.setPassword("securepass");
        dto.setForfait("essentiel");
        return dto;
    }
}
