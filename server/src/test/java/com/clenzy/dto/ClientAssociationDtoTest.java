package com.clenzy.dto;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ClientAssociationDtoTest {

    @Test
    void defaultConstructor_allFieldsNull() {
        ClientAssociationDto dto = new ClientAssociationDto();
        assertNull(dto.getId());
        assertNull(dto.getFirstName());
        assertNull(dto.getLastName());
        assertNull(dto.getEmail());
        assertNull(dto.getPhoneNumber());
        assertNull(dto.getRole());
        assertNull(dto.getAssignedAt());
        assertNull(dto.getNotes());
        assertNull(dto.getPortfolioId());
        assertNull(dto.getPortfolioName());
    }

    @Test
    void allArgsConstructor_setsAllFields() {
        ClientAssociationDto dto = new ClientAssociationDto(
            1L, "Jean", "Dupont", "j@example.com",
            "+33600000000", "OWNER", "2024-01-01T00:00:00", "VIP client",
            10L, "Portfolio A"
        );

        assertEquals(1L, dto.getId());
        assertEquals("Jean", dto.getFirstName());
        assertEquals("Dupont", dto.getLastName());
        assertEquals("j@example.com", dto.getEmail());
        assertEquals("+33600000000", dto.getPhoneNumber());
        assertEquals("OWNER", dto.getRole());
        assertEquals("2024-01-01T00:00:00", dto.getAssignedAt());
        assertEquals("VIP client", dto.getNotes());
        assertEquals(10L, dto.getPortfolioId());
        assertEquals("Portfolio A", dto.getPortfolioName());
    }

    @Test
    void setters_overrideValues() {
        ClientAssociationDto dto = new ClientAssociationDto();
        dto.setId(2L);
        dto.setFirstName("Marie");
        dto.setLastName("Curie");
        dto.setEmail("m@x.com");
        dto.setPhoneNumber("00000");
        dto.setRole("MANAGER");
        dto.setAssignedAt("now");
        dto.setNotes("notes");
        dto.setPortfolioId(99L);
        dto.setPortfolioName("Portfolio Beta");

        assertEquals(2L, dto.getId());
        assertEquals("Marie", dto.getFirstName());
        assertEquals("Curie", dto.getLastName());
        assertEquals("m@x.com", dto.getEmail());
        assertEquals("00000", dto.getPhoneNumber());
        assertEquals("MANAGER", dto.getRole());
        assertEquals("now", dto.getAssignedAt());
        assertEquals("notes", dto.getNotes());
        assertEquals(99L, dto.getPortfolioId());
        assertEquals("Portfolio Beta", dto.getPortfolioName());
    }

    @Test
    void allArgsConstructor_supportsNullableFields() {
        ClientAssociationDto dto = new ClientAssociationDto(
            null, null, null, null, null, null, null, null, null, null
        );
        assertNull(dto.getId());
        assertNull(dto.getFirstName());
        assertNull(dto.getEmail());
        assertNull(dto.getPortfolioId());
    }
}
