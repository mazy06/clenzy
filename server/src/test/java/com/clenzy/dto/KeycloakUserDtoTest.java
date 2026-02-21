package com.clenzy.dto;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class KeycloakUserDtoTest {

    @Test
    void constructor_setsAllFields() {
        KeycloakUserDto dto = new KeycloakUserDto("id-1", "jdupont", "jean@test.com", "Jean", "Dupont");

        assertEquals("id-1", dto.getId());
        assertEquals("jdupont", dto.getUsername());
        assertEquals("jean@test.com", dto.getEmail());
        assertEquals("Jean", dto.getFirstName());
        assertEquals("Dupont", dto.getLastName());
    }

    @Test
    void getFullName_withBothNames_returnsFirstAndLast() {
        KeycloakUserDto dto = new KeycloakUserDto("id-1", "jdupont", "jean@test.com", "Jean", "Dupont");
        assertEquals("Jean Dupont", dto.getFullName());
    }

    @Test
    void getFullName_withOnlyFirstName_returnsFirstName() {
        KeycloakUserDto dto = new KeycloakUserDto("id-1", "jdupont", "jean@test.com", "Jean", null);
        assertEquals("Jean", dto.getFullName());
    }

    @Test
    void getFullName_withOnlyLastName_returnsLastName() {
        KeycloakUserDto dto = new KeycloakUserDto("id-1", "jdupont", "jean@test.com", null, "Dupont");
        assertEquals("Dupont", dto.getFullName());
    }

    @Test
    void getFullName_noNames_hasUsername_returnsUsername() {
        KeycloakUserDto dto = new KeycloakUserDto("id-1", "jdupont", "jean@test.com", null, null);
        assertEquals("jdupont", dto.getFullName());
    }

    @Test
    void getFullName_nothingButEmail_returnsEmail() {
        KeycloakUserDto dto = new KeycloakUserDto("id-1", null, "jean@test.com", null, null);
        assertEquals("jean@test.com", dto.getFullName());
    }

    @Test
    void getFullName_allNull_returnsNull() {
        KeycloakUserDto dto = new KeycloakUserDto("id-1", null, null, null, null);
        assertNull(dto.getFullName());
    }

    @Test
    void toString_containsAllFields() {
        KeycloakUserDto dto = new KeycloakUserDto("id-1", "jdupont", "jean@test.com", "Jean", "Dupont");
        String result = dto.toString();
        assertTrue(result.contains("id-1"));
        assertTrue(result.contains("jdupont"));
        assertTrue(result.contains("jean@test.com"));
        assertTrue(result.contains("Jean"));
        assertTrue(result.contains("Dupont"));
    }
}
