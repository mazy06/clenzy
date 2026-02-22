package com.clenzy.service.messaging;

import com.clenzy.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class TemplateInterpolationServiceTest {

    private TemplateInterpolationService service;

    private Property property;
    private Reservation reservation;
    private Guest guest;
    private MessageTemplate template;
    private CheckInInstructions instructions;

    @BeforeEach
    void setUp() {
        service = new TemplateInterpolationService();

        property = new Property();
        property.setId(1L);
        property.setName("Studio Riviera");
        property.setAddress("12 rue de la Paix");
        property.setCity("Paris");
        property.setPostalCode("75002");
        property.setDefaultCheckInTime("15:00");
        property.setDefaultCheckOutTime("11:00");

        reservation = new Reservation();
        reservation.setId(1L);
        reservation.setProperty(property);
        reservation.setCheckIn(LocalDate.of(2026, 3, 15));
        reservation.setCheckOut(LocalDate.of(2026, 3, 20));
        reservation.setGuestName("Jean Dupont");
        reservation.setConfirmationCode("ABC123");

        guest = new Guest();
        guest.setFirstName("Jean");
        guest.setLastName("Dupont");
        guest.setEmail("jean@example.com");

        template = new MessageTemplate();
        template.setSubject("Bienvenue {guestName}");
        template.setBody("Bonjour {guestFirstName}, votre arrivee a {propertyName} est le {checkInDate} a {checkInTime}.");

        instructions = new CheckInInstructions();
        instructions.setAccessCode("1234");
        instructions.setWifiName("Studio-Wifi");
        instructions.setWifiPassword("secret123");
        instructions.setArrivalInstructions("Prendre l'ascenseur");
    }

    @Test
    void whenInterpolating_thenGuestNameIsReplaced() {
        var result = service.interpolate(template, reservation, guest, property, instructions);

        assertEquals("Bienvenue Jean Dupont", result.subject());
        assertTrue(result.plainBody().contains("Bonjour Jean"));
    }

    @Test
    void whenInterpolating_thenDatesAreFormatted() {
        var result = service.interpolate(template, reservation, guest, property, instructions);

        assertTrue(result.plainBody().contains("15/03/2026"));
    }

    @Test
    void whenInterpolating_thenPropertyNameIsReplaced() {
        var result = service.interpolate(template, reservation, guest, property, instructions);

        assertTrue(result.plainBody().contains("Studio Riviera"));
    }

    @Test
    void whenInterpolating_thenCheckInTimeUsesDefault() {
        var result = service.interpolate(template, reservation, guest, property, instructions);

        assertTrue(result.plainBody().contains("15:00"));
    }

    @Test
    void whenReservationHasCheckInTimeOverride_thenOverrideIsUsed() {
        reservation.setCheckInTime("16:30");
        template.setBody("Arrivee a {checkInTime}");

        var result = service.interpolate(template, reservation, guest, property, instructions);

        assertTrue(result.plainBody().contains("16:30"));
    }

    @Test
    void whenGuestIsNull_thenFallbackToReservationGuestName() {
        var result = service.interpolate(template, reservation, null, property, instructions);

        assertEquals("Bienvenue Jean Dupont", result.subject());
    }

    @Test
    void whenGuestIsNull_thenFirstNameIsEmpty() {
        template.setBody("Prenom: [{guestFirstName}]");

        var result = service.interpolate(template, reservation, null, property, instructions);

        assertTrue(result.plainBody().contains("Prenom: []"));
    }

    @Test
    void whenInstructionsAreNull_thenAccessCodeIsEmpty() {
        template.setBody("Code: [{accessCode}]");

        var result = service.interpolate(template, reservation, guest, property, null);

        assertTrue(result.plainBody().contains("Code: []"));
    }

    @Test
    void whenInstructionsProvided_thenAccessCodeIsInterpolated() {
        template.setBody("Code: {accessCode}");

        var result = service.interpolate(template, reservation, guest, property, instructions);

        assertTrue(result.plainBody().contains("Code: 1234"));
    }

    @Test
    void whenHtmlBody_thenSpecialCharsAreEscaped() {
        guest.setFirstName("<script>");
        template.setBody("Hi {guestFirstName}");

        var result = service.interpolate(template, reservation, guest, property, instructions);

        // HTML body should escape
        assertTrue(result.htmlBody().contains("&lt;script&gt;"));
        // Plain body should NOT escape
        assertTrue(result.plainBody().contains("<script>"));
    }

    @Test
    void whenUnknownVariable_thenKeptAsIs() {
        template.setBody("Value: {unknownVar}");

        var result = service.interpolate(template, reservation, guest, property, instructions);

        assertTrue(result.plainBody().contains("{unknownVar}"));
    }

    @Test
    void whenNullTemplate_thenEmptyResult() {
        template.setSubject(null);
        template.setBody(null);

        var result = service.interpolate(template, reservation, guest, property, instructions);

        assertEquals("", result.subject());
        assertEquals("", result.plainBody());
    }

    @Test
    void whenConfirmationCode_thenInterpolated() {
        template.setBody("Code: {confirmationCode}");

        var result = service.interpolate(template, reservation, guest, property, instructions);

        assertTrue(result.plainBody().contains("Code: ABC123"));
    }

    @Test
    void supportedVariables_containsAllExpectedKeys() {
        var keys = TemplateInterpolationService.SUPPORTED_VARIABLES.stream()
            .map(TemplateInterpolationService.TemplateVariable::key)
            .toList();

        assertTrue(keys.contains("guestName"));
        assertTrue(keys.contains("checkInDate"));
        assertTrue(keys.contains("accessCode"));
        assertTrue(keys.contains("wifiPassword"));
        assertTrue(keys.contains("confirmationCode"));
        assertEquals(17, keys.size());
    }
}
