package com.clenzy.dto;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class GdprExportDtoTest {

    @Test
    void defaultConstructor_setsPlatformToClenzyPms() {
        GdprExportDto dto = new GdprExportDto();
        assertEquals("Clenzy PMS", dto.getPlatform());
    }

    @Test
    void userDataSection_gettersAndSetters() {
        GdprExportDto.UserDataSection section = new GdprExportDto.UserDataSection();
        LocalDateTime now = LocalDateTime.now();

        section.setId(1L);
        section.setFirstName("Jean");
        section.setLastName("Dupont");
        section.setEmail("jean@test.com");
        section.setPhoneNumber("+33600000000");
        section.setRole("MANAGER");
        section.setStatus("ACTIVE");
        section.setProfilePictureUrl("https://img.test/pic.jpg");
        section.setEmailVerified(true);
        section.setPhoneVerified(false);
        section.setLastLogin(now);
        section.setCreatedAt(now);

        assertEquals(1L, section.getId());
        assertEquals("Jean", section.getFirstName());
        assertEquals("Dupont", section.getLastName());
        assertEquals("jean@test.com", section.getEmail());
        assertEquals("+33600000000", section.getPhoneNumber());
        assertEquals("MANAGER", section.getRole());
        assertEquals("ACTIVE", section.getStatus());
        assertEquals("https://img.test/pic.jpg", section.getProfilePictureUrl());
        assertTrue(section.getEmailVerified());
        assertFalse(section.getPhoneVerified());
        assertEquals(now, section.getLastLogin());
        assertEquals(now, section.getCreatedAt());
    }

    @Test
    void propertyDataSection_gettersAndSetters() {
        GdprExportDto.PropertyDataSection section = new GdprExportDto.PropertyDataSection();
        LocalDateTime now = LocalDateTime.now();

        section.setId(10L);
        section.setName("Appartement Paris");
        section.setAddress("12 Rue de la Paix");
        section.setCity("Paris");
        section.setPostalCode("75001");
        section.setCountry("France");
        section.setCreatedAt(now);

        assertEquals(10L, section.getId());
        assertEquals("Appartement Paris", section.getName());
        assertEquals("12 Rue de la Paix", section.getAddress());
        assertEquals("Paris", section.getCity());
        assertEquals("75001", section.getPostalCode());
        assertEquals("France", section.getCountry());
        assertEquals(now, section.getCreatedAt());
    }

    @Test
    void consentDataSection_gettersAndSetters() {
        GdprExportDto.ConsentDataSection section = new GdprExportDto.ConsentDataSection();
        LocalDateTime grantedAt = LocalDateTime.of(2026, 1, 1, 10, 0);
        LocalDateTime revokedAt = LocalDateTime.of(2026, 6, 1, 10, 0);

        section.setConsentType("marketing");
        section.setGranted(true);
        section.setVersion(2);
        section.setGrantedAt(grantedAt);
        section.setRevokedAt(revokedAt);

        assertEquals("marketing", section.getConsentType());
        assertTrue(section.isGranted());
        assertEquals(2, section.getVersion());
        assertEquals(grantedAt, section.getGrantedAt());
        assertEquals(revokedAt, section.getRevokedAt());
    }

    @Test
    void auditDataSection_gettersAndSetters() {
        GdprExportDto.AuditDataSection section = new GdprExportDto.AuditDataSection();

        section.setAction("LOGIN");
        section.setEntityType("User");
        section.setEntityId("42");
        section.setDetails("User logged in");
        section.setTimestamp("2026-01-15T10:00:00");

        assertEquals("LOGIN", section.getAction());
        assertEquals("User", section.getEntityType());
        assertEquals("42", section.getEntityId());
        assertEquals("User logged in", section.getDetails());
        assertEquals("2026-01-15T10:00:00", section.getTimestamp());
    }

    @Test
    void fullObjectGraph_constructionAndAccess() {
        GdprExportDto dto = new GdprExportDto();
        dto.setExportDate("2026-01-15");

        GdprExportDto.UserDataSection userData = new GdprExportDto.UserDataSection();
        userData.setId(1L);
        userData.setFirstName("Jean");
        dto.setPersonalData(userData);

        GdprExportDto.PropertyDataSection prop = new GdprExportDto.PropertyDataSection();
        prop.setId(10L);
        prop.setName("Appartement");
        dto.setProperties(List.of(prop));

        GdprExportDto.ConsentDataSection consent = new GdprExportDto.ConsentDataSection();
        consent.setConsentType("terms");
        consent.setGranted(true);
        dto.setConsents(List.of(consent));

        GdprExportDto.AuditDataSection audit = new GdprExportDto.AuditDataSection();
        audit.setAction("LOGIN");
        dto.setActivityLog(List.of(audit));

        assertEquals("Clenzy PMS", dto.getPlatform());
        assertEquals("2026-01-15", dto.getExportDate());
        assertNotNull(dto.getPersonalData());
        assertEquals(1L, dto.getPersonalData().getId());
        assertEquals(1, dto.getProperties().size());
        assertEquals(1, dto.getConsents().size());
        assertEquals(1, dto.getActivityLog().size());
    }
}
