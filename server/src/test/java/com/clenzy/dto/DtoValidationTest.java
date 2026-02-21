package com.clenzy.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class DtoValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setupValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    // --- CreateUserDto ---

    @Test
    void createUserDto_valid_noViolations() {
        CreateUserDto dto = new CreateUserDto("Jean", "Dupont", "jean@example.com", "securepass", "MANAGER");
        Set<ConstraintViolation<CreateUserDto>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    @Test
    void createUserDto_blankFirstName_hasViolation() {
        CreateUserDto dto = new CreateUserDto("", "Dupont", "jean@example.com", "securepass", "MANAGER");
        Set<ConstraintViolation<CreateUserDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("firstName")));
    }

    @Test
    void createUserDto_invalidEmail_hasViolation() {
        CreateUserDto dto = new CreateUserDto("Jean", "Dupont", "not-an-email", "securepass", "MANAGER");
        Set<ConstraintViolation<CreateUserDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("email")));
    }

    @Test
    void createUserDto_shortPassword_hasViolation() {
        CreateUserDto dto = new CreateUserDto("Jean", "Dupont", "jean@example.com", "1234567", "MANAGER");
        Set<ConstraintViolation<CreateUserDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("password")));
    }

    // --- SendInvitationRequest ---

    @Test
    void sendInvitationRequest_valid_noViolations() {
        SendInvitationRequest dto = new SendInvitationRequest();
        dto.setEmail("invite@example.com");
        Set<ConstraintViolation<SendInvitationRequest>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    @Test
    void sendInvitationRequest_blankEmail_hasViolation() {
        SendInvitationRequest dto = new SendInvitationRequest();
        dto.setEmail("");
        Set<ConstraintViolation<SendInvitationRequest>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("email")));
    }

    @Test
    void sendInvitationRequest_invalidEmail_hasViolation() {
        SendInvitationRequest dto = new SendInvitationRequest();
        dto.setEmail("invalid-email");
        Set<ConstraintViolation<SendInvitationRequest>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("email")));
    }

    // --- PaymentSessionRequest ---

    @Test
    void paymentSessionRequest_valid_noViolations() {
        PaymentSessionRequest dto = new PaymentSessionRequest();
        dto.setInterventionId(1L);
        dto.setAmount(BigDecimal.valueOf(50.00));
        Set<ConstraintViolation<PaymentSessionRequest>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    @Test
    void paymentSessionRequest_nullAmount_hasViolation() {
        PaymentSessionRequest dto = new PaymentSessionRequest();
        dto.setInterventionId(1L);
        dto.setAmount(null);
        Set<ConstraintViolation<PaymentSessionRequest>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("amount")));
    }

    @Test
    void paymentSessionRequest_negativeAmount_hasViolation() {
        PaymentSessionRequest dto = new PaymentSessionRequest();
        dto.setInterventionId(1L);
        dto.setAmount(BigDecimal.valueOf(-10));
        Set<ConstraintViolation<PaymentSessionRequest>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("amount")));
    }

    // --- InscriptionDto ---

    @Test
    void inscriptionDto_valid_noViolations() {
        InscriptionDto dto = new InscriptionDto();
        dto.setFullName("Jean Dupont");
        dto.setEmail("jean@example.com");
        dto.setPassword("securepass");
        dto.setForfait("essentiel");
        Set<ConstraintViolation<InscriptionDto>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    @Test
    void inscriptionDto_shortFullName_hasViolation() {
        InscriptionDto dto = new InscriptionDto();
        dto.setFullName("JD");
        dto.setEmail("jean@example.com");
        dto.setPassword("securepass");
        dto.setForfait("essentiel");
        Set<ConstraintViolation<InscriptionDto>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("fullName")));
    }
}
