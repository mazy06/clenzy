package com.clenzy.dto;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class OrganizationDtoTest {

    @Test
    void defaultConstructor_allNullsAndZeros() {
        OrganizationDto dto = new OrganizationDto();

        assertNull(dto.getId());
        assertNull(dto.getName());
        assertNull(dto.getSlug());
        assertNull(dto.getType());
        assertEquals(0, dto.getMemberCount());
        assertNull(dto.getCreatedAt());
        assertNull(dto.getUpdatedAt());
    }

    @Test
    void fiveArgConstructor_setsBasicFields() {
        OrganizationDto dto = new OrganizationDto(1L, "Clenzy Corp", "clenzy-corp", "COMPANY", 5);

        assertEquals(1L, dto.getId());
        assertEquals("Clenzy Corp", dto.getName());
        assertEquals("clenzy-corp", dto.getSlug());
        assertEquals("COMPANY", dto.getType());
        assertEquals(5, dto.getMemberCount());
        assertNull(dto.getCreatedAt());
        assertNull(dto.getUpdatedAt());
    }

    @Test
    void sevenArgConstructor_setsAllFieldsIncludingTimestamps() {
        LocalDateTime created = LocalDateTime.of(2026, 1, 1, 0, 0);
        LocalDateTime updated = LocalDateTime.of(2026, 2, 15, 12, 30);

        OrganizationDto dto = new OrganizationDto(2L, "Acme", "acme", "AGENCY", 12, created, updated);

        assertEquals(2L, dto.getId());
        assertEquals("Acme", dto.getName());
        assertEquals("acme", dto.getSlug());
        assertEquals("AGENCY", dto.getType());
        assertEquals(12, dto.getMemberCount());
        assertEquals(created, dto.getCreatedAt());
        assertEquals(updated, dto.getUpdatedAt());
    }
}
