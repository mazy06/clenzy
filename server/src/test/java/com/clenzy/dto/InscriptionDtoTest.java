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
    void validation_passwordField_isOptional() {
        // Le mot de passe n'est plus requis a l'inscription (defini apres confirmation email)
        InscriptionDto dto = createValidDto();
        dto.setPassword(null);
        Set<ConstraintViolation<InscriptionDto>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
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
        dto.setAcceptedTerms(true); // CGU obligatoires (validation @AssertTrue)
        return dto;
    }

    // --- Validation : CGU + attribution (champs ajoutes pour le consentement RGPD) ---

    @Test
    void validation_termsNotAccepted_hasViolation() {
        InscriptionDto dto = createValidDto();
        dto.setAcceptedTerms(false);
        Set<ConstraintViolation<InscriptionDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("termsAccepted")));
    }

    @Test
    void validation_validReferralSource_noViolation() {
        InscriptionDto dto = createValidDto();
        dto.setReferralSource("google");
        Set<ConstraintViolation<InscriptionDto>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    @Test
    void validation_invalidReferralSource_hasViolation() {
        InscriptionDto dto = createValidDto();
        dto.setReferralSource("not-a-valid-source");
        Set<ConstraintViolation<InscriptionDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("referralSourceValid")));
    }

    @Test
    void validation_nullReferralSource_noViolation() {
        // referralSource est optionnel — null doit etre accepte
        InscriptionDto dto = createValidDto();
        dto.setReferralSource(null);
        Set<ConstraintViolation<InscriptionDto>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    @Test
    void setPromoCode_normalizesToUpperCase() {
        InscriptionDto dto = new InscriptionDto();
        dto.setPromoCode(" promo123 ");
        assertEquals("PROMO123", dto.getPromoCode());
    }

    @Test
    void setPromoCode_blankBecomesNull() {
        InscriptionDto dto = new InscriptionDto();
        dto.setPromoCode("   ");
        assertEquals(null, dto.getPromoCode());
    }

    @Test
    void setReferralSource_normalizesToLowerCase() {
        InscriptionDto dto = new InscriptionDto();
        dto.setReferralSource(" GOOGLE ");
        assertEquals("google", dto.getReferralSource());
    }

    // --- Additional accessor coverage ---

    @Test
    void allSettersAndGetters_roundTrip() {
        InscriptionDto dto = new InscriptionDto();
        dto.setPhone("+33");
        dto.setCompanyName("Acme");
        dto.setOrganizationType("CONCIERGE");
        dto.setCity("Paris");
        dto.setPostalCode("75001");
        dto.setPropertyType("apartment");
        dto.setPropertyCount(5);
        dto.setSurface(80);
        dto.setGuestCapacity(4);
        dto.setBookingFrequency("often");
        dto.setCleaningSchedule("weekly");
        dto.setCalendarSync("ical");
        dto.setServices(java.util.List.of("cleaning"));
        dto.setServicesDevis(java.util.List.of("laundry"));
        dto.setNewsletterOptIn(true);

        assertEquals("+33", dto.getPhone());
        assertEquals("Acme", dto.getCompanyName());
        assertEquals("CONCIERGE", dto.getOrganizationType());
        assertEquals("Paris", dto.getCity());
        assertEquals("75001", dto.getPostalCode());
        assertEquals("apartment", dto.getPropertyType());
        assertEquals(5, dto.getPropertyCount());
        assertEquals(80, dto.getSurface());
        assertEquals(4, dto.getGuestCapacity());
        assertEquals("often", dto.getBookingFrequency());
        assertEquals("weekly", dto.getCleaningSchedule());
        assertEquals("ical", dto.getCalendarSync());
        assertEquals(java.util.List.of("cleaning"), dto.getServices());
        assertEquals(java.util.List.of("laundry"), dto.getServicesDevis());
        assertTrue(dto.isNewsletterOptIn());
    }

    @Test
    void getOrganizationTypeEnum_validValue() {
        InscriptionDto dto = new InscriptionDto();
        dto.setOrganizationType("CONCIERGE");
        assertEquals(com.clenzy.model.OrganizationType.CONCIERGE, dto.getOrganizationTypeEnum());
    }

    @Test
    void getOrganizationTypeEnum_invalidValue_returnsIndividual() {
        InscriptionDto dto = new InscriptionDto();
        dto.setOrganizationType("BOGUS");
        assertEquals(com.clenzy.model.OrganizationType.INDIVIDUAL, dto.getOrganizationTypeEnum());
    }

    @Test
    void getOrganizationTypeEnum_null_returnsIndividual() {
        InscriptionDto dto = new InscriptionDto();
        dto.setOrganizationType(null);
        assertEquals(com.clenzy.model.OrganizationType.INDIVIDUAL, dto.getOrganizationTypeEnum());
    }

    @Test
    void getOrganizationTypeEnum_blank_returnsIndividual() {
        InscriptionDto dto = new InscriptionDto();
        dto.setOrganizationType("");
        assertEquals(com.clenzy.model.OrganizationType.INDIVIDUAL, dto.getOrganizationTypeEnum());
    }

    @Test
    void setPromoCode_null_isNull() {
        InscriptionDto dto = new InscriptionDto();
        dto.setPromoCode(null);
        assertNull(dto.getPromoCode());
    }

    @Test
    void setReferralSource_null_isNull() {
        InscriptionDto dto = new InscriptionDto();
        dto.setReferralSource(null);
        assertNull(dto.getReferralSource());
    }

    @Test
    void toString_includesKeyFields() {
        InscriptionDto dto = createValidDto();
        dto.setCity("Lyon");
        String s = dto.toString();
        assertTrue(s.contains("Jean Dupont"));
        assertTrue(s.contains("jean@example.com"));
        assertTrue(s.contains("essentiel"));
        assertTrue(s.contains("Lyon"));
    }

    @Test
    void allowedReferralSources_includesAllExpected() {
        assertTrue(InscriptionDto.ALLOWED_REFERRAL_SOURCES.contains("google"));
        assertTrue(InscriptionDto.ALLOWED_REFERRAL_SOURCES.contains("social"));
        assertTrue(InscriptionDto.ALLOWED_REFERRAL_SOURCES.contains("word_of_mouth"));
        assertTrue(InscriptionDto.ALLOWED_REFERRAL_SOURCES.contains("press"));
        assertTrue(InscriptionDto.ALLOWED_REFERRAL_SOURCES.contains("partner"));
        assertTrue(InscriptionDto.ALLOWED_REFERRAL_SOURCES.contains("other"));
    }
}
